const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestClient, seedUser, uniqueUsername, dbRun } = require('../helpers/test-server');

describe('Integration Tests - Profit/Loss Endpoint', () => {
    test('purchase-only months are returned as negative profit/loss months', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('pl_purchase_only'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        await dbRun(
            `INSERT INTO analyses (
                id, user_id, date, display_date, sales_filename, purchase_filename,
                sales_amount, purchase_amount, sales_tax, purchase_tax, net_profit,
                sales_json, purchase_json, summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                `pl-${Date.now()}`,
                user.id,
                '2024-03-15T00:00:00.000Z',
                'Mart 2024',
                null,
                '2024_03_purchase.xlsx',
                0,
                1500,
                0,
                300,
                -1500,
                '{}',
                '{}',
                '{}'
            ]
        );

        const response = await client.request('/api/analysis/profit-loss?year=2024');

        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);

        const march = response.body.months.find((month) => month.month === 3);
        assert.ok(march);
        assert.equal(march.sales, 0);
        assert.equal(march.purchases, 1500);
        assert.equal(march.grossProfit, -1200);
        assert.equal(march.netProfit, -1200);
        assert.equal(response.body.totals.grossProfit, -1200);
        assert.equal(response.body.totals.netProfit, -1200);
    });
});
