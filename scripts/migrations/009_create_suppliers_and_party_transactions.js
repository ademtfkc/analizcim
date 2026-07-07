module.exports = {
    up: (db) => new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                normalized_name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                address TEXT,
                tax_number TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                UNIQUE(user_id, normalized_name)
            )`, (supplierErr) => {
                if (supplierErr) return reject(supplierErr);

                db.run(`CREATE TABLE IF NOT EXISTS party_transactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    party_type TEXT NOT NULL CHECK (party_type IN ('customer', 'supplier')),
                    party_id INTEGER NOT NULL,
                    party_name TEXT NOT NULL,
                    normalized_name TEXT NOT NULL,
                    invoice_type TEXT NOT NULL CHECK (invoice_type IN ('sales', 'purchase')),
                    transaction_date TEXT,
                    amount REAL NOT NULL DEFAULT 0,
                    net REAL NOT NULL DEFAULT 0,
                    vat REAL NOT NULL DEFAULT 0,
                    description TEXT,
                    source_history_id INTEGER,
                    source_file TEXT,
                    source_row_index INTEGER,
                    source_key TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    UNIQUE(user_id, source_key)
                )`, (txErr) => {
                    if (txErr) return reject(txErr);

                    const indexes = [
                        'CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id)',
                        'CREATE INDEX IF NOT EXISTS idx_suppliers_normalized_name ON suppliers(user_id, normalized_name)',
                        'CREATE INDEX IF NOT EXISTS idx_party_transactions_party ON party_transactions(user_id, party_type, party_id)',
                        'CREATE INDEX IF NOT EXISTS idx_party_transactions_date ON party_transactions(user_id, transaction_date)',
                        'CREATE INDEX IF NOT EXISTS idx_party_transactions_source ON party_transactions(user_id, source_key)'
                    ];
                    let pending = indexes.length;
                    indexes.forEach((sql) => {
                        db.run(sql, (idxErr) => {
                            if (idxErr) return reject(idxErr);
                            pending -= 1;
                            if (pending === 0) resolve();
                        });
                    });
                });
            });
        });
    }),

    down: (db) => new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('DROP TABLE IF EXISTS party_transactions', (txErr) => {
                if (txErr) return reject(txErr);
                db.run('DROP TABLE IF EXISTS suppliers', (supplierErr) => {
                    if (supplierErr) return reject(supplierErr);
                    resolve();
                });
            });
        });
    })
};
