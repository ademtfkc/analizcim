const fs = require('fs');
const path = require('path');
const logger = require('../logger');

function registerBackupRoutes(app, deps) {
    const { db, backupManager, requireAuth, requireAdmin, uploadBackup, storage } = deps;

    async function recordAudit(req, action, entityId = null, details = null) {
        if (!storage?.logAuditEvent) return;
        try {
            await storage.logAuditEvent({
                actorUserId: req.session.userId || null,
                actorUsername: req.session.username || null,
                action,
                entityType: 'backup',
                entityId,
                details,
                ipAddress: req.ip || req.socket?.remoteAddress || null
            });
        } catch (error) {
            logger.error({ err: error, action, entityId }, '[audit] Backup audit kaydedilemedi:');
        }
    }

    app.get('/api/backup', requireAuth, requireAdmin, async (req, res) => {
        try {
            const dbPath = db.filePath;

            if (!fs.existsSync(dbPath)) {
                return res.status(404).json({ error: 'Veritabanı dosyası bulunamadı.' });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `analizcim_backup_${timestamp}.db`;

            logger.info(`[backup] User ${req.session.username} requested backup: ${filename}`);

            return res.download(dbPath, filename, (err) => {
                if (err) {
                    logger.error({ err }, '[backup] Download error:');
                    if (!res.headersSent) {
                        res.status(500).json({ error: 'Yedekleme sırasında hata oluştu.' });
                    }
                } else {
                    logger.info(`[backup] Backup downloaded successfully: ${filename}`);
                    void recordAudit(req, 'backup.download', filename, { source: 'database-export' });
                }
            });
        } catch (err) {
            logger.error({ err }, '[backup] Error:');
            return res.status(500).json({ error: 'Yedekleme sırasında hata oluştu.' });
        }
    });

    app.post('/api/restore', requireAuth, requireAdmin, uploadBackup.single('backupFile'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Yedekleme dosyası yüklenmedi.' });
            }

            const backupFilePath = req.file.path;
            const dbPath = db.filePath;
            const dbDir = path.dirname(dbPath);

            logger.info(`[restore] User ${req.session.username} attempting restore from: ${req.file.originalname}`);

            const sqlite3 = require('sqlite3').verbose();
            const backupDb = new sqlite3.Database(backupFilePath, sqlite3.OPEN_READONLY, (err) => {
                if (err) {
                    logger.error({ err }, '[restore] Invalid backup file:');
                    fs.unlinkSync(backupFilePath);
                    return res.status(400).json({ error: 'Geçersiz yedekleme dosyası. Veritabanı açılamadı.' });
                }

                backupDb.get('PRAGMA integrity_check', (integrityErr, result) => {
                    backupDb.close();

                    if (integrityErr || result.integrity_check !== 'ok') {
                        logger.error({ err: integrityErr || result }, '[restore] Integrity check failed:');
                        fs.unlinkSync(backupFilePath);
                        return res.status(400).json({ error: 'Yedekleme dosyası bozuk veya geçersiz.' });
                    }

                    const currentBackupPath = path.join(dbDir, `pre_restore_${Date.now()}.db`);

                    try {
                        if (fs.existsSync(dbPath)) {
                            fs.copyFileSync(dbPath, currentBackupPath);
                            logger.info(`[restore] Current database backed up to: ${currentBackupPath}`);
                        }

                        fs.copyFileSync(backupFilePath, dbPath);
                        fs.unlinkSync(backupFilePath);

                        const preRestoreFiles = fs.readdirSync(dbDir)
                            .filter((file) => file.startsWith('pre_restore_') && file.endsWith('.db'))
                            .sort()
                            .reverse();

                        if (preRestoreFiles.length > 3) {
                            preRestoreFiles.slice(3).forEach((file) => {
                                fs.unlinkSync(path.join(dbDir, file));
                            });
                        }

                        logger.info(`[restore] Database restored successfully by user: ${req.session.username}`);
                        void recordAudit(req, 'backup.upload.restore', req.file.originalname, {
                            preRestoreBackup: path.basename(currentBackupPath)
                        });

                        return res.json({
                            success: true,
                            message: 'Veritabanı başarıyla geri yüklendi. Değişikliklerin tam olarak etkili olması için sayfayı yenilemeniz önerilir.',
                            note: `Mevcut veritabanı ${path.basename(currentBackupPath)} olarak yedeklendi.`
                        });
                    } catch (copyErr) {
                        logger.error({ err: copyErr }, '[restore] Error during restore:');
                        if (fs.existsSync(currentBackupPath)) {
                            fs.copyFileSync(currentBackupPath, dbPath);
                        }
                        return res.status(500).json({ error: 'Geri yükleme sırasında hata oluştu. Önceki veritabanı durumuna geri dönüldü.' });
                    }
                });
            });
        } catch (err) {
            logger.error({ err }, '[restore] Error:');
            return res.status(500).json({ error: `Geri yükleme sırasında hata oluştu: ${err.message}` });
        }
    });

    app.get('/api/admin/backups', requireAuth, requireAdmin, (req, res) => {
        try {
            const backups = backupManager.listBackups();
            return res.json({
                success: true,
                backups,
                maxBackups: backupManager.MAX_BACKUPS,
                autoBackupIntervalDays: backupManager.AUTO_BACKUP_INTERVAL_DAYS
            });
        } catch (err) {
            logger.error({ err }, '[admin/backups] Liste hatası:');
            return res.status(500).json({ error: 'Yedek listesi alınırken hata oluştu.' });
        }
    });

    app.post('/api/admin/backups', requireAuth, requireAdmin, (req, res) => {
        try {
            const result = backupManager.createBackup('manual');
            if (!result.success) {
                return res.status(500).json({ error: result.error || 'Yedekleme başarısız.' });
            }
            void recordAudit(req, 'backup.create', result.filename, {
                type: 'manual',
                size: result.size,
                deleted: result.deleted || []
            });
            return res.json({
                success: true,
                backup: {
                    name: result.filename,
                    size: result.size,
                    path: result.path
                },
                deleted: result.deleted || [],
                message: 'Yedek başarıyla oluşturuldu.'
            });
        } catch (err) {
            logger.error({ err }, '[admin/backups] Oluşturma hatası:');
            return res.status(500).json({ error: 'Yedek oluşturulurken hata oluştu.' });
        }
    });

    app.post('/api/admin/backups/restore', requireAuth, requireAdmin, (req, res) => {
        try {
            const { name } = req.body || {};
            if (!name) return res.status(400).json({ error: 'Yedek adı belirtilmedi.' });

            const result = backupManager.restoreBackup(name);
            if (!result.success) {
                return res.status(400).json({ error: result.error || 'Geri yükleme başarısız.' });
            }
            void recordAudit(req, 'backup.restore', name, {
                preRestoreBackup: result.preRestoreBackup || null
            });
            return res.json({
                success: true,
                message: result.message,
                preRestoreBackup: result.preRestoreBackup
            });
        } catch (err) {
            logger.error({ err }, '[admin/backups/restore] Hata:');
            return res.status(500).json({ error: 'Geri yükleme sırasında hata oluştu.' });
        }
    });

    app.delete('/api/admin/backups/:name', requireAuth, requireAdmin, (req, res) => {
        try {
            const { name } = req.params;
            const result = backupManager.deleteBackup(name);
            if (!result.success) {
                return res.status(400).json({ error: result.error || 'Silme başarısız.' });
            }
            void recordAudit(req, 'backup.delete', name);
            return res.json({ success: true });
        } catch (err) {
            logger.error({ err }, '[admin/backups DELETE] Hata:');
            return res.status(500).json({ error: 'Yedek silinirken hata oluştu.' });
        }
    });

    app.get('/api/admin/backups/:name/download', requireAuth, requireAdmin, (req, res) => {
        try {
            const { name } = req.params;
            const backupPath = backupManager.getBackupPath(name);
            if (!backupPath) {
                return res.status(404).json({ error: 'Yedek bulunamadı.' });
            }
            return res.download(backupPath, name);
        } catch (err) {
            logger.error({ err }, '[admin/backups/download] Hata:');
            return res.status(500).json({ error: 'Yedek indirilirken hata oluştu.' });
        }
    });
}

module.exports = { registerBackupRoutes };
