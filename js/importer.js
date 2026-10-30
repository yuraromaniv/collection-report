// Getting numbers in by hand: Excel import and the SharePoint link setting.
// Automatic SharePoint sync runs on GitHub Actions (tools/sync.js).

/* global XLSX */
import { getSharePointUrl, saveLocations, setSharePointUrl } from './data.js';
import { dataSheetNames, findLocation, mergeImported, parseRows, pickReportSheet, sheetRows } from './excel.js';
import { pctOf, statusOf } from './metrics.js';
import { canEdit, state } from './state.js';
import { closeModal, escapeHtml, formatCurrency, openModal, showToast } from './utils.js';

let workbook = null;

// ─── Manual Excel import ─────────────────────────────────────────────────────

const stepFile = document.getElementById('import-step-file');
const stepPreview = document.getElementById('import-step-preview');
const sheetSelect = document.getElementById('import-sheet');

function resetImport() {
    workbook = null;
    document.getElementById('import-file').value = '';
    stepFile.hidden = false;
    stepPreview.hidden = true;
}

export function openImport() {
    if (!canEdit()) return;
    resetImport();
    openModal('import-modal');
}

function readFile(file) {
    if (!/\.xlsx?$/i.test(file.name)) {
        showToast('Please choose an .xlsx or .xls file', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = event => {
        try {
            workbook = XLSX.read(new Uint8Array(event.target.result), { type: 'array' });
            const sheets = dataSheetNames(XLSX, workbook);
            if (!sheets.length) throw new Error('No sheets with targets found in this file.');

            sheetSelect.innerHTML = sheets.map(name => `<option>${escapeHtml(name)}</option>`).join('');
            sheetSelect.value = pickReportSheet(XLSX, workbook);
            stepFile.hidden = true;
            stepPreview.hidden = false;
            renderPreview();
        } catch (error) {
            showToast(`Could not read the file: ${error.message}`, 'error', 8000);
        }
    };
    reader.readAsArrayBuffer(file);
}

function selectedRows() {
    return parseRows(sheetRows(XLSX, workbook.Sheets[sheetSelect.value]));
}

function renderPreview() {
    const rows = selectedRows();
    const preview = document.getElementById('import-preview');
    if (!rows.length) {
        preview.innerHTML = '<p class="empty-state">No clinics found on this sheet.</p>';
        return;
    }

    const matched = rows.filter(row => findLocation(state.locations, row.name)).length;
    preview.innerHTML = `
        <div class="import-summary">
            <span><strong>${rows.length}</strong> clinics found</span>
            <span><i class="fa-solid fa-arrows-rotate"></i>${matched} will be updated</span>
            ${rows.length - matched ? `<span><i class="fa-solid fa-plus"></i>${rows.length - matched} will be added</span>` : ''}
        </div>
        <div class="preview-scroll">
            <table class="data-table">
                <thead><tr>
                    <th>Location</th><th class="num">Target</th><th class="num">Finalized</th>
                    <th class="num">Deposit</th><th class="num">Collection</th><th>Action</th>
                </tr></thead>
                <tbody>
                    ${rows.map(row => {
                        const status = statusOf(pctOf(row));
                        const match = findLocation(state.locations, row.name);
                        return `
                            <tr>
                                <td class="loc-name">${escapeHtml(row.name)}</td>
                                <td class="num">${formatCurrency(row.target)}</td>
                                <td class="num">${formatCurrency(row.finalize)}</td>
                                <td class="num">${formatCurrency(row.deposit)}</td>
                                <td class="num"><span class="status-pill"><span class="swatch" style="--c: var(--status-${status.key})"></span>${formatCurrency(row.sales)}</span></td>
                                <td>${match
                                    ? `<span class="tag" title="Matches “${escapeHtml(match.name)}”"><i class="fa-solid fa-arrows-rotate"></i>Update</span>`
                                    : '<span class="tag"><i class="fa-solid fa-plus"></i>New</span>'}</td>
                            </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

async function confirmImport() {
    const button = document.getElementById('import-confirm');
    button.disabled = true;
    try {
        const { locations, updated, added } = mergeImported(state.locations, selectedRows());
        await saveLocations(locations);
        closeModal('import-modal');
        showToast(`Imported “${sheetSelect.value}”: ${updated} updated${added ? `, ${added} added` : ''}`, 'success', 6000);
    } catch (error) {
        showToast(`Import failed: ${error.message}`, 'error', 8000);
    } finally {
        button.disabled = false;
    }
}

// ─── Settings ────────────────────────────────────────────────────────────────

const settingsForm = document.getElementById('settings-form');

export async function openSettings() {
    if (!canEdit()) return;
    settingsForm.reset();
    openModal('settings-modal');
    try {
        settingsForm.elements.sharepointUrl.value = await getSharePointUrl();
    } catch (error) {
        showToast(`Could not load settings: ${error.message}`, 'error', 8000);
    }
}

async function saveSettings(event) {
    event.preventDefault();
    try {
        await setSharePointUrl(settingsForm.elements.sharepointUrl.value.trim());
        closeModal('settings-modal');
        showToast('Settings saved — the next automatic sync will use this link', 'success', 6000);
    } catch (error) {
        showToast(`Could not save settings: ${error.message}`, 'error', 8000);
    }
}

export function initImporter() {
    const dropzone = document.getElementById('import-dropzone');
    const fileInput = document.getElementById('import-file');

    fileInput.addEventListener('change', () => fileInput.files[0] && readFile(fileInput.files[0]));
    dropzone.addEventListener('dragover', event => {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
    dropzone.addEventListener('drop', event => {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
        const file = event.dataTransfer.files[0];
        if (file) readFile(file);
    });

    sheetSelect.addEventListener('change', renderPreview);
    document.getElementById('import-back').addEventListener('click', resetImport);
    document.getElementById('import-confirm').addEventListener('click', confirmImport);
    settingsForm.addEventListener('submit', saveSettings);
}
