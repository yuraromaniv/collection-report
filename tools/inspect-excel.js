// Shows how the dashboard reads a monthly Excel report — handy when a clinic's
// numbers look wrong after an import.
//
//   node tools/inspect-excel.js "C:/path/CR.xlsx" [SheetName]

import { createRequire } from 'node:module';
import { dataSheetNames, parseRows, sheetRows } from '../js/excel.js';

const XLSX = createRequire(import.meta.url)('xlsx');
const [file, sheetArg] = process.argv.slice(2);

if (!file) {
    console.error('Usage: node tools/inspect-excel.js <file.xlsx> [sheet]');
    process.exit(1);
}

const workbook = XLSX.readFile(file);
const sheets = dataSheetNames(XLSX, workbook);
const sheet = sheetArg || sheets[sheets.length - 1];

console.log(`Sheets with data: ${sheets.join(', ') || '(none)'}`);
console.log(`Reading: ${sheet}\n`);
console.table(parseRows(sheetRows(XLSX, workbook.Sheets[sheet])));
