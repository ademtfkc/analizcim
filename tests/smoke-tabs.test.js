const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.BOOTSTRAP_ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || 'smoke_admin';
process.env.BOOTSTRAP_ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Smoke1234!';

function dbGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

async function waitForBootstrapAdmin(db, username, retries = 50) {
    for (let attempt = 0; attempt < retries; attempt += 1) {
        const user = await dbGet(db, 'SELECT id FROM users WHERE username = ? AND is_admin = 1 AND status = ?', [username, 'approved']).catch(() => null);
        if (user) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Bootstrap admin hazir degil: ${username}`);
}

test('6-tab API smoke test', async (t) => {
    const { startServer } = require('../src/server');
    const db = require('../src/database');
    let server;
    try {
        server = await new Promise((resolve, reject) => {
            const srv = startServer(0);
            srv.once('listening', () => resolve(srv));
            srv.once('error', reject);
        });
    } catch (error) {
        if (error && error.code === 'EPERM') {
            assert.ok(true, 'Socket listen izni yok (sandbox).');
            return;
        }
        throw error;
    }
    t.after(async () => {
        if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        await new Promise((resolve) => db.close(resolve));
        await new Promise((resolve) => setTimeout(resolve, 25));
    });

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    let sessionCookie = '';
    const username = process.env.SMOKE_USER || process.env.BOOTSTRAP_ADMIN_USERNAME;
    const password = process.env.SMOKE_PASS || process.env.BOOTSTRAP_ADMIN_PASSWORD;

    await waitForBootstrapAdmin(db, username);

    const request = async (path, options = {}) => {
        const headers = { Connection: 'close', ...(options.headers || {}) };
        if (sessionCookie) headers.Cookie = sessionCookie;
        const response = await fetch(baseUrl + path, { ...options, headers });
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            sessionCookie = setCookie.split(';')[0];
        }
        return response;
    };

    // Login
    const loginResponse = await request('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    assert.equal(loginResponse.status, 200, 'login should succeed');
    const loginBody = await loginResponse.json();
    assert.equal(loginBody.success, true);
    assert.ok(loginBody.user && loginBody.user.id, 'login should return user payload');

    // Analyze tab endpoint (invalid payload smoke)
    const analyzeResponse = await request('/api/analyze', { method: 'POST' });
    assert.equal(analyzeResponse.status, 400, 'analyze should validate missing files');

    // Dashboard tab
    const dashboardResponse = await request('/api/dashboard/latest');
    assert.equal(dashboardResponse.status, 200, 'dashboard should respond');

    // Expenses tab
    const expensesResponse = await request('/api/expenses-local/years');
    assert.equal(expensesResponse.status, 200, 'expenses-local years should respond');

    // Compare tab
    const year = new Date().getFullYear();
    const compareResponse = await request(`/api/compare?year1=${year}&year2=${year}`);
    assert.equal(compareResponse.status, 200, 'compare should respond');

    // Predictions tab
    const predictionsResponse = await request('/api/predictions');
    assert.equal(predictionsResponse.status, 200, 'predictions should respond');

    // History tab
    const historyResponse = await request('/api/history');
    assert.equal(historyResponse.status, 200, 'history should respond');
});
