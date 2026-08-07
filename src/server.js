require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { analyzeFiles, mergeAnalyzeFiles } = require('./analyzer');
const storage = require('./storage');
const backupManager = require('./backup-manager');
const { buildComparableSummary } = require('./compare-metrics');
const logger = require('./logger');

const app = express();
const PORT = process.env.PORT || 3000;

const session = require('express-session');
const bcrypt = require('bcrypt');
const db = require('./database');
const { validatePassword, validateUsername, validateEmail, validateYear, validateMonth, validateAmount, validateAmountRange, validateDateRange, validateFilterType, validateRequired, sanitizeString, validatePagination, validateSort, validateId, neutralizeSpreadsheetCell, repairUploadFilename } = require('./validators');
const { createRateLimiters } = require('./middleware/rate-limiters');
const { createSessionRefreshMiddleware, requireAuth, requireAdmin } = require('./middleware/auth');
const { registerAuthRoutes } = require('./routes/auth');
const { registerBackupRoutes } = require('./routes/backups');
const { registerHistoryRoutes } = require('./routes/history');
const { registerPreferenceRoutes } = require('./routes/preferences');
const { registerExpenseRoutes } = require('./routes/expenses');
const { registerCustomerRoutes } = require('./routes/customers');
const { registerBusinessPartyRoutes } = require('./routes/business-parties');

// Skip rate limiting in test environment
const isTestEnv = process.env.NODE_ENV === 'test';
const { apiLimiter, authLimiter, loginLimiter } = createRateLimiters({ isTestEnv });

// Middleware
app.use(cors());

// Güvenlik başlıkları (savunma derinliği; yeni bağımlılık yok). Uygulama dış kaynak kullanmıyor
// (Google Fonts/CDN yok), ama inline onclick + login.html inline script/style olduğundan
// script/style için 'unsafe-inline' gerekli. CSP yine de harici script enjeksiyonunu engeller.
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy',
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data:; font-src 'self' data:; " +
        "object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    next();
});

app.use(express.json());

// Session Configuration (SESSION_SECRET in .env for production)
// SESSION_TIMEOUT: Oturum zaman aşımı (milisaniye). Örnek: 3600000 = 1 saat, 86400000 = 24 saat, 604800000 = 7 gün
const sessionTimeout = parseInt(process.env.SESSION_TIMEOUT, 10);
const defaultTimeout = 24 * 60 * 60 * 1000; // 24 saat varsayılan
const effectiveTimeout = (!isNaN(sessionTimeout) && sessionTimeout > 0) ? sessionTimeout : defaultTimeout;

// Security: Require SESSION_SECRET in production
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
    if (process.env.NODE_ENV === 'production') {
        logger.error('FATAL: Production ortamında SESSION_SECRET ortam değişkeni gereklidir!');
        process.exit(1);
    } else {
        logger.warn('UYARI: Geliştirme ortamında çalışılıyor. Production için SESSION_SECRET ayarlayın.');
    }
}

app.use(session({
    secret: sessionSecret || 'analizcim-dev-secret-do-not-use-in-production-' + Date.now(),
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production', maxAge: effectiveTimeout, httpOnly: true, sameSite: 'lax' }
}));

app.use(createSessionRefreshMiddleware(effectiveTimeout));

// Health check uçları — auth ve rate-limit'ten ÖNCE (public). rate-limiters ve auth zaten
// /health ve /api/health'i muaf tutuyordu ama route tanımlı değildi (ölü config).
const healthPayload = () => ({ status: 'ok', service: 'analizcim', ts: new Date().toISOString() });
app.get('/health', (req, res) => res.json(healthPayload()));
app.get('/api/health', (req, res) => res.json(healthPayload()));

app.use(requireAuth);
app.use(express.static(path.join(__dirname, '../public')));

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Multer configuration for file uploads
const fileStorage = multer.memoryStorage();
const upload = multer({
    storage: fileStorage,
    fileFilter: (req, file, cb) => {
        // Türkçe dosya adları latin1 okunduğu için "satış" → "satÄ±s" oluyordu; burada onarılır.
        // fileFilter rota gövdesinden ÖNCE çalışır, bu yüzden aşağıdaki tüm okumalar düzeltilmiş adı görür.
        file.originalname = repairUploadFilename(file.originalname);
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.xlsx' && ext !== '.xls' && ext !== '.csv') {
            return cb(new Error('Sadece Excel (.xlsx, .xls) veya CSV dosyaları kabul edilmektedir.'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Multer configuration for backup file uploads (disk storage)
const backupStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const tempDir = path.join(__dirname, '../data/temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        cb(null, `restore_${Date.now()}${path.extname(file.originalname)}`);
    }
});

const uploadBackup = multer({
    storage: backupStorage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.db' && ext !== '.sqlite' && ext !== '.sqlite3') {
            return cb(new Error('Geçersiz dosya formatı. Sadece .db, .sqlite veya .sqlite3 dosyaları kabul edilmektedir.'));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit for backup files
    }
});

registerBackupRoutes(app, {
    db,
    backupManager,
    storage,
    requireAuth,
    requireAdmin,
    uploadBackup
});

registerAuthRoutes(app, {
    authLimiter,
    loginLimiter,
    bcrypt,
    db,
    storage,
    validatePassword,
    validateUsername,
    validateRequired,
    sanitizeString
});

registerHistoryRoutes(app, {
    storage,
    validateYear,
    validateMonth,
    validateAmount,
    validateAmountRange,
    validateDateRange,
    validateFilterType,
    validatePagination,
    validateSort,
    validateId,
    sanitizeString
});

registerPreferenceRoutes(app, {
    storage,
    sanitizeString
});

registerExpenseRoutes(app, {
    storage,
    validateYear,
    validateMonth,
    validateAmount,
    sanitizeString
});

registerCustomerRoutes(app, {
    storage,
    validateEmail,
    validateId,
    validateSort,
    sanitizeString
});

registerBusinessPartyRoutes(app, {
    storage,
    validateId,
    validateSort,
    sanitizeString
});

const { predictNextMonths } = require('./predictor');
const archiveManager = require('./archive-manager');
const XLSX = require('xlsx');
const DUPLICATE_OPTIONS = ['cancel', 'replace', 'version'];

function buildHistoryExcelBuffer(history) {
    const rows = [
        ['Tarih', 'Satış Dosyası', 'Alış Dosyası', 'Toplam Satış', 'Toplam Alış', 'Satış KDV', 'Alış KDV', 'Net Kâr/Zarar', 'Özet']
    ];
    history.forEach(entry => {
        const sales = entry.sales?.totalAmount || 0;
        const purchase = entry.purchase?.totalAmount || 0;
        const salesTax = entry.sales?.totalTax || 0;
        const purchaseTax = entry.purchase?.totalTax || 0;
        const profit = entry.profitLoss?.amount ?? (sales - purchase);
        rows.push([
            entry.displayDate || entry.date,
            neutralizeSpreadsheetCell(entry.salesFileName || ''),
            neutralizeSpreadsheetCell(entry.purchaseFileName || ''),
            sales,
            purchase,
            salesTax,
            purchaseTax,
            profit,
            neutralizeSpreadsheetCell((entry.summary || '').slice(0, 200))
        ]);
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Geçmiş');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function parseColumnMap(raw) {
    if (!raw) return null;
    let parsed = raw;
    if (typeof raw === 'string') {
        try {
            parsed = JSON.parse(raw);
        } catch (_) {
            throw new Error('Sütun eşleme JSON formatı geçersiz.');
        }
    }
    if (!parsed || typeof parsed !== 'object') return null;

    const fields = ['date', 'counterparty', 'net', 'vat', 'gross'];
    const out = {};
    for (const field of fields) {
        const val = parsed[field];
        if (val == null || val === '') continue;
        const letter = String(val).trim().toUpperCase();
        if (!/^[A-Z]$/.test(letter)) {
            throw new Error(`Sütun eşleme geçersiz: ${field} alanı için tek harf (A-Z) bekleniyor.`);
        }
        out[field] = letter;
    }
    return Object.keys(out).length ? out : null;
}

async function attachBusinessPartyImportSummary(result, options) {
    result.importSummary = await storage.importBusinessPartyTransactions({
        userId: options.userId,
        rows: result.rows || [],
        historyId: result.historyId,
        salesFileName: options.salesFileName || '',
        purchaseFileName: options.purchaseFileName || ''
    });
    return result.importSummary;
}

function getRequestIp(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
        return forwardedFor.split(',')[0].trim();
    }
    return req.ip || req.socket?.remoteAddress || null;
}

async function recordAudit(req, action, entityType = null, entityId = null, details = null) {
    try {
        await storage.logAuditEvent({
            actorUserId: req.session.userId || null,
            actorUsername: req.session.username || null,
            action,
            entityType,
            entityId,
            details,
            ipAddress: getRequestIp(req)
        });
    } catch (error) {
        logger.error({ err: error, action, entityType, entityId }, 'Audit log kaydedilemedi:');
    }
}

// API Endpoint - Get Predictions (geçmiş/dashboard ile aynı kaynak: getMonthlyTotals = rapor dönemine göre)
app.get('/api/predictions', async (req, res) => {
    try {
        const userId = req.session.userId;
        const period = ['6', '12', 'all'].includes(String(req.query.period || 'all'))
            ? String(req.query.period || 'all')
            : 'all';
        const model = ['auto', 'linear', 'exponentialSmoothing', 'holtWinters', 'arima'].includes(String(req.query.model || 'auto'))
            ? String(req.query.model || 'auto')
            : 'auto';
        let monthly = await storage.getMonthlyTotals(undefined, userId);
        if (monthly?.labels?.length) {
            monthly = storage.fillMissingMonths(monthly);
        }
        const allLabels = monthly?.labels || [];
        const allSales = monthly?.sales || [];
        const allPurchases = monthly?.purchases || [];
        const periodLimit = period === '6' ? 6 : period === '12' ? 12 : allLabels.length;
        const startIndex = Math.max(0, allLabels.length - periodLimit);
        const labels = allLabels.slice(startIndex);
        const sales = allSales.slice(startIndex);
        const purchases = allPurchases.slice(startIndex);

        let monthlyDataSales = labels.map((label, i) => ({
            month: label,
            amount: sales[i] || 0
        }));

        let monthlyDataPurchases = labels.map((label, i) => ({
            month: label,
            amount: purchases[i] || 0
        }));

        // Aylık ortalama gideri hesapla (expense_items tablosundan)
        let avgMonthlyExpense = 0;
        if (userId) {
            // Son yılın gider toplamını al ve ay sayısına böl
            const currentYear = new Date().getFullYear();
            const expData = await storage.getExpenseItemsTotalByYear(userId, currentYear);
            const monthCount = Object.keys(expData.byMonth).length;
            avgMonthlyExpense = monthCount > 0 ? Math.round(expData.total / monthCount) : 0;

            // Önceki yıldan da bak (veri yoksa)
            if (avgMonthlyExpense === 0) {
                const prevExpData = await storage.getExpenseItemsTotalByYear(userId, currentYear - 1);
                const prevMonthCount = Object.keys(prevExpData.byMonth).length;
                avgMonthlyExpense = prevMonthCount > 0 ? Math.round(prevExpData.total / prevMonthCount) : 0;
            }
        }

        const predictionResult = predictNextMonths(monthlyDataSales, monthlyDataPurchases, avgMonthlyExpense, { model });

        res.json({
            success: true,
            prediction: predictionResult,
            monthlyData: monthlyDataSales,
            monthlyPurchases: monthlyDataPurchases,
            avgMonthlyExpense,
            filters: { period, model }
        });

    } catch (error) {
        logger.error({ err: error }, 'Prediction error:');
        res.status(500).json({ error: 'Tahmin oluşturulurken hata.' });
    }
});

app.get('/api/break-even', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
    }
    try {
        const year = req.query.year || new Date().getFullYear().toString();
        const data = await storage.getBreakEvenData(req.session.userId, year);
        res.json({ success: true, data });
    } catch (err) {
        logger.error({ err }, 'Başabaş analizi yapılırken hata oluştu');
        res.status(500).json({ error: 'Başabaş analizi yapılırken hata oluştu.' });
    }
});

// Ayarlar sayfasındaki "Veritabanı Boyutu" kutusu hiçbir yerden beslenmiyordu, hep "–"
// gösteriyordu (2026-08-07 denetimi). Yalnız dosya boyutunu döner; içerik sızdırmaz.
app.get('/api/admin/db-size', requireAdmin, (req, res) => {
    try {
        const dbPath = db.filename;
        if (!dbPath || !fs.existsSync(dbPath)) {
            return res.json({ success: true, bytes: null });
        }
        res.json({ success: true, bytes: fs.statSync(dbPath).size });
    } catch (error) {
        logger.error({ err: error }, 'DB size error:');
        res.status(500).json({ error: 'Veritabanı boyutu okunamadı.' });
    }
});

// API - Archive management (admin only)
app.get('/api/archive', requireAdmin, async (req, res) => {
    try {
        const years = archiveManager.archivedYears();
        const archives = years.map(y => archiveManager.getArchiveInfo(y)).filter(Boolean);
        res.json({ success: true, archives });
    } catch (error) {
        logger.error({ err: error }, 'Archive list error:');
        res.status(500).json({ error: 'Arşiv listesi alınamadı.' });
    }
});

app.post('/api/archive/:year', requireAdmin, async (req, res) => {
    try {
        const year = parseInt(req.params.year, 10);
        if (isNaN(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ error: 'Geçersiz yıl.' });
        }
        const result = await archiveManager.archiveYear(year, db);
        await recordAudit(req, 'archive.year', 'archive', String(year), result);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error({ err: error }, 'Archive error:');
        if (error.message.includes('zaten arşivlenmiş')) {
            return res.status(409).json({ error: error.message });
        }
        res.status(500).json({ error: 'Arşivleme sırasında hata oluştu.' });
    }
});

