// Turns state into HTML for everything except the two canvases (charts.js).

import { GROUPS, STATUS_LEVELS, TIERS } from './config.js';
import { closestToTarget, pctOf, remainingOf, sortByGroup, statusOf, tierRange } from './metrics.js';
import { canEdit } from './state.js';
import { escapeHtml, formatCurrency, formatCurrencyWhole, formatDateTime, formatPercent } from './utils.js';

const RING_RADIUS = 28;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function renderChrome(state) {
    document.body.classList.toggle('is-admin', !!state.user);
    document.body.classList.toggle('can-edit', canEdit());

    const authBtn = document.getElementById('auth-btn');
    authBtn.querySelector('i').className = `fa-solid ${state.user ? 'fa-right-from-bracket' : 'fa-right-to-bracket'}`;
    authBtn.querySelector('.btn-label').textContent = state.user ? 'Logout' : 'Login';
    authBtn.title = state.user ? `Logout (${state.user.email})` : 'Admin login';

    const banner = document.getElementById('history-banner');
    banner.hidden = !state.history;
    if (state.history) document.getElementById('history-banner-title').textContent = state.history.title;

    document.getElementById('last-updated').textContent = !state.loaded
        ? 'Loading…'
        : state.history
            ? `Archived ${formatDateTime(state.history.timestamp)}`
            : state.lastUpdated ? `Updated ${formatDateTime(state.lastUpdated)}` : 'Not updated yet';
}

export function renderKpis(summary) {
    const overall = statusOf(summary.pct);
    const tiles = [
        {
            icon: 'fa-sack-dollar',
            label: 'Collected',
            value: formatCurrencyWhole(summary.collected),
            sub: `of <strong>${formatCurrencyWhole(summary.target)}</strong> target`
        },
        {
            icon: 'fa-bullseye',
            label: 'Overall achievement',
            value: formatPercent(summary.pct),
            meter: { pct: Math.min(summary.pct, 100), color: `var(--status-${overall.key})` }
        },
        {
            icon: 'fa-arrow-trend-up',
            label: 'Gap to target',
            value: formatCurrencyWhole(summary.gap),
            sub: `across <strong>${summary.belowTarget}</strong> clinic${summary.belowTarget === 1 ? '' : 's'} below target`
        },
        {
            icon: 'fa-hospital',
            label: 'Clinics at target',
            value: `${summary.achieved}<small> / ${summary.total}</small>`,
            sub: `<strong>${summary.counts.warning}</strong> more within 10% of target`
        }
    ];

    document.getElementById('kpis').innerHTML = tiles.map(tile => `
        <article class="kpi">
            <div class="kpi-label"><i class="fa-solid ${tile.icon}"></i>${tile.label}</div>
            <div class="kpi-value">${tile.value}</div>
            ${tile.meter ? `<div class="meter"><div class="meter-fill" style="width:${tile.meter.pct}%; --c:${tile.meter.color}"></div></div>` : ''}
            ${tile.sub ? `<div class="kpi-sub">${tile.sub}</div>` : ''}
        </article>
    `).join('');
}

export function renderStatusLegend(summary) {
    document.getElementById('status-legend').innerHTML = STATUS_LEVELS.map(level => `
        <li><span class="swatch" style="--c: var(--status-${level.key})"></span>${level.label} <strong>${summary.counts[level.key]}</strong></li>
    `).join('');
}

export function renderTierDetails(summary, locations) {
    const { current, next, needed } = summary.tier;
    const chip = tier => `<span class="tier-chip"><span class="swatch" style="--c: var(${tier.color})"></span>${tier.name}</span>`;

    const headline = next
        ? `<strong>${needed}</strong> more clinic${needed === 1 ? '' : 's'} at target to reach ${chip(next)}`
        : `<i class="fa-solid fa-trophy"></i> Top tier reached — ${chip(current)}`;

    const closest = next ? closestToTarget(locations, Math.max(3, Math.min(needed, 5))) : [];
    const closestHtml = closest.length ? `
        <div>
            <div class="eyebrow">Closest to target</div>
            <ol class="closest-list">
                ${closest.map(loc => `
                    <li><span class="name">${escapeHtml(loc.name)}</span><span class="gap">${formatCurrencyWhole(remainingOf(loc))} to go</span></li>
                `).join('')}
            </ol>
        </div>` : '';

    const legend = TIERS.map(tier => `
        <li class="${tier === current ? 'is-current' : ''}">
            <span class="swatch" style="--c: var(${tier.color})"></span>
            <span>${tier.name}</span>
            <span class="range">${tierRange(tier)} clinics</span>
        </li>
    `).join('');

    document.getElementById('tier-details').innerHTML = `
        <p class="tier-next">${headline}</p>
        ${closestHtml}
        <ul class="tier-legend">${legend}</ul>
    `;
}

