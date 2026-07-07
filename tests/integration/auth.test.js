const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestClient, seedUser, uniqueUsername } = require('../helpers/test-server');

describe('Integration Tests - Auth Endpoints', () => {
    test('register accepts a valid self-registration request', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const response = await client.request('/api/register', {
            method: 'POST',
            json: {
                username: uniqueUsername('register'),
                password: 'Test1234!'
            }
        });

        assert.equal(response.status, 201);
        assert.equal(response.body.success, true);
        assert.equal(response.body.pending, true);
    });

    test('register rejects weak passwords', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const response = await client.request('/api/register', {
            method: 'POST',
            json: {
                username: uniqueUsername('weak'),
                password: '123'
            }
        });

        assert.equal(response.status, 400);
        assert.match(response.body.error, /Şifre/);
    });

    test('login succeeds for an approved user', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('approved'), password: 'Test1234!' });
        const response = await client.login(user.username, user.password);

        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);
        assert.equal(response.body.user.username, user.username);
    });

    test('login rejects pending users', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('pending'), password: 'Test1234!', status: 'pending' });
        const response = await client.login(user.username, user.password);

        assert.equal(response.status, 403);
        assert.equal(response.body.status, 'pending');
    });

    test('logout clears an authenticated session', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('logout'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const logoutResponse = await client.request('/api/logout', { method: 'POST' });
        assert.equal(logoutResponse.status, 200);

        const authCheck = await client.request('/api/history');
        assert.equal(authCheck.status, 401);
    });

    test('change-password requires authentication', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const response = await client.request('/api/change-password', {
            method: 'POST',
            json: {
                currentPassword: 'Test1234!',
                newPassword: 'NewPass1234!'
            }
        });

        assert.equal(response.status, 401);
    });

    test('change-password enforces the same password policy as registration', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('passwd'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const response = await client.request('/api/change-password', {
            method: 'POST',
            json: {
                currentPassword: user.password,
                newPassword: '123456'
            }
        });

        assert.equal(response.status, 400);
        assert.match(response.body.error, /Şifre/);
    });
});