app.post('/api/archive/:year/restore', requireAdmin, async (req, res) => {
    try {
        const year = parseInt(req.params.year, 10);
        if (isNaN(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ error: 'Geçersiz yıl.' });
        }
        const result = await archiveManager.restoreYear(year, db);
        await recordAudit(req, 'archive.restore', 'archive', String(year), result);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error({ err: error }, 'Archive restore error:');
        res.status(500).json({ error: 'Arşiv geri yüklenirken hata oluştu.' });
    }
});

app.delete('/api/archive/:year', requireAdmin, async (req, res) => {
    try {
        const year = parseInt(req.params.year, 10);
        if (isNaN(year) || year < 2000 || year > 2100) {
            return res.status(400).json({ error: 'Geçersiz yıl.' });
        }
        const result = archiveManager.deleteArchive(year);
        await recordAudit(req, 'archive.delete', 'archive', String(year), result);
        res.json({ success: true, ...result });
    } catch (error) {
        logger.error({ err: error }, 'Archive delete error:');
        res.status(500).json({ error: 'Arşiv silinirken hata oluştu.' });
    }
});

// API Endpoint - Analyze Excel files
app.post('/api/analyze', upload.fields([
    { name: 'salesFile', maxCount: 1 },
    { name: 'purchaseFile', maxCount: 1 }
]), async (req, res) => {
    try {
        const userId = req.session.userId;
        const salesFile = req.files?.salesFile?.[0];
        const purchaseFile = req.files?.purchaseFile?.[0];

        if (!salesFile && !purchaseFile) {
            return res.status(400).json({
                error: 'En az bir Excel veya CSV dosyası yüklemelisiniz.'
            });
        }

        // Validate duplicateAction
        const requestedAction = String(req.body?.duplicateAction || 'cancel').toLowerCase();
        if (!DUPLICATE_OPTIONS.includes(requestedAction)) {
            return res.status(400).json({ error: 'Geçersiz işlem seçeneği.' });
        }
        const duplicateAction = requestedAction;
        const salesColumnMap = parseColumnMap(req.body?.salesColumnMap);
        const purchaseColumnMap = parseColumnMap(req.body?.purchaseColumnMap);

        // Check for duplicate reports (each month can only have one sales and one purchase report)
        const monthNames = ['', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const duplicates = [];

        if (salesFile) {
            const parsed = storage.parseDateFromFilename(salesFile.originalname);
            if (parsed) {
                const duplicate = await storage.checkDuplicateReport(parsed.year, parsed.month, 'sales', userId);
                if (duplicate.exists) {
                    duplicates.push({
                        id: duplicate.id,
                        type: 'sales',
                        year: parsed.year,
                        month: parsed.month,
                        monthLabel: monthNames[parsed.month],
                        existingFile: duplicate.filename
                    });
                }
            }
        }

        if (purchaseFile) {
            const parsed = storage.parseDateFromFilename(purchaseFile.originalname);
            if (parsed) {
                const duplicate = await storage.checkDuplicateReport(parsed.year, parsed.month, 'purchase', userId);
                if (duplicate.exists) {
                    duplicates.push({
                        id: duplicate.id,
                        type: 'purchase',
                        year: parsed.year,
                        month: parsed.month,
                        monthLabel: monthNames[parsed.month],
                        existingFile: duplicate.filename
                    });
                }
            }
        }

        if (duplicates.length > 0) {
            if (duplicateAction === 'replace') {
                for (const duplicate of duplicates) {
                    await storage.deleteReportsByPeriodType(duplicate.year, duplicate.month, duplicate.type, userId);
                }
            } else if (duplicateAction !== 'version') {
                const first = duplicates[0];
                const typeLabel = first.type === 'sales' ? 'satış' : 'alış';
                return res.status(409).json({
                    error: `${first.monthLabel} ${first.year} için zaten bir ${typeLabel} raporu mevcut.`,
                    duplicateType: first.type,
                    existingFile: first.existingFile,
                    duplicateAction: 'required',
                    duplicateOptions: DUPLICATE_OPTIONS,
                    duplicates
                });
            }
        }

        const result = analyzeFiles(salesFile?.buffer, purchaseFile?.buffer, {
            salesColumnMap,
            purchaseColumnMap
        });

        // Save to history
        const historyEntry = await storage.addToHistory(
            result,
            salesFile?.originalname,
            purchaseFile?.originalname,
            userId
        );
        result.historyId = historyEntry.id;
        await attachBusinessPartyImportSummary(result, {
            userId,
            salesFileName: salesFile?.originalname || '',
            purchaseFileName: purchaseFile?.originalname || ''
        });

        // Auto-save summary for the analyzed month(s)
        try {
            const monthsToUpdate = new Set();
            
            if (salesFile?.originalname) {
                const parsed = storage.parseDateFromFilename(salesFile.originalname);
                if (parsed) {
                    monthsToUpdate.add(`${parsed.year}-${String(parsed.month).padStart(2, '0')}`);
                }
            }
            if (purchaseFile?.originalname) {
                const parsed = storage.parseDateFromFilename(purchaseFile.originalname);
                if (parsed) {
                    monthsToUpdate.add(`${parsed.year}-${String(parsed.month).padStart(2, '0')}`);
                }
            }

            // Compute and save summary for each month
            for (const monthStr of monthsToUpdate) {
                const [year] = monthStr.split('-');
                await storage.computeAndSaveSummary(userId, year, monthStr);
            }
        } catch (summaryError) {
            logger.error({ err: summaryError }, 'Summary auto-save error:');
            // Don't fail the main request if summary save fails
        }

        res.json(result);

    } catch (error) {
        logger.error({ err: error }, 'Analiz hatası:');
        if (error && typeof error.message === 'string' && error.message.includes('Sütun eşleme')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({
            error: 'Dosya analizi sırasında bir hata oluştu.'
        });
    }
});

// API - Merge Analyze: accept multiple sales/purchase files and merge into one analysis
app.post('/api/analyze/merge', upload.fields([
    { name: 'salesFiles', maxCount: 50 },
    { name: 'purchaseFiles', maxCount: 50 }
]), async (req, res) => {
    try {
        const userId = req.session.userId;
        const salesFiles = req.files?.salesFiles || [];
        const purchaseFiles = req.files?.purchaseFiles || [];

        if (salesFiles.length === 0 && purchaseFiles.length === 0) {
            return res.status(400).json({
                error: 'En az bir Excel veya CSV dosyası yüklemelisiniz.'
            });
        }

        const salesBuffers = salesFiles.map(f => f.buffer);
        const purchaseBuffers = purchaseFiles.map(f => f.buffer);
        const salesColumnMap = parseColumnMap(req.body?.salesColumnMap);
        const purchaseColumnMap = parseColumnMap(req.body?.purchaseColumnMap);

        const result = mergeAnalyzeFiles(salesBuffers, purchaseBuffers, {
            salesColumnMap,
            purchaseColumnMap
        });

        const salesFilenames = salesFiles.map(f => f.originalname).join('; ');
        const purchaseFilenames = purchaseFiles.map(f => f.originalname).join('; ');

        const historyEntry = await storage.addToHistory(
            result,
            salesFilenames,
            purchaseFilenames,
            userId
        );
        result.historyId = historyEntry.id;
        await attachBusinessPartyImportSummary(result, {
            userId,
            salesFileName: salesFilenames,
            purchaseFileName: purchaseFilenames
        });

        // Auto-save summary for the analyzed month(s)
        try {
            const monthsToUpdate = new Set();
            const allFiles = [...salesFiles, ...purchaseFiles];
            for (const file of allFiles) {
                const parsed = storage.parseDateFromFilename(file.originalname);
                if (parsed) {
                    monthsToUpdate.add(`${parsed.year}-${String(parsed.month).padStart(2, '0')}`);
                }
            }
            for (const monthStr of monthsToUpdate) {
                const [year] = monthStr.split('-');
                await storage.computeAndSaveSummary(userId, year, monthStr);
            }
        } catch (summaryError) {
            logger.error({ err: summaryError }, 'Merge summary auto-save error:');
        }

        res.json(result);
    } catch (error) {
        logger.error({ err: error }, 'Merge analiz hatası:');
        // Yalnızca bilinen, kullanıcıya yönelik doğrulama mesajları gösterilir; iç hata detayı sızmaz
        if (error && typeof error.message === 'string' &&
            (error.message.includes('Sütun eşleme') || error.message.includes('En az bir dosya'))) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({
            error: 'Dosya birleştirme analizi sırasında bir hata oluştu.'
        });
    }
});

// API - Summaries (pre-computed monthly summaries)
// Get all summaries for a specific year
app.get('/api/summaries/:year', async (req, res) => {
    try {
        const userId = req.session.userId;
        
        // Validate year
        const yearValidation = validateYear(req.params.year);
        if (!yearValidation.valid) {
            return res.status(400).json({ error: yearValidation.error });
        }
        
        const summaries = await storage.getSummariesByYear(userId, yearValidation.value);
        res.json({ success: true, summaries });
    } catch (error) {
        logger.error({ err: error }, 'Summaries get error:');
        res.status(500).json({ error: 'Özetler yüklenirken hata oluştu.' });
    }
});

// Delete a specific month summary
app.delete('/api/summaries/:year/:month', async (req, res) => {
    try {
        const userId = req.session.userId;
        
        // Validate year
        const yearValidation = validateYear(req.params.year);
        if (!yearValidation.valid) {
            return res.status(400).json({ error: yearValidation.error });
        }
        
        // Validate month
        const monthValidation = validateMonth(req.params.month);
        if (!monthValidation.valid) {
            return res.status(400).json({ error: monthValidation.error });
        }
        
        const monthStr = `${yearValidation.value}-${String(monthValidation.value).padStart(2, '0')}`;
        const deleted = await storage.deleteSummary(userId, yearValidation.value, monthStr);
        
        if (deleted) {
            res.json({ success: true, message: 'Özet silindi.' });
        } else {
            res.status(404).json({ error: 'Özet bulunamadı.' });
        }
    } catch (error) {
        logger.error({ err: error }, 'Summary delete error:');
        res.status(500).json({ error: 'Özet silinirken hata oluştu.' });
    }
});


// =============================================
// USER MANAGEMENT ENDPOINTS (Admin only)
// =============================================

// GET /api/users - List all users (admin only)
app.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const users = await storage.getAllUsers();
        res.json({ success: true, users });
    } catch (error) {
        logger.error({ err: error }, 'Get all users error:');
        res.status(500).json({ error: 'Kullanıcılar getirilirken hata oluştu.' });
    }
});

