const db = require('./database');
const logger = require('./logger');

// Add new analysis to history
function addToHistory(analysisResult, salesFileName, purchaseFileName, userId = 1) {
    return new Promise((resolve, reject) => {
        const id = Date.now().toString();
        const date = new Date().toISOString();
        const displayDate = new Date().toLocaleString('tr-TR');

        const salesAmount = analysisResult.sales?.totalAmount || 0;
        const purchaseAmount = analysisResult.purchase?.totalAmount || 0;
        const salesTax = analysisResult.sales?.totalTax || 0;
        const purchaseTax = analysisResult.purchase?.totalTax || 0;
        const netProfit = (analysisResult.profitLoss?.amount !== undefined) ? analysisResult.profitLoss.amount : (salesAmount - purchaseAmount);

        const outliersJson = analysisResult.outliers ? JSON.stringify(analysisResult.outliers) : null;

        const sql = `INSERT INTO analyses (
            id, user_id, date, display_date, sales_filename, purchase_filename, 
            sales_amount, purchase_amount, sales_tax, purchase_tax, net_profit,
            sales_json, purchase_json, summary, outliers_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const params = [
            id, userId, date, displayDate, salesFileName, purchaseFileName,
            salesAmount, purchaseAmount, salesTax, purchaseTax, netProfit,
            JSON.stringify(analysisResult.sales),
            JSON.stringify(analysisResult.purchase),
            analysisResult.summary || '',
            outliersJson
        ];

        db.run(sql, params, function (err) {
            if (err) {
                logger.error({ err }, 'Veritabanına ekleme hatası:');
                reject(err);
            } else {
                // Return the formatted object for immediate UI use
                resolve({
                    id,
                    date,
                    displayDate,
                    salesFileName,
                    purchaseFileName,
                    sales: analysisResult.sales,
                    purchase: analysisResult.purchase,
                    profitLoss: { amount: netProfit }, // Simplify for UI
                    summary: analysisResult.summary,
                    outliers: analysisResult.outliers || null
                });
            }
        });
    });
}

function parseOutliersJson(value) {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch (_error) {
        return null;
    }
}

function safeSerializeDetails(details) {
    if (!details) return null;
    try {
        return JSON.stringify(details);
    } catch (_error) {
        return JSON.stringify({ note: 'details serialization failed' });
    }
}

function logAuditEvent({
    actorUserId = null,
    actorUsername = null,
    action,
    entityType = null,
    entityId = null,
    details = null,
    ipAddress = null
}) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO audit_logs (
            actor_user_id, actor_username, action, entity_type, entity_id, details_json, ip_address
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

        db.run(sql, [
            actorUserId,
            actorUsername,
            action,
            entityType,
            entityId != null ? String(entityId) : null,
            safeSerializeDetails(details),
            ipAddress
        ], function (err) {
            if (err) {
                logger.error({ err, action, entityType, entityId }, 'Audit log yazma hatası:');
                return reject(err);
            }
            resolve({ success: true, id: this.lastID });
        });
    });
}

function getAuditLogs(limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, actor_user_id, actor_username, action, entity_type, entity_id, details_json, ip_address, created_at
             FROM audit_logs
             ORDER BY datetime(created_at) DESC, id DESC
             LIMIT ? OFFSET ?`,
            [limit, offset],
            (err, rows) => {
                if (err) {
                    logger.error({ err }, 'Audit log listeleme hatası:');
                    return reject(err);
                }
                resolve((rows || []).map((row) => ({
                    id: row.id,
                    actorUserId: row.actor_user_id,
                    actorUsername: row.actor_username,
                    action: row.action,
                    entityType: row.entity_type,
                    entityId: row.entity_id,
                    details: parseOutliersJson(row.details_json),
                    ipAddress: row.ip_address,
                    createdAt: row.created_at
                })));
            }
        );
    });
}

// Map DB row to frontend format
function mapRow(row) {
    const sales = JSON.parse(row.sales_json || '{}') || {};
    const purchase = JSON.parse(row.purchase_json || '{}') || {};

    // Guarantee totalTax is a finite number — prefer JSON value, fallback to DB column
    if (!Number.isFinite(sales.totalTax) || sales.totalTax === 0) {
        const dbVal = parseFloat(row.sales_tax);
        if (Number.isFinite(dbVal) && dbVal !== 0) sales.totalTax = dbVal;
        else if (!Number.isFinite(sales.totalTax)) sales.totalTax = 0;
    }
    if (!Number.isFinite(purchase.totalTax) || purchase.totalTax === 0) {
        const dbVal = parseFloat(row.purchase_tax);
        if (Number.isFinite(dbVal) && dbVal !== 0) purchase.totalTax = dbVal;
        else if (!Number.isFinite(purchase.totalTax)) purchase.totalTax = 0;
    }

    return {
        id: row.id,
        userId: row.user_id,
        date: row.date,
        displayDate: row.display_date,
        salesFileName: row.sales_filename,
        purchaseFileName: row.purchase_filename,
        sales,
        purchase,
        profitLoss: { amount: row.net_profit },
        summary: row.summary,
        outliers: parseOutliersJson(row.outliers_json)
    };
}

function normalizeContentFallbackDate(contentFallback) {
    if (!contentFallback) return null;
    if (contentFallback.year && contentFallback.month) {
        const year = parseInt(contentFallback.year, 10);
        const month = parseInt(contentFallback.month, 10);
        if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
            return { year, month };
        }
    }
    if (typeof contentFallback === 'string') {
        const periodMatch = contentFallback.match(/^(\d{4})-(\d{1,2})/);
        if (periodMatch) {
            const year = parseInt(periodMatch[1], 10);
            const month = parseInt(periodMatch[2], 10);
            if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
                return { year, month };
            }
        }
    }
    const date = contentFallback instanceof Date ? contentFallback : new Date(contentFallback);
    if (!isNaN(date.getTime())) {
        return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
    }
    return null;
}

// Parse year and month from filename (e.g. "satis_raporu_ocak_2024.xlsx")
function parseDateFromFilename(filename, contentFallback = null) {
    if (!filename) return normalizeContentFallbackDate(contentFallback);
    const name = filename.toLowerCase();

    const months = {
        'ocak': 1, 'subat': 2, 'şubat': 2, 'mart': 3, 'nisan': 4, 'mayis': 5, 'mayıs': 5, 'haziran': 6,
        'temmuz': 7, 'agustos': 8, 'ağustos': 8, 'eylul': 9, 'eylül': 9, 'ekim': 10, 'kasim': 11, 'kasım': 11, 'aralik': 12, 'aralık': 12
    };

    // Pattern: "Ocak 2024", "Ocak_2024", "Ocak2024"
    const monthYearRegex = new RegExp(`(${Object.keys(months).join('|')})[\\s_\\-]*(\\d{4})`, 'i');
    const match1 = name.match(monthYearRegex);
    if (match1) {
        return { year: parseInt(match1[2]), month: months[match1[1].toLowerCase()] };
    }

    // Pattern: "2024 Ocak", "2024_Ocak"
    const yearMonthRegex = new RegExp(`(\\d{4})[\\s_\\-]*(${Object.keys(months).join('|')})`, 'i');
    const match2 = name.match(yearMonthRegex);
    if (match2) {
        return { year: parseInt(match2[1]), month: months[match2[2].toLowerCase()] };
    }

    // Pattern: "2024-01", "2024_01"
    const digitRegex = /(\d{4})[\.\-\_](\d{1,2})/;
    const match3 = name.match(digitRegex);
    if (match3) {
        const m = parseInt(match3[2]);
        if (m >= 1 && m <= 12) return { year: parseInt(match3[1]), month: m };
    }

    return normalizeContentFallbackDate(contentFallback);
}

// Aynı yıl/ay için aynı tipte (satış veya alış) rapor var mı?
function checkDuplicateReport(year, month, type, userId = 1) {
    return new Promise((resolve, reject) => {
        const column = type === 'sales' ? 'sales_filename' : 'purchase_filename';
        const sql = `SELECT id, ${column} as filename FROM analyses WHERE user_id = ? AND deleted_at IS NULL AND ${column} IS NOT NULL AND ${column} != '' ORDER BY date DESC`;
        db.all(sql, [userId], (err, rows) => {
            if (err) return reject(err);
            const match = (rows || []).find((row) => {
                const parsed = parseDateFromFilename(row.filename);
                return parsed && parsed.year === year && parsed.month === month;
            });
            resolve(match ? { exists: true, id: match.id, filename: match.filename } : { exists: false });
        });
    });
}

function deleteReportsByPeriodType(year, month, type, userId = 1) {
    return new Promise((resolve, reject) => {
        const column = type === 'sales' ? 'sales_filename' : 'purchase_filename';
        const sql = `SELECT id, ${column} as filename FROM analyses WHERE user_id = ? AND ${column} IS NOT NULL AND ${column} != '' ORDER BY date DESC`;
        db.all(sql, [userId], (err, rows) => {
            if (err) return reject(err);
            const ids = (rows || [])
                .filter((row) => {
                    const parsed = parseDateFromFilename(row.filename);
                    return parsed && parsed.year === year && parsed.month === month;
                })
                .map((row) => row.id);

            if (ids.length === 0) return resolve(0);
            const stmt = db.prepare('DELETE FROM analyses WHERE id = ?');
            let deleted = 0;
            let index = 0;

            function runNext(runErr) {
                if (runErr) {
                    return stmt.finalize(() => reject(runErr));
                }
                if (index >= ids.length) {
                    return stmt.finalize((finalizeErr) => {
                        if (finalizeErr) return reject(finalizeErr);
                        resolve(deleted);
                    });
                }
                const id = ids[index++];
                stmt.run([id], function (deleteErr) {
                    if (!deleteErr) deleted += this.changes || 0;
                    runNext(deleteErr);
                });
            }

            runNext();
        });
    });
}

function buildHistorySqlFilters(options = {}) {
    // Güvenlik: userId zorunlu. Eksikse sessizce user 1'e düşmek yerine hata fırlat
    // (aksi halde bir kullanıcı yanlışlıkla yöneticinin verisini görebilir — IDOR).
    if (options.userId == null) {
        throw new Error('buildHistorySqlFilters: userId zorunludur (kullanıcı verisi izolasyonu).');
    }
    const userId = options.userId;
    const search = (options.search || '').trim().toLowerCase();
    const type = options.type || '';
    const parsedAmountMin = options.amount_min != null && options.amount_min !== '' ? Number(options.amount_min) : null;
    const parsedAmountMax = options.amount_max != null && options.amount_max !== '' ? Number(options.amount_max) : null;
    const amountMin = Number.isFinite(parsedAmountMin) ? parsedAmountMin : null;
    const amountMax = Number.isFinite(parsedAmountMax) ? parsedAmountMax : null;
    const amountColumn = type === 'purchase' ? 'purchase_amount' : 'sales_amount';
    const where = ['user_id = ?', 'deleted_at IS NULL'];
    const params = [userId];

    if (search) {
        where.push("(LOWER(sales_filename) LIKE ? OR LOWER(purchase_filename) LIKE ? OR LOWER(display_date) LIKE ? OR LOWER(summary) LIKE ?)");
        const term = `%${search}%`;
        params.push(term, term, term, term);
    }
    if (type === 'sales') {
        where.push("sales_filename IS NOT NULL AND sales_filename != ''");
    } else if (type === 'purchase') {
        where.push("purchase_filename IS NOT NULL AND purchase_filename != ''");
    }
    if (amountMin != null) {
        where.push(`${amountColumn} >= ?`);
        params.push(amountMin);
    }
    if (amountMax != null) {
        where.push(`${amountColumn} <= ?`);
        params.push(amountMax);
    }

    return { whereClause: where.join(' AND '), params };
}

function getHistoryPeriod(row, type = '') {
    if (type === 'sales') return parseDateFromFilename(row.salesFileName || row.sales_filename, row.date);
    if (type === 'purchase') return parseDateFromFilename(row.purchaseFileName || row.purchase_filename, row.date);
    return parseDateFromFilename(row.salesFileName || row.sales_filename, row.date) || parseDateFromFilename(row.purchaseFileName || row.purchase_filename, row.date);
}

function periodToKey(period) {
    if (!period || !period.year || !period.month) return null;
    return `${period.year}-${String(period.month).padStart(2, '0')}`;
}

