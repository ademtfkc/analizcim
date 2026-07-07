const path = require('path');
const os = require('os');
const fs = require('fs');
const bcrypt = require('bcrypt');

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.BOOTSTRAP_ADMIN_USERNAME = process.env.BOOTSTRAP_ADMIN_USERNAME || 'bootstrap_admin';
process.env.BOOTSTRAP_ADMIN_PASSWORD = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'Bootstrap123!';

let currentDb = null;
let currentDbPath = null;

function createTestDatabasePath() {
    const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return path.join(os.tmpdir(), `analizcim-test-${suffix}.db`);
}

function clearApplicationModules() {
    const srcRoot = path.resolve(__dirname, '../../src');
    for (const modulePath of Object.keys(require.cache)) {
        if (modulePath.startsWith(srcRoot)) {
            delete require.cache[modulePath];
        }
    }
}

function loadApplicationForTest() {
    currentDbPath = createTestDatabasePath();
    process.env.TEST_DATABASE_PATH = currentDbPath;
    clearApplicationModules();

    const { startServer } = require('../../src/server');
    currentDb = require('../../src/database');
    return { startServer, db: currentDb, dbPath: currentDbPath };
}

function getCurrentDb() {
    if (!currentDb) {
        throw new Error('Test database is not initialized. Call createTestClient() first.');
    }
    return currentDb;
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        getCurrentDb().get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        getCurrentDb().run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

async function waitForDatabaseReady(retries = 50) {
    for (let attempt = 0; attempt < retries; attempt += 1) {
        try {
            const row = await dbGet(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`);
            if (row) {
                const bootstrapUser = await dbGet('SELECT id FROM users WHERE username = ?', [process.env.BOOTSTRAP_ADMIN_USERNAME]);
                if (bootstrapUser) return;
            }
        } catch (_) {
            // Database is still initializing.
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Database did not initialize in time.');
}

function cleanupTestDatabasePath(dbPath = currentDbPath) {
    if (!dbPath) return;

    for (const candidate of [dbPath, `${dbPath}-journal`, `${dbPath}-shm`, `${dbPath}-wal`]) {
        try {
            if (fs.existsSync(candidate)) {
                fs.unlinkSync(candidate);
            }
        } catch (_) {
            continue;
        }
    }
}

function uniqueUsername(prefix = 'user') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function seedUser({
    username = uniqueUsername('seed'),
    password = 'Test1234!',
    isAdmin = 0,
    status = 'approved'
} = {}) {
    await waitForDatabaseReady();

    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await dbGet('SELECT id FROM users WHERE username = ?', [username]);

    if (existing) {
        await dbRun(
            'UPDATE users SET password_hash = ?, is_admin = ?, status = ? WHERE id = ?',
            [passwordHash, isAdmin ? 1 : 0, status, existing.id]
        );
        return { id: existing.id, username, password, is_admin: isAdmin ? 1 : 0, status };
    }

    const result = await dbRun(
        'INSERT INTO users (username, password_hash, is_admin, status) VALUES (?, ?, ?, ?)',
        [username, passwordHash, isAdmin ? 1 : 0, status]
    );

    return { id: result.lastID, username, password, is_admin: isAdmin ? 1 : 0, status };
}

async function createTestClient(t) {
    let server;
    let testDb;
    let testDbPath;
    try {
        const app = loadApplicationForTest();
        testDb = app.db;
        testDbPath = app.dbPath;
        await waitForDatabaseReady();
        server = await new Promise((resolve, reject) => {
            const srv = app.startServer(0);
            srv.once('listening', () => resolve(srv));
            srv.once('error', reject);
        });
    } catch (error) {
        if (error && error.code === 'EPERM') {
            t.skip('Socket listen izni yok (sandbox).');
            return null;
        }
        throw error;
    }

    t.after(async () => {
        if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        await new Promise((resolve) => testDb.close(resolve));
        cleanupTestDatabasePath(testDbPath);
        if (process.env.TEST_DATABASE_PATH === testDbPath) {
            delete process.env.TEST_DATABASE_PATH;
        }
        if (currentDb === testDb) {
            currentDb = null;
            currentDbPath = null;
        }
    });

    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;
    let sessionCookie = '';

    async function request(pathname, options = {}) {
        const headers = { Connection: 'close', ...(options.headers || {}) };
        if (sessionCookie) headers.Cookie = sessionCookie;

        let body = options.body;
        if (options.json !== undefined) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(options.json);
        }

        const response = await fetch(baseUrl + pathname, {
            method: options.method || 'GET',
            headers,
            body
        });

        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            sessionCookie = setCookie.split(';')[0];
        }

        const raw = await response.text();
        let parsed = raw;
        try {
            parsed = raw ? JSON.parse(raw) : null;
        } catch (_) {
            // Keep raw text response.
        }

        return { status: response.status, body: parsed, raw, headers: response.headers };
    }

    async function login(username, password) {
        return request('/api/login', {
            method: 'POST',
            json: { username, password }
        });
    }

    function clearSession() {
        sessionCookie = '';
    }

    return {
        baseUrl,
        request,
        login,
        clearSession
    };
}

module.exports = {
    createTestClient,
    seedUser,
    uniqueUsername,
    dbRun,
    cleanupTestDatabasePath
};