// GET /api/users/:id - Get single user by ID
app.get('/api/users/:id', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
    }
    
    const idValidation = validateId(req.params.id);
    if (!idValidation.valid) {
        return res.status(400).json({ error: idValidation.error });
    }
    
    try {
        const user = await storage.getUserById(idValidation.value);
        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        }
        res.json({ success: true, user });
    } catch (error) {
        logger.error({ err: error }, 'Get user by id error:');
        res.status(500).json({ error: 'Kullanıcı getirilirken hata oluştu.' });
    }
});

// DELETE /api/users/:id - Delete user (admin only, cannot delete self)
app.delete('/api/users/:id', requireAdmin, async (req, res) => {
    const idValidation = validateId(req.params.id);
    if (!idValidation.valid) {
        return res.status(400).json({ error: idValidation.error });
    }
    
    try {
        const targetUser = await storage.getUserById(idValidation.value);
        const result = await storage.deleteUser(idValidation.value, req.session.userId);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        await recordAudit(req, 'user.delete', 'user', idValidation.value, {
            username: targetUser?.username || null
        });
        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Delete user error:');
        res.status(500).json({ error: 'Kullanıcı silinirken hata oluştu.' });
    }
});

// PUT /api/users/:id/role - Update user role (admin only)
app.put('/api/users/:id/role', requireAdmin, async (req, res) => {
    const idValidation = validateId(req.params.id);
    if (!idValidation.valid) {
        return res.status(400).json({ error: idValidation.error });
    }
    
    const { role } = req.body;
    if (!role || !['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Geçersiz rol. "admin" veya "user" olmalıdır.' });
    }
    
    try {
        const targetUser = await storage.getUserById(idValidation.value);
        const result = await storage.updateUserRole(idValidation.value, role);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        await recordAudit(req, 'user.role.update', 'user', idValidation.value, {
            username: targetUser?.username || null,
            previousRole: targetUser?.is_admin ? 'admin' : 'user',
            newRole: role
        });
        res.json({ success: true });
    } catch (error) {
        logger.error({ err: error }, 'Update user role error:');
        res.status(500).json({ error: 'Kullanıcı rolü güncellenirken hata oluştu.' });
    }
});

// =============================================
// END USER MANAGEMENT ENDPOINTS
// =============================================

// =============================================
// USER APPROVAL ENDPOINTS (Admin only)
// =============================================

// Onay bekleyen kullanıcıları listele
app.get('/api/admin/pending-users', requireAdmin, async (req, res) => {
    try {
        const users = await storage.getPendingUsers();
        res.json({ success: true, users, count: users.length });
    } catch (err) {
        logger.error({ err }, 'Pending users listesi hatası:');
        res.status(500).json({ error: 'Bekleyen kullanıcılar getirilirken hata oluştu.' });
    }
});

// Kullanıcıyı onayla
app.post('/api/admin/users/:id/approve', requireAdmin, async (req, res) => {
    const idValidation = validateId(req.params.id);
    if (!idValidation.valid) {
        return res.status(400).json({ error: idValidation.error });
    }
    try {
        const targetUser = await storage.getUserById(idValidation.value);
        const result = await storage.approveUser(idValidation.value);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        await recordAudit(req, 'user.approve', 'user', idValidation.value, {
            username: targetUser?.username || null
        });
        res.json({ success: true });
    } catch (err) {
        logger.error({ err }, 'Kullanıcı onaylama hatası:');
        res.status(500).json({ error: 'Kullanıcı onaylanırken hata oluştu.' });
    }
});

// Kullanıcıyı reddet
app.post('/api/admin/users/:id/reject', requireAdmin, async (req, res) => {
    const idValidation = validateId(req.params.id);
    if (!idValidation.valid) {
        return res.status(400).json({ error: idValidation.error });
    }
    try {
        const targetUser = await storage.getUserById(idValidation.value);
        const result = await storage.rejectUser(idValidation.value);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        await recordAudit(req, 'user.reject', 'user', idValidation.value, {
            username: targetUser?.username || null
        });
        res.json({ success: true });
    } catch (err) {
        logger.error({ err }, 'Kullanıcı reddetme hatası:');
        res.status(500).json({ error: 'Kullanıcı reddedilirken hata oluştu.' });
    }
});

app.get('/api/admin/audit-logs', requireAdmin, async (req, res) => {
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const parsedOffset = Number.parseInt(req.query.offset, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 50;
    const offset = Number.isFinite(parsedOffset) ? Math.max(parsedOffset, 0) : 0;

    try {
        const logs = await storage.getAuditLogs(limit, offset);
        res.json({ success: true, logs, limit, offset });
    } catch (err) {
        logger.error({ err }, 'Audit log listesi hatası:');
        res.status(500).json({ error: 'Audit loglar getirilirken hata oluştu.' });
    }
});

// =============================================
// END USER APPROVAL ENDPOINTS
// =============================================

// Veri olan yılları getir (expense_items + analyses)
app.get('/api/expenses-local/years', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
    }
    try {
        const years = await storage.getExpenseItemYears(req.session.userId);
        res.json({ success: true, years });
    } catch (error) {
        logger.error({ err: error }, 'Expenses-local years error:');
        res.status(500).json({ error: 'Yıllar getirilirken hata oluştu.' });
    }
});

