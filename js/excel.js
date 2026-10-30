// Reading the monthly Excel report and merging it into the locations list.
// Pure functions: the XLSX library is passed in, so the same code runs in the
// browser and in the Node tools (tools/*.js).

import { EXCEL_LAYOUT, GROUPS } from './config.js';
import { generateId } from './utils.js';

export function sheetRows(XLSX, sheet) {
    return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
}

// A sheet counts as a month with data when the first targets row has numbers.
export function dataSheetNames(XLSX, workbook) {
    const targetsRow = EXCEL_LAYOUT.blocks[0].targets;
    return workbook.SheetNames.filter(name => {
        const row = sheetRows(XLSX, workbook.Sheets[name])[targetsRow];
        return Array.isArray(row) && row.some(v => typeof v === 'number' && v > 0);
    });
}

export function parseRows(rows) {
    const result = [];

    EXCEL_LAYOUT.blocks.forEach(block => {
        const names = rows[block.names] || [];
        const targets = rows[block.targets] || [];
        const finalized = rows[block.finalized] || [];
        const deposits = rows[block.deposit] || [];

        for (let col = 0; col < EXCEL_LAYOUT.maxColumns; col++) {
            const name = String(names[col] ?? '').replace(/\*/g, '').trim();
            const target = Number(targets[col]) || 0;
            if (!name || target <= 0) continue;

            const finalize = Number(finalized[col]) || 0;
            const deposit = Number(deposits[col]) || 0;
            result.push({ name, target, finalize, deposit, sales: finalize + deposit });
        }
    });

    return result;
}

// ─── Matching Excel names to existing locations ──────────────────────────────

const normalizeName = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Known spelling differences between the Excel file and the dashboard.
const NAME_ALIASES = { dekal: 'dekalb' };

export function findLocation(locations, name) {
    const norm = normalizeName(name);
    if (!norm) return null;
    const wanted = NAME_ALIASES[norm] || norm;

    return locations.find(loc => normalizeName(loc.name) === wanted)
        // Prefix match, e.g. "Dekal" ↔ "Dekalb"
        || locations.find(loc => {
            const existing = normalizeName(loc.name);
            return existing.length > 3 && (existing.startsWith(norm) || norm.startsWith(existing));
        })
        || null;
}

// Returns a new list with amounts updated; unknown names are appended.
export function mergeImported(locations, imported) {
    const merged = locations.map(loc => ({ ...loc }));
    let updated = 0;
    let added = 0;

    imported.forEach(row => {
        const amounts = { target: row.target, finalize: row.finalize, deposit: row.deposit, sales: row.sales };
        const existing = findLocation(merged, row.name);
        if (existing) {
            Object.assign(existing, amounts);
            updated++;
        } else {
            merged.push({ id: generateId(), name: row.name, group: GROUPS[0], order: merged.length, ...amounts });
            added++;
        }
    });

    return { locations: merged, updated, added };
}
