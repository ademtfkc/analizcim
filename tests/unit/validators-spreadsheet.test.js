const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { neutralizeSpreadsheetCell } = require('../../src/validators');

describe('validators.neutralizeSpreadsheetCell (Excel formül enjeksiyonu)', () => {
    test('formül karakteriyle başlayan değerlerin başına tırnak eklenir', () => {
        assert.strictEqual(neutralizeSpreadsheetCell('=cmd|calc'), "'=cmd|calc");
        assert.strictEqual(neutralizeSpreadsheetCell('+1+1'), "'+1+1");
        assert.strictEqual(neutralizeSpreadsheetCell('-2+3'), "'-2+3");
        assert.strictEqual(neutralizeSpreadsheetCell('@SUM(A1)'), "'@SUM(A1)");
    });

    test('normal metin değişmez', () => {
        assert.strictEqual(neutralizeSpreadsheetCell('Ocak 2024 satış.xlsx'), 'Ocak 2024 satış.xlsx');
        assert.strictEqual(neutralizeSpreadsheetCell('ABC Ltd. Şti.'), 'ABC Ltd. Şti.');
    });

    test('string olmayan / boş değerler dokunulmadan döner', () => {
        assert.strictEqual(neutralizeSpreadsheetCell(''), '');
        assert.strictEqual(neutralizeSpreadsheetCell(1250), 1250);
        assert.strictEqual(neutralizeSpreadsheetCell(null), null);
        assert.strictEqual(neutralizeSpreadsheetCell(undefined), undefined);
    });
});