// API - Export history to Excel
app.get('/api/export/history', async (req, res) => {
    try {
        const history = await storage.getHistory({ userId: req.session.userId, limit: 1000, sort: 'date_desc' });
        const buf = buildHistoryExcelBuffer(history);
        res.setHeader('Content-Disposition', 'attachment; filename=analizcim-gecmis.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) {
        logger.error({ err: error }, 'Export history error:');
        res.status(500).json({ error: 'Dışa aktarım sırasında hata oluştu.' });
    }
});

app.post('/api/export/history/batch', async (req, res) => {
    try {
        const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
        if (!ids || ids.length === 0) {
            return res.status(400).json({ error: 'Dışa aktarılacak kayıt seçilmelidir.' });
        }

        const validatedIds = [];
        for (const id of ids) {
            const idValidation = validateId(id);
            if (!idValidation.valid) {
                return res.status(400).json({ error: idValidation.error });
            }
            validatedIds.push(String(idValidation.value));
        }

        const history = await storage.getHistoryByIds(validatedIds, req.session.userId);
        const buf = buildHistoryExcelBuffer(history);
        res.setHeader('Content-Disposition', 'attachment; filename=analizcim-gecmis-secili.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        return res.send(buf);
    } catch (error) {
        logger.error({ err: error }, 'Batch export history error:');
        return res.status(500).json({ error: 'Dışa aktarım sırasında hata oluştu.' });
    }
});

// API - Export history to JSON
app.get('/api/export/history/json', async (req, res) => {
    try {
        const history = await storage.getHistory({ userId: req.session.userId, limit: 1000, sort: 'date_desc' });
        const exportData = history.map(entry => ({
            date: entry.displayDate || entry.date,
            salesFileName: entry.salesFileName || '',
            purchaseFileName: entry.purchaseFileName || '',
            sales: {
                totalAmount: entry.sales?.totalAmount || 0,
                totalTax: entry.sales?.totalTax || 0,
                transactionCount: entry.sales?.transactionCount || 0
            },
            purchase: {
                totalAmount: entry.purchase?.totalAmount || 0,
                totalTax: entry.purchase?.totalTax || 0,
                transactionCount: entry.purchase?.transactionCount || 0
            },
            profitLoss: {
                amount: entry.profitLoss?.amount ?? ((entry.sales?.totalAmount || 0) - (entry.purchase?.totalAmount || 0)),
                isProfit: (entry.profitLoss?.amount ?? ((entry.sales?.totalAmount || 0) - (entry.purchase?.totalAmount || 0))) >= 0
            },
            summary: entry.summary || ''
        }));
        res.setHeader('Content-Disposition', 'attachment; filename=analizcim-gecmis.json');
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(exportData, null, 2));
    } catch (error) {
        logger.error({ err: error }, 'Export history JSON error:');
        res.status(500).json({ error: 'JSON dışa aktarımı sırasında hata oluştu.' });
    }
});

// API - Export dashboard (year summary) to Excel
app.get('/api/export/dashboard', async (req, res) => {
    try {
        // Validate year if provided
        let year = new Date().getFullYear();
        if (req.query.year != null && req.query.year !== '') {
            const yearValidation = validateYear(req.query.year);
            if (!yearValidation.valid) {
                return res.status(400).json({ error: yearValidation.error });
            }
            year = yearValidation.value;
        }
        
        const history = await storage.getHistory({ userId: req.session.userId, limit: 1000 });
        const yearHistory = history.filter(entry => {
            const d = new Date(entry.date);
            return d.getFullYear() === year;
        });
        let totalSales = 0, totalPurchase = 0, totalSalesTax = 0, totalPurchaseTax = 0, totalProfit = 0;
        yearHistory.forEach(entry => {
            totalSales += entry.sales?.totalAmount || 0;
            totalPurchase += entry.purchase?.totalAmount || 0;
            totalSalesTax += entry.sales?.totalTax || 0;
            totalPurchaseTax += entry.purchase?.totalTax || 0;
            totalProfit += (entry.profitLoss?.amount ?? ((entry.sales?.totalAmount || 0) - (entry.purchase?.totalAmount || 0)));
        });
        const netTax = totalSalesTax - totalPurchaseTax;
        const rows = [
            ['Dashboard Özeti', year],
            [],
            ['Metrik', 'Değer'],
            ['Toplam Analiz Sayısı', yearHistory.length],
            ['Toplam Satış', totalSales],
            ['Toplam Alış', totalPurchase],
            ['Brüt Kâr/Zarar', totalProfit],
            ['Toplam Satış KDV', totalSalesTax],
            ['Toplam Alış KDV', totalPurchaseTax],
            ['Net KDV', netTax]
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, `${year} Özet`);
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', `attachment; filename=analizcim-dashboard-${year}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (error) {
        logger.error({ err: error }, 'Export dashboard error:');
        res.status(500).json({ error: 'Dışa aktarım sırasında hata oluştu.' });
    }
});

// PDF Export Helper - Format Turkish numbers
const formatTurkishNumber = (num) => {
    if (num == null) return '0,00';
    const fixed = Number(num).toFixed(2);
    return fixed.replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// PDF Export Helper - Format date for Turkish locale
const formatTurkishDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
};

// API - Export history to PDF
app.get('/api/export/pdf-history', async (req, res) => {
    try {
        const { jsPDF } = require('jspdf');
        const autoTable = require('jspdf-autotable').default || require('jspdf-autotable').autoTable;
        
        const history = await storage.getHistory({ userId: req.session.userId, limit: 1000, sort: 'date_desc' });
        
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Header
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text('Analizcim - Geçmiş Raporları', 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Dışa Aktarım Tarihi: ${formatTurkishDate(new Date())}`, 14, 30);
        
        // Summary section
        let totalSales = 0, totalPurchase = 0, totalProfit = 0;
        history.forEach(entry => {
            totalSales += entry.sales?.totalAmount || 0;
            totalPurchase += entry.purchase?.totalAmount || 0;
            totalProfit += (entry.profitLoss?.amount ?? ((entry.sales?.totalAmount || 0) - (entry.purchase?.totalAmount || 0)));
        });
        
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text(`Toplam Kayıt: ${history.length}`, 14, 40);
        doc.text(`Toplam Satış: ${formatTurkishNumber(totalSales)} TL`, 14, 47);
        doc.text(`Toplam Alış: ${formatTurkishNumber(totalPurchase)} TL`, 14, 54);
        doc.text(`Toplam Kâr/Zarar: ${formatTurkishNumber(totalProfit)} TL`, 14, 61);
        
        // Table
        const tableData = history.map(entry => [
            formatTurkishDate(entry.date),
            entry.salesFileName ? entry.salesFileName.substring(0, 20) : '-',
            entry.purchaseFileName ? entry.purchaseFileName.substring(0, 20) : '-',
            formatTurkishNumber(entry.sales?.totalAmount || 0),
            formatTurkishNumber(entry.purchase?.totalAmount || 0),
            formatTurkishNumber(entry.profitLoss?.amount ?? ((entry.sales?.totalAmount || 0) - (entry.purchase?.totalAmount || 0)))
        ]);
        
        autoTable(doc, {
            head: [['Tarih', 'Satış Dosyası', 'Alış Dosyası', 'Satış', 'Alış', 'Kâr/Zarar']],
            body: tableData,
            startY: 70,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [66, 135, 245], textColor: 255 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 30 },
                2: { cellWidth: 30 },
                3: { cellWidth: 25, halign: 'right' },
                4: { cellWidth: 25, halign: 'right' },
                5: { cellWidth: 25, halign: 'right' }
            }
        });
        
        // Footer with page numbers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Sayfa ${i} / ${pageCount}`, pageWidth - 25, doc.internal.pageSize.getHeight() - 10);
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=analizcim-gecmis.pdf');
        res.send(Buffer.from(doc.output('arraybuffer')));
    } catch (error) {
        logger.error({ err: error }, 'PDF export history error:');
        res.status(500).json({ error: 'PDF dışa aktarımı sırasında hata oluştu.' });
    }
});

// API - Export dashboard to PDF
app.get('/api/export/pdf-dashboard/:year', async (req, res) => {
    try {
        const { jsPDF } = require('jspdf');
        const autoTable = require('jspdf-autotable').default || require('jspdf-autotable').autoTable;
        
        // Validate year
        let year = new Date().getFullYear();
        if (req.params.year != null && req.params.year !== '') {
            const yearValidation = validateYear(req.params.year);
            if (!yearValidation.valid) {
                return res.status(400).json({ error: yearValidation.error });
            }
            year = yearValidation.value;
        }
        const userId = req.session.userId;
        const [yearHistory, expenseData] = await Promise.all([
            storage.getHistory({ userId, year, limit: 1000, sort: 'date_asc' }),
            storage.getExpenseItemsTotalByYear(userId, year)
        ]);

        let totalSales = 0, totalPurchase = 0, totalSalesTax = 0, totalPurchaseTax = 0, totalProfit = 0;
        yearHistory.forEach(entry => {
            totalSales += entry.sales?.totalAmount || 0;
            totalPurchase += entry.purchase?.totalAmount || 0;
            totalSalesTax += entry.sales?.totalTax || 0;
            totalPurchaseTax += entry.purchase?.totalTax || 0;
            totalProfit += (entry.profitLoss?.amount ?? ((entry.sales?.totalAmount || 0) - (entry.purchase?.totalAmount || 0)));
        });
        const netTax = totalSalesTax - totalPurchaseTax;
        const totalExpenses = expenseData.total || 0;
        const netProfit = totalProfit - totalExpenses;
        const profitMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
        const expenseRatio = totalSales > 0 ? (totalExpenses / totalSales) * 100 : 0;
        const taxLoad = totalSales > 0 ? (netTax / totalSales) * 100 : 0;

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const accent = [46, 170, 220];
        const dark = [35, 35, 35];
        const muted = [110, 110, 110];

        doc.setFillColor(...accent);
        doc.rect(0, 0, pageWidth, 8, 'F');
        doc.setFillColor(247, 246, 243);
        doc.rect(0, 8, pageWidth, pageHeight - 8, 'F');
        doc.setTextColor(...dark);
        doc.setFontSize(28);
        doc.text('Analizcim', 18, 45);
        doc.setFontSize(18);
        doc.text(`${year} Yılı Dashboard Raporu`, 18, 60);
        doc.setFontSize(11);
        doc.setTextColor(...muted);
        doc.text('Rapor Türü: Yıllık Dashboard Özeti', 18, 72);
        doc.text(`Oluşturma Tarihi: ${formatTurkishDate(new Date())}`, 18, 80);
        doc.setFillColor(255, 255, 255);
        doc.rect(18, 105, pageWidth - 36, 62, 'F');
        doc.setTextColor(...dark);
        doc.setFontSize(13);
        doc.text('Yönetici Özeti', 26, 120);
        doc.setFontSize(10);
        doc.text(`Toplam Satış: ${formatTurkishNumber(totalSales)} TL`, 26, 134);
        doc.text(`Toplam Alış: ${formatTurkishNumber(totalPurchase)} TL`, 26, 143);
        doc.text(`Brüt Kâr/Zarar: ${formatTurkishNumber(totalProfit)} TL`, 26, 152);
        doc.text(`Net Kâr/Zarar: ${formatTurkishNumber(netProfit)} TL`, 108, 134);
        doc.text(`Net KDV: ${formatTurkishNumber(netTax)} TL`, 108, 143);
        doc.text(`Toplam Gider: ${formatTurkishNumber(totalExpenses)} TL`, 108, 152);

        doc.addPage();
        doc.setFillColor(...accent);
        doc.rect(0, 0, pageWidth, 6, 'F');
        doc.setTextColor(...dark);
        doc.setFontSize(16);
        doc.text(`${year} Finansal Dashboard Özeti`, 14, 22);
        doc.setFontSize(9);
        doc.setTextColor(...muted);
        doc.text('Rapor Türü: Yıllık Dashboard Özeti', 14, 30);

        const summaryData = [
            ['Toplam Analiz Sayısı', yearHistory.length.toString()],
            ['Toplam Satış', `${formatTurkishNumber(totalSales)} TL`],
            ['Toplam Alış', `${formatTurkishNumber(totalPurchase)} TL`],
            ['Brüt Kâr/Zarar', `${formatTurkishNumber(totalProfit)} TL`],
            ['Toplam Gider', `${formatTurkishNumber(totalExpenses)} TL`],
            ['Net Kâr/Zarar', `${formatTurkishNumber(netProfit)} TL`],
            ['Net KDV', `${formatTurkishNumber(netTax)} TL`]
        ];
        const ratioData = [
            ['Kâr Marjı', `%${formatTurkishNumber(profitMargin)}`],
            ['Gider Oranı', `%${formatTurkishNumber(expenseRatio)}`],
            ['KDV Yükü', `%${formatTurkishNumber(taxLoad)}`]
        ];

        autoTable(doc, {
            head: [['Yönetici Özeti', 'Değer']],
            body: summaryData,
            startY: 40,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3, lineColor: [225, 225, 225], lineWidth: 0.1 },
            headStyles: { fillColor: accent, textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 70, halign: 'right' } },
            margin: { left: 14, right: 14 }
        });

        autoTable(doc, {
            head: [['Finansal Oran', 'Değer']],
            body: ratioData,
            startY: doc.lastAutoTable.finalY + 8,
            theme: 'grid',
            styles: { fontSize: 9, cellPadding: 3, lineColor: [225, 225, 225], lineWidth: 0.1 },
            headStyles: { fillColor: [144, 101, 176], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 70, halign: 'right' } },
            margin: { left: 14, right: 14 }
        });

        const monthlyData = {};
        for (let m = 1; m <= 12; m++) {
            const key = `${year}-${String(m).padStart(2, '0')}`;
            monthlyData[key] = { label: new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString('tr-TR', { month: 'long' }), sales: 0, purchase: 0, salesTax: 0, purchaseTax: 0, profit: 0, expenses: expenseData.byMonth?.[key] || 0 };
        }
        yearHistory.forEach(entry => {
            const parsed = storage.parseDateFromFilename(entry.salesFileName, entry.date) || storage.parseDateFromFilename(entry.purchaseFileName, entry.date);
            const fallbackDate = new Date(entry.date);
            const entryYear = parsed ? parsed.year : fallbackDate.getFullYear();
            const entryMonth = parsed ? parsed.month : fallbackDate.getMonth() + 1;
            const key = `${entryYear}-${String(entryMonth).padStart(2, '0')}`;
            if (!monthlyData[key]) return;
            const sales = entry.sales?.totalAmount || 0;
            const purchase = entry.purchase?.totalAmount || 0;
            const profit = entry.profitLoss?.amount ?? (sales - purchase);
            monthlyData[key].sales += sales;
            monthlyData[key].purchase += purchase;
            monthlyData[key].salesTax += entry.sales?.totalTax || 0;
            monthlyData[key].purchaseTax += entry.purchase?.totalTax || 0;
            monthlyData[key].profit += profit;
        });

        const tableRows = Object.entries(monthlyData).map(([, data]) => [
            data.label,
            formatTurkishNumber(data.sales),
            formatTurkishNumber(data.purchase),
            formatTurkishNumber(data.profit),
            formatTurkishNumber(data.expenses),
            formatTurkishNumber(data.profit - data.expenses),
            formatTurkishNumber(data.salesTax - data.purchaseTax)
        ]);

        autoTable(doc, {
            head: [['Ay', 'Satış', 'Alış', 'Brüt Kâr', 'Gider', 'Net Kâr', 'Net KDV']],
            body: tableRows,
            startY: doc.lastAutoTable.finalY + 12,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2.5, lineColor: [225, 225, 225], lineWidth: 0.1 },
            headStyles: { fillColor: accent, textColor: 255, fontStyle: 'bold', halign: 'center' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { cellWidth: 26 },
                1: { cellWidth: 26, halign: 'right' },
                2: { cellWidth: 26, halign: 'right' },
                3: { cellWidth: 26, halign: 'right' },
                4: { cellWidth: 25, halign: 'right' },
                5: { cellWidth: 25, halign: 'right' },
                6: { cellWidth: 25, halign: 'right' }
            },
            margin: { left: 14, right: 14 }
        });

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            if (i > 1) {
                doc.setFillColor(...accent);
                doc.rect(0, 0, pageWidth, 6, 'F');
                doc.setFontSize(8);
                doc.setTextColor(...muted);
                doc.text('Analizcim', 14, pageHeight - 10);
            }
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Sayfa ${i} / ${pageCount}`, pageWidth - 28, pageHeight - 10);
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=analizcim-dashboard-${year}.pdf`);
        res.send(Buffer.from(doc.output('arraybuffer')));
    } catch (error) {
        logger.error({ err: error }, 'PDF export dashboard error:');
        res.status(500).json({ error: 'PDF dışa aktarımı sırasında hata oluştu.' });
    }
});

