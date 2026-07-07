/**
 * Migration: 007_create_audit_logs_table
 *
 * Kritik operasyonlar için denetim kaydı tablosu.
 */

function up(db) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                actor_user_id INTEGER,
                actor_username TEXT,
                action TEXT NOT NULL,
                entity_type TEXT,
                entity_id TEXT,
                details_json TEXT,
                ip_address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (actor_user_id) REFERENCES users(id)
            )`, (err) => {
                if (err) return reject(err);

                db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`, (err2) => {
                    if (err2) return reject(err2);
                    db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id)`, (err3) => {
                        if (err3) return reject(err3);
                        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`, (err4) => {
                            if (err4) return reject(err4);
                            resolve();
                        });
                    });
                });
            });
        });
    });
}

function down(db) {
    return new Promise((resolve, reject) => {
        db.run(`DROP TABLE IF EXISTS audit_logs`, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

module.exports = { up, down };
