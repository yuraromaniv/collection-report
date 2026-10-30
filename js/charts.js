// The two canvases: per-clinic achievement bars and the bonus-tier ring.
// Colors come from the CSS tokens so the palette lives in one place.

/* global Chart */
import { TIERS } from './config.js';
import { pctOf, sortByGroup, statusOf, tierRange } from './metrics.js';
import { cssVar, formatCurrency, formatPercent } from './utils.js';

const FONT = "Inter, system-ui, sans-serif";

let overviewChart = null;
let overviewRows = [];
let tierChart = null;
let tierView = null;

function tooltipStyle() {
    return {
        backgroundColor: '#262624',
        borderColor: 'rgba(255, 255, 255, 0.14)',
        borderWidth: 1,
        titleColor: cssVar('--text'),
        bodyColor: cssVar('--text-2'),
        titleFont: { family: FONT, size: 13, weight: '600' },
        bodyFont: { family: FONT, size: 12 },
        padding: 10,
        cornerRadius: 8,
        displayColors: false
    };
}

// ─── Overview bars ───────────────────────────────────────────────────────────

// Horizontal reference line at 100% of target.
const targetLinePlugin = {
    id: 'targetLine',
    afterDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        const y = Math.round(scales.y.getPixelForValue(100)) + 0.5;
        if (y < chartArea.top || y > chartArea.bottom) return;

        ctx.save();
        ctx.strokeStyle = cssVar('--text-2');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();
        ctx.restore();
    }
};