// API - Export single analysis to PDF
app.get('/api/export/pdf-analysis/:id', async (req, res) => {
    try {
        const { jsPDF } = require('jspdf');
        const autoTable = require('jspdf-autotable').default || require('jspdf-autotable').autoTable;
        
        const userId = req.session.userId;
        
        // Validate ID
        const idValidation = validateId(req.params.id);
        if (!idValidation.valid) {
            return res.status(400).json({ error: idValidation.error });
        }
        
        const entry = await storage.getHistoryById(idValidation.value, userId);
        if (!entry) {
            return res.status(404).json({ error: 'Kayıt bulunamadı.' });
        }
        
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        
        // Header
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40);
        doc.text('Analizcim - Analiz Detay Raporu', 14, 22);
        
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Dışa Aktarım Tarihi: ${formatTurkishDate(new Date())}`, 14, 30);
        
        // Analysis info box
        doc.setFillColor(245, 245, 250);
        doc.rect(14, 38, pageWidth - 28, 35, 'F');
        
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 40);
        doc.text('Analiz Bilgileri', 20, 48);
        
        doc.setFontSize(10);
        doc.text(`Tarih: ${formatTurkishDate(entry.date)}`, 20, 56);
        doc.text(`Satış Dosyası: ${entry.salesFileName || '-'}`, 20, 63);
        doc.text(`Alış Dosyası: ${entry.purchaseFileName || '-'}`, 20, 70);
        
        // Financial summary
        const sales = entry.sales?.totalAmount || 0;
        const purchase = entry.purchase?.totalAmount || 0;
        const salesTax = entry.sales?.totalTax || 0;
        const purchaseTax = entry.purchase?.totalTax || 0;
        const profit = entry.profitLoss?.amount ?? (sales - purchase);
        
        doc.setFillColor(240, 248, 255);
        doc.rect(14, 80, pageWidth - 28, 40, 'F');
        
        doc.setFontSize(11);
        doc.text('Finansal Özet', 20, 90);
        
        doc.setFontSize(10);
        doc.text(`Toplam Satış: ${formatTurkishNumber(sales)} TL`, 20, 100);
        doc.text(`Toplam Alış: ${formatTurkishNumber(purchase)} TL`, 20, 108);
        doc.text(`Satış KDV: ${formatTurkishNumber(salesTax)} TL`, 100, 100);
        doc.text(`Alış KDV: ${formatTurkishNumber(purchaseTax)} TL`, 100, 108);
        
        // Profit highlight
        doc.setFontSize(12);
        if (profit >= 0) {
            doc.setTextColor(34, 139, 34);
        } else {
            doc.setTextColor(220, 20, 60);
        }
        doc.text(`Kâr/Zarar: ${formatTurkishNumber(profit)} TL`, 20, 118);
        
        // Sales details table (if available)
        if (entry.sales && entry.sales.items && entry.sales.items.length > 0) {
            doc.setTextColor(40, 40, 40);
            doc.setFontSize(11);
            doc.text('Satış Detayları', 14, 135);
            
            const salesTableData = entry.sales.items.slice(0, 50).map(item => [
                item.date || '-',
                item.invoiceNo || '-',
                item.customer || '-',
                formatTurkishNumber(item.amount),
                formatTurkishNumber(item.tax)
            ]);
            
            autoTable(doc, {
                head: [['Tarih', 'Fatura No', 'Müşteri', 'Tutar', 'KDV']],
                body: salesTableData,
                startY: 140,
                styles: { fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [66, 135, 245], textColor: 255 },
                columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 25 },
                    2: { cellWidth: 50 },
                    3: { cellWidth: 30, halign: 'right' },
                    4: { cellWidth: 30, halign: 'right' }
                }
            });
        }
        
        // Purchase details table (if available)
        const currentY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 200;
        if (entry.purchase && entry.purchase.items && entry.purchase.items.length > 0) {
            doc.setTextColor(40, 40, 40);
            doc.setFontSize(11);
            doc.text('Alış Detayları', 14, currentY);
            
            const purchaseTableData = entry.purchase.items.slice(0, 50).map(item => [
                item.date || '-',
                item.invoiceNo || '-',
                item.supplier || '-',
                formatTurkishNumber(item.amount),
                formatTurkishNumber(item.tax)
            ]);
            
            autoTable(doc, {
                head: [['Tarih', 'Fatura No', 'Tedarikçi', 'Tutar', 'KDV']],
                body: purchaseTableData,
                startY: currentY + 5,
                styles: { fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [100, 149, 237], textColor: 255 },
                columnStyles: {
                    0: { cellWidth: 25 },
                    1: { cellWidth: 25 },
                    2: { cellWidth: 50 },
                    3: { cellWidth: 30, halign: 'right' },
                    4: { cellWidth: 30, halign: 'right' }
                }
            });
        }
        
        // Footer with page numbers
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(`Sayfa ${i} / ${pageCount}`, pageWidth - 25, doc.internal.pageSize.getHeight() - 10);
        }
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=analizcim-analiz-${idValidation.value}.pdf`);
        res.send(Buffer.from(doc.output('arraybuffer')));
    } catch (error) {
        logger.error({ err: error }, 'PDF export analysis error:');
        res.status(500).json({ error: 'PDF dışa aktarımı sırasında hata oluştu.' });
    }
});