function cardHtml(loc) {
    const pct = pctOf(loc);
    const status = statusOf(pct);
    const achieved = status.key === 'good';
    const offset = RING_CIRCUMFERENCE * (1 - Math.min(pct, 100) / 100);
    // Target met only thanks to deposit slips — finalized alone is still short.
    const finalizedShort = achieved && loc.finalize < loc.target;

    const statusLine = achieved
        ? `<i class="fa-solid ${status.icon}"></i>Target achieved · <strong>+${formatCurrency(loc.sales - loc.target)}</strong>`
        : `<i class="fa-solid ${status.icon}"></i>Needs <strong>${formatCurrency(remainingOf(loc))}</strong> to reach the goal`;

    return `
        <article class="loc-card status-${status.key}" data-id="${escapeHtml(loc.id)}" style="--c: var(--status-${status.key})">
            <header class="loc-head">
                <h3 title="${escapeHtml(loc.name)}">${escapeHtml(loc.name)}</h3>
                <div class="loc-actions edit-only">
                    <button class="icon-btn" data-action="edit-location" data-id="${escapeHtml(loc.id)}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn icon-btn-danger" data-action="delete-location" data-id="${escapeHtml(loc.id)}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </header>
            <div class="loc-body">
                <div class="ring" role="img" aria-label="${formatPercent(pct)} of target, ${status.label}">
                    <svg viewBox="0 0 68 68">
                        <circle class="ring-track" cx="34" cy="34" r="${RING_RADIUS}"></circle>
                        <circle class="ring-fill" cx="34" cy="34" r="${RING_RADIUS}"
                            stroke-dasharray="${RING_CIRCUMFERENCE}" stroke-dashoffset="${offset}"></circle>
                    </svg>
                    <span class="ring-value">${formatPercent(pct)}</span>
                </div>
                <dl class="loc-figures">
                    <div><dt>Collection</dt><dd>${formatCurrency(loc.sales)}</dd></div>
                    <div><dt>Target</dt><dd>${formatCurrency(loc.target)}</dd></div>
                </dl>
            </div>
            <p class="loc-status">${statusLine}</p>
            <footer class="loc-foot">
                <div class="${finalizedShort ? 'is-short' : ''}" ${finalizedShort ? 'title="Finalized alone is below target"' : ''}>
                    Finalized
                    <strong>${finalizedShort ? '<i class="fa-solid fa-triangle-exclamation"></i> ' : ''}${formatCurrency(loc.finalize)}</strong>
                </div>
                <div>Deposit slip<strong>${formatCurrency(loc.deposit)}</strong></div>
            </footer>
        </article>
    `;
}

export function renderGroups(locations, loaded) {
    const container = document.getElementById('groups');

    if (loaded && locations.length === 0) {
        container.innerHTML = `
            <div class="panel empty-state">
                <i class="fa-solid fa-table-list"></i>
                No locations yet. ${canEdit() ? 'Use <strong>Import Excel</strong> or <strong>Add location</strong> above.' : 'An admin needs to import the monthly report.'}
            </div>`;
        return;
    }

    const sorted = sortByGroup(locations);
    container.innerHTML = GROUPS.map(group => {
        const items = sorted.filter(loc => loc.group === group);
        const active = items.filter(loc => loc.target > 0);
        const target = active.reduce((sum, loc) => sum + loc.target, 0);
        const collected = active.reduce((sum, loc) => sum + loc.sales, 0);
        const atTarget = active.filter(loc => pctOf(loc) >= 100).length;

        if (!items.length && !canEdit()) return '';

        return `
            <section class="group">
                <header class="group-head">
                    <h2>${escapeHtml(group)}</h2>
                    <div class="group-stats">
                        <span><strong>${atTarget}</strong> / ${active.length} at target</span>
                        <span>${formatCurrencyWhole(collected)} of ${formatCurrencyWhole(target)} · <strong>${formatPercent(target ? collected / target * 100 : 0)}</strong></span>
                    </div>
                </header>
                <div class="loc-grid" data-group="${escapeHtml(group)}">
                    ${items.length ? items.map(cardHtml).join('') : '<p class="group-empty">Drag clinics here</p>'}
                </div>
            </section>
        `;
    }).join('');
}

export function renderTable(locations) {
    const rows = sortByGroup(locations).map(loc => {
        const pct = pctOf(loc);
        const status = statusOf(pct);
        return `
            <tr class="status-${status.key}">
                <td class="loc-name">${escapeHtml(loc.name)}</td>
                <td class="state">${escapeHtml(loc.group)}</td>
                <td class="num">${formatCurrency(loc.target)}</td>
                <td class="num">${formatCurrency(loc.sales)}</td>
                <td class="num"><span class="status-pill" title="${status.label}"><span class="swatch" style="--c: var(--status-${status.key})"></span>${formatPercent(pct)}</span></td>
                <td class="num">${formatCurrency(remainingOf(loc))}</td>
                <td class="actions-col edit-only">
                    <button class="icon-btn" data-action="edit-location" data-id="${escapeHtml(loc.id)}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn icon-btn-danger" data-action="delete-location" data-id="${escapeHtml(loc.id)}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    document.getElementById('table-body').innerHTML = rows.join('')
        || '<tr><td colspan="7" class="empty-state">No data</td></tr>';
}