function hasMemoryHistoryFilters(options = {}) {
    return Boolean(options.year || options.month || options.date_from || options.date_to);
}

function applyMemoryHistoryFilters(rows, options = {}) {
    const year = options.year ? parseInt(options.year, 10) : null;
    const month = options.month ? parseInt(options.month, 10) : null;
    const dateFrom = options.date_from || null;
    const dateTo = options.date_to || null;
    const type = options.type || '';

    return rows.filter(row => {
        const parsed = getHistoryPeriod(row, type);
        const rowYear = parsed ? parsed.year : (row.date && new Date(row.date).getFullYear());
        const rowMonth = parsed ? parsed.month : (row.date && new Date(row.date).getMonth() + 1);
        const periodKey = periodToKey(parsed) || (rowYear && rowMonth ? `${rowYear}-${String(rowMonth).padStart(2, '0')}` : null);
        if (year && rowYear !== year) return false;
        if (month && rowMonth !== month) return false;
        if (dateFrom && (!periodKey || periodKey < dateFrom)) return false;
        if (dateTo && (!periodKey || periodKey > dateTo)) return false;
        return true;
    });
}

function getHistory(options = {}) {
    return new Promise((resolve, reject) => {
        const limit = Math.min(parseInt(options.limit, 10) || 50, 1000);
        const offset = Math.max(0, parseInt(options.offset, 10) || 0);
        const sort = options.sort || 'date_desc';
        const { whereClause, params } = buildHistorySqlFilters(options);
        const orderBy = {
            date_desc: 'date DESC',
            date_asc: 'date ASC',
            sales_desc: 'sales_amount DESC',
            sales_asc: 'sales_amount ASC',
            amount_desc: 'sales_amount DESC',
            amount_asc: 'sales_amount ASC',
            profit_desc: 'net_profit DESC',
            profit_asc: 'net_profit ASC'
        }[sort] || 'date DESC';

        const sql = `SELECT * FROM analyses WHERE ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
        const memoryFilters = hasMemoryHistoryFilters(options);
        const limitFetch = memoryFilters ? -1 : limit + offset;
        const offsetFetch = memoryFilters ? 0 : offset;
        db.all(sql, [...params, limitFetch, offsetFetch], (err, rows) => {
            if (err) {
                logger.error({ err }, 'Geçmiş getirme hatası:');
                return reject(err);
            }
            let result = rows.map(mapRow);
            if (memoryFilters) {
                result = applyMemoryHistoryFilters(result, options);
                result = result.slice(offset, offset + limit);
            }
            resolve(result);
        });
    });
}

function getHistoryCount(options = {}) {
    return new Promise((resolve, reject) => {
        const { whereClause, params } = buildHistorySqlFilters(options);
        const fullWhereClause = `WHERE ${whereClause}`;
        if (!hasMemoryHistoryFilters(options)) {
            db.get(`SELECT COUNT(*) as total FROM analyses ${fullWhereClause}`, params, (err, row) => {
                if (err) return reject(err);
                resolve(row ? row.total : 0);
            });
            return;
        }
        db.all(`SELECT * FROM analyses ${fullWhereClause}`, params, (err, rows) => {
            if (err) return reject(err);
            const count = applyMemoryHistoryFilters(rows || [], options).length;
            resolve(count);
        });
    });
}

function getHistoryYears(userId = 1) {
    return new Promise((resolve, reject) => {
        db.all('SELECT sales_filename, purchase_filename, date FROM analyses WHERE user_id = ? AND deleted_at IS NULL', [userId], (err, rows) => {
            if (err) return reject(err);
            const years = new Set();
            (rows || []).forEach(row => {
                const parsed = parseDateFromFilename(row.sales_filename, row.date) || parseDateFromFilename(row.purchase_filename, row.date);
                const fallbackYear = row.date ? new Date(row.date).getFullYear() : null;
                const year = parsed ? parsed.year : fallbackYear;
                if (year) years.add(year);
            });
            resolve(Array.from(years).sort((a, b) => b - a));
        });
    });
}

// Get single history entry by ID
function getHistoryById(id, userId = 1) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM analyses WHERE id = ? AND user_id = ? AND deleted_at IS NULL`;

        db.get(sql, [id, userId], (err, row) => {
            if (err) reject(err);
            else if (!row) resolve(null);
            else resolve(mapRow(row));
        });
    });
}

// Soft delete history entry by ID
function deleteHistoryById(id, userId = 1) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE analyses SET deleted_at = datetime('now') WHERE id = ? AND user_id = ? AND deleted_at IS NULL`;

        db.run(sql, [id, userId], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.changes > 0);
            }
        });
    });
}

function deleteHistoryBatch(ids, userId = 1) {
    return new Promise((resolve, reject) => {
        if (!Array.isArray(ids) || ids.length === 0) return resolve(0);
        const placeholders = ids.map(() => '?').join(',');
        const sql = `UPDATE analyses SET deleted_at = datetime('now') WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL`;
        db.run(sql, [...ids, userId], function (err) {
            if (err) return reject(err);
            resolve(this.changes || 0);
        });
    });
}

function getHistoryByIds(ids, userId = 1) {
    return new Promise((resolve, reject) => {
        if (!Array.isArray(ids) || ids.length === 0) return resolve([]);
        const placeholders = ids.map(() => '?').join(',');
        const sql = `SELECT * FROM analyses WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL ORDER BY date DESC`;
        db.all(sql, [...ids, userId], (err, rows) => {
            if (err) return reject(err);
            resolve((rows || []).map(mapRow));
        });
    });
}

function normalizeAnalysisTotals(data, amountFallback, taxFallback) {
    const normalized = data && typeof data === 'object' ? { ...data } : {};
    if (!Number.isFinite(Number(normalized.totalAmount))) normalized.totalAmount = Number(amountFallback) || 0;
    if (!Number.isFinite(Number(normalized.totalTax))) normalized.totalTax = Number(taxFallback) || 0;
    return normalized;
}

function updateHistoryEntry(id, userId = 1, updates = {}) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM analyses WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [id, userId], (selectErr, row) => {
            if (selectErr) return reject(selectErr);
            if (!row) return resolve(null);

            const fields = [];
            const params = [];
            const sales = normalizeAnalysisTotals(JSON.parse(row.sales_json || '{}'), row.sales_amount, row.sales_tax);
            const purchase = normalizeAnalysisTotals(JSON.parse(row.purchase_json || '{}'), row.purchase_amount, row.purchase_tax);

            if (updates.sales && typeof updates.sales === 'object') {
                Object.assign(sales, updates.sales);
                fields.push('sales_json = ?', 'sales_amount = ?', 'sales_tax = ?');
                params.push(JSON.stringify(sales), Number(sales.totalAmount) || 0, Number(sales.totalTax) || 0);
            }

            if (updates.purchase && typeof updates.purchase === 'object') {
                Object.assign(purchase, updates.purchase);
                fields.push('purchase_json = ?', 'purchase_amount = ?', 'purchase_tax = ?');
                params.push(JSON.stringify(purchase), Number(purchase.totalAmount) || 0, Number(purchase.totalTax) || 0);
            }

            if (updates.sales || updates.purchase) {
                fields.push('net_profit = ?');
                params.push((Number(sales.totalAmount) || 0) - (Number(purchase.totalAmount) || 0));
            }

            if (updates.displayDate != null) {
                fields.push('display_date = ?');
                params.push(updates.displayDate);
            }

            if (updates.summary != null) {
                fields.push('summary = ?');
                params.push(updates.summary);
            }

            if (fields.length === 0) return resolve(mapRow(row));

            const sql = `UPDATE analyses SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
            db.run(sql, [...params, id, userId], (updateErr) => {
                if (updateErr) return reject(updateErr);
                getHistoryById(id, userId).then(resolve).catch(reject);
            });
        });
    });
}

// Soft delete all history
function clearHistory() {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE analyses SET deleted_at = datetime('now') WHERE deleted_at IS NULL`;

        db.run(sql, [], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}

// ============================================
// TRASH (Soft-deleted records management)
// ============================================

function getTrashHistory(userId = 1) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM analyses WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC`;
        db.all(sql, [userId], (err, rows) => {
            if (err) return reject(err);
            const result = (rows || []).map(row => {
                const entry = mapRow(row);
                entry.deletedAt = row.deleted_at;
                return entry;
            });
            resolve(result);
        });
    });
}

function restoreFromTrash(id, userId = 1) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE analyses SET deleted_at = NULL WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`;
        db.run(sql, [id, userId], function (err) {
            if (err) return reject(err);
            resolve(this.changes > 0);
        });
    });
}

function restoreHistoryBatch(ids, userId = 1) {
    return new Promise((resolve, reject) => {
        if (!Array.isArray(ids) || ids.length === 0) return resolve(0);
        const placeholders = ids.map(() => '?').join(',');
        const sql = `UPDATE analyses SET deleted_at = NULL WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NOT NULL`;
        db.run(sql, [...ids, userId], function (err) {
            if (err) return reject(err);
            resolve(this.changes || 0);
        });
    });
}

function permanentlyDeleteFromTrash(id, userId = 1) {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM analyses WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL`;
        db.run(sql, [id, userId], function (err) {
            if (err) return reject(err);
            resolve(this.changes > 0);
        });
    });
}

function permanentlyDeleteTrashBatch(ids, userId = 1) {
    return new Promise((resolve, reject) => {
        if (!Array.isArray(ids) || ids.length === 0) return resolve(0);
        const placeholders = ids.map(() => '?').join(',');
        const sql = `DELETE FROM analyses WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NOT NULL`;
        db.run(sql, [...ids, userId], function (err) {
            if (err) return reject(err);
            resolve(this.changes || 0);
        });
    });
}

function emptyTrash(userId = 1) {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM analyses WHERE user_id = ? AND deleted_at IS NOT NULL`;
        db.run(sql, [userId], function (err) {
            if (err) return reject(err);
            resolve(this.changes || 0);
        });
    });
}

function getTrashCount(userId = 1) {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as total FROM analyses WHERE user_id = ? AND deleted_at IS NOT NULL', [userId], (err, row) => {
            if (err) return reject(err);
            resolve(row ? row.total : 0);
        });
    });
}

/**
 * @deprecated Artık kullanılmıyor - saveSummary kullanılmalı
 * Eski schema için bırakıldı (analysis_id bazlı)
 */
function addAnalysisSummary(analysisId, summary) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO summaries (analysis_id, total_sales, total_purchases, total_vat, gross_profit, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`;

        const params = [
            analysisId,
            summary.total_sales || 0,
            summary.total_purchases || 0,
            summary.total_vat || 0,
            summary.gross_profit || 0,
            new Date().toISOString()
        ];

        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ id: this.lastID, analysisId });
        });
    });
}

/**
 * Save or update a monthly summary for a user.
 * Uses INSERT OR REPLACE to handle duplicate entries.
 * @param {number} userId - User ID
 * @param {string} year - Year (YYYY)
 * @param {string} month - Month (YYYY-MM format)
 * @param {object} data - { total_sales, total_purchases, total_vat, gross_profit, total_expenses, net_profit }
 */
function saveSummary(userId, year, month, data) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT OR REPLACE INTO summaries 
            (user_id, year, month, total_sales, total_purchases, total_vat, gross_profit, total_expenses, net_profit, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`;

        const params = [
            userId,
            year,
            month,
            data.total_sales || 0,
            data.total_purchases || 0,
            data.total_vat || 0,
            data.gross_profit || 0,
            data.total_expenses || 0,
            data.net_profit || 0
        ];

        db.run(sql, params, function (err) {
            if (err) {
                logger.error({ err }, 'Summary kaydetme hatası:');
                return reject(err);
            }
            resolve({ id: this.lastID, userId, year, month });
        });
    });
}

/**
 * Get a single month summary for a user.
 * @param {number} userId - User ID
 * @param {string} year - Year (YYYY)
 * @param {string} month - Month (YYYY-MM format)
 */
function getSummary(userId, year, month) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM summaries WHERE user_id = ? AND year = ? AND month = ?`;
        db.get(sql, [userId, year, month], (err, row) => {
            if (err) return reject(err);
            if (!row) return resolve(null);
            resolve({
                id: row.id,
                userId: row.user_id,
                year: row.year,
                month: row.month,
                total_sales: row.total_sales,
                total_purchases: row.total_purchases,
                total_vat: row.total_vat,
                gross_profit: row.gross_profit,
                total_expenses: row.total_expenses,
                net_profit: row.net_profit,
                created_at: row.created_at,
                updated_at: row.updated_at
            });
        });
    });
}

