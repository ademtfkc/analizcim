const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const {
    MONTHLY_FIELD,
    extractYearFromMonth,
    computeVatExclusiveGrossProfit,
    computeYoyDelta,
    buildSparklinePoints,
    findMarginExtremes,
    sumProfitLossTotals,
    marginBarFill,
    hasMeaningfulSummary
} = require('../../public/js/dashboard-metrics');

const month = (m, sales, purchases, salesVat, purchaseVat, expenses = 0) => ({
    month: m,
    total_sales: sales,
    total_purchases: purchases,
    sales_vat: salesVat,
    purchase_vat: purchaseVat,
    gross_profit: computeVatExclusiveGrossProfit(sales, purchases, salesVat, purchaseVat),
    expenses
});

describe('dashboard metrics — brüt kâr KDV hariç', () => {
    test('KDV kırılımı varken satış ve alış KDV hariç tabana çekilir', () => {
        // 1.200 satış (200 KDV) - 600 alış (100 KDV) => 1000 - 500 = 500
        assert.equal(computeVatExclusiveGrossProfit(1200, 600, 200, 100), 500);
    });

    test('KDV kırılımı yoksa tutarlar net kabul edilir, çıkarma yapılmaz', () => {
        assert.equal(computeVatExclusiveGrossProfit(1200, 600, null, null), 600);
        assert.equal(computeVatExclusiveGrossProfit(1200, 600, undefined, undefined), 600);
    });

    test('panel toplamı ile Kâr/Zarar tablosu toplamı aynı sonucu verir', () => {
        // Aynı veri iki yoldan hesaplanınca fark sıfır olmalı (aynı ekranda iki farklı Net Kâr sorunu)
        const rows = [
            month('2025-01', 1_664_200, 778_680, 277_367, 129_780),
            month('2025-02', 1_789_320, 801_360, 298_220, 133_560)
        ];
        const panelNet = rows.reduce((acc, r) => acc + MONTHLY_FIELD.net(r), 0);
        const tabloNet = sumProfitLossTotals(rows.map(r => ({
            sales: r.total_sales,
            purchases: r.total_purchases,
            grossProfit: r.gross_profit,
            expenses: r.expenses,
            netProfit: r.gross_profit - r.expenses
        }))).netProfit;

        assert.equal(panelNet, tabloNet);
    });

    test('giderler net kârdan düşülür', () => {
        const row = month('2025-03', 1000, 400, 0, 0, 150);
        assert.equal(MONTHLY_FIELD.net(row), 450);
    });
});

describe('dashboard metrics — yıllık değişim (YoY)', () => {
    const iki_yil = [
        month('2024-01', 1000, 0, 0, 0),
        month('2024-02', 1000, 0, 0, 0),
        month('2024-03', 1000, 0, 0, 0),
        month('2025-01', 1200, 0, 0, 0),
        month('2025-02', 1200, 0, 0, 0),
        month('2025-03', 1200, 0, 0, 0)
    ];

    test('tam yıl karşılaştırması yüzdeyi doğru verir', () => {
        assert.equal(computeYoyDelta(iki_yil, '2025', MONTHLY_FIELD.sales), 20);
    });

    test('kısmi yıl yalnızca ortak aylarla kıyaslanır', () => {
        // 2026 sadece Ocak; tüm 2025 ile değil, yalnız 2025 Ocak ile kıyaslanmalı
        const veri = [
            month('2025-01', 1000, 0, 0, 0),
            month('2025-02', 1000, 0, 0, 0),
            month('2025-03', 1000, 0, 0, 0),
            month('2026-01', 500, 0, 0, 0)
        ];
        assert.equal(computeYoyDelta(veri, '2026', MONTHLY_FIELD.sales), -50);
    });

    test('önceki yıl verisi yoksa null döner (uydurma yüzde gösterilmez)', () => {
        assert.equal(computeYoyDelta(iki_yil, '2024', MONTHLY_FIELD.sales), null);
    });

    test('ortak ay yoksa null döner', () => {
        const veri = [
            month('2024-01', 1000, 0, 0, 0),
            month('2025-07', 1000, 0, 0, 0)
        ];
        assert.equal(computeYoyDelta(veri, '2025', MONTHLY_FIELD.sales), null);
    });

    test('önceki yıl sıfırsa sonsuza bölme yerine null döner', () => {
        const veri = [
            month('2024-01', 0, 0, 0, 0),
            month('2025-01', 1000, 0, 0, 0)
        ];
        assert.equal(computeYoyDelta(veri, '2025', MONTHLY_FIELD.sales), null);
    });

    test('negatif önceki değerde yön doğru kalır', () => {
        // -100'den -50'ye çıkış: iyileşme, pozitif yüzde
        const veri = [
            { month: '2024-01', gross_profit: -100, expenses: 0 },
            { month: '2025-01', gross_profit: -50, expenses: 0 }
        ];
        assert.equal(computeYoyDelta(veri, '2025', MONTHLY_FIELD.net), 50);
    });

    test('geçersiz girdilerde null döner', () => {
        assert.equal(computeYoyDelta(null, '2025', MONTHLY_FIELD.sales), null);
        assert.equal(computeYoyDelta([], '', MONTHLY_FIELD.sales), null);
        assert.equal(computeYoyDelta([], 'abc', MONTHLY_FIELD.sales), null);
    });
});

