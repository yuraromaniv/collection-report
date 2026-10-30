// Everything that talks to Firebase: auth, live data, history, settings.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
    getDatabase, ref, onValue, get, set, update, push, remove
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

import { FIREBASE_CONFIG } from './config.js';
import { normalizeLocations } from './metrics.js';
import { setState } from './state.js';
import { showToast } from './utils.js';

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getDatabase(app);

// ─── Auth ────────────────────────────────────────────────────────────────────

export function watchAuth() {
    onAuthStateChanged(auth, user => setState({ user }));
}

export const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);

// ─── Live data vs. archived report ───────────────────────────────────────────

let stopLive = null;

function onReadError(error) {
    console.error('Firebase read error:', error);
    showToast(`Could not load data: ${error.message}`, 'error', 0);
}

export function showLive() {
    if (stopLive) return;
    setState({ history: null });

    const stops = [
        onValue(ref(db, 'locations'), snap => {
            setState({ locations: normalizeLocations(snap.val()), loaded: true });
        }, onReadError),
        onValue(ref(db, 'meta/lastUpdated'), snap => {
            setState({ lastUpdated: snap.val() || 0 });
        }, onReadError),
        onValue(ref(db, 'meta/lastSync'), snap => {
            setState({ lastSync: snap.val() });
        }, onReadError)
    ];
    stopLive = () => stops.forEach(stop => stop());
}

export async function showReport(key) {
    const report = (await get(ref(db, `history/${key}`))).val();
    if (!report) throw new Error('Report not found');

    if (stopLive) {
        stopLive();
        stopLive = null;
    }
    setState({
        history: { key, title: report.title, timestamp: report.timestamp },
        locations: normalizeLocations(report.locations),
        lastUpdated: report.timestamp || 0,
        loaded: true
    });
}

// ─── Writes ──────────────────────────────────────────────────────────────────

const STORED_FIELDS = ['id', 'name', 'group', 'order', 'target', 'finalize', 'deposit', 'sales'];

function serialize(locations) {
    return locations.map(loc => Object.fromEntries(STORED_FIELDS.map(field => [field, loc[field] ?? null])));
}

// `touch` bumps the "Last updated" time; reordering cards doesn't.
export function saveLocations(locations, { touch = true } = {}) {
    const updates = { locations: serialize(locations) };
    if (touch) updates['meta/lastUpdated'] = Date.now();
    return update(ref(db), updates);
}

// ─── History ─────────────────────────────────────────────────────────────────

export function archiveReport(locations, title) {
    return push(ref(db, 'history'), { timestamp: Date.now(), title, locations: serialize(locations) });
}

// Newest first. Sorted here rather than with orderByChild(), which would
// require an index in the database rules.
export async function listReports() {
    const snap = await get(ref(db, 'history'));
    const reports = [];
    snap.forEach(child => {
        const { title, timestamp } = child.val();
        reports.push({ key: child.key, title, timestamp });
    });
    return reports.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

export const renameReport = (key, title) => update(ref(db, `history/${key}`), { title });
export const deleteReport = key => remove(ref(db, `history/${key}`));

// ─── Settings (admin-only in the database rules) ─────────────────────────────

export async function getSharePointUrl() {
    return (await get(ref(db, 'config/sharepointUrl'))).val() || '';
}

export const setSharePointUrl = url => set(ref(db, 'config/sharepointUrl'), url || null);
