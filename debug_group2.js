const xlsx = require('./node_modules/xlsx');
const wb = xlsx.readFile('C:/Users/Admin/Desktop/CR.xlsx');
const ws = wb.Sheets['March'];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('--- Row 8 (Names Group 2) ---');
console.log(rows[7].slice(0, 5));
console.log('--- Row 9 (Targets Group 2) ---');
console.log(rows[8].slice(0, 5));
console.log('--- Row 21 (Finalized Group 2) ---');
console.log(rows[20].slice(0, 5));
console.log('--- Row 22 (Deposit Slip Group 2) ---');
console.log(rows[21].slice(0, 5));