/**
 * Get all month summaries for a specific year.
 * @param {number} userId - User ID
 * @param {string} year - Year (YYYY)
 */
function getSummariesByYear(userId, year) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM summaries WHERE user_id = ? AND year = ? ORDER BY month ASC`;
        db.all(sql, [userId, year], (err, rows) => {
            if (err) return reject(err);
            resolve((rows || []).map(row => ({
                id: row.id,
                userId: row.user_id,
                year: row.year,
                month: row.month,
                total_sales: row.total_sales,
                total_purchases: row.total_purchases,
                total_vat: row.total_vat,
                gross_profit: row.gross_profit,
                total_expenses: row.total_expenses,
                net_profit: row.net_profit,
                created_at: row.created_at,
                updated_at: row.updated_at
            })));
        });
    });
}

/**
 * Delete a specific month summary.
 * @param {number} userId - User ID
 * @param {string} year - Year (YYYY)
 * @param {string} month - Month (YYYY-MM format)
 */
function deleteSummary(userId, year, month) {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM summaries WHERE user_id = ? AND year = ? AND month = ?`;
        db.run(sql, [userId, year, month], function (err) {
            if (err) return reject(err);
            resolve(this.changes > 0);
        });
    });
}

/**
 * Compute and save summary for a specific month from analyses and expenses data.
 * This function aggregates data from the analyses table and expense_items table.
 * @param {number} userId - User ID
 * @param {string} year - Year (YYYY)
 * @param {string} month - Month (YYYY-MM format)
 */
function computeAndSaveSummary(userId, year, month) {
    return new Promise(async (resolve, reject) => {
        try {
            const monthStr = month.slice(-2); // Get MM from YYYY-MM
            
            // Get analyses for this month
            const analysesSql = `SELECT sales_amount, purchase_amount, sales_tax, purchase_tax 
                FROM analyses WHERE user_id = ? AND deleted_at IS NULL`;
            
            const analyses = await new Promise((res, rej) => {
                db.all(analysesSql, [userId], (err, rows) => {
                    if (err) return rej(err);
                    res(rows || []);
                });
            });

            // Filter analyses by month (from filename or date)
            let totalSales = 0;
            let totalPurchases = 0;
            let totalSalesTax = 0;
            let totalPurchasesTax = 0;
            let totalVat = 0;
            let grossProfit = 0;

            for (const row of analyses) {
                // Check if this analysis is for the specified month
                // We need to check sales_filename or purchase_filename
                const checkSql = `SELECT sales_filename, purchase_filename FROM analyses
                    WHERE user_id = ? AND sales_amount = ? AND purchase_amount = ? AND deleted_at IS NULL`;
                
                const fileRows = await new Promise((res, rej) => {
                    db.all(checkSql, [userId, row.sales_amount, row.purchase_amount], (err, r) => {
                        if (err) return rej(err);
                        res(r || []);
                    });
                });

                for (const fileRow of fileRows) {
                    const salesParsed = parseDateFromFilename(fileRow.sales_filename);
                    const purchaseParsed = parseDateFromFilename(fileRow.purchase_filename);
                    
                    let isThisMonth = false;
                    if (salesParsed && salesParsed.year === parseInt(year) && salesParsed.month === parseInt(monthStr)) {
                        isThisMonth = true;
                    }
                    if (purchaseParsed && purchaseParsed.year === parseInt(year) && purchaseParsed.month === parseInt(monthStr)) {
                        isThisMonth = true;
                    }

                    if (isThisMonth) {
                        totalSales += _fin(row.sales_amount);
                        totalPurchases += _fin(row.purchase_amount);
                        totalSalesTax += _fin(row.sales_tax);
                        totalPurchasesTax += _fin(row.purchase_tax);
                        totalVat += _fin(row.sales_tax) + _fin(row.purchase_tax);
                    }
                }
            }

            // Brüt kâr KDV HARİÇ: (satış - satış KDV) - (alış - alış KDV)
            grossProfit = (totalSales - totalSalesTax) - (totalPurchases - totalPurchasesTax);

            // Get expenses for this month
            const expenseData = await getExpenseItemsTotalByYear(userId, parseInt(year));
            const totalExpenses = expenseData.byMonth[month] || 0;

            // Net profit = gross profit - expenses
            const netProfit = grossProfit - totalExpenses;

            // Save the summary
            const summaryData = {
                total_sales: totalSales,
                total_purchases: totalPurchases,
                total_vat: totalVat,
                gross_profit: grossProfit,
                total_expenses: totalExpenses,
                net_profit: netProfit
            };

            const result = await saveSummary(userId, year, month, summaryData);
            resolve(result);
        } catch (err) {
            logger.error({ err }, 'Compute and save summary error:');
            reject(err);
        }
    });
}

// analyses tablosundan geçmiş listesi
function getAnalysisHistory(userId, limit = 20) {
    return new Promise((resolve, reject) => {
        const cap = Math.min(Math.max(1, parseInt(limit, 10) || 20), 200);
        const sql = `SELECT id, user_id, date, display_date, sales_filename, purchase_filename,
                sales_amount, purchase_amount, sales_tax, purchase_tax, net_profit, summary
            FROM analyses
            WHERE user_id = ? AND deleted_at IS NULL
            ORDER BY date DESC
            LIMIT ?`;
        db.all(sql, [userId, cap], (err, rows) => {
            if (err) return reject(err);
            resolve((rows || []).map(row => ({
                id: row.id,
                date: row.date,
                displayDate: row.display_date,
                salesFileName: row.sales_filename,
                purchaseFileName: row.purchase_filename,
                summary: row.summary,
                summaryData: {
                    total_sales: row.sales_amount ?? 0,
                    total_purchases: row.purchase_amount ?? 0,
                    total_vat: (row.sales_tax || 0) + (row.purchase_tax || 0),
                    gross_profit: row.net_profit ?? 0
                }
            })));
        });
    });
}

/**
 * Safely extract a finite number from an object trying multiple keys in order.
 * Returns 0 if nothing found.
 */
function pickNum(obj, keys) {
    if (!obj || typeof obj !== 'object') return 0;
    for (const k of keys) {
        const v = obj[k];
        if (v !== undefined && v !== null && v !== '') {
            const n = typeof v === 'number' ? v : parseFloat(v);
            if (Number.isFinite(n)) return n;
        }
    }
    return 0;
}

const MONTHLY_TOTALS_SQL = `SELECT user_id, date, sales_filename, purchase_filename, sales_amount, purchase_amount, sales_tax, purchase_tax,
                             sales_json, purchase_json
                      FROM analyses WHERE user_id = ? AND deleted_at IS NULL ORDER BY date ASC`;

/**
 * Bir analiz satırının rapor dönemini ("YYYY-AA") bulur.
 * Önce dosya adı (geçmiş sayfasıyla tutarlı), yoksa kayıt tarihi. Hiçbiri okunmazsa null.
 */
function resolveAnalysisPeriodKey(row) {
    const fromSales = parseDateFromFilename(row.sales_filename);
    if (fromSales) return `${fromSales.year}-${String(fromSales.month).padStart(2, '0')}`;
    const fromPurchase = parseDateFromFilename(row.purchase_filename);
    if (fromPurchase) return `${fromPurchase.year}-${String(fromPurchase.month).padStart(2, '0')}`;
    const d = new Date(row.date);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 7);
}

/**
 * Bir analiz satırını aylık toplama ekler. `getMonthlyTotals` ve `getMonthlyTotalsInRange`
 * bunu paylaşır; yeni bir aylık sorgu eklenirse KDV ayrıştırması burada hazır gelir.
 */
function accumulateMonthlyRow(monthlyMap, row, key) {
    if (!monthlyMap[key]) {
        monthlyMap[key] = { sales: 0, purchases: 0, vat: 0, salesVat: 0, purchasesVat: 0 };
    }

    let salesAmt = _fin(row.sales_amount);
    let purchaseAmt = _fin(row.purchase_amount);

    // --- KDV: önce DB kolonları, satış ve alış AYRI tutulur ---
    let salesVatAmt = _fin(row.sales_tax);
    let purchasesVatAmt = _fin(row.purchase_tax);

    // --- Yedek: DB vergi kolonları 0 ise JSON gövdesinden oku ---
    if (salesVatAmt + purchasesVatAmt === 0) {
        let salesObj = null;
        let purchaseObj = null;
        try { salesObj = JSON.parse(row.sales_json || '{}'); } catch (_) { salesObj = {}; }
        try { purchaseObj = JSON.parse(row.purchase_json || '{}'); } catch (_) { purchaseObj = {}; }

        salesVatAmt = pickNum(salesObj, ['totalTax', 'total_tax', 'vat', 'Toplam KDV', 'vat_amount', 'total_vat']);
        purchasesVatAmt = pickNum(purchaseObj, ['totalTax', 'total_tax', 'vat', 'Toplam KDV', 'vat_amount', 'total_vat']);

        // DB tutar kolonları da 0 ise aynı gövdeden tamamla
        if (salesAmt === 0) {
            salesAmt = pickNum(salesObj, ['totalAmount', 'total_amount', 'gross', 'Genel Toplam', 'gross_amount']);
        }
        if (purchaseAmt === 0) {
            purchaseAmt = pickNum(purchaseObj, ['totalAmount', 'total_amount', 'gross', 'Genel Toplam', 'gross_amount']);
        }
    }

    monthlyMap[key].sales += salesAmt;
    monthlyMap[key].purchases += purchaseAmt;
    monthlyMap[key].vat += salesVatAmt + purchasesVatAmt;
    monthlyMap[key].salesVat += salesVatAmt;
    monthlyMap[key].purchasesVat += purchasesVatAmt;
}

/** Aylık toplama haritasını dizi biçimine çevirir. */
function serializeMonthlyMap(monthlyMap, sortedKeys) {
    return {
        labels: sortedKeys,
        sales: sortedKeys.map(k => monthlyMap[k].sales),
        purchases: sortedKeys.map(k => monthlyMap[k].purchases),
        vat: sortedKeys.map(k => monthlyMap[k].vat),
        salesVat: sortedKeys.map(k => monthlyMap[k].salesVat),
        purchasesVat: sortedKeys.map(k => monthlyMap[k].purchasesVat)
    };
}

/**
 * Build monthly aggregation.
 * Reads every analysis row individually so we can combine:
 *   - DB scalar columns (sales_amount, purchase_amount, sales_tax, purchase_tax)
 *   - JSON blobs (sales_json, purchase_json) as fallback for vat / net / gross
 *
 * Returns { labels, sales, purchases, vat, salesVat, purchasesVat } — all number[] except labels.
 * Optional year filter (number) and userId filter.
 *
 * DİKKAT — KDV tuzağı: `sales` ve `purchases` KDV DAHİL tutarlardır, `vat` ise satış+alış
 * KDV'sinin BİRLEŞİK toplamıdır. Bu yüzden `sales - purchases` brüt kâr DEĞİLDİR ve
 * `sales - vat` de KDV hariç satış değildir. 2026-07-07 kararı gereği brüt kâr KDV hariç
 * hesaplanır; doğru türetme:
 *     KDV hariç satış = sales - salesVat
 *     KDV hariç alış  = purchases - purchasesVat
 *     brüt kâr        = (sales - salesVat) - (purchases - purchasesVat)
 */
function getMonthlyTotals(year, userId = 1) {
    return new Promise((resolve, reject) => {
        db.all(MONTHLY_TOTALS_SQL, [userId], (err, rows) => {
            if (err) return reject(err);

            const monthlyMap = {};

            for (const row of (rows || [])) {
                const key = resolveAnalysisPeriodKey(row);
                if (!key) continue;
                if (year && key.slice(0, 4) !== String(year)) continue;
                accumulateMonthlyRow(monthlyMap, row, key);
            }

            let sortedKeys = Object.keys(monthlyMap).sort();
            if (year) {
                sortedKeys = sortedKeys.filter(k => k.slice(0, 4) === String(year));
            }
            resolve(serializeMonthlyMap(monthlyMap, sortedKeys));
        });
    });
}

