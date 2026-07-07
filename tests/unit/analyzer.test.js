const { test, describe } = require('node:test');
const assert = require('node:assert');
const XLSX = require('xlsx');
const {
    analyzeFiles,
    parseExcelWithColumnMap,
    normalizeDataByColumns,
    buildRows,
    calculateSummary,
    parseExcel,
    normalizeData,
    calculateAnalysis,
    findColumn,
    letterToIndex,
    safeNum,
    parseNumber,
    toISODate,
    detectPeriod,
    generateSummary: generateAnalysisSummary,
    formatCurrency,
    dedupeBuffersByContent
} = require('../../src/analyzer');

// Helper: Create a simple Excel buffer with test data
function createExcelBuffer(data, headers) {
    const sheetData = [headers, ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

describe('analyzer.js - letterToIndex', () => {
    test('should convert A to 0', () => {
        assert.strictEqual(letterToIndex('A'), 0);
    });

    test('should convert Z to 25', () => {
        assert.strictEqual(letterToIndex('Z'), 25);
    });

    test('should convert lowercase a to 0', () => {
        assert.strictEqual(letterToIndex('a'), 0);
    });

    test('should return -1 for invalid input', () => {
        assert.strictEqual(letterToIndex(''), -1);
        assert.strictEqual(letterToIndex(null), -1);
        assert.strictEqual(letterToIndex('AA'), -1);
    });
});

describe('analyzer.js - parseNumber', () => {
    test('should parse integer', () => {
        assert.strictEqual(parseNumber('1000'), 1000);
    });

    test('should parse float with dot', () => {
        assert.strictEqual(parseNumber('1000.50'), 1000.5);
    });

    test('should parse Turkish format (comma decimal)', () => {
        assert.strictEqual(parseNumber('1000,50'), 1000.5);
    });

    test('should handle currency symbols', () => {
        assert.strictEqual(parseNumber('₺1000'), 1000);
        assert.strictEqual(parseNumber('$1000'), 1000);
        assert.strictEqual(parseNumber('€1000'), 1000);
    });

    test('should handle thousand separators', () => {
        assert.strictEqual(parseNumber('1.000'), 1000);
        assert.strictEqual(parseNumber('1.000.000'), 1000000);
    });

    test('should return 0 for invalid input', () => {
        assert.strictEqual(parseNumber(''), 0);
        assert.strictEqual(parseNumber(null), 0);
        assert.strictEqual(parseNumber('abc'), 0);
    });

    test('should return number as-is', () => {
        assert.strictEqual(parseNumber(1000), 1000);
        assert.strictEqual(parseNumber(0), 0);
    });
});

describe('analyzer.js - safeNum', () => {
    test('should return number for valid number', () => {
        assert.strictEqual(safeNum(100), 100);
    });

    test('should return 0 for invalid input', () => {
        assert.strictEqual(safeNum('abc'), 0);
        assert.strictEqual(safeNum(null), 0);
        assert.strictEqual(safeNum(undefined), 0);
    });

    test('should parse string numbers', () => {
        assert.strictEqual(safeNum('100'), 100);
    });
});

describe('analyzer.js - toISODate', () => {
    test('should parse DD.MM.YYYY format', () => {
        const result = toISODate('15.03.2024');
        assert.ok(result);
        assert.ok(result.includes('2024-03-15'));
    });

    test('should parse DD/MM/YYYY format', () => {
        const result = toISODate('15/03/2024');
        assert.ok(result);
        assert.ok(result.includes('2024-03-15'));
    });

    test('should parse YYYY-MM-DD format', () => {
        const result = toISODate('2024-03-15');
        assert.ok(result);
        assert.ok(result.includes('2024-03-15'));
    });

    test('should parse Excel serial date', () => {
        // Excel serial date for 2024-03-15 is around 45377
        const result = toISODate(45377);
        assert.ok(result);
    });

    test('should return null for invalid input', () => {
        assert.strictEqual(toISODate(''), null);
        assert.strictEqual(toISODate(null), null);
        assert.strictEqual(toISODate('invalid'), null);
    });
});

describe('analyzer.js - findColumn', () => {
    const headers = ['Tarih', 'Firma Unvanı', 'Ara Toplam', 'Toplam KDV', 'Genel Toplam'];

    test('should find exact match', () => {
        const result = findColumn(headers, ['tarih', 'date']);
        assert.strictEqual(result, 'Tarih');
    });

    test('should find partial match', () => {
        const result = findColumn(headers, ['unvan', 'firma']);
        assert.strictEqual(result, 'Firma Unvanı');
    });

    test('should skip claimed columns', () => {
        const claimed = new Set(['Firma Unvanı']);
        const result = findColumn(headers, ['unvan', 'firma'], claimed);
        assert.notStrictEqual(result, 'Firma Unvanı');
    });

    test('should return null when not found', () => {
        const result = findColumn(headers, ['nonexistent']);
        assert.strictEqual(result, null);
    });
});

describe('analyzer.js - parseExcelWithColumnMap', () => {
    test('should parse valid Excel buffer', () => {
        const buffer = createExcelBuffer(
            [
                ['15.01.2024', 'Firma A', 1000, 180, 1180],
                ['16.01.2024', 'Firma B', 2000, 360, 2360]
            ],
            ['Date', 'Company', 'Net', 'VAT', 'Gross']
        );

        const result = parseExcelWithColumnMap(buffer, 'sales');
        assert.ok(result);
        assert.ok(result.length >= 2);
    });

    test('should return null for null buffer', () => {
        const result = parseExcelWithColumnMap(null, 'sales');
        assert.strictEqual(result, null);
    });

    test('should throw for invalid Excel', () => {
        assert.throws(() => {
            parseExcelWithColumnMap(Buffer.from('invalid'), 'sales');
        });
    });
});

describe('analyzer.js - normalizeDataByColumns', () => {
    test('should normalize data with column map', () => {
        const rows = [
            ['Date', 'Company', 'Net', 'VAT', 'Gross'],
            ['15.01.2024', 'Firma A', 1000, 180, 1180],
            ['16.01.2024', 'Firma B', 2000, 360, 2360]
        ];
        // Test with custom column map matching the data layout
        const columnMap = { date: 'A', counterparty: 'B', net: 'C', vat: 'D', gross: 'E' };
        const result = normalizeDataByColumns(rows, 'sales', columnMap);
        assert.ok(Array.isArray(result));
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].net, 1000);
        assert.strictEqual(result[0].vat, 180);
        assert.strictEqual(result[0].gross, 1180);
    });

    test('should return empty array for invalid input', () => {
        const result = normalizeDataByColumns([], 'sales');
        assert.deepStrictEqual(result, []);
    });

    test('should derive VAT from gross - net', () => {
        const rows = [
            ['Date', 'Company', 'Net', 'VAT', 'Gross'],
            ['15.01.2024', 'Firma A', 1000, 0, 1180]
        ];
        // Test with custom column map matching the data layout
        const columnMap = { date: 'A', counterparty: 'B', net: 'C', vat: 'D', gross: 'E' };
        const result = normalizeDataByColumns(rows, 'sales', columnMap);
        assert.strictEqual(result[0].vat, 180);
    });

    test('should derive gross from net + VAT', () => {
        const rows = [
            ['Date', 'Company', 'Net', 'VAT', 'Gross'],
            ['15.01.2024', 'Firma A', 1000, 180, 0]
        ];
        // Test with custom column map matching the data layout
        const columnMap = { date: 'A', counterparty: 'B', net: 'C', vat: 'D', gross: 'E' };
        const result = normalizeDataByColumns(rows, 'sales', columnMap);
        assert.strictEqual(result[0].gross, 1180);
    });

    test('should filter rows with zero net and gross', () => {
        const rows = [
            ['Date', 'Company', 'Net', 'VAT', 'Gross'],
            ['15.01.2024', 'Firma A', 0, 0, 0]
        ];

        const result = normalizeDataByColumns(rows, 'sales');
        assert.strictEqual(result.length, 0);
    });
});

