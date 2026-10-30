// Everything that describes the business rules lives here.

// Firebase web config is public by design: access is controlled by the
// Realtime Database rules (see firebase/database.rules.json), not by this key.
export const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDkvik3tzscp8dBg7kxRoOzEW-Jl9Xz2w4',
    authDomain: 'collection-dash.firebaseapp.com',
    databaseURL: 'https://collection-dash-default-rtdb.firebaseio.com',
    projectId: 'collection-dash',
    storageBucket: 'collection-dash.firebasestorage.app',
    messagingSenderId: '458564338656',
    appId: '1:458564338656:web:9b0f98d2cf5d0054e86185'
};

// Display order of the state groups. New locations land in the first one.
export const GROUPS = ['Illinois', 'Wisconsin', 'Indiana'];

// Clinic status by % of target reached, checked top-down.
export const STATUS_LEVELS = [
    { key: 'good', min: 100, label: '100%+', icon: 'fa-circle-check' },
    { key: 'warning', min: 90, label: '90–99%', icon: 'fa-circle-half-stroke' },
    { key: 'serious', min: 80, label: '80–89%', icon: 'fa-circle-exclamation' },
    { key: 'critical', min: -Infinity, label: 'Below 80%', icon: 'fa-circle-xmark' }
];

// Bonus tiers are reached by the NUMBER of clinics at 100%+ of their target.
export const TIERS = [
    { name: 'Tier 1', min: 12, color: '--tier-1' }, // 12–14 clinics
    { name: 'Tier 2', min: 15, color: '--tier-2' }, // 15–23 clinics
    { name: 'Tier 3', min: 24, color: '--tier-3' }  // 24+ clinics
];

// The Excel workbook has one sheet per month ("October", "November", …).
// "Current month" is decided in the clinics' time zone.
export const REPORT_TIMEZONE = 'America/Chicago';

// SharePoint is synced only on demand, by a GitHub Action
// (.github/workflows/sync-sharepoint.yml) that "Sync now" opens.
export const SYNC_WORKFLOW_URL = 'https://github.com/yuraromaniv/collection-report/actions/workflows/sync-sharepoint.yml';

// Where clinics live in the monthly Excel sheet (0-based row indexes).
// Each block is a row of clinic names with their numbers in the same column;
// a row may hold any number of clinics.
export const EXCEL_LAYOUT = {
    blocks: [
        { names: 1, targets: 2, finalized: 16, deposit: 17 },
        { names: 7, targets: 8, finalized: 20, deposit: 21 }
    ]
};
