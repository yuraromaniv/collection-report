// Admin actions on locations: add / edit / delete, clear amounts, drag & drop.

/* global Sortable */
import { GROUPS } from './config.js';
import { saveLocations } from './data.js';
import { canEdit, state } from './state.js';
import { closeModal, formatCurrency, generateId, openModal, showToast } from './utils.js';

const form = document.getElementById('location-form');

function amount(input) {
    return parseFloat(input.value) || 0;
}

function updateTotal() {
    const total = amount(form.elements.finalize) + amount(form.elements.deposit);
    document.getElementById('location-total').textContent = formatCurrency(total);
}

async function save(locations, options) {
    try {
        await saveLocations(locations, options);
        return true;
    } catch (error) {
        console.error('Save failed:', error);
        showToast(`Could not save: ${error.message}`, 'error', 8000);
        return false;
    }
}

export function openLocationModal(id) {
    if (!canEdit()) return;
    const loc = id ? state.locations.find(l => l.id === id) : null;

    form.reset();
    document.getElementById('location-modal-title').textContent = loc ? 'Edit location' : 'Add location';
    form.elements.id.value = loc?.id || '';
    form.elements.name.value = loc?.name || '';
    form.elements.group.value = loc?.group || GROUPS[0];
    form.elements.target.value = loc ? loc.target.toFixed(2) : '';
    form.elements.finalize.value = loc ? loc.finalize.toFixed(2) : '';
    form.elements.deposit.value = loc ? loc.deposit.toFixed(2) : '';
    updateTotal();

    openModal('location-modal');
    setTimeout(() => form.elements.name.focus(), 50);
}

async function onSubmit(event) {
    event.preventDefault();
    if (!canEdit()) return;

    const id = form.elements.id.value;
    const finalize = amount(form.elements.finalize);
    const deposit = amount(form.elements.deposit);
    const fields = {
        name: form.elements.name.value.trim(),
        group: form.elements.group.value,
        target: amount(form.elements.target),
        finalize,
        deposit,
        sales: finalize + deposit
    };

    const existing = state.locations.find(l => l.id === id);
    let locations;
    if (existing) {
        // Moving to another state puts the card at the end of that group.
        const order = existing.group === fields.group ? existing.order : state.locations.length;
        locations = state.locations.map(l => (l.id === id ? { ...l, ...fields, order } : l));
    } else {
        locations = [...state.locations, { id: generateId(), order: state.locations.length, ...fields }];
    }

    if (await save(locations)) {
        closeModal('location-modal');
        showToast(existing ? `Saved ${fields.name}` : `Added ${fields.name}`, 'success');
    }
}

export async function deleteLocation(id) {
    if (!canEdit()) return;
    const loc = state.locations.find(l => l.id === id);
    if (!loc || !confirm(`Remove "${loc.name}" from the dashboard?`)) return;

    if (await save(state.locations.filter(l => l.id !== id))) {
        showToast(`Removed ${loc.name}`, 'success');
    }
}

export async function clearAmounts() {
    if (!canEdit()) return;
    if (!confirm('Clear all collection amounts? Locations and targets are kept. This cannot be undone.')) return;

    const cleared = state.locations.map(l => ({ ...l, finalize: 0, deposit: 0, sales: 0 }));
    if (await save(cleared)) showToast('All amounts cleared', 'success');
}

// ─── Drag & drop between and within state groups ─────────────────────────────

let sortables = [];

function onDragEnd() {
    const placement = new Map();
    document.querySelectorAll('.loc-grid').forEach(grid => {
        grid.querySelectorAll('.loc-card').forEach((card, order) => {
            placement.set(card.dataset.id, { group: grid.dataset.group, order });
        });
    });

    const locations = state.locations.map(l => ({ ...l, ...placement.get(l.id) }));
    save(locations, { touch: false });
}

export function initSortable() {
    sortables.forEach(s => s.destroy());
    sortables = [];
    if (!canEdit()) return;

    document.querySelectorAll('.loc-grid').forEach(grid => {
        sortables.push(new Sortable(grid, {
            group: 'locations',
            draggable: '.loc-card',
            filter: 'button',
            preventOnFilter: false,
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: onDragEnd
        }));
    });
}

export function initLocations() {
    form.elements.group.innerHTML = GROUPS.map(g => `<option value="${g}">${g}</option>`).join('');
    form.addEventListener('input', updateTotal);
    form.addEventListener('submit', onSubmit);
}