// API - Compare two years (özet + aylık detay)
app.get('/api/compare', async (req, res) => {
    try {
        // Validate year1
        const year1Validation = validateYear(req.query.year1);
        if (!year1Validation.valid) {
            return res.status(400).json({ error: year1Validation.error });
        }
        
        // Validate year2
        const year2Validation = validateYear(req.query.year2);
        if (!year2Validation.valid) {
            return res.status(400).json({ error: year2Validation.error });
        }
        
        const year1 = year1Validation.value;
        const year2 = year2Validation.value;
        
        const history = await storage.getHistory({ userId: req.session.userId, limit: 500 });
        const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const aggregate = (y) => {
            const list = history.filter(entry => {
                // Rapor dönemini dosya adından al (dashboard ile tutarlı)
                const parsed = storage.parseDateFromFilename(entry.salesFileName) || storage.parseDateFromFilename(entry.purchaseFileName);
                const entryYear = parsed ? parsed.year : new Date(entry.date).getFullYear();
                return entryYear === y;
            });
            let sales = 0, purchase = 0, salesTax = 0, purchaseTax = 0;
            const byMonth = {};
            for (let m = 1; m <= 12; m++) byMonth[m] = { sales: 0, purchase: 0, profit: 0, salesTax: 0, purchaseTax: 0 };
            list.forEach(entry => {
                // Ay bilgisini de dosya adından al
                const parsed = storage.parseDateFromFilename(entry.salesFileName) || storage.parseDateFromFilename(entry.purchaseFileName);
                const month = parsed ? parsed.month : (new Date(entry.date).getMonth() + 1);
                const s = entry.sales?.totalAmount || 0;
                const p = entry.purchase?.totalAmount || 0;
                const sTax = entry.sales?.totalTax || 0;
                const pTax = entry.purchase?.totalTax || 0;
                sales += s;
                purchase += p;
                salesTax += sTax;
                purchaseTax += pTax;
                byMonth[month].sales += s;
                byMonth[month].purchase += p;
                byMonth[month].profit += (s - p);
                byMonth[month].salesTax += sTax;
                byMonth[month].purchaseTax += pTax;
            });
            // salesTax/purchaseTax EKLEME alanlardır; mevcut sales/purchase/profit birebir aynı kaldı.
            const monthly = monthNames.map((name, i) => ({
                month: i + 1,
                monthName: name,
                sales: byMonth[i + 1].sales,
                purchase: byMonth[i + 1].purchase,
                profit: byMonth[i + 1].profit,
                salesTax: byMonth[i + 1].salesTax,
                purchaseTax: byMonth[i + 1].purchaseTax
            }));
            return {
                year: y,
                count: list.length,
                sales,
                purchase,
                salesTax,
                purchaseTax,
                profit: (sales - salesTax) - (purchase - purchaseTax),
                netTax: salesTax - purchaseTax,
                monthly
            };
        };
        const y1 = aggregate(year1);
        const y2 = aggregate(year2);

        // Giderleri expense_items tablosundan al (aktif gider takip sistemi)
        const userId = req.session?.userId || null;
        let totalExpensesY1 = 0, totalExpensesY2 = 0;
        if (userId) {
            const expY1 = await storage.getExpenseItemsTotalByYear(userId, year1);
            const expY2 = await storage.getExpenseItemsTotalByYear(userId, year2);
            totalExpensesY1 = expY1.total;
            totalExpensesY2 = expY2.total;
        }
        y1.expenses = totalExpensesY1;
        y2.expenses = totalExpensesY2;
        y1.net_profit = y1.profit - totalExpensesY1;
        y2.net_profit = y2.profit - totalExpensesY2;

        const salesGrowth = y1.sales ? ((y2.sales - y1.sales) / y1.sales * 100).toFixed(1) : null;
        const purchaseGrowth = y1.purchase ? ((y2.purchase - y1.purchase) / y1.purchase * 100).toFixed(1) : null;
        const profitGrowth = y1.profit !== 0 ? ((y2.profit - y1.profit) / Math.abs(y1.profit) * 100).toFixed(1) : null;
        const netProfitGrowth = (y1.net_profit !== 0) ? ((y2.net_profit - y1.net_profit) / Math.abs(y1.net_profit) * 100).toFixed(1) : null;

        // ORTAK AY KIYASI (2026-08-07): hesap `src/compare-metrics.js` içinde saf fonksiyondur
        // (veritabanı gerektirmez, birim testi ile kilitlidir). Ek alandır: mevcut
        // year1/year2/growth alanları birebir korunmuştur.
        res.json({
            success: true,
            year1: y1,
            year2: y2,
            growth: { sales: salesGrowth, purchase: purchaseGrowth, profit: profitGrowth, net_profit: netProfitGrowth },
            comparable: buildComparableSummary(y1, y2)
        });
    } catch (error) {
        logger.error({ err: error }, 'Compare error:');
        res.status(500).json({ error: 'Karşılaştırma yapılırken hata oluştu.' });
    }
});

// API - Dashboard latest
// Aylık seride tek bir ayın KDV hariç brüt kârı. KDV kırılımı yoksa tutarlar zaten net kabul edilir.
function buildVatExclusiveGrossProfit(monthly, index) {
    const sales = monthly.sales[index] || 0;
    const purchases = monthly.purchases[index] || 0;
    const salesVat = (monthly.salesVat && monthly.salesVat[index]) || 0;
    const purchasesVat = (monthly.purchasesVat && monthly.purchasesVat[index]) || 0;
    return (sales - salesVat) - (purchases - purchasesVat);
}

app.get('/api/dashboard/latest', async (req, res) => {
    const emptySummary = { total_sales: 0, total_purchases: 0, total_vat: 0, gross_profit: 0, total_expenses: 0, net_profit: 0 };
    const emptyResponse = { success: true, summary: emptySummary, monthly: { labels: [], sales: [], purchases: [], vat: [], salesVat: [], purchasesVat: [], expenses: [] }, deltas: [], trend: {} };

    try {
        if (!req.session?.userId) {
            return res.status(401).json({ error: 'auth_required', message: 'Oturum açmanız gerekiyor.' });
        }
        
        // Validate year if provided
        let selectedYear = null;
        if (req.query.year != null && req.query.year !== '') {
            const yearValidation = validateYear(req.query.year);
            if (!yearValidation.valid) {
                return res.status(400).json({ error: yearValidation.error });
            }
            selectedYear = yearValidation.value;
        }

        // --- step: fetch_history ---
        logger.debug("[dashboard] step=fetch_history");
        const userId = req.session.userId;
        let monthly = await storage.getMonthlyTotals(selectedYear || undefined, userId);

        if (!monthly || !Array.isArray(monthly.labels) || monthly.labels.length === 0) {
            return res.json(emptyResponse);
        }

        // Fill missing months so chart x-axis is continuous (no time jumps)
        monthly = storage.fillMissingMonths(monthly);

        // --- step: build_monthly ---
        logger.debug("[dashboard] step=build_monthly");

        if (!Array.isArray(monthly.sales)) monthly.sales = [];
        if (!Array.isArray(monthly.purchases)) monthly.purchases = [];
        if (!Array.isArray(monthly.vat)) monthly.vat = [];

        if (monthly.vat.length !== monthly.labels.length) {
            monthly.vat = monthly.labels.map(() => 0);
        }
        if (monthly.sales.length !== monthly.labels.length) {
            monthly.sales = monthly.labels.map((_, i) => monthly.sales[i] || 0);
        }
        if (monthly.purchases.length !== monthly.labels.length) {
            monthly.purchases = monthly.labels.map((_, i) => monthly.purchases[i] || 0);
        }

        const minLen = Math.min(monthly.labels.length, monthly.sales.length, monthly.purchases.length, monthly.vat.length);
        if (minLen < monthly.labels.length) {
            monthly.labels = monthly.labels.slice(0, minLen);
            monthly.sales = monthly.sales.slice(0, minLen);
            monthly.purchases = monthly.purchases.slice(0, minLen);
            monthly.vat = monthly.vat.slice(0, minLen);
        }

        // Build separate salesVat / purchasesVat from history entries
        // BORÇ (2026-08-07): `storage.getMonthlyTotals` artık aynı `salesVat`/`purchasesVat`
        // dizilerini kendisi döndürüyor; aşağıdaki blok onları ezip aynı hesabı ikinci kez yapıyor.
        // Sadeleştirme bilerek ertelendi: bu blok JSON gövdesini, storage ise önce `sales_tax`
        // kolonunu okuyor — eski kayıtlarda ikisi ayrışabilir, tek tabana çekmek ayrı bir
        // doğrulama turu ister. Ayrıca buradaki `limit: 1000` sessiz bir tavandır.
        const allHistory = await storage.getHistory({ userId: req.session.userId, limit: 1000, sort: 'date_asc', year: selectedYear || null });
        const salesVatByMonth = {};
        const purchVatByMonth = {};
        const combinedVatByMonth = {};

        for (const entry of allHistory) {
            // Rapor dönemini geçmişteki dosya adlarından al (dashboard ile tutarlı)
            const fromSales = storage.parseDateFromFilename(entry.salesFileName);
            const fromPurchase = storage.parseDateFromFilename(entry.purchaseFileName);
            const parsed = fromSales || fromPurchase;
            const key = parsed
                ? `${parsed.year}-${String(parsed.month).padStart(2, '0')}`
                : (() => { const d = new Date(entry.date); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 7); })();
            if (!key) continue;

            let sv = 0, pv = 0;

            const sTax = entry.sales?.totalTax || 0;
            const pTax = entry.purchase?.totalTax || 0;
            if (sTax > 0 || pTax > 0) {
                sv = sTax;
                pv = pTax;
            } else {
                // Fallback: try alternative keys in JSON blobs
                const salesObj = entry.sales || {};
                const purchaseObj = entry.purchase || {};
                const tryKeys = ['totalTax', 'total_tax', 'vat', 'Toplam KDV', 'vat_amount', 'total_vat'];
                for (const k of tryKeys) {
                    const svVal = parseFloat(salesObj[k]);
                    const pvVal = parseFloat(purchaseObj[k]);
                    if (Number.isFinite(svVal) && svVal > 0) sv = svVal;
                    if (Number.isFinite(pvVal) && pvVal > 0) pv = pvVal;
                    if (sv > 0 || pv > 0) break;
                }
            }

            salesVatByMonth[key] = (salesVatByMonth[key] || 0) + sv;
            purchVatByMonth[key] = (purchVatByMonth[key] || 0) + pv;
            combinedVatByMonth[key] = (combinedVatByMonth[key] || 0) + sv + pv;
        }

        // Populate monthly.salesVat and monthly.purchasesVat aligned with labels
        monthly.salesVat = monthly.labels.map(label => salesVatByMonth[label] || 0);
        monthly.purchasesVat = monthly.labels.map(label => purchVatByMonth[label] || 0);

        // Backfill combined vat if it was all zeros from getMonthlyTotals
        const vatSum = monthly.vat.reduce((a, b) => a + (b || 0), 0);
        if (vatSum === 0 && Object.keys(combinedVatByMonth).length > 0) {
            monthly.vat = monthly.labels.map(label => combinedVatByMonth[label] || 0);
        }

        const totalSales = monthly.sales.reduce((a, b) => a + (b || 0), 0);
        const totalPurchases = monthly.purchases.reduce((a, b) => a + (b || 0), 0);
        const totalVatFromMonthly = monthly.vat.reduce((a, b) => a + (b || 0), 0);

        // Brüt kâr KDV HARİÇ (CEO kararı 2026-07-07; Kâr/Zarar tablosu ve geçmiş özetleriyle aynı taban).
        // Seri olarak da döndürülür ki istemciler bunu ham tutarlardan türetmek zorunda kalmasın.
        monthly.grossProfit = monthly.labels.map((_, i) => buildVatExclusiveGrossProfit(monthly, i));
        const grossProfit = monthly.grossProfit.reduce((a, b) => a + (b || 0), 0);

        // Giderleri expense_items tablosundan al (aktif gider takip sistemi)
        let allExpenseByMonth = {};
        if (userId) {
            // Her yıl için ayrı sorgu yaparak tüm yıl-ay'ları topla
            const expenseYears = new Set();
            monthly.labels.forEach(label => {
                const yr = label.slice(0, 4);
                if (yr) expenseYears.add(yr);
            });
            for (const yr of expenseYears) {
                const expData = await storage.getExpenseItemsTotalByYear(userId, yr);
                Object.assign(allExpenseByMonth, expData.byMonth);
            }
        }
        monthly.expenses = monthly.labels.map(label => allExpenseByMonth[label] || 0);
        const totalExpenses = monthly.expenses.reduce((a, b) => a + (b || 0), 0);

        const summary = {
            total_sales: totalSales || 0,
            total_purchases: totalPurchases || 0,
            total_vat: totalVatFromMonthly || 0,
            gross_profit: grossProfit,
            total_expenses: totalExpenses || 0,
            net_profit: grossProfit - (totalExpenses || 0)
        };

        let deltas = [];
        const len = monthly.labels.length;
        if (len >= 2) {
            const prev = {
                total_sales: monthly.sales[len - 2] || 0,
                total_purchases: monthly.purchases[len - 2] || 0,
                total_vat: monthly.vat[len - 2] || 0,
                gross_profit: monthly.grossProfit[len - 2] || 0
            };
            const curr = {
                total_sales: monthly.sales[len - 1] || 0,
                total_purchases: monthly.purchases[len - 1] || 0,
                total_vat: monthly.vat[len - 1] || 0,
                gross_profit: monthly.grossProfit[len - 1] || 0
            };
            const fields = [
                { key: 'total_sales', label: 'Satış' },
                { key: 'total_purchases', label: 'Alış' },
                { key: 'gross_profit', label: 'Kâr' },
                { key: 'total_vat', label: 'KDV' }
            ];
            deltas = fields
                .map(f => {
                    const p = prev[f.key] || 0;
                    const c = curr[f.key] || 0;
                    const diff = c - p;
                    const pct = p !== 0 ? Math.round(((diff / Math.abs(p)) * 100) * 10) / 10 : (c !== 0 ? 100 : 0);
                    return { field: f.label, previous: p, current: c, diff, pct };
                })
                .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
                .slice(0, 3);
        }

        let trend = {};
        if (monthly.sales.length >= 2) {
            const series = monthly.sales;
            const n = series.length;
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            for (let i = 0; i < n; i++) {
                sumX += i;
                sumY += series[i];
                sumXY += i * series[i];
                sumXX += i * i;
            }
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const avg = sumY / n;
            const threshold = avg * 0.02;
            let direction = 'yatay';
            if (slope > threshold) direction = 'yükselen';
            else if (slope < -threshold) direction = 'düşen';
            trend = { direction, slope: Math.round(slope * 100) / 100 };
        }

        // --- step: build_response ---
        logger.debug("[dashboard] step=build_response");
        logger.debug({
            totalVat: summary?.total_vat,
            monthlyVatLength: monthly?.vat?.length,
            salesVatLength: monthly?.salesVat?.length,
            purchasesVatLength: monthly?.purchasesVat?.length
        }, "[dashboard] summary.total_vat=");

        res.json({ success: true, summary, monthly, deltas, trend });
    } catch (err) {
        logger.error({ err: err && err.stack ? err.stack : err }, "[dashboard] error:");
        logger.error({ sessionUser: req.session?.user || req.session?.userId || null }, "[dashboard] session user:");
        res.status(500).json({ error: "dashboard_failed" });
    }
});

