// State
let locations = [];
let isReadOnly = true; // Default to true now
let currentDbRef = 'locations';
// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDkvik3tzscp8dBg7kxRoOzEW-Jl9Xz2w4",
    authDomain: "collection-dash.firebaseapp.com",
    databaseURL: "https://collection-dash-default-rtdb.firebaseio.com",
    projectId: "collection-dash",
    storageBucket: "collection-dash.firebasestorage.app",
    messagingSenderId: "458564338656",
    appId: "1:458564338656:web:9b0f98d2cf5d0054e86185"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

function isAdminMode() {
    return !!auth.currentUser;
}

let barChartInstance = null;
let doughnutChartInstance = null;

// Initial Data mapping from original image
const initialData = [
    { id: generateId(), name: "Algonquin", target: 148000, sales: 159174 },
    { id: generateId(), name: "Waukegan", target: 132000, sales: 108559.67 },
    { id: generateId(), name: "Dekalb", target: 72000, sales: 54633.43 },
    { id: generateId(), name: "Aurora", target: 112000, sales: 109915 },
    { id: generateId(), name: "Mundelein", target: 94000, sales: 88544 },
    { id: generateId(), name: "Harwood Heights", target: 164000, sales: 148208.57 },
    { id: generateId(), name: "Burbank", target: 280000, sales: 267212.44 },
    { id: generateId(), name: "Pilsen", target: 192000, sales: 163651 },
    { id: generateId(), name: "Homewood", target: 272000, sales: 242329.71 },
    { id: generateId(), name: "Bucktown", target: 108000, sales: 102985.10 },
    { id: generateId(), name: "Joliet", target: 146000, sales: 135666.02 },
    { id: generateId(), name: "Hillside", target: 104000, sales: 100415.00 },
    { id: generateId(), name: "Arlington Heights", target: 146000, sales: 134882.00 },
    { id: generateId(), name: "Rockford", target: 200000, sales: 175059.96 },
    { id: generateId(), name: "Skokie", target: 120000, sales: 116445.50 },
    { id: generateId(), name: "Avondale", target: 132000, sales: 141894.05 },

    // Bottom Row from image
    { id: generateId(), name: "Glendale Heights", target: 57600, sales: 49457 },
    { id: generateId(), name: "Kedzie", target: 162000, sales: 142987.23 },
    { id: generateId(), name: "Orland Park", target: 92000, sales: 84637.97 },
    { id: generateId(), name: "Willowbrook", target: 18500, sales: 13906.52 },
    { id: generateId(), name: "Lakeview", target: 20000, sales: 12979 },
    { id: generateId(), name: "Old Town", target: 20000, sales: 4111 },
    { id: generateId(), name: "West Loop", target: 20000, sales: 12458 },
    { id: generateId(), name: "Beloit", target: 160000, sales: 122328 },
    { id: generateId(), name: "Hales Corners", target: 220000, sales: 235124.52 },
    { id: generateId(), name: "Menomonee Falls", target: 280000, sales: 281325 },
    { id: generateId(), name: "Mount Pleasant", target: 108000, sales: 112876 },
    { id: generateId(), name: "Madison", target: 224000, sales: 181954 },
    { id: generateId(), name: "Merrillville", target: 240000, sales: 153377 },
    { id: generateId(), name: "Greenwood", target: 100000, sales: 65681 },
    { id: generateId(), name: "Lawrence", target: 96000, sales: 43328 },
    { id: generateId(), name: "Speedway", target: 100000, sales: 136471 }
];

// Utility functions
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function formatCurrency(num) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
}

function formatPercent(num) {
    return num.toFixed(2) + '%';
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Set Date
    const today = new Date();
    document.getElementById('current-date').textContent = today.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });

    // Initial Data mapping from original image
    checkAccessAndLoad();

    // Event Listeners
    setupEventListeners();
    setupHistoryListeners();

    // Listen for auth state changes
    auth.onAuthStateChanged((user) => {
        updateAuthUI(user);
        checkAccessAndLoad();
    });
});

function updateAuthUI(user) {
    const authElements = [
        { text: document.getElementById('auth-btn-text'), btn: document.getElementById('auth-btn'), icon: document.querySelector('#auth-btn i') },
        { text: document.getElementById('header-auth-btn-text'), btn: document.getElementById('header-auth-btn'), icon: document.querySelector('#header-auth-btn i') }
    ];

    authElements.forEach(el => {
        if (!el.btn || !el.text || !el.icon) return;
        
        if (user) {
            el.text.textContent = 'Logout';
            el.btn.title = 'Logout (' + user.email + ')';
            el.btn.classList.add('danger');
            el.icon.className = 'fa-solid fa-right-from-bracket';
        } else {
            el.text.textContent = 'Login';
            el.btn.title = 'Login';
            el.btn.classList.remove('danger');
            el.icon.className = 'fa-solid fa-right-to-bracket';
        }
    });
}

function checkAccessAndLoad() {
    // If we were in history mode, we stay in history mode unless user specifically exits
    if (currentDbRef === 'history' && isReadOnly) {
        return;
    }
    loadLiveReports();
}

