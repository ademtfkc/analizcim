const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { repairUploadFilename } = require('../../src/validators');

// Tarayıcı yüklemesinde dosya adı multipart gövdesinde UTF-8 gider, ama busboy onu latin1
// okur. "nisan_2026_satış.xlsx" bu yüzden "nisan_2026_satÄ±s.xlsx" olarak geliyordu ve
// veritabanına da böyle yazılıyordu (2026-08-07 tarayıcı denetimi bulgusu).
describe('validators.repairUploadFilename (Türkçe dosya adı onarımı)', () => {
    test('latin1 okunmuş UTF-8 adı düzeltir', () => {
        const bozuk = Buffer.from('nisan_2026_satış.xlsx', 'utf8').toString('latin1');
        assert.notEqual(bozuk, 'nisan_2026_satış.xlsx', 'kurulum: ad gerçekten bozulmuş olmalı');
        assert.equal(repairUploadFilename(bozuk), 'nisan_2026_satış.xlsx');
    });

    test('gerçek veritabanında görülen bozuk ad onarılır', () => {
        // data/analiz.db içinde bu hâliyle duruyordu (party_transactions.source_file)
        assert.equal(repairUploadFilename('nisan_2026_satÄ±s.xlsx'), 'nisan_2026_satıs.xlsx');
    });

    test('tüm Türkçe harfleri kapsar', () => {
        const dogru = 'çğıöşü_ÇĞİÖŞÜ_rapor.xlsx';
        const bozuk = Buffer.from(dogru, 'utf8').toString('latin1');
        assert.equal(repairUploadFilename(bozuk), dogru);
    });

    test('ASCII adı değiştirmez', () => {
        assert.equal(repairUploadFilename('mayis_2026_satis.xlsx'), 'mayis_2026_satis.xlsx');
    });

    test('zaten doğru olan Türkçe adı bozmaz', () => {
        // Doğru UTF-8 metni tekrar latin1'den çözmek anlamsız bayt üretir; fonksiyon
        // bunu fark edip adı olduğu gibi bırakmalıdır.
        assert.equal(repairUploadFilename('nisan_2026_satış.xlsx'), 'nisan_2026_satış.xlsx');
    });

    test('boş / string olmayan değerler dokunulmadan döner', () => {
        assert.equal(repairUploadFilename(''), '');
        assert.equal(repairUploadFilename(null), null);
        assert.equal(repairUploadFilename(undefined), undefined);
        assert.equal(repairUploadFilename(42), 42);
    });
});
