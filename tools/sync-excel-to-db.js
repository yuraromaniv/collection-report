// Pushes a monthly Excel report straight into Firebase — the same thing the
// "Import Excel" button does, but from the command line.
//
// Credentials come from .env (never commit it):
//   ADMIN_EMAIL=...
//   ADMIN_PASSWORD=...
//
//   node --env-file=.env tools/sync-excel-to-db.js "C:/path/CR.xlsx" [SheetName]

import { createRequire } from 'node:module';
import { FIREBASE_CONFIG } from '../js/config.js';
import { dataSheetNames, mergeImported, parseRows, sheetRows } from '../js/excel.js';
import { normalizeLocations } from '../js/metrics.js';

const XLSX = createRequire(import.meta.url)('xlsx');
const [file, sheetArg] = process.argv.slice(2);
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

if (!file || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('Usage: node --env-file=.env tools/sync-excel-to-db.js <file.xlsx> [sheet]');
    console.error('.env must define ADMIN_EMAIL and ADMIN_PASSWORD');
    process.exit(1);
}

async function request(url, options) {
    const response = await fetch(url, options);
    const body = await response.json();
    if (!response.ok || body?.error) throw new Error(body?.error?.message || body?.error || `HTTP ${response.status}`);
    return body;
}

const auth = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`,
    {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true })
    }
);
console.log('Signed in.');

const workbook = XLSX.readFile(file);
const sheets = dataSheetNames(XLSX, workbook);
const sheet = sheetArg || sheets[sheets.length - 1];
const rows = parseRows(sheetRows(XLSX, workbook.Sheets[sheet]));
console.log(`Sheet "${sheet}": ${rows.length} clinics`);

const db = FIREBASE_CONFIG.databaseURL;
const current = normalizeLocations(await request(`${db}/locations.json?auth=${auth.idToken}`));
const { locations, updated, added } = mergeImported(current, rows);

await request(`${db}/.json?auth=${auth.idToken}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations, 'meta/lastUpdated': Date.now() })
});
console.log(`Saved: ${updated} updated, ${added} added.`);
