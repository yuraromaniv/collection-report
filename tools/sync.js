// Pulls the monthly Excel report into Firebase.
//
// Runs every 15 minutes on GitHub Actions (.github/workflows/sync-sharepoint.yml):
// downloads the workbook from the SharePoint link saved in the dashboard's
// Settings, picks the current month's sheet and saves it if anything changed.
//
// Locally (credentials in .env, see .env.example):
//   npm run sync                                  same as the scheduled job
//   npm run sync -- "C:/path/report.xlsx"         from a local file instead
//   node tools/sync.js "<sharepoint link>" --dry-run   only check the link, no Firebase
//
// Actions logs of a public repo are public: never print the link or any amounts.

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { FIREBASE_CONFIG } from '../js/config.js';
import { mergeImported, parseRows, pickReportSheet, sheetRows } from '../js/excel.js';
import { normalizeLocations } from '../js/metrics.js';

const XLSX = createRequire(import.meta.url)('xlsx');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const source = args.find(arg => !arg.startsWith('--'));
const { ADMIN_EMAIL, ADMIN_PASSWORD, GITHUB_ACTIONS } = process.env;

// ─── HTTP helpers ────────────────────────────────────────────────────────────

async function request(url, { method = 'GET', body } = {}) {
    const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error?.message || data?.error || `HTTP ${response.status}`);
    return data;
}

async function signIn() {
    const auth = await request(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`,
        { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true } }
    );
    return auth.idToken;
}

const db = (path, token, options) => request(`${FIREBASE_CONFIG.databaseURL}/${path}.json?auth=${token}`, options);

// "Anyone with the link" downloads set a guest cookie on the first redirect and
// answer 403 without it, so redirects are followed by hand, keeping cookies.
async function downloadSharePoint(shareUrl) {
    let url = new URL(shareUrl);
    url.searchParams.set('download', '1');
    const cookies = new Map();

    for (let hop = 0; hop < 10; hop++) {
        const response = await fetch(url, {
            redirect: 'manual',
            headers: cookies.size ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}
        });
        for (const header of response.headers.getSetCookie()) {
            const [pair] = header.split(';');
            const eq = pair.indexOf('=');
            cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
        }

        if (response.status >= 300 && response.status < 400) {
            url = new URL(response.headers.get('location'), url);
            continue;
        }
        if (!response.ok) throw new Error(`SharePoint answered HTTP ${response.status} — is the link shared with "Anyone with the link"?`);

        const type = response.headers.get('content-type') || '';
        if (!/spreadsheetml|excel|octet-stream/.test(type)) {
            throw new Error(`SharePoint returned "${type.split(';')[0]}" instead of an Excel file — the link may require sign-in or has expired.`);
        }
        return Buffer.from(await response.arrayBuffer());
    }
    throw new Error('Too many redirects from SharePoint.');
}

function changed(before, after) {
    const key = list => JSON.stringify(list.map(l => [l.id, l.name, l.target, l.finalize, l.deposit, l.sales]));
    return key(before) !== key(after);
}

// ─── Run ─────────────────────────────────────────────────────────────────────

const needsFirebase = !dryRun || !source;
if (needsFirebase && (!ADMIN_EMAIL || !ADMIN_PASSWORD)) {
    if (GITHUB_ACTIONS) {
        // Not configured yet: skip quietly instead of failing every 15 minutes.
        console.log('::notice::Add the ADMIN_EMAIL and ADMIN_PASSWORD repository secrets to turn on the SharePoint sync.');
        process.exit(0);
    }
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (see .env.example), or pass a file/link with --dry-run.');
    process.exit(1);
}

const token = needsFirebase ? await signIn() : null;
const status = { at: Date.now(), ok: false };

try {
    let buffer;
    if (source && !/^https?:\/\//i.test(source)) {
        buffer = await readFile(source);
    } else {
        const shareUrl = source || await db('config/sharepointUrl', token);
        if (!shareUrl) throw new Error('SharePoint link is not set — add it in the dashboard Settings.');
        buffer = await downloadSharePoint(shareUrl);
    }

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = pickReportSheet(XLSX, workbook);
    if (!sheet) throw new Error('No month sheets with targets found in the workbook.');
    const rows = parseRows(sheetRows(XLSX, workbook.Sheets[sheet]));
    if (!rows.length) throw new Error(`Sheet "${sheet}" has no clinics.`);

    if (dryRun) {
        const atTarget = rows.filter(row => row.target > 0 && row.sales >= row.target).length;
        console.log(`OK — sheet "${sheet}": ${rows.length} clinics, ${atTarget} at target. Nothing saved (dry run).`);
        process.exit(0);
    }

    const current = normalizeLocations(await db('locations', token));
    const { locations, updated, added } = mergeImported(current, rows);
    Object.assign(status, { ok: true, sheet, message: `${rows.length} clinics read` });

    const updates = { 'meta/lastSync': status };
    if (changed(current, locations)) {
        updates.locations = locations;
        updates['meta/lastUpdated'] = status.at;
    }
    await db('', token, { method: 'PATCH', body: updates });
    console.log(`Sheet "${sheet}": ${updates.locations ? `saved — ${updated} updated, ${added} added` : 'no changes'}.`);
} catch (error) {
    console.error(`Sync failed: ${error.message}`);
    if (token) {
        status.message = error.message;
        await db('meta/lastSync', token, { method: 'PUT', body: status }).catch(() => {});
    }
    process.exit(1);
}