app.get('/api/dashboard/range', async (req, res) => {
    const emptySummary = { total_sales: 0, total_purchases: 0, total_vat: 0, gross_profit: 0, total_expenses: 0, net_profit: 0 };
    const emptyResponse = { success: true, summary: emptySummary, monthly: { labels: [], sales: [], purchases: [], vat: [], salesVat: [], purchasesVat: [], expenses: [] }, deltas: [], trend: {} };

    try {
        if (!req.session?.userId) {
            return res.status(401).json({ error: 'auth_required', message: 'Oturum açmanız gerekiyor.' });
        }

        const ymRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
        const start = String(req.query.start || '');
        const end = String(req.query.end || '');

        if (!ymRegex.test(start) || !ymRegex.test(end)) {
            return res.status(400).json({ error: 'Geçersiz tarih aralığı. YYYY-MM formatı kullanın.' });
        }

        const startYearValidation = validateYear(start.slice(0, 4));
        const endYearValidation = validateYear(end.slice(0, 4));
        if (!startYearValidation.valid) {
            return res.status(400).json({ error: startYearValidation.error });
        }
        if (!endYearValidation.valid) {
            return res.status(400).json({ error: endYearValidation.error });
        }
        if (start > end) {
            return res.status(400).json({ error: 'Başlangıç tarihi bitiş tarihinden büyük olamaz.' });
        }

        logger.debug("[dashboard-range] step=fetch_history");
        const userId = req.session.userId;
        let monthly = await storage.getMonthlyTotalsInRange(userId, start, end);

        if (!monthly || !Array.isArray(monthly.labels) || monthly.labels.length === 0) {
            return res.json(emptyResponse);
        }

        monthly = storage.fillMissingMonths(monthly);

        logger.debug("[dashboard-range] step=build_monthly");

        if (!Array.isArray(monthly.sales)) monthly.sales = [];
        if (!Array.isArray(monthly.purchases)) monthly.purchases = [];
        if (!Array.isArray(monthly.vat)) monthly.vat = [];

        if (monthly.vat.length !== monthly.labels.length) {
            monthly.vat = monthly.labels.map(() => 0);
        }
        if (monthly.sales.length !== monthly.labels.length) {
            monthly.sales = monthly.labels.map((_, i) => monthly.sales[i] || 0);
        }
        if (monthly.purchases.length !== monthly.labels.length) {
            monthly.purchases = monthly.labels.map((_, i) => monthly.purchases[i] || 0);
        }

        const minLen = Math.min(monthly.labels.length, monthly.sales.length, monthly.purchases.length, monthly.vat.length);
        if (minLen < monthly.labels.length) {
            monthly.labels = monthly.labels.slice(0, minLen);
            monthly.sales = monthly.sales.slice(0, minLen);
            monthly.purchases = monthly.purchases.slice(0, minLen);
            monthly.vat = monthly.vat.slice(0, minLen);
        }

        // BORÇ (2026-08-07): `/api/dashboard/latest` içindeki KDV türetmesinin ikizi.
        // Gerekçe ve sadeleştirme koşulu için oradaki nota bakın.
        const allHistory = await storage.getHistory({ limit: 1000, sort: 'date_asc', year: null, userId });
        const salesVatByMonth = {};
        const purchVatByMonth = {};
        const combinedVatByMonth = {};

        for (const entry of allHistory) {
            const fromSales = storage.parseDateFromFilename(entry.salesFileName);
            const fromPurchase = storage.parseDateFromFilename(entry.purchaseFileName);
            const parsed = fromSales || fromPurchase;
            const key = parsed
                ? `${parsed.year}-${String(parsed.month).padStart(2, '0')}`
                : (() => { const d = new Date(entry.date); return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 7); })();
            if (!key || key < start || key > end) continue;

            let sv = 0, pv = 0;

            const sTax = entry.sales?.totalTax || 0;
            const pTax = entry.purchase?.totalTax || 0;
            if (sTax > 0 || pTax > 0) {
                sv = sTax;
                pv = pTax;
            } else {
                const salesObj = entry.sales || {};
                const purchaseObj = entry.purchase || {};
                const tryKeys = ['totalTax', 'total_tax', 'vat', 'Toplam KDV', 'vat_amount', 'total_vat'];
                for (const k of tryKeys) {
                    const svVal = parseFloat(salesObj[k]);
                    const pvVal = parseFloat(purchaseObj[k]);
                    if (Number.isFinite(svVal) && svVal > 0) sv = svVal;
                    if (Number.isFinite(pvVal) && pvVal > 0) pv = pvVal;
                    if (sv > 0 || pv > 0) break;
                }
            }

            salesVatByMonth[key] = (salesVatByMonth[key] || 0) + sv;
            purchVatByMonth[key] = (purchVatByMonth[key] || 0) + pv;
            combinedVatByMonth[key] = (combinedVatByMonth[key] || 0) + sv + pv;
        }

        monthly.salesVat = monthly.labels.map(label => salesVatByMonth[label] || 0);
        monthly.purchasesVat = monthly.labels.map(label => purchVatByMonth[label] || 0);

        const vatSum = monthly.vat.reduce((a, b) => a + (b || 0), 0);
        if (vatSum === 0 && Object.keys(combinedVatByMonth).length > 0) {
            monthly.vat = monthly.labels.map(label => combinedVatByMonth[label] || 0);
        }

        const totalSales = monthly.sales.reduce((a, b) => a + (b || 0), 0);
        const totalPurchases = monthly.purchases.reduce((a, b) => a + (b || 0), 0);
        const totalVatFromMonthly = monthly.vat.reduce((a, b) => a + (b || 0), 0);

        // Brüt kâr KDV HARİÇ (CEO kararı 2026-07-07; Kâr/Zarar tablosu ve geçmiş özetleriyle aynı taban).
        // Seri olarak da döndürülür ki istemciler bunu ham tutarlardan türetmek zorunda kalmasın.
        monthly.grossProfit = monthly.labels.map((_, i) => buildVatExclusiveGrossProfit(monthly, i));
        const grossProfit = monthly.grossProfit.reduce((a, b) => a + (b || 0), 0);

        let allExpenseByMonth = {};
        if (userId) {
            const startYear = parseInt(start.slice(0, 4), 10);
            const endYear = parseInt(end.slice(0, 4), 10);
            for (let yr = startYear; yr <= endYear; yr++) {
                const expData = await storage.getExpenseItemsTotalByYear(userId, String(yr));
                Object.assign(allExpenseByMonth, expData.byMonth);
            }
        }
        monthly.expenses = monthly.labels.map(label => allExpenseByMonth[label] || 0);
        const totalExpenses = monthly.expenses.reduce((a, b) => a + (b || 0), 0);

        const summary = {
            total_sales: totalSales || 0,
            total_purchases: totalPurchases || 0,
            total_vat: totalVatFromMonthly || 0,
            gross_profit: grossProfit,
            total_expenses: totalExpenses || 0,
            net_profit: grossProfit - (totalExpenses || 0)
        };

        let deltas = [];
        const len = monthly.labels.length;
        if (len >= 2) {
            const prev = {
                total_sales: monthly.sales[len - 2] || 0,
                total_purchases: monthly.purchases[len - 2] || 0,
                total_vat: monthly.vat[len - 2] || 0,
                gross_profit: monthly.grossProfit[len - 2] || 0
            };
            const curr = {
                total_sales: monthly.sales[len - 1] || 0,
                total_purchases: monthly.purchases[len - 1] || 0,
                total_vat: monthly.vat[len - 1] || 0,
                gross_profit: monthly.grossProfit[len - 1] || 0
            };
            const fields = [
                { key: 'total_sales', label: 'Satış' },
                { key: 'total_purchases', label: 'Alış' },
                { key: 'gross_profit', label: 'Kâr' },
                { key: 'total_vat', label: 'KDV' }
            ];
            deltas = fields
                .map(f => {
                    const p = prev[f.key] || 0;
                    const c = curr[f.key] || 0;
                    const diff = c - p;
                    const pct = p !== 0 ? Math.round(((diff / Math.abs(p)) * 100) * 10) / 10 : (c !== 0 ? 100 : 0);
                    return { field: f.label, previous: p, current: c, diff, pct };
                })
                .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
                .slice(0, 3);
        }

        let trend = {};
        if (monthly.sales.length >= 2) {
            const series = monthly.sales;
            const n = series.length;
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            for (let i = 0; i < n; i++) {
                sumX += i;
                sumY += series[i];
                sumXY += i * series[i];
                sumXX += i * i;
            }
            const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
            const avg = sumY / n;
            const threshold = avg * 0.02;
            let direction = 'yatay';
            if (slope > threshold) direction = 'yükselen';
            else if (slope < -threshold) direction = 'düşen';
            trend = { direction, slope: Math.round(slope * 100) / 100 };
        }

        logger.debug("[dashboard-range] step=build_response");
        logger.debug({
            totalVat: summary?.total_vat,
            monthlyVatLength: monthly?.vat?.length,
            salesVatLength: monthly?.salesVat?.length,
            purchasesVatLength: monthly?.purchasesVat?.length
        }, "[dashboard-range] summary.total_vat=");

        res.json({ success: true, summary, monthly, deltas, trend });
    } catch (err) {
        logger.error({ err: err && err.stack ? err.stack : err }, "[dashboard-range] error:");
        logger.error({ sessionUser: req.session?.user || req.session?.userId || null }, "[dashboard-range] session user:");
        res.status(500).json({ error: "dashboard_range_failed" });
    }
});

