const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.resolve(__dirname, '../data');

function getArchivePath(year) {
    return path.join(DATA_DIR, `archive_${year}.db`);
}

function archivedYears() {
    if (!fs.existsSync(DATA_DIR)) return [];
    return fs.readdirSync(DATA_DIR)
        .filter(f => f.startsWith('archive_') && f.endsWith('.db'))
        .map(f => f.replace('archive_', '').replace('.db', ''))
        .map(Number)
        .filter(n => !isNaN(n))
        .sort((a, b) => b - a);
}

function openDb(dbPath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

function run(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function all(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function archiveYear(year, mainDb) {
    const archiveFile = getArchivePath(year);
    if (fs.existsSync(archiveFile)) {
        throw new Error(`${year} yılı zaten arşivlenmiş.`);
    }

    const yearStr = String(year);
    const archiveDb = await openDb(archiveFile);

    try {
        await run(archiveDb, `CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            date DATETIME DEFAULT CURRENT_TIMESTAMP,
            display_date TEXT,
            sales_filename TEXT,
            purchase_filename TEXT,
            sales_amount REAL,
            purchase_amount REAL,
            sales_tax REAL,
            purchase_tax REAL,
            net_profit REAL,
            sales_json TEXT,
            purchase_json TEXT,
            summary TEXT,
            deleted_at DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await run(archiveDb, `CREATE TABLE IF NOT EXISTS summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            year TEXT NOT NULL,
            month TEXT NOT NULL,
            total_sales REAL,
            total_purchases REAL,
            total_vat REAL,
            gross_profit REAL,
            total_expenses REAL,
            net_profit REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await run(archiveDb, `CREATE TABLE IF NOT EXISTS expense_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            year TEXT NOT NULL,
            month TEXT NOT NULL,
            type TEXT NOT NULL,
            item_id TEXT,
            label TEXT,
            amount REAL NOT NULL,
            expense_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Copy analyses for the given year
        const analysesRows = await all(mainDb,
            `SELECT * FROM analyses WHERE (date LIKE ? OR display_date LIKE ?) AND deleted_at IS NULL`,
            [`${year}%`, `${year}%`]
        );

        for (const row of analysesRows) {
            await run(archiveDb,
                `INSERT INTO analyses (id, user_id, date, display_date, sales_filename, purchase_filename,
                    sales_amount, purchase_amount, sales_tax, purchase_tax, net_profit,
                    sales_json, purchase_json, summary, deleted_at, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [row.id, row.user_id, row.date, row.display_date, row.sales_filename, row.purchase_filename,
                 row.sales_amount, row.purchase_amount, row.sales_tax, row.purchase_tax, row.net_profit,
                 row.sales_json, row.purchase_json, row.summary, row.deleted_at, row.created_at]
            );
        }

        // Copy summaries for the given year
        const summaryRows = await all(mainDb,
            `SELECT * FROM summaries WHERE year = ?`, [yearStr]
        );

        for (const row of summaryRows) {
            await run(archiveDb,
                `INSERT INTO summaries (id, user_id, year, month, total_sales, total_purchases, total_vat,
                    gross_profit, total_expenses, net_profit, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [row.id, row.user_id, row.year, row.month, row.total_sales, row.total_purchases, row.total_vat,
                 row.gross_profit, row.total_expenses, row.net_profit, row.created_at, row.updated_at]
            );
        }

        // Copy expense items for the given year
        const expenseRows = await all(mainDb,
            `SELECT * FROM expense_items WHERE year = ?`, [yearStr]
        );

        for (const row of expenseRows) {
            await run(archiveDb,
                `INSERT INTO expense_items (id, user_id, year, month, type, item_id, label, amount, expense_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [row.id, row.user_id, row.year, row.month, row.type, row.item_id, row.label, row.amount, row.expense_date || null, row.created_at]
            );
        }

        // Soft-delete from main DB
        const idList = analysesRows.map(r => r.id);
        if (idList.length > 0) {
            const placeholders = idList.map(() => '?').join(',');
            await run(mainDb,
                `UPDATE analyses SET deleted_at = datetime('now') WHERE id IN (${placeholders})`,
                idList
            );
        }

        await run(mainDb,
            `DELETE FROM summaries WHERE year = ?`, [yearStr]
        );

        await run(mainDb,
            `DELETE FROM expense_items WHERE year = ?`, [yearStr]
        );

        return {
            archivedYear: year,
            analyses: analysesRows.length,
            summaries: summaryRows.length,
            expenses: expenseRows.length,
            file: archiveFile
        };
    } finally {
        archiveDb.close();
    }
}

async function restoreYear(year, mainDb) {
    const archiveFile = getArchivePath(year);
    if (!fs.existsSync(archiveFile)) {
        throw new Error(`${year} yılı için arşiv dosyası bulunamadı.`);
    }

    const archiveDb = await openDb(archiveFile);

    try {
        // Restore analyses
        const analysesRows = await all(archiveDb, `SELECT * FROM analyses`);
        for (const row of analysesRows) {
            const exists = await all(mainDb, `SELECT id FROM analyses WHERE id = ?`, [row.id]);
            if (exists.length === 0) {
                await run(mainDb,
                    `INSERT INTO analyses (id, user_id, date, display_date, sales_filename, purchase_filename,
                        sales_amount, purchase_amount, sales_tax, purchase_tax, net_profit,
                        sales_json, purchase_json, summary, deleted_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [row.id, row.user_id, row.date, row.display_date, row.sales_filename, row.purchase_filename,
                     row.sales_amount, row.purchase_amount, row.sales_tax, row.purchase_tax, row.net_profit,
                     row.sales_json, row.purchase_json, row.summary, null, row.created_at]
                );
            } else {
                // If exists but soft-deleted, restore it
                await run(mainDb, `UPDATE analyses SET deleted_at = NULL WHERE id = ?`, [row.id]);
            }
        }

        // Restore summaries
        const summaryRows = await all(archiveDb, `SELECT * FROM summaries`);
        for (const row of summaryRows) {
            const exists = await all(mainDb, `SELECT id FROM summaries WHERE user_id = ? AND year = ? AND month = ?`,
                [row.user_id, row.year, row.month]);
            if (exists.length === 0) {
                await run(mainDb,
                    `INSERT INTO summaries (user_id, year, month, total_sales, total_purchases, total_vat,
                        gross_profit, total_expenses, net_profit, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                    [row.user_id, row.year, row.month, row.total_sales, row.total_purchases, row.total_vat,
                     row.gross_profit, row.total_expenses, row.net_profit]
                );
            }
        }

        // Restore expense items
        const expenseRows = await all(archiveDb, `SELECT * FROM expense_items`);
        for (const row of expenseRows) {
            await run(mainDb,
                `INSERT INTO expense_items (user_id, year, month, type, item_id, label, amount, expense_date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [row.user_id, row.year, row.month, row.type, row.item_id || null, row.label, row.amount, row.expense_date || null, row.created_at]
            );
        }

        return {
            restoredYear: year,
            analyses: analysesRows.length,
            summaries: summaryRows.length,
            expenses: expenseRows.length
        };
    } finally {
        archiveDb.close();
    }
}

async function deleteArchive(year) {
    const archiveFile = getArchivePath(year);
    if (!fs.existsSync(archiveFile)) {
        throw new Error(`${year} yılı için arşiv dosyası bulunamadı.`);
    }
    fs.unlinkSync(archiveFile);
    return { deletedYear: year };
}

function getArchiveInfo(year) {
    const archiveFile = getArchivePath(year);
    if (!fs.existsSync(archiveFile)) return null;
    const stat = fs.statSync(archiveFile);
    return {
        year,
        size: stat.size,
        sizeFormatted: (stat.size / 1024).toFixed(1) + ' KB',
        created: stat.birthtime || stat.mtime
    };
}

module.exports = {
    archiveYear,
    restoreYear,
    deleteArchive,
    getArchiveInfo,
    archivedYears
};
