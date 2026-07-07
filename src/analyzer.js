const XLSX = require('xlsx');
const crypto = require('crypto');

// Sadece belirtilen sütunlar okunur; diğer sütunlar yok sayılır. İlk satır başlık, veri 2. satırdan.
const COLUMN_LETTER_MAP = {
    sales: {
        date: 'A',
        counterparty: 'C',
        net: 'I',
        vat: 'K',
        gross: 'L'
    },
    purchase: {
        date: 'A',
        counterparty: 'B',
        net: 'H',
        vat: 'J',
        gross: 'K'
    }
};

/** Excel sütun harfi -> 0 tabanlı indeks (A=0, B=1, ..., Z=25) */
function letterToIndex(letter) {
    if (!letter || typeof letter !== 'string') return -1;
    const trimmed = letter.trim();
    if (trimmed.length !== 1) return -1;  // Only single characters allowed
    const c = trimmed.toUpperCase().charCodeAt(0);
    return c >= 65 && c <= 90 ? c - 65 : -1;
}

// Normalize helper: lowercase, strip Türkçe diacritics, collapse whitespace/underscores
const _norm = s => String(s || '').toLowerCase().trim()
    .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ı/g, 'i')
    .replace(/ğ/g, 'g').replace(/ş/g, 's').replace(/ç/g, 'c')
    .replace(/[_\s]+/g, ' ');

// Column mappings — order matters: most specific first
// findColumn uses EXACT-then-PARTIAL, so longer/more-specific names must come first
const COLUMN_MAPPINGS = {
    date: ['tarih', 'date', 'ay', 'gun'],
    counterparty: [
        'musteri adi', 'musteri unvani', 'musteri',
        'cari adi', 'cari unvan', 'cari hesap', 'cari',
        'tedarikci adi', 'tedarikci unvani', 'tedarikci',
        'firma unvani', 'firma unvanı', 'unvan', 'firma',
        'urun', 'urun adi', 'aciklama', 'product', 'kalem', 'mal', 'hizmet'
    ],
    quantity: ['miktar', 'adet', 'quantity', 'qty', 'birim', 'sayi'],
    unitPrice: ['birim fiyat', 'fiyat', 'price', 'unit price'],
    discount: ['iskonto toplam', 'iskonto', 'indirim', 'discount'],
    // net = Ara Toplam (subtotal / matrah)
    net: ['ara toplam', 'aratoplam', 'subtotal', 'net', 'matrah'],
    // vat = Toplam KDV
    vat: ['toplam kdv', 'toplamkdv', 'kdv tutari', 'kdv', 'vergi', 'tax', 'vat', 'vat amount'],
    // gross = Genel Toplam
    gross: ['genel toplam', 'geneltoplam', 'brut', 'toplam tutar', 'toplam', 'total', 'tutar', 'amount']
};

const REPORT_TYPE_KEYWORDS = {
    sales: ['satış', 'satis', 'sale', 'fatura', 'müşteri', 'musteri', 'ciro'],
    purchase: ['alış', 'alis', 'alim', 'alım', 'tedarik', 'gider', 'vendor', 'supplier']
};

const SHEET_NAME_KEYWORDS = {
    sales: ['satış', 'satis', 'sales'],
    purchase: ['alış', 'alis', 'purchase']
};

function hasMeaningfulCell(row) {
    return Array.isArray(row) && row.some(cell => String(cell || '').trim() !== '');
}

function countDataRows(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return 0;
    return rows.slice(1).filter(hasMeaningfulCell).length;
}

function sheetNameMatchesReportType(sheetName, reportType) {
    const keywords = SHEET_NAME_KEYWORDS[reportType] || [];
    const normalizedName = _norm(sheetName);
    return keywords.some(keyword => normalizedName.includes(_norm(keyword)));
}

function selectWorksheet(workbook, reportType) {
    if (!workbook || !Array.isArray(workbook.SheetNames) || workbook.SheetNames.length === 0) {
        return { sheetName: null, worksheet: null, rows: [] };
    }

    const candidates = workbook.SheetNames.map((sheetName, index) => {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        return {
            sheetName,
            worksheet,
            rows,
            index,
            dataRows: countDataRows(rows),
            nameMatches: sheetNameMatchesReportType(sheetName, reportType)
        };
    });

    const preferredCandidates = candidates.filter(candidate => candidate.nameMatches);
    const pool = preferredCandidates.length > 0 ? preferredCandidates : candidates;
    const selected = pool.reduce((best, current) => {
        if (!best) return current;
        if (current.dataRows > best.dataRows) return current;
        if (current.dataRows === best.dataRows && current.index < best.index) return current;
        return best;
    }, null);

    return selected || candidates[0];
}

function detectDelimiter(firstLine) {
    return String(firstLine || '').includes('\t') ? '\t' : ',';
}

function getFirstNonEmptyRow(rows) {
    return Array.isArray(rows) ? rows.find(hasMeaningfulCell) || null : null;
}

function scoreReportTypeHeader(headerRow, reportType) {
    const keywords = REPORT_TYPE_KEYWORDS[reportType] || [];
    const normalizedHeader = Array.isArray(headerRow)
        ? _norm(headerRow.join(' '))
        : _norm(headerRow);
    return keywords.reduce((score, keyword) => {
        return normalizedHeader.includes(_norm(keyword)) ? score + 1 : score;
    }, 0);
}

function detectReportTypeFromRows(rows) {
    const headerRow = getFirstNonEmptyRow(rows);
    if (!headerRow) return null;
    const salesScore = scoreReportTypeHeader(headerRow, 'sales');
    const purchaseScore = scoreReportTypeHeader(headerRow, 'purchase');
    if (salesScore > purchaseScore) return 'sales';
    if (purchaseScore > salesScore) return 'purchase';
    return null;
}

