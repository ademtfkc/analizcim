/**
 * Migration: 001_add_user_id_to_analyses
 * 
 * Add user_id column to the analyses table to support multi-user functionality.
 * This allows analyses to be associated with specific users.
 * 
 * UP:   Add user_id column to analyses table (with default value of 1 for existing records)
 * DOWN: Remove user_id column from analyses table
 */

function up(db) {
    return new Promise((resolve, reject) => {
        // Check if column already exists
        db.get("PRAGMA table_info(analyses)", (err, rows) => {
            if (err) {
                reject(err);
                return;
            }
            
            // Use ALTER TABLE to add column (idempotent - will fail silently if column exists)
            db.run(`ALTER TABLE analyses ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1`, (err) => {
                // Ignore error if column already exists
                if (err && !err.message.includes('duplicate column name')) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    });
}

function down(db) {
    return new Promise((resolve, reject) => {
        // SQLite doesn't support DROP COLUMN directly in older versions
        // We need to recreate the table
        db.serialize(() => {
            // Create temporary table without user_id
            db.run(`CREATE TABLE analyses_backup (
                id TEXT PRIMARY KEY,
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
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Copy data from original table
                db.run(`INSERT INTO analyses_backup SELECT 
                    id, date, display_date, sales_filename, purchase_filename,
                    sales_amount, purchase_amount, sales_tax, purchase_tax,
                    net_profit, sales_json, purchase_json, summary, created_at
                FROM analyses`, (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    // Drop original table
                    db.run(`DROP TABLE analyses`, (err) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        // Rename backup to original
                        db.run(`ALTER TABLE analyses_backup RENAME TO analyses`, (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                });
            });
        });
    });
}

module.exports = { up, down };
