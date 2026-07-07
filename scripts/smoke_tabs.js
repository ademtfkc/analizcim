const defaultSmokeUser = process.env.SMOKE_USER || 'smoke_admin';
const defaultSmokePass = process.env.SMOKE_PASS || 'Smoke1234!';

process.env.BOOTSTRAP_ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || defaultSmokeUser;
process.env.BOOTSTRAP_ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || defaultSmokePass;

const { startServer } = require('../src/server');
const db = require('../src/database');

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

async function waitForBootstrapAdmin(username, retries = 50) {
    for (let attempt = 0; attempt < retries; attempt += 1) {
        const user = await dbGet('SELECT id FROM users WHERE username = ? AND is_admin = 1 AND status = ?', [username, 'approved']).catch(() => null);
        if (user) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Bootstrap admin hazir degil: ${username}`);
}

async function run() {
    const username = process.env.SMOKE_USER || process.env.BOOTSTRAP_ADMIN_USERNAME;
    const password = process.env.SMOKE_PASS || process.env.BOOTSTRAP_ADMIN_PASSWORD;

    let server;
    try {
        server = await new Promise((resolve, reject) => {
            const srv = startServer(0);
            srv.once('listening', () => resolve(srv));
            srv.once('error', reject);
        });
    } catch (error) {
        if (error && error.code === 'EPERM') {
            console.log('SKIP Smoke test: socket listen izni yok (sandbox).');
            return;
        }
        throw error;
    }
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    let sessionCookie = '';

    await waitForBootstrapAdmin(username);

    const request = async (path, options = {}) => {
        const headers = { ...(options.headers || {}) };
        if (sessionCookie) headers.Cookie = sessionCookie;
        const response = await fetch(baseUrl + path, { ...options, headers });
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) sessionCookie = setCookie.split(';')[0];
        return response;
    };

    const checks = [];
    const pushResult = (name, ok, detail = '') => {
        checks.push({ name, ok, detail });
        const icon = ok ? 'OK ' : 'FAIL ';
        console.log(`${icon} ${name}${detail ? ` -> ${detail}` : ''}`);
    };

    try {
        const loginResponse = await request('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const loginBody = await loginResponse.json().catch(() => ({}));
        pushResult('Auth/Login', loginResponse.status === 200 && !!loginBody?.user, `HTTP ${loginResponse.status}`);

        const analyze = await request('/api/analyze', { method: 'POST' });
        pushResult('Analiz endpoint', analyze.status === 400, `HTTP ${analyze.status}`);

        const dashboard = await request('/api/dashboard/latest');
        pushResult('Dashboard endpoint', dashboard.status === 200, `HTTP ${dashboard.status}`);

        const expenses = await request('/api/expenses-local/years');
        pushResult('Gider endpoint', expenses.status === 200, `HTTP ${expenses.status}`);

        const y = new Date().getFullYear();
        const compare = await request(`/api/compare?year1=${y}&year2=${y}`);
        pushResult('Karsilastirma endpoint', compare.status === 200, `HTTP ${compare.status}`);

        const predictions = await request('/api/predictions');
        pushResult('Tahmin endpoint', predictions.status === 200, `HTTP ${predictions.status}`);

        const history = await request('/api/history');
        pushResult('Gecmis endpoint', history.status === 200, `HTTP ${history.status}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }

    const failed = checks.filter((c) => !c.ok);
    if (failed.length > 0) {
        console.error(`\nSmoke test failed: ${failed.length} check(s)`);
        process.exitCode = 1;
        return;
    }
    console.log('\nSmoke test passed.');
}

run().catch((error) => {
    console.error('Smoke run failed:', error);
    process.exit(1);
});