describe('analyzer.js - counterparty header precedence', () => {
    test('should prefer Cari Ünvanı over Açıklama when default sales amount columns are populated', () => {
        const buffer = createExcelBuffer(
            [
                ['15.01.2024', 'Acme Müşteri AŞ', 'Perakende satış açıklaması', '', '', '', '', '', 1000, '', 200, 1200],
                ['16.01.2024', 'Beta Müşteri Ltd', 'Servis açıklaması', '', '', '', '', '', 500, '', 100, 600]
            ],
            ['Tarih', 'Cari Ünvanı', 'Açıklama', 'D', 'E', 'F', 'G', 'H', 'Ara Toplam', 'J', 'Toplam KDV', 'Genel Toplam']
        );

        const result = analyzeFiles(buffer, null);

        assert.deepStrictEqual(result.rows.map(row => row.counterparty), ['Acme Müşteri AŞ', 'Beta Müşteri Ltd']);
    });

    test('should prefer Tedarikçi over Açıklama when default purchase amount columns are populated', () => {
        const buffer = createExcelBuffer(
            [
                ['15.01.2024', 'Kırtasiye açıklaması', '', 'Delta Tedarik AŞ', '', '', '', 700, '', 140, 840],
                ['16.01.2024', 'Lojistik açıklaması', '', 'Omega Tedarik Ltd', '', '', '', 300, '', 60, 360]
            ],
            ['Tarih', 'Açıklama', 'C', 'Tedarikçi', 'E', 'F', 'G', 'Ara Toplam', 'I', 'Toplam KDV', 'Genel Toplam']
        );

        const result = analyzeFiles(null, buffer);

        assert.deepStrictEqual(result.rows.map(row => row.counterparty), ['Delta Tedarik AŞ', 'Omega Tedarik Ltd']);
    });
});

