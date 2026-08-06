const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { Blob } = require('buffer');
const { createTestClient, seedUser, uniqueUsername, dbRun } = require('../helpers/test-server');

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
        // Son işlem TUTARI: 20.01 tarihli satırın tutarı (2400). Bu alan SQL'de hiç
        // seçilmediği için API uzun süre 0 döndürdü; regresyonu burada kilitliyoruz.
        assert.equal(customers.body.parties[0].lastTransactionDate.slice(0, 10), '2024-01-20');
        assert.equal(customers.body.parties[0].lastTransactionAmount, 2400);

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
        assert.equal(suppliers.body.parties[0].lastTransactionAmount, 360);

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

    test('top-N endpoints filter by month, not just year', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('topn_month'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const ocakSales = createWorkbook(
            [['15.01.2024', 'Ocak Musteri', 1000, 200, 1200]],
            ['Tarih', 'Müşteri Adı', 'Net', 'KDV', 'Genel Toplam']
        );
        const martSales = createWorkbook(
            [['15.03.2024', 'Mart Musteri', 5000, 1000, 6000]],
            ['Tarih', 'Müşteri Adı', 'Net', 'KDV', 'Genel Toplam']
        );

        // Dönem dosya adından okunur; iki farklı ay yüklenir
        const ocakForm = new FormData();
        ocakForm.append('salesFile', new Blob([ocakSales]), '2024_01_sales.xlsx');
        ocakForm.append('duplicateAction', 'version');
        assert.equal((await client.request('/api/analyze', { method: 'POST', body: ocakForm })).status, 200);

        const martForm = new FormData();
        martForm.append('salesFile', new Blob([martSales]), '2024_03_sales.xlsx');
        martForm.append('duplicateAction', 'version');
        assert.equal((await client.request('/api/analyze', { method: 'POST', body: martForm })).status, 200);

        // Yılın tamamı: iki ay birden
        const yil = await client.request('/api/analysis/top-customers?type=sales&year=2024&limit=100');
        assert.equal(yil.status, 200);
        assert.equal(yil.body.month, 'all');
        assert.equal(yil.body.data.reduce((acc, item) => acc + item.total, 0), 7200);

        // Yalnızca Ocak
        const ocak = await client.request('/api/analysis/top-customers?type=sales&year=2024&month=1&limit=100');
        assert.equal(ocak.status, 200);
        assert.equal(ocak.body.month, 1);
        assert.equal(ocak.body.data.length, 1);
        assert.equal(ocak.body.data[0].name, 'Ocak Musteri');
        assert.equal(ocak.body.data[0].total, 1200);

        // Yalnızca Mart
        const mart = await client.request('/api/analysis/top-customers?type=sales&year=2024&month=3&limit=100');
        assert.equal(mart.body.data.length, 1);
        assert.equal(mart.body.data[0].total, 6000);

        // Veri olmayan ay boş döner, hata vermez
        const temmuz = await client.request('/api/analysis/top-customers?type=sales&year=2024&month=7&limit=100');
        assert.equal(temmuz.status, 200);
        assert.equal(temmuz.body.data.length, 0);

        // Geçersiz ay reddedilir
        assert.equal((await client.request('/api/analysis/top-customers?type=sales&year=2024&month=13')).status, 400);
        assert.equal((await client.request('/api/analysis/top-products?type=sales&year=2024&month=0')).status, 400);
    });

    test('soft-deleted analysis disappears from party list, detail and dashboard summary', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('party_softdelete'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        // İki ayrı analiz: biri kalacak, biri silinecek.
        const kalanForm = new FormData();
        kalanForm.append('salesFile', new Blob([createWorkbook(
            [['15.01.2024', 'Kalan Musteri', 1000, 200, 1200]],
            ['Tarih', 'Müşteri Adı', 'Net', 'KDV', 'Genel Toplam']
        )]), '2024_01_sales.xlsx');
        kalanForm.append('duplicateAction', 'version');
        assert.equal((await client.request('/api/analyze', { method: 'POST', body: kalanForm })).status, 200);

        const silinecekForm = new FormData();
        silinecekForm.append('salesFile', new Blob([createWorkbook(
            [['15.02.2024', 'Silinecek Musteri', 5000, 1000, 6000]],
            ['Tarih', 'Müşteri Adı', 'Net', 'KDV', 'Genel Toplam']
        )]), '2024_02_sales.xlsx');
        silinecekForm.append('purchaseFile', new Blob([createWorkbook(
            [['16.02.2024', 'Silinecek Tedarik', 700, 140, 840]],
            ['Tarih', 'Tedarikçi', 'Net', 'KDV', 'Genel Toplam']
        )]), '2024_02_purchase.xlsx');
        silinecekForm.append('duplicateAction', 'version');
        assert.equal((await client.request('/api/analyze', { method: 'POST', body: silinecekForm })).status, 200);

        // Cari import'tan ÖNCE yazılmış eski satırları temsil eder: source_history_id NULL.
        // Bu satır hiçbir analize bağlı olmadığı için silme sonrası da KALMALIDIR.
        await dbRun(`INSERT INTO party_transactions (
            user_id, party_type, party_id, party_name, normalized_name, invoice_type,
            transaction_date, amount, net, vat, description, source_history_id,
            source_file, source_row_index, source_key
        ) VALUES (?, 'customer', 9001, 'Oksuz Musteri', 'oksuz musteri', 'sales',
            '2024-03-01', 2500, 2500, 0, '', NULL, 'eski.xlsx', 1, ?)`,
        [user.id, `orphan-${user.id}`]);

        const before = await client.request('/api/business-parties?type=customer&sort=volume_desc');
        assert.equal(before.status, 200);
        assert.equal(before.body.total, 3);

        const beforeSummary = await client.request('/api/business-parties/dashboard-summary');
        assert.equal(beforeSummary.body.summary.totalCustomers, 3);
        assert.equal(beforeSummary.body.summary.totalSuppliers, 1);

        const silinecek = before.body.parties.find((party) => party.name === 'Silinecek Musteri');
        assert.ok(silinecek, 'silinecek müşteri listede bulunmalı');

        // Silinecek analizin geçmiş kaydını bul ve soft-delete et.
        const history = await client.request('/api/history');
        assert.equal(history.status, 200);
        const hedef = history.body.history.find((row) => String(row.salesFileName || row.sales_filename || '').includes('2024_02'));
        assert.ok(hedef, 'silinecek analiz geçmişte bulunmalı');
        assert.equal((await client.request(`/api/history/${hedef.id}`, { method: 'DELETE' })).status, 200);

        // Liste: silinen analizin carileri düşer, diğerleri korunur.
        const after = await client.request('/api/business-parties?type=customer&sort=volume_desc');
        assert.equal(after.status, 200);
        assert.equal(after.body.total, 2);
        const kalanIsimler = after.body.parties.map((party) => party.name).sort();
        assert.deepEqual(kalanIsimler, ['Kalan Musteri', 'Oksuz Musteri']);

        // Tedarikçi tarafı da süzülmeli.
        const suppliersAfter = await client.request('/api/business-parties?type=supplier');
        assert.equal(suppliersAfter.body.total, 0);

        // Detay ekranı: silinen carinin hareketi kalmadığı için 404 döner.
        const detail = await client.request(`/api/business-parties/customer/${silinecek.id}`);
        assert.equal(detail.status, 404);

        // Panel özeti sayaçları da düşmeli.
        const afterSummary = await client.request('/api/business-parties/dashboard-summary');
        assert.equal(afterSummary.status, 200);
        assert.equal(afterSummary.body.summary.totalCustomers, 2);
        assert.equal(afterSummary.body.summary.totalSuppliers, 0);
        assert.ok(!afterSummary.body.summary.recentParties.some((party) => party.name === 'Silinecek Musteri'));
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
