// Pure calculations over location data — no DOM, no Firebase.

import { GROUPS, STATUS_LEVELS, TIERS } from './config.js';
import { generateId } from './utils.js';

export const pctOf = loc => (loc.target > 0 ? (loc.sales / loc.target) * 100 : 0);
export const remainingOf = loc => Math.max(0, loc.target - loc.sales);
export const statusOf = pct => STATUS_LEVELS.find(level => pct >= level.min);

// Cleans whatever is stored in Firebase (array or object, old or new shape).
export function normalizeLocations(raw) {
    const list = Array.isArray(raw) ? raw : Object.values(raw || {});
    return list.filter(Boolean).map((loc, index) => ({
        id: loc.id || generateId(),
        name: String(loc.name || 'Unnamed'),
        group: GROUPS.includes(loc.group) ? loc.group : GROUPS[0],
        order: Number.isFinite(loc.order) ? loc.order : index,
        target: Number(loc.target) || 0,
        // Older records only had `sales`; treat it as finalized in that case.
        finalize: loc.finalize !== undefined ? Number(loc.finalize) || 0 : Number(loc.sales) || 0,
        deposit: Number(loc.deposit) || 0,
        sales: Number(loc.sales) || 0
    }));
}

export function sortByGroup(locations) {
    return [...locations].sort((a, b) =>
        (GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group)) || (a.order - b.order));
}

export function tierFor(achieved) {
    const current = [...TIERS].reverse().find(tier => achieved >= tier.min) || null;
    const next = TIERS.find(tier => achieved < tier.min) || null;
    return { current, next, needed: next ? next.min - achieved : 0 };
}

// "12–14" / "24+"
export function tierRange(tier) {
    const following = TIERS[TIERS.indexOf(tier) + 1];
    return following ? `${tier.min}–${following.min - 1}` : `${tier.min}+`;
}

export function summarize(locations) {
    const active = locations.filter(loc => loc.target > 0);
    const counts = Object.fromEntries(STATUS_LEVELS.map(level => [level.key, 0]));
    let target = 0;
    let collected = 0;
    let gap = 0;

    active.forEach(loc => {
        counts[statusOf(pctOf(loc)).key]++;
        target += loc.target;
        collected += loc.sales;
        gap += remainingOf(loc);
    });

    const achieved = counts.good;
    return {
        total: active.length,
        achieved,
        belowTarget: active.length - achieved,
        counts,
        target,
        collected,
        gap,
        pct: target > 0 ? (collected / target) * 100 : 0,
        tier: tierFor(achieved)
    };
}

// Clinics below target that need the fewest dollars to get there.
export function closestToTarget(locations, limit = 3) {
    return locations
        .filter(loc => loc.target > 0 && pctOf(loc) < 100)
        .sort((a, b) => remainingOf(a) - remainingOf(b))
        .slice(0, limit);
}
