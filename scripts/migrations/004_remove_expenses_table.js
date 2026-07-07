/**
 * Migration: 004_remove_expenses_table
 * 
 * Remove the legacy expenses table if it exists.
 * The application now uses expense_items table for storing expenses.
 * 
 * UP:   Drop expenses table if it exists
 * DOWN: Recreate expenses table (empty)
 */

function up(db) {
    return new Promise((resolve, reject) => {
        // Check if table exists
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'", (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            if (row) {
                // Drop the table if it exists
                db.run(`DROP TABLE expenses`, (err) => {
                    if (err) reject(err);
                    else {
                        console.log('  → Dropped legacy expenses table');
                        resolve();
                    }
                });
            } else {
                // Table doesn't exist, nothing to do
                console.log('  → No legacy expenses table found (OK)');
                resolve();
            }
        });
    });
}

function down(db) {
    return new Promise((resolve, reject) => {
        // Recreate an empty expenses table
        db.run(`
            CREATE TABLE IF NOT EXISTS expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                amount REAL NOT NULL,
                description TEXT,
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
