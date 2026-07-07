const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcrypt');
const logger = require('./logger');

const isTestEnv = process.env.NODE_ENV === 'test';
const configuredDbPath = process.env.ANALIZCIM_DB_PATH || process.env.TEST_DATABASE_PATH;
const defaultDbPath = isTestEnv
    ? path.join(os.tmpdir(), `analizcim-test-${process.pid}.db`)
    : path.resolve(__dirname, '../data/analiz.db');
// Tek resmi veritabanı: data/analiz.db (data/database.sqlite eski kurulumlardan kalma olabilir, kullanılmıyor)
const dbPath = path.resolve(configuredDbPath || defaultDbPath);

// Ensure the directory for the database exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize Database
const db = new sqlite3.Database(dbPath, async (err) => {
    if (err) {
        logger.error({ error: err.message }, 'Veritabanına bağlanırken hata:');
    } else {
        logger.info('✅ SQLite veritabanı bağlantısı başarılı.');
        initializeSchema();
        
        // Run migrations after schema initialization
        await runMigrations();
        await ensureBootstrapAdmin();
    }
});

function initializeSchema() {
    db.serialize(() => {
        // Migrations Table - tracks applied schema changes
        db.run(`CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            rolled_back_at DATETIME
        )`);

        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_admin INTEGER DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Add is_admin column if it doesn't exist (for existing databases)
        db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, (_err) => {
            // Ignore error if column already exists
        });
        db.run(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`, (err) => {
            if (err && !err.message.includes('duplicate column')) {
                logger.error({ error: err.message }, 'users status migration hatası:');
            }
        });

        // Analyses Table (History)
        // Storing complex objects (sales/purchase details) as JSON text for simplicity
        // while pulling out key metrics for querying/reporting
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
            sales_json TEXT,     -- Full sales analysis object
            purchase_json TEXT,  -- Full purchase analysis object
            summary TEXT,
            deleted_at DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // User preferences (theme, predictions layout/order) - localStorage migration
        db.run(`CREATE TABLE IF NOT EXISTS user_preferences (
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            PRIMARY KEY (user_id, key),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Expense items (Sabit/Değişken gider kalemleri) - per user, year, month
        db.run(`CREATE TABLE IF NOT EXISTS expense_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            year TEXT NOT NULL,
            month TEXT NOT NULL,
            type TEXT NOT NULL,
            item_id TEXT,
            label TEXT,
            amount REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )`);

        // Migration: expense_date kolonu (bilgi amaçlı tarih)
        db.run(`ALTER TABLE expense_items ADD COLUMN expense_date TEXT`, (err) => {
            // SQLITE_ERROR = column already exists — güvenli, yutulabilir
            if (err && !err.message.includes('duplicate column')) {
                logger.error({ error: err.message }, 'expense_date migration hatası:');
            }
        });

        // Migration: user_id kolonu analyses tablosuna (mevcut kayıtlara user_id=1 atanır)
        db.run(`ALTER TABLE analyses ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                logger.error({ error: err.message }, 'analyses user_id migration hatası:');
            }
        });

        // Summaries Table (pre-computed monthly summaries for quick dashboard access)
        db.run(`CREATE TABLE IF NOT EXISTS summaries (
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
        )`);

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
        )`);

        // Create indexes for frequently queried columns
        db.run(`CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_analyses_date ON analyses(date)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at)`);
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_expense_items_user_id ON expense_items(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_expense_items_year_month ON expense_items(year, month)`);
        
        db.run(`CREATE INDEX IF NOT EXISTS idx_summaries_user_id ON summaries(user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_summaries_year_month ON summaries(year, month)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_user_id ON audit_logs(actor_user_id)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)`);

        logger.info('✅ Tablo yapısı kontrol edildi/oluşturuldu.');
    });
}

function runStatement(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve(this);
        });
    });
}

function getRow(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

async function ensureBootstrapAdmin() {
    const username = process.env.BOOTSTRAP_ADMIN_USERNAME;
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

    if (!username || !password) {
        if (!isTestEnv) {
            logger.info('  ℹ️  Bootstrap admin atanmadı. İlk admin için BOOTSTRAP_ADMIN_USERNAME ve BOOTSTRAP_ADMIN_PASSWORD kullanın.');
        }
        return;
    }

    try {
        const existing = await getRow('SELECT id, is_admin, status FROM users WHERE username = ?', [username]);
        if (existing) {
            if (existing.is_admin !== 1 || existing.status !== 'approved') {
                await runStatement('UPDATE users SET is_admin = 1, status = ? WHERE id = ?', ['approved', existing.id]);
            }
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await runStatement(
            'INSERT INTO users (username, password_hash, is_admin, status) VALUES (?, ?, 1, ?)',
            [username, passwordHash, 'approved']
        );
        logger.info(`  ✅ Bootstrap admin oluşturuldu: ${username}`);
    } catch (error) {
        logger.error({ err: error }, 'Bootstrap admin oluşturulamadı:');
    }
}

/**
 * Run database migrations
 * This is called after schema initialization to apply any pending migrations
 */
async function runMigrations() {
    const fs = require('fs');
    const path = require('path');
    
    const migrationsDir = path.resolve(__dirname, '../scripts/migrations');

    await runStatement(`CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        rolled_back_at DATETIME
    )`);
    
    // Get all migration files
    let migrationFiles = [];
    try {
        migrationFiles = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.js') && /^\d{3}_.+\.js$/.test(f))
            .sort();
    } catch (e) {
        logger.info('  ℹ️  Migrations directory not found, skipping migrations');
        return;
    }
    
    if (migrationFiles.length === 0) {
        logger.info('  ℹ️  No migration files found');
        return;
    }
    
    // Get applied migrations
    const applied = await new Promise((resolve, reject) => {
        db.all('SELECT name FROM migrations', [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
    
    const appliedNames = new Set(applied.map(m => m.name));
    let appliedCount = 0;
    
    for (const file of migrationFiles) {
        const name = file.replace('.js', '');
        
        if (!appliedNames.has(name)) {
            logger.info(`  📦 Running migration: ${name}`);
            
            try {
                const migration = require(path.join(migrationsDir, file));
                
                if (typeof migration.up === 'function') {
                    await migration.up(db);
                    
                    // Record the migration
                    await new Promise((resolve, reject) => {
                        db.run('INSERT INTO migrations (name, applied_at) VALUES (?, datetime("now"))', [name], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                    });
                    
                    logger.info(`  ✅ Migration ${name} applied`);
                    appliedCount++;
                }
            } catch (error) {
                logger.error({ err: error }, `  ❌ Migration ${name} failed: ${error.message}`);
            }
        }
    }
    
    if (appliedCount > 0) {
        logger.info(`  ✅ Completed ${appliedCount} migration(s)`);
    } else {
        logger.info('  ℹ️  All migrations up to date');
    }
}

db.filePath = dbPath;

module.exports = db;
