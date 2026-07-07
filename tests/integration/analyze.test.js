const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { Blob } = require('buffer');
const { createTestClient, seedUser, uniqueUsername } = require('../helpers/test-server');

function createExcelBuffer(data, headers) {
    const sheetData = [headers, ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

describe('Integration Tests - Analyze Endpoint', () => {
    test('analyze requires authentication', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const response = await client.request('/api/analyze', { method: 'POST' });
        assert.equal(response.status, 401);
    });

    test('analyze rejects missing files for an authenticated user', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('analyze_missing'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const response = await client.request('/api/analyze', { method: 'POST' });
        assert.equal(response.status, 400);
    });

    test('analyze accepts valid workbook uploads', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('analyze_valid'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const salesBuffer = createExcelBuffer(
            [
                ['15.01.2024', 'Firma A', 1000, 180, 1180],
                ['16.01.2024', 'Firma B', 2000, 360, 2360]
            ],
            ['Date', 'Company', 'Net', 'VAT', 'Gross']
        );

        const purchaseBuffer = createExcelBuffer(
            [
                ['15.01.2024', 'Tedarikci A', 500, 90, 590]
            ],
            ['Date', 'Company', 'Net', 'VAT', 'Gross']
        );

        const formData = new FormData();
        formData.append('salesFile', new Blob([salesBuffer]), '2024_01_sales.xlsx');
        formData.append('purchaseFile', new Blob([purchaseBuffer]), '2024_01_purchase.xlsx');

        const response = await client.request('/api/analyze', {
            method: 'POST',
            body: formData
        });

        assert.equal(response.status, 200);
        assert.equal(response.body.success, true);
        assert.ok(response.body.summaryData);
    });
});
