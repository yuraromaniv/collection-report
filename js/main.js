// Entry point: wires state → render, and buttons → actions.

import { initCharts, refreshCharts, renderOverviewChart, renderTierChart } from './charts.js';
import { login, logout, showLive, watchAuth } from './data.js';
import {
    archiveCurrent, deleteReportConfirm, exitHistory, openHistory, renameReportPrompt, viewReport
} from './history.js';
import { initImporter, openImport, openSettings, setAutoSync, syncFromSharePoint, toggleAutoSync } from './importer.js';
import { clearAmounts, deleteLocation, initLocations, initSortable, openLocationModal } from './locations.js';
import { summarize } from './metrics.js';
import {
    renderChrome, renderGroups, renderKpis, renderStatusLegend, renderTable, renderTierDetails
} from './render.js';
import { isAdmin, onStateChange, state } from './state.js';
import { closeModal, openModal, showToast } from './utils.js';

// ─── Rendering ───────────────────────────────────────────────────────────────

function render() {
    const summary = summarize(state.locations);
    renderChrome(state);
    renderKpis(summary);
    renderStatusLegend(summary);
    renderOverviewChart(state.locations);
    renderTierChart(summary);
    renderTierDetails(summary, state.locations);
    renderGroups(state.locations, state.loaded);
    renderTable(state.locations);
    initSortable();
}

// Several state changes in one tick (e.g. locations + timestamp) → one render.
let renderQueued = false;
function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
        renderQueued = false;
        render();
    });
}

// ─── Actions (buttons with data-action="…") ──────────────────────────────────

const actions = {
    'auth': () => (isAdmin() ? logout() : openLogin()),
    'open-history': openHistory,
    'view-report': el => viewReport(el.dataset.key),
    'rename-report': el => renameReportPrompt(el.dataset.key, el),
    'delete-report': el => deleteReportConfirm(el.dataset.key),
    'exit-history': exitHistory,
    'archive': archiveCurrent,
    'add-location': () => openLocationModal(),
    'edit-location': el => openLocationModal(el.dataset.id),
    'delete-location': el => deleteLocation(el.dataset.id),
    'clear-amounts': clearAmounts,
    'open-import': openImport,
    'sync-now': () => syncFromSharePoint(),
    'toggle-auto-sync': toggleAutoSync,
    'open-settings': openSettings
};

document.addEventListener('click', event => {
    const closer = event.target.closest('[data-close]');
    if (closer) {
        closeModal(closer.closest('.modal').id);
        return;
    }

    const el = event.target.closest('[data-action]');
    const action = el && actions[el.dataset.action];
    if (!action) return;
    event.preventDefault();
    Promise.resolve(action(el)).catch(error => {
        console.error(error);
        showToast(error.message, 'error', 8000);
    });
});

// Escape closes the top-most open modal (clicking outside does not, so a
// half-filled form is never lost by accident).
document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal:not([hidden])')].pop();
    if (open) closeModal(open.id);
});

// ─── Login ───────────────────────────────────────────────────────────────────

const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

function openLogin() {
    loginForm.reset();
    loginError.hidden = true;
    openModal('login-modal');
    setTimeout(() => loginForm.elements.email.focus(), 50);
}

loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginError.hidden = true;
    try {
        await login(loginForm.elements.email.value.trim(), loginForm.elements.password.value);
        closeModal('login-modal');
    } catch (error) {
        loginError.textContent = error.code === 'auth/invalid-credential' ? 'Wrong email or password.' : error.message;
        loginError.hidden = false;
    }
});

// ─── Start ───────────────────────────────────────────────────────────────────

document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
});

let wasAdmin = false;
onStateChange(() => {
    // Logging out stops the background SharePoint polling.
    if (wasAdmin && !isAdmin()) setAutoSync(false);
    wasAdmin = isAdmin();
    scheduleRender();
});

initCharts();
initLocations();
initImporter();
watchAuth();
showLive();
document.fonts?.ready.then(refreshCharts);
