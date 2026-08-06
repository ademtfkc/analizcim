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

    test('expense names survive the round trip (UI sends label)', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('expense_label'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        // Ön yüz buildExpensesDataFromDOM ile {id, label, amount, date} gönderir
        const saveResponse = await client.request('/api/expenses-local', {
            method: 'PUT',
            json: {
                year: 2024,
                month: 5,
                fixed: [{ id: 'f1', label: 'Kira', amount: 12500, date: '' }],
                variable: [{ id: 'v1', label: 'Yakıt', amount: 3400, date: '' }]
            }
        });
        assert.equal(saveResponse.status, 200);

        const readResponse = await client.request('/api/expenses-local?year=2024&month=5');
        assert.equal(readResponse.body.data.fixed[0].label, 'Kira');
        assert.equal(readResponse.body.data.fixed[0].amount, 12500);
        assert.equal(readResponse.body.data.variable[0].label, 'Yakıt');
    });

    test('expense names sent as name are still accepted (geriye dönük uyum)', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('expense_name'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        await client.request('/api/expenses-local', {
            method: 'PUT',
            json: { year: 2024, month: 6, fixed: [{ name: 'Sigorta', amount: 900 }], variable: [] }
        });

        const readResponse = await client.request('/api/expenses-local?year=2024&month=6');
        assert.equal(readResponse.body.data.fixed[0].label, 'Sigorta');
    });

    test('year-wide expenses reach the dashboard monthly series', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('expense_allmonth'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        // "Tüm yıl" giderleri panelde görünmüyordu; Kâr/Zarar tablosu ise sayıyordu
        await client.request('/api/expenses-local', {
            method: 'PUT',
            json: { year: 2024, month: 'all', fixed: [{ label: 'Yıllık kira', amount: 120000 }], variable: [] }
        });

        const plResponse = await client.request('/api/analysis/profit-loss?year=2024');
        assert.equal(plResponse.status, 200);
        assert.equal(Math.round(plResponse.body.totals.expenses), 120000);
        // Her aya eşit dağıtılır
        assert.equal(Math.round(plResponse.body.months[0].expenses), 10000);
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

    test('retired predictions layout keys are rejected by the preferences allowlist', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('deadprefs'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        // Tahminler sayfası sabit düzene geçtiği için bu iki anahtar artık yazılamaz
        const saveResponse = await client.request('/api/user/preferences', {
            method: 'PUT',
            json: {
                theme: 'dark',
                predictions_layout_id: 'layout-a',
                predictions_card_order: '["chart","table"]'
            }
        });

        assert.equal(saveResponse.status, 200);
        assert.equal(saveResponse.body.preferences.theme, 'dark');
        assert.equal(saveResponse.body.preferences.predictions_layout_id, undefined);
        assert.equal(saveResponse.body.preferences.predictions_card_order, undefined);

        // Taşıma ucu da yalnız temayı taşır
        const migrateResponse = await client.request('/api/user/preferences/migrate', {
            method: 'POST',
            json: { theme: 'light', predictions_layout_id: 'layout-b' }
        });

        assert.equal(migrateResponse.status, 200);
        assert.equal(migrateResponse.body.preferences.predictions_layout_id, undefined);

        const readResponse = await client.request('/api/user/preferences');
        assert.equal(readResponse.body.preferences.predictions_layout_id, undefined);
        assert.equal(readResponse.body.preferences.predictions_card_order, undefined);
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