/** `getMonthlyTotals` ile aynı çıktı sözleşmesi — aynı KDV tuzağı uyarısı geçerlidir. */
function getMonthlyTotalsInRange(userId, startYm, endYm) {
    return new Promise((resolve, reject) => {
        db.all(MONTHLY_TOTALS_SQL, [userId], (err, rows) => {
            if (err) return reject(err);

            const monthlyMap = {};

            for (const row of (rows || [])) {
                const key = resolveAnalysisPeriodKey(row);
                if (!key) continue;
                if (key < startYm || key > endYm) continue;
                accumulateMonthlyRow(monthlyMap, row, key);
            }

            const sortedKeys = Object.keys(monthlyMap)
                .sort()
                .filter(key => key >= startYm && key <= endYm);
            resolve(serializeMonthlyMap(monthlyMap, sortedKeys));
        });
    });
}

/** Return value as finite number or 0 */
function _fin(v) {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Fills missing months between first and last label so charts get a continuous time axis.
 * Returns a new object { labels, sales, purchases, vat, salesVat, purchasesVat } with 0 for
 * months that had no data. KDV dizileri de doldurulur; aksi halde KDV hariç seri türetmek
 * isteyen tüketici boş dizi görür (bkz. getMonthlyTotals'daki KDV tuzağı notu).
 */
function fillMissingMonths(result) {
    if (!result || !result.labels || result.labels.length === 0) return result;
    const { labels, sales = [], purchases = [], vat = [], salesVat = [], purchasesVat = [] } = result;
    const map = {};
    labels.forEach((key, i) => {
        map[key] = {
            sales: Number(sales[i]) || 0,
            purchases: Number(purchases[i]) || 0,
            vat: Number(vat[i]) || 0,
            salesVat: Number(salesVat[i]) || 0,
            purchasesVat: Number(purchasesVat[i]) || 0
        };
    });
    const first = labels[0];
    const last = labels[labels.length - 1];
    const [y1, m1] = first.split('-').map(Number);
    const [y2, m2] = last.split('-').map(Number);
    const filled = { labels: [], sales: [], purchases: [], vat: [], salesVat: [], purchasesVat: [] };
    let y = y1;
    let m = m1;
    while (y < y2 || (y === y2 && m <= m2)) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        const d = map[key];
        filled.labels.push(key);
        filled.sales.push(d ? d.sales : 0);
        filled.purchases.push(d ? d.purchases : 0);
        filled.vat.push(d ? d.vat : 0);
        filled.salesVat.push(d ? d.salesVat : 0);
        filled.purchasesVat.push(d ? d.purchasesVat : 0);
        m += 1;
        if (m > 12) { m = 1; y += 1; }
    }
    return filled;
}

// ============================================
// EXPENSES
// ============================================

// --- User preferences (theme, chart type) ---
// Not: `predictions_layout_id` / `predictions_card_order` anahtarları Tahminler sayfası sabit
// düzene geçtiğinde (2026-08-06) ölü kaldı ve varsayılan listeden çıkarıldı.
function getUserPreferences(userId, keys) {
    return new Promise((resolve, reject) => {
        if (!userId) return resolve({});
        const wantKeys = Array.isArray(keys) ? keys : (keys ? [keys] : ['theme', 'chartType']);
        const placeholders = wantKeys.map(() => '?').join(',');
        const sql = `SELECT key, value FROM user_preferences WHERE user_id = ? AND key IN (${placeholders})`;
        db.all(sql, [userId, ...wantKeys], (err, rows) => {
            if (err) return reject(err);
            const prefs = {};
            (rows || []).forEach(r => { prefs[r.key] = r.value != null ? r.value : undefined; });
            resolve(prefs);
        });
    });
}

function setUserPreference(userId, key, value) {
    return new Promise((resolve, reject) => {
        if (!userId) return reject(new Error('user_id required'));
        const sql = `INSERT INTO user_preferences (user_id, key, value) VALUES (?, ?, ?)
            ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`;
        db.run(sql, [userId, key, value != null ? String(value) : null], function (err) {
            if (err) return reject(err);
            resolve({ key, value });
        });
    });
}

function migrateUserPreferences(userId, data) {
    return new Promise((resolve, reject) => {
        if (!userId || !data || typeof data !== 'object') return resolve({ migrated: [] });
        getUserPreferences(userId).then(existing => {
            const toInsert = [];
            if (data.theme != null && existing.theme === undefined) toInsert.push(['theme', data.theme]);
            if (toInsert.length === 0) return resolve({ migrated: [] });
            const stmt = db.prepare(`INSERT OR IGNORE INTO user_preferences (user_id, key, value) VALUES (?, ?, ?)`);
            let idx = 0;
            function runNext(err) {
                if (err) return stmt.finalize(() => reject(err));
                if (idx >= toInsert.length) return stmt.finalize(ferr => {
                    if (ferr) return reject(ferr);
                    resolve({ migrated: toInsert.map(([k]) => k) });
                });
                const [k, v] = toInsert[idx++];
                stmt.run(userId, k, v, runNext);
            }
            runNext();
        }).catch(reject);
    });
}

// --- Expense items (Sabit/Değişken gider) ---
function getExpenseItems(userId, year, month) {
    return new Promise((resolve, reject) => {
        if (!userId) return resolve({ fixed: [], variable: [] });
        const monthNorm = (month === 'all' || month === '' || month == null) ? 'all' : String(parseInt(month, 10)).padStart(2, '0');
        const sql = `SELECT id, type, item_id, label, amount, expense_date FROM expense_items WHERE user_id = ? AND year = ? AND month = ? ORDER BY id ASC`;
        db.all(sql, [userId, String(year), monthNorm], (err, rows) => {
            if (err) return reject(err);
            const fixed = [];
            const variable = [];
            (rows || []).forEach(r => {
                const item = { id: r.item_id || String(r.id), label: r.label || '', amount: _fin(r.amount), date: r.expense_date || '' };
                if (r.type === 'fixed') fixed.push(item);
                else variable.push(item);
            });
            resolve({ fixed, variable });
        });
    });
}

function setExpenseItems(userId, year, month, data) {
    return new Promise((resolve, reject) => {
        if (!userId) return reject(new Error('user_id required'));
        const monthNorm = (month === 'all' || month === '' || month == null) ? 'all' : String(parseInt(month, 10)).padStart(2, '0');
        const yearStr = String(year);
        db.run('DELETE FROM expense_items WHERE user_id = ? AND year = ? AND month = ?', [userId, yearStr, monthNorm], function (delErr) {
            if (delErr) return reject(delErr);
            const fixed = Array.isArray(data.fixed) ? data.fixed : [];
            const variable = Array.isArray(data.variable) ? data.variable : [];
            const insert = db.prepare(`INSERT INTO expense_items (user_id, year, month, type, item_id, label, amount, expense_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
            fixed.forEach(item => {
                insert.run(userId, yearStr, monthNorm, 'fixed', item.id || null, String(item.label || '').slice(0, 500), _fin(item.amount), item.date || null);
            });
            variable.forEach(item => {
                insert.run(userId, yearStr, monthNorm, 'variable', item.id || null, String(item.label || '').slice(0, 500), _fin(item.amount), item.date || null);
            });
            insert.finalize(err => {
                if (err) return reject(err);
                resolve({ fixed: fixed.length, variable: variable.length });
            });
        });
    });
}

// Veri olan yılları getir (expense_items + analyses)
function getExpenseItemYears(userId) {
    return new Promise((resolve) => {
        const years = new Set();
        // expense_items tablosundan yıllar
        db.all('SELECT DISTINCT year FROM expense_items WHERE user_id = ?', [userId || 0], (err, rows) => {
            if (!err && rows) rows.forEach(r => { const y = parseInt(r.year, 10); if (y) years.add(y); });
            // analyses tablosundan yıllar (dosya adından parse)
            db.all('SELECT sales_filename, purchase_filename FROM analyses WHERE deleted_at IS NULL', [], (err2, aRows) => {
                if (!err2 && aRows) {
                    aRows.forEach(r => {
                        const parsed = parseDateFromFilename(r.sales_filename) || parseDateFromFilename(r.purchase_filename);
                        if (parsed && parsed.year) years.add(parsed.year);
                    });
                }
                // Mevcut yılı her zaman ekle
                years.add(new Date().getFullYear());
                const sorted = Array.from(years).sort((a, b) => b - a);
                resolve(sorted);
            });
        });
    });
}

/**
 * expense_items tablosundan yıla göre toplam gider ve aylık dağılım.
 * Returns { total: number, byMonth: { '01': number, '02': number, ... } }
 */
function getExpenseItemsTotalByYear(userId, year) {
    return new Promise((resolve, reject) => {
        if (!userId || !year) return resolve({ total: 0, byMonth: {} });
        const yearStr = String(year);
        db.all(
            'SELECT month, SUM(amount) as total FROM expense_items WHERE user_id = ? AND year = ? GROUP BY month',
            [userId, yearStr],
            (err, rows) => {
                if (err) return reject(err);
                let total = 0;
                const byMonth = {};
                let yearWideTotal = 0;

                (rows || []).forEach(r => {
                    const amt = _fin(r.total);
                    total += amt;
                    if (r.month && r.month !== 'all') {
                        const key = yearStr + '-' + String(r.month).padStart(2, '0');
                        byMonth[key] = (byMonth[key] || 0) + amt;
                    } else {
                        yearWideTotal += amt;
                    }
                });

                // "Tüm yıl" giderleri 12 aya eşit dağıtılır — getMonthlyProfitLoss ile aynı kural.
                // Aksi halde panel bu giderleri hiç saymaz, Kâr/Zarar tablosu sayardı (iki farklı sonuç).
                if (yearWideTotal !== 0) {
                    const perMonth = yearWideTotal / 12;
                    for (let m = 1; m <= 12; m++) {
                        const key = yearStr + '-' + String(m).padStart(2, '0');
                        byMonth[key] = (byMonth[key] || 0) + perMonth;
                    }
                }

                resolve({ total, byMonth });
            }
        );
    });
}

function migrateExpenseItems(userId, payload) {
    return new Promise((resolve, reject) => {
        if (!userId || !Array.isArray(payload) || payload.length === 0) return resolve({ migrated: 0 });
        const items = payload;
        db.all('SELECT year, month FROM expense_items WHERE user_id = ? GROUP BY year, month', [userId], (err, existingRows) => {
            if (err) return reject(err);
            const existingKeys = new Set((existingRows || []).map(r => `${r.year}:${r.month}`));
            let migrated = 0;
            const run = (idx) => {
                if (idx >= items.length) return resolve({ migrated });
                const it = items[idx];
                const year = it.year != null ? String(it.year) : '';
                const month = (it.month === 'all' || it.month === '' || it.month == null) ? 'all' : String(parseInt(it.month, 10)).padStart(2, '0');
                const key = `${year}:${month}`;
                if (!year || existingKeys.has(key)) return run(idx + 1);
                const data = it.data && typeof it.data === 'object' ? it.data : { fixed: [], variable: [] };
                setExpenseItems(userId, year, month, data).then(() => {
                    existingKeys.add(key);
                    migrated++;
                    run(idx + 1);
                }).catch(reject);
            };
            run(0);
        });
    });
}

/**
 * Create a new user
 * @param {string} username - The username
 * @param {string} passwordHash - The hashed password
 * @param {number} isAdmin - Optional: 1 for admin, 0 for regular user
 * @returns {Promise<{success: boolean, user?: object, error?: string}>}
 */
function createUser(username, passwordHash, isAdmin = 0, status = 'pending') {
    return new Promise((resolve, reject) => {
        // Adminler ve açıkça belirtilmedikçe normal kullanıcılar onay bekler
        const effectiveStatus = isAdmin ? 'approved' : (status || 'pending');

        // Check if username already exists
        db.get('SELECT id FROM users WHERE username = ?', [username], (err, existingUser) => {
            if (err) {
                logger.error({ err }, 'Kullanıcı kontrolü hatası:');
                return reject({ success: false, error: 'Sunucu hatası.' });
            }

            if (existingUser) {
                return resolve({ success: false, error: 'Kullanıcı adı zaten mevcut' });
            }

            // Create new user with status
            const sql = `INSERT INTO users (username, password_hash, is_admin, status) VALUES (?, ?, ?, ?)`;
            db.run(sql, [username, passwordHash, isAdmin, effectiveStatus], function (err) {
                if (err) {
                    logger.error({ err }, 'Kullanıcı oluşturma hatası:');
                    return reject({ success: false, error: 'Kullanıcı oluşturulamadı.' });
                }

                resolve({
                    success: true,
                    user: {
                        id: this.lastID,
                        username: username,
                        is_admin: isAdmin,
                        status: effectiveStatus
                    }
                });
            });
        });
    });
}

/**
 * Kullanıcıyı onayla (status -> approved)
 */
function approveUser(id) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE users SET status = 'approved' WHERE id = ?`, [id], function (err) {
            if (err) {
                logger.error({ err }, 'Kullanıcı onaylama hatası:');
                return reject(err);
            }
            if (this.changes === 0) {
                return resolve({ success: false, error: 'Kullanıcı bulunamadı.' });
            }
            resolve({ success: true });
        });
    });
}

/**
 * Kullanıcıyı reddet (status -> rejected). Red edilen kullanıcı giriş yapamaz.
 */
function rejectUser(id) {
    return new Promise((resolve, reject) => {
        db.run(`UPDATE users SET status = 'rejected' WHERE id = ?`, [id], function (err) {
            if (err) {
                logger.error({ err }, 'Kullanıcı reddetme hatası:');
                return reject(err);
            }
            if (this.changes === 0) {
                return resolve({ success: false, error: 'Kullanıcı bulunamadı.' });
            }
            resolve({ success: true });
        });
    });
}

/**
 * Onay bekleyen kullanıcıları listele
 */
function getPendingUsers() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT id, username, is_admin, status, created_at
                     FROM users
                     WHERE status = 'pending'
                     ORDER BY created_at DESC`;
        db.all(sql, [], (err, rows) => {
            if (err) {
                logger.error({ err }, 'Bekleyen kullanıcıları listeleme hatası:');
                return reject(err);
            }
            resolve(rows || []);
        });
    });
}

function mapCustomerRow(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        fullName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        phone: row.phone || '',
        email: row.email || '',
        address: row.address || '',
        taxNumber: row.tax_number || '',
        balance: Number(row.balance || 0),
        notes: row.notes || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

function normalizeCustomerInput(input = {}, { forceInitialBalance = false } = {}) {
    const parsedBalance = Number(input.balance);
    return {
        firstName: String(input.firstName || '').trim(),
        lastName: String(input.lastName || '').trim(),
        phone: String(input.phone || '').trim(),
        email: String(input.email || '').trim().toLowerCase(),
        address: String(input.address || '').trim(),
        taxNumber: String(input.taxNumber || '').trim(),
        balance: forceInitialBalance ? 0 : (Number.isFinite(parsedBalance) ? parsedBalance : 0),
        notes: String(input.notes || '').trim()
    };
}

function createCustomer(userId, input) {
    const customer = normalizeCustomerInput(input, { forceInitialBalance: true });
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO customers (
            user_id, first_name, last_name, phone, email, address, tax_number, balance, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [
            userId,
            customer.firstName,
            customer.lastName,
            customer.phone,
            customer.email,
            customer.address,
            customer.taxNumber,
            customer.balance,
            customer.notes
        ], function (err) {
            if (err) {
                logger.error({ err }, 'Müşteri oluşturma hatası:');
                return reject(err);
            }
            getCustomerById(userId, this.lastID).then(resolve).catch(reject);
        });
    });
}

function buildCustomerFilters(userId, options = {}) {
    const where = ['user_id = ?'];
    const params = [userId];
    const search = String(options.search || '').trim().toLowerCase();
    const balanceStatus = String(options.balanceStatus || '').trim();

    if (search) {
        where.push(`(
            LOWER(first_name) LIKE ?
            OR LOWER(last_name) LIKE ?
            OR LOWER(email) LIKE ?
            OR LOWER(phone) LIKE ?
            OR LOWER(tax_number) LIKE ?
        )`);
        const term = `%${search}%`;
        params.push(term, term, term, term, term);
    }

    if (balanceStatus === 'positive') where.push('balance > 0');
    if (balanceStatus === 'negative') where.push('balance < 0');
    if (balanceStatus === 'zero') where.push('balance = 0');

    return { where: where.join(' AND '), params };
}

function getCustomerSortClause(sort) {
    const clauses = {
        created_desc: 'datetime(created_at) DESC, id DESC',
        created_asc: 'datetime(created_at) ASC, id ASC',
        name_asc: 'LOWER(first_name) ASC, LOWER(last_name) ASC, id ASC',
        name_desc: 'LOWER(first_name) DESC, LOWER(last_name) DESC, id DESC',
        balance_desc: 'balance DESC, id DESC',
        balance_asc: 'balance ASC, id ASC'
    };
    return clauses[sort] || clauses.created_desc;
}

function getCustomers(userId, options = {}) {
    const limit = Math.min(Math.max(parseInt(options.limit || 100, 10) || 100, 1), 500);
    const offset = Math.max(parseInt(options.offset || 0, 10) || 0, 0);
    const { where, params } = buildCustomerFilters(userId, options);
    const orderBy = getCustomerSortClause(options.sort);

    return new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) as total FROM customers WHERE ${where}`, params, (countErr, countRow) => {
            if (countErr) {
                logger.error({ err: countErr }, 'Müşteri sayma hatası:');
                return reject(countErr);
            }
            db.all(
                `SELECT * FROM customers WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
                [...params, limit, offset],
                (err, rows) => {
                    if (err) {
                        logger.error({ err }, 'Müşteri listeleme hatası:');
                        return reject(err);
                    }
                    resolve({
                        customers: (rows || []).map(mapCustomerRow),
                        total: countRow?.total || 0,
                        limit,
                        offset
                    });
                }
            );
        });
    });
}

function getCustomerById(userId, id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM customers WHERE user_id = ? AND id = ?', [userId, id], (err, row) => {
            if (err) {
                logger.error({ err }, 'Müşteri getirme hatası:');
                return reject(err);
            }
            resolve(mapCustomerRow(row));
        });
    });
}

function updateCustomer(userId, id, input) {
    const customer = normalizeCustomerInput(input);
    return new Promise((resolve, reject) => {
        const sql = `UPDATE customers
                     SET first_name = ?, last_name = ?, phone = ?, email = ?, address = ?,
                         tax_number = ?, balance = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = ? AND id = ?`;
        db.run(sql, [
            customer.firstName,
            customer.lastName,
            customer.phone,
            customer.email,
            customer.address,
            customer.taxNumber,
            customer.balance,
            customer.notes,
            userId,
            id
        ], function (err) {
            if (err) {
                logger.error({ err }, 'Müşteri güncelleme hatası:');
                return reject(err);
            }
            if (this.changes === 0) return resolve(null);
            getCustomerById(userId, id).then(resolve).catch(reject);
        });
    });
}

function deleteCustomer(userId, id) {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM customers WHERE user_id = ? AND id = ?', [userId, id], function (err) {
            if (err) {
                logger.error({ err }, 'Müşteri silme hatası:');
                return reject(err);
            }
            resolve(this.changes > 0);
        });
    });
}

function getCustomerDashboardSummary(userId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as total_count FROM customers WHERE user_id = ?', [userId], (countErr, countRow) => {
            if (countErr) return reject(countErr);
            db.all(
                'SELECT * FROM customers WHERE user_id = ? ORDER BY datetime(created_at) DESC, id DESC LIMIT 5',
                [userId],
                (recentErr, recentRows) => {
                    if (recentErr) return reject(recentErr);
                    db.get(
                        'SELECT * FROM customers WHERE user_id = ? ORDER BY balance DESC, id DESC LIMIT 1',
                        [userId],
                        (topErr, topRow) => {
                            if (topErr) return reject(topErr);
                            resolve({
                                totalCount: countRow?.total_count || 0,
                                recentCustomers: (recentRows || []).map(mapCustomerRow),
                                highestBalanceCustomer: mapCustomerRow(topRow)
                            });
                        }
                    );
                }
            );
        });
    });
}

function normalizePartyName(name) {
    return String(name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[ıİ]/g, 'i')
        .replace(/[şŞ]/g, 's')
        .replace(/[ğĞ]/g, 'g')
        .replace(/[üÜ]/g, 'u')
        .replace(/[öÖ]/g, 'o')
        .replace(/[çÇ]/g, 'c')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function splitPartyName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: 'Bilinmeyen', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function upsertCustomerFromPartyName(userId, name) {
    const cleanName = String(name || '').trim();
    const normalizedName = normalizePartyName(cleanName);
    if (!normalizedName || normalizedName === 'bilinmeyen') return null;

    const existing = await dbAll('SELECT * FROM customers WHERE user_id = ?', [userId]);
    const match = existing.find((row) => normalizePartyName(`${row.first_name || ''} ${row.last_name || ''}`) === normalizedName);
    if (match) return mapCustomerRow(match);

    const split = splitPartyName(cleanName);
    const created = await dbRun(`INSERT INTO customers (
        user_id, first_name, last_name, phone, email, address, tax_number, balance, notes
    ) VALUES (?, ?, ?, '', '', '', '', 0, ?)`, [
        userId,
        split.firstName,
        split.lastName,
        'Excel analizinden otomatik oluşturuldu.'
    ]);
    return getCustomerById(userId, created.lastID);
}

async function upsertSupplier(userId, name) {
    const cleanName = String(name || '').trim();
    const normalizedName = normalizePartyName(cleanName);
    if (!normalizedName || normalizedName === 'bilinmeyen') return null;

    await dbRun(`INSERT OR IGNORE INTO suppliers (
        user_id, name, normalized_name, phone, email, address, tax_number, notes
    ) VALUES (?, ?, ?, '', '', '', '', ?)`, [
        userId,
        cleanName,
        normalizedName,
        'Excel analizinden otomatik oluşturuldu.'
    ]);

    const row = await dbGet('SELECT * FROM suppliers WHERE user_id = ? AND normalized_name = ?', [userId, normalizedName]);
    return row ? {
        id: row.id,
        userId: row.user_id,
        name: row.name,
        normalizedName: row.normalized_name,
        phone: row.phone || '',
        email: row.email || '',
        address: row.address || '',
        taxNumber: row.tax_number || '',
        notes: row.notes || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    } : null;
}

function normalizeTransactionDate(value) {
    if (!value) return null;
    const text = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function buildPartySourceKey({ partyType, invoiceType, normalizedName, transactionDate, amount, sourceFile, sourceRowIndex }) {
    return [
        partyType,
        invoiceType,
        normalizedName,
        transactionDate || 'no-date',
        Number(amount || 0).toFixed(2),
        String(sourceFile || '').trim().toLowerCase(),
        Number(sourceRowIndex || 0)
    ].join('|');
}

async function importBusinessPartyTransactions({ userId, rows = [], historyId = null, salesFileName = '', purchaseFileName = '' } = {}) {
    const uniqueCustomers = new Set();
    const uniqueSuppliers = new Set();
    let transactionsInserted = 0;
    let transactionsSkipped = 0;
    const sourceRowCounters = { sales: 0, purchase: 0 };

    for (let index = 0; index < rows.length; index++) {
        const row = rows[index] || {};
        const invoiceType = row.type === 'purchase' ? 'purchase' : 'sales';
        sourceRowCounters[invoiceType] += 1;
        const partyType = invoiceType === 'sales' ? 'customer' : 'supplier';
        const partyName = String(row.counterparty || '').trim();
        const normalizedName = normalizePartyName(partyName);
        const amount = Number(row.gross || row.total || row.net || 0);
        if (!normalizedName || normalizedName === 'bilinmeyen' || !Number.isFinite(amount) || amount <= 0) {
            transactionsSkipped += 1;
            continue;
        }

        const party = partyType === 'customer'
            ? await upsertCustomerFromPartyName(userId, partyName)
            : await upsertSupplier(userId, partyName);
        if (!party?.id) {
            transactionsSkipped += 1;
            continue;
        }

        if (partyType === 'customer') uniqueCustomers.add(normalizedName);
        if (partyType === 'supplier') uniqueSuppliers.add(normalizedName);

        const transactionDate = normalizeTransactionDate(row.date);
        const sourceFile = invoiceType === 'sales' ? salesFileName : purchaseFileName;
        const sourceKey = buildPartySourceKey({
            partyType,
            invoiceType,
            normalizedName,
            transactionDate,
            amount,
            sourceFile,
            sourceRowIndex: sourceRowCounters[invoiceType]
        });

        const result = await dbRun(`INSERT OR IGNORE INTO party_transactions (
            user_id, party_type, party_id, party_name, normalized_name, invoice_type,
            transaction_date, amount, net, vat, description, source_history_id,
            source_file, source_row_index, source_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            userId,
            partyType,
            party.id,
            partyName,
            normalizedName,
            invoiceType,
            transactionDate,
            amount,
            Number(row.net || 0),
            Number(row.vat || row.tax || 0),
            '',
            historyId,
            sourceFile,
            sourceRowCounters[invoiceType],
            sourceKey
        ]);

        if (result.changes > 0) transactionsInserted += 1;
        else transactionsSkipped += 1;
    }

    return {
        customers: uniqueCustomers.size,
        suppliers: uniqueSuppliers.size,
        transactionsInserted,
        transactionsSkipped,
        rowsScanned: rows.length
    };
}

function mapBusinessPartyAggregate(row) {
    const totalVolume = Number(row.totalVolume || 0);
    const salesVolume = Number(row.salesVolume || 0);
    const purchaseVolume = Number(row.purchaseVolume || 0);
    return {
        id: row.id,
        type: row.type,
        name: row.name || '-',
        totalVolume,
        transactionCount: Number(row.transactionCount || 0),
        lastTransactionDate: row.lastTransactionDate || null,
        lastTransactionAmount: Number(row.lastTransactionAmount || 0),
        averageAmount: Number(row.averageAmount || 0),
        balance: salesVolume - purchaseVolume,
        createdAt: row.createdAt || null
    };
}

function sortBusinessParties(parties, sort) {
    const sorted = [...parties];
    if (sort === 'volume_asc') sorted.sort((a, b) => a.totalVolume - b.totalVolume || a.name.localeCompare(b.name, 'tr'));
    else if (sort === 'name_asc') sorted.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    else if (sort === 'name_desc') sorted.sort((a, b) => b.name.localeCompare(a.name, 'tr'));
    else if (sort === 'recent_desc') sorted.sort((a, b) => String(b.lastTransactionDate || '').localeCompare(String(a.lastTransactionDate || '')));
    else sorted.sort((a, b) => b.totalVolume - a.totalVolume || a.name.localeCompare(b.name, 'tr'));
    return sorted;
}

// Kaynağı artık canlı olmayan cari hareketlerini hariç tutan SQL parçası.
// party_transactions'a dokunan HER toplulaştırma sorgusu bunu kullanmalıdır; süzgeci elle
// tekrarlamak yerine buradan çağırmak, yeni bir sorgu eklendiğinde unutulmasını engeller.
//
// Bir satır ancak şu iki durumdan birinde canlı sayılır:
//  1. `source_history_id` NULL — cari import'tan önce yazılmış eski satırlar. Bunların bağlanacağı
//     bir analiz kaydı hiç olmadı; süzülürlerse kullanıcı gözünde veri kaybı olur.
//  2. Bağlı olduğu `analyses` satırı DURUYOR ve soft-delete edilmemiş (`deleted_at IS NULL`).
//
// Böylece iki ayrı sızıntı birden kapanır:
//  - çöpe atılmış (soft-delete) analizin hareketleri,
//  - çöpten KALICI silinmiş analizin geride bıraktığı sahipsiz (dangling id) hareketler.
//    Kalıcı silme yalnız `analyses` satırını kaldırır; eski "NOT EXISTS + deleted_at IS NOT NULL"
//    süzgeci bu satırları canlı sayıyordu (gerçek veritabanında 118 satır, Haziran 2026).
// `alias` yalnız kod içinden sabit değerlerle çağrılır, kullanıcı girdisi değildir.
function livePartyTransactionCondition(alias = 'party_transactions') {
    return `(${alias}.source_history_id IS NULL OR EXISTS (
        SELECT 1 FROM analyses live_src
        WHERE live_src.id = ${alias}.source_history_id
          AND live_src.deleted_at IS NULL))`;
}

async function getBusinessParties(userId, options = {}) {
    const type = options.type === 'supplier' ? 'supplier' : 'customer';
    const limit = Math.min(Math.max(parseInt(options.limit || 100, 10) || 100, 1), 500);
    const offset = Math.max(parseInt(options.offset || 0, 10) || 0, 0);
    const where = ['user_id = ?', 'party_type = ?', livePartyTransactionCondition()];
    const params = [userId, type];
    const search = String(options.search || '').trim().toLowerCase();
    const minVolume = Number(options.minVolume || 0);

    if (search) {
        where.push('LOWER(party_name) LIKE ?');
        params.push(`%${search}%`);
    }
    if (options.dateFrom) {
        where.push("substr(transaction_date, 1, 7) >= ?");
        params.push(String(options.dateFrom));
    }
    if (options.dateTo) {
        where.push("substr(transaction_date, 1, 7) <= ?");
        params.push(String(options.dateTo));
    }

    const rows = await dbAll(`SELECT
            party_id as id,
            party_type as type,
            party_name as name,
            SUM(amount) as totalVolume,
            SUM(CASE WHEN invoice_type = 'sales' THEN amount ELSE 0 END) as salesVolume,
            SUM(CASE WHEN invoice_type = 'purchase' THEN amount ELSE 0 END) as purchaseVolume,
            COUNT(*) as transactionCount,
            MAX(transaction_date) as lastTransactionDate,
            -- Son işlemin TUTARI: en yeni tarihli satırın amount değeri. Bu sütun hiç seçilmiyordu,
            -- mapBusinessPartyAggregate okuduğu için API her zaman 0 döndürüyordu.
            (SELECT pt2.amount FROM party_transactions pt2
              WHERE pt2.party_id = party_transactions.party_id
                AND pt2.party_type = party_transactions.party_type
                AND pt2.user_id = party_transactions.user_id
                AND ${livePartyTransactionCondition('pt2')}
              ORDER BY pt2.transaction_date DESC, pt2.id DESC LIMIT 1) as lastTransactionAmount,
            AVG(amount) as averageAmount,
            MAX(created_at) as createdAt
        FROM party_transactions
        WHERE ${where.join(' AND ')}
        GROUP BY party_type, party_id`, params);

    let parties = rows.map(mapBusinessPartyAggregate);
    if (minVolume > 0) {
        parties = parties.filter((party) => party.totalVolume >= minVolume);
    }
    parties = sortBusinessParties(parties, options.sort || 'volume_desc');

    return {
        parties: parties.slice(offset, offset + limit),
        total: parties.length,
        limit,
        offset
    };
}

async function getBusinessPartyDetail(userId, type, id) {
    const partyType = type === 'supplier' ? 'supplier' : 'customer';
    const transactions = await dbAll(`SELECT *
        FROM party_transactions
        WHERE user_id = ? AND party_type = ? AND party_id = ?
          AND ${livePartyTransactionCondition()}
        ORDER BY date(transaction_date) DESC, id DESC`, [userId, partyType, id]);
    if (transactions.length === 0) return null;

    const mappedTransactions = transactions.map((row) => ({
        id: row.id,
        date: row.transaction_date,
        amount: Number(row.amount || 0),
        net: Number(row.net || 0),
        vat: Number(row.vat || 0),
        invoiceType: row.invoice_type,
        description: row.description || '',
        sourceFile: row.source_file || ''
    }));
    const totalVolume = mappedTransactions.reduce((sum, row) => sum + row.amount, 0);
    const salesVolume = mappedTransactions.filter((row) => row.invoiceType === 'sales').reduce((sum, row) => sum + row.amount, 0);
    const purchaseVolume = mappedTransactions.filter((row) => row.invoiceType === 'purchase').reduce((sum, row) => sum + row.amount, 0);
    const monthlyMap = new Map();
    mappedTransactions.forEach((row) => {
        const month = row.date ? row.date.slice(0, 7) : 'Tarihsiz';
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + row.amount);
    });
    const monthly = Array.from(monthlyMap.entries())
        .map(([month, amount]) => ({ month, amount }))
        .sort((a, b) => String(a.month).localeCompare(String(b.month)));
    const trend = monthly.slice(-12);
    const latest = mappedTransactions[0];

    return {
        party: {
            id: Number(id),
            type: partyType,
            name: transactions[0].party_name
        },
        metrics: {
            totalVolume,
            transactionCount: mappedTransactions.length,
            balance: salesVolume - purchaseVolume,
            lastTransactionDate: latest?.date || null,
            lastTransactionAmount: latest?.amount || 0,
            averageAmount: mappedTransactions.length ? totalVolume / mappedTransactions.length : 0
        },
        monthly,
        trend,
        transactions: mappedTransactions
    };
}

async function getBusinessPartyDashboardSummary(userId) {
    const customerRows = await getBusinessParties(userId, { type: 'customer', sort: 'volume_desc', limit: 3 });
    const supplierRows = await getBusinessParties(userId, { type: 'supplier', sort: 'volume_desc', limit: 3 });
    const totalCustomers = await dbGet(`SELECT COUNT(DISTINCT party_id) as total
        FROM party_transactions WHERE user_id = ? AND party_type = 'customer'
          AND ${livePartyTransactionCondition()}`, [userId]);
    const totalSuppliers = await dbGet(`SELECT COUNT(DISTINCT party_id) as total
        FROM party_transactions WHERE user_id = ? AND party_type = 'supplier'
          AND ${livePartyTransactionCondition()}`, [userId]);
    const recentRows = await dbAll(`SELECT
            party_id as id,
            party_type as type,
            party_name as name,
            SUM(amount) as totalVolume,
            SUM(CASE WHEN invoice_type = 'sales' THEN amount ELSE 0 END) as salesVolume,
            SUM(CASE WHEN invoice_type = 'purchase' THEN amount ELSE 0 END) as purchaseVolume,
            COUNT(*) as transactionCount,
            MAX(transaction_date) as lastTransactionDate,
            AVG(amount) as averageAmount,
            MAX(created_at) as createdAt
        FROM party_transactions
        WHERE user_id = ?
          AND ${livePartyTransactionCondition()}
        GROUP BY party_type, party_id
        ORDER BY datetime(MAX(created_at)) DESC, MAX(transaction_date) DESC
        LIMIT 5`, [userId]);

    return {
        totalCustomers: Number(totalCustomers?.total || 0),
        totalSuppliers: Number(totalSuppliers?.total || 0),
        topCustomers: customerRows.parties,
        topSuppliers: supplierRows.parties,
        recentParties: recentRows.map(mapBusinessPartyAggregate)
    };
}

// --- User Management Functions (Admin) ---

/**
 * Get all users (without password hashes)
 * @returns {Promise<Array>} Array of user objects
 */
function getAllUsers() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT id, username, is_admin, status, created_at FROM users ORDER BY created_at DESC`;
        db.all(sql, [], (err, rows) => {
            if (err) {
                logger.error({ err }, 'Kullanıcı listeleme hatası:');
                return reject(err);
            }
            resolve(rows || []);
        });
    });
}

/**
 * Get user by ID (without password hash)
 * @param {number} id - User ID
 * @returns {Promise<Object|null>} User object or null
 */
function getUserById(id) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT id, username, is_admin, status, created_at FROM users WHERE id = ?`;
        db.get(sql, [id], (err, row) => {
            if (err) {
                logger.error({ err }, 'Kullanıcı getirme hatası:');
                return reject(err);
            }
            resolve(row || null);
        });
    });
}

