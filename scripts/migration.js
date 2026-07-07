/**
 * Migration Runner
 * 
 * Manages database schema migrations with forward and rollback support.
 * Tracks applied migrations in a dedicated table.
 * 
 * Usage:
 *   node scripts/migration.js           - Run pending migrations
 *   node scripts/migration.js --status  - Show migration status
 *   node scripts/migration.js --rollback - Rollback last migration
 *   node scripts/migration.js --force  - Force run all migrations (idempotent)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../data/analiz.db');
const migrationsDir = path.resolve(__dirname, 'migrations');

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
    console.error(`${colors.red}ERROR: ${message}${colors.reset}`);
}

/**
 * Get all migration files from the migrations directory
 */
function getMigrationFiles() {
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.js') && /^\d{3}_.+\.js$/.test(f))
        .sort();
    
    return files.map(f => ({
        name: f.replace('.js', ''),
        path: path.join(migrationsDir, f)
    }));
}

/**
 * Initialize the migrations table if it doesn't exist
 */
function initMigrationsTable(db) {
    return new Promise((resolve, reject) => {
        db.run(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                rolled_back_at DATETIME
            )
        `, (err) => {
            if (err) {
                reject(err);
            } else {
                log('✅ Migrations table ready', 'green');
                resolve();
            }
        });
    });
}

/**
 * Get list of applied migrations
 */
function getAppliedMigrations(db) {
    return new Promise((resolve, reject) => {
        db.all('SELECT name, applied_at, rolled_back_at FROM migrations ORDER BY name', [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

/**
 * Record a migration as applied
 */
function recordMigration(db, name) {
    return new Promise((resolve, reject) => {
        db.run('INSERT INTO migrations (name, applied_at) VALUES (?, datetime("now"))', [name], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Remove migration record (for rollback)
 */
function removeMigrationRecord(db, name) {
    return new Promise((resolve, reject) => {
        db.run('UPDATE migrations SET rolled_back_at = datetime("now") WHERE name = ?', [name], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

/**
 * Run a single migration
 */
async function runMigration(db, migration) {
    const migrationModule = require(migration.path);
    const { up } = migrationModule;

    if (typeof up !== 'function') {
        throw new Error(`Migration ${migration.name} must export an 'up' function`);
    }

    log(`\n📦 Running migration: ${colors.bold}${migration.name}${colors.reset}`, 'cyan');
    
    try {
        await up(db);
        await recordMigration(db, migration.name);
        log(`✅ Migration ${migration.name} applied successfully`, 'green');
    } catch (error) {
        logError(`Migration ${migration.name} failed: ${error.message}`);
        throw error;
    }
}

/**
 * Rollback a single migration
 */
async function rollbackMigration(db, migration) {
    const migrationModule = require(migration.path);
    const { down } = migrationModule;

    if (typeof down !== 'function') {
        throw new Error(`Migration ${migration.name} must export a 'down' function for rollback`);
    }

    log(`\n🔄 Rolling back migration: ${colors.bold}${migration.name}${colors.reset}`, 'yellow');
    
    try {
        await down(db);
        await removeMigrationRecord(db, migration.name);
        log(`✅ Migration ${migration.name} rolled back successfully`, 'green');
    } catch (error) {
        logError(`Rollback of ${migration.name} failed: ${error.message}`);
        throw error;
    }
}

/**
 * Show migration status
 */
async function showStatus(db) {
    const applied = await getAppliedMigrations(db);
    const allMigrations = getMigrationFiles();
    
    log(`\n${colors.bold}Migration Status${colors.reset}\n`, 'bold');
    log(`${colors.bold}Total migrations: ${allMigrations.length}${colors.reset}`);
    log(`${colors.bold}Applied: ${applied.length}${colors.reset}`);
    log(`${colors.bold}Pending: ${allMigrations.length - applied.length}${colors.reset}\n`);
    
    // Show each migration status
    for (const migration of allMigrations) {
        const appliedMigration = applied.find(m => m.name === migration.name);
        if (appliedMigration) {
            log(`  [✅] ${migration.name} - Applied: ${appliedMigration.applied_at}`, 'green');
        } else {
            log(`  [ ] ${migration.name} - Pending`, 'yellow');
        }
    }
    
    console.log('');
}

/**
 * Main migration runner
 */
async function main() {
    const args = process.argv.slice(2);
    const isStatus = args.includes('--status');
    const isRollback = args.includes('--rollback');
    const isForce = args.includes('--force');

    // Ensure database directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }

    // Connect to database
    const db = new sqlite3.Database(dbPath);
    
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
    
    try {
        // Initialize migrations table
        await initMigrationsTable(db);
        
        if (isStatus) {
            await showStatus(db);
            process.exit(0);
        }
        
        const allMigrations = getMigrationFiles();
        const applied = await getAppliedMigrations(db);
        const appliedNames = new Set(applied.map(m => m.name));
        
        if (isRollback) {
            // Find the last applied migration
            const lastApplied = [...applied].reverse().find(m => !m.rolled_back_at);
            if (!lastApplied) {
                logError('No migrations to rollback');
                process.exit(1);
            }
            
            const migration = allMigrations.find(m => m.name === lastApplied.name);
            if (migration) {
                await rollbackMigration(db, migration);
            }
        } else {
            // Run pending migrations
            let appliedCount = 0;
            
            for (const migration of allMigrations) {
                if (isForce || !appliedNames.has(migration.name)) {
                    await runMigration(db, migration);
                    appliedCount++;
                } else {
                    log(`  [⏭] Skipping ${migration.name} - already applied`, 'yellow');
                }
            }
            
            if (appliedCount > 0) {
                log(`\n${colors.green}✅ Completed ${appliedCount} migration(s)${colors.reset}`, 'green');
            } else {
                log(`\n${colors.yellow}ℹ️  No pending migrations${colors.reset}`, 'yellow');
            }
        }
        
    } catch (error) {
        logError(`Migration failed: ${error.message}`);
        process.exit(1);
    } finally {
        db.close();
    }
}

// Run if executed directly
if (require.main === module) {
    main();
}

module.exports = { runMigrations: main };