describe('analyzer.js - buildRows', () => {
    test('should build rows from normalized data', () => {
        const normalizedData = [
            {
                date: '2024-01-15',
                net: 1000,
                vat: 180,
                gross: 1180,
                counterparty: 'Firma A',
                product: 'Product A'
            },
            {
                date: '2024-01-16',
                net: 2000,
                vat: 360,
                gross: 2360,
                counterparty: 'Firma B',
                product: 'Product B'
            }
        ];

        const result = buildRows(normalizedData, 'sales');
        assert.ok(Array.isArray(result));
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].type, 'sales');
        assert.strictEqual(result[0].net, 1000);
        assert.strictEqual(result[0].vat, 180);
        assert.strictEqual(result[0].gross, 1180);
    });

    test('should filter rows with zero values', () => {
        const normalizedData = [
            {
                date: '2024-01-15',
                net: 0,
                vat: 0,
                gross: 0,
                counterparty: 'Firma A'
            }
        ];

        const result = buildRows(normalizedData, 'sales');
        assert.strictEqual(result.length, 0);
    });

    test('should use net as gross when gross is 0', () => {
        const normalizedData = [
            {
                date: '2024-01-15',
                net: 1000,
                vat: 180,
                gross: 0,
                counterparty: 'Firma A'
            }
        ];

        const result = buildRows(normalizedData, 'sales');
        assert.strictEqual(result[0].gross, 1180);
    });
});

describe('analyzer.js - calculateSummary', () => {
    test('should calculate summary for sales and purchases', () => {
        const rows = [
            { type: 'sales', gross: 10000, vat: 1800 },
            { type: 'sales', gross: 15000, vat: 2700 },
            { type: 'purchase', gross: 8000, vat: 1440 },
            { type: 'purchase', gross: 6000, vat: 1080 }
        ];

        const result = calculateSummary(rows);
        assert.strictEqual(result.total_sales, 25000);
        assert.strictEqual(result.total_purchases, 14000);
        assert.strictEqual(result.total_vat, 1800 + 2700 + 1440 + 1080);
        // Brüt kâr KDV hariç: (satış net) - (alış net)
        // sales net: (10000-1800)+(15000-2700)=20500 ; purchase net: (8000-1440)+(6000-1080)=11480
        assert.strictEqual(result.gross_profit, 9020);
    });

    test('should handle empty array', () => {
        const result = calculateSummary([]);
        assert.strictEqual(result.total_sales, 0);
        assert.strictEqual(result.total_purchases, 0);
        assert.strictEqual(result.total_vat, 0);
        assert.strictEqual(result.gross_profit, 0);
    });
});

describe('analyzer.js - detectPeriod', () => {
    test('should detect single month period', () => {
        const rows = [
            { date: '2024-01-15T00:00:00.000Z' },
            { date: '2024-01-20T00:00:00.000Z' }
        ];

        const result = detectPeriod(rows);
        assert.strictEqual(result, '2024-01');
    });

    test('should detect multi-month period', () => {
        const rows = [
            { date: '2024-01-15T00:00:00.000Z' },
            { date: '2024-03-20T00:00:00.000Z' }
        ];

        const result = detectPeriod(rows);
        assert.strictEqual(result, '2024-01/2024-03');
    });

    test('should return null for empty array', () => {
        const result = detectPeriod([]);
        assert.strictEqual(result, null);
    });

    test('should handle rows without date', () => {
        const rows = [
            { date: null },
            { date: '2024-01-20T00:00:00.000Z' }
        ];

        const result = detectPeriod(rows);
        assert.strictEqual(result, '2024-01');
    });
});

describe('analyzer.js - formatCurrency', () => {
    test('should format currency in Turkish format', () => {
        const result = formatCurrency(1000);
        assert.ok(result.includes('1.000') || result.includes('1000'));
    });
});

describe('analyzer.js - parseExcel', () => {
    test('should parse Excel to JSON', () => {
        const buffer = createExcelBuffer(
            [
                ['Firma A', 1000],
                ['Firma B', 2000]
            ],
            ['Company', 'Amount']
        );

        const result = parseExcel(buffer);
        assert.ok(Array.isArray(result));
        assert.strictEqual(result.length, 2);
    });

    test('should return null for null buffer', () => {
        const result = parseExcel(null);
        assert.strictEqual(result, null);
    });
});

