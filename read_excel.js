const xlsx = require('./node_modules/xlsx');
const wb = xlsx.readFile('C:/Users/Admin/Desktop/CR.xlsx');
// Check March sheet (screenshot shows Dekalb col3 target=72000, collection=64924.9)
wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const data = xlsx.utils.sheet_to_json(ws, {header:1, defval:''});
    // Dekalb is col index 2 in row2
    if (data[1] && data[1][2] === 'Dekalb') {
        const target = data[2][2];
        const total = data[3][2];
        console.log(`Sheet: ${name}  Dekalb Target=${target}  Total=${total}  Row17(fin)=${data[16][2]}  Row18(dep)=${data[17][2]}`);
    }
});
