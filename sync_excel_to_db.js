const https = require('https');
const xlsx = require('./node_modules/xlsx');
const fs = require('fs');

const API_KEY = "AIzaSyDkvik3tzscp8dBg7kxRoOzEW-Jl9Xz2w4";
const DB_URL = "https://collection-dash-default-rtdb.firebaseio.com";
const ADMIN_EMAIL = "admin@collectiondash.com";
const ADMIN_PASS = "Admin123";

async function post(url, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const req = https.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }
        }, res => {
            let resData = '';
            res.on('data', d => resData += d);
            res.on('end', () => resolve(JSON.parse(resData)));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            let resData = '';
            res.on('data', d => resData += d);
            res.on('end', () => resolve(JSON.parse(resData)));
        }).on('error', reject);
    });
}

async function patch(url, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const req = https.request(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }
        }, res => {
            let resData = '';
            res.on('data', d => resData += d);
            res.on('end', () => resolve(JSON.parse(resData)));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function normalize(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function sync() {
    console.log('--- SIGNING IN ---');
    const authUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`;
    const authRes = await post(authUrl, { email: ADMIN_EMAIL, password: ADMIN_PASS, returnSecureToken: true });
    
    if (authRes.error) {
        console.error('Auth Error:', authRes.error.message);
        return;
    }
    const token = authRes.idToken;
    console.log('Signed in successfully.');

    console.log('--- READING EXCEL ---');
    const wb = xlsx.readFile('C:/Users/Admin/Desktop/CR.xlsx');
    const ws = wb.Sheets['March'];
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

    console.log('--- FETCHING DB LOCATIONS ---');
    const dbData = await get(`${DB_URL}/.json?auth=${token}`);
    let locations = dbData.locations || [];
    if (!Array.isArray(locations)) locations = Object.values(locations);

    console.log(`Current locations in DB: ${locations.length}`);

    // Parsing Logic from app.js
    const parsedData = [];
    
    // Group 1
    const names1 = rows[1] || [];
    const targets1 = rows[2] || [];
    const fin1 = rows[16] || [];
    const dep1 = rows[17] || [];

    for (let i = 0; i < 16; i++) {
        const name = (names1[i] || '').toString().replace(/\*/g, '').trim();
        const target = Number(targets1[i]) || 0;
        if (!name || target <= 0) continue;
        parsedData.push({ name, target, finalize: Number(fin1[i]), deposit: Number(dep1[i]), sales: Number(fin1[i]) + Number(dep1[i]) });
    }

    // Group 2
    const names2 = rows[7] || [];
    const targets2 = rows[8] || [];
    const fin2 = rows[20] || [];
    const dep2 = rows[21] || [];

    for (let i = 0; i < 16; i++) {
        const name = (names2[i] || '').toString().replace(/\*/g, '').trim();
        const target = Number(targets2[i]) || 0;
        if (!name || target <= 0) continue;
        parsedData.push({ name, target, finalize: Number(fin2[i]), deposit: Number(dep2[i]), sales: Number(fin2[i]) + Number(dep2[i]) });
    }

    console.log(`Excel parsed locations: ${parsedData.length}`);

    // Update locations
    let updated = 0;
    let added = 0;
    
    parsedData.forEach(pData => {
        const normName = normalize(pData.name);
        const existing = locations.find(loc => normalize(loc.name) === normName);
        
        if (existing) {
            existing.target = pData.target;
            existing.finalize = pData.finalize;
            existing.deposit = pData.deposit;
            existing.sales = pData.sales;
            updated++;
        } else {
            locations.push({
                id: Math.random().toString(36).substr(2, 9),
                name: pData.name,
                target: pData.target,
                finalize: pData.finalize,
                deposit: pData.deposit,
                sales: pData.sales,
                group: 'Illinois',
                order: locations.length
            });
            added++;
        }
    });

    console.log(`Ready to save: ${updated} updated, ${added} added.`);

    console.log('--- SAVING TO DB ---');
    const updatePayload = {
        locations: locations,
        meta: { lastUpdated: Date.now() }
    };
    
    const saveRes = await patch(`${DB_URL}/.json?auth=${token}`, updatePayload);
    if (!saveRes.error) {
        console.log('✅ DATABASE SYNCED SUCCESSFULLY!');
        const dekalb = locations.find(l => normalize(l.name) === 'dekalb');
        if (dekalb) {
            console.log('DEKALB FINAL STATUS:', dekalb);
        }
    } else {
        console.error('Save Error:', saveRes.error);
    }
}

sync().catch(console.error);