/**
 * Delete user by ID (cannot delete self)
 * @param {number} id - User ID to delete
 * @param {number} currentUserId - ID of currently logged in user (to prevent self-deletion)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function deleteUser(id, currentUserId) {
    return new Promise((resolve, reject) => {
        // Prevent self-deletion
        if (parseInt(id, 10) === parseInt(currentUserId, 10)) {
            return resolve({ success: false, error: 'Kullanıcı kendini silemez' });
        }

        // Check if user exists
        db.get('SELECT id FROM users WHERE id = ?', [id], (err, user) => {
            if (err) {
                logger.error({ err }, 'Kullanıcı kontrol hatası:');
                return reject(err);
            }
            if (!user) {
                return resolve({ success: false, error: 'Kullanıcı bulunamadı' });
            }

            // Delete related data first (expense_items, analyses, user_preferences, summaries)
            const deleteRelated = [
                { table: 'party_transactions', key: 'user_id' },
                { table: 'suppliers', key: 'user_id' },
                { table: 'expense_items', key: 'user_id' },
                { table: 'customers', key: 'user_id' },
                { table: 'analyses', key: 'user_id' },
                { table: 'user_preferences', key: 'user_id' },
                { table: 'summaries', key: 'user_id' }
            ];

            let deletedCount = 0;
            const totalTables = deleteRelated.length;

            deleteRelated.forEach(({ table, key }) => {
                db.run(`DELETE FROM ${table} WHERE ${key} = ?`, [id], (delErr) => {
                    if (delErr) {
                        logger.error({ err: delErr }, `${table} silme hatası:`);
                    }
                    deletedCount++;
                    if (deletedCount === totalTables) {
                        // Now delete the user
                        db.run('DELETE FROM users WHERE id = ?', [id], (userDelErr) => {
                            if (userDelErr) {
                                logger.error({ err: userDelErr }, 'Kullanıcı silme hatası:');
                                return reject(userDelErr);
                            }
                            resolve({ success: true });
                        });
                    }
                });
            });
        });
    });
}

/**
 * Update user role
 * @param {number} id - User ID
 * @param {string} role - New role ('admin' or 'user')
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function updateUserRole(id, role) {
    return new Promise((resolve, reject) => {
        const isAdmin = role === 'admin' ? 1 : 0;
        
        db.run('UPDATE users SET is_admin = ? WHERE id = ?', [isAdmin, id], function (err) {
            if (err) {
                logger.error({ err }, 'Kullanıcı rolü güncelleme hatası:');
                return reject(err);
            }
            if (this.changes === 0) {
                return resolve({ success: false, error: 'Kullanıcı bulunamadı' });
            }
            resolve({ success: true });
        });
    });
}

/**
 * Get top N customers by total sales/purchase amount
 * @param {number} userId - User ID
 * @param {number} year - Year to filter
 * @param {string} type - 'sales' or 'purchase'
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of top customers with totals and percentages
 */