function loadLiveReports() {
    const admin = isAdminMode();
    isReadOnly = !admin;
    currentDbRef = 'locations';

    const banner = document.getElementById('read-only-banner');
    banner.classList.add('hidden'); // Always hide banner in live view (Viewer or Admin)

    // Toggle visibility of admin-only buttons
    const adminButtons = [
        document.getElementById('add-location-btn'),
        document.getElementById('reset-data-btn'),
        document.getElementById('archive-report-btn'),
        document.getElementById('import-btn')
    ];

    adminButtons.forEach(btn => {
        if (btn) btn.style.display = admin ? '' : 'none';
    });

    database.ref().off(); // Clear previous listeners at root
    database.ref().on('value', handleRootSnapshot, error => {
        alert("Помилка читання даних з Firebase: " + error.message + "\nПеревірте правила (Rules), чи дозволено читання на рівні кореня бази.");
        console.error("Firebase read error:", error);
    });
}

function handleRootSnapshot(snapshot) {
    const data = snapshot.val() || {};
    const locationsData = data.locations;
    const metaData = data.meta || {};
    let latestUpdate = metaData.lastUpdated || 0;

    if (locationsData) {
        locations = Array.isArray(locationsData) ? locationsData : Object.values(locationsData);
        locations.forEach((loc, index) => {
            if (!loc.group) loc.group = 'Illinois';
            if (loc.order === undefined) loc.order = index;
        });
    } else {
        // Initial setup for empty DB if not read-only
        if (!isReadOnly && !locationsData) {
            locations = initialData.map((loc, index) => ({ ...loc, group: 'Illinois', order: index }));
            updateUI(); // Display the initial data visually immediately
            saveData(true); // Initial save with meta
            return; // Next real snapshot will update UI again
        } else {
            locations = [];
        }
    }

    // Set last edited display
    const lastEditEl = document.getElementById('last-edited');
    if (lastEditEl) {
        if (latestUpdate > 0) {
            const date = new Date(latestUpdate);
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
            lastEditEl.textContent = `Last updated: ${timeStr}`;
        } else {
            lastEditEl.textContent = `Last updated: --:--`;
        }
    }

    updateUI();
}

function saveData(updateTimestamp = false) {
    if (isReadOnly) return;

    const dataToSave = {
        locations: locations
    };

    if (updateTimestamp) {
        dataToSave.meta = {
            lastUpdated: Date.now()
        };
    }

    database.ref().update(dataToSave).catch(error => {
        alert("Помилка доступу Firebase: " + error.message + "\nМожливо, ваші правила Realtime Database блокують запис.");
        console.error("Firebase update error:", error);
    });
}

// Core Logic & UI Update
function updateUI() {
    renderCards();
    renderTable();
    updateCharts();
    initSortable();
}



function getStatusColor(pct) {
    if (pct >= 100) return 'var(--success)';
    if (pct >= 90) return 'var(--warning)';
    return 'var(--danger)';
}

function getStatusColorGlow(pct) {
    if (pct >= 100) return 'rgba(16, 185, 129, 0.3)';
    if (pct >= 90) return 'rgba(245, 158, 11, 0.3)';
    return 'rgba(239, 68, 68, 0.3)';
}

function renderCards() {
    const grids = {
        'Illinois': document.getElementById('grid-illinois'),
        'Wisconsin': document.getElementById('grid-wisconsin'),
        'Indiana': document.getElementById('grid-indiana')
    };

    Object.values(grids).forEach(grid => { if (grid) grid.innerHTML = ''; });

    const sortedLocations = [...locations].sort((a, b) => (a.order || 0) - (b.order || 0));

    sortedLocations.forEach(loc => {
        const pct = loc.target > 0 ? (loc.sales / loc.target) * 100 : 0;
        const remaining = Math.max(0, loc.target - loc.sales);
        const isSuccess = pct >= 100;

        const colorVar = getStatusColor(pct);
        const glowVar = getStatusColorGlow(pct);

        // Calculate SVG circle offset
        // r=26 for a 60x60 viewBox (with stroke width) -> circumference = 2 * PI * 26 = 163.36 (Wait, before I used 176? 2*3.14*26 = 163.28)
        // Let's use exactly 163 or 164 for stroke-dasharray
        // Oh wait, my CSS says 176. Let me recalculate. 2 * Math.PI * 26 = 163.36
        // Let me adjust the JS to calculate exactly.
        const r = 26;
        const circumference = 2 * Math.PI * r;
        const offset = circumference - (Math.min(pct, 100) / 100) * circumference;

        const finalize = loc.finalize !== undefined ? loc.finalize : loc.sales;
        const deposit = loc.deposit !== undefined ? loc.deposit : 0;

        let finalizedValStyle = '';
        if (isSuccess && finalize < loc.target) {
            finalizedValStyle = 'color: var(--danger);';
        }

        const card = document.createElement('div');
        card.className = 'location-card glass-panel';
        card.dataset.id = loc.id;
        if (isSuccess) {
            card.style.borderColor = glowVar; // use the less bright glow variable
            card.style.boxShadow = `0 0 10px rgba(16, 185, 129, 0.15)`; // subtle shadow
            card.style.background = 'rgba(16, 185, 129, 0.02)'; // very light background tint
        }

        card.innerHTML = `
            <div class="loc-header">
                <h3 title="${loc.name}">${loc.name}</h3>
                <div class="loc-actions" style="${isReadOnly ? 'display: none;' : ''}">
                    <button class="edit-btn" onclick="openEditModal('${loc.id}')" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="delete-btn" onclick="deleteLocation('${loc.id}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="loc-stats">
                <div class="loc-stat-item">
                    <span class="label">Target</span>
                    <span class="val">${formatCurrency(loc.target)}</span>
                </div>
                <div class="loc-stat-item">
                    <span class="label">Collection</span>
                    <span class="val">${formatCurrency(loc.sales)}</span>
                </div>
            </div>
            <div class="loc-progress">
                <div class="circle-wrap">
                    <div class="inside-circle" style="color: ${colorVar}">${formatPercent(pct)}</div>
                    <svg viewBox="0 0 64 64">
                        <circle class="bg-circle" cx="32" cy="32" r="26"></circle>
                        <circle class="progress-circle" cx="32" cy="32" r="26" 
                                style="stroke: ${colorVar}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset}; filter: drop-shadow(0 0 4px ${colorVar});"></circle>
                    </svg>
                </div>
                <div class="loc-status">
                    ${isSuccess
                ? `<p style="color: var(--success)">Target Achieved! <span class="highlight"><br>+${formatCurrency(loc.sales - loc.target)}</span> beyond target.</p>`
                : `<p>Needs <span class="highlight">${formatCurrency(remaining)}</span> to reach the goal.</p>`
            }
                </div>
            </div>
            <div class="loc-card-footer">
                <div class="footer-stat-group">
                    <span class="footer-label">Finalized ($)</span>
                    <span class="footer-val" style="${finalizedValStyle}">${formatCurrency(finalize)}</span>
                </div>
                <div class="footer-stat-group">
                    <span class="footer-label">Deposit Slip ($)</span>
                    <span class="footer-val">${formatCurrency(deposit)}</span>
                </div>
            </div>
        `;

        const targetGrid = grids[loc.group] || grids['Illinois'];
        if (targetGrid) {
            targetGrid.appendChild(card);
        }
    });
}

function renderTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    // Hide or show the action header
    const actionHeader = document.querySelector('#data-table th:last-child');
    if (actionHeader) actionHeader.style.display = isReadOnly ? 'none' : '';

    locations.forEach(loc => {
        const pct = loc.target > 0 ? (loc.sales / loc.target) * 100 : 0;
        const remaining = Math.max(0, loc.target - loc.sales);
        const isSuccess = pct >= 100;

        let badgeClass = 'badge-danger';
        if (pct >= 100) badgeClass = 'badge-success';
        else if (pct >= 90) badgeClass = 'badge-warning';

        const tr = document.createElement('tr');
        if (isSuccess) {
            tr.style.background = 'rgba(16, 185, 129, 0.05)';
        }

        tr.innerHTML = `
            <td><strong>${loc.name}</strong></td>
            <td>${formatCurrency(loc.target)}</td>
            <td>${formatCurrency(loc.sales)}</td>
            <td><span class="pct-badge ${badgeClass}">${formatPercent(pct)}</span></td>
            <td>${formatCurrency(remaining)}</td>
            <td style="text-align: right; display: ${isReadOnly ? 'none' : ''};">
                <button onclick="openEditModal('${loc.id}')" style="background:none; border:none; color: var(--accent-primary); cursor:pointer; margin-right: 15px; font-size: 1.1rem; transition: color 0.2s;"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteLocation('${loc.id}')" style="background:none; border:none; color: var(--danger); cursor:pointer; font-size: 1.1rem; transition: color 0.2s;"><i class="fa-solid fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Charts
Chart.register(ChartDataLabels);

function updateCharts() {
    const achieved = locations.filter(l => l.target > 0 && (l.sales / l.target) * 100 >= 100).length;
    const partial = locations.filter(l => l.target > 0 && (l.sales / l.target) * 100 >= 90 && (l.sales / l.target) * 100 < 100).length;
    const orange = locations.filter(l => l.target > 0 && (l.sales / l.target) * 100 >= 80 && (l.sales / l.target) * 100 < 90).length;
    const behind = locations.filter(l => l.target > 0 && (l.sales / l.target) * 100 < 80).length;

    // Update Header Counts
    document.getElementById('count-achieved').textContent = achieved;
    document.getElementById('count-close').textContent = partial;
    document.getElementById('count-orange').textContent = orange;
    document.getElementById('count-behind').textContent = behind;

    // Common Chart Config
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = "'Outfit', sans-serif";

    // Overview Chart (Bar)
    const overviewCtx = document.getElementById('overviewChart').getContext('2d');

    if (barChartInstance) barChartInstance.destroy();

    const groupOrder = { 'Illinois': 1, 'Wisconsin': 2, 'Indiana': 3 };
    const sortedLocations = [...locations].sort((a, b) => {
        const groupDiff = (groupOrder[a.group] || 99) - (groupOrder[b.group] || 99);
        if (groupDiff !== 0) return groupDiff;
        return (a.order || 0) - (b.order || 0);
    });
    const labels = sortedLocations.map(l => l.name);
    const data = sortedLocations.map(l => l.target > 0 ? (l.sales / l.target) * 100 : 0);

    const bgColors = data.map(pct => {
        if (pct >= 100) return 'rgba(16, 185, 129, 0.6)';
        if (pct >= 90) return 'rgba(245, 158, 11, 0.6)';
        if (pct >= 80) return 'rgba(249, 115, 22, 0.6)';
        return 'rgba(239, 68, 68, 0.6)';
    });

    const borderColors = data.map(pct => {
        if (pct >= 100) return 'rgba(16, 185, 129, 1)';
        if (pct >= 90) return 'rgba(245, 158, 11, 1)';
        if (pct >= 80) return 'rgba(249, 115, 22, 1)';
        return 'rgba(239, 68, 68, 1)';
    });

    barChartInstance = new Chart(overviewCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '% Achieved',
                data: data,
                backgroundColor: bgColors,
                borderColor: borderColors,
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { callback: function (value) { return value + '%'; } }
                },
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 45, minRotation: 45 }
                }
            },
            plugins: {
                datalabels: {
                    display: false // Hide datalabels for the bar chart to prevent clutter
                },
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 14, family: "'Outfit', sans-serif" },
                    bodyFont: { size: 13, family: "'Outfit', sans-serif" },
                    padding: 12,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            return ' ' + context.raw.toFixed(1) + '% Achieved';
                        }
                    }
                }
            }
        }
    });

    // Tier Progress Chart (Doughnut as Progress Bar)
    const tierCtx = document.getElementById('tierChart').getContext('2d');

    if (window.tierChartInstance) window.tierChartInstance.destroy();

    const totalLocs = locations.length;
    const pctAchieved = totalLocs > 0 ? (achieved / totalLocs) * 100 : 0;
    const pctRemaining = Math.max(0, 100 - pctAchieved);

    // Determine current Tier color
    let activeColor = '#94a3b8'; // default gray
    let activeBorder = 'rgba(148, 163, 184, 0.5)';
    let currentTierText = 'No Tier';

    if (pctAchieved >= 71) {
        activeColor = '#eab308'; // Tier 3 Yellow
        activeBorder = 'rgba(234, 179, 8, 0.5)';
        currentTierText = 'Tier 3 Achieved';
    } else if (pctAchieved >= 46) {
        activeColor = '#ec4899'; // Tier 2 Pink
        activeBorder = 'rgba(236, 72, 153, 0.5)';
        currentTierText = 'Tier 2 Achieved';
    } else if (pctAchieved >= 38) {
        activeColor = '#8b5cf6'; // Tier 1 Purple
        activeBorder = 'rgba(139, 92, 246, 0.5)';
        currentTierText = 'Tier 1 Achieved';
    } else {
        activeColor = '#3b82f6'; // Pre-Tier Blue
        activeBorder = 'rgba(59, 130, 246, 0.5)';
        currentTierText = 'Progress...';
    }

    const grayColor = 'rgba(255, 255, 255, 0.05)';
    const grayBorder = 'rgba(255, 255, 255, 0.1)';

    const tierColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#eab308']; // Blue, Purple, Pink, Yellow

    // Buckets defining the Tiers and their start/end milestones
    const buckets = [
        { start: 0, end: 38, fill: tierColors[0] },  // Pre-Tier (0-37)
        { start: 38, end: 46, fill: tierColors[1] }, // Tier 1 (38-45)
        { start: 46, end: 71, fill: tierColors[2] }, // Tier 2 (46-70)
        { start: 71, end: 100, fill: tierColors[3] } // Tier 3 (71-100)
    ];

    const chartData = [];
    const chartBgColors = [];

    buckets.forEach(b => {
        let size = b.end - b.start;
        if (pctAchieved >= b.end) {
            chartData.push(size);
            chartBgColors.push(b.fill);
        } else if (pctAchieved > b.start) {
            let filled = pctAchieved - b.start;
            let unfilled = b.end - pctAchieved;
            chartData.push(filled);
            chartBgColors.push(b.fill);
            chartData.push(unfilled);
            chartBgColors.push(grayColor);
        } else {
            chartData.push(size);
            chartBgColors.push(grayColor);
        }
    });

    window.tierChartInstance = new Chart(tierCtx, {
        type: 'doughnut',
        data: {
            labels: chartData.map((_, i) => chartBgColors[i] === grayColor ? 'Remaining' : 'Achieved'),
            datasets: [{
                data: chartData,
                backgroundColor: chartBgColors,
                borderColor: 'transparent',
                borderWidth: 0,
                hoverOffset: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            rotation: 0, // Start from top 
            circumference: 360,
            plugins: {
                datalabels: { display: false },
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { size: 14, family: "'Outfit', sans-serif" },
                    bodyFont: { size: 13, family: "'Outfit', sans-serif" },
                    padding: 12,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            if (context.chart.data.labels[context.dataIndex] === 'Remaining') {
                                return ' Remaining: ' + (100 - pctAchieved).toFixed(1) + '%';
                            }
                            return ' Achieved: ' + pctAchieved.toFixed(1) + '%';
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerTextAndTicks',
            beforeDraw: function (chart) {
                // Draw center text behind everything
                const width = chart.width;
                const height = chart.height;
                const ctx = chart.ctx;
                ctx.restore();

                const pctText = pctAchieved.toFixed(1) + '%';
                ctx.font = "bold 1.8rem 'Outfit', sans-serif";
                ctx.textBaseline = "middle";
                ctx.textAlign = "center";
                ctx.fillStyle = "#ffffff";
                const textX = Math.round(width / 2);
                const textY = Math.round(height / 2) - 10;
                ctx.fillText(pctText, textX, textY);

                ctx.font = "500 0.85rem 'Outfit', sans-serif";
                ctx.fillStyle = activeColor;
                ctx.fillText(currentTierText, textX, textY + 25);
                ctx.save();
            },
            afterDatasetsDraw: function (chart) {
                // Draw ticks on top of datasets
                const ctx = chart.ctx;
                ctx.restore();

                const meta = chart.getDatasetMeta(0);
                if (meta.data && meta.data.length > 0) {
                    const arc = meta.data[0];
                    const centerX = arc.x;
                    const centerY = arc.y;
                    const innerR = arc.innerRadius;
                    const outerR = arc.outerRadius;

                    [38, 46, 71].forEach(pct => {
                        const angle = -Math.PI / 2 + (pct / 100) * 2 * Math.PI;
                        const startX = centerX + (innerR - 2) * Math.cos(angle);
                        const startY = centerY + (innerR - 2) * Math.sin(angle);
                        const endX = centerX + (outerR + 2) * Math.cos(angle);
                        const endY = centerY + (outerR + 2) * Math.sin(angle);

                        // Draw dark gap
                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        ctx.lineTo(endX, endY);
                        ctx.strokeStyle = '#0f172a';
                        ctx.lineWidth = 4;
                        ctx.stroke();

                        // Draw white tick line
                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        ctx.lineTo(endX, endY);
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                        ctx.lineWidth = 2;
                        ctx.stroke();
                    });
                }
                ctx.save();
            }
        }]
    });

    if (doughnutChartInstance) {
        doughnutChartInstance.destroy();
        doughnutChartInstance = null;
    }
}

// Modal & Forms
const modal = document.getElementById('location-modal');
const closeBtn = document.querySelector('.close-btn');
const form = document.getElementById('location-form');

function setupEventListeners() {
    document.getElementById('add-location-btn').addEventListener('click', () => {
        document.getElementById('modal-title').textContent = 'Add Location';
        form.reset();
        document.getElementById('location-id').value = '';
        document.getElementById('loc-target').value = '';
        document.getElementById('loc-group').value = 'Illinois';
        modal.classList.add('show');
        setTimeout(() => document.getElementById('loc-name').focus(), 100);
    });

    // Auth Event Listeners
    const authBtn = document.getElementById('auth-btn');
    const headerAuthBtn = document.getElementById('header-auth-btn');
    const loginModal = document.getElementById('login-modal');
    const loginForm = document.getElementById('login-form');
    const loginCloseBtn = document.querySelector('.login-close-btn');
    const loginError = document.getElementById('login-error');

    const handleAuthAction = () => {
        if (auth.currentUser) {
            auth.signOut().catch(err => alert("Помилка виходу: " + err.message));
        } else {
            loginModal.classList.add('show');
            setTimeout(() => document.getElementById('login-email').focus(), 100);
        }
    };

    authBtn.addEventListener('click', handleAuthAction);
    if (headerAuthBtn) headerAuthBtn.addEventListener('click', handleAuthAction);

    loginCloseBtn.addEventListener('click', () => {
        loginModal.classList.remove('show');
        loginError.classList.add('hidden');
        loginForm.reset();
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        loginError.classList.add('hidden');

        auth.signInWithEmailAndPassword(email, password)
            .then(() => {
                loginModal.classList.remove('show');
                loginForm.reset();
            })
            .catch((error) => {
                loginError.textContent = error.message;
                loginError.classList.remove('hidden');
            });
    });

    const depositInput = document.getElementById('loc-deposit');
    const finalizeInput = document.getElementById('loc-finalize');
    const salesInput = document.getElementById('loc-sales');

    function calculateSales() {
        const dep = parseFloat(depositInput.value) || 0;
        const fin = parseFloat(finalizeInput.value) || 0;
        salesInput.value = (dep + fin).toFixed(2);
    }

    depositInput.addEventListener('input', calculateSales);
    finalizeInput.addEventListener('input', calculateSales);

    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });

    // Removed window click listener to prevent closing modal when clicking outside

    const sidebar = document.getElementById('sidebar');
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        // Give chart a moment to realize container size changed
        setTimeout(() => {
            if (barChartInstance) barChartInstance.resize();
            if (doughnutChartInstance) doughnutChartInstance.resize();
        }, 300);
    });

    document.getElementById('reset-data-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all amounts? Targets and locations will be kept. This cannot be undone.')) {
            locations.forEach(loc => {
                loc.sales = 0;
                loc.deposit = 0;
                loc.finalize = 0;
            });
            saveData(true);
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const id = document.getElementById('location-id').value;
        const name = document.getElementById('loc-name').value;
        const group = document.getElementById('loc-group').value;
        const deposit = parseFloat(document.getElementById('loc-deposit').value) || 0;
        const finalize = parseFloat(document.getElementById('loc-finalize').value) || 0;
        const target = parseFloat(document.getElementById('loc-target').value);
        const sales = deposit + finalize;

        if (id) {
            // Edit
            const index = locations.findIndex(l => l.id === id);
            if (index !== -1) {
                const order = locations[index].order;
                locations[index] = { id, name, target, sales, deposit, finalize, group, order };
            }
        } else {
            // Add
            const order = locations.length;
            locations.push({ id: generateId(), name, target, sales, deposit, finalize, group, order });
        }

        saveData(true); // Update timestamp on manual save
        form.reset();
        modal.classList.remove('show');
    });

    initSortable();
    setupImportListeners();
}

let sortableInstances = [];

function initSortable() {
    // Destroy old instances if they exist
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];

    const groups = ['Illinois', 'Wisconsin', 'Indiana'];
    groups.forEach(groupName => {
        const el = document.getElementById(`grid-${groupName.toLowerCase()}`);
        if (el) {
            const instance = new Sortable(el, {
                group: 'shared', // set both lists to same group
                animation: 150,
                disabled: isReadOnly,
                ghostClass: 'sortable-ghost',
                onEnd: function (evt) {
                    if (isReadOnly) return;
                    // Update all locations' order and groups based on current DOM
                    groups.forEach(gName => {
                        const gridEl = document.getElementById(`grid-${gName.toLowerCase()}`);
                        if (gridEl) {
                            const cards = gridEl.querySelectorAll('.location-card');
                            cards.forEach((card, index) => {
                                const locId = card.dataset.id;
                                const loc = locations.find(l => l.id === locId);
                                if (loc) {
                                    loc.group = gName;
                                    loc.order = index;
                                }
                            });
                        }
                    });
                    saveData();
                }
            });
            sortableInstances.push(instance);
        }
    });
}

// History & Archiving Logic
const historyModal = document.getElementById('history-modal');
const historyCloseBtn = document.querySelector('.history-close-btn');

function setupHistoryListeners() {
    document.getElementById('archive-report-btn').addEventListener('click', () => {
        if (isReadOnly) {
            alert("You cannot archive a historical report.");
            return;
        }
        if (confirm("Archive the current report to history?")) {
            const timestamp = Date.now();
            const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

            database.ref('history').push({
                timestamp: timestamp,
                title: `Report - ${dateStr}`,
                locations: locations
            }).then(() => {
                alert("Report archived successfully!");
            });
        }
    });

    document.getElementById('history-btn').addEventListener('click', () => {
        historyModal.classList.add('show');
        loadHistoryList();
    });

    historyCloseBtn.addEventListener('click', () => {
        historyModal.classList.remove('show');
    });

    document.getElementById('exit-history-btn').addEventListener('click', () => {
        database.ref(currentDbRef).off('value', handleRootSnapshot); // stop listening to old history ref
        loadLiveReports();
    });
}

function loadHistoryList() {
    const listEl = document.getElementById('history-list');
    listEl.innerHTML = '<li style="text-align: center; color: var(--text-muted); padding: 2rem;">Loading history...</li>';

    database.ref('history').orderByChild('timestamp').once('value', snapshot => {
        listEl.innerHTML = '';
        const data = snapshot.val();

        if (!data) {
            listEl.innerHTML = '<li style="text-align: center; color: var(--text-muted); padding: 2rem;">No archived reports found.</li>';
            document.getElementById('history-count').textContent = '(0)';
            return;
        }

        const reports = Object.entries(data).reverse(); // newest first
        document.getElementById('history-count').textContent = `(${reports.length})`;

        reports.forEach(([key, report]) => {
            const li = document.createElement('li');
            li.className = 'history-item';

            const date = new Date(report.timestamp).toLocaleString('en-US', {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            li.innerHTML = `
                <div class="history-item-info">
                    <div class="history-item-title">${report.title}</div>
                    <div class="history-item-date">${date}</div>
                </div>
                <div class="history-item-actions">
                    <button class="btn-icon rename-history-btn" title="Rename" onclick="renameHistoricalReport('${key}', '${report.title.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-icon delete-history-btn" title="Delete" onclick="deleteHistoricalReport('${key}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    <button class="btn btn-primary btn-view-history" onclick="viewHistoricalReport('${key}', '${report.title.replace(/'/g, "\\'")}')">View</button>
                </div>
            `;
            listEl.appendChild(li);
        });
    });
}

window.viewHistoricalReport = function (historyKey, title) {
    historyModal.classList.remove('show');

    // Disconnect from live locations
    database.ref().off('value', handleRootSnapshot);

    // Set read-only state
    isReadOnly = true;
    currentDbRef = `history/${historyKey}`;

    // Update Banner
    document.getElementById('viewing-report-date').textContent = title;
    document.getElementById('read-only-banner').classList.remove('hidden');

    // Hide edit controls but keep auth buttons
    document.querySelectorAll('.btn:not(#exit-history-btn):not(#archive-report-btn):not(#history-btn):not(#auth-btn):not(#header-auth-btn)').forEach(btn => btn.style.display = 'none');
    document.getElementById('add-location-btn').style.display = 'none';
    document.getElementById('reset-data-btn').style.display = 'none';

    // Fetch and listen to historical data
    database.ref(currentDbRef).on('value', handleRootSnapshot);

    // Re-init sortable to disable dragging
    setTimeout(initSortable, 100);
}

window.renameHistoricalReport = function (key, currentTitle) {
    const newTitle = prompt("Enter new title for this report:", currentTitle);
    if (newTitle && newTitle !== currentTitle) {
        database.ref(`history/${key}`).update({ title: newTitle })
            .then(() => loadHistoryList());
    }
}

window.deleteHistoricalReport = function (key) {
    if (confirm("Are you sure you want to delete this archived report? This action cannot be undone.")) {
        database.ref(`history/${key}`).remove()
            .then(() => loadHistoryList());
    }
}

window.openEditModal = function (id) {
    if (isReadOnly) return;
    const loc = locations.find(l => l.id === id);
    if (loc) {
        document.getElementById('modal-title').textContent = 'Edit Location';
        document.getElementById('location-id').value = loc.id;
        document.getElementById('loc-name').value = loc.name;
        document.getElementById('loc-group').value = loc.group || 'Illinois';

        const deposit = loc.deposit !== undefined ? loc.deposit : 0;
        const finalize = loc.finalize !== undefined ? loc.finalize : loc.sales;

        document.getElementById('loc-deposit').value = deposit.toFixed(2);
        document.getElementById('loc-finalize').value = finalize.toFixed(2);
        document.getElementById('loc-target').value = loc.target.toFixed(2);
        document.getElementById('loc-sales').value = loc.sales.toFixed(2);
        modal.classList.add('show');
        setTimeout(() => document.getElementById('loc-name').focus(), 100);
    }
}

window.deleteLocation = function (id) {
    if (isReadOnly) return;
    if (confirm('Are you sure you want to remove this location?')) {
        locations = locations.filter(l => l.id !== id);
        saveData();
    }
}

// ─── Excel Import Feature ───────────────────────────────────────────────────

let importWorkbook = null;

function setupImportListeners() {
    const importModal = document.getElementById('import-modal');
    const importCloseBtn = document.querySelector('.import-close-btn');
    const fileInput = document.getElementById('excel-file-input');
    const dropZone = document.getElementById('import-drop-zone');
    const sheetSelect = document.getElementById('import-sheet-select');
    const backBtn = document.getElementById('import-back-btn');
    const confirmBtn = document.getElementById('import-confirm-btn');

    document.getElementById('import-btn').addEventListener('click', () => {
        if (isReadOnly) return;
        importWorkbook = null;
        resetImportModal();
        importModal.classList.add('show');
    });

    importCloseBtn.addEventListener('click', () => {
        importModal.classList.remove('show');
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) processImportFile(file);
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) processImportFile(file);
    });

    // Sheet selection change
    sheetSelect.addEventListener('change', () => {
        renderImportPreview(sheetSelect.value);
    });

    // Back button
    backBtn.addEventListener('click', () => {
        resetImportModal();
    });

    // Confirm import
    confirmBtn.addEventListener('click', () => {
        performImport(sheetSelect.value);
        document.getElementById('import-modal').classList.remove('show');
    });
}

function resetImportModal() {
    document.getElementById('import-step-1').style.display = '';
    document.getElementById('import-step-2').style.display = 'none';
    const fi = document.getElementById('excel-file-input');
    if (fi) fi.value = '';
    importWorkbook = null;
}

function processImportFile(file) {
    if (!file.name.match(/\.xlsx?$/i)) {
        alert('Please select a valid Excel file (.xlsx or .xls)');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            importWorkbook = XLSX.read(data, { type: 'array' });

            // Filter to sheets that have actual data (row 3 has non-zero targets)
            const validSheets = importWorkbook.SheetNames.filter(name => {
                const ws = importWorkbook.Sheets[name];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                return rows[2] && rows[2].some(v => typeof v === 'number' && v > 0);
            });

            if (validSheets.length === 0) {
                alert('No valid data sheets found in this file.');
                return;
            }

            const sheetSelect = document.getElementById('import-sheet-select');
            sheetSelect.innerHTML = '';
            validSheets.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                sheetSelect.appendChild(opt);
            });

            // Auto-select last sheet with data (most recent month)
            sheetSelect.value = validSheets[validSheets.length - 1];

            document.getElementById('import-step-1').style.display = 'none';
            document.getElementById('import-step-2').style.display = '';
            renderImportPreview(sheetSelect.value);
        } catch (err) {
            alert('Failed to read Excel file: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

function parseImportSheet(sheetName) {
    const ws = importWorkbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const result = [];

    // Group 1 — rows indices 1(names), 2(targets), 16(finalized), 17(deposit)
    const names1 = rows[1] || [];
    const targets1 = rows[2] || [];
    const fin1 = rows[16] || [];
    const dep1 = rows[17] || [];

    for (let i = 0; i < 16; i++) {
        const name = (names1[i] || '').toString().replace(/\*/g, '').trim();
        const target = Number(targets1[i]) || 0;
        if (!name || target <= 0) continue;
        const finalize = Number(fin1[i]) || 0;
        const deposit = Number(dep1[i]) || 0;
        result.push({ name, target, finalize, deposit, sales: finalize + deposit });
    }

    // Group 2 — rows indices 7(names), 8(targets), 20(finalized), 21(deposit)
    const names2 = rows[7] || [];
    const targets2 = rows[8] || [];
    const fin2 = rows[20] || [];
    const dep2 = rows[21] || [];

    for (let i = 0; i < 16; i++) {
        const name = (names2[i] || '').toString().replace(/\*/g, '').trim();
        const target = Number(targets2[i]) || 0;
        if (!name || target <= 0) continue;
        const finalize = Number(fin2[i]) || 0;
        const deposit = Number(dep2[i]) || 0;
        result.push({ name, target, finalize, deposit, sales: finalize + deposit });
    }

    return result;
}

function normalizeLocName(s) {
    return (s || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

function findExistingLocation(importName) {
    const norm = normalizeLocName(importName);
    if (!norm) return null;

    // 1. Exact normalized match
    let match = locations.find(loc => normalizeLocName(loc.name) === norm);
    if (match) return match;

    // 2. Direct hardcoded mapping for known common variations
    const mappings = {
        'dekal': 'dekalb',
        'dekalb': 'dekalb'
    };
    if (mappings[norm]) {
        const mappedName = mappings[norm];
        match = locations.find(loc => normalizeLocName(loc.name) === mappedName);
        if (match) return match;
    }

    // 3. Prefix/Inclusion match (e.g. "Dekal" in "Dekalb")
    match = locations.find(loc => {
        const dbNorm = normalizeLocName(loc.name);
        return (dbNorm.length > 3 && (dbNorm.startsWith(norm) || norm.startsWith(dbNorm)));
    });

    return match;
}

function renderImportPreview(sheetName) {
    const data = parseImportSheet(sheetName);
    const previewEl = document.getElementById('import-preview');

    if (data.length === 0) {
        previewEl.innerHTML = '<p style="color: var(--text-muted); text-align:center; padding:2rem;">No data found in this sheet.</p>';
        return;
    }

    const matched = data.filter(d => findExistingLocation(d.name)).length;
    const newCount = data.length - matched;

    let html = `
        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.75rem; display:flex; gap:1.5rem;">
            <span>Found <strong style="color:var(--text-primary)">${data.length}</strong> locations</span>
            <span style="color:var(--success);"><i class="fa-solid fa-check"></i> ${matched} will be updated</span>
            ${newCount > 0 ? `<span style="color:var(--accent-primary);"><i class="fa-solid fa-plus"></i> ${newCount} will be added</span>` : ''}
        </div>
        <div style="max-height:320px; overflow-y:auto; border-radius:8px; border:1px solid rgba(255,255,255,0.08);">
        <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">
            <thead>
                <tr style="background:rgba(255,255,255,0.06); position:sticky; top:0;">
                    <th style="padding:9px 12px; text-align:left; color:var(--text-muted); font-weight:500;">Location</th>
                    <th style="padding:9px 12px; text-align:right; color:var(--text-muted); font-weight:500;">Target</th>
                    <th style="padding:9px 12px; text-align:right; color:var(--text-muted); font-weight:500;">Finalized</th>
                    <th style="padding:9px 12px; text-align:right; color:var(--text-muted); font-weight:500;">Deposit</th>
                    <th style="padding:9px 12px; text-align:right; color:var(--text-muted); font-weight:500;">Collection</th>
                    <th style="padding:9px 12px; text-align:center; color:var(--text-muted); font-weight:500;">Status</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.forEach((loc, idx) => {
        const match = findExistingLocation(loc.name);
        const statusBadge = match
            ? `<span style="color:var(--success); font-size:0.78rem; white-space:nowrap;"><i class="fa-solid fa-arrows-rotate"></i> Update</span>`
            : `<span style="color:var(--accent-primary); font-size:0.78rem; white-space:nowrap;"><i class="fa-solid fa-plus"></i> New</span>`;
        const rowBg = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
        const pct = loc.target > 0 ? (loc.sales / loc.target * 100) : 0;
        const pctColor = pct >= 100 ? 'var(--success)' : pct >= 90 ? 'var(--warning)' : 'var(--danger)';

        html += `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04); background:${rowBg};">
                <td style="padding:8px 12px; font-weight:500;">${loc.name}</td>
                <td style="padding:8px 12px; text-align:right;">${formatCurrency(loc.target)}</td>
                <td style="padding:8px 12px; text-align:right;">${formatCurrency(loc.finalize)}</td>
                <td style="padding:8px 12px; text-align:right;">${formatCurrency(loc.deposit)}</td>
                <td style="padding:8px 12px; text-align:right; color:${pctColor};">${formatCurrency(loc.sales)}</td>
                <td style="padding:8px 12px; text-align:center;">${statusBadge}</td>
            </tr>
        `;
    });

    html += '</tbody></table></div>';
    previewEl.innerHTML = html;
}

function performImport(sheetName) {
    const importData = parseImportSheet(sheetName);
    let updatedCount = 0;
    let addedCount = 0;

    console.log(`Starting import for sheet: ${sheetName}. Items: ${importData.length}`);

    importData.forEach(importLoc => {
        const existing = findExistingLocation(importLoc.name);
        if (existing) {
            console.log(`Matching: "${importLoc.name}" -> "${existing.name}"`);
            existing.target = importLoc.target;
            existing.finalize = importLoc.finalize;
            existing.deposit = importLoc.deposit;
            existing.sales = importLoc.sales;
            updatedCount++;
        } else {
            console.log(`No match for: "${importLoc.name}". Adding as new.`);
            locations.push({
                id: generateId(),
                name: importLoc.name,
                target: importLoc.target,
                finalize: importLoc.finalize,
                deposit: importLoc.deposit,
                sales: importLoc.sales,
                group: 'Illinois',
                order: locations.length
            });
            addedCount++;
        }
    });

    saveData(true);
    updateUI();
    
    const msg = `✅ Import complete!\n\n• ${updatedCount} location(s) updated\n• ${addedCount} new location(s) added\n\nCheck console (F12) for detailed mapping logs.`;
    alert(msg);
}
