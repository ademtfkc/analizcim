/**
 * Analizcim - Backup Manager
 * Sunucu tarafında otomatik ve manuel veritabanı yedekleme yönetimi
 *
 * Özellikler:
 *  - Manuel yedek alma (createBackup)
 *  - 5 günde bir otomatik yedek (startAutoBackupScheduler)
 *  - Hafızada en fazla MAX_BACKUPS (varsayılan 2) yedek tutma (otomatik temizleme)
 *  - Yedekten geri yükleme (restoreBackup)
 *  - Yedek listeleme (yeniden eskiye sıralı)
 *  - Yedek silme
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const DB_PATH = path.join(__dirname, '../data/analiz.db');
const BACKUP_DIR = path.join(__dirname, '../data/backups');
const MAX_BACKUPS = 2;
const AUTO_BACKUP_INTERVAL_DAYS = 5;
const AUTO_BACKUP_INTERVAL_MS = AUTO_BACKUP_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
const BACKUP_FILE_REGEX = /^analizcim_backup_([a-zA-Z]+)_(.+)\.db$/;

let autoBackupTimer = null;

/**
 * Yedek klasörünün var olduğundan emin olur
 */
function ensureBackupDir() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
}

/**
 * Yedekleri yeniden eskiye sıralı şekilde listeler
 * @returns {Array<{name, size, created_at, type}>}
 */
function listBackups() {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db') && BACKUP_FILE_REGEX.test(f));

    const items = files.map(name => {
        const fullPath = path.join(BACKUP_DIR, name);
        const stat = fs.statSync(fullPath);
        const match = name.match(BACKUP_FILE_REGEX);
        const type = match ? match[1] : 'manual';
        return {
            name,
            size: stat.size,
            created_at: stat.mtime.toISOString(),
            type: type === 'auto' ? 'auto' : 'manual'
        };
    });

    // Yeniden eskiye (en yeni en başta)
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return items;
}

/**
 * En eski yedekleri silerek maksimum MAX_BACKUPS yedek tutar
 */
function pruneOldBackups() {
    const backups = listBackups();
    if (backups.length <= MAX_BACKUPS) return [];

    const toDelete = backups.slice(MAX_BACKUPS); // En eskiler (sondan)
    const deleted = [];
    for (const b of toDelete) {
        try {
            fs.unlinkSync(path.join(BACKUP_DIR, b.name));
            deleted.push(b.name);
        } catch (err) {
            logger.error({ error: err.message }, `[backup-manager] Eski yedek silinemedi (${b.name}):`);
        }
    }
    return deleted;
}

/**
 * Yedek oluşturur
 * @param {string} type - 'manual' veya 'auto'
 * @returns {{success, filename, path, size, deleted}}
 */
function createBackup(type = 'manual') {
    ensureBackupDir();

    if (!fs.existsSync(DB_PATH)) {
        return { success: false, error: 'Veritabanı dosyası bulunamadı.' };
    }

    const now = new Date();
    // Tarihi dosya adına güvenli şekilde koy
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const safeType = type === 'auto' ? 'auto' : 'manual';
    const filename = `analizcim_backup_${safeType}_${timestamp}.db`;
    const fullPath = path.join(BACKUP_DIR, filename);

    try {
        fs.copyFileSync(DB_PATH, fullPath);
        const stat = fs.statSync(fullPath);
        const deleted = pruneOldBackups();

        logger.info(`[backup-manager] Yedek oluşturuldu (${safeType}): ${filename} (${stat.size} bytes)`);
        if (deleted.length > 0) {
            logger.info(`[backup-manager] Eski yedekler silindi: ${deleted.join(', ')}`);
        }

        return {
            success: true,
            filename,
            path: fullPath,
            size: stat.size,
            deleted
        };
    } catch (err) {
        logger.error({ err }, '[backup-manager] Yedekleme hatası:');
        return { success: false, error: err.message };
    }
}

/**
 * Belirli bir yedekten veritabanını geri yükler
 * @param {string} name - Yedek dosya adı
 * @returns {{success, message, preRestoreBackup}}
 */
