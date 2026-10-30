// Small helpers shared across modules. Nothing here touches the DOM at import
// time, so the module is also safe to import from the Node tools.

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const currencyWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const formatCurrency = n => currency.format(n || 0);
export const formatCurrencyWhole = n => currencyWhole.format(n || 0);

// Truncates instead of rounding so 99.96% never shows as "100.0%".
export const formatPercent = n => `${(Math.floor((n || 0) * 10) / 10).toFixed(1)}%`;

export function formatDateTime(ts) {
    return new Date(ts).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
}

export function generateId() {
    return Math.random().toString(36).slice(2, 11);
}

export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
}

export function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ─── Modals ──────────────────────────────────────────────────────────────────

export function openModal(id) {
    document.getElementById(id).hidden = false;
}

export function closeModal(id) {
    document.getElementById(id).hidden = true;
}

// ─── Toast ───────────────────────────────────────────────────────────────────

const TOAST_ICONS = {
    info: 'fa-circle-info',
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    loading: 'fa-rotate'
};

let toastTimer = null;

export function showToast(message, type = 'info', duration = 4000) {
    const toast = document.getElementById('toast');
    toast.dataset.type = type;
    toast.querySelector('.toast-icon').className = `toast-icon fa-solid ${TOAST_ICONS[type] || TOAST_ICONS.info}`;
    toast.querySelector('.toast-msg').textContent = message;
    toast.hidden = false;

    clearTimeout(toastTimer);
    if (duration > 0) {
        toastTimer = setTimeout(() => { toast.hidden = true; }, duration);
    }
}
