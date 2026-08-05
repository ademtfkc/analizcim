/**
 * Panel (Dashboard) saf hesap fonksiyonları.
 *
 * Neden ayrı dosya: bu fonksiyonlar tarayıcı DOM'una hiç dokunmaz, bu yüzden Node altında
 * doğrudan birim testi yazılabilir. `public/app.js` içindeyken yalnızca "dosyada şu yazıyor mu"
 * tarzı yapısal testler mümkündü ve hesap hataları gözden kaçabiliyordu.
 *
 * `public/js/vat-ledger.js` ile aynı UMD kalıbını kullanır; index.html'de app.js'ten ÖNCE yüklenir.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.DashboardMetrics = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    function toNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function extractYearFromMonth(monthStr) {
        if (!monthStr) return null;
        const match = String(monthStr).match(/^(\d{4})/);
        return match ? parseInt(match[1], 10) : null;
    }

    /** Aylık satır nesnesinden alan okuma (API iki farklı isimlendirme döndürebiliyor). */
    const MONTHLY_FIELD = {
        sales: (m) => m.total_sales ?? m.totalSales ?? 0,
        purchase: (m) => m.total_purchases ?? m.totalPurchases ?? 0,
        gross: (m) => m.gross_profit ?? m.grossProfit ?? 0,
        net: (m) => (m.gross_profit ?? m.grossProfit ?? 0) - (m.expenses || 0)
    };

    /**
     * Brüt kâr KDV HARİÇ hesaplanır (CEO kararı 2026-07-07). Kâr/Zarar tablosu, geçmiş özetleri ve
     * YoY karşılaştırması aynı tabanı kullanır; panel de aynı tabanda kalmalı ki aynı ekranda iki
     * farklı "Net Kâr" görünmesin. KDV kırılımı yoksa tutarlar zaten net kabul edilir.
     */
    function computeVatExclusiveGrossProfit(sales, purchases, salesVat, purchaseVat) {
        const netSales = toNumber(sales) - (Number.isFinite(salesVat) ? salesVat : 0);
        const netPurchases = toNumber(purchases) - (Number.isFinite(purchaseVat) ? purchaseVat : 0);
        return netSales - netPurchases;
    }

    /**
     * Yıllık değişim yüzdesi. Yalnızca İKİ yılda da veri bulunan aylar kıyaslanır; aksi halde
     * 2 aylık bir yıl 12 aylık önceki yılla kıyaslanıp doğru ama anlamsız bir sonuç üretirdi.
     * Kıyas yapılamıyorsa null döner (rozet boş kalır, uydurma sayı gösterilmez).
     */
    function computeYoyDelta(allMonthly, yearStr, valueFn) {
        if (!yearStr || !Array.isArray(allMonthly) || typeof valueFn !== 'function') return null;
        const year = parseInt(yearStr, 10);
        if (!Number.isFinite(year)) return null;

        const totalsByMonth = (target) => {
            const map = new Map();
            for (const row of allMonthly) {
                if (extractYearFromMonth(row.month) !== target) continue;
                const monthPart = String(row.month || '').slice(5, 7);
                if (!monthPart) continue;
                map.set(monthPart, (map.get(monthPart) || 0) + toNumber(valueFn(row)));
            }
            return map;
        };

        const current = totalsByMonth(year);
        const previous = totalsByMonth(year - 1);
        if (current.size === 0 || previous.size === 0) return null;

        let currentSum = 0;
        let previousSum = 0;
        let sharedMonths = 0;
        for (const [monthPart, value] of current) {
            if (!previous.has(monthPart)) continue;
            currentSum += value;
            previousSum += previous.get(monthPart);
            sharedMonths++;
        }

        if (sharedMonths === 0 || previousSum === 0) return null;
        const delta = ((currentSum - previousSum) / Math.abs(previousSum)) * 100;
        return Number.isFinite(delta) ? delta : null;
    }

    /** Mikro grafik (sparkline) polyline noktaları. 2'den az nokta varsa çizim yapılmaz. */
    function buildSparklinePoints(values, width, height) {
        if (!Array.isArray(values) || values.length < 2) return '';
        const nums = values.map(toNumber);
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return '';

        const span = max - min;
        const pad = 3;
        const usable = height - pad * 2;
        const stepX = width / (nums.length - 1);

        return nums.map((value, index) => {
            const x = (index * stepX).toFixed(1);
            // Tüm aylar eşitse çizgi dibe yapışmasın, ortadan düz geçsin
            const y = span === 0
                ? (height / 2).toFixed(1)
                : (height - pad - ((value - min) / span) * usable).toFixed(1);
            return x + ',' + y;
        }).join(' ');
    }

    /** Brüt marjı en yüksek ve en düşük ay. Satışı olmayan aylar (marj tanımsız) atlanır. */
    function findMarginExtremes(monthlyRows) {
        let best = null;
        let worst = null;
        for (const row of (Array.isArray(monthlyRows) ? monthlyRows : [])) {
            const sales = MONTHLY_FIELD.sales(row);
            if (sales <= 0) continue;
            const margin = (MONTHLY_FIELD.gross(row) / sales) * 100;
            if (!Number.isFinite(margin)) continue;
            if (!best || margin > best.margin) best = { month: row.month, margin };
            if (!worst || margin < worst.margin) worst = { month: row.month, margin };
        }
        return { best, worst };
    }

    /** Kâr/zarar toplamları — backend `getMonthlyProfitLoss` ile birebir aynı formüller. */
    function sumProfitLossTotals(months) {
        const totals = { sales: 0, purchases: 0, grossProfit: 0, expenses: 0, netProfit: 0, avgProfitMargin: 0 };
        for (const m of (Array.isArray(months) ? months : [])) {
            totals.sales += toNumber(m.sales);
            totals.purchases += toNumber(m.purchases);
            totals.grossProfit += toNumber(m.grossProfit);
            totals.expenses += toNumber(m.expenses);
            totals.netProfit += toNumber(m.netProfit);
        }
        totals.avgProfitMargin = totals.sales > 0 ? Math.round((totals.netProfit / totals.sales) * 1000) / 10 : 0;
        return totals;
    }

    /**
     * Marj çubuğunun dolgu yüzdesi. %50 marj tam çubuk kabul edilir.
     * Negatif marjda çubuk boş kalır — dolu kırmızı çubuk "iyi" gibi okunurdu.
     */
    function marginBarFill(margin) {
        const value = toNumber(margin);
        return Math.max(0, Math.min(100, Math.round((Math.max(0, value) / 50) * 100)));
    }

    const SUMMARY_AMOUNT_FIELDS = [
        'total_sales', 'totalSales', 'total_purchases', 'totalPurchases', 'total_vat', 'totalVat',
        'gross_profit', 'grossProfit', 'net_profit', 'netProfit', 'total_expenses', 'totalExpenses'
    ];

    /**
     * API veri yokken bile sıfır dolu bir `summary` nesnesi döndürüyor; bu yüzden "summary var mı"
     * yerine "içinde anlamlı bir tutar var mı" diye bakılır. Aksi halde boş panel ekranı hiç görünmezdi.
     */
    function hasMeaningfulSummary(summary) {
        if (!summary || typeof summary !== 'object') return false;
        return SUMMARY_AMOUNT_FIELDS.some(field => Math.abs(toNumber(summary[field])) > 0);
    }

    return {
        MONTHLY_FIELD,
        extractYearFromMonth,
        computeVatExclusiveGrossProfit,
        computeYoyDelta,
        buildSparklinePoints,
        findMarginExtremes,
        sumProfitLossTotals,
        marginBarFill,
        hasMeaningfulSummary
    };
}));
