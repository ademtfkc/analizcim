const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestClient, seedUser, uniqueUsername } = require('../helpers/test-server');

describe('Integration Tests - History And Reporting Endpoints', () => {
    test('history requires authentication', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const response = await client.request('/api/history');
        assert.equal(response.status, 401);
    });

    test('history returns paginated payload for approved users', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('history'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const response = await client.request('/api/history?limit=10&offset=0');
        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);
        assert.ok(Array.isArray(response.body.history));
        assert.equal(typeof response.body.total, 'number');
    });

    test('dashboard returns an empty but successful payload for approved users', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('dashboard'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const response = await client.request('/api/dashboard/latest');
        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);
        assert.ok(response.body.summary);
        assert.ok(response.body.monthly);
    });

    test('predictions endpoint requires authentication', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const response = await client.request('/api/predictions');
        assert.equal(response.status, 401);
    });

    test('predictions endpoint responds for approved users', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('predictions'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const response = await client.request('/api/predictions');
        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);
        assert.ok(Object.hasOwn(response.body, 'prediction'));
    });

    test('compare validates missing year parameters', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('compare'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const response = await client.request('/api/compare');
        assert.equal(response.status, 400);
    });
});
