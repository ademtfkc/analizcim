const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { Blob } = require('buffer');
const { createTestClient, seedUser, uniqueUsername } = require('../helpers/test-server');

function createWorkbook(rows, headers) {
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

async function uploadAnalysis(client, { salesBuffer, purchaseBuffer, filenameSuffix = '' }) {
    const formData = new FormData();
    if (salesBuffer) formData.append('salesFile', new Blob([salesBuffer]), `2024_01_sales${filenameSuffix}.xlsx`);
    if (purchaseBuffer) formData.append('purchaseFile', new Blob([purchaseBuffer]), `2024_01_purchase${filenameSuffix}.xlsx`);
    formData.append('duplicateAction', 'version');

    return client.request('/api/analyze', {
        method: 'POST',
        body: formData
    });
}

describe('Integration Tests - Business Parties From Excel', () => {
    test('sales and purchase uploads create customer and supplier transaction analytics without duplicates', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('party_import'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const salesBuffer = createWorkbook(
            [
                ['15.01.2024', 'Acme Musteri', 1000, 200, 1200],
                ['20.01.2024', 'Acme Musteri', 2000, 400, 2400],
                ['21.01.2024', 'Beta Musteri', 500, 100, 600]
            ],
            ['Tarih', 'Müşteri Adı', 'Net', 'KDV', 'Genel Toplam']
        );

        const purchaseBuffer = createWorkbook(
            [
                ['17.01.2024', 'Delta Tedarik', 700, 140, 840],
                ['22.01.2024', 'Delta Tedarik', 300, 60, 360]
            ],
            ['Tarih', 'Tedarikçi', 'Net', 'KDV', 'Genel Toplam']
        );

        const upload = await uploadAnalysis(client, { salesBuffer, purchaseBuffer });
        assert.equal(upload.status, 200);
        assert.equal(upload.body.importSummary.customers, 2);
        assert.equal(upload.body.importSummary.suppliers, 1);
        assert.equal(upload.body.importSummary.transactionsInserted, 5);

        const duplicateUpload = await uploadAnalysis(client, { salesBuffer, purchaseBuffer });
        assert.equal(duplicateUpload.status, 200);
        assert.equal(duplicateUpload.body.importSummary.transactionsInserted, 0);

        const customers = await client.request('/api/business-parties?type=customer&sort=volume_desc');
        assert.equal(customers.status, 200);
        assert.equal(customers.body.total, 2);
        assert.equal(customers.body.parties[0].name, 'Acme Musteri');
        assert.equal(customers.body.parties[0].transactionCount, 2);
        assert.equal(customers.body.parties[0].totalVolume, 3600);

        const customerDetail = await client.request(`/api/business-parties/customer/${customers.body.parties[0].id}`);
        assert.equal(customerDetail.status, 200);
        assert.equal(customerDetail.body.party.name, 'Acme Musteri');
        assert.equal(customerDetail.body.metrics.totalVolume, 3600);
        assert.equal(customerDetail.body.metrics.balance, 3600);
        assert.equal(customerDetail.body.metrics.averageAmount, 1800);
        assert.equal(customerDetail.body.transactions.length, 2);
        assert.equal(customerDetail.body.monthly[0].month, '2024-01');

        const suppliers = await client.request('/api/business-parties?type=supplier&sort=volume_desc');
        assert.equal(suppliers.status, 200);
        assert.equal(suppliers.body.total, 1);
        assert.equal(suppliers.body.parties[0].name, 'Delta Tedarik');
        assert.equal(suppliers.body.parties[0].totalVolume, 1200);

        const supplierDetail = await client.request(`/api/business-parties/supplier/${suppliers.body.parties[0].id}`);
        assert.equal(supplierDetail.status, 200);
        assert.equal(supplierDetail.body.metrics.balance, -1200);
        assert.equal(supplierDetail.body.transactions.length, 2);

        const dashboard = await client.request('/api/business-parties/dashboard-summary');
        assert.equal(dashboard.status, 200);
        assert.equal(dashboard.body.summary.totalCustomers, 2);
        assert.equal(dashboard.body.summary.totalSuppliers, 1);
        assert.equal(dashboard.body.summary.topCustomers[0].name, 'Acme Musteri');
        assert.equal(dashboard.body.summary.topSuppliers[0].name, 'Delta Tedarik');
        assert.ok(dashboard.body.summary.recentParties.length >= 2);
    });

    test('business party list filters by search, date range and minimum volume', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('party_filters'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const salesBuffer = createWorkbook(
            [
                ['15.01.2024', 'Arama Musteri', 1000, 0, 1000],
                ['15.02.2024', 'Kucuk Musteri', 50, 0, 50]
            ],
            ['Tarih', 'Cari Adı', 'Net', 'KDV', 'Tutar']
        );

        const upload = await uploadAnalysis(client, { salesBuffer, filenameSuffix: '_filters' });
        assert.equal(upload.status, 200);

        const response = await client.request('/api/business-parties?type=customer&search=arama&dateFrom=2024-01&dateTo=2024-01&minVolume=500');
        assert.equal(response.status, 200);
        assert.equal(response.body.total, 1);
        assert.equal(response.body.parties[0].name, 'Arama Musteri');
    });
});
