(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.VatLedger = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    function toNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function monthKey(item) {
        return String(item && item.month ? item.month : '');
    }

    function calculateVatLedger(monthlyRows, options) {
        const rows = Array.isArray(monthlyRows) ? monthlyRows.slice() : [];
        rows.sort((a, b) => monthKey(a).localeCompare(monthKey(b)));

        let creditBalance = Math.max(0, toNumber(options && options.openingCredit));
        let totalPayable = 0;
        let totalSalesVat = 0;
        let totalPurchaseVat = 0;

        const ledger = rows.map(item => {
            const salesVat = toNumber(item.sales_vat ?? item.salesVat);
            const purchaseVat = toNumber(item.purchase_vat ?? item.purchaseVat);
            const monthlyNet = salesVat - purchaseVat;
            const openingCredit = creditBalance;
            let payable = 0;

            totalSalesVat += salesVat;
            totalPurchaseVat += purchaseVat;

            if (monthlyNet > creditBalance) {
                payable = monthlyNet - creditBalance;
                creditBalance = 0;
            } else {
                creditBalance -= monthlyNet;
            }

            totalPayable += payable;

            return {
                month: item.month,
                salesVat,
                purchaseVat,
                monthlyNet,
                openingCredit,
                payable,
                closingCredit: creditBalance
            };
        });

        return {
            rows: ledger,
            totalSalesVat,
            totalPurchaseVat,
            totalPayable,
            closingCredit: creditBalance,
            hasPayable: totalPayable > 0,
            hasClosingCredit: creditBalance > 0
        };
    }

    return {
        calculateVatLedger
    };
}));
