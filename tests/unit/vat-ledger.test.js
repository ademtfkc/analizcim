const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

const { calculateVatLedger } = require('../../public/js/vat-ledger');

describe('VAT carryover ledger', () => {
    test('carries purchase VAT credit into the next payable month', () => {
        const ledger = calculateVatLedger([
            { month: '2024-03', sales_vat: 100000, purchase_vat: 120000 },
            { month: '2024-04', sales_vat: 120000, purchase_vat: 100000 }
        ]);

        assert.equal(ledger.totalPayable, 0);
        assert.equal(ledger.closingCredit, 0);
        assert.deepEqual(ledger.rows.map(row => row.payable), [0, 0]);
        assert.deepEqual(ledger.rows.map(row => row.closingCredit), [20000, 0]);
    });

    test('pays only the amount left after carryover credit is exhausted', () => {
        const ledger = calculateVatLedger([
            { month: '2024-03', sales_vat: 100000, purchase_vat: 120000 },
            { month: '2024-04', sales_vat: 130000, purchase_vat: 100000 }
        ]);

        assert.equal(ledger.totalPayable, 10000);
        assert.equal(ledger.closingCredit, 0);
        assert.equal(ledger.rows[1].openingCredit, 20000);
        assert.equal(ledger.rows[1].payable, 10000);
    });

    test('sorts months chronologically before applying carryover', () => {
        const ledger = calculateVatLedger([
            { month: '2024-04', sales_vat: 120000, purchase_vat: 100000 },
            { month: '2024-03', sales_vat: 100000, purchase_vat: 120000 }
        ]);

        assert.deepEqual(ledger.rows.map(row => row.month), ['2024-03', '2024-04']);
        assert.equal(ledger.totalPayable, 0);
        assert.equal(ledger.closingCredit, 0);
    });

    test('uses opening credit from previous periods', () => {
        const ledger = calculateVatLedger([
            { month: '2025-01', sales_vat: 115000, purchase_vat: 100000 }
        ], { openingCredit: 20000 });

        assert.equal(ledger.rows[0].openingCredit, 20000);
        assert.equal(ledger.rows[0].payable, 0);
        assert.equal(ledger.closingCredit, 5000);
    });
});