function restoreBackup(name) {
    ensureBackupDir();

    // Dosya adı güvenlik kontrolü
    if (!BACKUP_FILE_REGEX.test(name)) {
        return { success: false, error: 'Geçersiz yedek dosya adı.' };
    }

    const backupPath = path.join(BACKUP_DIR, name);

    // Path traversal guard: backup dosyası kesinlikle BACKUP_DIR içinde olmalı
    const resolvedBackup = path.resolve(backupPath);
    const resolvedDir = path.resolve(BACKUP_DIR);
    if (!resolvedBackup.startsWith(resolvedDir + path.sep)) {
        return { success: false, error: 'Geçersiz yol.' };
    }

    if (!fs.existsSync(backupPath)) {
        return { success: false, error: 'Yedek dosyası bulunamadı.' };
    }

    try {
        // Geri yükleme öncesi mevcut DB'yi yedekle (güvenlik)
        let preRestorePath = null;
        if (fs.existsSync(DB_PATH)) {
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            preRestorePath = path.join(BACKUP_DIR, `analizcim_backup_prerestore_${ts}.db`);
            fs.copyFileSync(DB_PATH, preRestorePath);
        }

        // Yedekten DB'yi yerine koy
        fs.copyFileSync(backupPath, DB_PATH);

        logger.info(`[backup-manager] Yedekten geri yüklendi: ${name}`);

        return {
            success: true,
            message: 'Veritabanı başarıyla geri yüklendi. Değişikliklerin tam olarak etkili olması için sayfayı yenileyin.',
            preRestoreBackup: preRestorePath ? path.basename(preRestorePath) : null
        };
    } catch (err) {
        logger.error({ err }, '[backup-manager] Restore hatası:');
        return { success: false, error: err.message };
    }
}

/**
 * Yedek dosyasını siler
 */
function deleteBackup(name) {
    if (!BACKUP_FILE_REGEX.test(name)) {
        return { success: false, error: 'Geçersiz yedek dosya adı.' };
    }

    const backupPath = path.join(BACKUP_DIR, name);
    const resolvedBackup = path.resolve(backupPath);
    const resolvedDir = path.resolve(BACKUP_DIR);
    if (!resolvedBackup.startsWith(resolvedDir + path.sep)) {
        return { success: false, error: 'Geçersiz yol.' };
    }

    if (!fs.existsSync(backupPath)) {
        return { success: false, error: 'Yedek dosyası bulunamadı.' };
    }

    try {
        fs.unlinkSync(backupPath);
        logger.info(`[backup-manager] Yedek silindi: ${name}`);
        return { success: true };
    } catch (err) {
        logger.error({ err }, '[backup-manager] Silme hatası:');
        return { success: false, error: err.message };
    }
}

/**
 * Yedek dosya yolunu döner (indirme için)
 */
function getBackupPath(name) {
    if (!BACKUP_FILE_REGEX.test(name)) return null;
    const backupPath = path.join(BACKUP_DIR, name);
    const resolvedBackup = path.resolve(backupPath);
    const resolvedDir = path.resolve(BACKUP_DIR);
    if (!resolvedBackup.startsWith(resolvedDir + path.sep)) return null;
    if (!fs.existsSync(backupPath)) return null;
    return backupPath;
}

/**
 * En son otomatik yedekten bu yana geçen süreye göre otomatik yedek alır
 */
function runAutoBackupIfNeeded() {
    try {
        const backups = listBackups().filter(b => b.type === 'auto');
        if (backups.length === 0) {
            // Hiç otomatik yedek yok, hemen al
            createBackup('auto');
            return;
        }
        const lastAuto = backups[0]; // En yeni
        const lastTime = new Date(lastAuto.created_at).getTime();
        const elapsed = Date.now() - lastTime;
        if (elapsed >= AUTO_BACKUP_INTERVAL_MS) {
            createBackup('auto');
        }
    } catch (err) {
        logger.error({ err }, '[backup-manager] Auto-backup kontrolü başarısız:');
    }
}

/**
 * Otomatik yedekleme zamanlayıcısını başlatır
 * - Başlangıçta bir kez kontrol eder (gecikmiş yedek varsa alır)
 * - Sonra her gün bir kez kontrol eder (günlük aralıkla, 5 gün geçmişse yedek alır)
 */
function startAutoBackupScheduler() {
    // Zamanlayıcıyı zaten başlatmışsak iki kere başlatma
    if (autoBackupTimer) return;

    ensureBackupDir();

    // Başlangıçta kontrol (sunucu restart'ı ile birlikte)
    runAutoBackupIfNeeded();

    // Her 24 saatte bir kontrol (5 günü hassas yakalamak için)
    const checkInterval = 24 * 60 * 60 * 1000; // 1 gün
    autoBackupTimer = setInterval(runAutoBackupIfNeeded, checkInterval);

    // Node.js'in kapatılmasını engellememek için unref()
    if (autoBackupTimer.unref) autoBackupTimer.unref();

    logger.info(`[backup-manager] Otomatik yedekleme aktif: her ${AUTO_BACKUP_INTERVAL_DAYS} günde bir (24 saatte bir kontrol edilir).`);
}

/**
 * Zamanlayıcıyı durdurur (test için)
 */
function stopAutoBackupScheduler() {
    if (autoBackupTimer) {
        clearInterval(autoBackupTimer);
        autoBackupTimer = null;
    }
}

module.exports = {
    createBackup,
    listBackups,
    restoreBackup,
    deleteBackup,
    getBackupPath,
    startAutoBackupScheduler,
    stopAutoBackupScheduler,
    runAutoBackupIfNeeded,
    pruneOldBackups,
    MAX_BACKUPS,
    AUTO_BACKUP_INTERVAL_DAYS,
    BACKUP_DIR
};
