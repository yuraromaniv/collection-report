// Archiving the current month and browsing archived reports.

import { archiveReport, deleteReport, listReports, renameReport, showLive, showReport } from './data.js';
import { canEdit, isAdmin, state } from './state.js';
import { closeModal, escapeHtml, formatDateTime, openModal, showToast } from './utils.js';

const listEl = document.getElementById('history-list');

export async function archiveCurrent() {
    if (!canEdit()) return;
    const suggested = `Report — ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
    const title = prompt('Archive the current report as:', suggested);
    if (!title) return;

    try {
        await archiveReport(state.locations, title.trim());
        showToast('Report archived', 'success');
    } catch (error) {
        showToast(`Could not archive: ${error.message}`, 'error', 8000);
    }
}

export async function openHistory() {
    openModal('history-modal');
    listEl.innerHTML = '<li class="empty-state">Loading…</li>';

    try {
        const reports = await listReports();
        document.getElementById('history-count').textContent = `(${reports.length})`;
        listEl.innerHTML = reports.length
            ? reports.map(report => `
                <li class="history-item">
                    <div class="history-info">
                        <div class="history-title">${escapeHtml(report.title)}</div>
                        <div class="history-date">${formatDateTime(report.timestamp)}</div>
                    </div>
                    <div class="history-actions">
                        ${isAdmin() ? `
                            <button class="icon-btn" data-action="rename-report" data-key="${escapeHtml(report.key)}" title="Rename"><i class="fa-solid fa-pen"></i></button>
                            <button class="icon-btn icon-btn-danger" data-action="delete-report" data-key="${escapeHtml(report.key)}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                        ` : ''}
                        <button class="btn btn-sm btn-ghost" data-action="view-report" data-key="${escapeHtml(report.key)}">View</button>
                    </div>
                </li>`).join('')
            : '<li class="empty-state">No archived reports yet.</li>';
    } catch (error) {
        listEl.innerHTML = `<li class="empty-state">Could not load history: ${escapeHtml(error.message)}</li>`;
    }
}

export async function viewReport(key) {
    try {
        await showReport(key);
        closeModal('history-modal');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        showToast(`Could not open report: ${error.message}`, 'error', 8000);
    }
}

export function exitHistory() {
    showLive();
}

export async function renameReportPrompt(key, button) {
    if (!isAdmin()) return;
    const current = button.closest('.history-item').querySelector('.history-title').textContent;
    const title = prompt('New title for this report:', current);
    if (!title || title === current) return;

    await renameReport(key, title.trim());
    if (state.history?.key === key) await showReport(key);
    openHistory();
}

export async function deleteReportConfirm(key) {
    if (!isAdmin() || !confirm('Delete this archived report? This cannot be undone.')) return;

    await deleteReport(key);
    if (state.history?.key === key) showLive();
    openHistory();
}
