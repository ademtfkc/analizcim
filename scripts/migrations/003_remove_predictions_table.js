/**
 * Migration: 003_remove_predictions_table
 * 
 * Remove the legacy predictions table if it exists.
 * Predictions are now computed dynamically via the predictor module.
 * 
 * UP:   Drop predictions table if it exists
 * DOWN: Recreate predictions table (empty)
 */

function up(db) {
    return new Promise((resolve, reject) => {
        // Check if table exists
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='predictions'", (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (row) {
                // Drop the table if it exists
                db.run(`DROP TABLE predictions`, (err) => {
                    if (err) reject(err);
                    else {
                        console.log('  → Dropped legacy predictions table');
                        resolve();
                    }
                });
            } else {
                // Table doesn't exist, nothing to do
                console.log('  → No legacy predictions table found (OK)');
                resolve();
            }
        });
    });
}

function down(db) {
    return new Promise((resolve, reject) => {
        // Recreate an empty predictions table
        db.run(`
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                predicted_sales REAL,
                predicted_purchases REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, year, month)
            )
        `, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = { up, down };