function rowsFromBuffer(buffer) {
    if (!buffer) return null;
    if (isDelimitedTextBuffer(buffer)) return parseCsv(buffer);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return selectWorksheet(workbook, null).rows;
}

/**
 * Find matching column name in headers.
 * Two passes: exact match across all candidates first, then partial (includes).
 * Uses _norm which strips Turkish diacritics + collapses whitespace/underscore.
 * @param {string[]} headers - original header strings
 * @param {string[]} possibleNames - candidate names, most specific first
 * @param {Set<string>} [claimed] - optional set of already-claimed original header strings to skip
 */
function findColumn(headers, possibleNames, claimed) {
    const normalizedHeaders = headers.map(_norm);

    // Pass 1: exact match (most specific wins because possibleNames is ordered)
    for (const name of possibleNames) {
        const target = _norm(name);
        const idx = normalizedHeaders.findIndex((h, i) => h === target && !(claimed && claimed.has(headers[i])));
        if (idx !== -1) return headers[idx];
    }
    // Pass 2: partial (includes) — only if no exact match found
    for (const name of possibleNames) {
        const target = _norm(name);
        const idx = normalizedHeaders.findIndex((h, i) => h.includes(target) && !(claimed && claimed.has(headers[i])));
        if (idx !== -1) return headers[idx];
    }
    return null;
}

function findCounterpartyColumn(headers, claimed) {
    const fallbackNames = new Set(['urun', 'urun adi', 'aciklama', 'product', 'kalem', 'mal', 'hizmet']);
    const preferredNames = COLUMN_MAPPINGS.counterparty.filter(name => !fallbackNames.has(_norm(name)));
    const genericNames = COLUMN_MAPPINGS.counterparty.filter(name => fallbackNames.has(_norm(name)));
    return findColumn(headers, preferredNames, claimed) || findColumn(headers, genericNames, claimed);
}

/**
 * Parse Excel buffer to array of rows (first row = headers, rest = data).
 * Sadece sütun haritasındaki sütunlar kullanılır; diğer sütunlar okunmaz.
 */
function parseExcelWithColumnMap(buffer, reportType, customMap) {
    if (!buffer) return null;
    const map = { ...(COLUMN_LETTER_MAP[reportType] || {}), ...(customMap || {}) };
    if (!map) return null;
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const { rows } = selectWorksheet(workbook, reportType);
        if (!rows || rows.length < 2) {
            throw new Error('Excel dosyası boş veya yalnızca başlık satırı var.');
        }
        return rows;
    } catch (error) {
        throw new Error(`Excel dosyası işlenirken hata: ${error.message}`);
    }
}

/**
 * Parse CSV buffer to array of rows (first row = headers, rest = data).
 */
function parseCsv(buffer) {
    if (!buffer) return null;
    try {
        const text = buffer.toString('utf-8');
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
            throw new Error('CSV dosyası boş veya yalnızca başlık satırı var.');
        }
        const delimiter = detectDelimiter(lines[0]);

        // Parse CSV/TSV line by line, handling quoted fields
        const parseLine = (line) => {
            const result = [];
            let current = '';
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === delimiter && !inQuotes) {
                    result.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current.trim());
            return result;
        };
        const rows = lines.map(parseLine);
        return rows;
    } catch (error) {
        throw new Error(`CSV dosyası işlenirken hata: ${error.message}`);
    }
}

/**
 * Parse CSV buffer with column map (similar to parseExcelWithColumnMap).
 */
function parseCsvWithColumnMap(buffer, _reportType, _customMap) {
    return parseCsv(buffer);
}

/**
 * Sütun haritasına göre satır dizilerini normalize eder. Sadece haritada tanımlı sütunlar okunur.
 * İlk satır başlık atlanır, veri 2. satırdan başlar.
 */
function normalizeDataByColumns(rows, reportType, customMap) {
    if (!rows || rows.length < 2) return [];
    const map = { ...(COLUMN_LETTER_MAP[reportType] || {}), ...(customMap || {}) };
    if (!map) return [];
    const indices = {};
    for (const [field, letter] of Object.entries(map)) {
        const idx = letterToIndex(letter);
        if (idx >= 0) indices[field] = idx;
    }
    const dataRows = rows.slice(1);
    return dataRows.map(row => {
        const get = (field) => {
            const idx = indices[field];
            return idx >= 0 && Array.isArray(row) && idx < row.length ? row[idx] : (field === 'date' || field === 'counterparty' ? '' : 0);
        };
        let net = safeNum(get('net'));
        let vat = safeNum(get('vat'));
        let gross = safeNum(get('gross'));
        if (vat === 0 && net > 0 && gross > 0) {
            const derived = gross - net;
            vat = Number.isFinite(derived) && derived >= 0 ? derived : 0;
        }
        if (gross === 0 && net > 0 && vat > 0) {
            gross = net + vat;
        }
        if (net === 0 && gross === 0) return null;
        const dateVal = get('date');
        const counterpartyVal = get('counterparty');
        return {
            date: dateVal != null ? String(dateVal).trim() : '',
            product: counterpartyVal != null && String(counterpartyVal).trim() ? String(counterpartyVal).trim() : 'Bilinmeyen',
            counterparty: counterpartyVal != null && String(counterpartyVal).trim() ? String(counterpartyVal).trim() : 'Bilinmeyen',
            quantity: 0,
            unitPrice: 0,
            discount: 0,
            subtotal: net,
            tax: vat,
            total: gross,
            net,
            vat,
            gross
        };
    }).filter(row => row !== null);
}

