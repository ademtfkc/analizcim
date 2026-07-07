module.exports = {
    up: (db) => new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS customers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                address TEXT,
                tax_number TEXT,
                balance REAL NOT NULL DEFAULT 0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`, (err) => {
                if (err) return reject(err);

                db.run('CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id)', (idxErr) => {
                    if (idxErr) return reject(idxErr);
                    db.run('CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(first_name, last_name)', (nameErr) => {
                        if (nameErr) return reject(nameErr);
                        db.run('CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)', (emailErr) => {
                            if (emailErr) return reject(emailErr);
                            resolve();
                        });
                    });
                });
            });
        });
    }),

    down: (db) => new Promise((resolve, reject) => {
        db.run('DROP TABLE IF EXISTS customers', (err) => {
            if (err) return reject(err);
            resolve();
        });
    })
};
