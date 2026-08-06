const { describe, test, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

// Kendi izole veritabanı: birim test dosyaları paralel çalışır ve varsayılan test DB'sini
// paylaşan iki dosya SQLite kilidinde birbirini bekletir. `src/database` yolu import
// anında okuduğu için bu satır require'lardan ÖNCE gelmelidir.
process.env.NODE_ENV = 'test';
const testDbPath = path.join(os.tmpdir(), `analizcim-monthly-totals-${process.pid}.db`);
process.env.TEST_DATABASE_PATH = testDbPath;

const storage = require('../../src/storage');
const db = require('../../src/database');

after(() => {
    db.close(() => {
        for (const candidate of [testDbPath, `${testDbPath}-journal`, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
            try { fs.unlinkSync(candidate); } catch (_) { /* zaten yok */ }
        }
    });
});

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

function insertAnalysis(userId, id, salesFile, purchaseFile, values) {
    return dbRun(
        `INSERT INTO analyses (
            id, user_id, date, display_date, sales_filename, purchase_filename,
            sales_amount, purchase_amount, sales_tax, purchase_tax, net_profit,
            sales_json, purchase_json, summary
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            userId,
            '2024-01-15T00:00:00.000Z',
            'Ocak 2024',
            salesFile,
            purchaseFile,
            values.salesAmount,
            values.purchaseAmount,
            values.salesTax,
            values.purchaseTax,
            0,
            values.salesJson || '{}',
            values.purchaseJson || '{}',
            '{}'
        ]
    );
}

describe('storage.getMonthlyTotals KDV ayrıştırması', () => {
    test('satış ve alış KDV\'sini ayrı döndürür; sales/purchases KDV dahil kalır', async () => {
        await waitForDatabaseReady();
        const userId = 990101;
        const stamp = Date.now();

        // Ocak: KDV dahil satış 11.800 (KDV 1.800), KDV dahil alış 5.900 (KDV 900)
        await insertAnalysis(userId, `unit-mt-a-${stamp}`, '2024_01_sales.xlsx', '2024_01_purchase.xlsx', {
            salesAmount: 11800,
            purchaseAmount: 5900,
            salesTax: 1800,
            purchaseTax: 900
        });

        const monthly = await storage.getMonthlyTotals(2024, userId);
        const idx = monthly.labels.indexOf('2024-01');
        assert.notEqual(idx, -1, 'Ocak 2024 dönemi bulunmalı');

        // Mevcut sözleşme birebir korunur: tutarlar KDV DAHİL, vat birleşik
        assert.equal(monthly.sales[idx], 11800);
        assert.equal(monthly.purchases[idx], 5900);
        assert.equal(monthly.vat[idx], 2700);

        // Yeni alanlar: KDV hariç seri artık doğru türetilebilir
        assert.equal(monthly.salesVat[idx], 1800);
        assert.equal(monthly.purchaseVat[idx], 900);
        assert.equal(monthly.sales[idx] - monthly.salesVat[idx], 10000);
        assert.equal(monthly.purchases[idx] - monthly.purchaseVat[idx], 5000);

        // 2026-07-07 kararı: brüt kâr KDV hariç tabandan hesaplanır
        const grossProfit = (monthly.sales[idx] - monthly.salesVat[idx])
            - (monthly.purchases[idx] - monthly.purchaseVat[idx]);
        assert.equal(grossProfit, 5000);
        // Tuzağın kendisi: ham fark KDV dahil olduğu için farklı çıkar
        assert.notEqual(monthly.sales[idx] - monthly.purchases[idx], grossProfit);
    });

    test('DB vergi kolonları boşken JSON gövdesinden satış/alış KDV\'sini ayrı okur', async () => {
        await waitForDatabaseReady();
        const userId = 990102;
        const stamp = Date.now();

        await insertAnalysis(userId, `unit-mt-b-${stamp}`, '2024_02_sales.xlsx', '2024_02_purchase.xlsx', {
            salesAmount: 0,
            purchaseAmount: 0,
            salesTax: 0,
            purchaseTax: 0,
            salesJson: JSON.stringify({ totalAmount: 2360, totalTax: 360 }),
            purchaseJson: JSON.stringify({ totalAmount: 1180, totalTax: 180 })
        });

        const monthly = await storage.getMonthlyTotals(2024, userId);
        const idx = monthly.labels.indexOf('2024-02');
        assert.notEqual(idx, -1, 'Şubat 2024 dönemi bulunmalı');

        assert.equal(monthly.sales[idx], 2360);
        assert.equal(monthly.purchases[idx], 1180);
        assert.equal(monthly.vat[idx], 540);
        assert.equal(monthly.salesVat[idx], 360);
        assert.equal(monthly.purchaseVat[idx], 180);
    });

    test('fillMissingMonths KDV dizilerini de doldurur (boş ay = 0)', () => {
        const filled = storage.fillMissingMonths({
            labels: ['2024-01', '2024-03'],
            sales: [11800, 2360],
            purchases: [5900, 1180],
            vat: [2700, 540],
            salesVat: [1800, 360],
            purchaseVat: [900, 180]
        });

        assert.deepEqual(filled.labels, ['2024-01', '2024-02', '2024-03']);
        assert.deepEqual(filled.salesVat, [1800, 0, 360]);
        assert.deepEqual(filled.purchaseVat, [900, 0, 180]);
        assert.deepEqual(filled.vat, [2700, 0, 540]);
        assert.deepEqual(filled.sales, [11800, 0, 2360]);
    });

    test('getMonthlyTotalsInRange aynı KDV sözleşmesini paylaşır', async () => {
        await waitForDatabaseReady();
        const userId = 990103;
        const stamp = Date.now();

        await insertAnalysis(userId, `unit-mt-c-${stamp}`, '2024_01_sales.xlsx', null, {
            salesAmount: 11800,
            purchaseAmount: 0,
            salesTax: 1800,
            purchaseTax: 0
        });

        const monthly = await storage.getMonthlyTotalsInRange(userId, '2024-01', '2024-12');
        const idx = monthly.labels.indexOf('2024-01');
        assert.notEqual(idx, -1, 'Ocak 2024 dönemi bulunmalı');
        assert.equal(monthly.salesVat[idx], 1800);
        assert.equal(monthly.purchaseVat[idx], 0);
        assert.equal(monthly.sales[idx] - monthly.salesVat[idx], 10000);
    });
});