describe('dashboard metrics — mikro grafik', () => {
    test('nokta sayısı seriyle aynı ve genişliğe yayılır', () => {
        const points = buildSparklinePoints([1, 2, 3], 300, 34).split(' ');
        assert.equal(points.length, 3);
        assert.equal(points[0].split(',')[0], '0.0');
        assert.equal(points[2].split(',')[0], '300.0');
    });

    test('en yüksek değer üstte, en düşük altta çizilir', () => {
        const [p1, , p3] = buildSparklinePoints([0, 5, 10], 300, 34).split(' ');
        const y1 = parseFloat(p1.split(',')[1]);
        const y3 = parseFloat(p3.split(',')[1]);
        assert.ok(y3 < y1, 'SVG y ekseni ters: büyük değer daha küçük y almalı');
    });

    test('tüm değerler eşitse çizgi dibe yapışmaz, ortadan geçer', () => {
        const points = buildSparklinePoints([7, 7, 7], 300, 34).split(' ');
        for (const p of points) {
            assert.equal(parseFloat(p.split(',')[1]), 17);
        }
    });

    test('iki noktadan az seride çizim yapılmaz', () => {
        assert.equal(buildSparklinePoints([5], 300, 34), '');
        assert.equal(buildSparklinePoints([], 300, 34), '');
        assert.equal(buildSparklinePoints(null, 300, 34), '');
    });
});

describe('dashboard metrics — marj uç değerleri ve çubuk', () => {
    test('en iyi ve en zayıf marj ayı bulunur', () => {
        const rows = [
            month('2025-01', 1000, 500, 0, 0),
            month('2025-02', 1000, 900, 0, 0),
            month('2025-03', 1000, 700, 0, 0)
        ];
        const { best, worst } = findMarginExtremes(rows);
        assert.equal(best.month, '2025-01');
        assert.equal(Math.round(best.margin), 50);
        assert.equal(worst.month, '2025-02');
        assert.equal(Math.round(worst.margin), 10);
    });

    test('satışı olmayan ay marj hesabına girmez', () => {
        const rows = [
            month('2025-01', 0, 0, 0, 0),
            month('2025-02', 1000, 600, 0, 0)
        ];
        const { best, worst } = findMarginExtremes(rows);
        assert.equal(best.month, '2025-02');
        assert.equal(worst.month, '2025-02');
    });

    test('hiç veri yoksa null döner', () => {
        assert.deepEqual(findMarginExtremes([]), { best: null, worst: null });
    });

    test('marj çubuğu: %50 tam dolu, negatif marjda boş', () => {
        assert.equal(marginBarFill(50), 100);
        assert.equal(marginBarFill(25), 50);
        assert.equal(marginBarFill(0), 0);
        assert.equal(marginBarFill(-104.2), 0);
        assert.equal(marginBarFill(80), 100);
    });
});

describe('dashboard metrics — boş panel tespiti', () => {
    test('sıfır dolu summary "veri var" saymaz', () => {
        assert.equal(hasMeaningfulSummary({
            total_sales: 0, total_purchases: 0, total_vat: 0, gross_profit: 0, net_profit: 0
        }), false);
    });

    test('tek bir tutar bile varsa veri var sayılır', () => {
        assert.equal(hasMeaningfulSummary({ total_sales: 0, net_profit: -250 }), true);
    });

    test('summary yoksa veri yok sayılır', () => {
        assert.equal(hasMeaningfulSummary(null), false);
        assert.equal(hasMeaningfulSummary(undefined), false);
    });
});

describe('dashboard metrics — kâr/zarar toplamları', () => {
    test('toplamlar ve ortalama marj backend formülüyle aynı', () => {
        const totals = sumProfitLossTotals([
            { sales: 1000, purchases: 400, grossProfit: 600, expenses: 100, netProfit: 500 },
            { sales: 1000, purchases: 500, grossProfit: 500, expenses: 100, netProfit: 400 }
        ]);
        assert.equal(totals.sales, 2000);
        assert.equal(totals.netProfit, 900);
        assert.equal(totals.avgProfitMargin, 45);
    });

    test('satış sıfırken marj sıfır döner (sonsuza bölme yok)', () => {
        const totals = sumProfitLossTotals([{ sales: 0, purchases: 0, grossProfit: 0, expenses: 50, netProfit: -50 }]);
        assert.equal(totals.avgProfitMargin, 0);
    });

    test('boş liste sıfır toplam döner', () => {
        assert.deepEqual(sumProfitLossTotals([]), {
            sales: 0, purchases: 0, grossProfit: 0, expenses: 0, netProfit: 0, avgProfitMargin: 0
        });
    });
});

describe('dashboard metrics — yardımcılar', () => {
    test('ay anahtarından yıl çıkarılır', () => {
        assert.equal(extractYearFromMonth('2025-03'), 2025);
        assert.equal(extractYearFromMonth(''), null);
        assert.equal(extractYearFromMonth(null), null);
    });
});
