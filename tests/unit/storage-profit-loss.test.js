const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../../src/storage');
const db = require('../../src/database');

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

async function waitForDatabaseReady(retries = 50) {
    for (let attempt = 0; attempt < retries; attempt += 1) {
        const row = await dbGet(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'analyses'`).catch(() => null);
        if (row) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error('Database did not initialize in time.');
}

describe('storage.getMonthlyProfitLoss', () => {
    test('counts purchase-only months as negative gross and net profit', async () => {
        await waitForDatabaseReady();
        const userId = 990001;
        const analysisId = `unit-pl-${Date.now()}`;

        await dbRun(
            `INSERT INTO analyses (
                id, user_id, date, display_date, sales_filename, purchase_filename,
                sales_amount, purchase_amount, sales_tax, purchase_tax, net_profit,
                sales_json, purchase_json, summary
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                analysisId,
                userId,
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

        const result = await storage.getMonthlyProfitLoss(userId, 2024);
        const march = result.months.find((month) => month.month === 3);

        assert.equal(march.sales, 0);
        assert.equal(march.purchases, 1500);
        assert.equal(march.grossProfit, -1200);
        assert.equal(march.netProfit, -1200);
        assert.equal(result.totals.grossProfit, -1200);
        assert.equal(result.totals.netProfit, -1200);
    });
});
