const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { buildComparableSummary } = require('../../src/compare-metrics');

// Saf hesap testidir: veritabanı, sunucu veya oturum gerektirmez.
function yilKur(aylar) {
    const monthly = [];
    for (let ay = 1; ay <= 12; ay += 1) {
        const veri = aylar[ay] || {};
        monthly.push({
            month: ay,
            sales: veri.sales || 0,
            purchase: veri.purchase || 0,
            salesTax: veri.salesTax || 0,
            purchaseTax: veri.purchaseTax || 0
        });
    }
    return { monthly };
}

// Her ayı aynı tutan yardımcı: 1'den adet'e kadar dolu, kalanı boş.
function duzYil(adet, satir) {
    const aylar = {};
    for (let ay = 1; ay <= adet; ay += 1) aylar[ay] = satir;
    return yilKur(aylar);
}

describe('compare-metrics.buildComparableSummary (ortak ay kıyası)', () => {
    test('yalnızca iki yılda da hareket olan ayları kıyaslar', () => {
        // 2025: 12 ay dolu · 2026: 6 ay dolu. Yıl toplamı kıyası "satış %50 düştü" derdi.
        const y1 = duzYil(12, { sales: 100, purchase: 60, salesTax: 20, purchaseTax: 12 });
        const y2 = duzYil(6, { sales: 150, purchase: 90, salesTax: 30, purchaseTax: 18 });

        const sonuc = buildComparableSummary(y1, y2);

        assert.deepEqual(sonuc.sharedMonths, [1, 2, 3, 4, 5, 6]);
        assert.equal(sonuc.sharedMonthCount, 6);
        assert.equal(sonuc.year1MonthCount, 12);
        assert.equal(sonuc.year2MonthCount, 6);

        // Ortak 6 ayın toplamları
        assert.equal(sonuc.year1.sales, 600);
        assert.equal(sonuc.year2.sales, 900);

        // Gerçek artış +%50 — yıl toplamı kıyası -%50 derdi (1200 → 900)
        assert.equal(sonuc.growth.sales, '50.0');
    });

    test('kâr KDV hariç hesaplanır, satış eksi alış değil', () => {
        const y1 = duzYil(3, { sales: 1180, purchase: 590, salesTax: 180, purchaseTax: 90 });
        const y2 = duzYil(3, { sales: 2360, purchase: 1180, salesTax: 360, purchaseTax: 180 });

        const sonuc = buildComparableSummary(y1, y2);

        // Ay başına: (1180-180) - (590-90) = 500 → 3 ay = 1500
        assert.equal(sonuc.year1.profit, 1500);
        // Ay başına: (2360-360) - (1180-180) = 1000 → 3 ay = 3000
        assert.equal(sonuc.year2.profit, 3000);
        assert.equal(sonuc.growth.profit, '100.0');

        // Regresyon kilidi: satış - alış KULLANILMAZ (o 1770 verirdi)
        assert.notEqual(sonuc.year1.profit, sonuc.year1.sales - sonuc.year1.purchase);
    });

    test('ortak ay yoksa toplamlar sıfır, oranlar null döner', () => {
        const y1 = yilKur({ 1: { sales: 100 }, 2: { sales: 100 } });
        const y2 = yilKur({ 7: { sales: 100 }, 8: { sales: 100 } });

        const sonuc = buildComparableSummary(y1, y2);

        assert.equal(sonuc.sharedMonthCount, 0);
        assert.equal(sonuc.year1.sales, 0);
        assert.equal(sonuc.growth.sales, null);
        assert.equal(sonuc.growth.profit, null);
    });

    test('yalnız alış hareketi olan ay da dolu sayılır', () => {
        const y1 = yilKur({ 4: { purchase: 500, purchaseTax: 90 } });
        const y2 = yilKur({ 4: { purchase: 250, purchaseTax: 45 } });

        const sonuc = buildComparableSummary(y1, y2);

        assert.deepEqual(sonuc.sharedMonths, [4]);
        assert.equal(sonuc.year1.purchase, 500);
        assert.equal(sonuc.growth.purchase, '-50.0');
    });

    test('düşüşte oran negatif, sıfır tabanda null (sıfıra bölme koruması)', () => {
        const y1 = duzYil(2, { sales: 200, purchase: 0 });
        const y2 = duzYil(2, { sales: 50, purchase: 0 });

        const sonuc = buildComparableSummary(y1, y2);

        assert.equal(sonuc.growth.sales, '-75.0');
        // Ortak aylarda hiç alış yok → payda 0 → null
        assert.equal(sonuc.growth.purchase, null);
    });
});
