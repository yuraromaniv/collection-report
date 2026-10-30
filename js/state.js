// Single source of truth for what the page shows. Modules change it through
// setState(); main.js re-renders on every change.

export const state = {
    locations: [],
    lastUpdated: 0,
    loaded: false,
    user: null,
    history: null // { key, title, timestamp } while viewing an archived report
};

const listeners = new Set();

export function setState(patch) {
    Object.assign(state, patch);
    listeners.forEach(fn => fn(state));
}

export function onStateChange(fn) {
    listeners.add(fn);
}

export const isAdmin = () => !!state.user;
export const canEdit = () => isAdmin() && !state.history;