/**
 * Parse Excel buffer to JSON (başlık adına göre eşleme; eski davranış)
 */
function parseExcel(buffer) {
    if (!buffer) return null;

    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const { worksheet } = selectWorksheet(workbook, null);
        const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (data.length === 0) {
            throw new Error('Excel dosyası boş veya okunamadı.');
        }

        return data;
    } catch (error) {
        throw new Error(`Excel dosyası işlenirken hata: ${error.message}`);
    }
}

/**
 * Normalize and map data columns.
 * Produces rows with: date, counterparty, quantity, unitPrice, discount, net, vat, gross
 */
function normalizeData(data) {
    if (!data || data.length === 0) return [];

    const headers = Object.keys(data[0]);

    // Claim columns in order: most-specific financial columns first so
    // "Toplam KDV" is claimed by vat before gross can grab it via partial "toplam"
    const claimed = new Set();

    const col = {};
    col.date = findColumn(headers, COLUMN_MAPPINGS.date, claimed);
    if (col.date) claimed.add(col.date);

    col.counterparty = findCounterpartyColumn(headers, claimed);
    if (col.counterparty) claimed.add(col.counterparty);

    col.quantity = findColumn(headers, COLUMN_MAPPINGS.quantity, claimed);
    if (col.quantity) claimed.add(col.quantity);

    col.unitPrice = findColumn(headers, COLUMN_MAPPINGS.unitPrice, claimed);
    if (col.unitPrice) claimed.add(col.unitPrice);

    col.discount = findColumn(headers, COLUMN_MAPPINGS.discount, claimed);
    if (col.discount) claimed.add(col.discount);

    // Financial columns — claim order matters:
    // 1) net (Ara Toplam) — most specific
    col.net = findColumn(headers, COLUMN_MAPPINGS.net, claimed);
    if (col.net) claimed.add(col.net);

    // 2) vat (Toplam KDV) — before gross, so "Toplam KDV" doesn't get stolen by "toplam" partial in gross
    col.vat = findColumn(headers, COLUMN_MAPPINGS.vat, claimed);
    if (col.vat) claimed.add(col.vat);

    // 3) gross (Genel Toplam) — last
    col.gross = findColumn(headers, COLUMN_MAPPINGS.gross, claimed);
    if (col.gross) claimed.add(col.gross);

    return data.map(row => {
        let net = col.net ? safeNum(row[col.net]) : 0;
        let vat = col.vat ? safeNum(row[col.vat]) : 0;
        let gross = col.gross ? safeNum(row[col.gross]) : 0;
        const discount = col.discount ? safeNum(row[col.discount]) : 0;

        // --- Derivation rules ---
        // If vat missing but net & gross present: vat = gross - net
        if (vat === 0 && net > 0 && gross > 0) {
            const derived = gross - net;
            vat = Number.isFinite(derived) && derived >= 0 ? derived : 0;
        }
        // If gross missing but net & vat present: gross = net + vat
        if (gross === 0 && net > 0 && vat > 0) {
            const derived = net + vat;
            gross = Number.isFinite(derived) ? derived : 0;
        }
        // Legacy fallback: quantity * unitPrice if no gross and no net
        if (gross === 0 && net === 0 && col.quantity && col.unitPrice) {
            const qty = safeNum(row[col.quantity]);
            const price = safeNum(row[col.unitPrice]);
            if (qty > 0 && price > 0) {
                gross = qty * price;
            }
        }

        // Drop row if both net and gross are 0
        if (net === 0 && gross === 0) return null;

        return {
            date: col.date ? row[col.date] : '',
            product: col.counterparty ? String(row[col.counterparty]).trim() : 'Bilinmeyen',
            counterparty: col.counterparty ? String(row[col.counterparty]).trim() : 'Bilinmeyen',
            quantity: col.quantity ? safeNum(row[col.quantity]) : 0,
            unitPrice: col.unitPrice ? safeNum(row[col.unitPrice]) : 0,
            discount: discount,
            // Keep legacy aliases so calculateAnalysis still works
            subtotal: net,
            tax: vat,
            total: gross,
            // New canonical names
            net,
            vat,
            gross
        };
    }).filter(row => row !== null);
}

function rowsToHeaderObjects(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return [];
    const headerIndex = rows.findIndex(hasMeaningfulCell);
    if (headerIndex < 0) return [];
    const headers = (rows[headerIndex] || []).map((cell, index) => {
        const header = String(cell || '').trim();
        return header || `Column ${index + 1}`;
    });

    return rows.slice(headerIndex + 1)
        .filter(hasMeaningfulCell)
        .map(row => headers.reduce((obj, header, index) => {
            obj[header] = Array.isArray(row) && index < row.length ? row[index] : '';
            return obj;
        }, {}));
}

function normalizeDataByHeaders(rows) {
    return normalizeData(rowsToHeaderObjects(rows));
}

function hasNamedCounterparty(data) {
    return Array.isArray(data) && data.some(row => {
        const name = String(row?.counterparty || '').trim();
        return name && _norm(name) !== 'bilinmeyen';
    });
}

function normalizeDataWithHeaderPreference(rows, reportType, customMap) {
    if (customMap) return normalizeDataByColumns(rows, reportType, customMap);

    const headerData = normalizeDataByHeaders(rows);
    if (!isEmptyNormalizedData(headerData) && hasNamedCounterparty(headerData)) {
        return headerData;
    }

    const columnData = normalizeDataByColumns(rows, reportType, null);
    return isEmptyNormalizedData(columnData) && !isEmptyNormalizedData(headerData) ? headerData : columnData;
}

