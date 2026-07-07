/**
 * Migration: 006_add_outliers_json_to_analyses
 *
 * Add outliers_json column to analyses table for statistical outlier metadata.
 */
function up(db) {
    return new Promise((resolve, reject) => {
        db.run(`ALTER TABLE analyses ADD COLUMN outliers_json TEXT DEFAULT NULL`, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                reject(err);
            } else {
                console.log('  → Added outliers_json column to analyses table');
                resolve();
            }
        });
    });
}

function down(db) {
    return new Promise((resolve, reject) => {
        // SQLite doesn't support DROP COLUMN before 3.35.0
        // Workaround: rename, recreate, copy
        db.run(`ALTER TABLE analyses RENAME TO analyses_old`, (err) => {
            if (err) { reject(err); return; }
            db.run(`CREATE TABLE IF NOT EXISTS analyses (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL DEFAULT 1,
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
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                deleted_at DATETIME DEFAULT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`, (err2) => {
                if (err2) { reject(err2); return; }
                db.run(`INSERT INTO analyses SELECT id, user_id, date, display_date, sales_filename, purchase_filename, sales_amount, purchase_amount, sales_tax, purchase_tax, net_profit, sales_json, purchase_json, summary, created_at, deleted_at FROM analyses_old`, (err3) => {
                    if (err3) { reject(err3); return; }
                    db.run(`DROP TABLE analyses_old`, (err4) => {
                        if (err4) reject(err4);
                        else {
                            console.log('  → Rolled back: removed outliers_json column');
                            resolve();
                        }
                    });
                });
            });
        });
    });
}

module.exports = { up, down };