// Error handling middleware
app.use((error, req, res, _next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'Dosya boyutu 10MB\'dan büyük olamaz.' });
        }
    }
    // İç hata detayı yalnızca sunucu loguna; kullanıcıya genel mesaj (bilgi sızıntısını önle)
    logger.error({ err: error && error.stack ? error.stack : error }, '[error-middleware] Beklenmeyen hata:');
    res.status(500).json({ error: 'Sunucu hatası oluştu. Lütfen tekrar deneyin.' });
});

// API - Top N Customers (en çok satış yapılan firmalar)
// GET /api/analysis/top-customers?year=2024&type=sales&limit=10
app.get('/api/analysis/top-customers', async (req, res) => {
    try {
        if (!req.session?.userId) {
            return res.status(401).json({ error: 'auth_required', message: 'Oturum açmanız gerekiyor.' });
        }

        // Validate year
        let year = null;
        if (req.query.year != null && req.query.year !== '') {
            const yearValidation = validateYear(req.query.year);
            if (!yearValidation.valid) {
                return res.status(400).json({ error: yearValidation.error });
            }
            year = yearValidation.value;
        }

        // Validate type (sales or purchase)
        const type = req.query.type || 'sales';
        if (type !== 'sales' && type !== 'purchase') {
            return res.status(400).json({ error: 'type parametresi "sales" veya "purchase" olmalıdır.' });
        }

        // Validate limit
        let limit = 10;
        if (req.query.limit != null && req.query.limit !== '') {
            const limitNum = parseInt(req.query.limit, 10);
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
                return res.status(400).json({ error: 'limit 1-100 arasında olmalıdır.' });
            }
            limit = limitNum;
        }

        // Ay filtresi (opsiyonel): 1-12 veya 'all'
        let month = null;
        if (req.query.month != null && req.query.month !== '' && req.query.month !== 'all') {
            const monthValidation = validateMonth(req.query.month);
            if (!monthValidation.valid) {
                return res.status(400).json({ error: monthValidation.error });
            }
            month = monthValidation.value;
        }

        const userId = req.session.userId;
        const topCustomers = await storage.getTopCustomers(userId, year, type, limit, month);

        res.json({
            success: true,
            type,
            year: year || 'all',
            month: month || 'all',
            limit,
            total: topCustomers.length,
            data: topCustomers
        });
    } catch (error) {
        logger.error({ err: error }, 'Top customers error:');
        res.status(500).json({ error: 'En çok satış yapılan firmalar hesaplanırken hata oluştu.' });
    }
});

// API - Top N Products (en çok satılan ürünler/kalemler)
// GET /api/analysis/top-products?year=2024&type=sales&limit=10
app.get('/api/analysis/top-products', async (req, res) => {
    try {
        if (!req.session?.userId) {
            return res.status(401).json({ error: 'auth_required', message: 'Oturum açmanız gerekiyor.' });
        }

        // Validate year
        let year = null;
        if (req.query.year != null && req.query.year !== '') {
            const yearValidation = validateYear(req.query.year);
            if (!yearValidation.valid) {
                return res.status(400).json({ error: yearValidation.error });
            }
            year = yearValidation.value;
        }

        // Validate type (sales or purchase)
        const type = req.query.type || 'sales';
        if (type !== 'sales' && type !== 'purchase') {
            return res.status(400).json({ error: 'type parametresi "sales" veya "purchase" olmalıdır.' });
        }

        // Validate limit
        let limit = 10;
        if (req.query.limit != null && req.query.limit !== '') {
            const limitNum = parseInt(req.query.limit, 10);
            if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
                return res.status(400).json({ error: 'limit 1-100 arasında olmalıdır.' });
            }
            limit = limitNum;
        }

        const userId = req.session.userId;
        // Ay filtresi (opsiyonel)
        let month = null;
        if (req.query.month != null && req.query.month !== '' && req.query.month !== 'all') {
            const monthValidation = validateMonth(req.query.month);
            if (!monthValidation.valid) {
                return res.status(400).json({ error: monthValidation.error });
            }
            month = monthValidation.value;
        }

        const topProducts = await storage.getTopProducts(userId, year, type, limit, month);

        res.json({
            success: true,
            type,
            year: year || 'all',
            month: month || 'all',
            limit,
            total: topProducts.length,
            data: topProducts
        });
    } catch (error) {
        logger.error({ err: error }, 'Top products error:');
        res.status(500).json({ error: 'En çok satılan ürünler hesaplanırken hata oluştu.' });
    }
});

// GET /api/analysis/profit-loss?year=2024 - Detailed monthly profit/loss breakdown
app.get('/api/analysis/profit-loss', async (req, res) => {
    try {
        if (!req.session?.userId) {
            return res.status(401).json({ error: 'auth_required', message: 'Oturum açmanız gerekiyor.' });
        }

        // Validate year
        let year = new Date().getFullYear(); // Default to current year
        if (req.query.year != null && req.query.year !== '') {
            const yearValidation = validateYear(req.query.year);
            if (!yearValidation.valid) {
                return res.status(400).json({ error: yearValidation.error });
            }
            year = yearValidation.value;
        }

        const userId = req.session.userId;
        const profitLossData = await storage.getMonthlyProfitLoss(userId, year);

        res.json(profitLossData);
    } catch (error) {
        logger.error({ err: error }, 'Profit/Loss error:');
        res.status(500).json({ error: 'Kâr/Zarar hesaplanırken hata oluştu.' });
    }
});

// API - Get available years
app.get('/api/years', async (req, res) => {
    try {
        if (!req.session?.userId) {
            return res.status(401).json({ error: 'auth_required', message: 'Oturum açmanız gerekiyor.' });
        }

        const userId = req.session.userId;
        const years = await storage.getAvailableYears(userId);

        res.json({
            success: true,
            years
        });
    } catch (error) {
        logger.error({ err: error }, 'Years error:');
        res.status(500).json({ error: 'Yıl listesi alınırken hata oluştu.' });
    }
});

function startServer(port = PORT) {
    const server = app.listen(port, () => {
        logger.info(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   Analizcim - Excel Analiz Uygulaması                ║
║                                                       ║
║   Sunucu çalışıyor: http://localhost:${port}            ║
║                                                       ║
║   Tarayıcınızda yukarıdaki adresi açın.              ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
    });

    // Otomatik yedekleme zamanlayıcısını başlat (test ortamında değil)
    if (!isTestEnv) {
        try {
            backupManager.startAutoBackupScheduler();
        } catch (err) {
            logger.error({ err }, '[server] Otomatik yedekleme başlatılamadı:');
        }
    }

    return server;
}

if (require.main === module) {
    startServer(PORT);
}

module.exports = { app, startServer };
