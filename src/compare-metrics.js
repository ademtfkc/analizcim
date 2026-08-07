'use strict';

/**
 * Yıl karşılaştırmasının "ortak ay" kıyası — saf hesap, veritabanı gerektirmez.
 *
 * Neden var: yıllardan biri eksikse (örn. 2025 tam, 2026 altı aylık) yıl toplamlarını
 * kıyaslamak "satış %40 düştü" gibi YANLIŞ bir sonuç üretir, çünkü eksik aylar sıfır sayılır.
 * Panel tarafındaki computeYoyDelta aynı kuralı zaten uyguluyordu; bu, karşılaştırma
 * sayfasının aynı kurala bağlanmış hâlidir.
 *
 * Kâr KDV hariçtir: (satış - satış KDV) - (alış - alış KDV). Gider yıllık tutulduğu için
 * ortak-ay kıyasına dahil EDİLMEZ; bu yüzden dönen alan brüt kârdır, net kâr değil.
 */

function ayHareketliMi(yil, ay) {
    const satir = (yil.monthly || [])[ay - 1];
    if (!satir) return false;
    return (satir.sales || 0) !== 0 || (satir.purchase || 0) !== 0;
}

function hareketliAySayisi(yil) {
    let adet = 0;
    for (let ay = 1; ay <= 12; ay += 1) {
        if (ayHareketliMi(yil, ay)) adet += 1;
    }
    return adet;
}

function ortakAylariBul(y1, y2) {
    const aylar = [];
    for (let ay = 1; ay <= 12; ay += 1) {
        if (ayHareketliMi(y1, ay) && ayHareketliMi(y2, ay)) aylar.push(ay);
    }
    return aylar;
}

function ortakToplam(yil, ortakAylar) {
    const toplam = ortakAylar.reduce((acc, ay) => {
        const satir = yil.monthly[ay - 1];
        acc.sales += satir.sales || 0;
        acc.purchase += satir.purchase || 0;
        acc.salesTax += satir.salesTax || 0;
        acc.purchaseTax += satir.purchaseTax || 0;
        return acc;
    }, { sales: 0, purchase: 0, salesTax: 0, purchaseTax: 0 });
    toplam.profit = (toplam.sales - toplam.salesTax) - (toplam.purchase - toplam.purchaseTax);
    return toplam;
}

function degisimOrani(onceki, sonraki) {
    if (onceki === 0) return null;
    return ((sonraki - onceki) / Math.abs(onceki) * 100).toFixed(1);
}

/**
 * @param {{monthly: Array<{sales:number, purchase:number, salesTax:number, purchaseTax:number}>}} y1
 * @param {{monthly: Array}} y2
 * @returns {{sharedMonths:number[], sharedMonthCount:number, year1MonthCount:number,
 *            year2MonthCount:number, year1:object, year2:object, growth:object}}
 */
function buildComparableSummary(y1, y2) {
    const ortakAylar = ortakAylariBul(y1, y2);
    const o1 = ortakToplam(y1, ortakAylar);
    const o2 = ortakToplam(y2, ortakAylar);
    return {
        sharedMonths: ortakAylar,
        sharedMonthCount: ortakAylar.length,
        year1MonthCount: hareketliAySayisi(y1),
        year2MonthCount: hareketliAySayisi(y2),
        year1: o1,
        year2: o2,
        growth: {
            sales: degisimOrani(o1.sales, o2.sales),
            purchase: degisimOrani(o1.purchase, o2.purchase),
            profit: degisimOrani(o1.profit, o2.profit)
        }
    };
}

module.exports = { buildComparableSummary };
