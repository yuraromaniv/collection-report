const xlsx = require('./node_modules/xlsx');
const wb = xlsx.readFile('C:/Users/Admin/Desktop/CR.xlsx');
const sheetName = 'March';
const ws = wb.Sheets[sheetName];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

function parseImportSheetSim(rows) {
    const result = [];
    const names1 = rows[1] || [];
    const targets1 = rows[2] || [];
    const fin1 = rows[16] || [];
    const dep1 = rows[17] || [];

    for (let i = 0; i < 16; i++) {
        const name = (names1[i] || '').toString().replace(/\*/g, '').trim();
        const target = Number(targets1[i]) || 0;
        if (!name || target <= 0) continue;
        const finalize = Number(fin1[i]) || 0;
        const deposit = Number(dep1[i]) || 0;
        result.push({ name, target, finalize, deposit, sales: finalize + deposit });
    }

    const names2 = rows[7] || [];
    const targets2 = rows[8] || [];
    const fin2 = rows[20] || [];
    const dep2 = rows[21] || [];

    for (let i = 0; i < 16; i++) {
        const name = (names2[i] || '').toString().replace(/\*/g, '').trim();
        const target = Number(targets2[i]) || 0;
        if (!name || target <= 0) continue;
        const finalize = Number(fin2[i]) || 0;
        const deposit = Number(dep2[i]) || 0;
        result.push({ name, target, finalize, deposit, sales: finalize + deposit });
    }
    return result;
}

const parsed = parseImportSheetSim(rows);
const dekalb = parsed.find(d => d.name.toLowerCase().includes('dekal'));
console.log('Parsed Dekalb:', JSON.stringify(dekalb, null, 2));

console.log('--- ALL PARSED ---');
parsed.forEach(p => console.log(`${p.name}: Target=${p.target}, Fin=${p.finalize}, Dep=${p.deposit}`));
