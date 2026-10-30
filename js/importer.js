// Getting numbers in: "Sync now" (SharePoint), manual Excel import, settings.
// The SharePoint download itself runs on GitHub Actions (tools/sync.js).

/* global XLSX */
import { GITHUB_REPO, SYNC_WORKFLOW_FILE, SYNC_WORKFLOW_URL } from './config.js';
import { getSettings, saveLocations, saveSettings } from './data.js';
import { dataSheetNames, findLocation, mergeImported, parseRows, pickReportSheet, sheetRows } from './excel.js';
import { pctOf, statusOf } from './metrics.js';
import { canEdit, onStateChange, state } from './state.js';
import { closeModal, escapeHtml, formatCurrency, openModal, showToast } from './utils.js';

// ─── Sync now ────────────────────────────────────────────────────────────────

const SYNC_TIMEOUT_MS = 5 * 60 * 1000;

async function startWorkflow(token) {
    const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${SYNC_WORKFLOW_FILE}/dispatches`,
        {
            method: 'POST',
            headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ref: 'main' })
        }
    );
    if (response.status === 204) return;
    if (response.status === 401) throw new Error('the GitHub token is invalid or expired — create a new one and paste it in Settings');
    if (response.status === 403 || response.status === 404) {
        throw new Error('the GitHub token cannot run the workflow — it needs “Actions: Read and write” on collection-report');
    }
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || `GitHub HTTP ${response.status}`);
}

// tools/sync.js writes meta/lastSync at the end of every run (success or not).
function waitForSyncResult(previousAt) {
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            stop();
            resolve(null);
        }, SYNC_TIMEOUT_MS);
        const stop = onStateChange(s => {
            if (s.lastSync && s.lastSync.at !== previousAt) {
                clearTimeout(timer);
                stop();
                resolve(s.lastSync);
            }
        });
    });
}

export async function syncNow() {
    if (!canEdit()) return;
    const button = document.getElementById('sync-now-btn');
    if (button.classList.contains('is-syncing')) return;

    const { githubToken } = await getSettings();
    if (!githubToken) {
        window.open(SYNC_WORKFLOW_URL, '_blank', 'noopener');
        showToast('Run the workflow on GitHub — or add a GitHub token in Settings to sync in one click', 'info', 8000);
        return;
    }

    button.classList.add('is-syncing');
    try {
        const previousAt = state.lastSync?.at;
        await startWorkflow(githubToken);
        showToast('Syncing from SharePoint… usually under a minute', 'loading', 0);

        const sync = await waitForSyncResult(previousAt);
        if (!sync) showToast('Sync is taking longer than usual — check Actions on GitHub', 'info', 10000);
        else if (sync.ok) showToast(`Synced — ${sync.sheet} sheet`, 'success', 6000);
        else showToast(`Sync failed: ${sync.message}`, 'error', 12000);
    } catch (error) {
        showToast(`Could not start the sync: ${error.message}`, 'error', 12000);
    } finally {
        button.classList.remove('is-syncing');
    }
}

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
        const settings = await getSettings();
        settingsForm.elements.sharepointUrl.value = settings.sharepointUrl;
        settingsForm.elements.githubToken.value = settings.githubToken;
    } catch (error) {
        showToast(`Could not load settings: ${error.message}`, 'error', 8000);
    }
}

async function onSettingsSubmit(event) {
    event.preventDefault();
    try {
        await saveSettings({
            sharepointUrl: settingsForm.elements.sharepointUrl.value.trim(),
            githubToken: settingsForm.elements.githubToken.value.trim()
        });
        closeModal('settings-modal');
        showToast('Settings saved', 'success');
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
    settingsForm.addEventListener('submit', onSettingsSubmit);
}