// month: 1-12 veya null/'all'. Dönem bilgisi dosya adından okunur (geçmiş sayfasıyla aynı kural).
function getTopCustomers(userId, year, type = 'sales', _limit = 100, month = null) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT
            sales_json, purchase_json, sales_filename, purchase_filename,
            sales_amount, purchase_amount, date
            FROM analyses WHERE user_id = ? AND deleted_at IS NULL`;
        
        db.all(sql, [userId], (err, rows) => {
            if (err) return reject(err);
            
            // Tüm yıllar için tek bir toplam hesapla
            const customerTotals = {};
            let grandTotal = 0;
            
            for (const row of (rows || [])) {
                // Yıl bilgisini filename veya date'den al
                const filename = type === 'sales' ? row.sales_filename : row.purchase_filename;
                const dateInfo = parseDateFromFilename(filename);
                const rowYear = dateInfo ? String(dateInfo.year) : null;
                
                // Eğer year parametresi varsa (ve "all" değilse), o yılı filtrele
                if (year && year !== 'all' && rowYear !== String(year)) continue;

                // Ay filtresi (yalnızca belirli bir ay seçildiyse)
                const rowMonth = dateInfo ? dateInfo.month : null;
                if (month && month !== 'all' && Number(rowMonth) !== Number(month)) continue;
                
                // Get the appropriate JSON
                const jsonStr = type === 'sales' ? row.sales_json : row.purchase_json;
                if (!jsonStr) continue;
                
                let jsonObj;
                try {
                    jsonObj = JSON.parse(jsonStr) || {};
                } catch (e) {
                    continue;
                }
                
                if (!rowYear) continue;
                
                const topProducts = jsonObj.topProducts || [];
                for (const item of topProducts) {
                    const name = item.name || 'Bilinmeyen';
                    const total = item.total || 0;
                    
                    if (!customerTotals[name]) {
                        customerTotals[name] = { name, total: 0, quantity: 0, tax: 0 };
                    }
                    customerTotals[name].total += total;
                    customerTotals[name].quantity += item.quantity || 0;
                    customerTotals[name].tax += item.tax || 0;
                    grandTotal += total;
                }
            }
            
            let result;
            
            // Eğer "Tüm Yıllar" seçiliyse (year === 'all' veya year yok)
            if (!year || year === 'all') {
                // Tüm verileri topla ve en yüksek 10'u döndür
                result = Object.values(customerTotals)
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 10)
                    .map((item, index) => ({
                        year: 'Tüm Yıllar',
                        rank: index + 1,
                        name: item.name,
                        total: item.total,
                        quantity: item.quantity,
                        tax: item.tax,
                        percentage: grandTotal > 0 ? (item.total / grandTotal * 100).toFixed(1) : 0
                    }));
            } else {
                // Belirli bir yıl seçili - yıl bazlı partition uygula
                const yearCustomerTotals = {};
                const yearGrandTotals = {};
                
                // Aynı işlemi tekrarla ama bu sefer yıla göre grupla
                for (const row of (rows || [])) {
                    const filename = type === 'sales' ? row.sales_filename : row.purchase_filename;
                    const dateInfo = parseDateFromFilename(filename);
                    const rowYear = dateInfo ? String(dateInfo.year) : null;
                    
                    if (rowYear !== String(year)) continue;

                    // Ay filtresi bu ikinci (yıl bazlı) döngüde de uygulanmalı;
                    // yoksa yıl seçiliyken ay seçimi hiç etkisiz kalır.
                    const rowMonthInYear = dateInfo ? dateInfo.month : null;
                    if (month && month !== 'all' && Number(rowMonthInYear) !== Number(month)) continue;
                    
                    const jsonStr = type === 'sales' ? row.sales_json : row.purchase_json;
                    if (!jsonStr) continue;
                    
                    let jsonObj;
                    try {
                        jsonObj = JSON.parse(jsonStr) || {};
                    } catch (e) {
                        continue;
                    }
                    
                    if (!rowYear) continue;
                    if (!yearCustomerTotals[rowYear]) {
                        yearCustomerTotals[rowYear] = {};
                        yearGrandTotals[rowYear] = 0;
                    }
                    
                    const topProducts = jsonObj.topProducts || [];
                    for (const item of topProducts) {
                        const name = item.name || 'Bilinmeyen';
                        const total = item.total || 0;
                        
                        if (!yearCustomerTotals[rowYear][name]) {
                            yearCustomerTotals[rowYear][name] = { name, total: 0, quantity: 0, tax: 0 };
                        }
                        yearCustomerTotals[rowYear][name].total += total;
                        yearCustomerTotals[rowYear][name].quantity += item.quantity || 0;
                        yearCustomerTotals[rowYear][name].tax += item.tax || 0;
                        yearGrandTotals[rowYear] += total;
                    }
                }
                
                // Her yıl için ayrı sırala ve limit uygula
                result = [];
                const years = Object.keys(yearCustomerTotals).sort();
                
                for (const y of years) {
                    const yearData = Object.values(yearCustomerTotals[y])
                        .sort((a, b) => b.total - a.total)
                        .slice(0, 10);
                    
                    const yearResults = yearData.map((item, index) => ({
                        year: y,
                        rank: index + 1,
                        name: item.name,
                        total: item.total,
                        quantity: item.quantity,
                        tax: item.tax,
                        percentage: yearGrandTotals[y] > 0 ? (item.total / yearGrandTotals[y] * 100).toFixed(1) : 0
                    }));
                    
                    result = result.concat(yearResults);
                }
                
                result.sort((a, b) => b.year - a.year);
            }
            
            resolve(result);
        });
    });
}

/**
 * Get top N products by quantity or amount
 * @param {number} userId - User ID
 * @param {number} year - Year to filter
 * @param {string} type - 'sales' or 'purchase'
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of top products with totals and percentages
 */
// month: 1-12 veya null/'all'. Dönem bilgisi dosya adından okunur.
function getTopProducts(userId, year, type = 'sales', _limit = 100, month = null) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT sales_json, purchase_json, sales_filename, purchase_filename, date
                     FROM analyses WHERE user_id = ? AND deleted_at IS NULL`;
        
        db.all(sql, [userId], (err, rows) => {
            if (err) return reject(err);
            
            // Tüm yıllar için tek bir toplam hesapla
            const productTotals = {};
            let grandTotalQuantity = 0;
            
            for (const row of (rows || [])) {
                // Yıl bilgisini filename veya date'den al
                const filename = type === 'sales' ? row.sales_filename : row.purchase_filename;
                const dateInfo = parseDateFromFilename(filename);
                const rowYear = dateInfo ? String(dateInfo.year) : null;
                
                // Eğer year parametresi varsa (ve "all" değilse), o yılı filtrele
                if (year && year !== 'all' && rowYear !== String(year)) continue;

                // Ay filtresi (yalnızca belirli bir ay seçildiyse)
                const rowMonth = dateInfo ? dateInfo.month : null;
                if (month && month !== 'all' && Number(rowMonth) !== Number(month)) continue;
                
                // Get the appropriate JSON
                const jsonStr = type === 'sales' ? row.sales_json : row.purchase_json;
                if (!jsonStr) continue;
                
                let jsonObj;
                try {
                    jsonObj = JSON.parse(jsonStr) || {};
                } catch (e) {
                    continue;
                }
                
                if (!rowYear) continue;
                
                const topProducts = jsonObj.topProducts || [];
                for (const item of topProducts) {
                    const name = item.name || 'Bilinmeyen';
                    const total = item.total || 0;
                    const quantity = item.quantity || 0;
                    
                    if (!productTotals[name]) {
                        productTotals[name] = { name, total: 0, quantity: 0, tax: 0 };
                    }
                    productTotals[name].total += total;
                    productTotals[name].quantity += quantity;
                    productTotals[name].tax += item.tax || 0;
                    grandTotalQuantity += quantity;
                }
            }
            
            let result;
            
            // Eğer "Tüm Yıllar" seçiliyse (year === 'all' veya year yok)
            if (!year || year === 'all') {
                // Tüm verileri topla ve en yüksek 10'u döndür
                result = Object.values(productTotals)
                    .sort((a, b) => b.quantity - a.quantity)
                    .slice(0, 10)
                    .map((item, index) => ({
                        year: 'Tüm Yıllar',
                        rank: index + 1,
                        name: item.name,
                        total: item.total,
                        quantity: item.quantity,
                        tax: item.tax,
                        percentage: grandTotalQuantity > 0 ? (item.quantity / grandTotalQuantity * 100).toFixed(1) : 0
                    }));
            } else {
                // Belirli bir yıl seçili - yıl bazlı partition uygula
                const yearProductTotals = {};
                const yearGrandTotals = {};
                
                // Aynı işlemi tekrarla ama bu sefer yıla göre grupla
                for (const row of (rows || [])) {
                    const filename = type === 'sales' ? row.sales_filename : row.purchase_filename;
                    const dateInfo = parseDateFromFilename(filename);
                    const rowYear = dateInfo ? String(dateInfo.year) : null;
                    
                    if (rowYear !== String(year)) continue;

                    // Ay filtresi bu ikinci (yıl bazlı) döngüde de uygulanmalı;
                    // yoksa yıl seçiliyken ay seçimi hiç etkisiz kalır.
                    const rowMonthInYear = dateInfo ? dateInfo.month : null;
                    if (month && month !== 'all' && Number(rowMonthInYear) !== Number(month)) continue;
                    
                    const jsonStr = type === 'sales' ? row.sales_json : row.purchase_json;
                    if (!jsonStr) continue;
                    
                    let jsonObj;
                    try {
                        jsonObj = JSON.parse(jsonStr) || {};
                    } catch (e) {
                        continue;
                    }
                    
                    if (!rowYear) continue;
                    if (!yearProductTotals[rowYear]) {
                        yearProductTotals[rowYear] = {};
                        yearGrandTotals[rowYear] = { amount: 0, quantity: 0 };
                    }
                    
                    const topProducts = jsonObj.topProducts || [];
                    for (const item of topProducts) {
                        const name = item.name || 'Bilinmeyen';
                        const total = item.total || 0;
                        const quantity = item.quantity || 0;
                        
                        if (!yearProductTotals[rowYear][name]) {
                            yearProductTotals[rowYear][name] = { name, total: 0, quantity: 0, tax: 0 };
                        }
                        yearProductTotals[rowYear][name].total += total;
                        yearProductTotals[rowYear][name].quantity += quantity;
                        yearProductTotals[rowYear][name].tax += item.tax || 0;
                        yearGrandTotals[rowYear].amount += total;
                        yearGrandTotals[rowYear].quantity += quantity;
                    }
                }
                
                // Her yıl için ayrı sırala ve limit uygula
                result = [];
                const years = Object.keys(yearProductTotals).sort();
                
                for (const y of years) {
                    const yearData = Object.values(yearProductTotals[y])
                        .sort((a, b) => b.quantity - a.quantity)
                        .slice(0, 10);
                    
                    const yearResults = yearData.map((item, index) => ({
                        year: y,
                        rank: index + 1,
                        name: item.name,
                        total: item.total,
                        quantity: item.quantity,
                        tax: item.tax,
                        percentage: yearGrandTotals[y].quantity > 0 ? (item.quantity / yearGrandTotals[y].quantity * 100).toFixed(1) : 0
                    }));
                    
                    result = result.concat(yearResults);
                }
                
                result.sort((a, b) => b.year - a.year);
            }
            
            resolve(result);
        });
    });
}