/**
 * Parse number safely; always returns a finite number (0 on failure).
 */
function safeNum(value) {
    const n = parseNumber(value);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Parse number from various formats
 */
function parseNumber(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;

    // Remove currency symbols, spaces
    let cleaned = String(value).replace(/[₺$€£\s]/g, '');

    // Muhasebe formatı: parantez içi tutar negatiftir → (1.234,56) = -1234.56
    // (iade/alacak dekontu). Bu yakalanmazsa satır 0'a düşüp sessizce kaybolur.
    let negative = false;
    if (/^\(.*\)$/.test(cleaned)) {
        negative = true;
        cleaned = cleaned.slice(1, -1);
    }
    // Sondaki eksi işareti de negatif demektir (1.234,56-)
    if (/-$/.test(cleaned)) {
        negative = !negative;
        cleaned = cleaned.replace(/-$/, '');
    }

    // Determine decimal/thousand separator format
    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');
    const lastDotIndex = cleaned.lastIndexOf('.');
    const lastCommaIndex = cleaned.lastIndexOf(',');
    
    if (hasComma && hasDot) {
        // Both separators present: determine which is decimal
        if (lastCommaIndex > lastDotIndex) {
            // Comma is decimal (Turkish: 1.234,56)
            // Remove thousand separators (dots followed by 3 digits)
            cleaned = cleaned.replace(/\.(?=\d{3})/g, '').replace(',', '.');
        } else {
            // Dot is decimal (US: 1,234.56)
            // Remove thousand separators (commas followed by 3 digits)
            cleaned = cleaned.replace(/,(?=\d{3})/g, '');
        }
    } else if (hasComma) {
        // Only comma: assume decimal (Turkish: 1.234,56 or just 1234,56)
        // If comma is followed by exactly 2 digits, it's decimal
        const afterComma = cleaned.slice(lastCommaIndex + 1);
        if (/^\d{1,2}$/.test(afterComma)) {
            // 1-2 digits after comma = likely decimal (1234,56)
            cleaned = cleaned.replace(',', '.');
        } else if (/^\d{3}$/.test(afterComma)) {
            // 3 digits after comma without dot = could be thousand separator (1,000 = 1000)
            // But also could be decimal (1,000 = 1 in US)
            // For safety, treat as thousand separator in Turkish context
            cleaned = cleaned.replace(/,/g, '');
        } else {
            cleaned = cleaned.replace(',', '.');
        }
    } else if (hasDot) {
        // Only dot: determine if decimal or thousand separator
        // In Turkish format: 1.000 = 1000, 1.000.000 = 1000000
        // In US format: 1.000 = 1
        // Heuristic: if dot is followed by exactly 3 digits and there are no more dots after
        const afterDot = cleaned.slice(lastDotIndex + 1);
        if (/^\d{3}$/.test(afterDot) && !cleaned.slice(lastDotIndex + 4).includes('.')) {
            // Exactly 3 digits after dot, and no more dots = thousand separator
            cleaned = cleaned.replace(/\./g, '');
        }
        // Otherwise keep as decimal
    }
    
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return negative ? -num : num;
}

/**
 * Calculate analysis for a dataset
 */
function calculateAnalysis(data, type) {
    if (!data || data.length === 0) {
        return null;
    }

    const totalAmount = data.reduce((sum, row) => sum + row.total, 0);
    const totalQuantity = data.reduce((sum, row) => sum + row.quantity, 0);
    const totalTax = data.reduce((sum, row) => sum + (row.tax || 0), 0);
    const totalSubtotal = data.reduce((sum, row) => sum + (row.subtotal || 0), 0);
    const totalDiscount = data.reduce((sum, row) => sum + (row.discount || 0), 0);

    // Group by product and sum totals
    const productTotals = {};
    data.forEach(row => {
        const product = row.product || 'Diğer';
        if (!productTotals[product]) {
            productTotals[product] = { total: 0, quantity: 0, tax: 0 };
        }
        productTotals[product].total += row.total;
        productTotals[product].quantity += row.quantity;
        productTotals[product].tax += row.tax || 0;
    });

    // Get top 5 products by total
    const topProducts = Object.entries(productTotals)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    return {
        type,
        totalAmount,
        totalQuantity,
        totalTax,
        totalSubtotal,
        totalDiscount,
        itemCount: data.length,
        topProducts,
        averagePerItem: totalAmount / data.length
    };
}

/**
 * Format currency
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Generate text summary
 */
function generateSummary(salesAnalysis, purchaseAnalysis) {
    const parts = [];

    if (salesAnalysis && purchaseAnalysis) {
        const profit = salesAnalysis.totalAmount - purchaseAnalysis.totalAmount;
        const profitStatus = profit >= 0 ? 'kâr' : 'zarar';
        const profitAmount = Math.abs(profit);

        parts.push(
            `Toplam satış ${formatCurrency(salesAnalysis.totalAmount)}, ` +
            `toplam alış ${formatCurrency(purchaseAnalysis.totalAmount)} olup ` +
            `brüt ${profitStatus} ${formatCurrency(profitAmount)}'dir.`
        );

        // Add KDV information
        if (salesAnalysis.totalTax > 0 || purchaseAnalysis.totalTax > 0) {
            const netKdv = salesAnalysis.totalTax - purchaseAnalysis.totalTax;
            parts.push(
                `Satış KDV: ${formatCurrency(salesAnalysis.totalTax)}, ` +
                `Alış KDV: ${formatCurrency(purchaseAnalysis.totalTax)}, ` +
                `Net KDV: ${formatCurrency(netKdv)}.`
            );
        }

        if (salesAnalysis.topProducts.length > 0) {
            const topSale = salesAnalysis.topProducts[0];
            parts.push(
                `En yüksek satış "${topSale.name}" firmasına (${formatCurrency(topSale.total)}) gerçekleşmiştir.`
            );
        }

        if (purchaseAnalysis.topProducts.length > 0) {
            const topPurchase = purchaseAnalysis.topProducts[0];
            parts.push(
                `En yüksek alış "${topPurchase.name}" firmasından (${formatCurrency(topPurchase.total)}) yapılmıştır.`
            );
        }
    } else if (salesAnalysis) {
        parts.push(`Toplam satış tutarı ${formatCurrency(salesAnalysis.totalAmount)}'dir.`);
        if (salesAnalysis.topProducts.length > 0) {
            const top = salesAnalysis.topProducts[0];
            parts.push(`En çok satış "${top.name}" kaleminde gerçekleşmiştir.`);
        }
    } else if (purchaseAnalysis) {
        parts.push(`Toplam alış tutarı ${formatCurrency(purchaseAnalysis.totalAmount)}'dir.`);
        if (purchaseAnalysis.topProducts.length > 0) {
            const top = purchaseAnalysis.topProducts[0];
            parts.push(`En yüksek harcama "${top.name}" kaleminde yapılmıştır.`);
        }
    }

    return parts.join(' ');
}

/**
 * Parse a raw date value into ISO string. Returns null if unparseable.
 */
function toISODate(value) {
    if (!value) return null;
    if (typeof value === 'number') {
        // Excel serial date
        const epoch = new Date((value - 25569) * 86400 * 1000);
        if (!isNaN(epoch.getTime())) return epoch.toISOString();
        return null;
    }
    const str = String(value).trim();
    if (!str) return null;
    // Try DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
    const dmy = str.match(/^(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{4})$/);
    if (dmy) {
        const d = new Date(`${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}T00:00:00Z`);
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    // Try YYYY-MM-DD or native parseable
    const native = new Date(str);
    if (!isNaN(native.getTime())) return native.toISOString();
    return null;
}

/**
 * Build standardized rows from normalized data.
 * normalizeData already produces canonical net/vat/gross with derivation.
 */
function buildRows(normalizedData, type) {
    return normalizedData
        .map(row => {
            let net = Number.isFinite(row.net) ? row.net : 0;
            let vat = Number.isFinite(row.vat) ? row.vat : 0;
            let gross = Number.isFinite(row.gross) ? row.gross : 0;

            // Drop if gross is still 0 (nothing useful)
            if (gross === 0 && net === 0) return null;

            // If gross is 0 but net exists, use net as gross (best effort)
            if (gross === 0 && net > 0) gross = net + vat;

            // TODO: If vat arrives as a percentage (e.g. 0.20 or 20) but net/gross
            // are absent we can't convert it to an absolute amount. Left as 0.

            return {
                date: toISODate(row.date),
                type,
                net,
                vat,
                gross,
                counterparty: row.counterparty || row.product || 'Bilinmeyen'
            };
        })
        .filter(r => r !== null);
}

function detectOutliersZScore(values, threshold = 3) {
    const n = values.length;
    if (n < 3) return [];
    const mean = values.reduce((s, v) => s + v, 0) / n;
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (n - 1);
    const stdev = Math.sqrt(variance);
    if (stdev === 0) return [];
    const result = [];
    values.forEach((v, i) => {
        const z = Math.abs((v - mean) / stdev);
        if (z > threshold) result.push({ index: i, value: v, zScore: z });
    });
    return result;
}

function detectOutliersIQR(values, multiplier = 1.5) {
    const n = values.length;
    if (n < 4) return [];
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    if (iqr === 0) return [];
    const lower = q1 - multiplier * iqr;
    const upper = q3 + multiplier * iqr;
    const result = [];
    values.forEach((v, i) => {
        if (v < lower || v > upper) result.push({ index: i, value: v, q1, q3, iqr, lowerBound: lower, upperBound: upper });
    });
    return result;
}

/**
 * Calculate median from an array of numbers.
 */
function median(values) {
    const sorted = [...values].filter(v => Number.isFinite(v)).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function scanForOutliers(rows) {
    if (!Array.isArray(rows) || rows.length < 3) {
        return { hasOutliers: false, totalFlagged: 0, flags: [] };
    }

    const fields = ['net', 'vat', 'gross'];
    const fieldLabels = { net: 'Net tutar', vat: 'KDV', gross: 'Brüt tutar' };
    const flags = [];

    for (const field of fields) {
        const indexedValues = rows
            .map((row, rowIndex) => ({ rowIndex, value: Number(row && row[field]) }))
            .filter(item => Number.isFinite(item.value) && item.value !== 0);

        const values = indexedValues.map(item => item.value);
        const fieldMedian = median(values);
        if (fieldMedian === 0) continue;

        const zscoreFlags = detectOutliersZScore(values, 3).map(flag => ({ ...flag, method: 'zscore' }));
        const iqrFlags = detectOutliersIQR(values, 1.5).map(flag => ({ ...flag, method: 'iqr' }));
        const selectedByValueIndex = new Map();

        for (const flag of zscoreFlags) selectedByValueIndex.set(flag.index, flag);
        for (const flag of iqrFlags) {
            if (!selectedByValueIndex.has(flag.index)) selectedByValueIndex.set(flag.index, flag);
        }

        for (const flag of selectedByValueIndex.values()) {
            const rowIndex = indexedValues[flag.index].rowIndex;
            const value = flag.value;
            const deviation = ((value - fieldMedian) / Math.abs(fieldMedian)) * 100;
            const roundedDeviation = Math.round(deviation * 10) / 10;
            const direction = deviation > 0 ? 'çok üzerinde' : 'altında';

            flags.push({
                rowIndex,
                field,
                value,
                median: fieldMedian,
                method: flag.method,
                deviation: roundedDeviation,
                reason: `${fieldLabels[field]} (%${Math.round(Math.abs(deviation))}) ortalamanın ${direction}`
            });
        }
    }

    flags.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

    return {
        hasOutliers: flags.length > 0,
        totalFlagged: flags.length,
        flags
    };
}
function detectPeriod(rows) {
    const dates = rows
        .map(r => r.date)
        .filter(Boolean)
        .sort();

    if (dates.length === 0) return null;

    const first = dates[0].slice(0, 7);
    const last = dates[dates.length - 1].slice(0, 7);
    return first === last ? first : `${first}/${last}`;
}

function calculateSummary(rows) {
    let total_sales = 0;         // KDV dahil (fatura toplamı — "Toplam Satış")
    let total_purchases = 0;     // KDV dahil (fatura toplamı — "Toplam Alış")
    let total_sales_net = 0;     // KDV hariç mal bedeli
    let total_purchases_net = 0; // KDV hariç mal bedeli
    let total_vat = 0;

    for (const row of rows) {
        // Satırın net'i yoksa gross - vat ile türet (legacy/test uyumu)
        const net = (row.net != null) ? row.net : (row.gross - row.vat);
        if (row.type === 'sales') {
            total_sales += row.gross;
            total_sales_net += net;
        } else if (row.type === 'purchase') {
            total_purchases += row.gross;
            total_purchases_net += net;
        }
        total_vat += row.vat;
    }

    return {
        total_sales,
        total_purchases,
        total_vat,
        // Brüt kâr KDV HARİÇ hesaplanır: KDV devlete ödenecek geçiş kalemidir, kâr değildir.
        // "Toplam Satış/Alış" ise fatura toplamı olarak KDV dahil kalır.
        gross_profit: total_sales_net - total_purchases_net
    };
}

function isEmptyNormalizedData(data) {
    return !Array.isArray(data) || data.length === 0 || data.every(row => row == null);
}

function isDelimitedTextBuffer(buffer) {
    if (!buffer || buffer.length === 0) return false;
    const start = buffer.toString('utf-8', 0, Math.min(256, buffer.length));
    if (start.startsWith('PK')) return false;
    const firstLine = start.split(/\r?\n/).find(line => line.trim() !== '') || '';
    return firstLine.includes('\t') || firstLine.includes(',');
}

function detectReportType(buffer) {
    try {
        const rows = rowsFromBuffer(buffer);
        return detectReportTypeFromRows(rows);
    } catch (_error) {
        return null;
    }
}

function firstDateColumnIndex(rows) {
    const headerRow = getFirstNonEmptyRow(rows);
    if (!headerRow) return 0;
    const headers = headerRow.map(cell => String(cell || '').trim());
    const dateHeader = findColumn(headers, COLUMN_MAPPINGS.date);
    const dateIndex = dateHeader ? headers.indexOf(dateHeader) : -1;
    return dateIndex >= 0 ? dateIndex : 0;
}

function extractDateFromRows(rows) {
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const headerIndex = rows.findIndex(hasMeaningfulCell);
    if (headerIndex < 0) return null;
    const dateIndex = firstDateColumnIndex(rows);
    for (const row of rows.slice(headerIndex + 1)) {
        if (!Array.isArray(row)) continue;
        const isoDate = toISODate(row[dateIndex]);
        if (!isoDate) continue;
        const parsedDate = new Date(isoDate);
        if (isNaN(parsedDate.getTime())) continue;
        return { year: parsedDate.getUTCFullYear(), month: parsedDate.getUTCMonth() + 1 };
    }
    return null;
}

function extractDateFromContent(buffer) {
    try {
        return extractDateFromRows(rowsFromBuffer(buffer));
    } catch (_error) {
        return null;
    }
}

function periodFromContentFallbacks(fallbacks) {
    const periods = (fallbacks || [])
        .filter(item => item && item.year && item.month)
        .map(item => `${item.year}-${String(item.month).padStart(2, '0')}`)
        .sort();
    if (periods.length === 0) return null;
    const first = periods[0];
    const last = periods[periods.length - 1];
    return first === last ? first : `${first}/${last}`;
}

/**
 * Main analysis function
 */
function analyzeFiles(salesBuffer, purchaseBuffer, options = {}) {
    let salesData = null;
    let purchaseData = null;
    let salesAnalysis = null;
    let purchaseAnalysis = null;
    let allRows = [];
    const contentDateFallbacks = [];
    const salesMap = options.salesColumnMap || null;
    const purchaseMap = options.purchaseColumnMap || null;

    if (salesBuffer) {
        const detectedType = !purchaseBuffer ? detectReportType(salesBuffer) : null;
        const reportType = detectedType || 'sales';
        const reportMap = reportType === 'purchase' ? purchaseMap : salesMap;
        const isCsv = isDelimitedTextBuffer(salesBuffer);
        const rawSales = isCsv
            ? parseCsvWithColumnMap(salesBuffer, reportType, reportMap)
            : parseExcelWithColumnMap(salesBuffer, reportType, reportMap);
        contentDateFallbacks.push(extractDateFromRows(rawSales));
        salesData = normalizeDataWithHeaderPreference(rawSales, reportType, reportMap);
        if (!isCsv && isEmptyNormalizedData(salesData)) {
            const rawHeaderSales = parseExcel(salesBuffer);
            salesData = normalizeData(rawHeaderSales);
        }
        if (isEmptyNormalizedData(salesData)) {
            throw new Error('Satış dosyası çözümlenemedi: sütun yapısı tanınamadı. Lütfen manuel sütun eşleme kullanın.');
        }
        const analysis = calculateAnalysis(salesData, reportType);
        if (reportType === 'purchase') {
            purchaseData = salesData;
            purchaseAnalysis = analysis;
        } else {
            salesAnalysis = analysis;
        }
        allRows = allRows.concat(buildRows(salesData, reportType));
    }

    if (purchaseBuffer) {
        const detectedType = !salesBuffer ? detectReportType(purchaseBuffer) : null;
        const reportType = detectedType || 'purchase';
        const reportMap = reportType === 'sales' ? salesMap : purchaseMap;
        const isCsv = isDelimitedTextBuffer(purchaseBuffer);
        const rawPurchase = isCsv
            ? parseCsvWithColumnMap(purchaseBuffer, reportType, reportMap)
            : parseExcelWithColumnMap(purchaseBuffer, reportType, reportMap);
        contentDateFallbacks.push(extractDateFromRows(rawPurchase));
        purchaseData = normalizeDataWithHeaderPreference(rawPurchase, reportType, reportMap);
        if (!isCsv && isEmptyNormalizedData(purchaseData)) {
            const rawHeaderPurchase = parseExcel(purchaseBuffer);
            purchaseData = normalizeData(rawHeaderPurchase);
        }
        if (isEmptyNormalizedData(purchaseData)) {
            throw new Error('Alış dosyası çözümlenemedi: sütun yapısı tanınamadı. Lütfen manuel sütun eşleme kullanın.');
        }
        const analysis = calculateAnalysis(purchaseData, reportType);
        if (reportType === 'sales') {
            salesData = purchaseData;
            salesAnalysis = analysis;
        } else {
            purchaseAnalysis = analysis;
        }
        allRows = allRows.concat(buildRows(purchaseData, reportType));
    }

    const detectedPeriod = detectPeriod(allRows) || periodFromContentFallbacks(contentDateFallbacks);

    const summaryData = calculateSummary(allRows);

    const profitLoss = {
        amount: summaryData.gross_profit,
        isProfit: summaryData.gross_profit >= 0,
        percentage: summaryData.total_sales > 0
            ? ((summaryData.gross_profit / summaryData.total_sales) * 100).toFixed(1)
            : 0
    };

    const summary = generateSummary(salesAnalysis, purchaseAnalysis);

    // Scan for outliers in transaction rows
    const outliers = scanForOutliers(allRows);

    return {
        success: true,
        period: detectedPeriod,
        rows: allRows,
        summaryData,
        sales: salesAnalysis,
        purchase: purchaseAnalysis,
        profitLoss,
        outliers,
        summary,
        timestamp: new Date().toISOString()
    };
}

/**
 * Aynı içerikli (byte-byte özdeş) buffer'ları eler — kullanıcı aynı Excel'i iki kez seçtiğinde
 * ciro/kâr iki katına çıkmasın. İçerik hash'i (sha256) bazlı; satır bazlı DEĞİL (gerçek tekrar
 * eden işlemleri korur, silmez).
 */
function dedupeBuffersByContent(buffers) {
    if (!Array.isArray(buffers)) return [];
    const seen = new Set();
    const unique = [];
    for (const buffer of buffers) {
        if (!buffer) continue;
        const hash = crypto.createHash('sha256').update(buffer).digest('hex');
        if (seen.has(hash)) continue;
        seen.add(hash);
        unique.push(buffer);
    }
    return unique;
}

/**
 * Merge multiple sales/purchase buffers into a single analysis.
 * Parses each buffer, merges all rows of the same type, then runs the standard analysis.
 */
function mergeAnalyzeFiles(salesBuffers, purchaseBuffers, options = {}) {
    if ((!salesBuffers || salesBuffers.length === 0) && (!purchaseBuffers || purchaseBuffers.length === 0)) {
        throw new Error('En az bir dosya yüklemelisiniz.');
    }

    let allSalesData = [];
    let allPurchaseData = [];
    let allRows = [];
    const contentDateFallbacks = [];
    const salesMap = options.salesColumnMap || null;
    const purchaseMap = options.purchaseColumnMap || null;

    // Aynı dosya iki kez seçilirse mükerrer sayımı önle (içerik-hash bazlı)
    const uniqueSalesBuffers = dedupeBuffersByContent(salesBuffers);
    const uniquePurchaseBuffers = dedupeBuffersByContent(purchaseBuffers);

    if (uniqueSalesBuffers.length > 0) {
        for (const buffer of uniqueSalesBuffers) {
            const isCsv = isDelimitedTextBuffer(buffer);
            const raw = isCsv
                ? parseCsvWithColumnMap(buffer, 'sales', salesMap)
                : parseExcelWithColumnMap(buffer, 'sales', salesMap);
            contentDateFallbacks.push(extractDateFromRows(raw));
            const normalized = normalizeDataWithHeaderPreference(raw, 'sales', salesMap);
            if (!isCsv && isEmptyNormalizedData(normalized)) {
                const rawHeader = parseExcel(buffer);
                allSalesData.push(normalizeData(rawHeader));
            } else {
                allSalesData.push(normalized);
            }
        }
    }

    if (uniquePurchaseBuffers.length > 0) {
        for (const buffer of uniquePurchaseBuffers) {
            const isCsv = isDelimitedTextBuffer(buffer);
            const raw = isCsv
                ? parseCsvWithColumnMap(buffer, 'purchase', purchaseMap)
                : parseExcelWithColumnMap(buffer, 'purchase', purchaseMap);
            contentDateFallbacks.push(extractDateFromRows(raw));
            const normalized = normalizeDataWithHeaderPreference(raw, 'purchase', purchaseMap);
            if (!isCsv && isEmptyNormalizedData(normalized)) {
                const rawHeader = parseExcel(buffer);
                allPurchaseData.push(normalizeData(rawHeader));
            } else {
                allPurchaseData.push(normalized);
            }
        }
    }

    const mergedSales = mergeNormalizedData(allSalesData);
    const mergedPurchase = mergeNormalizedData(allPurchaseData);

    const salesAnalysis = mergedSales.length > 0 ? calculateAnalysis(mergedSales, 'sales') : null;
    const purchaseAnalysis = mergedPurchase.length > 0 ? calculateAnalysis(mergedPurchase, 'purchase') : null;

    if (mergedSales.length > 0) {
        allRows = allRows.concat(buildRows(mergedSales, 'sales'));
    }
    if (mergedPurchase.length > 0) {
        allRows = allRows.concat(buildRows(mergedPurchase, 'purchase'));
    }

    const detectedPeriod = detectPeriod(allRows) || periodFromContentFallbacks(contentDateFallbacks);
    const summaryData = calculateSummary(allRows);

    const profitLoss = {
        amount: summaryData.gross_profit,
        isProfit: summaryData.gross_profit >= 0,
        percentage: summaryData.total_sales > 0
            ? ((summaryData.gross_profit / summaryData.total_sales) * 100).toFixed(1)
            : 0
    };

    const summary = generateSummary(salesAnalysis, purchaseAnalysis);
    const outliers = scanForOutliers(allRows);

    return {
        success: true,
        period: detectedPeriod,
        rows: allRows,
        summaryData,
        sales: salesAnalysis,
        purchase: purchaseAnalysis,
        profitLoss,
        outliers,
        summary,
        timestamp: new Date().toISOString()
    };
}

function mergeNormalizedData(dataArrays) {
    return dataArrays.reduce((merged, arr) => merged.concat(arr), []);
}

function calculateDelta(prevSummary, currentSummary) {
    const fields = [
        { key: 'total_sales', label: 'Satış' },
        { key: 'total_purchases', label: 'Alış' },
        { key: 'gross_profit', label: 'Kâr' },
        { key: 'total_vat', label: 'KDV' }
    ];

    const deltas = fields
        .map(f => {
            const prev = prevSummary[f.key] || 0;
            const curr = currentSummary[f.key] || 0;
            const diff = curr - prev;
            const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : (curr !== 0 ? 100 : 0);

            return {
                field: f.label,
                previous: prev,
                current: curr,
                diff,
                pct: Math.round(pct * 10) / 10
            };
        })
        .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
        .slice(0, 3);

    return deltas;
}

function buildTimeSeries(summaries) {
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    const sorted = summaries
        .filter(s => s && s.date)
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date));

    const labels = [];
    const sales = [];
    const purchases = [];
    const profit = [];
    const vat = [];

    for (const s of sorted) {
        const d = new Date(s.date);
        if (isNaN(d.getTime())) continue;

        const label = monthNames[d.getMonth()] + ' ' + d.getFullYear();
        const sd = s.summaryData || {};

        labels.push(label);
        sales.push(sd.total_sales || 0);
        purchases.push(sd.total_purchases || 0);
        profit.push(sd.gross_profit || 0);
        vat.push(sd.total_vat || 0);
    }

    return {
        labels,
        datasets: [
            { label: 'Satış', data: sales },
            { label: 'Alış', data: purchases },
            { label: 'Kâr', data: profit },
            { label: 'KDV', data: vat }
        ]
    };
}

function detectTrend(series) {
    if (!series || series.length < 2) return 'yatay';

    const n = series.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += series[i];
        sumXY += i * series[i];
        sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avg = sumY / n;
    const threshold = avg * 0.02;

    if (slope > threshold) return 'yükselen';
    if (slope < -threshold) return 'düşen';
    return 'yatay';
}

function detectAnomaly(current, average) {
    const fields = [
        { key: 'total_sales', label: 'Satış' },
        { key: 'total_purchases', label: 'Alış' },
        { key: 'gross_profit', label: 'Kâr' }
    ];

    const alerts = [];

    for (const f of fields) {
        const curr = current[f.key] || 0;
        const avg = average[f.key] || 0;
        if (avg === 0) continue;

        const deviation = ((curr - avg) / Math.abs(avg)) * 100;
        const absDev = Math.abs(deviation);

        if (absDev > 30) {
            alerts.push({
                field: f.label,
                current: curr,
                average: avg,
                deviation: Math.round(deviation * 10) / 10,
                direction: deviation > 0 ? 'above' : 'below'
            });
        }
    }

    return alerts;
}

module.exports = {
    dedupeBuffersByContent,
    analyzeFiles,
    mergeAnalyzeFiles,
    calculateDelta,
    buildTimeSeries,
    detectTrend,
    detectAnomaly,
    detectOutliersZScore,
    detectOutliersIQR,
    median,
    scanForOutliers,
    // Excel parsing
    parseExcelWithColumnMap,
    parseExcel,
    // CSV parsing
    parseCsv,
    parseCsvWithColumnMap,
    detectReportType,
    // Data normalization
    normalizeDataByColumns,
    normalizeData,
    // Helper functions
    findColumn,
    letterToIndex,
    safeNum,
    parseNumber,
    // Date utilities
    toISODate,
    detectPeriod,
    extractDateFromContent,
    // Analysis functions
    calculateAnalysis,
    calculateSummary,
    // Summary generation
    generateSummary,
    // Formatting
    formatCurrency,
    // Build rows
    buildRows
};
