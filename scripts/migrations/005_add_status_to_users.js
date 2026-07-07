/**
 * Migration: 005_add_status_to_users
 *
 * Kullanıcılara onay sistemi getirir.
 * - users tablosuna status sütunu eklenir ('pending' / 'approved' / 'rejected').
 * - Mevcut tüm kullanıcılar (daha önce sisteme girmiş olanlar) 'approved' olarak işaretlenir.
 * - Yeni kayıtlar varsayılan olarak 'pending' statüsünde başlayacak (storage katmanında uygulanır).
 *
 * UP:   Add status column, mark existing users as approved.
 * DOWN: Remove status column (SQLite tablo yeniden oluşturma ile).
 */

function up(db) {
    return new Promise((resolve, reject) => {
        // Sütunu ekle (zaten varsa hatayı yut)
        db.run(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                reject(err);
                return;
            }
            // Mevcut kullanıcıları (bu migration'dan önce oluşturulmuş) 'approved' yap
            db.run(`UPDATE users SET status = 'approved' WHERE status IS NULL OR status = 'pending'`, (err2) => {
                if (err2) reject(err2);
                else resolve();
            });
        });
    });
}

function down(db) {
    return new Promise((resolve, reject) => {
        // SQLite eski sürümleri DROP COLUMN desteklemez; tablo yeniden oluşturulur.
        db.serialize(() => {
            db.run(`CREATE TABLE users_backup (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_admin INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) { reject(err); return; }
                db.run(`INSERT INTO users_backup (id, username, password_hash, is_admin, created_at)
                        SELECT id, username, password_hash, is_admin, created_at FROM users`, (err2) => {
                    if (err2) { reject(err2); return; }
                    db.run(`DROP TABLE users`, (err3) => {
                        if (err3) { reject(err3); return; }
                        db.run(`ALTER TABLE users_backup RENAME TO users`, (err4) => {
                            if (err4) reject(err4);
                            else resolve();
                        });
                    });
                });
            });
        });
    });
}

module.exports = { up, down };
