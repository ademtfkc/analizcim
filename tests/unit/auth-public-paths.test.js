const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('auth middleware keeps favicon assets public', () => {
    const authMiddleware = fs.readFileSync(path.join(__dirname, '../../src/middleware/auth.js'), 'utf8');

    assert.match(authMiddleware, /SESSION_PUBLIC_PATHS = \[[^\]]*'\/favicon\.ico'[^\]]*'\/favicon\.svg'/);
    assert.match(authMiddleware, /AUTH_PUBLIC_PATHS = \[[^\]]*'\/favicon\.ico'[^\]]*'\/favicon\.svg'/);
});
