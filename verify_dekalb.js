const xlsx = require('./node_modules/xlsx');
const wb = xlsx.readFile('C:/Users/Admin/Desktop/CR.xlsx');
const ws = wb.Sheets['March'];
const data = xlsx.utils.sheet_to_json(ws, {header:1, defval:''});

console.log('Sheet: March');
const colIndex = 2; // Column C
console.log('Row 2 (Name):', data[1][colIndex]);
console.log('Row 3 (Target):', data[2][colIndex]);
console.log('Row 4 (Total Col):', data[3][colIndex]);
console.log('Row 17 (Finalized):', data[16][colIndex]);
console.log('Row 18 (Deposit):', data[17][colIndex]);
console.log('Row 19 (Total Fin+Dep):', data[18][colIndex]);

// Check if there are other Dekalb entries or hidden rows
data.forEach((row, rIdx) => {
    row.forEach((cell, cIdx) => {
        if (cell && cell.toString().toLowerCase().includes('dekal')) {
            console.log(`Found "${cell}" at Row ${rIdx+1}, Col ${String.fromCharCode(65+cIdx)} (index ${cIdx})`);
        }
    });
});