// Thin separators + state names between the groups of bars.
const groupDividersPlugin = {
    id: 'groupDividers',
    beforeDatasetsDraw(chart) {
        const { ctx, chartArea, scales } = chart;
        const ranges = [];
        overviewRows.forEach((loc, i) => {
            if (!ranges.length || ranges[ranges.length - 1].name !== loc.group) ranges.push({ name: loc.group, start: i });
        });

        ctx.save();
        ctx.font = `600 11px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ranges.forEach((range, i) => {
            const x = i === 0
                ? chartArea.left
                : Math.round((scales.x.getPixelForValue(range.start - 1) + scales.x.getPixelForValue(range.start)) / 2) + 0.5;
            if (i > 0) {
                ctx.strokeStyle = cssVar('--border-strong');
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, chartArea.top - 18);
                ctx.lineTo(x, chartArea.bottom);
                ctx.stroke();
            }
            ctx.fillStyle = cssVar('--text-muted');
            ctx.fillText(range.name.toUpperCase(), x + 6, chartArea.top - 6);
        });
        ctx.restore();
    }
};

export function renderOverviewChart(locations) {
    overviewRows = sortByGroup(locations).filter(loc => loc.target > 0);
    const pcts = overviewRows.map(pctOf);
    const colors = pcts.map(pct => cssVar(`--status-${statusOf(pct).key}`));
    const maxPct = Math.max(100, ...pcts);

    const data = {
        labels: overviewRows.map(loc => loc.name),
        datasets: [{
            data: pcts,
            backgroundColor: colors,
            hoverBackgroundColor: colors,
            borderRadius: 4,
            borderSkipped: 'start',
            maxBarThickness: 24,
            categoryPercentage: 0.86,
            barPercentage: 0.92
        }]
    };

    if (overviewChart) {
        overviewChart.data = data;
        overviewChart.options.scales.y.suggestedMax = Math.ceil(maxPct / 10) * 10 + 10;
        overviewChart.update();
        return;
    }

    overviewChart = new Chart(document.getElementById('overview-chart'), {
        type: 'bar',
        data,
        plugins: [groupDividersPlugin, targetLinePlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 22 } },
            interaction: { mode: 'index', intersect: false },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: Math.ceil(maxPct / 10) * 10 + 10,
                    border: { display: false },
                    grid: { color: cssVar('--grid'), drawTicks: false },
                    ticks: { padding: 8, callback: value => `${value}%` }
                },
                x: {
                    grid: { display: false },
                    border: { color: cssVar('--grid') },
                    ticks: { autoSkip: false, maxRotation: 60, minRotation: 45, font: { size: 11 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...tooltipStyle(),
                    callbacks: {
                        title: items => overviewRows[items[0].dataIndex].name,
                        label: item => `${formatPercent(item.raw)} of target · ${statusOf(item.raw).label}`,
                        afterLabel: item => {
                            const loc = overviewRows[item.dataIndex];
                            return `${formatCurrency(loc.sales)} of ${formatCurrency(loc.target)}`;
                        }
                    }
                }
            }
        }
    });
}

// ─── Bonus-tier ring ─────────────────────────────────────────────────────────
// The ring is measured in clinics: one full turn = all clinics (never fewer
// than the top tier needs). Progress takes the current tier's metal color;
// gaps in the ring mark where each tier starts.

const tierLabelsPlugin = {
    id: 'tierLabels',
    afterDatasetsDraw(chart) {
        const arc = chart.getDatasetMeta(0).data[0];
        if (!arc || !tierView) return;
        const { ctx } = chart;
        const { x, y, outerRadius } = arc;

        ctx.save();
        // Threshold numbers just outside the ring
        ctx.font = `600 11px ${FONT}`;
        ctx.fillStyle = cssVar('--text-muted');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        TIERS.forEach(tier => {
            const angle = -Math.PI / 2 + (tier.min / tierView.ringMax) * 2 * Math.PI;
            const r = outerRadius + 11;
            ctx.fillText(String(tier.min), x + r * Math.cos(angle), y + r * Math.sin(angle));
        });

        // Center: "13 / 32" and the current tier
        const big = String(tierView.achieved);
        const small = ` / ${tierView.total}`;
        ctx.textBaseline = 'alphabetic';
        ctx.font = `600 40px ${FONT}`;
        const bigWidth = ctx.measureText(big).width;
        ctx.font = `500 16px ${FONT}`;
        const smallWidth = ctx.measureText(small).width;
        const startX = x - (bigWidth + smallWidth) / 2;

        ctx.textAlign = 'left';
        ctx.font = `600 40px ${FONT}`;
        ctx.fillStyle = cssVar('--text');
        ctx.fillText(big, startX, y + 8);
        ctx.font = `500 16px ${FONT}`;
        ctx.fillStyle = cssVar('--text-muted');
        ctx.fillText(small, startX + bigWidth, y + 8);

        const label = tierView.current ? tierView.current.name : 'No tier yet';
        ctx.font = `600 13px ${FONT}`;
        const labelWidth = ctx.measureText(label).width;
        const dot = tierView.current ? 12 : 0;
        const labelX = x - (labelWidth + dot) / 2;
        if (tierView.current) {
            ctx.fillStyle = cssVar(tierView.current.color);
            ctx.beginPath();
            ctx.arc(labelX + 4, y + 29, 4, 0, 2 * Math.PI);
            ctx.fill();
        }
        ctx.fillStyle = cssVar('--text-2');
        ctx.textBaseline = 'middle';
        ctx.fillText(label, labelX + dot, y + 30);
        ctx.restore();
    }
};

export function renderTierChart(summary) {
    const { achieved, total, tier } = summary;
    const ringMax = Math.max(total, TIERS[TIERS.length - 1].min);
    tierView = { achieved, total, ringMax, current: tier.current };

    const bounds = [0, ...TIERS.map(t => t.min), ringMax];
    const progressColor = cssVar(tier.current ? tier.current.color : '--tier-0');
    const track = cssVar('--track');

    const values = [];
    const colors = [];
    const labels = [];
    bounds.slice(0, -1).forEach((start, i) => {
        const size = bounds[i + 1] - start;
        const filled = Math.min(Math.max(achieved - start, 0), size);
        if (filled > 0) {
            values.push(filled);
            colors.push(progressColor);
            labels.push(`${achieved} of ${total} clinics at target`);
        }
        if (size - filled > 0) {
            values.push(size - filled);
            colors.push(track);
            labels.push(i === 0
                ? `${TIERS[0].name} starts at ${TIERS[0].min} clinics`
                : `${TIERS[i - 1].name}: ${tierRange(TIERS[i - 1])} clinics`);
        }
    });

    const data = {
        labels,
        datasets: [{ data: values, backgroundColor: colors, hoverBackgroundColor: colors, borderWidth: 0, spacing: 2 }]
    };

    if (tierChart) {
        tierChart.data = data;
        tierChart.update();
        return;
    }

    tierChart = new Chart(document.getElementById('tier-chart'), {
        type: 'doughnut',
        data,
        plugins: [tierLabelsPlugin],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '80%',
            layout: { padding: 16 },
            hoverOffset: 0,
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...tooltipStyle(),
                    callbacks: { title: () => '', label: item => item.label }
                }
            }
        }
    });
}

export function initCharts() {
    Chart.defaults.font.family = FONT;
    Chart.defaults.color = cssVar('--text-muted');
}

// Canvas text is drawn once; redraw when the web font finishes loading.
export function refreshCharts() {
    overviewChart?.update('none');
    tierChart?.update('none');
}
