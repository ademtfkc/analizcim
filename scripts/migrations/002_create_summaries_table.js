/**
 * Migration: 002_create_summaries_table
 * 
 * Create the summaries table for storing pre-computed monthly summaries.
 * This table provides quick dashboard access to aggregated data.
 * 
 * UP:   Create summaries table
 * DOWN: Drop summaries table
 */

function up(db) {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS summaries (
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
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, year, month),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function down(db) {
    return new Promise((resolve, reject) => {
        db.run(`DROP TABLE IF EXISTS summaries`, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = { up, down };