/**
 * Get available years from analyses
 * @param {number} userId - User ID
 * @returns {Promise<Array>} - Array of years
 */
function getAvailableYears(userId) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT sales_filename, purchase_filename FROM analyses WHERE user_id = ? AND deleted_at IS NULL`;
        
        db.all(sql, [userId], (err, rows) => {
            if (err) return reject(err);
            
            const years = new Set();
            const currentYear = new Date().getFullYear();
            years.add(currentYear);
            
            for (const row of (rows || [])) {
                // Check sales filename
                if (row.sales_filename) {
                    const dateInfo = parseDateFromFilename(row.sales_filename);
                    if (dateInfo && dateInfo.year) {
                        years.add(dateInfo.year);
                    }
                }
                // Check purchase filename
                if (row.purchase_filename) {
                    const dateInfo = parseDateFromFilename(row.purchase_filename);
                    if (dateInfo && dateInfo.year) {
                        years.add(dateInfo.year);
                    }
                }
            }
            
            const sortedYears = Array.from(years).sort((a, b) => b - a);
            resolve(sortedYears);
        });
    });
}

/**
 * Get monthly profit/loss breakdown
 * @param {number} userId - User ID
 * @param {number} year - Year
 * @returns {Promise<Object>} - Monthly breakdown with totals
 */
async function getMonthlyProfitLoss(userId, year) {
    return new Promise(async (resolve, reject) => {
        try {
            // Get all analyses for the year
            const sql = `SELECT user_id, date, sales_filename, purchase_filename, sales_amount, purchase_amount, sales_tax, purchase_tax,
                         sales_json, purchase_json
                 FROM analyses WHERE user_id = ? AND deleted_at IS NULL ORDER BY date ASC`;

            db.all(sql, [userId], (err, rows) => {
                if (err) return reject(err);

                const monthlyMap = {};
                const monthNames = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

                // Initialize all months
                for (let m = 1; m <= 12; m++) {
                    const key = `${year}-${String(m).padStart(2, '0')}`;
                    monthlyMap[key] = {
                        month: m,
                        monthName: monthNames[m],
                        sales: 0,
                        purchases: 0,
                        salesTax: 0,
                        purchaseTax: 0,
                        grossProfit: 0,
                        expenses: 0,
                        netProfit: 0,
                        profitMargin: 0
                    };
                }

                // Process analyses
                for (const row of (rows || [])) {
                    let key = null;
                    const fromSales = parseDateFromFilename(row.sales_filename);
                    const fromPurchase = parseDateFromFilename(row.purchase_filename);
                    if (fromSales) {
                        key = `${fromSales.year}-${String(fromSales.month).padStart(2, '0')}`;
                    } else if (fromPurchase) {
                        key = `${fromPurchase.year}-${String(fromPurchase.month).padStart(2, '0')}`;
                    }
                    if (!key) {
                        const d = new Date(row.date);
                        if (isNaN(d.getTime())) continue;
                        key = d.toISOString().slice(0, 7);
                    }
                    if (key.slice(0, 4) !== String(year)) continue;
                    if (!monthlyMap[key]) continue;

                    // Get sales amount
                    let salesAmt = _fin(row.sales_amount);
                    // Get purchase amount
                    let purchaseAmt = _fin(row.purchase_amount);

                    // Fallback: read from JSON blobs if DB columns were 0
                    if (salesAmt === 0 || purchaseAmt === 0) {
                        let salesObj = null;
                        let purchaseObj = null;
                        try { salesObj = JSON.parse(row.sales_json || '{}'); } catch (_) { salesObj = {}; }
                        try { purchaseObj = JSON.parse(row.purchase_json || '{}'); } catch (_) { purchaseObj = {}; }

                        if (salesAmt === 0) {
                            salesAmt = pickNum(salesObj, ['totalAmount', 'total_amount', 'gross', 'Genel Toplam', 'gross_amount']);
                        }
                        if (purchaseAmt === 0) {
                            purchaseAmt = pickNum(purchaseObj, ['totalAmount', 'total_amount', 'gross', 'Genel Toplam', 'gross_amount']);
                        }
                    }

                    monthlyMap[key].sales += salesAmt;
                    monthlyMap[key].purchases += purchaseAmt;
                    monthlyMap[key].salesTax += _fin(row.sales_tax);
                    monthlyMap[key].purchaseTax += _fin(row.purchase_tax);
                }

                // Now get expenses
                db.all(
                    'SELECT month, SUM(amount) as total FROM expense_items WHERE user_id = ? AND year = ?',
                    [userId, String(year)],
                    (errExp, expenseRows) => {
                        if (errExp) return reject(errExp);

                        // Distribute expenses to months
                        for (const expRow of (expenseRows || [])) {
                            const amt = _fin(expRow.total);
                            if (!amt) continue;

                            const expMonth = expRow.month;
                            if (expMonth === 'all') {
                                // Distribute to all months
                                for (let m = 1; m <= 12; m++) {
                                    const key = `${year}-${String(m).padStart(2, '0')}`;
                                    if (monthlyMap[key]) {
                                        monthlyMap[key].expenses += amt / 12;
                                    }
                                }
                            } else if (expMonth >= 1 && expMonth <= 12) {
                                const key = `${year}-${String(expMonth).padStart(2, '0')}`;
                                if (monthlyMap[key]) {
                                    monthlyMap[key].expenses += amt;
                                }
                            }
                        }

                        // Calculate profits for each month
                        let totals = {
                            sales: 0,
                            purchases: 0,
                            grossProfit: 0,
                            expenses: 0,
                            netProfit: 0,
                            avgProfitMargin: 0
                        };

                        const months = [];
                        for (let m = 1; m <= 12; m++) {
                            const key = `${year}-${String(m).padStart(2, '0')}`;
                            const data = monthlyMap[key];
                            // Brüt kâr KDV hariç: (satış - satış KDV) - (alış - alış KDV)
                            data.grossProfit = (data.sales - data.salesTax) - (data.purchases - data.purchaseTax);
                            data.netProfit = data.grossProfit - data.expenses;
                            data.profitMargin = data.sales > 0 ? Math.round((data.netProfit / data.sales) * 1000) / 10 : 0;

                            totals.sales += data.sales;
                            totals.purchases += data.purchases;
                            totals.grossProfit += data.grossProfit;
                            totals.expenses += data.expenses;
                            totals.netProfit += data.netProfit;

                            months.push(data);
                        }

                        totals.avgProfitMargin = totals.sales > 0 ? Math.round((totals.netProfit / totals.sales) * 1000) / 10 : 0;

                        resolve({
                            success: true,
                            year,
                            months,
                            totals
                        });
                    }
                );
            });
        } catch (error) {
            reject(error);
        }
    });
}

function getBreakEvenData(userId, year) {
    return new Promise(async (resolve, reject) => {
        try {
            const yearStr = String(year);

            const fixedSql = `SELECT SUM(amount) as total FROM expense_items 
                             WHERE user_id = ? AND year = ? AND type = 'fixed' AND month != 'all'`;

            const variableSql = `SELECT SUM(amount) as total FROM expense_items 
                                WHERE user_id = ? AND year = ? AND type = 'variable' AND month != 'all'`;

            const revenueSql = `SELECT SUM(total_sales) as total FROM summaries 
                               WHERE user_id = ? AND year = ?`;

            const [fixedRows, variableRows, revenueRows] = await Promise.all([
                new Promise((res, rej) => db.all(fixedSql, [userId, yearStr], (err, rows) => err ? rej(err) : res(rows))),
                new Promise((res, rej) => db.all(variableSql, [userId, yearStr], (err, rows) => err ? rej(err) : res(rows))),
                new Promise((res, rej) => db.all(revenueSql, [userId, yearStr], (err, rows) => err ? rej(err) : res(rows)))
            ]);

            const totalFixed = _fin((fixedRows[0]?.total) || 0);
            const totalVariable = _fin((variableRows[0]?.total) || 0);
            const totalRevenue = _fin((revenueRows[0]?.total) || 0);

            const variableCostRatio = totalRevenue > 0 ? totalVariable / totalRevenue : 0;
            const breakEvenPoint = variableCostRatio < 1 && totalFixed > 0
                ? Math.round(totalFixed / (1 - variableCostRatio))
                : null;
            const marginOfSafety = breakEvenPoint ? Math.max(0, totalRevenue - breakEvenPoint) : null;
            const marginOfSafetyPct = totalRevenue > 0 && marginOfSafety
                ? Number(((marginOfSafety / totalRevenue) * 100).toFixed(1))
                : null;

            resolve({
                year,
                fixedCosts: totalFixed,
                variableCosts: totalVariable,
                totalRevenue,
                variableCostRatio: Number((variableCostRatio * 100).toFixed(1)),
                breakEvenPoint,
                breakEvenReached: breakEvenPoint ? totalRevenue >= breakEvenPoint : null,
                marginOfSafety,
                marginOfSafetyPct,
                monthlyBreakdown: []
            });
        } catch (err) {
            reject(err);
        }
    });
}

module.exports = {
    logAuditEvent,
    getAuditLogs,
    addToHistory,
    getHistory,
    getHistoryCount,
    getHistoryYears,
    getHistoryById,
    getHistoryByIds,
    updateHistoryEntry,
    deleteHistoryById,
    deleteHistoryBatch,
    clearHistory,
    checkDuplicateReport,
    deleteReportsByPeriodType,
    // Trash functions
    getTrashHistory,
    restoreFromTrash,
    restoreHistoryBatch,
    permanentlyDeleteFromTrash,
    permanentlyDeleteTrashBatch,
    emptyTrash,
    getTrashCount,
    parseDateFromFilename,
    addAnalysisSummary,
    getAnalysisHistory,
    getMonthlyTotals,
    getMonthlyTotalsInRange,
    fillMissingMonths,
    getUserPreferences,
    setUserPreference,
    migrateUserPreferences,
    getExpenseItems,
    setExpenseItems,
    migrateExpenseItems,
    getExpenseItemYears,
    getExpenseItemsTotalByYear,
    // Summary functions
    saveSummary,
    getSummary,
    getSummariesByYear,
    deleteSummary,
    computeAndSaveSummary,
    // User functions
    createUser,
    getAllUsers,
    getUserById,
    deleteUser,
    updateUserRole,
    approveUser,
    rejectUser,
    getPendingUsers,
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
    getCustomerDashboardSummary,
    importBusinessPartyTransactions,
    getBusinessParties,
    getBusinessPartyDetail,
    getBusinessPartyDashboardSummary,
    // Top N functions
    getTopCustomers,
    getTopProducts,
    getAvailableYears,
    // Profit/Loss functions
    getMonthlyProfitLoss,
    getBreakEvenData
};
