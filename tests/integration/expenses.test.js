const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestClient, seedUser, uniqueUsername } = require('../helpers/test-server');

describe('Integration Tests - Expenses And Preferences', () => {
    test('expenses endpoint requires authentication', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const response = await client.request('/api/expenses-local');
        assert.equal(response.status, 401);
    });

    test('expenses can be saved and read back for an approved user', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('expenses'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const saveResponse = await client.request('/api/expenses-local', {
            method: 'PUT',
            json: {
                year: 2024,
                month: 1,
                fixed: [{ name: 'Kira', amount: 10000 }],
                variable: [{ name: 'Kargo', amount: 500 }]
            }
        });

        assert.equal(saveResponse.status, 200);
        assert.equal(saveResponse.body.success, true);

        const readResponse = await client.request('/api/expenses-local?year=2024&month=1');
        assert.equal(readResponse.status, 200);
        assert.equal(readResponse.body.success, true);
        assert.ok(Array.isArray(readResponse.body.data.fixed));
        assert.ok(Array.isArray(readResponse.body.data.variable));
    });

    test('expenses validation rejects malformed amounts', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('expense_validation'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const response = await client.request('/api/expenses-local', {
            method: 'PUT',
            json: {
                year: 2024,
                month: 1,
                fixed: [{ name: 'Kira', amount: 'invalid' }]
            }
        });

        assert.equal(response.status, 400);
    });

    test('preferences endpoint requires authentication', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const response = await client.request('/api/user/preferences');
        assert.equal(response.status, 401);
    });

    test('preferences can be stored for an approved user', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('prefs'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const saveResponse = await client.request('/api/user/preferences', {
            method: 'PUT',
            json: {
                theme: 'dark'
            }
        });

        assert.equal(saveResponse.status, 200);
        assert.equal(saveResponse.body.success, true);

        const readResponse = await client.request('/api/user/preferences');
        assert.equal(readResponse.status, 200);
        assert.equal(readResponse.body.success, true);
    });

    test('expense years endpoint returns an array', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('years'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const response = await client.request('/api/expenses-local/years');
        assert.equal(response.status, 200);
        assert.ok(Array.isArray(response.body.years));
    });
});