describe('analyzer.js - normalizeData', () => {
    test('should normalize data with header mapping', () => {
        const data = [
            { 'Tarih': '15.01.2024', 'Firma': 'Firma A', 'Net': 1000, 'KDV': 180, 'Toplam': 1180 },
            { 'Tarih': '16.01.2024', 'Firma': 'Firma B', 'Net': 2000, 'KDV': 360, 'Toplam': 2360 }
        ];

        const result = normalizeData(data);
        assert.ok(Array.isArray(result));
        assert.strictEqual(result.length, 2);
        assert.strictEqual(result[0].net, 1000);
        assert.strictEqual(result[0].vat, 180);
        assert.strictEqual(result[0].gross, 1180);
    });

    test('should return empty array for empty input', () => {
        const result = normalizeData([]);
        assert.deepStrictEqual(result, []);
    });
});

describe('analyzer.js - calculateAnalysis', () => {
    test('should calculate analysis for data', () => {
        const data = [
            { total: 1000, quantity: 10, tax: 180, subtotal: 820, discount: 0, product: 'Product A' },
            { total: 2000, quantity: 20, tax: 360, subtotal: 1640, discount: 0, product: 'Product B' }
        ];

        const result = calculateAnalysis(data, 'sales');
        assert.ok(result);
        assert.strictEqual(result.type, 'sales');
        assert.strictEqual(result.totalAmount, 3000);
        assert.strictEqual(result.totalQuantity, 30);
        assert.strictEqual(result.totalTax, 540);
        assert.strictEqual(result.itemCount, 2);
    });

    test('should return null for empty data', () => {
        const result = calculateAnalysis([], 'sales');
        assert.strictEqual(result, null);
    });

    test('should calculate top products', () => {
        const data = [
            { total: 1000, quantity: 10, tax: 180, subtotal: 820, discount: 0, product: 'Product A' },
            { total: 2000, quantity: 20, tax: 360, subtotal: 1640, discount: 0, product: 'Product B' },
            { total: 3000, quantity: 30, tax: 540, subtotal: 2460, discount: 0, product: 'Product A' }
        ];

        const result = calculateAnalysis(data, 'sales');
        assert.ok(result.topProducts);
        assert.strictEqual(result.topProducts[0].name, 'Product A');
        assert.strictEqual(result.topProducts[0].total, 4000);
    });
});

describe('analyzer.js - generateSummary', () => {
    test('should generate summary with both sales and purchase', () => {
        const salesAnalysis = {
            totalAmount: 10000,
            totalTax: 1800,
            topProducts: [{ name: 'Firma A', total: 5000 }]
        };
        const purchaseAnalysis = {
            totalAmount: 6000,
            totalTax: 1080,
            topProducts: [{ name: 'Tedarikci A', total: 3000 }]
        };

        const result = generateAnalysisSummary(salesAnalysis, purchaseAnalysis);
        assert.ok(result);
        assert.ok(result.includes('satış'));
        assert.ok(result.includes('alış'));
    });

    test('should generate summary with only sales', () => {
        const salesAnalysis = {
            totalAmount: 10000,
            totalTax: 1800,
            topProducts: [{ name: 'Firma A', total: 5000 }]
        };

        const result = generateAnalysisSummary(salesAnalysis, null);
        assert.ok(result);
        assert.ok(result.includes('satış'));
    });

    test('should generate summary with only purchase', () => {
        const purchaseAnalysis = {
            totalAmount: 6000,
            totalTax: 1080,
            topProducts: [{ name: 'Tedarikci A', total: 3000 }]
        };

        const result = generateAnalysisSummary(null, purchaseAnalysis);
        assert.ok(result);
        assert.ok(result.includes('alış'));
    });
});

describe('analyzer.js - dedupeBuffersByContent (mükerrer dosya)', () => {
    test('aynı içerikli iki buffer tek sayılır', () => {
        const a = Buffer.from('aynı içerik satış 100');
        const b = Buffer.from('aynı içerik satış 100');
        const result = dedupeBuffersByContent([a, b]);
        assert.strictEqual(result.length, 1);
    });

    test('farklı içerikli bufferlar korunur', () => {
        const a = Buffer.from('dosya A');
        const b = Buffer.from('dosya B');
        const result = dedupeBuffersByContent([a, b]);
        assert.strictEqual(result.length, 2);
    });

    test('null/boş girdi güvenli', () => {
        assert.deepStrictEqual(dedupeBuffersByContent(null), []);
        assert.deepStrictEqual(dedupeBuffersByContent([]), []);
    });
});
