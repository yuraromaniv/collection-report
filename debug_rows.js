const xlsx = require('./node_modules/xlsx');
const wb = xlsx.readFile('C:/Users/Admin/Desktop/CR.xlsx');
const ws = wb.Sheets['March'];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('--- Row 2 (Names) ---');
console.log(rows[1].slice(0, 5));
console.log('--- Row 3 (Targets) ---');
console.log(rows[2].slice(0, 5));
console.log('--- Row 17 (Finalized) ---');
console.log(rows[16].slice(0, 5));
console.log('--- Row 18 (Deposit Slip) ---');
console.log(rows[17].slice(0, 5));
