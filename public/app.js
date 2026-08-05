// ========================================
// DOM Elements
// ========================================
const salesFileInput = document.getElementById('salesFile');
const purchaseFileInput = document.getElementById('purchaseFile');
const salesUpload = document.getElementById('salesUpload');
const purchaseUpload = document.getElementById('purchaseUpload');
const salesFileName = document.getElementById('salesFileName');
const purchaseFileName = document.getElementById('purchaseFileName');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultsSection = document.getElementById('resultsSection');
const loadingOverlay = document.getElementById('loadingOverlay');
const errorToast = document.getElementById('errorToast');
const errorMessage = document.getElementById('errorMessage');
const resetBtn = document.getElementById('resetBtn');
const columnMapBtn = document.getElementById('columnMapBtn');
const columnMapStatus = document.getElementById('columnMapStatus');
const exportSummaryPdfBtn = document.getElementById('exportSummaryPdfBtn');
const requestJSON = window.AnalizcimApi?.requestJSON;
const notify = window.AnalizcimNotify;
const historyApi = window.AnalizcimHistoryApi;

// Navigation Elements
const tabDashboard = document.getElementById('tabDashboard');
const tabAnalyze = document.getElementById('tabAnalyze');
const tabHistory = document.getElementById('tabHistory');
const dashboardSection = document.getElementById('dashboardSection');
const historySection = document.getElementById('historySection');
const expensesSection = document.getElementById('expensesSection');
const customersSection = document.getElementById('customersSection');
const suppliersSection = document.getElementById('suppliersSection');
const partyDetailSection = document.getElementById('partyDetailSection');
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const historyCount = document.getElementById('historyCount');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarToggleBtn = document.getElementById('sidebarToggle');
const sidebarCollapseBtn = document.getElementById('sidebarCollapseBtn');
const sidebarUserEl = document.getElementById('sidebarUser');
const sidebarAccountTrigger = document.getElementById('sidebarAccountTrigger');
const sidebarAccountMenu = document.getElementById('sidebarAccountMenu');
const sidebarSwitchAccountAction = document.getElementById('sidebarSwitchAccountAction');
const sidebarLogoutAction = document.getElementById('sidebarLogoutAction');
let themeSwitchCleanupTimer = null;

// State
let salesFile = null;
let purchaseFile = null;
let _mergeMode = false;
let mergeSalesFiles = [];
let mergePurchaseFiles = [];
let currentTab = 'dashboard';
let _dashboardMonthlyAll = [];
let _dashboardSummaryAll = null;
let _dashboardHasSeparateVat = false;
/** Son eklenen analizler listesindeki satır verileri (tıklanınca detay modalında kullanılır) */
let _dashboardRecentListData = [];
let _historyMonthSummaryData = {};
let _historyPage = 1;
let _historyPageSize = 50;
let _historyTotal = 0;
let _expensesPieChartInstance = null;
let _dashboardProfitLossData = null;
let _customers = [];
let _customerSearchTimer = null;
let _businessPartySearchTimer = null;
let _currentPartyListType = 'customer';
let _currentPartyDetailType = 'customer';
let _partyMonthlyChartInstance = null;
let _partyTrendChartInstance = null;
const THEME_PREFERENCE_KEY = 'theme';
const DEFAULT_COLUMN_MAP = {
    sales: { date: 'A', counterparty: 'C', net: 'I', vat: 'K', gross: 'L' },
    purchase: { date: 'A', counterparty: 'B', net: 'H', vat: 'J', gross: 'K' }
};
let columnMapConfig = {
    enabled: false,
    sales: { ...DEFAULT_COLUMN_MAP.sales },
    purchase: { ...DEFAULT_COLUMN_MAP.purchase }
};

function calculateMovingAverage(data, period = 3) {
    if (!Array.isArray(data)) return [];
    return data.map((_, i) => {
        if (i < period - 1) return null;
        const slice = data.slice(i - period + 1, i + 1);
        const sum = slice.reduce((a, b) => a + (b || 0), 0);
        return Math.round(sum / period);
    });
}

// ========================================
// Initialization
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    await setupTheme();
    setupSidebarShell();
    loadChartTypePreference();
    setupDropZones();
    setupFileInputs();
    setupButtons();
    setupColumnMapWizard();
    setupMergeMode();
    setupNavigation();
    setupCustomerControls();
    setupBusinessPartyControls();
    setupHistoryFilters();
    setupKeyboardShortcuts();
    setupNumericValueColoring();
    loadHistoryCount();
    loadTrashCount();
    updateSidebarUser();
    switchTab(currentTab);
});

function setSidebarOpen(isOpen) {
    if (!sidebar || !sidebarOverlay) return;
    sidebar.classList.toggle('open', isOpen);
    sidebarOverlay.classList.toggle('visible', isOpen);
    document.body.classList.toggle('sidebar-open', isOpen);

    const toggleLabel = isOpen ? 'Menüyü kapat' : 'Menüyü aç';
    sidebarToggleBtn?.setAttribute('aria-label', toggleLabel);
    sidebarToggleBtn?.setAttribute('title', toggleLabel);
    sidebarCollapseBtn?.setAttribute('aria-label', toggleLabel);
    sidebarCollapseBtn?.setAttribute('title', toggleLabel);

    if (!isOpen) {
        closeSidebarAccountMenu();
    }
}

function closeSidebarPanel() {
    setSidebarOpen(false);
}

function closeMobileSidebar() {
    if (!sidebar?.classList.contains('open')) return;
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    setSidebarOpen(false);
}

window.closeMobileSidebar = closeMobileSidebar;

window.toggleSidebar = function toggleSidebar() {
    if (!sidebar || !sidebarOverlay) return;
    setSidebarOpen(!sidebar.classList.contains('open'));
};

function setupSidebarShell() {
    document.body.classList.remove('sidebar-collapsed');
    setSidebarOpen(false);

    sidebarToggleBtn?.addEventListener('click', window.toggleSidebar);
    sidebarCollapseBtn?.addEventListener('click', window.toggleSidebar);
    sidebarOverlay?.addEventListener('click', closeSidebarPanel);
    sidebarAccountTrigger?.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = sidebarAccountMenu?.classList.toggle('open');
        sidebarAccountTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    sidebarSwitchAccountAction?.addEventListener('click', () => {
        closeSidebarAccountMenu();
        window.location.href = '/login.html';
    });
    sidebarLogoutAction?.addEventListener('click', () => {
        closeSidebarAccountMenu();
        window.logout();
    });
    document.addEventListener('click', (event) => {
        if (!sidebarAccountMenu?.classList.contains('open')) return;
        if (sidebarAccountTrigger?.contains(event.target) || sidebarAccountMenu?.contains(event.target)) return;
        closeSidebarAccountMenu();
    });
    window.addEventListener('resize', () => {
        closeSidebarPanel();
        document.body.classList.remove('sidebar-collapsed');
        closeSidebarAccountMenu();
    });
}

function closeSidebarAccountMenu() {
    sidebarAccountMenu?.classList.remove('open');
    sidebarAccountTrigger?.setAttribute('aria-expanded', 'false');
}

function updateSidebarUser() {
    if (!sidebarUserEl) return;
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (!user.username) {
            sidebarUserEl.innerHTML = '';
            return;
        }
        const role = user.is_admin ? 'Yönetici' : 'Kullanıcı';
        sidebarUserEl.innerHTML =
            '<span class="sidebar-user-avatar">' + user.username.charAt(0).toUpperCase() + '</span>' +
            '<span class="sidebar-user-copy">' +
                '<strong class="sidebar-user-name">' + escapeHtml(user.username) + '</strong>' +
                '<span class="sidebar-user-role">' + role + '</span>' +
            '</span>';
        sidebarUserEl.setAttribute('title', user.username + ' - ' + role);
        sidebarAccountTrigger?.setAttribute('title', user.username + ' - ' + role);
    } catch (_) {
        sidebarUserEl.innerHTML = '';
    }
}

function syncSidebarTheme(effectiveTheme) {
    sidebar?.setAttribute('data-theme', effectiveTheme);
    sidebarOverlay?.setAttribute('data-theme', effectiveTheme);
    sidebarAccountMenu?.setAttribute('data-theme', effectiveTheme);
}

// Klavye kısayolları
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd tuşu ile birlikte basılan tuşlar
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 's':
                    e.preventDefault();
                    // Tahmin sıralamasını kaydet
                    if (document.getElementById('predictionsGrid')) {
                        savePredictionOrder();
                    }
                    break;
                case 'n':
                    e.preventDefault();
                    // Yeni analiz - dosyaları temizle ve analiz sekmesine git
                    resetFileInputs();
                    switchTab('analyze');
                    break;
                case 'h':
                    e.preventDefault();
                    // Geçmiş sekmesine git
                    switchTab('history');
                    break;
                case 'd':
                    e.preventDefault();
                    // Dashboard sekmesine git
                    switchTab('dashboard');
                    break;
                case 'e':
                    e.preventDefault();
                    // PDF dışa aktar
                    if (document.getElementById('exportSummaryPdfBtn')) {
                        exportSummaryPdf();
                    }
                    break;
                case '1':
                    e.preventDefault();
                    switchTab('dashboard');
                    break;
                case '2':
                    e.preventDefault();
                    switchTab('analyze');
                    break;
                case '3':
                    e.preventDefault();
                    switchTab('history');
                    break;
            }
            return;
        }
        
        // Escape ile modal kapatma
        if (e.key === 'Escape') {
            const pwModal = document.getElementById('passwordModal');
            const detailModal = document.getElementById('analysisDetailModal');
            const mapModal = document.getElementById('columnMapModal');
            if (mapModal && mapModal.style.display === 'flex') closeColumnMapModal();
            else if (detailModal && detailModal.style.display === 'flex') closeAnalysisDetailModal();
            else if (pwModal && pwModal.style.display === 'flex') closePasswordModal();
            else if (sidebarAccountMenu && sidebarAccountMenu.classList.contains('open')) closeSidebarAccountMenu();
            else if (sidebar && sidebar.classList.contains('open')) closeSidebarPanel();
        }
    });
}

// ========================================
// Authentication
// ========================================
async function checkAuth() {
    try {
        // Simple check by trying to fetch history (protected route)
        const { response } = await requestJSON('/api/history');
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        
        // Admin kontrolü - kullanıcı bilgisini localStorage'dan al
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user.is_admin) {
                document.body.classList.add('admin-user');
            }
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

window.logout = async function () {
    try {
        await requestJSON('/api/logout', { method: 'POST' });
    } catch (error) {
        console.error('Logout failed:', error);
    } finally {
        // Kullanıcı bilgisini localStorage'dan temizle
        localStorage.removeItem('user');
        // Admin sınıfını kaldır
        document.body.classList.remove('admin-user');
        window.location.href = '/login.html';
    }
};

// ========================================
// Theme Setup (DB-backed with localStorage migration)
// ========================================
async function setupTheme() {
    let themePreference = null;
    const fromLocal = localStorage.getItem(THEME_PREFERENCE_KEY);

    if (fromLocal) {
        themePreference = fromLocal;
        try {
            await requestJSON('/api/user/preferences/migrate', {
                method: 'POST',
                json: { theme: fromLocal }
            });
        } catch (_) { }
    }

    if (!themePreference) {
        try {
            const { response, data } = await requestJSON('/api/user/preferences?keys=theme');
            if (response.ok && data.success && data.preferences && data.preferences.theme) {
                themePreference = data.preferences.theme;
            }
        } catch (_) { }
    }

    applyThemePreference(themePreference || 'system');
    setupThemePreferenceControls();

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if ((localStorage.getItem(THEME_PREFERENCE_KEY) || 'system') === 'system') {
            applyThemePreference('system');
        }
    });
}

// --- Chart Type Selection ---
const CHART_TYPE_KEY = 'chartType';
let currentChartType = localStorage.getItem(CHART_TYPE_KEY) || 'line';

function setupChartTypeSelector() {
    const selector = document.getElementById('chartTypeSelector');
    if (!selector) return;

    const buttons = selector.querySelectorAll('.chart-type-btn');
    
    // Set initial active state
    buttons.forEach(btn => {
        if (btn.dataset.type === currentChartType) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
        
        btn.addEventListener('click', () => {
            const newType = btn.dataset.type;
            if (newType === currentChartType) return;
            
            currentChartType = newType;
            localStorage.setItem(CHART_TYPE_KEY, newType);
            
            // Update button states
            buttons.forEach(b => {
                b.classList.toggle('active', b.dataset.type === newType);
            });
            
            // Save to server
            fetch('/api/user/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chartType: newType })
            }).catch(() => {});
            
            // Re-render chart if data exists
            if (_dashboardMonthlyAll && _dashboardMonthlyAll.length > 0) {
                const yearSelect = document.getElementById('yearSelect');
                const selectedYear = yearSelect?.value || '';
                renderDashboardForYear(selectedYear);
            }
        });
    });
}

async function loadChartTypePreference() {
    try {
        const response = await fetch('/api/user/preferences?keys=chartType');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.preferences && data.preferences.chartType) {
                currentChartType = data.preferences.chartType;
                localStorage.setItem(CHART_TYPE_KEY, currentChartType);
            }
        }
    } catch (_) {}
    
    // Update selector UI
    setupChartTypeSelector();
}

function resolveEffectiveTheme(themePreference) {
    if (themePreference === 'light' || themePreference === 'dark') return themePreference;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemePreference(themePreference) {
    const normalized = themePreference === 'light' || themePreference === 'dark' || themePreference === 'system'
        ? themePreference
        : 'system';
    const effectiveTheme = resolveEffectiveTheme(normalized);
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.setAttribute('data-theme-preference', normalized);
    document.body.classList.add('theme-switching');
    syncSidebarTheme(effectiveTheme);
    if (themeSwitchCleanupTimer) {
        window.clearTimeout(themeSwitchCleanupTimer);
    }
    themeSwitchCleanupTimer = window.setTimeout(() => {
        document.body.classList.remove('theme-switching');
        themeSwitchCleanupTimer = null;
    }, 80);
    localStorage.setItem(THEME_PREFERENCE_KEY, normalized);
    syncThemePreferenceControls(normalized, effectiveTheme);
}

async function persistThemePreference(themePreference) {
    try {
        await fetch('/api/user/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ theme: themePreference })
        });
    } catch (_) { }
}

async function setThemePreference(themePreference) {
    applyThemePreference(themePreference);
    await persistThemePreference(themePreference);
}

function syncThemePreferenceControls(themePreference, effectiveTheme) {
    const control = document.getElementById('themePreferenceControl');
    if (!control) return;
    control.querySelectorAll('.theme-choice-btn').forEach((button) => {
        const isActive = button.dataset.themeChoice === themePreference;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    const sourceEl = document.getElementById('settingsThemeSource');
    if (sourceEl) {
        sourceEl.textContent = themePreference === 'system'
            ? 'Sistem (' + (effectiveTheme === 'dark' ? 'Koyu' : 'Açık') + ')'
            : (themePreference === 'dark' ? 'Koyu' : 'Açık');
    }
}

function setupThemePreferenceControls() {
    const control = document.getElementById('themePreferenceControl');
    if (!control || control.dataset.bound === 'true') return;
    control.dataset.bound = 'true';
    control.querySelectorAll('.theme-choice-btn').forEach((button) => {
        button.addEventListener('click', () => {
            setThemePreference(button.dataset.themeChoice || 'system');
        });
    });
    const currentPreference = localStorage.getItem(THEME_PREFERENCE_KEY) || document.documentElement.getAttribute('data-theme-preference') || 'system';
    syncThemePreferenceControls(currentPreference, document.documentElement.getAttribute('data-theme') || resolveEffectiveTheme(currentPreference));
}

// ========================================
// Drop Zone Setup
// ========================================
function setupDropZones() {
    const dropzones = document.querySelectorAll('.upload-dropzone');

    dropzones.forEach(dropzone => {
        // Click to select file
        dropzone.addEventListener('click', () => {
            const type = dropzone.dataset.type;
            if (type === 'sales') {
                salesFileInput.click();
            } else {
                purchaseFileInput.click();
            }
        });

        // Drag events
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });

        dropzone.addEventListener('dragleave', () => {
            dropzone.classList.remove('dragover');
        });

        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const type = dropzone.dataset.type;
                handleFile(files[0], type);
            }
        });
    });
}

// ========================================
// File Input Setup
// ========================================
function setupFileInputs() {
    salesFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0], 'sales');
        }
    });

    purchaseFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0], 'purchase');
        }
    });
}

// ========================================
// Button Setup
// ========================================
function setupButtons() {
    analyzeBtn.addEventListener('click', analyzeFiles);
    resetBtn.addEventListener('click', resetApp);
    if (columnMapBtn) columnMapBtn.addEventListener('click', openColumnMapModal);
    if (exportSummaryPdfBtn) exportSummaryPdfBtn.addEventListener('click', exportSummaryPdf);
}

function setupColumnMapWizard() {
    const modal = document.getElementById('columnMapModal');
    const cancelBtn = document.getElementById('columnMapCancelBtn');
    const saveBtn = document.getElementById('columnMapSaveBtn');
    const resetBtn = document.getElementById('columnMapResetBtn');
    const enabledCheckbox = document.getElementById('mapEnabledCheckbox');

    loadColumnMapConfig();
    updateColumnMapStatus();

    if (!modal) return;

    if (cancelBtn) cancelBtn.addEventListener('click', closeColumnMapModal);
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const collected = collectColumnMapFromModal();
            if (!collected) return;
            columnMapConfig = collected;
            persistColumnMapConfig();
            updateColumnMapStatus();
            closeColumnMapModal();
            showSuccessToast('Sütun eşleme ayarları kaydedildi.');
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            const useCustom = enabledCheckbox ? !!enabledCheckbox.checked : false;
            setModalColumnMapValues({
                enabled: useCustom,
                sales: { ...DEFAULT_COLUMN_MAP.sales },
                purchase: { ...DEFAULT_COLUMN_MAP.purchase }
            });
        });
    }
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeColumnMapModal();
    });
}

function loadColumnMapConfig() {
    try {
        const raw = localStorage.getItem('column_map_config_v1');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return;
        const normalized = normalizeColumnMapConfig(parsed);
        columnMapConfig = normalized;
    } catch (_) {
        columnMapConfig = {
            enabled: false,
            sales: { ...DEFAULT_COLUMN_MAP.sales },
            purchase: { ...DEFAULT_COLUMN_MAP.purchase }
        };
    }
}

function persistColumnMapConfig() {
    localStorage.setItem('column_map_config_v1', JSON.stringify(columnMapConfig));
}

function normalizeColumnMapConfig(config) {
    const out = {
        enabled: !!config.enabled,
        sales: { ...DEFAULT_COLUMN_MAP.sales },
        purchase: { ...DEFAULT_COLUMN_MAP.purchase }
    };
    const fields = ['date', 'counterparty', 'net', 'vat', 'gross'];
    for (const field of fields) {
        const s = config?.sales?.[field];
        const p = config?.purchase?.[field];
        if (typeof s === 'string' && /^[a-z]$/i.test(s.trim())) out.sales[field] = s.trim().toUpperCase();
        if (typeof p === 'string' && /^[a-z]$/i.test(p.trim())) out.purchase[field] = p.trim().toUpperCase();
    }
    return out;
}

function updateColumnMapStatus() {
    if (!columnMapStatus) return;
    if (columnMapConfig.enabled) {
        columnMapStatus.textContent = 'Özel sütun eşleme aktif';
        columnMapStatus.classList.add('active');
    } else {
        columnMapStatus.textContent = 'Varsayılan eşleme aktif';
        columnMapStatus.classList.remove('active');
    }
}

function setModalColumnMapValues(config) {
    const map = normalizeColumnMapConfig(config);
    const enabledCheckbox = document.getElementById('mapEnabledCheckbox');
    if (enabledCheckbox) enabledCheckbox.checked = !!map.enabled;
    const fields = ['date', 'counterparty', 'net', 'vat', 'gross'];
    for (const field of fields) {
        const salesInput = document.getElementById(`mapSales${capitalize(field)}`);
        const purchaseInput = document.getElementById(`mapPurchase${capitalize(field)}`);
        if (salesInput) salesInput.value = map.sales[field] || '';
        if (purchaseInput) purchaseInput.value = map.purchase[field] || '';
    }
}

function collectColumnMapFromModal() {
    const enabledCheckbox = document.getElementById('mapEnabledCheckbox');
    const fields = ['date', 'counterparty', 'net', 'vat', 'gross'];
    const out = {
        enabled: enabledCheckbox ? !!enabledCheckbox.checked : false,
        sales: {},
        purchase: {}
    };

    for (const field of fields) {
        const salesInput = document.getElementById(`mapSales${capitalize(field)}`);
        const purchaseInput = document.getElementById(`mapPurchase${capitalize(field)}`);
        const salesVal = (salesInput ? salesInput.value : '').trim().toUpperCase();
        const purchaseVal = (purchaseInput ? purchaseInput.value : '').trim().toUpperCase();
        if (!/^[A-Z]$/.test(salesVal) || !/^[A-Z]$/.test(purchaseVal)) {
            showError('Sütun eşlemede tüm alanlar A-Z arası tek harf olmalıdır.');
            return null;
        }
        out.sales[field] = salesVal;
        out.purchase[field] = purchaseVal;
    }

    return out;
}

function openColumnMapModal() {
    const modal = document.getElementById('columnMapModal');
    if (!modal) return;
    setModalColumnMapValues(columnMapConfig);
    modal.style.display = 'flex';
}

function closeColumnMapModal() {
    const modal = document.getElementById('columnMapModal');
    if (modal) modal.style.display = 'none';
}

function capitalize(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatFileSize(bytes) {
    const size = Number(bytes) || 0;
    if (size < 1024) return size + ' B';
    if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
    return (size / (1024 * 1024)).toFixed(1) + ' MB';
}

function updateSelectedFileSummary(type, file, isCsv) {
    const summaryEl = document.getElementById(type === 'sales' ? 'salesFileSummary' : 'purchaseFileSummary');
    if (!summaryEl) return;

    if (!file) {
        summaryEl.textContent = type === 'sales' ? 'Satış dosyası bekleniyor' : 'Alış dosyası bekleniyor';
        summaryEl.classList.remove('ready');
        return;
    }

    const fileKind = isCsv ? 'CSV' : 'Excel';
    summaryEl.textContent = fileKind + ' hazır · ' + formatFileSize(file.size);
    summaryEl.classList.add('ready');
}

function resetSelectedFileSummaries() {
    updateSelectedFileSummary('sales', null, false);
    updateSelectedFileSummary('purchase', null, false);
}

// ========================================
// File Handling
// ========================================
function handleFile(file, type) {
    // Validate file type - support Excel and CSV
    const validExcelTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
    ];
    const validCsvTypes = ['text/csv', 'text/plain', 'application/csv'];
    
    const ext = file.name.split('.').pop().toLowerCase();
    const isExcel = validExcelTypes.includes(file.type) || ['xlsx', 'xls'].includes(ext);
    const isCsv = validCsvTypes.includes(file.type) || ext === 'csv';
    
    if (!isExcel && !isCsv) {
        showError('Lütfen geçerli bir Excel (.xlsx, .xls) veya CSV dosyası seçin.');
        return;
    }

    if (type === 'sales') {
        salesFile = file;
        salesFileName.textContent = file.name + (isCsv ? ' (CSV)' : '');
        updateSelectedFileSummary('sales', file, isCsv);
        salesUpload.querySelector('.upload-card') || salesUpload;
        salesUpload.classList.add('has-file');
    } else {
        purchaseFile = file;
        purchaseFileName.textContent = file.name + (isCsv ? ' (CSV)' : '');
        updateSelectedFileSummary('purchase', file, isCsv);
        purchaseUpload.classList.add('has-file');
    }

    updateAnalyzeButton();
}

function updateAnalyzeButton() {
    analyzeBtn.disabled = !(salesFile || purchaseFile);
}

// ========================================
// Merge Mode (Çoklu Dosya Birleştirme)
// ========================================
function setupMergeMode() {
    const toggleBtn = document.getElementById('mergeModeToggle');
    const mergeSection = document.getElementById('mergeUploadSection');
    const uploadSection = document.querySelector('.upload-cards');
    const mergeAnalyzeBtn = document.getElementById('mergeAnalyzeBtn');
    const mergeSalesInput = document.getElementById('mergeSalesFiles');
    const mergePurchaseInput = document.getElementById('mergePurchaseFiles');

    if (!toggleBtn || !mergeSection) return;

    toggleBtn.addEventListener('click', () => {
        _mergeMode = !_mergeMode;
        toggleBtn.classList.toggle('active', _mergeMode);
        mergeSection.style.display = _mergeMode ? 'block' : 'none';
        if (uploadSection) {
            uploadSection.style.display = _mergeMode ? 'none' : 'flex';
        }
        if (!_mergeMode) {
            mergeSalesFiles = [];
            mergePurchaseFiles = [];
            document.getElementById('mergeSalesFileName').textContent = 'Dosya seçilmedi';
            document.getElementById('mergePurchaseFileName').textContent = 'Dosya seçilmedi';
            document.getElementById('mergeSalesFileSummary').textContent = 'Birden çok dosya seçilebilir';
            document.getElementById('mergePurchaseFileSummary').textContent = 'Birden çok dosya seçilebilir';
            if (mergeAnalyzeBtn) mergeAnalyzeBtn.disabled = true;
        }
    });

    if (mergeSalesInput) {
        mergeSalesInput.addEventListener('change', (e) => {
            mergeSalesFiles = Array.from(e.target.files || []);
            const count = mergeSalesFiles.length;
            document.getElementById('mergeSalesFileName').textContent = count > 0
                ? (count + ' dosya seçildi')
                : 'Dosya seçilmedi';
            document.getElementById('mergeSalesFileSummary').textContent = count > 0
                ? mergeSalesFiles.map(f => f.name).join(', ')
                : 'Birden çok dosya seçilebilir';
            updateMergeAnalyzeButton();
        });
    }

    if (mergePurchaseInput) {
        mergePurchaseInput.addEventListener('change', (e) => {
            mergePurchaseFiles = Array.from(e.target.files || []);
            const count = mergePurchaseFiles.length;
            document.getElementById('mergePurchaseFileName').textContent = count > 0
                ? (count + ' dosya seçildi')
                : 'Dosya seçilmedi';
            document.getElementById('mergePurchaseFileSummary').textContent = count > 0
                ? mergePurchaseFiles.map(f => f.name).join(', ')
                : 'Birden çok dosya seçilebilir';
            updateMergeAnalyzeButton();
        });
    }

    if (mergeAnalyzeBtn) {
        mergeAnalyzeBtn.addEventListener('click', mergeAnalyze);
    }
}

function updateMergeAnalyzeButton() {
    const btn = document.getElementById('mergeAnalyzeBtn');
    if (btn) {
        btn.disabled = mergeSalesFiles.length === 0 && mergePurchaseFiles.length === 0;
    }
}

async function mergeAnalyze() {
    if (mergeSalesFiles.length === 0 && mergePurchaseFiles.length === 0) {
        showError('Lütfen en az bir dosya seçin.');
        return;
    }

    showLoading(true);
    document.getElementById('mergeAnalyzeBtn').disabled = true;

    try {
        const formData = new FormData();
        for (const file of mergeSalesFiles) {
            formData.append('salesFiles', file);
        }
        for (const file of mergePurchaseFiles) {
            formData.append('purchaseFiles', file);
        }
        if (columnMapConfig.enabled) {
            formData.append('salesColumnMap', JSON.stringify({
                date: columnMapConfig.sales?.date || '',
                counterparty: columnMapConfig.sales?.counterparty || '',
                net: columnMapConfig.sales?.net || '',
                vat: columnMapConfig.sales?.vat || '',
                gross: columnMapConfig.sales?.gross || ''
            }));
            formData.append('purchaseColumnMap', JSON.stringify({
                date: columnMapConfig.purchase?.date || '',
                counterparty: columnMapConfig.purchase?.counterparty || '',
                net: columnMapConfig.purchase?.net || '',
                vat: columnMapConfig.purchase?.vat || '',
                gross: columnMapConfig.purchase?.gross || ''
            }));
        }

        const response = await fetch('/api/analyze/merge', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Birleştirme analizi sırasında hata oluştu.');
        }

        _mergeMode = false;
        const toggleBtn = document.getElementById('mergeModeToggle');
        if (toggleBtn) toggleBtn.classList.remove('active');
        document.getElementById('mergeUploadSection').style.display = 'none';
        document.querySelector('.upload-cards').style.display = 'flex';
        mergeSalesFiles = [];
        mergePurchaseFiles = [];
        document.getElementById('mergeSalesFileName').textContent = 'Dosya seçilmedi';
        document.getElementById('mergePurchaseFileName').textContent = 'Dosya seçilmedi';
        document.getElementById('mergeSalesFileSummary').textContent = 'Birden çok dosya seçilebilir';
        document.getElementById('mergePurchaseFileSummary').textContent = 'Birden çok dosya seçilebilir';

        displayResults(result);
        showImportSummaryToast(result.importSummary);
        loadBusinessPartyDashboardSummary();
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
        document.getElementById('mergeAnalyzeBtn').disabled = false;
    }
}

// ========================================
// Analysis
// ========================================
async function submitAnalyzeRequest(duplicateAction) {
    const formData = new FormData();
    if (salesFile) formData.append('salesFile', salesFile);
    if (purchaseFile) formData.append('purchaseFile', purchaseFile);

    if (duplicateAction) {
        formData.append('duplicateAction', duplicateAction);
    }
    if (columnMapConfig.enabled) {
        formData.append('salesColumnMap', JSON.stringify(columnMapConfig.sales));
        formData.append('purchaseColumnMap', JSON.stringify(columnMapConfig.purchase));
    }

    const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData
    });
    let result = {};
    try {
        result = await response.json();
    } catch (_) {
        result = {};
    }
    return { response, result };
}

function chooseDuplicateAction(result) {
    const duplicates = Array.isArray(result?.duplicates) ? result.duplicates : [];
    const lines = duplicates.map((d, idx) => `${idx + 1}. ${d.type === 'sales' ? 'Satış' : 'Alış'}: ${d.existingFile}`).join('\n');
    const message =
        `Aynı dönem raporu bulundu.\n\n${lines || (result?.existingFile || '')}\n\n` +
        'Seçenekler:\n' +
        '1 = İptal\n' +
        '2 = Mevcut kaydı değiştir\n' +
        '3 = Yeni sürüm olarak kaydet\n\n' +
        'Seçiminizi yazın (1/2/3):';

    const input = window.prompt(message, '1');
    if (input == null) return 'cancel';
    const normalized = String(input).trim();
    if (normalized === '2') return 'replace';
    if (normalized === '3') return 'version';
    return 'cancel';
}

function showImportSummaryToast(summary) {
    if (!summary) return;
    const customers = Number(summary.customers || 0);
    const suppliers = Number(summary.suppliers || 0);
    const inserted = Number(summary.transactionsInserted || 0);
    if (customers === 0 && suppliers === 0 && inserted === 0) return;
    showSuccessToast(`Excel carileri işlendi: ${customers} müşteri, ${suppliers} tedarikçi, ${inserted} yeni hareket.`);
}

async function analyzeFiles() {
    if (!salesFile && !purchaseFile) {
        showError('Lütfen en az bir Excel dosyası yükleyin.');
        return;
    }

    showLoading(true);

    try {
        let duplicateAction = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            const { response, result } = await submitAnalyzeRequest(duplicateAction);

            if (response.ok) {
                displayResults(result);
                showImportSummaryToast(result.importSummary);
                loadBusinessPartyDashboardSummary();
                return;
            }

            if (result?.duplicateAction === 'required' && attempt === 0) {
                const selectedAction = chooseDuplicateAction(result);
                if (selectedAction === 'cancel') {
                    showError('Analiz iptal edildi.');
                    return;
                }
                duplicateAction = selectedAction;
                continue;
            }

            throw new Error(result.error || 'Analiz sırasında bir hata oluştu.');
        }
    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

// ========================================
// Display Results
// ========================================
function displayResults(result) {
    // Hide upload section
    document.querySelector('.upload-section').style.display = 'none';

    // Show results section
    resultsSection.style.display = 'block';

    // Summary
    document.getElementById('summaryText').textContent = result.summary;
    document.getElementById('timestamp').textContent = result.timestamp;

    // Sales Stats
    if (result.sales) {
        const salesStats = document.getElementById('salesStats');
        salesStats.style.display = 'block';

        document.getElementById('totalSales').textContent = formatCurrency(result.sales.totalAmount);
        document.getElementById('salesCount').textContent = result.sales.itemCount + ' adet';
        document.getElementById('salesTax').textContent = formatCurrency(result.sales.totalTax || 0);

        const topSalesList = document.getElementById('topSalesProducts');
        topSalesList.innerHTML = result.sales.topProducts.map(p => `
            <li>
                <span class="product-name">${escapeHtml(p.name)}</span>
                <span class="product-amount">${formatCurrency(p.total)}</span>
            </li>
        `).join('');
    }

    // Purchase Stats
    if (result.purchase) {
        const purchaseStats = document.getElementById('purchaseStats');
        purchaseStats.style.display = 'block';

        document.getElementById('totalPurchase').textContent = formatCurrency(result.purchase.totalAmount);
        document.getElementById('purchaseCount').textContent = result.purchase.itemCount + ' adet';
        document.getElementById('purchaseTax').textContent = formatCurrency(result.purchase.totalTax || 0);

        const topPurchaseList = document.getElementById('topPurchaseProducts');
        topPurchaseList.innerHTML = result.purchase.topProducts.map(p => `
            <li>
                <span class="product-name">${escapeHtml(p.name)}</span>
                <span class="product-amount">${formatCurrency(p.total)}</span>
            </li>
        `).join('');
    }

    // Profit/Loss
    if (result.profitLoss) {
        const plCard = document.getElementById('profitLossCard');
        plCard.style.display = 'flex';

        // Determine profit/loss based on actual amount value
        const amount = result.profitLoss.amount;
        const isProfit = amount >= 0;
        plCard.className = `profit-loss-card ${isProfit ? 'profit' : 'loss'}`;

        document.getElementById('profitLossValue').textContent = formatCurrency(Math.abs(amount));

        // Handle percentage - hide if NaN or invalid
        const percentageEl = document.getElementById('profitLossPercentage');
        const pct = parseFloat(result.profitLoss.percentage);
        if (!isNaN(pct) && isFinite(pct)) {
            percentageEl.textContent = `${isProfit ? '+' : '-'}%${Math.abs(pct).toFixed(1)}`;
            percentageEl.style.display = '';
        } else {
            percentageEl.style.display = 'none';
        }

        document.getElementById('plIndicator').textContent = isProfit ? '+' : '-';
    }

    renderAnalysisVatSummary(result);
    renderOutlierWarning(result);
    resetFileInputs();
}

const OUTLIER_FIELD_LABELS = {
    net: 'Net Tutar',
    vat: 'KDV',
    gross: 'Brüt Tutar'
};

const OUTLIER_METHOD_LABELS = {
    zscore: 'Z-Score',
    iqr: 'IQR'
};

function renderOutlierWarning(result) {
    const warningEl = document.getElementById('outlierWarning');
    const detailsEl = document.getElementById('outlierDetails');
    const toggleBtn = document.getElementById('outlierDetailToggle');
    const tableBody = document.getElementById('outlierTableBody');
    const countEl = document.getElementById('outlierWarningCount');

    if (!warningEl || !result.outliers || !result.outliers.hasOutliers) {
        if (warningEl) warningEl.style.display = 'none';
        return;
    }

    const flags = result.outliers.flags || [];
    countEl.textContent = result.outliers.totalFlagged;
    warningEl.style.display = 'block';
    detailsEl.style.display = 'none';

    // Build table rows
    tableBody.innerHTML = flags.map((flag, idx) => {
        const rowIdx = flag.rowIndex + 1; // 1-based for display
        const fieldLabel = OUTLIER_FIELD_LABELS[flag.field] || flag.field;
        const methodLabel = OUTLIER_METHOD_LABELS[flag.method] || flag.method;
        const absDev = Math.abs(flag.deviation);
        const direction = flag.deviation > 0 ? 'üzerinde' : 'altında';

        return `<tr>
            <td>${rowIdx}</td>
            <td>${fieldLabel}</td>
            <td class="outlier-value">${formatCurrency(flag.value)}</td>
            <td class="outlier-expected">~${formatCurrency(flag.median)}</td>
            <td class="outlier-deviation">%${absDev.toFixed(1)} ${direction}</td>
            <td><span class="outlier-method-badge method-${flag.method}">${methodLabel}</span></td>
        </tr>`;
    }).join('');

    // Toggle handler
    toggleBtn.onclick = function() {
        const isHidden = detailsEl.style.display === 'none';
        detailsEl.style.display = isHidden ? 'block' : 'none';
        toggleBtn.textContent = isHidden ? 'Gizle' : 'Detay';
    };
}

function getVatStatusDisplay(salesVat, purchaseVat) {
    const safeSalesVat = Number(salesVat) || 0;
    const safePurchaseVat = Number(purchaseVat) || 0;
    const ledger = window.VatLedger && window.VatLedger.calculateVatLedger
        ? window.VatLedger.calculateVatLedger([{ month: 'current', salesVat: safeSalesVat, purchaseVat: safePurchaseVat }])
        : null;
    const payable = ledger ? ledger.totalPayable : Math.max(0, safeSalesVat - safePurchaseVat);
    const carryover = ledger ? ledger.closingCredit : Math.max(0, safePurchaseVat - safeSalesVat);

    if (payable > 0) {
        return {
            label: 'Ödenecek KDV',
            amount: payable,
            className: 'payable',
            hint: 'Satış KDV, alış KDV tutarını aştığı için devlete ödenecek tutar.'
        };
    }
    if (carryover > 0) {
        return {
            label: 'Devreden KDV',
            amount: carryover,
            className: 'carryover',
            hint: 'Alış KDV fazlası sonraki ay ödenecek KDV tutarından mahsup edilir.'
        };
    }
    return {
        label: 'Ödenecek KDV',
        amount: 0,
        className: 'neutral',
        hint: 'Bu analizde ödenecek KDV oluşmadı.'
    };
}

function renderAnalysisVatSummary(result) {
    if (!result.sales && !result.purchase) return;

    const kdvCard = document.getElementById('kdvSummaryCard');
    if (!kdvCard) return;
    kdvCard.style.display = 'block';

    const salesTax = result.sales?.totalTax || 0;
    const purchaseTax = result.purchase?.totalTax || 0;
    const vatStatus = getVatStatusDisplay(salesTax, purchaseTax);

    document.getElementById('totalSalesTax').textContent = formatCurrency(salesTax);
    document.getElementById('totalPurchaseTax').textContent = formatCurrency(purchaseTax);

    const netItem = kdvCard.querySelector('.kdv-item.net');
    const netTaxEl = document.getElementById('netTax');
    const netHintEl = document.getElementById('netTaxHint');
    const netLabel = kdvCard.querySelector('.kdv-item.net .kdv-label');
    if (netLabel) netLabel.textContent = vatStatus.label;
    if (netTaxEl) {
        netTaxEl.textContent = formatCurrency(vatStatus.amount);
        netTaxEl.style.color = '';
    }
    if (netHintEl) netHintEl.textContent = vatStatus.hint;
    if (netItem) {
        netItem.classList.remove('payable', 'carryover', 'neutral');
        netItem.classList.add(vatStatus.className);
    }
}

// ========================================
// Reset
// ========================================
function resetApp() {
    // Reset files
    salesFile = null;
    purchaseFile = null;
    salesFileInput.value = '';
    purchaseFileInput.value = '';

    // Reset UI
    salesFileName.textContent = 'Dosya seçilmedi';
    purchaseFileName.textContent = 'Dosya seçilmedi';
    salesUpload.classList.remove('has-file');
    purchaseUpload.classList.remove('has-file');
    resetSelectedFileSummaries();

    // Hide results
    resultsSection.style.display = 'none';
    document.getElementById('salesStats').style.display = 'none';
    document.getElementById('purchaseStats').style.display = 'none';
    document.getElementById('profitLossCard').style.display = 'none';
    document.getElementById('kdvSummaryCard').style.display = 'none';
    const outlierWarning = document.getElementById('outlierWarning');
    if (outlierWarning) outlierWarning.style.display = 'none';

    // Show upload section
    document.querySelector('.upload-section').style.display = 'block';

    // Disable analyze button
    analyzeBtn.disabled = true;
}

// ========================================
// Reset
// ========================================
function resetFileInputs() {
    // Reset files only (for new analysis shortcut)
    salesFile = null;
    purchaseFile = null;
    salesFileInput.value = '';
    purchaseFileInput.value = '';
    
    // Reset UI
    salesFileName.textContent = 'Dosya seçilmedi';
    purchaseFileName.textContent = 'Dosya seçilmedi';
    salesUpload.classList.remove('has-file');
    purchaseUpload.classList.remove('has-file');
    resetSelectedFileSummaries();
    
    // Disable analyze button
    analyzeBtn.disabled = true;
}

// ========================================
// Utilities
// ========================================
function formatCurrency(amount) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatCompactCurrency(amount) {
    const value = Number(amount) || 0;
    const abs = Math.abs(value);
    const sign = value < 0 ? '-' : '';

    if (abs >= 1000000) {
        const digits = abs >= 10000000 ? 1 : 2;
        return sign + '₺' + (abs / 1000000).toLocaleString('tr-TR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: digits
        }) + ' Mn';
    }

    if (abs >= 1000) {
        return sign + '₺' + (abs / 1000).toLocaleString('tr-TR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 1
        }) + ' B';
    }

    return formatCurrency(value);
}

function setKpiValue(elementId, amount, trend) {
    const el = document.getElementById(elementId);
    if (!el) return;

    const fullValue = formatCurrency(amount);
    const compactValue = formatCompactCurrency(amount);
    const trendHtml = trend ? '<span class="dashboard-card-trend" aria-hidden="true">' + trendBadge(trend) + '</span>' : '';

    el.innerHTML = '<span class="dashboard-card-value-text">' + escapeHtml(compactValue) + '</span>' + trendHtml;
    el.title = fullValue;
    el.setAttribute('aria-label', fullValue + (trend ? ' ' + trendLabel(trend) + ' trend' : ''));
}

function formatPercent(value) {
    const num = Number(value) || 0;
    const formatted = num.toFixed(2).replace('.', ',');
    return '%' + formatted;
}

const NUMERIC_COLOR_SELECTOR = [
    '.dashboard-card-value',
    '.dashboard-kdv-value',
    '.dashboard-subtotal-value',
    '.dashboard-pl-value',
    '.expenses-card-value',
    '.expenses-subtotal-value',
    '.history-stat-value',
    '.kdv-mini-value',
    '.stat-amount .value',
    '.stat-details .value',
    '.summary-stat .stat-value',
    '.pl-value',
    '.pl-percentage',
    '.kdv-value',
    '.pred-stat-value',
    '.growth-value',
    '.prediction-trend',
    '.prediction-table td',
    '.compare-table td',
    '.scenarios-table td',
    '.topn-table .amount-cell',
    '.product-amount',
    '.admin-stat-value',
    '.admin-data-count',
    '.backup-item-meta span'
].join(',');

function parseDisplayedNumber(text) {
    const raw = String(text || '').trim();
    if (!raw || raw === '-' || /^\d{4}$/.test(raw)) return null;

    const isNegative = raw.includes('-') || /\b(zarar|düşüş|negative)\b/i.test(raw);
    const cleaned = raw
        .replace(/[^\d,.-]/g, '')
        .replace(/\.(?=\d{3}(\D|$))/g, '')
        .replace(',', '.');
    const match = cleaned.match(/-?\d+(\.\d+)?/);
    if (!match) return null;

    const value = Math.abs(Number(match[0]));
    if (!Number.isFinite(value)) return null;
    if (value === 0) return 0;
    return isNegative ? -value : value;
}

function colorizeNumericValues(root = document) {
    const elements = [];
    if (root instanceof Element && root.matches(NUMERIC_COLOR_SELECTOR)) {
        elements.push(root);
    }
    root.querySelectorAll(NUMERIC_COLOR_SELECTOR).forEach((el) => {
        elements.push(el);
    });

    elements.forEach((el) => {
        if (el.closest('select, option, input, textarea')) return;
        const value = parseDisplayedNumber(el.textContent);
        el.classList.remove('numeric-positive', 'numeric-negative', 'numeric-zero');
        if (value == null) return;
        if (value > 0) el.classList.add('numeric-positive');
        else if (value < 0) el.classList.add('numeric-negative');
        else el.classList.add('numeric-zero');
    });
}

function numericToneClass(value) {
    const num = Number(value) || 0;
    if (num > 0) return 'numeric-positive';
    if (num < 0) return 'numeric-negative';
    return 'numeric-zero';
}

function hasProfitLossActivity(month) {
    return ['sales', 'purchases', 'grossProfit', 'expenses', 'netProfit'].some((key) => Number(month?.[key] || 0) !== 0);
}

function setupNumericValueColoring() {
    colorizeNumericValues();
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'characterData') {
                const parent = mutation.target.parentElement;
                if (parent) colorizeNumericValues(parent.closest('section') || parent);
            } else if (mutation.target instanceof Element) {
                colorizeNumericValues(mutation.target.closest('section') || mutation.target);
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function showLoading(show, message) {
    if (show) {
        const msgEl = document.getElementById('loadingMessage');
        if (msgEl) msgEl.textContent = message || 'Dosyalar analiz ediliyor...';
    }
    loadingOverlay.classList.toggle('active', show);
}

function showError(message) {
    notify.showInlineToast({
        container: errorToast,
        message,
        duration: 4000
    });
}

// ========================================
// Tema uyumlu onay modalı (native confirm yerine)
// Promise<boolean> döner: onay=true, iptal/ESC/dış tık/kapat=false
// ========================================
function showConfirm(options = {}) {
    const opts = typeof options === 'string' ? { message: options } : (options || {});
    const message = opts.message || 'Bu işlemi onaylıyor musunuz?';
    const title = opts.title || 'Onay';
    const confirmText = opts.confirmText || 'Onayla';
    const cancelText = opts.cancelText || 'İptal';
    const danger = !!opts.danger;

    const overlay = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmModalTitle');
    const messageEl = document.getElementById('confirmModalMessage');
    const confirmBtn = document.getElementById('confirmModalConfirm');
    const cancelBtn = document.getElementById('confirmModalCancel');
    const closeBtn = document.getElementById('confirmModalClose');

    // Güvenli geri düşüş: modal iskeleti yoksa native confirm'e dön (asla sessizce onaylama)
    if (!overlay || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
        return Promise.resolve(window.confirm(message));
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;
    confirmBtn.classList.toggle('btn-danger', danger);
    confirmBtn.classList.toggle('btn-primary', !danger);

    const previousActive = document.activeElement;

    return new Promise((resolve) => {
        let settled = false;

        function cleanup(result) {
            if (settled) return;
            settled = true;
            overlay.style.display = 'none';
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            if (closeBtn) closeBtn.removeEventListener('click', onCancel);
            overlay.removeEventListener('click', onOverlay);
            document.removeEventListener('keydown', onKey);
            if (previousActive && typeof previousActive.focus === 'function') {
                previousActive.focus();
            }
            resolve(result);
        }
        function onConfirm() { cleanup(true); }
        function onCancel() { cleanup(false); }
        function onOverlay(event) { if (event.target === overlay) cleanup(false); }
        function onKey(event) {
            // Enter özel olarak ele alınmaz: odaklı düğmenin native click'ine bırakılır.
            // Açılışta odak Onayla'da (aşağıda confirmBtn.focus()); kullanıcı Tab ile İptal'e
            // geçerse Enter doğru düğmeyi tetikler. Böylece "İptal odaktayken Enter = sil" hatası olmaz.
            if (event.key === 'Escape') {
                cleanup(false);
            }
        }

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        if (closeBtn) closeBtn.addEventListener('click', onCancel);
        overlay.addEventListener('click', onOverlay);
        document.addEventListener('keydown', onKey);

        overlay.style.display = 'flex';
        confirmBtn.focus();
    });
}
window.showConfirm = showConfirm;

// ========================================
// History filters (search, year, sort)
// ========================================
let historySearchDebounce = null;
function setupHistoryFilters() {
    const searchEl = document.getElementById('historySearch');
    const yearEl = document.getElementById('historyYearFilter');
    const sortEl = document.getElementById('historySort');
    if (searchEl) {
        searchEl.addEventListener('input', () => {
            clearTimeout(historySearchDebounce);
            historySearchDebounce = setTimeout(loadHistory, 320);
        });
    }
    if (yearEl) yearEl.addEventListener('change', loadHistory);
    if (sortEl) sortEl.addEventListener('change', loadHistory);

    const typeFilter = document.getElementById('historyTypeFilter');
    if (typeFilter) typeFilter.addEventListener('change', loadHistory);
    const amMin = document.getElementById('historyAmountMin');
    if (amMin) amMin.addEventListener('input', () => {
        clearTimeout(historySearchDebounce);
        historySearchDebounce = setTimeout(loadHistory, 320);
    });
    const amMax = document.getElementById('historyAmountMax');
    if (amMax) amMax.addEventListener('input', () => {
        clearTimeout(historySearchDebounce);
        historySearchDebounce = setTimeout(loadHistory, 320);
    });
    const dtFrom = document.getElementById('historyDateFrom');
    if (dtFrom) dtFrom.addEventListener('change', loadHistory);
    const dtTo = document.getElementById('historyDateTo');
    if (dtTo) dtTo.addEventListener('change', loadHistory);

    const pageSizeEl = document.getElementById('historyPageSize');
    if (pageSizeEl) pageSizeEl.addEventListener('change', loadHistory);
}

// ========================================
// Navigation
// ========================================
function setupNavigation() {
    tabDashboard.addEventListener('click', () => switchTab('dashboard'));
    tabAnalyze.addEventListener('click', () => switchTab('analyze'));
    tabHistory.addEventListener('click', () => switchTab('history'));
    const tabExpenses = document.getElementById('tabExpenses');
    if (tabExpenses) tabExpenses.addEventListener('click', () => switchTab('expenses'));

    const tabCustomers = document.getElementById('tabCustomers');
    if (tabCustomers) tabCustomers.addEventListener('click', () => switchTab('customers'));
    const tabSuppliers = document.getElementById('tabSuppliers');
    if (tabSuppliers) tabSuppliers.addEventListener('click', () => switchTab('suppliers'));

    const tabPredictions = document.getElementById('tabPredictions');
    if (tabPredictions) {
        tabPredictions.addEventListener('click', () => switchTab('predictions'));
    }

    const tabCompare = document.getElementById('tabCompare');
    if (tabCompare) {
        tabCompare.addEventListener('click', () => switchTab('compare'));
    }

    const tabTopN = document.getElementById('tabTopN');
    if (tabTopN) {
        tabTopN.addEventListener('click', () => switchTab('topn'));
    }

    const tabAdmin = document.getElementById('tabAdmin');
    if (tabAdmin) {
        tabAdmin.addEventListener('click', () => switchTab('admin'));
    }

    const refreshPredictionsBtn = document.getElementById('refreshPredictionsBtn');
    if (refreshPredictionsBtn) {
        refreshPredictionsBtn.addEventListener('click', () => loadPredictions());
    }
    const predictionPeriodSelect = document.getElementById('predictionPeriodSelect');
    const predictionModelSelect = document.getElementById('predictionModelSelect');
    if (predictionPeriodSelect) predictionPeriodSelect.addEventListener('change', () => loadPredictions());
    if (predictionModelSelect) predictionModelSelect.addEventListener('change', () => loadPredictions());

    // Year select for dashboard
    const yearSelect = document.getElementById('yearSelect');
    if (yearSelect) {
        yearSelect.addEventListener('change', () => {
            renderDashboardForYear(yearSelect.value);
            loadProfitLoss(yearSelect.value);
        });
    }

}

function isCurrentUserAdmin() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return Boolean(user?.is_admin);
    } catch (_) {
        return false;
    }
}

function setupAdminVisibility() {
    const isAdmin = isCurrentUserAdmin();
    document.body.classList.toggle('admin-user', isAdmin);
    document.querySelectorAll('.admin-only').forEach((el) => {
        el.style.display = isAdmin ? '' : 'none';
    });

    const accountTab = document.querySelector('.admin-tab[data-admin-tab="account"]');
    const accountContent = document.getElementById('adminAccountTab');
    if (accountTab && accountContent && !document.querySelector('.admin-tab.active:not(.admin-only)')) {
        openSettingsTab('account');
    }
}

function switchTab(tab) {
    currentTab = tab;
    closeSidebarAccountMenu();

    // Update tab styles
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
        btn.removeAttribute('aria-current');
    });

    // Hide all sections
    document.getElementById('uploadSection').style.display = 'none';
    resultsSection.style.display = 'none';
    historySection.style.display = 'none';
    dashboardSection.style.display = 'none';
    if (expensesSection) expensesSection.style.display = 'none';
    if (customersSection) customersSection.style.display = 'none';
    if (suppliersSection) suppliersSection.style.display = 'none';
    if (partyDetailSection) partyDetailSection.style.display = 'none';
    const predictionsSection = document.getElementById('predictionsSection');
    if (predictionsSection) predictionsSection.style.display = 'none';
    const compareSection = document.getElementById('compareSection');
    if (compareSection) compareSection.style.display = 'none';
    const topnSection = document.getElementById('topnSection');
    if (topnSection) topnSection.style.display = 'none';
    const adminSection = document.getElementById('adminSection');
    if (adminSection) adminSection.style.display = 'none';

    // Show selected section
    if (tab === 'analyze') {
        document.getElementById('tabAnalyze').classList.add('active');
        document.getElementById('tabAnalyze').setAttribute('aria-current', 'page');
        document.getElementById('uploadSection').style.display = 'block';
    } else if (tab === 'history') {
        document.getElementById('tabHistory').classList.add('active');
        document.getElementById('tabHistory').setAttribute('aria-current', 'page');
        historySection.style.display = 'block';
        loadHistory();
    } else if (tab === 'dashboard') {
        document.getElementById('tabDashboard').classList.add('active');
        document.getElementById('tabDashboard').setAttribute('aria-current', 'page');
        dashboardSection.style.display = 'block';
        loadDashboard();
    } else if (tab === 'expenses') {
        document.getElementById('tabExpenses').classList.add('active');
        document.getElementById('tabExpenses').setAttribute('aria-current', 'page');
        if (expensesSection) {
            expensesSection.style.display = 'block';
            loadExpensesLocal();
        }
    } else if (tab === 'customers') {
        document.getElementById('tabCustomers').classList.add('active');
        document.getElementById('tabCustomers').setAttribute('aria-current', 'page');
        if (customersSection) {
            customersSection.style.display = 'block';
            loadCustomers();
            loadBusinessParties('customer');
        }
    } else if (tab === 'suppliers') {
        document.getElementById('tabSuppliers').classList.add('active');
        document.getElementById('tabSuppliers').setAttribute('aria-current', 'page');
        if (suppliersSection) {
            suppliersSection.style.display = 'block';
            loadBusinessParties('supplier');
        }
    } else if (tab === 'compare') {
        document.getElementById('tabCompare').classList.add('active');
        document.getElementById('tabCompare').setAttribute('aria-current', 'page');
        if (compareSection) {
            compareSection.style.display = 'block';
            initCompareYears();
        }
    } else if (tab === 'predictions') {
        document.getElementById('tabPredictions').classList.add('active');
        document.getElementById('tabPredictions').setAttribute('aria-current', 'page');
        if (predictionsSection) {
            predictionsSection.style.display = 'block';
            loadPredictions();
        }
    } else if (tab === 'topn') {
        document.getElementById('tabTopN').classList.add('active');
        document.getElementById('tabTopN').setAttribute('aria-current', 'page');
        const topnSection = document.getElementById('topnSection');
        if (topnSection) {
            topnSection.style.display = 'block';
            loadTopN();
        }
    } else if (tab === 'admin') {
        document.getElementById('tabAdmin').classList.add('active');
        document.getElementById('tabAdmin').setAttribute('aria-current', 'page');
        const adminSection = document.getElementById('adminSection');
        if (adminSection) {
            adminSection.style.display = 'block';
            setupAdminVisibility();
            setupAdminTabs();
            openSettingsTab('account');
            if (isCurrentUserAdmin()) loadAdminData();
        }
    }

    syncPendingUsersPolling();
    closeMobileSidebar();
}

function setupCustomerControls() {
    const searchInput = document.getElementById('customerSearchInput');
    const balanceFilter = document.getElementById('customerBalanceFilter');
    const sortSelect = document.getElementById('customerSortSelect');
    const customerModal = document.getElementById('customerModal');
    const customerDetailModal = document.getElementById('customerDetailModal');

    searchInput?.addEventListener('input', () => {
        clearTimeout(_customerSearchTimer);
        _customerSearchTimer = setTimeout(loadCustomers, 250);
    });
    balanceFilter?.addEventListener('change', loadCustomers);
    sortSelect?.addEventListener('change', loadCustomers);
    customerModal?.addEventListener('click', (event) => {
        if (event.target === customerModal) closeCustomerModal();
    });
    customerDetailModal?.addEventListener('click', (event) => {
        if (event.target === customerDetailModal) closeCustomerDetailModal();
    });
}

function customerBalanceClass(balance) {
    if (balance > 0) return 'positive';
    if (balance < 0) return 'negative';
    return 'neutral';
}

function validateCustomerFormPayload(payload) {
    if (!payload.firstName) return 'Ad gereklidir.';
    if (!payload.lastName) return 'Soyad gereklidir.';
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return 'Geçerli bir e-posta girin.';
    if (payload.phone && !/^\+?[0-9\s()\-]{7,24}$/.test(payload.phone)) return 'Telefon formatı geçersiz.';
    if (!Number.isFinite(Number(payload.balance))) return 'Bakiye sayı olmalıdır.';
    return null;
}

function getCustomerFormPayload() {
    return {
        firstName: document.getElementById('customerFirstName')?.value.trim() || '',
        lastName: document.getElementById('customerLastName')?.value.trim() || '',
        phone: document.getElementById('customerPhone')?.value.trim() || '',
        email: document.getElementById('customerEmail')?.value.trim().toLowerCase() || '',
        taxNumber: document.getElementById('customerTaxNumber')?.value.trim() || '',
        balance: Number(document.getElementById('customerBalance')?.value || 0),
        address: document.getElementById('customerAddress')?.value.trim() || '',
        notes: document.getElementById('customerNotes')?.value.trim() || ''
    };
}

function setCustomerModalError(message) {
    const errEl = document.getElementById('customerModalError');
    if (!errEl) return;
    errEl.textContent = message || '';
    errEl.style.display = message ? 'block' : 'none';
}

window.openCustomerModal = function openCustomerModal(customerId = null) {
    const modal = document.getElementById('customerModal');
    const form = document.getElementById('customerForm');
    const title = document.getElementById('customerModalTitle');
    const balanceInput = document.getElementById('customerBalance');
    if (!modal || !form) return;

    form.reset();
    setCustomerModalError('');
    document.getElementById('customerId').value = '';
    if (balanceInput) {
        balanceInput.value = '0';
        balanceInput.disabled = true;
    }
    if (title) title.textContent = 'Yeni Müşteri';

    if (customerId) {
        const customer = _customers.find((item) => String(item.id) === String(customerId));
        if (customer) {
            document.getElementById('customerId').value = customer.id;
            document.getElementById('customerFirstName').value = customer.firstName || '';
            document.getElementById('customerLastName').value = customer.lastName || '';
            document.getElementById('customerPhone').value = customer.phone || '';
            document.getElementById('customerEmail').value = customer.email || '';
            document.getElementById('customerTaxNumber').value = customer.taxNumber || '';
            document.getElementById('customerBalance').value = customer.balance || 0;
            document.getElementById('customerAddress').value = customer.address || '';
            document.getElementById('customerNotes').value = customer.notes || '';
            if (balanceInput) balanceInput.disabled = false;
            if (title) title.textContent = 'Müşteri Düzenle';
        }
    }

    modal.style.display = 'flex';
};

window.closeCustomerModal = function closeCustomerModal() {
    const modal = document.getElementById('customerModal');
    if (modal) modal.style.display = 'none';
};

window.saveCustomer = async function saveCustomer(event) {
    event.preventDefault();
    const id = document.getElementById('customerId')?.value || '';
    const payload = getCustomerFormPayload();
    const validationError = validateCustomerFormPayload(payload);
    if (validationError) {
        setCustomerModalError(validationError);
        return;
    }

    try {
        const response = await fetch(id ? `/api/customers/${encodeURIComponent(id)}` : '/api/customers', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            setCustomerModalError(data.error || 'Müşteri kaydedilemedi.');
            return;
        }
        closeCustomerModal();
        showSuccessToast(id ? 'Müşteri güncellendi.' : 'Müşteri eklendi.');
        await loadCustomers();
        await loadCustomerDashboardSummary();
        await loadBusinessPartyDashboardSummary();
    } catch (error) {
        console.error('Customer save error:', error);
        setCustomerModalError('Sunucu hatası.');
    }
};

window.deleteCustomer = async function deleteCustomer(customerId) {
    const customer = _customers.find((item) => String(item.id) === String(customerId));
    const name = customer?.fullName || 'bu müşteri';
    if (!(await showConfirm({ message: `${name} silinsin mi? Bu işlem geri alınamaz.`, danger: true, confirmText: 'Sil' }))) return;

    try {
        const response = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok || !data.success) {
            showError(data.error || 'Müşteri silinemedi.');
            return;
        }
        showSuccessToast('Müşteri silindi.');
        await loadCustomers();
        await loadCustomerDashboardSummary();
        await loadBusinessPartyDashboardSummary();
    } catch (error) {
        console.error('Customer delete error:', error);
        showError('Müşteri silinirken hata oluştu.');
    }
};

window.openCustomerDetail = function openCustomerDetail(customerId) {
    const customer = _customers.find((item) => String(item.id) === String(customerId));
    const modal = document.getElementById('customerDetailModal');
    const title = document.getElementById('customerDetailTitle');
    const body = document.getElementById('customerDetailBody');
    if (!customer || !modal || !body) return;

    if (title) title.textContent = customer.fullName || 'Müşteri Detayı';
    body.innerHTML = `
        <div class="customer-detail-grid">
            <div><span>Telefon</span><strong>${escapeHtml(customer.phone || '-')}</strong></div>
            <div><span>E-posta</span><strong>${escapeHtml(customer.email || '-')}</strong></div>
            <div><span>Vergi No</span><strong>${escapeHtml(customer.taxNumber || '-')}</strong></div>
            <div><span>Bakiye</span><strong class="${customerBalanceClass(customer.balance)}">${escapeHtml(formatCurrency(customer.balance || 0))}</strong></div>
        </div>
        <div class="customer-detail-block">
            <span>Adres</span>
            <p>${escapeHtml(customer.address || 'Adres eklenmemiş.')}</p>
        </div>
        <div class="customer-detail-block">
            <span>Not</span>
            <p>${escapeHtml(customer.notes || 'Not eklenmemiş.')}</p>
        </div>
        <div class="customer-timeline-empty">
            <strong>İşlem Geçmişi</strong>
            <p>Henüz işlem geçmişi yok. Fatura veya tahsilat modülü eklendiğinde bu alan kullanılacak.</p>
        </div>`;
    modal.style.display = 'flex';
};

window.closeCustomerDetailModal = function closeCustomerDetailModal() {
    const modal = document.getElementById('customerDetailModal');
    if (modal) modal.style.display = 'none';
};

async function loadCustomers() {
    const grid = document.getElementById('customersGrid');
    const empty = document.getElementById('customersEmpty');
    if (!grid || !empty) return;

    const params = new URLSearchParams();
    const search = document.getElementById('customerSearchInput')?.value.trim();
    const balanceStatus = document.getElementById('customerBalanceFilter')?.value || 'all';
    const sort = document.getElementById('customerSortSelect')?.value || 'created_desc';
    if (search) params.set('search', search);
    if (balanceStatus && balanceStatus !== 'all') params.set('balanceStatus', balanceStatus);
    params.set('sort', sort);

    try {
        const response = await fetch(`/api/customers?${params.toString()}`);
        const data = await response.json();
        if (!response.ok || !data.success) {
            showError(data.error || 'Müşteriler yüklenemedi.');
            return;
        }
        _customers = data.customers || [];
        renderCustomers(_customers);
    } catch (error) {
        console.error('Customers load error:', error);
        showError('Müşteriler yüklenirken hata oluştu.');
    }
}

function renderCustomers(customers) {
    const grid = document.getElementById('customersGrid');
    const empty = document.getElementById('customersEmpty');
    if (!grid || !empty) return;

    empty.style.display = customers.length ? 'none' : 'block';
    grid.innerHTML = customers.map((customer) => `
        <article class="customer-card">
            <div class="customer-card-main">
                <div class="customer-avatar">${escapeHtml((customer.firstName || '?').charAt(0).toUpperCase())}</div>
                <div>
                    <h3>${escapeHtml(customer.fullName || '-')}</h3>
                    <p>${escapeHtml(customer.email || 'E-posta yok')}</p>
                </div>
            </div>
            <div class="customer-meta">
                <span>${escapeHtml(customer.phone || 'Telefon yok')}</span>
                <span>${escapeHtml(customer.taxNumber || 'Vergi no yok')}</span>
            </div>
            <div class="customer-balance-row">
                <span>Bakiye</span>
                <strong class="${customerBalanceClass(customer.balance)}">${escapeHtml(formatCurrency(customer.balance || 0))}</strong>
            </div>
            <div class="customer-actions">
                <button type="button" onclick="openCustomerDetail(${customer.id})">Detay</button>
                <button type="button" onclick="openCustomerModal(${customer.id})">Düzenle</button>
                <button type="button" class="danger" onclick="deleteCustomer(${customer.id})">Sil</button>
            </div>
        </article>`).join('');
}

async function loadCustomerDashboardSummary() {
    const totalEl = document.getElementById('dashTotalCustomers');
    const section = document.getElementById('dashboardCustomersSection');
    const recentList = document.getElementById('dashboardRecentCustomersList');
    const topEl = document.getElementById('dashboardTopCustomer');
    if (!totalEl && !section && !recentList && !topEl) return;

    try {
        const response = await fetch('/api/customers/summary');
        const data = await response.json();
        if (!response.ok || !data.success) return;

        const summary = data.summary || {};
        if (totalEl) totalEl.textContent = summary.totalCount || 0;
        if (section) section.style.display = 'block';
        if (recentList) {
            const recent = summary.recentCustomers || [];
            recentList.innerHTML = recent.length ? recent.map((customer) => `
                <li>
                    <span class="recent-link-btn">${escapeHtml(customer.fullName || '-')}</span>
                    <span class="recent-metrics"><span>${escapeHtml(customer.email || 'E-posta yok')}</span></span>
                </li>`).join('') : '<li class="recent-empty">Henüz müşteri eklenmemiş</li>';
        }
        if (topEl) {
            const top = summary.highestBalanceCustomer;
            topEl.innerHTML = top ? `
                <span class="dashboard-customer-label">En Yüksek Bakiyeli Müşteri</span>
                <strong>${escapeHtml(top.fullName || '-')}</strong>
                <span class="dashboard-customer-balance ${customerBalanceClass(top.balance)}">${escapeHtml(formatCurrency(top.balance || 0))}</span>
            ` : `
                <span class="dashboard-customer-label">En Yüksek Bakiyeli Müşteri</span>
                <strong>-</strong>
                <span class="dashboard-customer-balance">₺0</span>
            `;
        }
    } catch (error) {
        console.warn('Customer dashboard summary failed:', error);
    }
}

function setupBusinessPartyControls() {
    ['customer', 'supplier'].forEach((type) => {
        const prefix = type === 'customer' ? 'customerParty' : 'supplierParty';
        const search = document.getElementById(`${prefix}SearchInput`);
        const dateFrom = document.getElementById(`${prefix}DateFrom`);
        const dateTo = document.getElementById(`${prefix}DateTo`);
        const minVolume = document.getElementById(`${prefix}MinVolume`);
        const sort = document.getElementById(`${prefix}SortSelect`);
        const debounced = () => {
            clearTimeout(_businessPartySearchTimer);
            _businessPartySearchTimer = setTimeout(() => loadBusinessParties(type), 250);
        };
        search?.addEventListener('input', debounced);
        minVolume?.addEventListener('input', debounced);
        dateFrom?.addEventListener('change', () => loadBusinessParties(type));
        dateTo?.addEventListener('change', () => loadBusinessParties(type));
        sort?.addEventListener('change', () => loadBusinessParties(type));
    });
}

function getBusinessPartyFilterParams(type) {
    const prefix = type === 'customer' ? 'customerParty' : 'supplierParty';
    const params = new URLSearchParams({ type });
    const search = document.getElementById(`${prefix}SearchInput`)?.value.trim();
    const dateFrom = document.getElementById(`${prefix}DateFrom`)?.value;
    const dateTo = document.getElementById(`${prefix}DateTo`)?.value;
    const minVolume = document.getElementById(`${prefix}MinVolume`)?.value;
    const sort = document.getElementById(`${prefix}SortSelect`)?.value || 'volume_desc';
    if (search) params.set('search', search);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (minVolume) params.set('minVolume', minVolume);
    params.set('sort', sort);
    return params;
}

async function loadBusinessParties(type = 'customer') {
    _currentPartyListType = type;
    const tableBody = document.getElementById(type === 'customer' ? 'customerPartyTableBody' : 'supplierPartyTableBody');
    const empty = document.getElementById(type === 'customer' ? 'customerPartyEmpty' : 'supplierPartyEmpty');
    if (!tableBody || !empty) return;

    tableBody.innerHTML = '<tr><td colspan="5">Yükleniyor...</td></tr>';
    try {
        const params = getBusinessPartyFilterParams(type);
        const response = await fetch(`/api/business-parties?${params.toString()}`);
        const data = await response.json();
        if (!response.ok || !data.success) {
            showError(data.error || 'Cari listesi yüklenemedi.');
            return;
        }
        renderBusinessPartyRows(type, data.parties || []);
    } catch (error) {
        console.error('Business parties load error:', error);
        showError('Cari listesi yüklenirken hata oluştu.');
    }
}

function renderBusinessPartyRows(type, parties) {
    const tableBody = document.getElementById(type === 'customer' ? 'customerPartyTableBody' : 'supplierPartyTableBody');
    const empty = document.getElementById(type === 'customer' ? 'customerPartyEmpty' : 'supplierPartyEmpty');
    if (!tableBody || !empty) return;

    empty.style.display = parties.length ? 'none' : 'block';
    tableBody.innerHTML = parties.map((party) => `
        <tr class="business-party-row" onclick="openBusinessPartyDetail('${type}', '${escapeHtml(String(party.id))}')">
            <td class="bp-cell-name">
                <strong>${escapeHtml(party.name || '-')}</strong>
                <span>${type === 'customer' ? 'Müşteri' : 'Tedarikçi'}</span>
            </td>
            <td data-label="İşlem Hacmi">${escapeHtml(formatCurrency(party.totalVolume || 0))}</td>
            <td data-label="İşlem">${escapeHtml(String(party.transactionCount || 0))}</td>
            <td data-label="Son İşlem">${escapeHtml(formatDisplayDate(party.lastTransactionDate))}</td>
            <td data-label="Bakiye"><strong class="${customerBalanceClass(party.balance || 0)}">${escapeHtml(formatCurrency(party.balance || 0))}</strong></td>
        </tr>`).join('');
}

function formatDisplayDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('tr-TR');
}

window.openBusinessPartyDetail = async function openBusinessPartyDetail(type, id) {
    _currentPartyDetailType = type === 'supplier' ? 'supplier' : 'customer';
    try {
        const response = await fetch(`/api/business-parties/${encodeURIComponent(_currentPartyDetailType)}/${encodeURIComponent(id)}`);
        const data = await response.json();
        if (!response.ok || !data.success) {
            showError(data.error || 'Cari detayı yüklenemedi.');
            return;
        }
        renderBusinessPartyDetail(data.detail);
    } catch (error) {
        console.error('Business party detail error:', error);
        showError('Cari detayı yüklenirken hata oluştu.');
    }
};

function renderBusinessPartyDetail(detail) {
    if (!detail || !partyDetailSection) return;
    if (customersSection) customersSection.style.display = 'none';
    if (suppliersSection) suppliersSection.style.display = 'none';
    partyDetailSection.style.display = 'block';

    const party = detail.party || {};
    const metrics = detail.metrics || {};
    document.getElementById('partyDetailKicker').textContent = party.type === 'supplier' ? 'Tedarikçi Detay' : 'Müşteri Detay';
    document.getElementById('partyDetailTitle').textContent = party.name || 'Cari Detay';
    document.getElementById('partyDetailSubtitle').textContent = `${metrics.transactionCount || 0} hareket, son işlem ${formatDisplayDate(metrics.lastTransactionDate)}`;
    document.getElementById('partyTotalVolume').textContent = formatCurrency(metrics.totalVolume || 0);
    const balanceEl = document.getElementById('partyBalance');
    balanceEl.textContent = formatCurrency(metrics.balance || 0);
    balanceEl.className = customerBalanceClass(metrics.balance || 0);
    document.getElementById('partyLastTransaction').textContent = `${formatDisplayDate(metrics.lastTransactionDate)} · ${formatCurrency(metrics.lastTransactionAmount || 0)}`;
    document.getElementById('partyAverageAmount').textContent = formatCurrency(metrics.averageAmount || 0);

    renderPartyDetailCharts(detail);
    renderPartyTransactions(detail.transactions || []);
}

window.backToPartyList = function backToPartyList() {
    if (partyDetailSection) partyDetailSection.style.display = 'none';
    switchTab(_currentPartyDetailType === 'supplier' ? 'suppliers' : 'customers');
};

function renderPartyDetailCharts(detail) {
    const monthlyCanvas = document.getElementById('partyMonthlyChart');
    const trendCanvas = document.getElementById('partyTrendChart');
    const monthly = detail.monthly || [];
    const trend = detail.trend || [];
    if (!monthlyCanvas || !trendCanvas || typeof Chart === 'undefined') return;

    if (_partyMonthlyChartInstance) _partyMonthlyChartInstance.destroy();
    if (_partyTrendChartInstance) _partyTrendChartInstance.destroy();

    _partyMonthlyChartInstance = new Chart(monthlyCanvas, {
        type: 'bar',
        data: {
            labels: monthly.map((item) => item.month),
            datasets: [{ label: 'Aylık Hacim', data: monthly.map((item) => item.amount), backgroundColor: '#0f766e' }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    _partyTrendChartInstance = new Chart(trendCanvas, {
        type: 'line',
        data: {
            labels: trend.map((item) => item.month),
            datasets: [{ label: 'Trend', data: trend.map((item) => item.amount), borderColor: '#2563eb', tension: 0.3, fill: false }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderPartyTransactions(transactions) {
    const body = document.getElementById('partyTransactionsTableBody');
    if (!body) return;
    body.innerHTML = transactions.length ? transactions.map((tx) => `
        <tr>
            <td>${escapeHtml(formatDisplayDate(tx.date))}</td>
            <td>${tx.invoiceType === 'sales' ? 'Satış' : 'Alış'}</td>
            <td>${escapeHtml(formatCurrency(tx.amount || 0))}</td>
            <td>${escapeHtml(formatCurrency(tx.vat || 0))}</td>
            <td>${escapeHtml(tx.sourceFile || tx.description || '-')}</td>
        </tr>`).join('') : '<tr><td colspan="5">Henüz hareket yok.</td></tr>';
}

async function loadBusinessPartyDashboardSummary() {
    const totalCustomersEl = document.getElementById('dashTotalCustomers');
    const totalSuppliersEl = document.getElementById('dashTotalSuppliers');
    const topCustomersEl = document.getElementById('dashboardTopCustomersList');
    const topSuppliersEl = document.getElementById('dashboardTopSuppliersList');
    const recentPartiesEl = document.getElementById('dashboardRecentPartiesList');
    if (!totalCustomersEl && !totalSuppliersEl && !topCustomersEl && !topSuppliersEl && !recentPartiesEl) return;

    try {
        const response = await fetch('/api/business-parties/dashboard-summary');
        const data = await response.json();
        if (!response.ok || !data.success) return;
        const summary = data.summary || {};
        if (totalCustomersEl) totalCustomersEl.textContent = summary.totalCustomers || 0;
        if (totalSuppliersEl) totalSuppliersEl.textContent = summary.totalSuppliers || 0;
        renderDashboardPartyList(topCustomersEl, summary.topCustomers || [], 'customer', 'Henüz müşteri hareketi yok');
        renderDashboardPartyList(topSuppliersEl, summary.topSuppliers || [], 'supplier', 'Henüz tedarikçi hareketi yok');
        renderDashboardPartyList(recentPartiesEl, summary.recentParties || [], null, 'Henüz cari hareketi yok');
    } catch (error) {
        console.warn('Business party dashboard summary failed:', error);
    }
}

function renderDashboardPartyList(container, parties, forcedType, emptyText) {
    if (!container) return;
    container.innerHTML = parties.length ? parties.map((party) => {
        const type = forcedType || party.type || 'customer';
        return `
            <li>
                <button type="button" class="recent-link-btn" onclick="openBusinessPartyDetail('${type}', '${escapeHtml(String(party.id))}')">${escapeHtml(party.name || '-')}</button>
                <span class="recent-metrics"><span>${escapeHtml(formatCurrency(party.totalVolume || 0))}</span></span>
            </li>`;
    }).join('') : `<li class="recent-empty">${escapeHtml(emptyText)}</li>`;
}

// ========================================
// History Functions
// ========================================
async function loadHistoryCount() {
    try {
        const data = await historyApi.fetchHistoryCount();

        if (data.success && data.history.length > 0) {
            historyCount.textContent = data.history.length;
            historyCount.style.display = 'inline';
        } else {
            historyCount.style.display = 'none';
        }
    } catch (error) {
        console.error('Geçmiş sayısı yüklenemedi:', error);
    }
}

function getHistoryParams() {
    const search = document.getElementById('historySearch')?.value || '';
    const year = document.getElementById('historyYearFilter')?.value || '';
    const sort = document.getElementById('historySort')?.value || 'date_desc';
    const type = document.getElementById('historyTypeFilter')?.value || '';
    const amountMin = document.getElementById('historyAmountMin')?.value || '';
    const amountMax = document.getElementById('historyAmountMax')?.value || '';
    const dateFrom = document.getElementById('historyDateFrom')?.value || '';
    const dateTo = document.getElementById('historyDateTo')?.value || '';
    const pageSize = parseInt(document.getElementById('historyPageSize')?.value, 10) || 50;
    _historyPageSize = pageSize;
    const offset = (_historyPage - 1) * _historyPageSize;
    return { search, year, sort, type, amountMin, amountMax, dateFrom, dateTo, limit: _historyPageSize, offset };
}

async function loadHistory(resetPage = true) {
    const skeleton = document.getElementById('historyLoadingSkeleton');
    const listEl = document.getElementById('historyList');
    try {
        if (resetPage) _historyPage = 1;
        if (skeleton) skeleton.style.display = 'block';
        if (listEl) listEl.style.visibility = 'hidden';
        const params = getHistoryParams();
        const data = await historyApi.fetchHistory({
            limit: params.limit,
            offset: params.offset,
            sort: params.sort,
            year: params.year,
            search: params.search,
            type: params.type,
            amountMin: params.amountMin,
            amountMax: params.amountMax,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo
        });

        if (data.success) {
            renderHistory(data.history, params.sort);
            _historyTotal = data.total || 0;
            const countEl = document.getElementById('historyTotalCount');
            if (countEl) countEl.textContent = _historyTotal + ' kayıt';
            renderHistoryPagination();
            updateHistoryYearFilterOptions(data.history);
        }
    } catch (error) {
        showError('Geçmiş yüklenirken hata oluştu.');
    } finally {
        if (skeleton) skeleton.style.display = 'none';
        if (listEl) listEl.style.visibility = '';
        showLoading(false);
    }
}

function updateHistoryYearFilterOptions(history) {
    const sel = document.getElementById('historyYearFilter');
    if (!sel || sel.options.length > 1) return;
    const years = new Set();
    history.forEach(entry => {
        const parsed = parseDateFromFilename(entry.salesFileName) || parseDateFromFilename(entry.purchaseFileName);
        if (parsed) years.add(parsed.year);
        else {
            const d = new Date(entry.date);
            if (!isNaN(d.getTime())) years.add(d.getFullYear());
        }
    });
    const curYear = sel.querySelector('option[value=""]') ? 1 : 0;
    if (sel.options.length <= 1) {
        Array.from(years).sort((a, b) => b - a).forEach(y => {
            if (!sel.querySelector('option[value="' + y + '"]')) {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y;
                sel.appendChild(opt);
            }
        });
    }
}

function renderHistory(history, sortOrder) {
    const filtersEl = document.getElementById('historyFilters');
    clearHistorySelection();
    if (history.length === 0) {
        historyEmpty.style.display = 'block';
        historyList.innerHTML = '';
        clearHistoryBtn.style.display = 'none';
        const exportHistoryBtn = document.getElementById('exportHistoryBtn');
        if (exportHistoryBtn) exportHistoryBtn.style.display = 'none';
        const exportHistoryJsonBtn = document.getElementById('exportHistoryJsonBtn');
        if (exportHistoryJsonBtn) exportHistoryJsonBtn.style.display = 'none';
        if (filtersEl) filtersEl.style.display = 'none';
        const countEl = document.getElementById('historyTotalCount');
        if (countEl) countEl.textContent = '';
        return;
    }

    historyEmpty.style.display = 'none';
    if (filtersEl) filtersEl.style.display = 'flex';
    clearHistoryBtn.style.display = 'flex';
    const exportHistoryBtn = document.getElementById('exportHistoryBtn');
    if (exportHistoryBtn) exportHistoryBtn.style.display = 'inline-flex';
    const exportHistoryJsonBtn = document.getElementById('exportHistoryJsonBtn');
    if (exportHistoryJsonBtn) exportHistoryJsonBtn.style.display = 'inline-flex';
    const selectAllLabel = document.getElementById('historySelectAllLabel');
    if (selectAllLabel) selectAllLabel.style.display = 'inline-flex';

    let html = '';

    const grouped = groupHistoryByDate(history);
    _historyMonthSummaryData = buildHistoryMonthSummaryData(grouped);
    for (const [year, months] of Object.entries(grouped).sort((a, b) => b[0] - a[0])) {
        html += `<div class="history-year-group">
            <div class="history-year-header" onclick="toggleYearGroup(this)">
                <span class="year-toggle-icon">▶</span>
                <span class="year-label">${year}</span>
                <span class="year-count">${countYearEntries(months)} analiz</span>
            </div>
            <div class="history-year-content collapsed">`;
        for (const [monthKey, entries] of Object.entries(months).sort((a, b) => b[0] - a[0])) {
            html += renderHistoryMonthSummary(year, monthKey, entries);
        }
        html += `</div></div>`;
    }

    historyList.innerHTML = html;
}

// ========================================
// History Pagination
// ========================================
function renderHistoryPagination() {
    const bar = document.getElementById('historyPaginationBar');
    if (!bar) return;
    const totalPages = Math.max(1, Math.ceil(_historyTotal / _historyPageSize));
    const pageNumbersEl = document.getElementById('historyPageNumbers');
    const prevBtn = document.getElementById('historyPagePrev');
    const nextBtn = document.getElementById('historyPageNext');
    const infoEl = document.getElementById('historyPaginationInfo');

    if (_historyTotal === 0) {
        bar.style.display = 'none';
        return;
    }
    bar.style.display = 'flex';

    if (infoEl) {
        const start = Math.min((_historyPage - 1) * _historyPageSize + 1, _historyTotal);
        const end = Math.min(_historyPage * _historyPageSize, _historyTotal);
        infoEl.textContent = `${start}–${end} / ${_historyTotal} kayıt`;
    }

    prevBtn.disabled = _historyPage <= 1;
    nextBtn.disabled = _historyPage >= totalPages;

    if (!pageNumbersEl) return;
    let pagesHtml = '';
    const maxVisible = 7;
    let startPage = Math.max(1, _historyPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage + 1 < maxVisible) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        pagesHtml += `<button type="button" class="pagination-page-btn" onclick="historyGoToPage(1)">1</button>`;
        if (startPage > 2) pagesHtml += `<span class="pagination-ellipsis">...</span>`;
    }
    for (let i = startPage; i <= endPage; i++) {
        pagesHtml += `<button type="button" class="pagination-page-btn${i === _historyPage ? ' active' : ''}" onclick="historyGoToPage(${i})">${i}</button>`;
    }
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) pagesHtml += `<span class="pagination-ellipsis">...</span>`;
        pagesHtml += `<button type="button" class="pagination-page-btn" onclick="historyGoToPage(${totalPages})">${totalPages}</button>`;
    }

    pageNumbersEl.innerHTML = pagesHtml;
}

function historyGoToPage(page) {
    const totalPages = Math.max(1, Math.ceil(_historyTotal / _historyPageSize));
    if (page === 'prev') {
        if (_historyPage <= 1) return;
        _historyPage--;
    } else if (page === 'next') {
        if (_historyPage >= totalPages) return;
        _historyPage++;
    } else {
        _historyPage = Math.max(1, Math.min(totalPages, parseInt(page, 10) || 1));
    }
    loadHistory(false);
}

function buildHistoryMonthSummaryData(grouped) {
    const summaries = {};
    const monthRows = [];

    for (const [year, months] of Object.entries(grouped)) {
        for (const [monthKey, entries] of Object.entries(months)) {
            const monthId = `${year}-${String(monthKey).padStart(2, '0')}`;
            const summary = summarizeHistoryEntriesForMonth(monthId, entries);
            summaries[monthId] = summary;
            monthRows.push({
                month: monthId,
                salesVat: summary.salesTax,
                purchaseVat: summary.purchaseTax
            });
        }
    }

    if (window.VatLedger && window.VatLedger.calculateVatLedger) {
        const ledger = window.VatLedger.calculateVatLedger(monthRows);
        ledger.rows.forEach(row => {
            const summary = summaries[row.month];
            if (!summary) return;
            summary.payableKdv = row.payable;
            summary.devredenKdv = row.closingCredit;
        });
    } else {
        Object.values(summaries).forEach(summary => {
            const netTax = summary.salesTax - summary.purchaseTax;
            summary.payableKdv = Math.max(0, netTax);
            summary.devredenKdv = Math.max(0, -netTax);
        });
    }

    return summaries;
}

function summarizeHistoryEntriesForMonth(monthId, entries) {
    const customerTotals = {};
    const summary = entries.reduce((acc, entry) => {
        const salesAmount = entry.sales?.totalAmount || 0;
        const purchaseAmount = entry.purchase?.totalAmount || 0;
        const profitLoss = entry.profitLoss?.amount ?? (salesAmount - purchaseAmount);
        const salesTax = entry.sales?.totalTax || 0;
        const purchaseTax = entry.purchase?.totalTax || 0;

        acc.sales += salesAmount;
        acc.purchase += purchaseAmount;
        acc.profit += profitLoss;
        acc.salesTax += salesTax;
        acc.purchaseTax += purchaseTax;

        (entry.sales?.topProducts || []).forEach(item => {
            const name = item.name || 'Bilinmeyen';
            if (!customerTotals[name]) customerTotals[name] = { name, total: 0 };
            customerTotals[name].total += item.total || 0;
        });
        return acc;
    }, {
        monthId,
        entries,
        sales: 0,
        purchase: 0,
        profit: 0,
        salesTax: 0,
        purchaseTax: 0,
        payableKdv: 0,
        devredenKdv: 0
    });

    summary.topSalesCustomer = Object.values(customerTotals)
        .sort((a, b) => b.total - a.total)[0] || null;
    return summary;
}

function renderHistoryMonthSummary(year, monthKey, entries) {
    const monthId = `${year}-${String(monthKey).padStart(2, '0')}`;
    const summary = _historyMonthSummaryData[monthId] || summarizeHistoryEntriesForMonth(monthId, entries);
    const isProfit = summary.profit >= 0;
    const vatLabel = summary.payableKdv > 0 ? 'Ödenecek KDV' : 'Devreden KDV';
    const vatAmount = summary.payableKdv > 0 ? summary.payableKdv : summary.devredenKdv;

    return `<button type="button" class="history-month-summary ${isProfit ? 'profit' : 'loss'}" onclick="openHistoryMonthSummary('${monthId}')">
        <span class="month-label">${getMonthName(parseInt(monthKey, 10))}</span>
        <span class="history-month-summary-metric sales">${formatCurrency(summary.sales)}</span>
        <span class="history-month-summary-metric ${isProfit ? 'profit' : 'loss'}">${formatCurrency(Math.abs(summary.profit))}</span>
        <span class="history-month-summary-metric ${summary.payableKdv > 0 ? 'payable' : 'carryover'}">${vatLabel}: ${formatCurrency(vatAmount)}</span>
        <span class="month-count">${entries.length} analiz</span>
    </button>`;
}

function groupHistoryByDate(history) {
    const grouped = {};

    for (const entry of history) {
        let year, month;

        // Try to parse date from filenames first
        const filenameDate = parseDateFromFilename(entry.salesFileName) || parseDateFromFilename(entry.purchaseFileName);

        if (filenameDate) {
            year = filenameDate.year;
            month = filenameDate.month;
        } else {
            // Fallback to entry date
            const date = new Date(entry.date);
            year = date.getFullYear();
            month = date.getMonth() + 1;
        }

        if (!grouped[year]) grouped[year] = {};
        if (!grouped[year][month]) grouped[year][month] = [];

        grouped[year][month].push(entry);
    }

    return grouped;
}

function parseDateFromFilename(filename) {
    if (!filename) return null;

    // Normalize filename
    const name = filename.toLowerCase();

    // Month names mapping
    const months = {
        'ocak': 1, 'subat': 2, 'şubat': 2, 'mart': 3, 'nisan': 4, 'mayis': 5, 'mayıs': 5, 'haziran': 6,
        'temmuz': 7, 'agustos': 8, 'ağustos': 8, 'eylul': 9, 'eylül': 9, 'ekim': 10, 'kasim': 11, 'kasım': 11, 'aralik': 12, 'aralık': 12
    };

    // Regex patterns
    // 1. "Ocak 2024", "Ocak_2024", "Ocak2024"
    const monthYearRegex = new RegExp(`(${Object.keys(months).join('|')})[\\s_\\-]*(\\d{4})`, 'i');
    const match1 = name.match(monthYearRegex);
    if (match1) {
        return { year: parseInt(match1[2]), month: months[match1[1]] };
    }

    // 2. "2024 Ocak", "2024_Ocak"
    const yearMonthRegex = new RegExp(`(\\d{4})[\\s_\\-]*(${Object.keys(months).join('|')})`, 'i');
    const match2 = name.match(yearMonthRegex);
    if (match2) {
        return { year: parseInt(match2[1]), month: months[match2[2]] };
    }

    // 3. "2024-01", "2024_01", "2024.01"
    const digitRegex = /(\d{4})[\.\-\_](\d{1,2})/;
    const match3 = name.match(digitRegex);
    if (match3) {
        const m = parseInt(match3[2]);
        if (m >= 1 && m <= 12) return { year: parseInt(match3[1]), month: m };
    }

    return null;
}

function countYearEntries(months) {
    return Object.values(months).reduce((sum, entries) => sum + entries.length, 0);
}

function getMonthName(month) {
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    return months[month - 1];
}

function toggleYearGroup(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.year-toggle-icon');
    const isCollapsed = content.classList.toggle('collapsed');
    icon.textContent = isCollapsed ? '▶' : '▼';
}

function toggleMonthGroup(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.month-toggle-icon');
    const isCollapsed = content.classList.toggle('collapsed');
    icon.textContent = isCollapsed ? '▶' : '▼';
}

function renderHistoryCard(entry) {
    const salesAmount = entry.sales?.totalAmount || 0;
    const purchaseAmount = entry.purchase?.totalAmount || 0;
    const salesTax = entry.sales?.totalTax || 0;
    const purchaseTax = entry.purchase?.totalTax || 0;
    const netTax = salesTax - purchaseTax;
    const profitLoss = entry.profitLoss?.amount || (salesAmount - purchaseAmount);
    const isProfit = profitLoss >= 0;

    // KDV display info
    let kdvLabel, kdvClass;
    if (netTax > 0) {
        kdvLabel = 'Ödenecek KDV';
        kdvClass = 'payable';
    } else if (netTax < 0) {
        kdvLabel = 'Devreden KDV';
        kdvClass = 'carryover';
    } else {
        kdvLabel = 'Net KDV';
        kdvClass = 'neutral';
    }

    return `
        <div class="history-card ${isProfit ? 'profit' : 'loss'}" data-id="${entry.id}">
            <div class="history-card-select-row">
                <input type="checkbox" class="history-select-checkbox" data-id="${entry.id}" onchange="updateHistoryBatchBar()" aria-label="Seç">
            </div>
            <div class="history-card-header">
                <span class="history-date">${entry.displayDate}</span>
                <div class="history-files">
                    ${entry.salesFileName ? `<span class="history-file-tag">${escapeHtml(entry.salesFileName)}</span>` : ''}
                    ${entry.purchaseFileName ? `<span class="history-file-tag">${escapeHtml(entry.purchaseFileName)}</span>` : ''}
                </div>
            </div>
            <div class="history-card-body">
                <div class="history-stat">
                    <span class="history-stat-label">Satış</span>
                    <span class="history-stat-value sales">${formatCurrency(salesAmount)}</span>
                </div>
                <div class="history-stat">
                    <span class="history-stat-label">Alış</span>
                    <span class="history-stat-value purchase">${formatCurrency(purchaseAmount)}</span>
                </div>
                <div class="history-stat">
                    <span class="history-stat-label">${isProfit ? 'Kâr' : 'Zarar'}</span>
                    <span class="history-stat-value ${isProfit ? 'profit' : 'loss'}">${formatCurrency(Math.abs(profitLoss))}</span>
                </div>
            </div>
            <div class="history-kdv-row">
                <div class="kdv-mini-item">
                    <span class="kdv-mini-label">Satış KDV</span>
                    <span class="kdv-mini-value sales">${formatCurrency(salesTax)}</span>
                </div>
                <div class="kdv-mini-item">
                    <span class="kdv-mini-label">Alış KDV</span>
                    <span class="kdv-mini-value purchase">${formatCurrency(purchaseTax)}</span>
                </div>
                <div class="kdv-mini-item ${kdvClass}">
                    <span class="kdv-mini-label">${kdvLabel}</span>
                    <span class="kdv-mini-value">${formatCurrency(Math.abs(netTax))}</span>
                </div>
            </div>
            <div class="history-card-footer">
                <span class="history-summary">${escapeHtml(entry.summary || '')}</span>
                <div class="history-actions">
                    <button class="history-action-btn view" onclick="viewHistoryEntry('${entry.id}')">Görüntüle</button>
                    <button class="history-action-btn" onclick="openHistoryEditModal(entry)" title="Düzenle">Düzenle</button>
                    <button class="history-action-btn delete" onclick="deleteHistoryEntry('${entry.id}')">Sil</button>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// Batch Selection & Edit Functions
// ========================================
let selectedHistoryIds = new Set();

function updateHistoryBatchBar() {
    const checkboxes = document.querySelectorAll('.history-select-checkbox:checked');
    selectedHistoryIds = new Set(Array.from(checkboxes).map(cb => cb.dataset.id));
    const bar = document.getElementById('historyBatchBar');
    const count = document.getElementById('historyBatchCount');
    const selectAllLabel = document.getElementById('historySelectAllLabel');
    if (!bar || !count) return;
    if (selectedHistoryIds.size > 0) {
        bar.style.display = 'flex';
        count.textContent = selectedHistoryIds.size + ' seçili';
    } else {
        bar.style.display = 'none';
    }
}

function toggleHistorySelectAll() {
    const selectAll = document.getElementById('historySelectAll');
    const checkboxes = document.querySelectorAll('.history-select-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    updateHistoryBatchBar();
}

function clearHistorySelection() {
    document.querySelectorAll('.history-select-checkbox').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('historySelectAll');
    if (selectAll) selectAll.checked = false;
    selectedHistoryIds.clear();
    const bar = document.getElementById('historyBatchBar');
    if (bar) bar.style.display = 'none';
    const label = document.getElementById('historySelectAllLabel');
    if (label) label.style.display = 'none';
}

async function batchDeleteHistory() {
    if (selectedHistoryIds.size === 0) return;
    if (!(await showConfirm({ message: selectedHistoryIds.size + ' kaydı silmek istediğinize emin misiniz? Bu işlem geri alınamaz.', danger: true, confirmText: 'Sil' }))) return;
    try {
        const res = await fetch('/api/history/batch-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedHistoryIds) })
        });
        const data = await res.json();
        if (data.success) {
            showSuccessToast(data.deleted + ' kayıt silindi.');
            clearHistorySelection();
            loadHistory();
            loadTrashCount();
        } else {
            showError(data.error || 'Silme hatası');
        }
    } catch (e) {
        showError('Silme sırasında hata oluştu.');
    }
}

async function batchExportHistoryExcel() {
    if (selectedHistoryIds.size === 0) return;
    try {
        const res = await fetch('/api/export/history/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedHistoryIds) })
        });
        if (!res.ok) {
            const err = await res.json();
            showError(err.error || 'Export hatası');
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analizcim-secilen-kayitlar.xlsx';
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        showError('Export sırasında hata oluştu.');
    }
}

function openHistoryEditModal(entry) {
    document.getElementById('editHistoryId').value = entry.id;
    document.getElementById('editDisplayDate').value = entry.displayDate || '';
    document.getElementById('editSalesAmount').value = entry.sales?.totalAmount || 0;
    document.getElementById('editSalesTax').value = entry.sales?.totalTax || 0;
    document.getElementById('editPurchaseAmount').value = entry.purchase?.totalAmount || 0;
    document.getElementById('editPurchaseTax').value = entry.purchase?.totalTax || 0;
    document.getElementById('editSummary').value = entry.summary || '';
    document.getElementById('historyEditModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeHistoryEditModal() {
    document.getElementById('historyEditModal').style.display = 'none';
    document.body.style.overflow = '';
}

async function saveHistoryEdit() {
    const id = document.getElementById('editHistoryId').value;
    const data = {
        displayDate: document.getElementById('editDisplayDate').value,
        sales: {
            totalAmount: parseFloat(document.getElementById('editSalesAmount').value) || 0,
            totalTax: parseFloat(document.getElementById('editSalesTax').value) || 0
        },
        purchase: {
            totalAmount: parseFloat(document.getElementById('editPurchaseAmount').value) || 0,
            totalTax: parseFloat(document.getElementById('editPurchaseTax').value) || 0
        },
        summary: document.getElementById('editSummary').value
    };
    try {
        const res = await fetch('/api/history/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            showSuccessToast('Kayıt güncellendi.');
            closeHistoryEditModal();
            loadHistory();
        } else {
            showError(result.error || 'Güncelleme hatası');
        }
    } catch (e) {
        showError('Güncelleme sırasında hata oluştu.');
    }
}

// ========================================
// Trash (Çöp Kutusu) Functions
// ========================================
let _trashMode = false;
let _selectedTrashIds = new Set();

window.loadTrashCount = async function () {
    try {
        const res = await fetch('/api/trash/count');
        const data = await res.json();
        const badge = document.getElementById('trashBadge');
        const toggle = document.getElementById('historyTrashToggle');
        if (data.success && data.count > 0) {
            badge.textContent = data.count;
            badge.style.display = 'inline-flex';
            toggle.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
            if (data.success && data.count === 0) {
                toggle.style.display = 'inline-flex';
            }
        }
    } catch (e) {
        console.error('Trash count error:', e);
    }
};

window.toggleTrashMode = function () {
    _trashMode = !_trashMode;
    document.getElementById('historySection').style.display = _trashMode ? 'none' : 'block';
    document.getElementById('trashSection').style.display = _trashMode ? 'block' : 'none';
    document.getElementById('historyTrashToggle').classList.toggle('active', _trashMode);
    if (_trashMode) {
        loadTrash();
    } else {
        loadHistory();
    }
};

window.backToHistory = function () {
    _trashMode = false;
    document.getElementById('historySection').style.display = 'block';
    document.getElementById('trashSection').style.display = 'none';
    document.getElementById('historyTrashToggle').classList.remove('active');
    loadHistory();
};

window.loadTrash = async function () {
    const list = document.getElementById('trashList');
    const empty = document.getElementById('trashEmpty');
    const selectAllLabel = document.getElementById('trashSelectAllLabel');
    try {
        const res = await fetch('/api/trash');
        const data = await res.json();
        if (!data.success) {
            list.innerHTML = '<p class="history-error">Çöp kutusu yüklenemedi.</p>';
            return;
        }
        if (data.trash.length === 0) {
            list.innerHTML = '';
            empty.style.display = 'flex';
            selectAllLabel.style.display = 'none';
            return;
        }
        empty.style.display = 'none';
        selectAllLabel.style.display = 'block';
        let html = '';
        data.trash.forEach(entry => {
            const safeId = entry.id.replace(/['"]/g, '');
            const displayDate = entry.displayDate || new Date(entry.date).toLocaleDateString('tr-TR');
            const delDate = entry.deletedAt ? new Date(entry.deletedAt + 'Z').toLocaleDateString('tr-TR') : 'Bilinmiyor';
            const fn = entry.salesFileName || entry.purchaseFileName || 'Analiz kaydı';
            const isChecked = _selectedTrashIds.has(entry.id) ? 'checked' : '';
            html += `
                <div class="history-card trash-card">
                    <label class="history-select-checkbox-wrap">
                        <input type="checkbox" class="history-select-checkbox trash-select-checkbox" data-id="${safeId}" ${isChecked} onchange="updateTrashBatchBar()">
                    </label>
                    <div class="history-card-header">
                        <span class="history-card-date">${displayDate}</span>
                        <span class="history-card-filename">${fn}</span>
                    </div>
                    <div class="history-card-deleted-info">
                        <span class="trash-deleted-label">Silinme: ${delDate}</span>
                    </div>
                    <div class="history-card-footer">
                        <div class="history-actions">
                            <button class="history-action-btn trash-restore-btn" onclick="restoreTrashEntry('${safeId}')">Geri Al</button>
                            <button class="history-action-btn delete trash-permanent-delete" onclick="permanentlyDeleteTrash('${safeId}')">Kalıcı Sil</button>
                        </div>
                    </div>
                </div>`;
        });
        list.innerHTML = html;
    } catch (e) {
        list.innerHTML = '<p class="history-error">Çöp kutusu yüklenirken hata oluştu.</p>';
    }
};

window.restoreTrashEntry = async function (id) {
    try {
        const res = await fetch('/api/trash/' + id + '/restore', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            _selectedTrashIds.delete(id);
            showSuccessToast('Kayıt geri alındı.');
            loadTrash();
            loadTrashCount();
            loadHistory();
        } else {
            showError(data.error || 'Geri alma hatası');
        }
    } catch (e) {
        showError('Geri alınırken hata oluştu.');
    }
};

window.permanentlyDeleteTrash = async function (id) {
    if (!(await showConfirm({ message: 'Bu kaydı kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.', danger: true, confirmText: 'Kalıcı Sil' }))) return;
    try {
        const res = await fetch('/api/trash/' + id, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            _selectedTrashIds.delete(id);
            showSuccessToast('Kayıt kalıcı olarak silindi.');
            loadTrash();
            loadTrashCount();
        } else {
            showError(data.error || 'Silme hatası');
        }
    } catch (e) {
        showError('Silinirken hata oluştu.');
    }
};

window.emptyTrash = async function () {
    if (!(await showConfirm({ message: 'Çöp kutusundaki tüm kayıtları kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.', danger: true, confirmText: 'Kalıcı Sil' }))) return;
    try {
        const res = await fetch('/api/trash', { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            _selectedTrashIds.clear();
            showSuccessToast('Çöp kutusu temizlendi.');
            loadTrash();
            loadTrashCount();
            updateTrashBatchBar();
        } else {
            showError(data.error || 'Temizleme hatası');
        }
    } catch (e) {
        showError('Temizlenirken hata oluştu.');
    }
};

function updateTrashBatchBar() {
    const checkboxes = document.querySelectorAll('.trash-select-checkbox:checked');
    _selectedTrashIds = new Set(Array.from(checkboxes).map(cb => cb.dataset.id));
    const bar = document.getElementById('trashBatchBar');
    const count = document.getElementById('trashBatchCount');
    if (!bar || !count) return;
    if (_selectedTrashIds.size > 0) {
        bar.style.display = 'flex';
        count.textContent = _selectedTrashIds.size + ' seçili';
    } else {
        bar.style.display = 'none';
    }
}

function toggleTrashSelectAll() {
    const selectAll = document.getElementById('trashSelectAll');
    const checkboxes = document.querySelectorAll('.trash-select-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAll.checked);
    updateTrashBatchBar();
}

function clearTrashSelection() {
    document.querySelectorAll('.trash-select-checkbox').forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('trashSelectAll');
    if (selectAll) selectAll.checked = false;
    _selectedTrashIds.clear();
    const bar = document.getElementById('trashBatchBar');
    if (bar) bar.style.display = 'none';
}

window.batchRestoreTrash = async function () {
    if (_selectedTrashIds.size === 0) return;
    if (!(await showConfirm({ message: _selectedTrashIds.size + ' kaydı geri almak istediğinize emin misiniz?', confirmText: 'Geri Al' }))) return;
    try {
        const res = await fetch('/api/trash/batch-restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(_selectedTrashIds) })
        });
        const data = await res.json();
        if (data.success) {
            showSuccessToast(data.restored + ' kayıt geri alındı.');
            clearTrashSelection();
            loadTrash();
            loadTrashCount();
            loadHistory();
        } else {
            showError(data.error || 'Geri alma hatası');
        }
    } catch (e) {
        showError('Geri alma sırasında hata oluştu.');
    }
};

window.batchPermanentDeleteTrash = async function () {
    if (_selectedTrashIds.size === 0) return;
    if (!(await showConfirm({ message: _selectedTrashIds.size + ' kaydı kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.', danger: true, confirmText: 'Kalıcı Sil' }))) return;
    try {
        const res = await fetch('/api/trash/batch-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(_selectedTrashIds) })
        });
        const data = await res.json();
        if (data.success) {
            showSuccessToast(data.deleted + ' kayıt kalıcı olarak silindi.');
            clearTrashSelection();
            loadTrash();
            loadTrashCount();
        } else {
            showError(data.error || 'Silme hatası');
        }
    } catch (e) {
        showError('Silme sırasında hata oluştu.');
    }
};

async function exportDashboardPdf() {
    const year = document.getElementById('yearSelect')?.value || new Date().getFullYear();
    try {
        showLoading(true, 'PDF hazırlanıyor...');
        const res = await fetch('/api/export/pdf-dashboard/' + year);
        if (!res.ok) {
            const err = await res.json();
            showError(err.error || 'PDF oluşturma hatası');
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analizcim-dashboard-' + year + '.pdf';
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        showError('PDF oluşturulurken hata oluştu.');
    } finally {
        showLoading(false);
    }
}

// ========================================
// Expenses (Gider) Functions - localStorage Sabit/Değişken
// ========================================
const EXPENSES_LOCAL_PREFIX = 'expenses:';

function getExpensesLocalKey(year, month) {
    const m = (month === 'all' || month === '' || month == null) ? 'all' : String(parseInt(month, 10)).padStart(2, '0');
    return EXPENSES_LOCAL_PREFIX + (year || '') + ':' + m;
}

async function getExpensesLocalData(year, month) {
    try {
        const params = new URLSearchParams();
        if (year != null && year !== '') params.set('year', year);
        if (month != null && month !== '') params.set('month', month);
        const response = await fetch('/api/expenses-local?' + params.toString());
        if (!response.ok) throw new Error('fetch failed');
        const result = await response.json();
        if (result.success && result.data) {
            return {
                fixed: Array.isArray(result.data.fixed) ? result.data.fixed : [],
                variable: Array.isArray(result.data.variable) ? result.data.variable : []
            };
        }
    } catch (_) { }
    try {
        const key = getExpensesLocalKey(year, month);
        const raw = localStorage.getItem(key);
        if (raw) {
            const data = JSON.parse(raw);
            return {
                fixed: Array.isArray(data.fixed) ? data.fixed : [],
                variable: Array.isArray(data.variable) ? data.variable : []
            };
        }
    } catch (_) { }
    return { fixed: [], variable: [] };
}

async function setExpensesLocalData(year, month, data) {
    try {
        await fetch('/api/expenses-local', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                year,
                month: month === 'all' || month == null ? 'all' : month,
                fixed: data.fixed || [],
                variable: data.variable || []
            })
        });
    } catch (_) { }
}

function getGrossProfitForPeriod(year, month) {
    const monthly = _dashboardMonthlyAll || [];
    if (!year) return 0;
    const yearNum = parseInt(year, 10);
    if (month === 'all' || month === '' || month == null) {
        return monthly
            .filter(m => extractYearFromMonth(m.month) === yearNum)
            .reduce((s, m) => s + (m.gross_profit ?? m.grossProfit ?? 0), 0);
    }
    const monthStr = year + '-' + String(parseInt(month, 10)).padStart(2, '0');
    const m = monthly.find(x => (x.month || '') === monthStr);
    return m ? (m.gross_profit ?? m.grossProfit ?? 0) : 0;
}

// ========================================
// Top N Functions
// ========================================
// Yılları yükle veya yenile
async function loadTopNYears() {
    const yearSelect = document.getElementById('topnYear');
    if (!yearSelect) return;

    try {
        const res = await fetch('/api/years');
        const data = await res.json();
        if (data.success && data.years) {
            // Save currently selected year
            const currentYear = yearSelect.value;
            
            // Clear existing options
            yearSelect.innerHTML = '';
            
            // Add years
            data.years.forEach(y => {
                const opt = document.createElement('option');
                opt.value = y;
                opt.textContent = y;
                yearSelect.appendChild(opt);
            });
            
            // Restore selected year if it still exists, otherwise select first year
            if (currentYear && data.years.includes(currentYear)) {
                yearSelect.value = currentYear;
            } else if (data.years.length > 0) {
                yearSelect.value = data.years[0];
            }
        }
    } catch (e) {
        console.error('Yıllar yüklenemedi:', e);
    }
}

// Sadece verileri yükle (yıl değiştiğinde çağrılır)
async function loadTopNData() {
    const yearSelect = document.getElementById('topnYear');
    const customersList = document.getElementById('topnCustomersList');
    const productsList = document.getElementById('topnProductsList');
    
    const limit = 100;
    const year = yearSelect?.value || '';

    // Show loading state
    if (customersList) customersList.innerHTML = '<div class="loading-skeleton"><div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div></div>';
    if (productsList) productsList.innerHTML = '<div class="loading-skeleton"><div class="skeleton-row"></div><div class="skeleton-row"></div><div class="skeleton-row"></div></div>';

    try {
        // Load top customers (SATIŞ - firmalar için)
        const customersQs = new URLSearchParams({ type: 'sales', limit });
        if (year) customersQs.append('year', year);
        const customersRes = await fetch(`/api/analysis/top-customers?${customersQs}`);
        const customersData = await customersRes.json();

        if (customersData.success) {
            renderTopNList(customersList, customersData.data, 'customer');
            
            const totalAmount = customersData.data.reduce((sum, item) => sum + item.total, 0);
            const totalQuantity = customersData.data.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const itemCount = totalQuantity > 0 ? totalQuantity : customersData.data.length;
            const avgOrderSize = itemCount > 0 ? totalAmount / itemCount : 0;
            
            const avgOrderEl = document.getElementById('topnAvgOrderSize');
            if (avgOrderEl) {
                avgOrderEl.textContent = `Ortalama İşlem: ${formatCurrencyTRY(avgOrderSize)}`;
                avgOrderEl.parentElement.style.display = 'flex';
            }
            
            const top5 = customersData.data.slice(0, 5);
            const top5Percentage = top5.reduce((sum, item) => sum + parseFloat(item.percentage || 0), 0);
            
            const paretoSummary = document.getElementById('paretoSummary');
            const paretoProgressBar = document.getElementById('paretoProgressBar');
            const topnAnalysisContainer = document.getElementById('topnAnalysisContainer');
            
            if (paretoSummary && paretoProgressBar && topnAnalysisContainer) {
                paretoSummary.textContent = `İlk 5 firma toplam cironun %${top5Percentage.toFixed(1)}'ini oluşturuyor`;
                paretoProgressBar.style.width = `${Math.min(top5Percentage, 100)}%`;
                topnAnalysisContainer.style.display = 'grid';
                
                renderParetoChart(customersData.data);
            }
        } else {
            if (customersList) customersList.innerHTML = '<p class="no-data">Veri yüklenemedi</p>';
            const topnAnalysisContainer = document.getElementById('topnAnalysisContainer');
            if (topnAnalysisContainer) topnAnalysisContainer.style.display = 'none';
            const avgOrderEl = document.getElementById('topnAvgOrderSize');
            if (avgOrderEl) avgOrderEl.parentElement.style.display = 'none';
        }

        // Load top products as SUPPLIERS (ALIŞ - tedarikçiler için)
        const productsQs = new URLSearchParams({ type: 'purchase', limit });
        if (year) productsQs.append('year', year);
        const productsRes = await fetch(`/api/analysis/top-products?${productsQs}`);
        const productsData = await productsRes.json();

        if (productsData.success) {
            renderTopNList(productsList, productsData.data, 'product');
        } else {
            if (productsList) productsList.innerHTML = '<p class="no-data">Veri yüklenemedi</p>';
        }
    } catch (error) {
        console.error('Top N yükleme hatası:', error);
        if (customersList) customersList.innerHTML = '<p class="no-data">Hata oluştu</p>';
        if (productsList) productsList.innerHTML = '<p class="no-data">Hata oluştu</p>';
        const topnAnalysisContainer = document.getElementById('topnAnalysisContainer');
        if (topnAnalysisContainer) topnAnalysisContainer.style.display = 'none';
        const avgOrderEl = document.getElementById('topnAvgOrderSize');
        if (avgOrderEl) avgOrderEl.parentElement.style.display = 'none';
    }
}

// Hem yılları hem verileri yükle (ilk yükleme için)
async function loadTopN() {
    await loadTopNYears();
    await loadTopNData();
}

function renderTopNList(container, data, listType) {
    if (!container) return;

    if (!data || data.length === 0) {
        container.innerHTML = '<p class="no-data">Henüz veri bulunmuyor</p>';
        return;
    }

    // Yıla göre grupla
    const groupedByYear = {};
    data.forEach(item => {
        const year = item.year || 'Bilinmeyen';
        if (!groupedByYear[year]) {
            groupedByYear[year] = [];
        }
        groupedByYear[year].push(item);
    });

    // Yılları sırala (en son yıl önce)
    const years = Object.keys(groupedByYear).sort((a, b) => b - a);

    let html = '';

    years.forEach(year => {
        const yearData = groupedByYear[year];
        // Toplam tutara göre büyükten küçüğe sırala
        const sortedData = [...yearData].sort((a, b) => (b.total || 0) - (a.total || 0));

        html += `<div class="topn-year-group"><h4 class="year-header">${year}</h4>`;
        html += '<table class="topn-table"><thead><tr>';
        if (listType === 'customer') {
            html += '<th>#</th><th>Firma</th><th>Toplam Tutar</th>';
        } else {
            html += '<th>#</th><th>Tedarikçi</th><th>Toplam Tutar</th>';
        }
        html += '</tr></thead><tbody>';

        sortedData.forEach((item, index) => {
            const formattedTotal = formatCurrencyTRY(item.total);
            const safeName = escapeHtml(item.name);
            const safeNameTitle = escapeAttribute(item.name);
            html += `
                <tr class="topn-item-row" data-name="${safeNameTitle}" data-type="${listType}">
                    <td class="rank-cell">${index + 1}</td>
                    <td class="name-cell" title="${safeNameTitle}">${safeName}</td>
                    <td class="amount-cell">${formattedTotal}</td>
                </tr>
            `;
        });

        html += '</tbody></table></div>';
    });

    container.innerHTML = html;
    
    const rows = container.querySelectorAll('.topn-item-row');
    rows.forEach(row => {
        row.addEventListener('click', () => {
            container.querySelectorAll('.topn-item-row').forEach(r => r.classList.remove('active-row'));
            row.classList.add('active-row');
            
            const name = row.getAttribute('data-name');
            const type = row.getAttribute('data-type');
            showTopNTrend(name, type);
        });
    });
}

function renderParetoChart(data) {
    const ctx = document.getElementById('topnParetoChart');
    if (!ctx) return;

    if (window._topnParetoChartInstance) {
        window._topnParetoChartInstance.destroy();
    }

    const labels = data.map(item => item.name);
    const amounts = data.map(item => item.total);
    
    let cumulative = 0;
    const cumulativePercentages = data.map(item => {
        cumulative += parseFloat(item.percentage || 0);
        return cumulative;
    });

    window._topnParetoChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Kümülatif %',
                    data: cumulativePercentages,
                    type: 'line',
                    yAxisID: 'y1',
borderColor: '#7c3aed',
                backgroundColor: '#7c3aed',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false
                },
                {
                    label: 'Tutar',
                    data: amounts,
                    yAxisID: 'y',
                    backgroundColor: '#1d4ed8',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return `Kümülatif: %${context.raw.toFixed(1)}`;
                            }
                            return `Tutar: ${formatCurrencyTRY(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    ticks: {
                        callback: function(value) {
                            return new Intl.NumberFormat('tr-TR', { notation: 'compact' }).format(value);
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    min: 0,
                    max: 100,
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        callback: function(value) {
                            return `%${value}`;
                        }
                    }
                }
            }
        }
    });
}

async function showTopNTrend(name, type) {
    const trendCard = document.getElementById('topnTrendCard');
    const trendTitle = document.getElementById('topnTrendTitle');
    
    if (!trendCard || !trendTitle) return;
    
    trendTitle.textContent = `${name} - Aylık Trend`;
    trendCard.style.display = 'block';
    
    try {
        const yearSelect = document.getElementById('topnYear');
        const year = yearSelect?.value || '';
        
        let url = '/api/history?limit=1000&sort=date_asc';
        if (year && year !== 'all') {
            url += `&year=${year}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (!data.success || !data.history) return;
        
        const monthlyData = {};
        
        data.history.forEach(entry => {
            const parsed = parseDateFromFilename(entry.salesFileName) || parseDateFromFilename(entry.purchaseFileName);
            const key = parsed ? `${parsed.year}-${String(parsed.month).padStart(2, '0')}` : (entry.date ? new Date(entry.date).toISOString().slice(0, 7) : null);
            
            if (!key) return;
            
            let amount = 0;
            const jsonObj = type === 'customer' ? entry.sales : entry.purchase;
            
            if (jsonObj && jsonObj.topProducts) {
                const product = jsonObj.topProducts.find(p => p.name === name);
                if (product) {
                    amount = product.total;
                }
            }
            
            monthlyData[key] = (monthlyData[key] || 0) + amount;
        });
        
        const sortedKeys = Object.keys(monthlyData).sort();
        const labels = sortedKeys;
        const amounts = sortedKeys.map(k => monthlyData[k]);
        
        renderTopNTrendChart(labels, amounts, type);
        
    } catch (error) {
        console.error('Trend yükleme hatası:', error);
    }
}

function renderTopNTrendChart(labels, amounts, type) {
    const ctx = document.getElementById('topnTrendChart');
    if (!ctx) return;

    if (window._topnTrendChartInstance) {
        window._topnTrendChartInstance.destroy();
    }

    const color = type === 'customer' ? '#1d4ed8' : '#7c3aed';

    window._topnTrendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tutar',
                data: amounts,
                borderColor: color,
                backgroundColor: color + '33',
                borderWidth: 2,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: color,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Tutar: ${formatCurrencyTRY(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return new Intl.NumberFormat('tr-TR', { notation: 'compact' }).format(value);
                        }
                    }
                }
            }
        }
    });
}

function formatCurrencyTRY(amount) {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency: 'TRY',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeAttribute(text) {
    return escapeHtml(text).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function loadExpensesLocal() {
    const yearSel = document.getElementById('expenseLocalYear');
    const monthSel = document.getElementById('expenseLocalMonth');
    // Yılları API'den al (expense_items + analyses + mevcut yıl)
    let years = [];
    try {
        const yRes = await fetch('/api/expenses-local/years');
        const yData = await yRes.json();
        if (yData.success && Array.isArray(yData.years)) years = yData.years;
    } catch (_) { }
    if (years.length === 0) {
        const currentYear = new Date().getFullYear();
        years = [currentYear, currentYear - 1, currentYear - 2];
    }
    if (yearSel) {
        const prev = yearSel.value;
        yearSel.innerHTML = '<option value="">Yıl seçin</option>' + years.map(y => '<option value="' + y + '">' + y + '</option>').join('');
        const dashYear = document.getElementById('yearSelect') ? document.getElementById('yearSelect').value : '';
        if (dashYear && years.indexOf(parseInt(dashYear, 10)) !== -1) yearSel.value = dashYear;
        else if (prev && years.indexOf(parseInt(prev, 10)) !== -1) yearSel.value = prev;
        else if (years.length) yearSel.value = String(years[0]);
    }
    const year = yearSel ? yearSel.value : '';
    const month = monthSel ? monthSel.value : 'all';
    let data = await getExpensesLocalData(year, month);
    const isEmpty = (data.fixed || []).length === 0 && (data.variable || []).length === 0;
    if (isEmpty && typeof localStorage !== 'undefined') {
        const migrateItems = [];
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(EXPENSES_LOCAL_PREFIX)) {
                const rest = key.slice(EXPENSES_LOCAL_PREFIX.length);
                const parts = rest.split(':');
                if (parts.length >= 2) {
                    const y = parts[0];
                    const m = parts[1] || 'all';
                    try {
                        const raw = localStorage.getItem(key);
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            migrateItems.push({ year: y, month: m, data: { fixed: parsed.fixed || [], variable: parsed.variable || [] } });
                            keysToRemove.push(key);
                        }
                    } catch (_) { }
                }
            }
        }
        if (migrateItems.length > 0) {
            try {
                await fetch('/api/expenses-local/migrate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: migrateItems })
                });
                data = await getExpensesLocalData(year, month);
                keysToRemove.forEach(k => { try { localStorage.removeItem(k); } catch (_) { } });
            } catch (_) { }
        }
    }
    renderExpensesLocalSection('fixed', data.fixed);
    renderExpensesLocalSection('variable', data.variable);
    await updateExpensesLocalSummary();
    bindExpensesLocalEvents();
}

function _formatAmountDisplay(val) {
    const n = Number(val) || 0;
    if (n === 0) return '';
    return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
}

function _parseAmountInput(str) {
    if (!str) return 0;
    // Türk formatından parse: "12.500,50" -> 12500.50
    let s = String(str).replace(/[^\d.,\-]/g, '');
    // Binlik noktalarını kaldır, virgülü noktaya çevir
    s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s) || 0;
}

function renderExpensesLocalSection(sectionType, items) {
    const rowsId = sectionType === 'fixed' ? 'expenseFixedRows' : 'expenseVariableRows';
    const subtotalId = sectionType === 'fixed' ? 'expenseFixedSubtotal' : 'expenseVariableSubtotal';
    const container = document.getElementById(rowsId);
    const subtotalEl = document.getElementById(subtotalId);
    if (!container) return;
    let total = 0;
    let html = '';
    (items || []).forEach(item => {
        const id = item.id || 'id' + Date.now();
        const labelRaw = escapeHtml(String(item.label || '').slice(0, 200));
        const amount = Number(item.amount) || 0;
        const dateVal = item.date || '';
        total += amount;
        html += '<div class="expense-local-row" data-id="' + escapeHtml(String(id)) + '" data-section="' + sectionType + '">' +
            '<input type="text" class="expense-local-label" placeholder="Kalem adı" value="' + labelRaw + '" aria-label="Kalem">' +
            '<input type="date" class="expense-local-date" value="' + escapeHtml(dateVal) + '" aria-label="Tarih">' +
            '<div class="expense-amount-wrapper">' +
            '<span class="expense-amount-prefix">₺</span>' +
            '<input type="text" class="expense-local-amount" inputmode="decimal" value="' + _formatAmountDisplay(amount) + '" placeholder="0" aria-label="Tutar">' +
            '</div>' +
            '<button type="button" class="expense-local-delete" title="Sil">Sil</button></div>';
    });
    container.innerHTML = html;
    if (subtotalEl) subtotalEl.textContent = formatCurrency(total);
}

function getExpenseMonthLabel(month) {
    const labels = {
        all: 'Tüm yıl',
        '1': 'Ocak',
        '2': 'Şubat',
        '3': 'Mart',
        '4': 'Nisan',
        '5': 'Mayıs',
        '6': 'Haziran',
        '7': 'Temmuz',
        '8': 'Ağustos',
        '9': 'Eylül',
        '10': 'Ekim',
        '11': 'Kasım',
        '12': 'Aralık'
    };
    return labels[String(month)] || 'Tüm yıl';
}

function updateExpensePeriodSummary(year, month, fixedTotal, variableTotal) {
    const labelEl = document.getElementById('expensePeriodLabel');
    const fixedEl = document.getElementById('expensePeriodFixedTotal');
    const variableEl = document.getElementById('expensePeriodVariableTotal');
    const combinedEl = document.getElementById('expensePeriodCombinedTotal');

    if (labelEl) labelEl.textContent = (year || '-') + ' · ' + getExpenseMonthLabel(month);
    if (fixedEl) fixedEl.textContent = formatCurrency(fixedTotal);
    if (variableEl) variableEl.textContent = formatCurrency(variableTotal);
    if (combinedEl) combinedEl.textContent = formatCurrency(fixedTotal + variableTotal);
}

async function updateExpensesLocalSummary() {
    const year = document.getElementById('expenseLocalYear') ? document.getElementById('expenseLocalYear').value : '';
    const month = document.getElementById('expenseLocalMonth') ? document.getElementById('expenseLocalMonth').value : 'all';
    const data = await getExpensesLocalData(year, month);
    const fixedTotal = (data.fixed || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const variableTotal = (data.variable || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
    updateExpensePeriodSummary(year, month, fixedTotal, variableTotal);
    const gross = getGrossProfitForPeriod(year, month);
    const net = gross - fixedTotal - variableTotal;
    const grossEl = document.getElementById('expenseSummaryGross');
    const fixedEl = document.getElementById('expenseSummaryFixed');
    const variableEl = document.getElementById('expenseSummaryVariable');
    const netEl = document.getElementById('expenseSummaryNet');
    if (grossEl) grossEl.textContent = formatCurrency(gross);
    if (fixedEl) fixedEl.textContent = formatCurrency(fixedTotal);
    if (variableEl) variableEl.textContent = formatCurrency(variableTotal);
    if (netEl) {
        netEl.textContent = formatCurrency(Math.abs(net));
        // Update net card class (loss/profit)
        const netCard = netEl.closest('.expenses-summary-card');
        if (netCard) netCard.classList.toggle('loss', net < 0);
        // Update net icon
        const netIcon = document.getElementById('expenseNetIcon');
        if (netIcon) netIcon.textContent = net < 0 ? 'NZ' : 'NK';
        // Update net label
        const netLabel = document.getElementById('expenseNetLabel');
        if (netLabel) netLabel.textContent = net < 0 ? 'Net Zarar' : 'Net Kâr';
    }
    // Render Pie Chart
    renderExpensesPieChart(fixedTotal, variableTotal);
}

function renderExpensesPieChart(fixedTotal, variableTotal) {
    const canvas = document.getElementById('expensesPieChart');
    const emptyEl = document.getElementById('expensesChartEmpty');
    if (!canvas) return;
    const hasData = fixedTotal > 0 || variableTotal > 0;
    if (emptyEl) emptyEl.style.display = hasData ? 'none' : 'flex';
    canvas.style.display = hasData ? 'block' : 'none';
    if (!hasData) {
        if (_expensesPieChartInstance) { _expensesPieChartInstance.destroy(); _expensesPieChartInstance = null; }
        return;
    }
    const ctx = canvas.getContext('2d');
    if (_expensesPieChartInstance) _expensesPieChartInstance.destroy();
    _expensesPieChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Sabit Giderler', 'Değişken Giderler'],
            datasets: [{
                data: [fixedTotal, variableTotal],
                backgroundColor: ['#d97706', '#1d4ed8'],
                borderColor: ['#b45309', '#1e40af'],
                borderWidth: 2,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '55%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 16,
                        usePointStyle: true,
                        pointStyleWidth: 10,
                        font: { size: 12 },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#888'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            const total = fixedTotal + variableTotal;
                            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                            return ctx.label + ': ' + formatCurrency(ctx.parsed) + ' (%' + pct + ')';
                        }
                    }
                }
            },
            animation: { animateRotate: true, animateScale: true }
        }
    });
}

function buildExpensesDataFromDOM() {
    const year = document.getElementById('expenseLocalYear') ? document.getElementById('expenseLocalYear').value : '';
    const month = document.getElementById('expenseLocalMonth') ? document.getElementById('expenseLocalMonth').value : 'all';
    const fixed = [];
    const variable = [];
    const fixedContainer = document.getElementById('expenseFixedRows');
    const variableContainer = document.getElementById('expenseVariableRows');
    if (fixedContainer) {
        fixedContainer.querySelectorAll('.expense-local-row').forEach(row => {
            fixed.push({
                id: row.getAttribute('data-id') || 'id' + Date.now(),
                label: (row.querySelector('.expense-local-label') || {}).value || '',
                amount: _parseAmountInput((row.querySelector('.expense-local-amount') || {}).value),
                date: (row.querySelector('.expense-local-date') || {}).value || ''
            });
        });
    }
    if (variableContainer) {
        variableContainer.querySelectorAll('.expense-local-row').forEach(row => {
            variable.push({
                id: row.getAttribute('data-id') || 'id' + Date.now(),
                label: (row.querySelector('.expense-local-label') || {}).value || '',
                amount: _parseAmountInput((row.querySelector('.expense-local-amount') || {}).value),
                date: (row.querySelector('.expense-local-date') || {}).value || ''
            });
        });
    }
    return { year, month, data: { fixed, variable } };
}

async function addExpensesLocalRow(sectionType) {
    const year = document.getElementById('expenseLocalYear') ? document.getElementById('expenseLocalYear').value : '';
    const month = document.getElementById('expenseLocalMonth') ? document.getElementById('expenseLocalMonth').value : 'all';
    if (!year) {
        showError('Önce dönem (yıl) seçin.');
        return;
    }
    const data = await getExpensesLocalData(year, month);
    const list = sectionType === 'fixed' ? data.fixed : data.variable;
    const id = 'r' + Date.now();
    // Varsayılan tarih: seçili yıl+ay'ın 1'i veya bugün
    let defaultDate = '';
    const today = new Date();
    if (month && month !== 'all') {
        defaultDate = year + '-' + String(parseInt(month, 10)).padStart(2, '0') + '-01';
    } else {
        defaultDate = today.toISOString().slice(0, 10);
    }
    list.push({ id, label: '', amount: 0, date: defaultDate });
    await setExpensesLocalData(year, month, data);
    renderExpensesLocalSection('fixed', data.fixed);
    renderExpensesLocalSection('variable', data.variable);
    await updateExpensesLocalSummary();
    bindExpensesLocalEvents();
}

async function removeExpensesLocalRow(sectionType, rowId) {
    const year = document.getElementById('expenseLocalYear') ? document.getElementById('expenseLocalYear').value : '';
    const month = document.getElementById('expenseLocalMonth') ? document.getElementById('expenseLocalMonth').value : 'all';
    const data = await getExpensesLocalData(year, month);
    const list = sectionType === 'fixed' ? data.fixed : data.variable;
    const idx = list.findIndex(i => String(i.id) === String(rowId));
    if (idx !== -1) list.splice(idx, 1);
    await setExpensesLocalData(year, month, data);
    renderExpensesLocalSection('fixed', data.fixed);
    renderExpensesLocalSection('variable', data.variable);
    await updateExpensesLocalSummary();
    bindExpensesLocalEvents();
}

function bindExpensesLocalEvents() {
    const yearSel = document.getElementById('expenseLocalYear');
    const monthSel = document.getElementById('expenseLocalMonth');
    if (yearSel) yearSel.removeEventListener('change', _expensesLocalPeriodChange);
    if (monthSel) monthSel.removeEventListener('change', _expensesLocalPeriodChange);
    yearSel && yearSel.addEventListener('change', _expensesLocalPeriodChange);
    monthSel && monthSel.addEventListener('change', _expensesLocalPeriodChange);

    document.getElementById('expenseFixedAdd') && document.getElementById('expenseFixedAdd').replaceWith(document.getElementById('expenseFixedAdd').cloneNode(true));
    document.getElementById('expenseVariableAdd') && document.getElementById('expenseVariableAdd').replaceWith(document.getElementById('expenseVariableAdd').cloneNode(true));
    document.getElementById('expenseFixedAdd') && document.getElementById('expenseFixedAdd').addEventListener('click', () => addExpensesLocalRow('fixed'));
    document.getElementById('expenseVariableAdd') && document.getElementById('expenseVariableAdd').addEventListener('click', () => addExpensesLocalRow('variable'));

    document.querySelectorAll('.expense-local-row').forEach(row => {
        const section = row.getAttribute('data-section');
        const id = row.getAttribute('data-id');
        const labelInp = row.querySelector('.expense-local-label');
        const amountInp = row.querySelector('.expense-local-amount');
        const dateInp = row.querySelector('.expense-local-date');
        const delBtn = row.querySelector('.expense-local-delete');
        const debounceSave = () => {
            const { year, month, data } = buildExpensesDataFromDOM();
            setExpensesLocalData(year, month, data).then(() => {
                updateExpensesLocalSummary();
                const fixedTotal = (data.fixed || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
                const variableTotal = (data.variable || []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
                const subtotal = section === 'fixed' ? fixedTotal : variableTotal;
                const subtotalId = section === 'fixed' ? 'expenseFixedSubtotal' : 'expenseVariableSubtotal';
                const subtotalEl = document.getElementById(subtotalId);
                if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
            });
        };
        if (labelInp) labelInp.addEventListener('input', debounceSave);
        if (dateInp) dateInp.addEventListener('change', debounceSave);
        // Tutar: focus'ta saf sayı göster, blur'da formatla
        if (amountInp) {
            amountInp.addEventListener('focus', function () {
                const raw = _parseAmountInput(this.value);
                this.value = raw > 0 ? String(raw) : '';
            });
            amountInp.addEventListener('blur', function () {
                const raw = _parseAmountInput(this.value);
                this.value = _formatAmountDisplay(raw);
                debounceSave();
            });
            amountInp.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { this.blur(); }
            });
        }
        if (delBtn) delBtn.addEventListener('click', () => removeExpensesLocalRow(section, id));
    });
}

function _expensesLocalPeriodChange() {
    loadExpensesLocal();
}

// Analiz detay modal (Son eklenen / tek kayıt detayı)
let currentDetailEntryId = null;

/** Son eklenen analizler listesinde satıra tıklanınca index ile çağrılır (inline onclick) */
window.openDashboardAnalysisDetailByIndex = function (idx) {
    if (!Array.isArray(_dashboardRecentListData) || _dashboardRecentListData[idx] == null) return;
    openDashboardAnalysisDetail(_dashboardRecentListData[idx]);
};

window.openHistoryMonthSummary = function (monthId) {
    const summary = _historyMonthSummaryData[monthId];
    const modal = document.getElementById('analysisDetailModal');
    const body = document.getElementById('analysisDetailBody');
    const titleEl = document.getElementById('analysisDetailModalTitle');
    const fullBtn = document.getElementById('analysisDetailViewFullBtn');
    const contentWrap = modal?.querySelector('.modal-content');
    if (!summary || !modal || !body || !titleEl) return;

    currentDetailEntryId = null;
    if (contentWrap) {
        contentWrap.classList.remove('modal-content-wide');
        contentWrap.classList.add('modal-content-compact');
    }
    if (fullBtn) fullBtn.style.display = 'none';

    const isProfit = summary.profit >= 0;
    const kdvLabel = summary.payableKdv > 0 ? 'Ödenecek KDV' : 'Devreden KDV';
    const kdvAmount = summary.payableKdv > 0 ? summary.payableKdv : summary.devredenKdv;
    const topCustomer = summary.topSalesCustomer
        ? `${escapeHtml(summary.topSalesCustomer.name)} (${formatCurrency(summary.topSalesCustomer.total)})`
        : 'Veri yok';

    titleEl.textContent = 'Ay Özeti - ' + formatMonthLabel(monthId);
    let html = '<div class="detail-grid">';
    html += '<div class="detail-card"><span class="detail-label">Satış</span><span class="detail-value sales">' + formatCurrency(summary.sales) + '</span></div>';
    html += '<div class="detail-card"><span class="detail-label">Alış</span><span class="detail-value purchase">' + formatCurrency(summary.purchase) + '</span></div>';
    html += '<div class="detail-card ' + (isProfit ? 'profit' : 'loss') + '"><span class="detail-label">' + (isProfit ? 'Kâr' : 'Zarar') + '</span><span class="detail-value">' + formatCurrency(Math.abs(summary.profit)) + '</span></div>';
    html += '<div class="detail-card"><span class="detail-label">Satış KDV</span><span class="detail-value">' + formatCurrency(summary.salesTax) + '</span></div>';
    html += '<div class="detail-card"><span class="detail-label">Alış KDV</span><span class="detail-value">' + formatCurrency(summary.purchaseTax) + '</span></div>';
    html += '<div class="detail-card ' + (summary.payableKdv > 0 ? 'payable' : 'carryover') + '"><span class="detail-label">' + kdvLabel + '</span><span class="detail-value">' + formatCurrency(kdvAmount) + '</span></div>';
    html += '<div class="detail-card detail-card-wide"><span class="detail-label">En Çok Satış Yapılan Müşteri</span><span class="detail-value">' + topCustomer + '</span></div>';
    html += '</div>';

    if (summary.entries.length > 0) {
        html += '<div class="history-modal-actions"><h4>Bu aya ait analizler</h4>';
        summary.entries.forEach(entry => {
            const safeId = escapeAttr(entry.id);
            html += '<div class="history-modal-entry">';
            html += '<span>' + escapeHtml(entry.displayDate || entry.salesFileName || entry.purchaseFileName || 'Analiz kaydı') + '</span>';
            html += '<div class="history-actions">';
            html += `<button class="history-action-btn view" onclick="viewHistoryEntry('${safeId}')">Görüntüle</button>`;
            html += `<button class="history-action-btn delete" onclick="deleteHistoryEntry('${safeId}')">Sil</button>`;
            html += '</div></div>';
        });
        html += '</div>';
    }

    body.innerHTML = html;
    modal.style.display = 'flex';
};

/** Dashboard "Son eklenen analizler" satırına tıklanınca: aylık özeti mini pencerede gösterir */
window.openDashboardAnalysisDetail = function (m) {
    const modal = document.getElementById('analysisDetailModal');
    const body = document.getElementById('analysisDetailBody');
    const titleEl = document.getElementById('analysisDetailModalTitle');
    const fullBtn = document.getElementById('analysisDetailViewFullBtn');
    const contentWrap = modal?.querySelector('.modal-content');
    if (!modal || !body || !titleEl) return;
    currentDetailEntryId = null;
    if (contentWrap) {
        contentWrap.classList.remove('modal-content-wide');
        contentWrap.classList.add('modal-content-compact');
    }
    if (fullBtn) fullBtn.style.display = 'none';
    titleEl.textContent = 'Analiz Detayı — ' + formatMonthLabel(m.month);
    const sales = m.total_sales ?? 0;
    const purchase = m.total_purchases ?? 0;
    const profit = m.gross_profit ?? (sales - purchase);
    const salesVat = m.sales_vat ?? 0;
    const purchaseVat = m.purchase_vat ?? 0;
    const netTax = (salesVat > 0 || purchaseVat > 0) ? (salesVat - purchaseVat) : (m.total_vat ?? 0);
    const isProfit = profit >= 0;
    let html = '<div class="detail-grid">';
    html += '<div class="detail-card"><span class="detail-label">Toplam Satış</span><span class="detail-value sales">' + formatCurrency(sales) + '</span></div>';
    html += '<div class="detail-card"><span class="detail-label">Toplam Alış</span><span class="detail-value purchase">' + formatCurrency(purchase) + '</span></div>';
    html += '<div class="detail-card ' + (isProfit ? 'profit' : 'loss') + '"><span class="detail-label">' + (isProfit ? 'Brüt Kâr' : 'Brüt Zarar') + '</span><span class="detail-value">' + formatCurrency(Math.abs(profit)) + '</span></div>';
    if (salesVat > 0 || purchaseVat > 0) {
        html += '<div class="detail-card"><span class="detail-label">Satış KDV</span><span class="detail-value">' + formatCurrency(salesVat) + '</span></div>';
        html += '<div class="detail-card"><span class="detail-label">Alış KDV</span><span class="detail-value">' + formatCurrency(purchaseVat) + '</span></div>';
        html += '<div class="detail-card"><span class="detail-label">' + (netTax > 0 ? 'Ödenecek KDV' : 'Devreden KDV') + '</span><span class="detail-value">' + formatCurrency(Math.abs(netTax)) + '</span></div>';
    } else if (m.total_vat != null && m.total_vat !== 0) {
        html += '<div class="detail-card"><span class="detail-label">Toplam KDV</span><span class="detail-value">' + formatCurrency(m.total_vat) + '</span></div>';
    }
    html += '</div>';
    body.innerHTML = html;
    modal.style.display = 'flex';
};

window.openAnalysisDetailModal = async function (id) {
    currentDetailEntryId = id;
    const modal = document.getElementById('analysisDetailModal');
    const body = document.getElementById('analysisDetailBody');
    const fullBtn = document.getElementById('analysisDetailViewFullBtn');
    const contentWrap = modal?.querySelector('.modal-content');
    if (!modal || !body) return;
    if (contentWrap) {
        contentWrap.classList.remove('modal-content-compact');
        contentWrap.classList.add('modal-content-wide');
    }
    const titleEl = document.getElementById('analysisDetailModalTitle');
    if (titleEl) titleEl.textContent = 'Analiz Detayı';
    modal.style.display = 'flex';
    body.innerHTML = '<p class="detail-loading">Yükleniyor...</p>';
    if (fullBtn) fullBtn.style.display = 'none';
    try {
        const response = await fetch('/api/history/' + id);
        const data = await response.json();
        if (!data.success || !data.entry) {
            body.innerHTML = '<p class="detail-error">Kayıt yüklenemedi.</p>';
            return;
        }
        const e = data.entry;
        const sales = e.sales?.totalAmount || 0;
        const purchase = e.purchase?.totalAmount || 0;
        const profit = e.profitLoss?.amount ?? (sales - purchase);
        const salesTax = e.sales?.totalTax || 0;
        const purchaseTax = e.purchase?.totalTax || 0;
        const netTax = salesTax - purchaseTax;
        const isProfit = profit >= 0;
        let html = '<div class="detail-meta"><strong>Tarih:</strong> ' + escapeHtml(e.displayDate || new Date(e.date).toLocaleDateString('tr-TR')) + '</div>';
        html += '<div class="detail-grid">';
        html += '<div class="detail-card"><span class="detail-label">Toplam Satış</span><span class="detail-value sales">' + formatCurrency(sales) + '</span></div>';
        html += '<div class="detail-card"><span class="detail-label">Toplam Alış</span><span class="detail-value purchase">' + formatCurrency(purchase) + '</span></div>';
        html += '<div class="detail-card ' + (isProfit ? 'profit' : 'loss') + '"><span class="detail-label">' + (isProfit ? 'Kâr' : 'Zarar') + '</span><span class="detail-value">' + formatCurrency(Math.abs(profit)) + '</span></div>';
        html += '<div class="detail-card"><span class="detail-label">Satış KDV</span><span class="detail-value">' + formatCurrency(salesTax) + '</span></div>';
        html += '<div class="detail-card"><span class="detail-label">Alış KDV</span><span class="detail-value">' + formatCurrency(purchaseTax) + '</span></div>';
        html += '<div class="detail-card"><span class="detail-label">' + (netTax > 0 ? 'Ödenecek KDV' : 'Devreden KDV') + '</span><span class="detail-value">' + formatCurrency(Math.abs(netTax)) + '</span></div>';
        html += '</div>';
        if (e.summary) html += '<p class="detail-summary">' + escapeHtml(e.summary) + '</p>';
        if (e.sales?.topProducts?.length) {
            html += '<div class="detail-tops"><h4>En çok satış</h4><ul>';
            e.sales.topProducts.slice(0, 3).forEach(p => { html += '<li>' + escapeHtml(p.name) + ' — ' + formatCurrency(p.total) + '</li>'; });
            html += '</ul></div>';
        }
        if (e.purchase?.topProducts?.length) {
            html += '<div class="detail-tops"><h4>En çok alış</h4><ul>';
            e.purchase.topProducts.slice(0, 3).forEach(p => { html += '<li>' + escapeHtml(p.name) + ' — ' + formatCurrency(p.total) + '</li>'; });
            html += '</ul></div>';
        }
        body.innerHTML = html;
        if (fullBtn) {
            fullBtn.style.display = 'inline-block';
            fullBtn.onclick = function () { closeAnalysisDetailModal(); viewHistoryEntry(id); };
        }
    } catch (err) {
        body.innerHTML = '<p class="detail-error">Yüklenirken hata oluştu.</p>';
    }
};
window.closeAnalysisDetailModal = function () {
    const modal = document.getElementById('analysisDetailModal');
    if (modal) modal.style.display = 'none';
    currentDetailEntryId = null;
};

window.viewHistoryEntry = async function (id) {
    try {
        showLoading(true, 'Kayıt açılıyor...');
        const response = await fetch(`/api/history/${id}`);
        const data = await response.json();

        if (data.success && data.entry) {
            displayResults({
                sales: data.entry.sales,
                purchase: data.entry.purchase,
                profitLoss: data.entry.profitLoss,
                summary: data.entry.summary,
                timestamp: data.entry.displayDate
            });
            // Switch to analyze tab
            const tabAnalyze = document.getElementById('tabAnalyze');
            const tabHistory = document.getElementById('tabHistory');
            const historySection = document.getElementById('historySection');
            const uploadSection = document.querySelector('.upload-section');

            if (tabAnalyze) tabAnalyze.classList.add('active');
            if (tabHistory) tabHistory.classList.remove('active');
            if (uploadSection) uploadSection.style.display = 'none';
            if (historySection) historySection.style.display = 'none';
        } else {
            showError('Kayıt bulunamadı.');
        }
    } catch (error) {
        console.error('viewHistoryEntry error:', error);
        showError('Kayıt görüntülenirken hata oluştu.');
    } finally {
        showLoading(false);
    }
};

window.deleteHistoryEntry = async function (id) {
    if (!(await showConfirm({ message: 'Bu kaydı silmek istediğinizden emin misiniz?', danger: true, confirmText: 'Sil' }))) {
        return;
    }

    try {
        const response = await fetch(`/api/history/${id}`, { method: 'DELETE' });
        const data = await response.json();

        if (data.success) {
            loadHistory();
            loadHistoryCount();
            loadTrashCount();
        }
    } catch (error) {
        showError('Kayıt silinirken hata oluştu.');
    }
};

async function clearAllHistory() {
    if (!(await showConfirm({ message: 'Tüm geçmişi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.', danger: true, confirmText: 'Sil' }))) {
        return;
    }

    try {
        const response = await fetch('/api/history', { method: 'DELETE' });
        const data = await response.json();

        if (data.success) {
            loadHistory();
            loadHistoryCount();
            loadTrashCount();
        }
    } catch (error) {
        showError('Geçmiş temizlenirken hata oluştu.');
    }
}

// ========================================
// Dashboard Functions
// ========================================
function toggleDashboardRange() {
    const rangeSelector = document.getElementById('dashboardRangeSelector');
    const yearSelectorWrapper = document.getElementById('dashboardYearSelectorWrapper');
    const toggleBtn = document.getElementById('rangeToggleBtn');
    
    if (rangeSelector.style.display === 'none') {
        rangeSelector.style.display = 'inline-flex';
        if (yearSelectorWrapper) yearSelectorWrapper.style.display = 'none';
        if (toggleBtn) toggleBtn.classList.add('active');
    } else {
        rangeSelector.style.display = 'none';
        if (yearSelectorWrapper) yearSelectorWrapper.style.display = 'block';
        if (toggleBtn) toggleBtn.classList.remove('active');
    }
}

function applyDashboardRange() {
    const rangeStart = document.getElementById('rangeStart').value;
    const rangeEnd = document.getElementById('rangeEnd').value;
    if (rangeStart && rangeEnd) {
        loadDashboard();
    }
}

function clearDashboardRange() {
    document.getElementById('rangeStart').value = '';
    document.getElementById('rangeEnd').value = '';
    toggleDashboardRange();
    loadDashboard();
}

// Brüt kâr KDV HARİÇ hesaplanır (CEO kararı 2026-07-07). Kâr/Zarar tablosu, geçmiş özetleri ve
// YoY karşılaştırması aynı tabanı kullanır; panel de aynı tabanda kalmalı ki aynı ekranda iki farklı
// "Net Kâr" görünmesin. KDV kırılımı yoksa tutarlar zaten net kabul edilir, çıkarma yapılmaz.
function computeVatExclusiveGrossProfit(sales, purchases, salesVat, purchaseVat) {
    const netSales = (sales || 0) - (Number.isFinite(salesVat) ? salesVat : 0);
    const netPurchases = (purchases || 0) - (Number.isFinite(purchaseVat) ? purchaseVat : 0);
    return netSales - netPurchases;
}

async function loadDashboard() {
    try {
        showLoading(true, 'Panel yükleniyor...');
        
        const rangeStart = document.getElementById('rangeStart')?.value;
        const rangeEnd = document.getElementById('rangeEnd')?.value;
        const isRangeMode = rangeStart && rangeEnd;
        
        let url = '/api/dashboard/latest';
        if (isRangeMode) {
            url = `/api/dashboard/range?start=${rangeStart}&end=${rangeEnd}`;
        }
        
        const response = await fetch(url);

        if (!response.ok) {
            const text = await response.text();
            console.error('Dashboard response error:', response.status, text);
            showError('Dashboard yüklenirken hata oluştu (HTTP ' + response.status + ')');
            _dashboardMonthlyAll = [];
            _dashboardSummaryAll = null;
            _dashboardHasSeparateVat = false;
            renderDashboardForYear('');
            return;
        }

        const data = await response.json();

        if (!data.success) {
            console.error('Dashboard data error:', data.error || data);
            showError('Dashboard yüklenirken hata oluştu: ' + (data.error || 'Bilinmeyen hata'));
            _dashboardMonthlyAll = [];
            _dashboardSummaryAll = null;
            _dashboardHasSeparateVat = false;
            renderDashboardForYear('');
            return;
        }

        const rawMonthly = data.monthly;
        const apiSummary = data.summary || {};

        // Normalize monthly: API may return Object { labels, sales, purchases, vat } or Array [{ month, total_sales, ... }]
        let monthly;
        // Track whether API provided SEPARATE sales_vat / purchase_vat series
        let _hasSeparateVatSeries = false;

        if (Array.isArray(rawMonthly)) {
            // Array of objects
            // Detect if ANY item has a nonzero sales_vat or purchase_vat
            const _anySep = rawMonthly.some(item =>
                (item.sales_vat ?? item.salesVat ?? item.sales_tax ?? 0) > 0 ||
                (item.purchase_vat ?? item.purchaseVat ?? item.purchase_tax ?? 0) > 0
            );
            _hasSeparateVatSeries = _anySep;

            monthly = rawMonthly.map(item => ({
                month: item.month || '',
                total_sales: item.total_sales ?? item.totalSales ?? 0,
                total_purchases: item.total_purchases ?? item.totalPurchases ?? 0,
                total_vat: item.total_vat ?? item.totalVat ?? item.vat ?? item['Toplam KDV'] ?? item.vat_amount ?? item.kdv ?? 0,
                sales_vat: _anySep ? (item.sales_vat ?? item.salesVat ?? item.sales_tax ?? 0) : null,
                purchase_vat: _anySep ? (item.purchase_vat ?? item.purchaseVat ?? item.purchase_tax ?? 0) : null,
                gross_profit: item.gross_profit ?? item.grossProfit ?? computeVatExclusiveGrossProfit(
                    item.total_sales ?? item.totalSales ?? 0,
                    item.total_purchases ?? item.totalPurchases ?? 0,
                    _anySep ? (item.sales_vat ?? item.salesVat ?? item.sales_tax ?? 0) : null,
                    _anySep ? (item.purchase_vat ?? item.purchaseVat ?? item.purchase_tax ?? 0) : null
                ),
                expenses: item.expenses ?? 0
            }));
        } else if (rawMonthly && typeof rawMonthly === 'object' && Array.isArray(rawMonthly.labels)) {
            const labels = rawMonthly.labels || [];
            const sales = rawMonthly.sales || [];
            const purchases = rawMonthly.purchases || [];
            const vatArr = rawMonthly.vat || rawMonthly.total_vat || [];
            const salesVatArr = rawMonthly.salesVat || rawMonthly.sales_vat || null;
            const purchVatArr = rawMonthly.purchasesVat || rawMonthly.purchases_vat || rawMonthly.purchase_vat || null;
            const expensesArr = rawMonthly.expenses || [];

            // Separate series exist only if array with at least one nonzero value
            const _svValid = Array.isArray(salesVatArr) && salesVatArr.some(v => v > 0);
            const _pvValid = Array.isArray(purchVatArr) && purchVatArr.some(v => v > 0);
            _hasSeparateVatSeries = _svValid || _pvValid;

            monthly = labels.map((label, i) => ({
                month: label,
                total_sales: sales[i] || 0,
                total_purchases: purchases[i] || 0,
                total_vat: (Array.isArray(vatArr) ? vatArr[i] : 0) || 0,
                sales_vat: _hasSeparateVatSeries ? ((Array.isArray(salesVatArr) ? salesVatArr[i] : 0) || 0) : null,
                purchase_vat: _hasSeparateVatSeries ? ((Array.isArray(purchVatArr) ? purchVatArr[i] : 0) || 0) : null,
                gross_profit: computeVatExclusiveGrossProfit(
                    sales[i] || 0,
                    purchases[i] || 0,
                    _hasSeparateVatSeries ? ((Array.isArray(salesVatArr) ? salesVatArr[i] : 0) || 0) : null,
                    _hasSeparateVatSeries ? ((Array.isArray(purchVatArr) ? purchVatArr[i] : 0) || 0) : null
                ),
                expenses: (Array.isArray(expensesArr) ? expensesArr[i] : 0) || 0
            }));
        } else {
            monthly = [];
        }

        // If no separate vat series from dashboard API, try to fetch from history (dönem = dosya adından, geçmişle uyumlu)
        if (!_hasSeparateVatSeries && monthly.length > 0) {
            try {
                const histResp = await fetch('/api/history?limit=1000&sort=date_asc');
                if (histResp.ok) {
                    const histData = await histResp.json();
                    const histList = histData.history || histData || [];
                    if (Array.isArray(histList) && histList.length > 0) {
                        const svByMonth = {};
                        const pvByMonth = {};
                        let foundAny = false;
                        for (const entry of histList) {
                            const parsed = parseDateFromFilename(entry.salesFileName) || parseDateFromFilename(entry.purchaseFileName);
                            const key = parsed ? `${parsed.year}-${String(parsed.month).padStart(2, '0')}` : (entry.date ? new Date(entry.date).toISOString().slice(0, 7) : null);
                            if (!key) continue;
                            const sv = entry.sales?.totalTax ?? entry.sales?.total_tax ?? 0;
                            const pv = entry.purchase?.totalTax ?? entry.purchase?.total_tax ?? 0;
                            if (sv > 0 || pv > 0) foundAny = true;
                            svByMonth[key] = (svByMonth[key] || 0) + sv;
                            pvByMonth[key] = (pvByMonth[key] || 0) + pv;
                        }
                        if (foundAny) {
                            _hasSeparateVatSeries = true;
                            for (const m of monthly) {
                                m.sales_vat = svByMonth[m.month] ?? 0;
                                m.purchase_vat = pvByMonth[m.month] ?? 0;
                                // KDV kırılımı sonradan geldi; brüt kâr KDV hariç tabana çekilir
                                m.gross_profit = computeVatExclusiveGrossProfit(
                                    m.total_sales, m.total_purchases, m.sales_vat, m.purchase_vat
                                );
                            }
                        }
                    }
                }
            } catch (_histErr) {
                console.warn('[KDV] history fetch for separate vat failed:', _histErr);
            }
        }

        // Enrich summary with API-level total_vat if monthly aggregation missed it
        if (apiSummary.total_vat > 0 || apiSummary.totalVat > 0) {
            const apiVat = apiSummary.total_vat || apiSummary.totalVat || 0;
            const monthlyVatSum = monthly.reduce((s, m) => s + (m.total_vat || 0), 0);
            if (monthlyVatSum === 0 && apiVat > 0 && monthly.length > 0) {
                // TODO: ideally backend should send per-month vat; distributing evenly as fallback
                const perMonth = apiVat / monthly.length;
                monthly.forEach(m => { m.total_vat = perMonth; });
            }
        }

        // Store separate vat flag globally for render
        _dashboardHasSeparateVat = _hasSeparateVatSeries;

        // Store all data globally for year filtering
        _dashboardMonthlyAll = monthly;
        _dashboardSummaryAll = data.summary || null;

        // Populate year select from monthly data only
        const yearSelect = document.getElementById('yearSelect');
        const years = [];
        for (const m of monthly) {
            const y = extractYearFromMonth(m.month);
            if (y && years.indexOf(y) === -1) years.push(y);
        }
        years.sort((a, b) => b - a); // en yeniden eskiye

        if (yearSelect && !isRangeMode) {
            const prevValue = yearSelect.value;
            const prevNum = parseInt(prevValue, 10);

            yearSelect.innerHTML = '<option value="">Tüm Yıllar</option>' +
                years.map(y => '<option value="' + y + '">' + y + '</option>').join('');

            // Default: keep previous if still valid, otherwise max year
            if (prevValue && years.indexOf(prevNum) !== -1) {
                yearSelect.value = prevValue;
            } else if (years.length > 0) {
                yearSelect.value = String(Math.max(...years));
            }
        }

        // Render for selected year
        const selectedYear = isRangeMode ? '' : (yearSelect ? yearSelect.value : '');

        console.log('years:', years, 'selectedYear:', selectedYear);
        console.log('monthly sample:', rawMonthly?.labels?.slice?.(0, 3), rawMonthly);

        renderDashboardForYear(selectedYear);
        loadCustomerDashboardSummary();
        loadBusinessPartyDashboardSummary();
        loadDashboardForecastSummary();
        
        // Load profit/loss data
        const plYear = isRangeMode ? `${rangeStart.substring(0,4)}-${rangeEnd.substring(0,4)}` : (selectedYear || new Date().getFullYear());
        loadProfitLoss(plYear);

        if (!window._dashboardRangeEventsWired) {
            document.getElementById('rangeToggleBtn')?.addEventListener('click', toggleDashboardRange);
            document.getElementById('rangeClearBtn')?.addEventListener('click', clearDashboardRange);
            document.getElementById('rangeStart')?.addEventListener('change', applyDashboardRange);
            document.getElementById('rangeEnd')?.addEventListener('change', applyDashboardRange);
            window._dashboardRangeEventsWired = true;
        }

    } catch (error) {
        console.error('Dashboard load error:', error);
        showError('Dashboard yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
        _dashboardMonthlyAll = [];
        _dashboardSummaryAll = null;
        _dashboardHasSeparateVat = false;
        try { renderDashboardForYear(''); } catch (_) { /* render de patlarsa sessizce geç */ }
    } finally {
        showLoading(false);
    }
}

async function loadDashboardForecastSummary() {
    const valueEl = document.getElementById('dashboardForecastValue');
    const trendEl = document.getElementById('dashboardForecastTrend');
    const modelEl = document.getElementById('dashboardForecastModel');
    const alertEl = document.getElementById('dashboardForecastAlert');
    if (!valueEl || !trendEl || !modelEl) return;

    try {
        const response = await fetch('/api/predictions?period=12&model=auto');
        if (!response.ok) return;
        const data = await response.json();
        const prediction = data.prediction;
        if (!data.success || !prediction?.predictions?.length) {
            valueEl.textContent = 'Yeterli veri yok';
            trendEl.textContent = 'Tahmin üretilemedi';
            modelEl.textContent = 'Veri bekleniyor';
            if (alertEl) alertEl.className = 'forecast-widget-status neutral';
            return;
        }

        const horizon3 = (prediction.forecastHorizons || []).find(item => item.months === 3);
        const feedback = prediction.accountantFeedback;
        valueEl.textContent = formatCurrency(horizon3?.total || feedback?.threeMonthForecast || 0);
        const trend = feedback?.trend?.direction || prediction.trend;
        const trendLabel = trend === 'up' ? 'Yukarı yönlü' : trend === 'down' ? 'Aşağı yönlü' : 'Durağan';
        trendEl.textContent = `${trendLabel}${feedback?.trend?.changePct != null ? ` (${feedback.trend.changePct > 0 ? '+' : ''}${feedback.trend.changePct}%)` : ''}`;
        modelEl.textContent = prediction.modelSelection?.selectedLabel || 'En iyi model';
        if (alertEl) {
            const hasWarning = Boolean(feedback?.criticalWarning || prediction.riskAssessment?.level === 'high');
            alertEl.className = `forecast-widget-status ${hasWarning ? 'warning' : trend === 'down' ? 'danger' : 'ok'}`;
        }
    } catch (error) {
        console.warn('Dashboard forecast summary failed:', error);
    }
}

// ========================================
// Kar/Zarar Analizi (Aylık Bazlı)
// ========================================
async function loadProfitLoss(year) {
    try {
        const response = await fetch('/api/analysis/profit-loss?year=' + encodeURIComponent(year));
        
        if (!response.ok) {
            console.error('Profit/Loss response error:', response.status);
            _dashboardProfitLossData = null;
            renderProfitLoss(null);
            return;
        }

        const data = await response.json();
        
        if (!data.success) {
            console.error('Profit/Loss data error:', data.error || data);
            _dashboardProfitLossData = null;
            renderProfitLoss(null);
            return;
        }

        _dashboardProfitLossData = data;
        renderProfitLoss(data);
    } catch (error) {
        console.error('Profit/Loss load error:', error);
        _dashboardProfitLossData = null;
        renderProfitLoss(null);
    }
}

function renderProfitLoss(data) {
    const plSection = document.getElementById('dashboardProfitLossSection');
    const yearSelect = document.getElementById('yearSelect');
    const year = yearSelect ? yearSelect.value : new Date().getFullYear();

    if (!plSection) return;

    // Update year display
    const yearDisplay = document.getElementById('dashYearDisplayPL');
    if (yearDisplay) {
        yearDisplay.textContent = year || 'Tüm Yıllar';
    }

    // Hiç hareketi olmayan (tamamı sıfır) dönemde tabloyu gösterme; boş panelde sıfır tablosu kalmasın
    if (!data || !data.months || data.months.length === 0 || !data.months.some(hasProfitLossActivity)) {
        plSection.style.display = 'none';
        return;
    }

    plSection.style.display = 'block';

    // Render totals
    const totals = data.totals || {};
    document.getElementById('plTotalSales').textContent = formatCurrency(totals.sales || 0);
    document.getElementById('plTotalPurchases').textContent = formatCurrency(totals.purchases || 0);
    document.getElementById('plGrossProfit').textContent = formatCurrency(totals.grossProfit || 0);
    document.getElementById('plTotalExpenses').textContent = formatCurrency(totals.expenses || 0);
    document.getElementById('plNetProfit').textContent = formatCurrency(totals.netProfit || 0);
    document.getElementById('plProfitMargin').textContent = (totals.avgProfitMargin || 0) + '%';

    // Style totals based on values
    const grossProfitEl = document.getElementById('plGrossProfit');
    const netProfitEl = document.getElementById('plNetProfit');
    const profitMarginEl = document.getElementById('plProfitMargin');
    
    grossProfitEl.className = 'dashboard-pl-value ' + ((totals.grossProfit || 0) >= 0 ? 'sales' : 'expense');
    netProfitEl.className = 'dashboard-pl-value ' + ((totals.netProfit || 0) >= 0 ? 'sales' : 'expense');
    profitMarginEl.className = 'dashboard-pl-value ' + ((totals.avgProfitMargin || 0) >= 0 ? 'sales' : 'expense');

    // Render monthly table
    const tbody = document.getElementById('dashboardPLTableBody');
    if (!tbody) return;

    const activeMonths = data.months.filter(hasProfitLossActivity);
    const maxSales = activeMonths.length ? Math.max(...activeMonths.map(m => m.sales || 0)) : null;
    const maxNetProfit = activeMonths.length ? Math.max(...activeMonths.map(m => m.netProfit || 0)) : null;
    const minPositiveMargin = activeMonths
        .filter(m => (m.profitMargin || 0) >= 0)
        .reduce((min, m) => min === null || (m.profitMargin || 0) < (min.profitMargin || 0) ? m : min, null);

    tbody.innerHTML = data.months.map(m => {
        const hasActivity = hasProfitLossActivity(m);
        const badges = [];
        if (hasActivity && maxSales !== null && (m.sales || 0) === maxSales && maxSales > 0) badges.push('En yüksek satış');
        if (hasActivity && maxNetProfit !== null && (m.netProfit || 0) === maxNetProfit && maxNetProfit > 0) badges.push('En yüksek net kâr');
        if (hasActivity && (m.netProfit || 0) < 0) badges.push('Zarar');
        if (hasActivity && minPositiveMargin && m.monthName === minPositiveMargin.monthName && (m.profitMargin || 0) >= 0) badges.push('Düşük marj');
        const rowClass = (m.netProfit || 0) < 0 ? ' class="pl-risk-row"' : '';
        return '<tr' + rowClass + '>' +
            '<td><span class="pl-month-name">' + escapeHtml(m.monthName || '') + '</span>' +
                (badges.length ? '<span class="pl-row-badges">' + badges.map(b => '<span>' + escapeHtml(b) + '</span>').join('') + '</span>' : '') +
            '</td>' +
            '<td class="sales">' + (hasActivity ? formatCurrency(m.sales || 0) : '-') + '</td>' +
            '<td class="purchase">' + (hasActivity ? formatCurrency(m.purchases || 0) : '-') + '</td>' +
            '<td class="' + numericToneClass(m.grossProfit) + '">' + (hasActivity ? formatCurrency(m.grossProfit || 0) : '-') + '</td>' +
            '<td class="expense">' + (hasActivity ? formatCurrency(m.expenses || 0) : '-') + '</td>' +
            '<td class="' + numericToneClass(m.netProfit) + '">' + (hasActivity ? formatCurrency(m.netProfit || 0) : '-') + '</td>' +
            '<td class="pl-margin-cell ' + numericToneClass(m.profitMargin) + '">' + (hasActivity ? renderMarginBar(m.profitMargin) : '-') + '</td>' +
        '</tr>';
    }).join('');
}

// Marj hücresi: ince oran çubuğu + sayı (çubuk rengi hücrenin pozitif/negatif tonunu izler)
function renderMarginBar(margin) {
    const value = Number(margin) || 0;
    // Negatif marjda çubuk boş kalır (dolu kırmızı çubuk "iyi" gibi okunurdu); yüzde yine görünür
    const fill = Math.max(0, Math.min(100, Math.round((Math.max(0, value) / 50) * 100)));
    return '<span class="pl-margin">' +
        '<span class="pl-margin-track"><span class="pl-margin-fill" style="width:' + fill + '%"></span></span>' +
        '<span class="pl-margin-value">' + value + '%</span>' +
    '</span>';
}

const SUMMARY_AMOUNT_FIELDS = [
    'total_sales', 'totalSales', 'total_purchases', 'totalPurchases', 'total_vat', 'totalVat',
    'gross_profit', 'grossProfit', 'net_profit', 'netProfit', 'total_expenses', 'totalExpenses'
];

function hasMeaningfulSummary(summary) {
    if (!summary || typeof summary !== 'object') return false;
    return SUMMARY_AMOUNT_FIELDS.some(field => Math.abs(Number(summary[field]) || 0) > 0);
}

function renderDashboardForYear(yearStr) {
    const allMonthly = _dashboardMonthlyAll || [];
    const summary = _dashboardSummaryAll;

    // Filter monthly by year (empty string = all years)
    let monthly;
    if (yearStr) {
        const yearNum = parseInt(yearStr, 10);
        monthly = allMonthly.filter(m => extractYearFromMonth(m.month) === yearNum);
    } else {
        monthly = allMonthly;
    }

    const dashboardStats = document.getElementById('dashboardStats');
    const dashboardKdv = document.querySelector('.dashboard-kdv-section');
    const dashboardChart = document.querySelector('.dashboard-chart-section');
    const dashboardActions = document.querySelector('.dashboard-actions');
    const dashboardEmpty = document.getElementById('dashboardEmpty');
    const dashboardSubtotal = document.querySelector('.dashboard-subtotal-section');
    const recentSection = document.getElementById('dashboardRecentSection');
    const dashboardPLSection = document.querySelector('.dashboard-profit-loss-section');
    const dashboardRatiosSection = document.getElementById('dashboardRatiosSection');
    const dashboardRail = document.getElementById('dashboardRail');
    const dashboardSectionEl = document.getElementById('dashboardSection');

    // API veri yokken de sıfır dolu bir summary nesnesi döndürüyor; bu yüzden "summary var mı"
    // yerine "içinde anlamlı bir tutar var mı" diye bakılır, aksi halde boş ekran hiç görünmezdi.
    if (monthly.length === 0 && !hasMeaningfulSummary(summary)) {
        // `.dashboard-stats` üzerinde `display: grid !important` kuralı var; satır içi stil onu ezemiyor,
        // bu yüzden boş durum bir bölüm sınıfıyla işaretlenir.
        dashboardSectionEl.classList.add('has-no-data');
        dashboardStats.style.display = 'none';
        dashboardKdv.style.display = 'none';
        dashboardChart.style.display = 'none';
        if (dashboardSubtotal) dashboardSubtotal.style.display = 'none';
        if (dashboardPLSection) dashboardPLSection.style.display = 'none';
        if (dashboardRatiosSection) dashboardRatiosSection.style.display = 'none';
        if (dashboardRail) dashboardRail.style.display = 'none';
        dashboardActions.style.display = 'none';
        if (recentSection) recentSection.style.display = 'none';
        dashboardEmpty.style.display = 'block';
        return;
    }

    if (dashboardSectionEl) dashboardSectionEl.classList.remove('has-no-data');
    if (dashboardRail) dashboardRail.style.display = '';
    dashboardStats.style.display = 'grid';
    dashboardKdv.style.display = 'block';
    dashboardChart.style.display = 'block';
    if (dashboardSubtotal) dashboardSubtotal.style.display = 'block';
    if (dashboardPLSection) dashboardPLSection.style.display = 'block';
    dashboardActions.style.display = 'flex';
    dashboardEmpty.style.display = 'none';
    if (recentSection) recentSection.style.display = 'block';

    // Compute aggregates from filtered monthly
    let totalSales = 0, totalPurchase = 0, grossProfit = 0, totalVat = 0, totalExpenses = 0;
    for (const m of monthly) {
        totalSales += m.total_sales ?? m.totalSales ?? 0;
        totalPurchase += m.total_purchases ?? m.totalPurchases ?? 0;
        totalVat += m.total_vat ?? m.totalVat ?? 0;
        grossProfit += m.gross_profit ?? m.grossProfit ?? 0;
        totalExpenses += m.expenses ?? 0;
    }
    const netProfit = grossProfit - totalExpenses;
    const isProfit = grossProfit >= 0;
    const isNetProfit = netProfit >= 0;

    const sorted = monthly.slice().sort((a, b) => (a.month || '').localeCompare(b.month || ''));
    const salesSeries = sorted.map(m => m.total_sales ?? m.totalSales ?? 0);
    const purchaseSeries = sorted.map(m => m.total_purchases ?? m.totalPurchases ?? 0);
    const profitSeries = sorted.map(m => m.gross_profit ?? m.grossProfit ?? 0);

    const salesTrend = detectTrendClient(salesSeries);
    const purchaseTrend = detectTrendClient(purchaseSeries);
    const profitTrend = detectTrendClient(profitSeries);

    const totalAnalysesEl = document.getElementById('dashTotalAnalyses');
    if (totalAnalysesEl) {
        totalAnalysesEl.textContent = monthly.length;
        totalAnalysesEl.removeAttribute('title');
        totalAnalysesEl.removeAttribute('aria-label');
    }
    setKpiValue('dashTotalSales', totalSales, salesTrend);
    setKpiValue('dashTotalPurchase', totalPurchase, purchaseTrend);
    setKpiValue('dashTotalProfit', Math.abs(grossProfit), profitTrend);

    const dashTotalExpensesEl = document.getElementById('dashTotalExpenses');
    const dashNetProfitEl = document.getElementById('dashNetProfit');
    if (dashTotalExpensesEl) {
        dashTotalExpensesEl.innerHTML = '<span class="dashboard-card-value-text">' + escapeHtml(formatCompactCurrency(totalExpenses)) + '</span>';
        dashTotalExpensesEl.title = formatCurrency(totalExpenses);
        dashTotalExpensesEl.setAttribute('aria-label', formatCurrency(totalExpenses));
    }
    if (dashNetProfitEl) {
        dashNetProfitEl.innerHTML = '<span class="dashboard-card-value-text">' + escapeHtml(formatCompactCurrency(Math.abs(netProfit))) + '</span>';
        dashNetProfitEl.title = formatCurrency(Math.abs(netProfit));
        dashNetProfitEl.setAttribute('aria-label', formatCurrency(Math.abs(netProfit)));
    }

    const expensesCard = document.getElementById('dashExpensesCard');
    if (expensesCard) {
        expensesCard.classList.toggle('neutral', totalExpenses === 0);
        expensesCard.classList.toggle('warning', totalExpenses > 0);
    }

    const profitCard = document.getElementById('dashProfitCard');
    const profitLabel = document.getElementById('dashProfitLabel');

    if (isProfit) {
        profitCard.classList.remove('loss');
        profitLabel.textContent = 'Brüt Kâr';
    } else {
        profitCard.classList.add('loss');
        profitLabel.textContent = 'Brüt Zarar';
    }

    const netProfitCard = document.getElementById('dashNetProfitCard');
    const netProfitLabel = document.getElementById('dashNetProfitLabel');
    if (netProfitCard) {
        if (isNetProfit) {
            netProfitCard.classList.remove('loss');
            netProfitCard.classList.add('profit-priority');
            if (netProfitLabel) netProfitLabel.textContent = 'Net Kâr';
        } else {
            netProfitCard.classList.add('loss');
            netProfitCard.classList.remove('profit-priority');
            if (netProfitLabel) netProfitLabel.textContent = 'Net Zarar';
        }
    }

    // KDV — compute from monthly sales_vat / purchase_vat (separate) or total_vat (combined)
    const kdvSalesTaxEl = document.getElementById('dashTotalSalesTax');
    const kdvPurchaseTaxEl = document.getElementById('dashTotalPurchaseTax');
    const kdvNetTaxEl = document.getElementById('dashNetTax');
    const kdvNetItem = document.getElementById('dashKdvNetItem');
    const kdvNetLabel = document.getElementById('dashKdvNetLabel');
    const kdvNetHint = document.getElementById('dashKdvNetHint');

    // Sum per-type vat from monthly items (null means unavailable, 0 means actual zero)
    let totalSalesVat = 0, totalPurchasesVat = 0;
    let hasSalesVatData = false, hasPurchasesVatData = false;
    for (const m of monthly) {
        if (m.sales_vat !== null && m.sales_vat !== undefined) {
            totalSalesVat += m.sales_vat;
            hasSalesVatData = true;
        }
        if (m.purchase_vat !== null && m.purchase_vat !== undefined) {
            totalPurchasesVat += m.purchase_vat;
            hasPurchasesVatData = true;
        }
    }

    const summaryRef = _dashboardSummaryAll || {};
    const summaryVat = summaryRef.total_vat || summaryRef.totalVat || 0;
    const combinedVat = totalVat > 0 ? totalVat : summaryVat;
    const hasAnyVat = hasSalesVatData || hasPurchasesVatData || combinedVat > 0;

    let vatLedger = null;
    if (hasSalesVatData && hasPurchasesVatData && window.VatLedger && window.VatLedger.calculateVatLedger) {
        let openingCredit = 0;
        if (yearStr) {
            const selectedYear = parseInt(yearStr, 10);
            const previousRows = allMonthly.filter(m => extractYearFromMonth(m.month) < selectedYear);
            openingCredit = window.VatLedger.calculateVatLedger(previousRows).closingCredit;
        }
        vatLedger = window.VatLedger.calculateVatLedger(monthly, { openingCredit });
    }

    let kdvStatusLabel = 'Nötr';
    let kdvTone = 'neutral';
    let kdvAction = 'KDV durumunu aylık akışta kontrol et';
    let kdvDecisionAmount = 0;

    if (hasAnyVat) {
        kdvSalesTaxEl.textContent = hasSalesVatData ? formatCurrency(totalSalesVat) : '—';
        kdvPurchaseTaxEl.textContent = hasPurchasesVatData ? formatCurrency(totalPurchasesVat) : '—';

        if (vatLedger) {
            kdvNetItem.classList.remove('payable', 'carryover');

            if (vatLedger.closingCredit > 0) {
                kdvNetTaxEl.textContent = formatCurrency(vatLedger.closingCredit);
                kdvNetItem.classList.add('carryover');
                kdvNetLabel.textContent = 'Devreden KDV';
                kdvStatusLabel = 'Devreden';
                kdvTone = 'positive';
                kdvDecisionAmount = vatLedger.closingCredit;
                kdvAction = 'Devreden KDV etkisini sonraki ayda takip et';
                if (kdvNetHint) {
                    kdvNetHint.textContent = vatLedger.totalPayable > 0
                        ? 'Dönem içinde ödenen: ' + formatCurrency(vatLedger.totalPayable)
                        : 'Sonraki aya aktarılır';
                }
            } else if (vatLedger.totalPayable > 0) {
                kdvNetTaxEl.textContent = formatCurrency(vatLedger.totalPayable);
                kdvNetItem.classList.add('payable');
                kdvNetLabel.textContent = 'Ödenecek KDV';
                kdvStatusLabel = 'Ödenecek';
                kdvTone = 'warning';
                kdvDecisionAmount = vatLedger.totalPayable;
                kdvAction = 'KDV ödeme planını nakit akışıyla kontrol et';
                if (kdvNetHint) {
                    const usedCarryover = vatLedger.rows.some(row => row.openingCredit > 0);
                    kdvNetHint.textContent = usedCarryover ? 'Devreden KDV mahsup edildi' : '';
                }
            } else {
                kdvNetTaxEl.textContent = formatCurrency(0);
                kdvNetLabel.textContent = 'Net KDV';
                kdvStatusLabel = 'Nötr';
                kdvTone = 'neutral';
                kdvDecisionAmount = 0;
                if (kdvNetHint) {
                    const usedCarryover = vatLedger.rows.some(row => row.openingCredit > 0);
                    kdvNetHint.textContent = usedCarryover ? 'Devreden KDV ödenecek tutarı kapattı' : '';
                }
            }
        } else {
            // Only combined vat available — show total, no breakdown
            kdvNetTaxEl.textContent = formatCurrency(combinedVat);
            kdvNetItem.classList.remove('payable', 'carryover');
            kdvNetLabel.textContent = 'Toplam KDV';
            kdvStatusLabel = combinedVat > 0 ? 'Takipte' : 'Nötr';
            kdvTone = combinedVat > 0 ? 'warning' : 'neutral';
            kdvDecisionAmount = combinedVat;
            if (kdvNetHint) kdvNetHint.textContent = '';
        }
    } else {
        kdvSalesTaxEl.textContent = '—';
        kdvPurchaseTaxEl.textContent = '—';
        kdvNetTaxEl.textContent = '—';
        kdvNetItem.classList.remove('payable', 'carryover');
        kdvNetLabel.textContent = 'Net KDV Durumu';
        kdvStatusLabel = 'Veri yok';
        kdvTone = 'neutral';
        kdvDecisionAmount = 0;
        if (kdvNetHint) kdvNetHint.textContent = '';
    }

    // Subtotal (KDV hariç net ciro)
    const effectiveSalesVat = hasSalesVatData ? totalSalesVat : 0;
    const effectivePurchVat = hasPurchasesVatData ? totalPurchasesVat : 0;
    const netSales = totalSales - effectiveSalesVat;
    const netPurchase = totalPurchase - effectivePurchVat;
    if (dashboardSubtotal) {
        document.getElementById('dashSalesSubtotal').textContent = formatCurrency(netSales);
        document.getElementById('dashPurchaseSubtotal').textContent = formatCurrency(netPurchase);
        document.getElementById('dashSubtotalDiff').textContent = formatCurrency(Math.abs(netSales - netPurchase));
    }

    // Year display labels
    const yearDisplay = yearStr || 'Tüm Yıllar';
    const dashYearDisplayKdv = document.getElementById('dashYearDisplayKdv');
    const dashYearDisplayNet = document.getElementById('dashYearDisplayNet');
    if (dashYearDisplayKdv) dashYearDisplayKdv.textContent = yearDisplay;
    if (dashYearDisplayNet) dashYearDisplayNet.textContent = yearDisplay;

    if (dashboardChart) {
        renderMonthlyTurnoverChart(monthly);
    }

    // Son eklenen analizler (tıklanınca detay modalı açılır)
    const recentList = document.getElementById('dashboardRecentList');
    if (recentList) {
        const recent = monthly.slice().sort((a, b) => (b.month || '').localeCompare(a.month || '')).slice(0, 4);
        _dashboardRecentListData = recent;
        recentList.innerHTML = recent.length === 0 ? '<li class="recent-empty">Henüz analiz yok</li>' : recent.map((m, i) => {
            const label = formatMonthLabel(m.month);
            const net = (m.gross_profit ?? ((m.total_sales || 0) - (m.total_purchases || 0))) - (m.expenses || 0);
            return '<li data-index="' + i + '" class="recent-item-clickable" onclick="openDashboardAnalysisDetailByIndex(' + i + ')">' +
                '<span class="recent-link-btn">' + escapeHtml(label) + '</span>' +
                '<span class="recent-metrics"><span>Satış ' + formatCurrency(m.total_sales || 0) + '</span><span class="' + (net >= 0 ? 'positive' : 'negative') + '">Net ' + formatCurrency(net) + '</span></span>' +
            '</li>';
        }).join('');
    }

    // Degisimler
    renderDeltaSection(monthly);

    // Anomali tespiti
    renderAnomalySection(monthly);

    const grossMarginNum = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
    const netMarginNum = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
    const expenseRatioNum = totalSales > 0 ? (totalExpenses / totalSales) * 100 : 0;
    const vatBurdenNum = totalSales > 0 ? (kdvDecisionAmount / totalSales) * 100 : 0;

    // Financial Ratios
    if (totalSales > 0) {
        const ratioMeta = {
            ratioGrossMargin: classifyMargin(grossMarginNum),
            ratioNetMargin: classifyMargin(netMarginNum),
            ratioExpenseRatio: classifyExpenseRatio(expenseRatioNum),
            ratioVatBurden: classifyVatBurden(vatBurdenNum)
        };

        const setRatio = (id, val, descId, desc) => {
            const el = document.getElementById(id);
            const meta = ratioMeta[id] || { label: 'Nötr', tone: 'neutral' };
            if (el) {
                el.textContent = '%' + val.toFixed(1);
                el.className = 'ratio-value ' + meta.tone;
            }
            const d = document.getElementById(descId);
            if (d) {
                d.innerHTML = '<strong class="ratio-status ' + meta.tone + '">' + meta.label + '</strong><span>' + escapeHtml(desc) + '</span>';
            }
        };

        setRatio('ratioGrossMargin', grossMarginNum, 'ratioGrossMarginDesc', 'Brüt kâr / satış');
        setRatio('ratioNetMargin', netMarginNum, 'ratioNetMarginDesc', 'Gider sonrası sonuç');
        setRatio('ratioExpenseRatio', expenseRatioNum, 'ratioExpenseRatioDesc', 'Giderler / ciro');
        setRatio('ratioVatBurden', vatBurdenNum, 'ratioVatBurdenDesc', 'KDV yükü / ciro');

        const section = document.getElementById('dashboardRatiosSection');
        if (section) section.style.display = 'block';
    } else {
        const section = document.getElementById('dashboardRatiosSection');
        if (section) section.style.display = 'none';
    }

    renderExecutiveSummary({
        yearDisplay,
        totalSales,
        totalPurchase,
        grossProfit,
        netProfit,
        totalExpenses,
        grossMargin: grossMarginNum,
        netMargin: netMarginNum,
        salesTrend,
        profitTrend,
        kdvStatusLabel,
        kdvTone,
        kdvAction,
        kdvDecisionAmount
    });

    renderCockpitSurfaces({
        yearStr,
        yearDisplay,
        sorted,
        allMonthly,
        salesSeries,
        purchaseSeries,
        totalSales,
        netProfit,
        grossMargin: grossMarginNum,
        salesTrend,
        purchaseTrend,
        kdvStatusLabel,
        kdvTone,
        kdvDecisionAmount,
        kdvLabel: kdvNetLabel ? kdvNetLabel.textContent : 'Net KDV',
        hasVatBreakdown: hasSalesVatData && hasPurchasesVatData,
        hasAnyVat
    });

    // Apply user widget config after rendering
    applyDashboardWidgetConfig();
}

function renderExecutiveSummary(view) {
    const textEl = document.getElementById('dashboardExecutiveText');
    const signalsEl = document.getElementById('dashboardExecutiveSignals');
    const actionEl = document.getElementById('dashboardNextAction');
    if (!textEl || !signalsEl || !actionEl) return;

    const profitTone = signalToneClass(view.netProfit);
    const profitabilityText = view.netProfit >= 0 ? 'kâr pozitif' : 'net zarar riski var';
    const kdvText = view.kdvStatusLabel === 'Ödenecek'
        ? 'ödenecek KDV nakit akışında takip edilmeli'
        : (view.kdvStatusLabel === 'Devreden' ? 'devreden KDV sonraki dönem için avantaj sağlıyor' : 'KDV tarafı nötr görünüyor');
    const trendText = view.salesTrend === 'yükselen'
        ? 'satış trendi yukarı yönlü'
        : (view.salesTrend === 'düşen' ? 'satış trendi zayıflıyor' : 'satış trendi yatay');

    textEl.textContent = `${view.yearDisplay} döneminde ${profitabilityText}; ${kdvText} ve ${trendText}.`;

    const trendTone = view.salesTrend === 'yükselen' ? 'positive' : (view.salesTrend === 'düşen' ? 'negative' : 'neutral');
    signalsEl.innerHTML = [
        {
            value: view.netProfit >= 0 ? 'Pozitif' : 'Risk',
            label: 'Kârlılık',
            hint: formatCurrency(Math.abs(view.netProfit)),
            tone: profitTone
        },
        {
            value: view.kdvStatusLabel,
            label: 'KDV',
            hint: view.kdvDecisionAmount ? formatCurrency(view.kdvDecisionAmount) : 'Ödenecek yok',
            tone: view.kdvTone
        },
        {
            value: trendLabel(view.salesTrend),
            label: 'Satış trendi',
            hint: trendLabel(view.profitTrend) + ' kâr',
            tone: trendTone
        }
    ].map(s => (
        '<div class="overview-stat ' + s.tone + '">' +
            '<span class="overview-stat-value">' + escapeHtml(s.value) + '</span>' +
            '<span class="overview-stat-label">' + escapeHtml(s.label) + '</span>' +
            '<span class="overview-stat-hint">' + escapeHtml(s.hint) + '</span>' +
        '</div>'
    )).join('');

    const actionText = view.netProfit < 0
        ? 'Zarar eden ayları ve gider kalemlerini incele'
        : (view.kdvStatusLabel === 'Ödenecek' ? view.kdvAction : 'Kârlılığı yüksek ayları incele');
    actionEl.innerHTML = '<span class="next-action-label">Önerilen aksiyon</span><strong>' + escapeHtml(actionText) + '</strong>';
    actionEl.className = 'dashboard-next-action ' + (view.netProfit < 0 ? 'negative' : view.kdvTone);
}

// ===== Kokpit yüzeyleri (KPI mikro grafikleri, ana sahne özeti, sağ karar paneli) =====

const MONTHLY_FIELD = {
    sales: (m) => m.total_sales ?? m.totalSales ?? 0,
    purchase: (m) => m.total_purchases ?? m.totalPurchases ?? 0,
    gross: (m) => m.gross_profit ?? m.grossProfit ?? 0,
    net: (m) => (m.gross_profit ?? m.grossProfit ?? 0) - (m.expenses || 0)
};

function buildSparklinePoints(values, width, height) {
    if (!Array.isArray(values) || values.length < 2) return '';
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return '';
    const span = max - min;
    const pad = 3;
    const usable = height - pad * 2;
    const stepX = width / (values.length - 1);
    return values.map((value, index) => {
        const x = (index * stepX).toFixed(1);
        // Tüm aylar eşitse çizgi dibe yapışmasın, ortadan düz geçsin
        const y = span === 0
            ? (height / 2).toFixed(1)
            : (height - pad - ((value - min) / span) * usable).toFixed(1);
        return x + ',' + y;
    }).join(' ');
}

function renderSparkline(elementId, values, tone) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const points = buildSparklinePoints(values, 300, 34);
    el.className = 'kpi-tile-spark ' + (tone || 'neutral');
    if (!points) {
        el.innerHTML = '';
        return;
    }
    el.innerHTML = '<svg viewBox="0 0 300 34" preserveAspectRatio="none" width="100%" height="34" aria-hidden="true" focusable="false">' +
        '<polyline fill="none" stroke="currentColor" stroke-width="1.6" vector-effect="non-scaling-stroke" ' +
        'stroke-linejoin="round" stroke-linecap="round" points="' + points + '"></polyline></svg>';
}

// Yıllık değişim: yalnızca İKİ yılda da veri bulunan aylar kıyaslanır. Aksi halde 3 aylık bir yıl,
// 12 aylık önceki yılla kıyaslanıp "-%97" gibi doğru ama anlamsız bir sonuç üretirdi.
function computeYoyDelta(allMonthly, yearStr, valueFn) {
    if (!yearStr || !Array.isArray(allMonthly)) return null;
    const year = parseInt(yearStr, 10);
    if (!Number.isFinite(year)) return null;

    const totalsByMonth = (target) => {
        const map = new Map();
        for (const row of allMonthly) {
            if (extractYearFromMonth(row.month) !== target) continue;
            const monthPart = String(row.month || '').slice(5, 7);
            if (!monthPart) continue;
            map.set(monthPart, (map.get(monthPart) || 0) + valueFn(row));
        }
        return map;
    };

    const current = totalsByMonth(year);
    const previous = totalsByMonth(year - 1);
    if (current.size === 0 || previous.size === 0) return null;

    let currentSum = 0;
    let previousSum = 0;
    let sharedMonths = 0;
    for (const [monthPart, value] of current) {
        if (!previous.has(monthPart)) continue;
        currentSum += value;
        previousSum += previous.get(monthPart);
        sharedMonths++;
    }

    if (sharedMonths === 0 || previousSum === 0) return null;
    const delta = ((currentSum - previousSum) / Math.abs(previousSum)) * 100;
    return Number.isFinite(delta) ? delta : null;
}

function formatDeltaText(pct) {
    if (pct === null || !Number.isFinite(pct)) return '';
    return (pct > 0 ? '+' : '') + pct.toFixed(1).replace('.', ',') + '%';
}

function setTileDelta(elementId, pct, inverse) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = formatDeltaText(pct);
    el.textContent = text;
    el.className = 'kpi-tile-delta ' + (text ? signalToneClass(pct, inverse) : 'neutral');
    if (text) {
        el.title = 'Geçen yılın aynı aylarına göre';
    } else {
        el.removeAttribute('title');
    }
}

function findMarginExtremes(sorted) {
    let best = null;
    let worst = null;
    for (const m of sorted) {
        const sales = MONTHLY_FIELD.sales(m);
        if (sales <= 0) continue;
        const margin = (MONTHLY_FIELD.gross(m) / sales) * 100;
        if (!Number.isFinite(margin)) continue;
        if (!best || margin > best.margin) best = { month: m.month, margin };
        if (!worst || margin < worst.margin) worst = { month: m.month, margin };
    }
    return { best, worst };
}

function formatMarginPoint(point) {
    if (!point) return '—';
    return formatMonthLabel(point.month) + ' · %' + point.margin.toFixed(1).replace('.', ',');
}

function renderCockpitSurfaces(view) {
    const sorted = view.sorted || [];
    const monthCount = sorted.length;

    // Başlık altı bilgi satırı
    const metaEl = document.getElementById('dashboardHeadMeta');
    if (metaEl) {
        const parts = [view.yearDisplay, monthCount + ' analiz'];
        if (monthCount > 0) parts.push('Son ay ' + formatMonthLabel(sorted[monthCount - 1].month));
        metaEl.textContent = parts.join(' · ');
    }

    // KPI mikro grafikleri ve yıllık değişim rozetleri
    renderSparkline('dashSalesSpark', view.salesSeries, 'neutral');
    renderSparkline('dashPurchaseSpark', view.purchaseSeries, 'negative');
    renderSparkline('dashNetProfitSpark', sorted.map(MONTHLY_FIELD.net), view.netProfit < 0 ? 'negative' : 'positive');

    setTileDelta('dashSalesDelta', computeYoyDelta(view.allMonthly, view.yearStr, MONTHLY_FIELD.sales), false);
    setTileDelta('dashPurchaseDelta', computeYoyDelta(view.allMonthly, view.yearStr, MONTHLY_FIELD.purchase), true);
    setTileDelta('dashNetProfitDelta', computeYoyDelta(view.allMonthly, view.yearStr, MONTHLY_FIELD.net), false);

    // KDV kutusu
    const vatValueEl = document.getElementById('dashVatTileValue');
    const vatLabelEl = document.getElementById('dashVatTileLabel');
    const vatHintEl = document.getElementById('dashVatTileHint');
    const vatCard = document.getElementById('dashVatCard');
    if (vatValueEl) {
        vatValueEl.textContent = view.hasAnyVat ? formatCurrency(view.kdvDecisionAmount) : '—';
        vatValueEl.title = view.hasAnyVat ? formatCurrency(view.kdvDecisionAmount) : 'KDV verisi yok';
    }
    if (vatLabelEl) vatLabelEl.textContent = view.kdvLabel || 'Net KDV';
    if (vatHintEl) {
        vatHintEl.textContent = view.kdvStatusLabel === 'Ödenecek'
            ? 'Nakit çıkışı — kâr değil'
            : (view.kdvStatusLabel === 'Devreden' ? 'Sonraki döneme devreder' : 'Mahsup sonrası net durum');
    }
    if (vatCard) {
        vatCard.classList.toggle('payable', view.kdvStatusLabel === 'Ödenecek');
        vatCard.classList.toggle('carryover', view.kdvStatusLabel === 'Devreden');
    }

    const vatSeries = view.hasVatBreakdown
        ? sorted.map(m => (m.sales_vat || 0) - (m.purchase_vat || 0))
        : sorted.map(m => m.total_vat ?? m.totalVat ?? 0);
    renderSparkline('dashVatSpark', vatSeries, view.kdvStatusLabel === 'Devreden' ? 'positive' : 'negative');

    // Ana sahne özeti
    const extremes = findMarginExtremes(sorted);
    const heroPeriod = document.getElementById('dashHeroPeriod');
    const heroValue = document.getElementById('dashHeroValue');
    const heroDelta = document.getElementById('dashHeroDelta');
    const heroMargin = document.getElementById('dashHeroMargin');
    const heroBest = document.getElementById('dashHeroBest');
    const heroWorst = document.getElementById('dashHeroWorst');

    if (heroPeriod) heroPeriod.textContent = view.yearDisplay;
    if (heroValue) {
        // Ana rakam nötr kalır; yönü altındaki değişim satırı taşır (zarar durumu istisna)
        heroValue.textContent = formatCurrency(view.netProfit);
        heroValue.className = 'hero-stat-value' + (view.netProfit < 0 ? ' negative' : '');
    }
    if (heroDelta) {
        const netDelta = computeYoyDelta(view.allMonthly, view.yearStr, MONTHLY_FIELD.net);
        const deltaText = formatDeltaText(netDelta);
        heroDelta.textContent = deltaText ? deltaText + ' · geçen yıl aynı dönem' : '';
        heroDelta.className = 'hero-stat-delta ' + (deltaText ? signalToneClass(netDelta) : 'neutral');
    }
    if (heroMargin) heroMargin.textContent = '%' + view.grossMargin.toFixed(1).replace('.', ',');
    // "En zayıf ay" mutlak olarak zarar demek değildir; kırmızı yalnızca marj gerçekten negatifse
    if (heroBest) {
        heroBest.textContent = formatMarginPoint(extremes.best);
        heroBest.classList.toggle('negative', !!extremes.best && extremes.best.margin < 0);
    }
    if (heroWorst) {
        heroWorst.textContent = formatMarginPoint(extremes.worst);
        heroWorst.classList.toggle('negative', !!extremes.worst && extremes.worst.margin < 0);
    }

    renderRailActions(view, extremes);
}

function renderRailActions(view, extremes) {
    const list = document.getElementById('dashboardRailActionList');
    if (!list) return;

    const items = [];
    const marginSpread = (extremes.best && extremes.worst) ? (extremes.best.margin - extremes.worst.margin) : 0;

    // 1) Maliyet ve marj
    if (view.purchaseTrend === 'yükselen') {
        items.push({
            tone: 'negative',
            title: 'Alış maliyeti yükseliyor',
            body: 'Alış trendi yukarı yönlü' + (marginSpread >= 1
                ? '; brüt marj en iyi ' + formatMarginPoint(extremes.best) + ' iken en zayıf ' + formatMarginPoint(extremes.worst) + ' seviyesine indi.'
                : '. Marj etkisini tedarikçi bazında kontrol edin.'),
            cta: 'Tedarikçi kırılımını aç',
            tab: 'suppliers'
        });
    } else {
        items.push({
            tone: view.purchaseTrend === 'düşen' ? 'positive' : 'neutral',
            title: 'Maliyet tarafı ' + (view.purchaseTrend === 'düşen' ? 'geriliyor' : 'yatay seyrediyor'),
            body: 'Brüt marj %' + view.grossMargin.toFixed(1).replace('.', ',') +
                (extremes.worst ? '; en zayıf ay ' + formatMarginPoint(extremes.worst) + '.' : '.'),
            cta: 'Tedarikçi kırılımını aç',
            tab: 'suppliers'
        });
    }

    // 2) KDV
    const vatShare = view.totalSales > 0 ? (view.kdvDecisionAmount / view.totalSales) * 100 : 0;
    if (view.kdvStatusLabel === 'Ödenecek') {
        items.push({
            tone: 'warning',
            title: 'Ödenecek KDV cironun %' + vatShare.toFixed(1).replace('.', ',') + "'i",
            body: 'Mahsup sonrası ' + formatCurrency(view.kdvDecisionAmount) + ' ödeme çıkıyor. Ay sonu nakit planında ayrı satır olarak tutulmalı.',
            cta: 'KDV özetini gör',
            scroll: '#dashKdvNetItem'
        });
    } else if (view.kdvStatusLabel === 'Devreden') {
        items.push({
            tone: 'positive',
            title: 'Devreden KDV avantajı var',
            body: formatCurrency(view.kdvDecisionAmount) + ' tutarındaki devreden KDV sonraki dönemde mahsup edilecek.',
            cta: 'KDV özetini gör',
            scroll: '#dashKdvNetItem'
        });
    } else {
        items.push({
            tone: 'neutral',
            title: 'KDV tarafı nötr',
            body: view.hasAnyVat ? 'Mahsup sonrası ödenecek KDV oluşmuyor.' : 'Yüklenen dosyalarda KDV kırılımı bulunmuyor.',
            cta: 'KDV özetini gör',
            scroll: '#dashKdvNetItem'
        });
    }

    // 3) Satış trendi
    const salesToneMap = { 'yükselen': 'positive', 'düşen': 'negative' };
    items.push({
        tone: salesToneMap[view.salesTrend] || 'neutral',
        title: 'Satış trendi ' + (view.salesTrend === 'yükselen' ? 'ivme kazanıyor' : (view.salesTrend === 'düşen' ? 'zayıflıyor' : 'yatay')),
        body: view.netProfit >= 0
            ? 'Dönem net kârla kapanıyor: ' + formatCurrency(view.netProfit) + '.'
            : 'Dönem net zararda: ' + formatCurrency(Math.abs(view.netProfit)) + '. Gider kalemlerini inceleyin.',
        cta: '3 aylık tahmini gör',
        tab: 'predictions'
    });

    list.innerHTML = items.map(item => {
        const target = item.tab
            ? ' data-rail-tab="' + escapeAttribute(item.tab) + '"'
            : ' data-rail-scroll="' + escapeAttribute(item.scroll) + '"';
        return '<div class="rail-action ' + item.tone + '">' +
            '<span class="rail-action-dot" aria-hidden="true"></span>' +
            '<div class="rail-action-body">' +
                '<div class="rail-action-title">' + escapeHtml(item.title) + '</div>' +
                '<p class="rail-action-text">' + escapeHtml(item.body) + '</p>' +
                '<button type="button" class="rail-action-cta"' + target + '>' + escapeHtml(item.cta) + '</button>' +
            '</div>' +
        '</div>';
    }).join('');

    bindRailActions();
}

let _railActionsBound = false;
function bindRailActions() {
    if (_railActionsBound) return;
    const list = document.getElementById('dashboardRailActionList');
    if (!list) return;
    list.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-rail-tab], [data-rail-scroll]');
        if (!trigger) return;
        const tab = trigger.getAttribute('data-rail-tab');
        if (tab) {
            switchTab(tab);
            return;
        }
        const selector = trigger.getAttribute('data-rail-scroll');
        const target = selector ? document.querySelector(selector) : null;
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    _railActionsBound = true;
}

// ===== Dashboard Widget Config (Sıralama & Göster/Gizle) =====
const WIDGET_CONFIG_KEY = 'dashboardWidgetConfigV2';
const DEFAULT_WIDGET_CONFIG = [
    // Ana kolon
    { id: 'widget-stats', label: 'İstatistik Kartları', visible: true },
    { id: 'widget-chart', label: 'Aylık Satış Grafiği', visible: true },
    { id: 'widget-pl', label: 'Kar/Zarar Analizi', visible: true },
    { id: 'widget-ratios', label: 'Finansal Sağlık Göstergeleri', visible: true },
    { id: 'widget-subtotal', label: 'KDV Hariç Ciro', visible: true },
    { id: 'widget-delta', label: 'Aylık Değişimler', visible: true },
    { id: 'widget-anomaly', label: 'Dikkat Çeken Noktalar', visible: true },
    { id: 'widget-recent', label: 'Son Eklenen Analizler', visible: true },
    { id: 'widget-actions', label: 'Hızlı İşlemler', visible: true },
    // Sağ karar paneli
    { id: 'widget-forecast', label: 'Tahmin Özeti', visible: true },
    { id: 'widget-kdv', label: 'KDV Özeti', visible: true },
    { id: 'widget-customers', label: 'Cari Özeti', visible: true }
];

function getWidgetConfig() {
    try {
        const stored = localStorage.getItem(WIDGET_CONFIG_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const known = new Set(parsed.map(item => item.id));
                const missing = DEFAULT_WIDGET_CONFIG.filter(item => !known.has(item.id));
                return parsed.concat(missing);
            }
        }
    } catch (_) { /* ignore */ }
    return JSON.parse(JSON.stringify(DEFAULT_WIDGET_CONFIG));
}

function saveWidgetConfig(config) {
    localStorage.setItem(WIDGET_CONFIG_KEY, JSON.stringify(config));
}

function applyDashboardWidgetConfig() {
    const config = getWidgetConfig();
    const dashboard = document.getElementById('dashboardSection');
    if (!dashboard) return;

    const configPanel = document.getElementById('dashboardWidgetConfig');
    const overviewPanel = dashboard.querySelector('.dashboard-overview-panel');

    // Kokpit düzeninde widget'lar iki şeride dağılır (ana kolon + sağ karar paneli).
    // Her şerit kendi içinde sıralanır; şeridin başlangıcı [data-widget-anchor] ile işaretlenir.
    const laneCursor = new Map();
    const cursorFor = (parent) => {
        if (!laneCursor.has(parent)) {
            laneCursor.set(parent, parent.querySelector(':scope > [data-widget-anchor]') || null);
        }
        return laneCursor.get(parent);
    };

    for (const w of config) {
        const el = dashboard.querySelector('[data-widget-id="' + w.id + '"]');
        if (!el || el === configPanel || el === overviewPanel) continue;

        // Apply visibility: dynamic sections only hide if user hid them
        const isDynamic = (w.id === 'widget-delta' || w.id === 'widget-anomaly');
        if (isDynamic) {
            // Dynamic sections have their own display logic; only force-hide if user says so
            if (!w.visible) el.style.display = 'none';
            // If visible, leave it to whatever the dynamic creator set
        } else {
            el.style.display = w.visible ? '' : 'none';
        }

        const parent = el.parentNode;
        if (!parent || parent.nodeType !== 1) continue;
        const cursor = cursorFor(parent);
        const nextSibling = cursor ? cursor.nextElementSibling : parent.firstElementChild;
        if (nextSibling !== el) {
            parent.insertBefore(el, nextSibling);
        }
        laneCursor.set(parent, el);
    }
}

function toggleDashboardWidgetConfig() {
    const panel = document.getElementById('dashboardWidgetConfig');
    if (!panel) return;
    const isOpen = panel.style.display !== 'none';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) renderWidgetConfigPanel();
}

function renderWidgetConfigPanel() {
    const list = document.getElementById('dashboardWidgetConfigList');
    if (!list) return;
    const config = getWidgetConfig();
    const hiddenIds = new Set(config.filter(w => !w.visible).map(w => w.id));

    list.innerHTML = config.map((w, idx) => {
        const visible = w.visible;
        const checked = visible ? 'checked' : '';
        return '<div class="dashboard-widget-config-item" draggable="true" data-widget-idx="' + idx + '">' +
            '<span class="dashboard-widget-config-drag" title="Sürükle">⠿</span>' +
            '<label class="dashboard-widget-config-label">' +
            '<input type="checkbox" ' + checked + ' onchange="toggleWidgetVisibility(\'' + w.id + '\', this.checked)">' +
            '<span>' + escapeHtml(w.label) + '</span>' +
            '</label>' +
            '<div class="dashboard-widget-config-arrows">' +
            '<button type="button" class="widget-config-arrow" onclick="moveWidget(\'' + w.id + '\', -1)" title="Yukarı taşı" ' + (idx === 0 ? 'disabled' : '') + '>↑</button>' +
            '<button type="button" class="widget-config-arrow" onclick="moveWidget(\'' + w.id + '\', 1)" title="Aşağı taşı" ' + (idx === config.length - 1 ? 'disabled' : '') + '>↓</button>' +
            '</div>' +
            '</div>';
    }).join('');

    // Attach drag/drop event listeners
    const items = list.querySelectorAll('.dashboard-widget-config-item');
    items.forEach(item => {
        item.addEventListener('dragstart', handleWidgetDragStart);
        item.addEventListener('dragover', handleWidgetDragOver);
        item.addEventListener('drop', handleWidgetDrop);
        item.addEventListener('dragend', handleWidgetDragEnd);
    });
}

let _dragWidgetIdx = null;

function handleWidgetDragStart(e) {
    _dragWidgetIdx = parseInt(e.target.closest('.dashboard-widget-config-item').dataset.widgetIdx, 10);
    e.dataTransfer.effectAllowed = 'move';
    e.target.closest('.dashboard-widget-config-item').classList.add('dragging');
}

function handleWidgetDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.dashboard-widget-config-item');
    if (target) target.classList.add('drag-over');
}

function handleWidgetDrop(e) {
    e.preventDefault();
    const targetIdx = parseInt(e.target.closest('.dashboard-widget-config-item').dataset.widgetIdx, 10);
    if (_dragWidgetIdx === null || _dragWidgetIdx === targetIdx) return;
    const config = getWidgetConfig();
    const [moved] = config.splice(_dragWidgetIdx, 1);
    config.splice(targetIdx, 0, moved);
    saveWidgetConfig(config);
    renderWidgetConfigPanel();
    applyDashboardWidgetConfig();
}

function handleWidgetDragEnd(e) {
    e.target.closest('.dashboard-widget-config-item')?.classList.remove('dragging');
    document.querySelectorAll('.dashboard-widget-config-item').forEach(el => el.classList.remove('drag-over'));
    _dragWidgetIdx = null;
}

function toggleWidgetVisibility(widgetId, visible) {
    const config = getWidgetConfig();
    const w = config.find(c => c.id === widgetId);
    if (w) {
        w.visible = visible;
        saveWidgetConfig(config);
        applyDashboardWidgetConfig();
    }
}

function moveWidget(widgetId, direction) {
    const config = getWidgetConfig();
    const idx = config.findIndex(c => c.id === widgetId);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= config.length) return;
    const [moved] = config.splice(idx, 1);
    config.splice(newIdx, 0, moved);
    saveWidgetConfig(config);
    renderWidgetConfigPanel();
    applyDashboardWidgetConfig();
}

function detectAnomalyClient(current, average) {
    const fields = [
        { key: 'total_sales', label: 'Satış' },
        { key: 'total_purchases', label: 'Alış' },
        { key: 'gross_profit', label: 'Kâr' }
    ];
    const alerts = [];
    for (const f of fields) {
        const curr = current[f.key] || 0;
        const avg = average[f.key] || 0;
        if (avg === 0) continue;
        const deviation = ((curr - avg) / Math.abs(avg)) * 100;
        if (Math.abs(deviation) > 30) {
            alerts.push({
                field: f.label,
                current: curr,
                average: avg,
                deviation: Math.round(deviation * 10) / 10,
                direction: deviation > 0 ? 'above' : 'below'
            });
        }
    }
    return alerts;
}

function renderAnomalySection(monthly) {
    let container = document.getElementById('dashboardAnomalySection');

    const sorted = monthly.slice().sort((a, b) => a.month.localeCompare(b.month));

    if (sorted.length < 2) {
        if (container) container.style.display = 'none';
        return;
    }

    const latest = sorted[sorted.length - 1];

    const avg = { total_sales: 0, total_purchases: 0, gross_profit: 0 };
    for (const m of sorted) {
        avg.total_sales += m.total_sales || 0;
        avg.total_purchases += m.total_purchases || 0;
        avg.gross_profit += m.gross_profit || 0;
    }
    const count = sorted.length;
    avg.total_sales /= count;
    avg.total_purchases /= count;
    avg.gross_profit /= count;

    const current = {
        total_sales: latest.total_sales || 0,
        total_purchases: latest.total_purchases || 0,
        gross_profit: latest.gross_profit || 0
    };

    const alerts = detectAnomalyClient(current, avg);

    if (!container) {
        container = document.createElement('div');
        container.id = 'dashboardAnomalySection';
        container.className = 'dashboard-priorities-section';
        container.setAttribute('data-widget-id', 'widget-anomaly');
        const deltaSection = document.getElementById('dashboardDeltaSection');
        const insertAfter = deltaSection || document.querySelector('.dashboard-chart-section');
        if (insertAfter && insertAfter.nextElementSibling) {
            insertAfter.parentNode.insertBefore(container, insertAfter.nextElementSibling);
        } else {
            // Kokpit düzeninde widget'lar ana şeridin içinde yaşar; şerit dışına düşmesin
            const lane = document.querySelector('.dashboard-cockpit-main') || document.getElementById('dashboardSection');
            lane.appendChild(container);
        }
    }

    if (alerts.length === 0) {
        alerts.push({
            field: 'Kâr',
            current: current.gross_profit,
            average: avg.gross_profit,
            deviation: 0,
            direction: current.gross_profit >= 0 ? 'above' : 'below',
            steady: true
        });
    }

    container.style.display = 'block';
    const latestLabel = formatMonthLabel(latest.month);

    const priorityCards = alerts.slice(0, 3);

    let html = '<div class="section-subheader"><div><h3>İşletme İçin Öncelikler</h3><span class="section-subhint">' + escapeHtml(latestLabel) + ' verileri dönem ortalamasıyla karşılaştırıldı.</span></div></div>';
    html += '<div class="dashboard-priority-grid columns-' + priorityCards.length + '">';

    for (const a of priorityCards) {
        const tone = a.field === 'Alış'
            ? (a.direction === 'above' ? 'warning' : 'positive')
            : (a.direction === 'below' ? 'negative' : 'positive');
        const dirText = a.steady ? 'dönem sonucu' : (a.direction === 'above' ? 'ortalamanın üzerinde' : 'ortalamanın altında');
        const why = a.field === 'Alış'
            ? 'Maliyet tarafı kâr marjını etkiler.'
            : (a.field === 'Satış' ? 'Ciro ivmesi nakit akışını belirler.' : 'Kârlılık sürdürülebilirliği gösterir.');
        const action = a.field === 'Alış'
            ? 'Tedarik ve fiyat kırılımını kontrol et.'
            : (a.field === 'Satış'
                ? (a.direction === 'below' ? 'Düşük satış ayının nedenini incele.' : 'Yüksek satış ayındaki müşteri/ürünleri incele.')
                : (a.current < 0 ? 'Zarar eden ayları ve giderleri incele.' : 'Kârlı ayların ortak nedenlerini bul.'));
        const headline = a.steady
            ? (a.current >= 0 ? 'Kâr ortalama çizgisinde' : 'Kâr riski var')
            : `${a.field} ${dirText}`;
        html += '<div class="dashboard-priority-card ' + tone + '">' +
            '<span class="priority-label">' + escapeHtml(a.field) + '</span>' +
            '<strong>' + escapeHtml(headline) + '</strong>' +
            '<span class="priority-value">' + formatCurrency(a.current) + ' <small>ort. ' + formatCurrency(a.average) + '</small></span>' +
            '<p>' + escapeHtml(why) + '</p>' +
            '<em>' + escapeHtml(action) + '</em>' +
        '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}

function detectTrendClient(series) {
    if (!series || series.length < 2) return 'yatay';
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
    if (slope > threshold) return 'yükselen';
    if (slope < -threshold) return 'düşen';
    return 'yatay';
}

function trendBadge(trend) {
    if (trend === 'yükselen') return '<span class="trend-glyph positive" title="Yükselen trend">↑</span>';
    if (trend === 'düşen') return '<span class="trend-glyph negative" title="Düşen trend">↓</span>';
    return '<span class="trend-glyph neutral" title="Yatay trend">→</span>';
}

function trendLabel(trend) {
    if (trend === 'yükselen') return 'Yükselen';
    if (trend === 'düşen') return 'Düşen';
    return 'Yatay';
}

function signalToneClass(value, inverse) {
    if (value === 0) return 'neutral';
    const positive = inverse ? value < 0 : value > 0;
    return positive ? 'positive' : 'negative';
}

function classifyMargin(value) {
    const n = parseFloat(value) || 0;
    if (n >= 20) return { label: 'Güçlü', tone: 'positive' };
    if (n >= 8) return { label: 'Takipte', tone: 'neutral' };
    if (n >= 0) return { label: 'Dikkat', tone: 'warning' };
    return { label: 'Risk', tone: 'negative' };
}

function classifyExpenseRatio(value) {
    const n = parseFloat(value) || 0;
    if (n === 0) return { label: 'Nötr', tone: 'neutral' };
    if (n <= 10) return { label: 'Güçlü', tone: 'positive' };
    if (n <= 25) return { label: 'Takipte', tone: 'neutral' };
    return { label: 'Dikkat', tone: 'warning' };
}

function classifyVatBurden(value) {
    const n = parseFloat(value) || 0;
    if (n === 0) return { label: 'Nötr', tone: 'neutral' };
    if (n <= 8) return { label: 'Takipte', tone: 'neutral' };
    return { label: 'Dikkat', tone: 'warning' };
}

function getSeriesMaxPoint(monthly, key, fallbackKey) {
    const rows = monthly
        .map(m => ({ month: m.month, value: m[key] ?? m[fallbackKey] ?? 0 }))
        .filter(r => r.value !== 0);
    if (rows.length === 0) return null;
    return rows.sort((a, b) => b.value - a.value)[0];
}

function formatMonthLabel(yyyyMM) {
    if (!yyyyMM) return '';
    const parts = yyyyMM.split('-');
    if (parts.length < 2) return yyyyMM;
    const monthNames = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const mIndex = parseInt(parts[1], 10) - 1;
    return (monthNames[mIndex] || parts[1]) + ' ' + parts[0];
}

function extractYearFromMonth(monthStr) {
    if (!monthStr) return null;
    // "YYYY-MM" format
    const match = monthStr.match(/^(\d{4})/);
    if (match) return parseInt(match[1], 10);
    // TODO: diger formatlari desteklemek icin buraya ekleme yapilabilir (orn "Oca 25")
    return null;
}

function calculateDeltaClient(prevSummary, currentSummary) {
    const fields = [
        { key: 'total_sales', label: 'Satış' },
        { key: 'total_purchases', label: 'Alış' },
        { key: 'gross_profit', label: 'Kâr' },
        { key: 'total_vat', label: 'KDV' }
    ];

    return fields
        .map(f => {
            const prev = prevSummary[f.key] || 0;
            const curr = currentSummary[f.key] || 0;
            const diff = curr - prev;
            const pct = prev !== 0 ? (diff / Math.abs(prev)) * 100 : (curr !== 0 ? 100 : 0);
            return { field: f.label, previous: prev, current: curr, diff, pct: Math.round(pct * 10) / 10 };
        })
        .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
        .slice(0, 3);
}

function renderDeltaSection(monthly) {
    const sorted = monthly.slice().sort((a, b) => a.month.localeCompare(b.month));

    let container = document.getElementById('dashboardDeltaSection');

    if (sorted.length < 2) {
        if (container) container.style.display = 'none';
        return;
    }

    const prev = sorted[sorted.length - 2];
    const curr = sorted[sorted.length - 1];

    const prevSummary = { total_sales: prev.total_sales, total_purchases: prev.total_purchases, total_vat: prev.total_vat, gross_profit: prev.gross_profit };
    const currSummary = { total_sales: curr.total_sales, total_purchases: curr.total_purchases, total_vat: curr.total_vat, gross_profit: curr.gross_profit };

    const deltas = ['gross_profit', 'total_sales', 'total_vat'].map(key => {
        const labelMap = { gross_profit: 'Kâr', total_sales: 'Satış', total_vat: 'KDV' };
        const prevValue = prevSummary[key] || 0;
        const currValue = currSummary[key] || 0;
        const diff = currValue - prevValue;
        const pct = prevValue !== 0 ? (diff / Math.abs(prevValue)) * 100 : (currValue !== 0 ? 100 : 0);
        return { field: labelMap[key], previous: prevValue, current: currValue, diff, pct: Math.round(pct * 10) / 10 };
    });

    if (!container) {
        container = document.createElement('div');
        container.id = 'dashboardDeltaSection';
        container.className = 'dashboard-recent-section';
        container.setAttribute('data-widget-id', 'widget-delta');
        const chartSection = document.querySelector('.dashboard-chart-section');
        if (chartSection && chartSection.nextElementSibling) {
            chartSection.parentNode.insertBefore(container, chartSection.nextElementSibling);
        } else {
            // Kokpit düzeninde widget'lar ana şeridin içinde yaşar; şerit dışına düşmesin
            const lane = document.querySelector('.dashboard-cockpit-main') || document.getElementById('dashboardSection');
            lane.appendChild(container);
        }
    }

    container.style.display = 'block';

    const prevLabel = formatMonthLabel(prev.month);
    const currLabel = formatMonthLabel(curr.month);

    let html = '<div class="section-subheader"><div><h3>Son Analize Göre Değişimler</h3><span class="section-subhint">' + escapeHtml(prevLabel) + ' → ' + escapeHtml(currLabel) + '</span></div></div>';
    html += '<div class="dashboard-trend-cards">';

    for (const d of deltas) {
        const isVat = d.field === 'KDV';
        const tone = signalToneClass(d.diff, isVat);
        const icon = d.diff > 0 ? '↑' : (d.diff < 0 ? '↓' : '→');
        const comment = d.field === 'Kâr'
            ? (d.diff > 0 ? 'Kâr artışta' : (d.diff < 0 ? 'Kâr baskı altında' : 'Kâr yatay'))
            : (d.field === 'Satış'
                ? (d.diff > 0 ? 'Satış ivmesi pozitif' : (d.diff < 0 ? 'Satış ivmesi zayıf' : 'Satış yatay'))
                : (d.diff > 0 ? 'KDV yükü yükseldi' : (d.diff < 0 ? 'KDV yükü azaldı' : 'KDV yükü yatay')));
        html += '<div class="dashboard-trend-card ' + tone + '">' +
            '<span class="trend-card-label">' + escapeHtml(d.field) + '</span>' +
            '<strong>' + icon + ' ' + formatPercent(Math.abs(d.pct)) + '</strong>' +
            '<span class="trend-card-diff">' + formatCurrency(d.diff) + '</span>' +
            '<span class="trend-card-comment">' + escapeHtml(comment) + '</span>' +
        '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
}

// Chart instance reference
let salesTrendChartInstance = null;

function renderChartInsights(monthly, salesData, purchasesData, netProfitData) {
    const container = document.getElementById('dashboardChartInsights');
    if (!container) return;
    if (!monthly || monthly.length === 0) {
        container.innerHTML = '';
        return;
    }

    const maxSales = getSeriesMaxPoint(monthly, 'total_sales', 'totalSales');
    const maxProfitIndex = netProfitData.reduce((best, value, index) => value > netProfitData[best] ? index : best, 0);
    const avgSales = salesData.reduce((s, v) => s + v, 0) / Math.max(1, salesData.length);
    const latestIndex = monthly.length - 1;
    const latestSales = salesData[latestIndex] || 0;
    const latestProfit = netProfitData[latestIndex] || 0;
    const latestPurchases = purchasesData[latestIndex] || 0;

    const insights = [
        maxSales ? {
            label: 'En yüksek satış',
            value: formatMonthLabel(maxSales.month),
            hint: formatCurrency(maxSales.value),
            tone: 'positive'
        } : null,
        {
            label: 'En yüksek net kâr',
            value: formatMonthLabel(monthly[maxProfitIndex]?.month),
            hint: formatCurrency(netProfitData[maxProfitIndex] || 0),
            tone: (netProfitData[maxProfitIndex] || 0) >= 0 ? 'positive' : 'negative'
        },
        {
            label: 'Son ay sinyali',
            value: latestProfit >= 0 ? 'Kârda' : 'Zararda',
            hint: latestSales >= avgSales ? 'Satış ortalamanın üstünde' : 'Satış ortalamanın altında',
            tone: latestProfit >= 0 && latestSales >= latestPurchases ? 'positive' : 'warning'
        }
    ].filter(Boolean);

    container.innerHTML = insights.map(item => (
        '<div class="chart-insight ' + item.tone + '">' +
            '<span>' + escapeHtml(item.label) + '</span>' +
            '<strong>' + escapeHtml(item.value || '-') + '</strong>' +
            '<em>' + escapeHtml(item.hint || '') + '</em>' +
        '</div>'
    )).join('');
}

function renderMonthlyTurnoverChart(monthly) {
    const canvas = document.getElementById('salesTrendChart');
    if (!canvas) return;
    const rootStyles = getComputedStyle(document.documentElement);
    const axisColor = rootStyles.getPropertyValue('--text-muted').trim() || rootStyles.getPropertyValue('--text-secondary').trim() || '#888';
    const gridColor = rootStyles.getPropertyValue('--border-color').trim() || 'rgba(0, 0, 0, 0.08)';
    const tooltipSurface = rootStyles.getPropertyValue('--tooltip-bg').trim()
        || rootStyles.getPropertyValue('--popover').trim()
        || 'rgba(0, 0, 0, 0.9)';

    if (salesTrendChartInstance) {
        salesTrendChartInstance.destroy();
    }

    const sortedMonthly = monthly.slice().sort((a, b) => (a.month || '').localeCompare(b.month || ''));
    const labels = sortedMonthly.map(m => formatMonthLabel(m.month));
    const salesData = sortedMonthly.map(m => m.total_sales || 0);
    const salesMA = calculateMovingAverage(salesData, 3);
    const purchasesData = sortedMonthly.map(m => m.total_purchases || 0);
    const expensesData = sortedMonthly.map(m => m.expenses || 0);
    const netProfitData = sortedMonthly.map(m => (m.gross_profit ?? (m.total_sales || 0) - (m.total_purchases || 0)) - (m.expenses || 0));

    const hasExpenses = expensesData.some(v => v > 0);
    const isPieChart = currentChartType === 'pie';
    const datasets = [
        {
            label: 'Satış',
            data: salesData,
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.14)',
            tension: 0.28,
            fill: false,
            pointRadius: 4,
            pointHoverRadius: 6
        },
        {
            label: 'Alış',
            data: purchasesData,
            borderColor: '#d97706',
            backgroundColor: 'rgba(217, 119, 6, 0.1)',
            tension: 0.28,
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 5
        },
        {
            label: 'Net Kâr',
            data: netProfitData,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            tension: 0.28,
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 5
        }
    ];
    if (hasExpenses) {
        datasets.push({
            label: 'Gider',
            data: expensesData,
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            tension: 0.3,
            fill: false,
            pointRadius: 3,
            pointHoverRadius: 5
        });
    }

    const chartSubtitle = document.getElementById('dashboardChartSubtitle');
    if (chartSubtitle) {
        chartSubtitle.textContent = isPieChart ? 'Satışların aylara göre dağılımı' : 'Satış, alış ve net kâr aynı zaman çizgisinde';
    }

    renderChartInsights(sortedMonthly, salesData, purchasesData, netProfitData);

    // Prepare datasets based on chart type
    
    // For pie chart, restructure data to show monthly totals as pie slices
    let chartDatasets;
    let chartLabels;
    let chartOptions;
    
    if (isPieChart) {
        // Pie chart: one dataset with all monthly data as slices
        chartLabels = labels;
        chartDatasets = [{
            label: 'Aylık Satış Cirosu',
            data: salesData,
            backgroundColor: [
                'rgba(5, 150, 105, 0.8)',
                'rgba(29, 78, 216, 0.8)',
                'rgba(217, 119, 6, 0.8)',
                'rgba(139, 92, 246, 0.8)',
                'rgba(236, 72, 153, 0.8)',
                'rgba(34, 197, 94, 0.8)',
                'rgba(249, 115, 22, 0.8)',
                'rgba(99, 102, 241, 0.8)',
                'rgba(236, 195, 68, 0.8)',
                'rgba(163, 163, 163, 0.8)',
                'rgba(14, 165, 233, 0.8)',
                'rgba(244, 63, 94, 0.8)'
            ],
            borderColor: '#ffffff',
            borderWidth: 2
        }];
        chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'right'
                },
                tooltip: {
                    backgroundColor: tooltipSurface,
                    titleFont: { family: 'Inter', weight: '500' },
                    bodyFont: { family: 'Inter' },
                    padding: 12,
                    cornerRadius: 6,
                    callbacks: {
                        label: function (context) {
                            const value = context.raw || 0;
                            return context.label + ': ' + formatCurrency(value);
                        }
                    }
                }
            }
        };
    } else {
        // Line/Bar chart: original multi-dataset structure
        chartLabels = labels;
        chartDatasets = [];
        if (salesMA.some(v => v !== null)) {
            chartDatasets.push({
                label: '3 Aylık Hareketli Ort.',
                type: 'line',
                data: salesMA,
                borderColor: '#059669',
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [6, 3],
                tension: 0.4,
                fill: false,
                pointRadius: 0,
                pointHoverRadius: 0,
                order: -1
            });
        }
        chartDatasets.push(...datasets.map(ds => Object.assign({}, ds, {
            backgroundColor: currentChartType === 'bar'
                ? (ds.label === 'Satış' ? 'rgba(5, 150, 105, 0.55)'
                    : (ds.label === 'Alış' ? 'rgba(217, 119, 6, 0.55)'
                        : (ds.label === 'Net Kâr' ? 'rgba(56, 189, 248, 0.55)' : 'rgba(239, 68, 68, 0.55)')))
                : ds.backgroundColor,
            fill: false,
            pointRadius: currentChartType === 'line' ? ds.pointRadius : 0,
            borderRadius: currentChartType === 'bar' ? 5 : 0
        })));
        chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    backgroundColor: tooltipSurface,
                    titleFont: { family: 'Inter', weight: '500' },
                    bodyFont: { family: 'Inter' },
                    padding: 12,
                    cornerRadius: 6,
                    callbacks: {
                        label: function (context) {
                            return (context.dataset.label || '') + ': ' + formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: axisColor
                    }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        font: { family: 'Inter', size: 11 },
                        color: axisColor,
                        callback: function (value) {
                            return '₺' + (value / 1000).toFixed(0) + 'K';
                        }
                    }
                }
            }
        };
    }
    
    salesTrendChartInstance = new Chart(canvas, {
        type: currentChartType,
        data: {
            labels: chartLabels,
            datasets: chartDatasets
        },
        options: Object.assign({}, chartOptions, {
            onClick: function (e, elements) {
                if (!elements || elements.length === 0) return;
                const idx = elements[0].index;
                const rawMonth = sortedMonthly[idx]?.month;
                if (!rawMonth) return;
                const [y, m] = rawMonth.split('-');
                showMonthDrillDown(rawMonth, y, m);
            }
        })
    });
}

// Chart noktası tıklanınca o ayın analiz kayıtlarını modal'da göster
async function showMonthDrillDown(rawMonth, year, month) {
    const modal = document.getElementById('analysisDetailModal');
    const body = document.getElementById('analysisDetailBody');
    const titleEl = document.getElementById('analysisDetailModalTitle');
    const fullBtn = document.getElementById('analysisDetailViewFullBtn');
    if (!modal || !body || !titleEl) return;

    const monthName = formatMonthLabel(rawMonth);
    titleEl.textContent = monthName + ' — Detaylı Analizler';

    if (fullBtn) {
        fullBtn.style.display = 'none';
    }

    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-secondary)">Yükleniyor...</div>';
    modal.style.display = 'flex';

    try {
        const res = await fetch(`/api/history?year=${year}&month=${month}&limit=200&sort=date_desc`);
        const data = await res.json();

        if (!data.success || !data.history || data.history.length === 0) {
            body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">Bu aya ait kayıt bulunamadı.</div>';
            return;
        }

        let html = `<div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead>
                    <tr style="border-bottom:1px solid var(--border-color);text-align:left">
                        <th style="padding:8px 6px">Tarih</th>
                        <th style="padding:8px 6px">Dosya</th>
                        <th style="padding:8px 6px;text-align:right">Satış (₺)</th>
                        <th style="padding:8px 6px;text-align:right">Alış (₺)</th>
                        <th style="padding:8px 6px;text-align:right">KDV (₺)</th>
                        <th style="padding:8px 6px;text-align:right">Net Kâr (₺)</th>
                    </tr>
                </thead>
                <tbody>`;

        for (const entry of data.history) {
            const dateStr = entry.displayDate || (entry.date ? new Date(entry.date).toLocaleDateString('tr-TR') : '');
            const fname = entry.salesFileName || entry.purchaseFileName || '—';
            const sales = entry.salesAmount || 0;
            const purchase = entry.purchaseAmount || 0;
            const vat = (entry.salesTax || 0) + (entry.purchaseTax || 0);
            const profit = entry.netProfit || 0;
            html += `<tr style="border-bottom:1px solid var(--border-color)">
                <td style="padding:6px;white-space:nowrap">${dateStr}</td>
                <td style="padding:6px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${fname}</td>
                <td style="padding:6px;text-align:right;color:var(--success)">${formatCurrency(sales)}</td>
                <td style="padding:6px;text-align:right">${formatCurrency(purchase)}</td>
                <td style="padding:6px;text-align:right">${formatCurrency(vat)}</td>
                <td style="padding:6px;text-align:right;color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(profit)}</td>
            </tr>`;
        }

        html += `</tbody></table></div>
            <div style="margin-top:12px;font-size:12px;color:var(--text-muted)">Toplam ${data.history.length} kayıt</div>`;

        body.innerHTML = html;
    } catch (err) {
        body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--danger)">Veri yüklenirken hata oluştu.</div>';
    }
}

// ========================================
// Predictions Functions
// ========================================
async function loadPredictions() {
    const loadingEl = document.querySelector('.prediction-loading');
    const contentEl = document.querySelector('.prediction-content');
    const period = document.getElementById('predictionPeriodSelect')?.value || '12';
    const model = document.getElementById('predictionModelSelect')?.value || 'auto';

    if (loadingEl) {
        loadingEl.innerHTML = '<span class="loading-spinner">•</span><p>Veriler analiz ediliyor...</p>';
        loadingEl.style.display = 'block';
    }
    if (contentEl) contentEl.style.display = 'none';

    try {
        const response = await fetch(`/api/predictions?period=${encodeURIComponent(period)}&model=${encodeURIComponent(model)}`);
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }

        const data = await response.json();

        if (data.success && data.prediction && data.prediction.predictions.length > 0) {
            const predData = data.prediction;
            const firstPred = predData.predictions[0];
            const horizon3 = (predData.forecastHorizons || []).find(item => item.months === 3);
            const forecastTotal = horizon3?.total || predData.predictions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
            const growthPct = getPredictionGrowthPct(predData, data, firstPred);
            const confidenceScore = Math.round(predData.confidence || 0);

            // 1. Update Stats Cards
            const amountEl = document.getElementById('predAmount');
            if (amountEl) amountEl.textContent = formatCurrency(forecastTotal);
            setText('predAmountHint', `${predData.predictions.length} ayın toplam satış beklentisi`);

            // Trend Indicator
            const trendEl = document.getElementById('predTrend');
            if (trendEl) {
                if (predData.trend === 'up') {
                    trendEl.className = 'prediction-trend up';
                    trendEl.innerHTML = '<span class="trend-icon">+</span> <span class="trend-text">Artış</span>';
                } else if (predData.trend === 'down') {
                    trendEl.className = 'prediction-trend down';
                    trendEl.innerHTML = '<span class="trend-icon">-</span> <span class="trend-text">Düşüş</span>';
                } else {
                    trendEl.className = 'prediction-trend';
                    trendEl.innerHTML = '<span class="trend-icon">•</span> <span class="trend-text">Nötr</span>';
                }
            }

            // Ort. Aylık Büyüme — backend'deki gerçek formül (bileşik aylık büyüme CMGR); yoksa son 3 aya göre değişim
            const growthEl = document.getElementById('predGrowth');
            if (growthEl) {
                growthEl.textContent = (growthPct > 0 ? '+' : '') + Number(growthPct).toFixed(1) + '%';
                growthEl.style.color = growthPct >= 0 ? 'var(--success)' : 'var(--danger)';
            }
            setText('predGrowthHint', growthPct > 0 ? 'Satış ivmesi pozitif' : growthPct < 0 ? 'Satış ivmesi zayıflıyor' : 'Satış ritmi yatay');

            // Confidence
            const confEl = document.getElementById('predConfidence');
            const confBar = document.getElementById('predConfidenceBar');
            if (confEl) {
                confEl.textContent = `%${confidenceScore}`;
                if (confBar) confBar.style.width = `${confidenceScore}%`;
            }
            setText('predConfidenceHint', getConfidenceExplanation(confidenceScore));

            // 2. Render Table (multi-series)
            const tbody = document.getElementById('predictionTableBody');
            if (tbody) {
                const purchasePreds = predData.purchasePredictions || [];
                const profitPreds = predData.profitPredictions || [];

                tbody.innerHTML = predData.predictions.map((p, i) => {
                    const monthName = getMonthName(parseInt(p.month.split('-')[1])) + ' ' + p.month.split('-')[0];
                    const purchaseAmt = purchasePreds[i]?.amount || 0;
                    const profitAmt = profitPreds[i]?.amount || (p.amount - purchaseAmt);
                    const isProfitPositive = profitAmt >= 0;

                    // Değişim: ilk ay son gerçek veriye göre, sonrakiler önceki tahminine göre
                    let changeBase = 0;
                    if (i === 0 && data.monthlyData && data.monthlyData.length > 0) {
                        changeBase = data.monthlyData[data.monthlyData.length - 1].amount;
                    } else if (i > 0) {
                        changeBase = predData.predictions[i - 1].amount;
                    }
                    const changePct = changeBase > 0 ? ((p.amount - changeBase) / changeBase * 100).toFixed(1) : 0;
                    const changeSign = changePct > 0 ? '+' : '';
                    const changeClass = changePct >= 0 ? 'text-success' : 'text-danger';
                    const changeIcon = changePct >= 0 ? '▲' : '▼';

                    return `
                        <tr>
                            <td>${monthName}</td>
                            <td>${formatCurrency(p.amount)}</td>
                            <td>${formatCurrency(purchaseAmt)}</td>
                            <td class="${isProfitPositive ? 'text-success' : 'text-danger'}">${formatCurrency(profitAmt)}</td>
                            <td><span class="${changeClass}">${changeIcon} ${changeSign}${changePct}%</span></td>
                        </tr>
                    `;
                }).join('');
            }

            // 3. Render CEO Analysis
            const ceoAnalysis = predData.ceoAnalysis;
            if (ceoAnalysis) {
                // Executive Summary
                const summaryText = document.getElementById('ceoSummaryText');
                if (summaryText) summaryText.textContent = ceoAnalysis.executiveSummary;

                const outlookValue = document.getElementById('outlookValue');
                if (outlookValue) {
                    outlookValue.textContent = ceoAnalysis.marketOutlook;
                    // Color based on outlook
                    if (ceoAnalysis.marketOutlook.includes('Pozitif')) {
                        outlookValue.className = 'outlook-value positive';
                    } else if (ceoAnalysis.marketOutlook.includes('Dikkatli')) {
                        outlookValue.className = 'outlook-value negative';
                    } else {
                        outlookValue.className = 'outlook-value neutral';
                    }
                }

                // Action plan: recommendations and action items are consolidated into one executive card.
                const actionList = document.getElementById('actionItemsList');
                if (actionList) {
                    if ((ceoAnalysis.actionItems && ceoAnalysis.actionItems.length > 0) || (ceoAnalysis.recommendations && ceoAnalysis.recommendations.length > 0)) {
                        actionList.innerHTML = renderUnifiedActionPlan(ceoAnalysis, predData);
                    } else {
                        actionList.innerHTML = renderPredictionEmptyState('Yetersiz veri', 'Net aksiyon önerisi üretmek için düzenli satış, alış ve gider verisi gerekir.');
                    }
                }

                // CFO Missing Areas
                const missingAreasSection = document.getElementById('cfoMissingAreas');
                const missingAreasList = document.getElementById('missingAreasList');
                if (missingAreasSection && missingAreasList) {
                    const areas = ceoAnalysis.cfoMetrics && ceoAnalysis.cfoMetrics.missingAreas;
                    if (areas && areas.length > 0) {
                        missingAreasSection.style.display = 'block';
                        const severityLabels = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' };
                        missingAreasList.innerHTML = areas.map(a => `
                            <div class="missing-area-card severity-${a.severity}">
                                <div class="missing-area-header">
                                    <span class="missing-area-title">${escapeHtml(a.area)}</span>
                                    <span class="missing-area-severity ${a.severity}">${severityLabels[a.severity] || a.severity}</span>
                                </div>
                                <div class="missing-area-desc">${escapeHtml(a.description)}</div>
                                <div class="missing-area-action">→ ${escapeHtml(a.action)}</div>
                            </div>
                        `).join('');
                    } else {
                        missingAreasSection.style.display = 'block';
                        missingAreasList.innerHTML = renderPredictionEmptyState('İyileştirme alanı yok', 'Mevcut veriyle belirgin bir CFO iyileştirme alanı tespit edilmedi.');
                    }
                }
            }

            // 4. Render Risk Assessment
            const risk = predData.riskAssessment;
            if (risk) {
                const riskLevel = document.getElementById('riskLevel');
                const riskIndicator = document.getElementById('riskIndicator');
                const riskCard = document.getElementById('riskCard');

                if (riskLevel) {
                    const levelText = { low: 'Düşük', medium: 'Orta', high: 'Yüksek', unknown: '-' };
                    riskLevel.textContent = levelText[risk.level] || '-';
                }

                if (riskIndicator) {
                    riskIndicator.className = `risk-indicator risk-${risk.level}`;
                }

                if (riskCard) {
                    riskCard.className = `pred-stat-card risk-card risk-${risk.level}`;
                }
                setText('riskLevelHint', `${Math.round(risk.score || 0)}/100 genel risk skoru`);
            }

            // 5. Render Seasonality
            const seasonality = predData.seasonality;
            if (seasonality) {
                const seasonStatus = document.getElementById('seasonalityStatus');
                const seasonHint = document.getElementById('seasonalityHint');
                const seasonCard = document.getElementById('seasonalityCard');

                if (seasonStatus) {
                    seasonStatus.textContent = seasonality.detected ? 'Tespit Edildi' : 'Tespit Edilmedi';
                }

                if (seasonHint) {
                    seasonHint.textContent = seasonality.message || '';
                }

                if (seasonCard) {
                    seasonCard.classList.toggle('seasonality-detected', Boolean(seasonality.detected));
                }
            }

            updatePredictionExecutiveSummary({
                predData,
                ceoAnalysis,
                risk,
                forecastTotal,
                growthPct,
                confidenceScore,
                monthlyData: data.monthlyData
            });
            renderAccountantFeedback(predData);
            renderForecastHorizons(predData);
            renderModelComparison(predData);

            // 6. Render Chart (multi-series)
            renderPredictionChart(data.monthlyData, predData.allPredictions || predData.predictions, data.monthlyPurchases, predData);

            // 7. Render advanced business analytics
            renderBusinessAnalytics(predData);
            renderPredictionDecisionContext({ predData, monthlyData: data.monthlyData, growthPct, confidenceScore });

            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'flex';
            wrapPredictionCardsForResize();
            initPredictionsLayout();
            initPredictionsDragDrop();
            observePredictionChartResize();
            loadBreakEven();
        } else {
            if (loadingEl) {
                loadingEl.innerHTML = '<p>Yeterli veri bulunamadı.</p>';
            }
        }
    } catch (error) {
        console.error('Predictions load error:', error);
        if (loadingEl) loadingEl.innerHTML = '<p>Veriler yüklenirken hata oluştu.</p>';
    }
}

async function loadBreakEven() {
    try {
        const year = new Date().getFullYear().toString();
        const resp = await fetch('/api/break-even?year=' + year);
        const data = await resp.json();
        if (!data.success || !data.data) return;

        const be = data.data;
        const amountEl = document.getElementById('breakEvenAmount');
        const hintEl = document.getElementById('breakEvenHint');
        const cardEl = document.getElementById('breakEvenCard');

        if (amountEl && be.breakEvenPoint) {
            amountEl.textContent = formatCurrency(be.breakEvenPoint);
        } else if (amountEl) {
            amountEl.textContent = 'Yetersiz veri';
        }

        if (hintEl) {
            if (be.breakEvenReached) {
                hintEl.textContent = 'Başabaş aşıldı — güvenlik marjı %' + be.marginOfSafetyPct;
                hintEl.style.color = 'var(--success)';
            } else if (be.breakEvenReached === false) {
                hintEl.textContent = 'Başabaş noktasına ulaşılamadı';
                hintEl.style.color = 'var(--danger)';
            } else {
                hintEl.textContent = 'Sabit giderler: ' + formatCurrency(be.fixedCosts);
                hintEl.style.color = 'var(--text-muted)';
            }
        }

        if (cardEl) {
            cardEl.title = 'Değişken gider oranı: %' + be.variableCostRatio;
        }
    } catch {
        return;
    }
}

function renderAccountantFeedback(predData) {
    const feedback = predData?.accountantFeedback;
    if (!feedback) return;

    setText('accountantFeedbackSummary', feedback.summary || 'Tahmin özeti üretilemedi.');
    setText('accountantFeedbackAction', feedback.actionSentence || '');
    setText('accountantFeedbackInterval', `${formatCurrency(feedback.confidenceInterval?.lower || 0)} - ${formatCurrency(feedback.confidenceInterval?.upper || 0)}`);
    setText('accountantFeedbackTrend', feedback.trend?.message || '-');
    setText('accountantFeedbackSeasonality', feedback.seasonalityWarning || '-');
    setText('accountantFeedbackModel', feedback.selectedModelLabel || predData?.modelSelection?.selectedLabel || '-');

    const comparison = feedback.samePeriodLastYearComparison;
    if (comparison && comparison.changePct != null) {
        setText('accountantFeedbackComparison', `${comparison.changePct > 0 ? '+' : ''}${Number(comparison.changePct).toFixed(1)}%`);
    } else {
        setText('accountantFeedbackComparison', 'Yeterli veri yok');
    }

    const warningEl = document.getElementById('accountantFeedbackWarning');
    if (warningEl) {
        if (feedback.criticalWarning) {
            warningEl.textContent = feedback.criticalWarning;
            warningEl.style.display = 'block';
        } else {
            warningEl.textContent = '';
            warningEl.style.display = 'none';
        }
    }
}

function renderForecastHorizons(predData) {
    const grid = document.getElementById('forecastHorizonGrid');
    const horizons = predData?.forecastHorizons || [];
    if (!grid) return;
    if (!horizons.length) {
        grid.innerHTML = '';
        return;
    }

    grid.innerHTML = horizons.map(item => `
        <div class="forecast-horizon-card">
            <span>${escapeHtml(item.label)}</span>
            <strong>${formatCurrency(item.total || 0)}</strong>
            <em>${formatCurrency(item.lower || 0)} - ${formatCurrency(item.upper || 0)}</em>
            <small>Aylık ort. ${formatCurrency(item.average || 0)}</small>
        </div>
    `).join('');
}

function renderModelComparison(predData) {
    const body = document.getElementById('modelComparisonBody');
    const reason = document.getElementById('modelSelectionReason');
    const models = predData?.modelComparison || [];
    if (reason) reason.textContent = predData?.modelSelection?.reason || '';
    if (!body) return;
    if (!models.length) {
        body.innerHTML = '<tr><td colspan="5">Model karşılaştırması için yeterli veri yok.</td></tr>';
        return;
    }

    body.innerHTML = models.map(model => {
        const status = model.selected ? 'Seçildi' : model.available ? 'Uygun' : 'Yetersiz veri';
        return `
            <tr class="${model.selected ? 'selected-model-row' : ''}">
                <td>${escapeHtml(model.label || model.key)}</td>
                <td>${model.mae == null ? '-' : formatCurrency(model.mae)}</td>
                <td>${model.rmse == null ? '-' : formatCurrency(model.rmse)}</td>
                <td>${model.mape == null ? '-' : `%${Number(model.mape).toFixed(1)}`}</td>
                <td><span class="model-status-pill ${model.selected ? 'selected' : model.available ? 'available' : 'disabled'}">${escapeHtml(status)}</span></td>
            </tr>
        `;
    }).join('');
}

function getPredictionGrowthPct(predData, data, firstPred) {
    if (predData.avgMonthlyGrowthPct != null && Number.isFinite(predData.avgMonthlyGrowthPct)) {
        return predData.avgMonthlyGrowthPct;
    }
    if (data.monthlyData && data.monthlyData.length >= 3) {
        const last3 = data.monthlyData.slice(-3);
        const avg3 = last3.reduce((sum, item) => sum + item.amount, 0) / 3;
        return avg3 > 0 ? ((firstPred.amount - avg3) / avg3) * 100 : 0;
    }
    return 0;
}

function updatePredictionExecutiveSummary({ predData, ceoAnalysis, risk, forecastTotal, growthPct, confidenceScore, monthlyData }) {
    setText('execTotalExpectation', formatCurrency(forecastTotal));
    setText('execGrowth', `${growthPct > 0 ? '+' : ''}${Number(growthPct).toFixed(1)}%`);
    setText('execRisk', getRiskLevelLabel(risk?.level));
    setText('execConfidence', getConfidenceLabel(confidenceScore));
    setText('execDataQuality', getDataQualityLabel(getDataQualityScore(monthlyData, predData)));

    const insight = getPrimaryPredictionInsight(predData, ceoAnalysis, risk, growthPct, confidenceScore);
    setText('execPrimaryInsight', insight);
    setText('execWhyLine', buildExecutiveWhyLine(predData, monthlyData, risk, confidenceScore));
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function getRiskLevelLabel(level) {
    return ({ low: 'Düşük', medium: 'Orta', high: 'Yüksek', unknown: 'Yetersiz veri' })[level] || 'Yetersiz veri';
}

function getConfidenceLabel(score) {
    if (score >= 75) return 'Güçlü';
    if (score >= 50) return 'Orta';
    if (score > 0) return 'Düşük';
    return 'Yetersiz veri';
}

function getConfidenceExplanation(score) {
    if (score >= 75) return 'Karar desteği güçlü';
    if (score >= 50) return 'Kontrollü kullanılabilir';
    if (score > 0) return 'Senaryoyla birlikte okuyun';
    return 'Veri yetersiz';
}

function getDataQualityScore(monthlyData, predData) {
    const months = Array.isArray(monthlyData) ? monthlyData : [];
    if (months.length === 0) return 0;
    const zeroMonths = months.filter(item => Number(item.amount) === 0).length;
    const historyScore = Math.min(45, months.length * 4);
    const continuityScore = Math.max(0, 25 - zeroMonths * 5);
    const confidenceScore = Math.min(20, Math.round((Number(predData?.confidence) || 0) / 5));
    const riskPenalty = predData?.riskAssessment?.level === 'high' ? 15 : predData?.riskAssessment?.level === 'medium' ? 7 : 0;
    return Math.max(0, Math.min(100, historyScore + continuityScore + confidenceScore + 10 - riskPenalty));
}

function getDataQualityLabel(score) {
    if (score >= 75) return 'Yüksek';
    if (score >= 50) return 'Orta';
    if (score > 0) return 'Düşük';
    return 'Yetersiz';
}

function buildExecutiveWhyLine(predData, monthlyData, risk, confidenceScore) {
    const monthCount = Array.isArray(monthlyData) ? monthlyData.length : 0;
    const trendLabel = predData?.trend === 'up' ? 'yükselen trend' : predData?.trend === 'down' ? 'düşen trend' : 'yatay trend';
    const riskLabel = getRiskLevelLabel(risk?.level).toLocaleLowerCase('tr-TR');
    const confidenceLabel = getConfidenceLabel(confidenceScore).toLocaleLowerCase('tr-TR');
    return `${monthCount} aylık satış geçmişi, ${trendLabel}, ${riskLabel} risk ve ${confidenceLabel} model güveni birlikte okunarak üretildi.`;
}

function getPrimaryPredictionInsight(predData, ceoAnalysis, risk, growthPct, confidenceScore) {
    if (risk?.level === 'high' && risk.factors?.[0]?.description) {
        return `${risk.factors[0].description} Tahminleri karar desteği olarak kullanın.`;
    }
    if (confidenceScore > 0 && confidenceScore < 50) {
        return 'Model güveni düşük; daha sağlıklı karar için veri setini genişletmeniz önerilir.';
    }
    if (growthPct < 0) {
        return 'Satışlarda düşüş eğilimi görülüyor; nakit akışı ve stok planı yakından izlenmeli.';
    }
    if (predData?.seasonality?.detected && predData.seasonality.message) {
        return predData.seasonality.message;
    }
    return ceoAnalysis?.executiveSummary || 'Tahminler hazır; tablo, risk ve aksiyon alanlarını birlikte değerlendirin.';
}

function renderPredictionEmptyState(title, description) {
    return `
        <div class="prediction-empty-state">
            <strong>${escapeHtml(title)}</strong>
            <span>${escapeHtml(description)}</span>
        </div>
    `;
}

function renderUnifiedActionPlan(ceoAnalysis, predData) {
    const actionItems = Array.isArray(ceoAnalysis?.actionItems) ? ceoAnalysis.actionItems : [];
    const recommendations = Array.isArray(ceoAnalysis?.recommendations) ? ceoAnalysis.recommendations : [];
    const risk = predData?.riskAssessment || {};

    const plans = [
        {
            timing: 'Şimdi yapılacak',
            source: actionItems[0]?.action || recommendations[0] || 'Risk ve nakit akışı görünümünü kontrol edin.',
            priority: actionItems[0]?.priority || (risk.level === 'high' ? 'high' : 'medium')
        },
        {
            timing: 'Bu hafta takip edilecek',
            source: actionItems[1]?.action || recommendations[1] || 'Satış ivmesi, stok ve tahsilat listesini haftalık izleyin.',
            priority: actionItems[1]?.priority || (risk.level === 'medium' ? 'medium' : 'low')
        },
        {
            timing: 'Bu ay izlenecek',
            source: actionItems[2]?.action || recommendations[2] || 'Senaryo bandı ve model güvenini yeni veriyle yeniden değerlendirin.',
            priority: actionItems[2]?.priority || 'low'
        }
    ];

    return plans.map((plan) => {
        const category = inferActionCategory(plan.source);
        const priority = normalizeActionPriority(plan.priority);
        const priorityLabels = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' };
        const title = buildActionTitle(plan.source, category);
        const reason = buildActionReason(priority, category, predData);
        const difficulty = category === 'Veri Kalitesi' ? 'Düşük' : category === 'Risk' ? 'Orta' : 'Orta';

        return `
            <div class="action-item priority-${priority}">
                <div class="action-item-head">
                    <span class="action-timing">${escapeHtml(plan.timing)}</span>
                    <span class="action-priority ${priority}">${priorityLabels[priority] || 'Düşük'}</span>
                </div>
                <strong class="action-title">${escapeHtml(title)}</strong>
                <span class="action-detail"><b>Neden önemli?</b> ${escapeHtml(reason)}</span>
                <span class="action-impact">Zorluk: ${escapeHtml(difficulty)}</span>
            </div>
        `;
    }).join('');
}

function normalizeActionPriority(priority) {
    if (priority === 'urgent' || priority === 'high') return 'high';
    if (priority === 'medium') return 'medium';
    return 'low';
}

function renderActionRecommendationCard(action, predData) {
    const rawText = String(action.action || '').trim();
    const priority = action.priority || 'low';
    const priorityLabels = { urgent: 'Yüksek', high: 'Yüksek', medium: 'Orta', low: 'Düşük' };
    const category = inferActionCategory(rawText);
    const title = buildActionTitle(rawText, category);
    const reason = buildActionReason(priority, category, predData);
    const nextStep = rawText || 'Bu öneri için yeterli veri bulunamadı.';
    const impact = buildActionImpact(priority, category);

    return `
        <div class="action-item priority-${priority}">
            <div class="action-item-head">
                <span class="action-priority ${priority}">${priorityLabels[priority] || 'Düşük'}</span>
                <span class="action-category">${escapeHtml(category)}</span>
            </div>
            <strong class="action-title">${escapeHtml(title)}</strong>
            <span class="action-detail"><b>Neden önemli?</b> ${escapeHtml(reason)}</span>
            <span class="action-detail"><b>Ne yapılmalı?</b> ${escapeHtml(nextStep)}</span>
            <span class="action-detail"><b>Zamanlama:</b> ${escapeHtml(getActionTiming(priority, category))}</span>
            <span class="action-impact">Beklenen etki: ${escapeHtml(impact)}</span>
        </div>
    `;
}

function renderStrategicRecommendationCard(recommendation, index, predData, risk) {
    const text = String(recommendation || '').trim();
    const category = inferActionCategory(text);
    const priority = risk?.level === 'high' || index === 0 ? 'high' : risk?.level === 'medium' ? 'medium' : 'low';
    const priorityLabels = { high: 'Yüksek', medium: 'Orta', low: 'Düşük' };
    const title = buildActionTitle(text, category);
    const why = buildActionReason(priority, category, predData);
    const impact = buildActionImpact(priority, category);
    const difficulty = category === 'Veri Kalitesi' ? 'Düşük' : category === 'Risk' ? 'Orta' : 'Orta';

    return `
        <div class="recommendation-card priority-${priority}">
            <div class="recommendation-card-head">
                <span class="action-priority ${priority}">${priorityLabels[priority]}</span>
                <span class="action-category">${escapeHtml(category)}</span>
            </div>
            <strong>${escapeHtml(title || 'Stratejik öneri')}</strong>
            <span><b>Neden önemli?</b> ${escapeHtml(why)}</span>
            <span><b>Beklenen etki:</b> ${escapeHtml(impact)}</span>
            <span><b>Uygulama zorluğu:</b> ${escapeHtml(difficulty)}</span>
        </div>
    `;
}

function inferActionCategory(text) {
    const normalized = text.toLocaleLowerCase('tr-TR');
    if (/risk|düşüş|dus|volatil|belirsiz|güven|guven/.test(normalized)) return 'Risk';
    if (/kâr|kar|marj|gider|maliyet|alış|alis/.test(normalized)) return 'Kâr';
    if (/satış|satis|gelir|ciro|büyü|buyu/.test(normalized)) return 'Gelir';
    if (/veri|dosya|rapor|ölç|olc|takip/.test(normalized)) return 'Veri Kalitesi';
    return 'Operasyon';
}

function buildActionTitle(text, category) {
    if (!text) return 'Yetersiz veri';
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length <= 58) return cleaned;
    return `${category} odağı: ${cleaned.slice(0, 46).trim()}...`;
}

function buildActionReason(priority, category, predData) {
    if (priority === 'urgent' || priority === 'high') return 'Bu konu kısa vadeli kararları doğrudan etkileyebilir.';
    if (category === 'Risk') return 'Belirsizliği azaltmak tahminlerin karar desteği değerini artırır.';
    if (category === 'Kâr') return 'Marj ve gider dengesi nakit akışını doğrudan etkiler.';
    if (category === 'Gelir') return 'Satış ritmindeki değişim hedef ve kapasite planını etkiler.';
    if (category === 'Veri Kalitesi') return 'Daha düzenli veri model güvenini artırır.';
    if (predData?.trend === 'down') return 'Düşüş eğilimi operasyon planını erken gözden geçirmeyi gerektirir.';
    return 'Bu aksiyon tahmin dönemini daha kontrollü yönetmeye yardımcı olur.';
}

function buildActionImpact(priority, category) {
    if (priority === 'urgent' || priority === 'high') return 'Kısa vadeli risk azaltma';
    if (category === 'Kâr') return 'Marj kontrolü';
    if (category === 'Gelir') return 'Satış hedefi netliği';
    if (category === 'Veri Kalitesi') return 'Daha güvenilir tahmin';
    return 'Daha iyi takip disiplini';
}

function getActionTiming(priority, category) {
    if (priority === 'urgent' || priority === 'high') return 'Şimdi yapılacak';
    if (category === 'Veri Kalitesi' || category === 'Risk') return 'Bu hafta yapılacak';
    return 'Bu ay izlenecek';
}

function buildRiskAdvice(factor) {
    const text = `${factor?.name || ''} ${factor?.description || ''}`.toLocaleLowerCase('tr-TR');
    if (/düşüş|dus|azal/.test(text)) return 'Satış hedeflerini ve nakit akışı planını kısa dönem için yeniden gözden geçirin.';
    if (/volatil|dalgal/.test(text)) return 'Tahminleri tek değer yerine kötümser ve iyimser senaryolarla birlikte takip edin.';
    if (/veri|yetersiz|az/.test(text)) return 'Daha sağlıklı analiz için en az 6-12 aylık düzenli veri ekleyin.';
    if (/gider|maliyet|alış|alis/.test(text)) return 'Maliyet ve gider kalemlerini satış beklentisiyle birlikte kontrol edin.';
    return 'Bu riski haftalık takip listesine alın ve kararları tek tahmin değerine bağlamayın.';
}

function renderPredictionDecisionContext({ predData, monthlyData, growthPct, confidenceScore }) {
    renderDataQualityCard(predData, monthlyData);
    renderModelExplainCard(predData, monthlyData, confidenceScore);
    renderDecisionImpactCard(predData, growthPct);
    renderPredictionChartInsights(monthlyData, predData);
    updatePredictionModelDetailsVisibility();
    syncPredictionWrapperVisibility();
}

function updatePredictionModelDetailsVisibility() {
    const panel = document.getElementById('predictionModelDetails');
    if (!panel) return;
    const visibleCards = [...panel.querySelectorAll('.pred-card')]
        .filter(card => card.style.display !== 'none' && !card.hidden);
    panel.style.display = visibleCards.length > 0 ? 'block' : 'none';
}

function renderDataQualityCard(predData, monthlyData) {
    const card = document.getElementById('dataQualityCard');
    const grid = document.getElementById('dataQualityGrid');
    if (!card || !grid) return;

    const months = Array.isArray(monthlyData) ? monthlyData : [];
    if (months.length === 0) {
        card.style.display = 'none';
        return;
    }

    const zeroMonths = months.filter(item => Number(item.amount) === 0).length;
    const latestMonth = months[months.length - 1]?.month;
    const qualityScore = getDataQualityScore(months, predData);
    const qualityLabel = getDataQualityLabel(qualityScore);
    const volatilityRisk = predData?.riskAssessment?.factors?.find(f => /volatil|dalgal/i.test(`${f.name} ${f.description}`));
    const volatilityLabel = volatilityRisk?.severity === 'high' ? 'Yüksek' : volatilityRisk ? 'Orta' : 'Düşük';
    const items = [
        { label: 'Kullanılan Ay', value: `${months.length} ay`, hint: months.length >= 12 ? 'Geniş geçmiş' : months.length >= 6 ? 'Orta kapsam' : 'Sınırlı geçmiş', cls: months.length >= 6 ? 'good' : 'ok' },
        { label: 'Eksik / Boş Ay', value: zeroMonths > 0 ? `${zeroMonths} ay` : 'Yok', hint: zeroMonths > 0 ? 'Süreklilik kontrolü gerekli' : 'Seri kesintisiz görünüyor', cls: zeroMonths > 0 ? 'bad' : 'good' },
        { label: 'Aykırı Değer Etkisi', value: volatilityLabel, hint: volatilityRisk?.description || 'Belirgin volatilite sinyali yok', cls: volatilityRisk?.severity === 'high' ? 'bad' : volatilityRisk ? 'ok' : 'good' },
        { label: 'Son Veri Dönemi', value: formatDateLabel(latestMonth), hint: 'Tahmin başlangıç referansı', cls: 'neutral' },
        { label: 'Güven Etiketi', value: qualityLabel, hint: `${qualityScore}/100 veri kalite skoru`, cls: qualityScore >= 75 ? 'good' : qualityScore >= 50 ? 'ok' : 'bad' }
    ];

    grid.innerHTML = items.map(renderDecisionMetricItem).join('');
    card.style.display = 'block';
}

function renderModelExplainCard(predData, monthlyData, confidenceScore) {
    const card = document.getElementById('modelExplainCard');
    const list = document.getElementById('modelExplainList');
    if (!card || !list) return;

    const bs = predData?.businessStats || {};
    const regression = bs.regressionQuality;
    const salesGrowth = bs.salesGrowth || {};
    const months = Array.isArray(monthlyData) ? monthlyData.length : 0;
    const bandText = getForecastBandText(predData);
    const strongSignal = predData?.trend === 'up'
        ? 'Yükseliş yönünü ve satış ivmesini okuyor.'
        : predData?.trend === 'down'
            ? 'Düşüş yönünü ve son dönem zayıflamayı okuyor.'
            : 'Satış ritminin yatay seyrettiği dönemleri okuyor.';
    const weakSignal = confidenceScore < 50
        ? 'Veri dalgalı olduğu için tek nokta tahmin yerine senaryolarla izlenmeli.'
        : months < 6
            ? 'Geçmiş ay sayısı sınırlı; yeni veri geldikçe sonuçlar değişebilir.'
            : 'Kampanya, piyasa ve stok kırılımı modele ayrı değişken olarak girmiyor.';

    const items = [
        { label: 'Dayanak', text: `${months} aylık satış serisi, alış verisi ve varsa gider ortalaması kullanılır.` },
        { label: 'Güçlü Okuduğu Alan', text: strongSignal },
        { label: 'Zayıf Olduğu Alan', text: weakSignal },
        { label: 'Belirsizlik', text: bandText },
        { label: 'Model Notu', text: regression?.interpretation || `Momentum göstergesi ${salesGrowth.momentumPct != null ? fmtPct(salesGrowth.momentumPct) : 'hesaplanamadı'}.` }
    ];

    list.innerHTML = items.map(item => `
        <div class="model-explain-item">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.text)}</strong>
        </div>
    `).join('');
    card.style.display = 'block';
}

function renderDecisionImpactCard(predData, growthPct) {
    const card = document.getElementById('decisionImpactCard');
    const grid = document.getElementById('decisionImpactGrid');
    if (!card || !grid) return;

    const health = predData?.businessStats?.financialHealth || {};
    const risk = predData?.riskAssessment || {};
    const stockSignal = risk.level === 'high' || growthPct < 0
        ? 'Korumacı stok planı'
        : growthPct > 5 ? 'Talep artışına hazırlık' : 'Mevcut stok ritmini koru';
    const cashSignal = health.avgNetProfitAhead != null
        ? (health.avgNetProfitAhead > 0 ? 'Nakit baskısı sınırlı' : 'Nakit çıkışı izlenmeli')
        : 'Gider verisiyle netleştir';
    const salesSignal = predData?.trend === 'down'
        ? 'Kayıp hesapları önceliklendir'
        : predData?.trend === 'up' ? 'Yüksek potansiyelli hesapları büyüt' : 'Aktif müşteri temposunu koru';

    const items = [
        { label: 'Stok Planı', value: stockSignal, hint: risk.level === 'high' ? 'Risk seviyesi stok kararını sıkılaştırıyor' : 'Satış beklentisine göre kapasite ayarı', cls: risk.level === 'high' ? 'bad' : 'ok' },
        { label: 'Nakit Akışı', value: cashSignal, hint: health.avgNetProfitAhead != null ? `Ort. net kâr: ${formatCurrency(health.avgNetProfitAhead)}` : 'Gider verisi eksik olabilir', cls: health.avgNetProfitAhead > 0 ? 'good' : health.avgNetProfitAhead < 0 ? 'bad' : 'neutral' },
        { label: 'Satış Önceliği', value: salesSignal, hint: growthPct < 0 ? 'İvme zayıflıyor' : 'İvme korunmalı', cls: growthPct >= 0 ? 'good' : 'bad' }
    ];

    grid.innerHTML = items.map(renderDecisionMetricItem).join('');
    card.style.display = 'block';
}

function renderPredictionChartInsights(monthlyData, predData) {
    const list = document.getElementById('predictionChartInsightList');
    const wrap = document.getElementById('predictionChartInsights');
    if (!list || !wrap) return;

    const months = Array.isArray(monthlyData) ? monthlyData : [];
    if (months.length < 2) {
        wrap.style.display = 'none';
        return;
    }

    const insights = [];
    const last3 = months.slice(-3);
    if (last3.length === 3) {
        const first = Number(last3[0].amount) || 0;
        const last = Number(last3[2].amount) || 0;
        const change = first > 0 ? ((last - first) / first) * 100 : 0;
        if (change < -5) insights.push('Son 3 ayda satış ivmesi zayıflıyor.');
        else if (change > 5) insights.push('Son 3 ayda satış ivmesi güçleniyor.');
        else insights.push('Son 3 ayda satış ritmi yatay seyrediyor.');
    }

    const profit = predData?.profitPredictions;
    if (Array.isArray(profit) && Array.isArray(predData?.predictions) && predData.predictions[0]?.amount > 0) {
        const margin = (profit[0].amount / predData.predictions[0].amount) * 100;
        insights.push(margin >= 15 ? 'Kâr marjı satış beklentisini destekliyor.' : 'Kâr marjı satış artışını aynı güçte takip etmiyor.');
    }

    insights.push(getForecastBandText(predData));
    list.innerHTML = insights.slice(0, 3).map(item => `<li>${escapeHtml(item)}</li>`).join('');
    wrap.style.display = 'grid';
}

function getForecastBandText(predData) {
    const bands = predData?.confidenceBands || [];
    const predictions = predData?.predictions || [];
    if (!bands.length || !predictions.length || !predictions[0]?.amount) return 'Tahmin bandı için yeterli güven aralığı verisi yok.';
    const firstBand = bands[0];
    const widthPct = ((firstBand.upper - firstBand.lower) / predictions[0].amount) * 100;
    if (widthPct > 60) return 'Tahmin bandı geniş; belirsizlik yüksek.';
    if (widthPct > 30) return 'Tahmin bandı orta genişlikte; senaryo takibi önerilir.';
    return 'Tahmin bandı dar; belirsizlik kontrol altında.';
}

function renderScenarioCards(scenarios) {
    const totals = scenarios.reduce((acc, scenario) => {
        acc.pessimistic += Number(scenario.pessimistic) || 0;
        acc.base += Number(scenario.base) || 0;
        acc.optimistic += Number(scenario.optimistic) || 0;
        return acc;
    }, { pessimistic: 0, base: 0, optimistic: 0 });

    const cards = [
        {
            key: 'pessimistic',
            title: 'Kötümser',
            value: totals.pessimistic,
            confidence: 'Korunma senaryosu',
            assumption: 'Satış ivmesi zayıflar veya volatilite artar.',
            comment: 'Stok ve nakit kararlarında güvenlik payı bırakın.'
        },
        {
            key: 'base',
            title: 'Baz',
            value: totals.base,
            confidence: 'Ana plan',
            assumption: 'Mevcut trend ve son dönem ritmi korunur.',
            comment: 'Hedef, bütçe ve kapasite planı için ana referans.'
        },
        {
            key: 'optimistic',
            title: 'İyimser',
            value: totals.optimistic,
            confidence: 'Fırsat senaryosu',
            assumption: 'Talep ve dönüşüm mevcut tahmini aşar.',
            comment: 'Satış ekibi ve tedarik kapasitesi hazır tutulmalı.'
        }
    ];

    return cards.map(card => `
        <div class="scenario-card scenario-${card.key}">
            <span>${card.title}</span>
            <strong>${formatCurrency(card.value)}</strong>
            <em>${card.confidence}</em>
            <p><b>Varsayım:</b> ${escapeHtml(card.assumption)}</p>
            <p>${escapeHtml(card.comment)}</p>
        </div>
    `).join('');
}

function renderDecisionMetricItem(item) {
    return `
        <div class="decision-metric-item ${item.cls || ''}">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
            <em>${escapeHtml(item.hint || '')}</em>
        </div>
    `;
}

// ========================================
// Prediction: Advanced Business Analytics
// ========================================
function renderBusinessAnalytics(predData) {
    const bs = predData?.businessStats;
    if (!bs) return;

    // --- Business Statistics (Series stats) ---
    const bstatCard = document.getElementById('businessStatsCard');
    if (bstatCard) {
        if (bs.sales || bs.purchase || bs.profit) {
            bstatCard.style.display = 'block';
            renderSeriesStatsGrid('bstatSalesGrid', bs.sales);
            renderSeriesStatsGrid('bstatPurchaseGrid', bs.purchase);
            renderSeriesStatsGrid('bstatProfitGrid', bs.profit);
            setupBstatTabs();
        } else {
            bstatCard.style.display = 'none';
        }
    }

    // --- Financial Health ---
    const fhCard = document.getElementById('financialHealthCard');
    const fhGrid = document.getElementById('financialHealthGrid');
    if (fhCard && fhGrid && bs.financialHealth) {
        const h = bs.financialHealth;
        const rows = [];
        if (h.grossMarginPct != null)
            rows.push(healthRow('Brüt Kâr Marjı', fmtPct(h.grossMarginPct), 'Gelecek ay (tahmin)', h.grossMarginPct >= 20 ? 'good' : h.grossMarginPct >= 10 ? 'ok' : 'bad'));
        if (h.netMarginPct != null)
            rows.push(healthRow('Net Kâr Marjı', fmtPct(h.netMarginPct), 'Gider sonrası (tahmin)', h.netMarginPct >= 10 ? 'good' : h.netMarginPct >= 0 ? 'ok' : 'bad'));
        if (h.avgGrossMarginPct != null)
            rows.push(healthRow('Ort. Brüt Marj', fmtPct(h.avgGrossMarginPct), 'Geçmiş ortalama', h.avgGrossMarginPct >= 20 ? 'good' : h.avgGrossMarginPct >= 10 ? 'ok' : 'bad'));
        if (h.avgPurchaseRatio != null)
            rows.push(healthRow('Alış / Satış', fmtPct(h.avgPurchaseRatio), 'Maliyet oranı', h.avgPurchaseRatio <= 60 ? 'good' : h.avgPurchaseRatio <= 80 ? 'ok' : 'bad'));
        if (h.expenseRatioPct != null)
            rows.push(healthRow('Gider / Brüt Kâr', fmtPct(h.expenseRatioPct), 'Gider yoğunluğu', h.expenseRatioPct <= 50 ? 'good' : h.expenseRatioPct <= 80 ? 'ok' : 'bad'));
        if (h.breakEvenSales != null)
            rows.push(healthRow('Başa Baş Satış', formatCurrency(h.breakEvenSales), 'Aylık zarar etmeme eşiği', 'neutral'));
        if (h.salesToBreakEvenGapPct != null)
            rows.push(healthRow('Satış / Başa Baş', fmtPct(h.salesToBreakEvenGapPct), 'Gelecek ay güven payı', h.salesToBreakEvenGapPct >= 20 ? 'good' : h.salesToBreakEvenGapPct >= 0 ? 'ok' : 'bad'));
        if (h.costCoveragePct != null)
            rows.push(healthRow('Gider Karşılama', fmtPct(h.costCoveragePct), 'Brüt kâr / gider', h.costCoveragePct >= 150 ? 'good' : h.costCoveragePct >= 100 ? 'ok' : 'bad'));
        if (h.salesVolatilityPct != null)
            rows.push(healthRow('Satış Volatilitesi', fmtPct(h.salesVolatilityPct), 'Geçmiş CV', h.salesVolatilityPct <= 15 ? 'good' : h.salesVolatilityPct <= 30 ? 'ok' : 'bad'));
        if (h.avgNetProfitAhead != null)
            rows.push(healthRow('Ort. Net Kâr', formatCurrency(h.avgNetProfitAhead), '3 aylık projeksiyon', h.avgNetProfitAhead > 0 ? 'good' : h.avgNetProfitAhead === 0 ? 'neutral' : 'bad'));
        if (h.breakEvenMonth)
            rows.push(healthRow('İlk Kârlı Ay', formatDateLabel(h.breakEvenMonth), '3 aylık projeksiyon içinde', 'good'));
        rows.push(healthRow('Kârlı / Zararlı Ay', `${h.profitableMonthsAhead} / ${h.lossMonthsAhead}`, 'Önümüzdeki 3 ay', h.profitableMonthsAhead >= 2 ? 'good' : h.profitableMonthsAhead === 1 ? 'ok' : 'bad'));
        if (h.purchaseVolatilityPct != null)
            rows.push(healthRow('Alış Volatilitesi', fmtPct(h.purchaseVolatilityPct), 'Geçmiş CV', h.purchaseVolatilityPct <= 15 ? 'good' : h.purchaseVolatilityPct <= 30 ? 'ok' : 'bad'));
        if (h.downsideNetProfit != null)
            rows.push(healthRow('En Zayıf Net Ay', formatCurrency(h.downsideNetProfit), '3 aylık projeksiyon', h.downsideNetProfit > 0 ? 'good' : h.downsideNetProfit === 0 ? 'neutral' : 'bad'));

        if (rows.length > 0) {
            fhGrid.innerHTML = normalizeMetricMarkup(rows, 12, 'fhealth');
            fhCard.style.display = 'block';
        } else {
            fhCard.style.display = 'none';
        }
    }

    // --- Growth & Momentum ---
    const gmCard = document.getElementById('growthMetricsCard');
    const gmGrid = document.getElementById('growthMetricsGrid');
    if (gmCard && gmGrid && bs.salesGrowth) {
        const g = bs.salesGrowth;
        const s = bs.sales || {};
        const rows = [];
        if (g.cmgrPct != null) rows.push(growthRow('CMGR', fmtPct(g.cmgrPct), 'Bileşik aylık büyüme', g.cmgrPct));
        if (s.momPct != null) rows.push(growthRow('MoM', fmtPct(s.momPct), 'Son ay değişim', s.momPct));
        if (s.qoqPct != null) rows.push(growthRow('QoQ', fmtPct(s.qoqPct), 'Son 3 ay vs. önceki 3', s.qoqPct));
        if (s.yoyPct != null) rows.push(growthRow('YoY', fmtPct(s.yoyPct), 'Yıldan yıla', s.yoyPct));
        if (g.momentumPct != null) rows.push(growthRow('Momentum', fmtPct(g.momentumPct), 'Son ay vs. 3A ort.', g.momentumPct));
        if (g.ma3 != null) rows.push(growthRow('3A Ortalama', formatCurrency(g.ma3), 'Hareketli ortalama', null));
        if (g.ma6 != null) rows.push(growthRow('6A Ortalama', formatCurrency(g.ma6), 'Hareketli ortalama', null));
        if (g.consecutiveUp > 0) rows.push(growthRow('Ardışık Artış', `${g.consecutiveUp} ay`, 'Kesintisiz yükseliş', 1));
        if (g.consecutiveDown > 0) rows.push(growthRow('Ardışık Düşüş', `${g.consecutiveDown} ay`, 'Kesintisiz düşüş', -1));

        if (rows.length > 0) {
            gmGrid.innerHTML = rows.join('');
            gmCard.style.display = 'block';
        } else {
            gmCard.style.display = 'none';
        }
    }

    // --- Scenarios ---
    const scCard = document.getElementById('scenariosCard');
    const scCards = document.getElementById('scenarioCards');
    if (scCard && scCards && bs.scenarios && bs.scenarios.sales && bs.scenarios.sales.length > 0) {
        scCards.innerHTML = renderScenarioCards(bs.scenarios.sales);
        scCard.style.display = 'block';
    } else if (scCard) {
        scCard.style.display = 'none';
    }

    // --- Regression Quality ---
    const rqCard = document.getElementById('regressionQualityCard');
    const rqGrid = document.getElementById('regressionQualityGrid');
    const rqInterp = document.getElementById('regressionInterpretation');
    if (rqCard && rqGrid && bs.regressionQuality) {
        const q = bs.regressionQuality;
        const diagnostics = bs.modelDiagnostics?.sales || {};
        const r2Class = q.rSquared >= 70 ? 'good' : q.rSquared >= 40 ? 'ok' : 'bad';
        const modelMetrics = [
            { label: 'R²', value: `%${q.rSquared}`, hint: 'Model açıklama gücü', cls: r2Class },
            diagnostics.mae != null
                ? { label: 'MAE', value: formatCurrency(diagnostics.mae), hint: 'Ortalama mutlak hata' }
                : { label: 'SEE', value: formatCurrency(q.see), hint: 'Tahmin standart hatası' },
            diagnostics.rmse != null
                ? { label: 'RMSE', value: formatCurrency(diagnostics.rmse), hint: 'Büyük hatalara duyarlılık' }
                : { label: 'Eğim', value: `${q.slope >= 0 ? '+' : ''}${formatCurrency(q.slope)}`, hint: 'Aylık trend etkisi', cls: q.slope >= 0 ? 'good' : 'bad' },
            diagnostics.mape != null
                ? { label: 'MAPE', value: `%${Number(diagnostics.mape).toFixed(1)}`, hint: 'Yüzdesel hata' }
                : { label: 'Eğim Std. Hata', value: formatCurrency(q.seSlope), hint: 'Trend belirsizliği' }
        ];
        rqGrid.innerHTML = modelMetrics.map(metric => `
            <div class="regq-item ${metric.cls || ''}">
                <span class="regq-label">${escapeHtml(metric.label)}</span>
                <span class="regq-value">${metric.value}</span>
                <span class="regq-hint">${escapeHtml(metric.hint)}</span>
            </div>
        `).join('');
        if (rqInterp) rqInterp.textContent = q.interpretation;
        rqCard.style.display = 'block';
    } else if (rqCard) {
        rqCard.style.display = 'none';
    }

    // --- Risk Factors Detail ---
    const rfCard = document.getElementById('riskFactorsCard');
    const rfSummary = document.getElementById('riskScoreSummary');
    const rfList = document.getElementById('riskFactorsList');
    const risk = predData.riskAssessment;
    if (rfCard && rfSummary && rfList && risk) {
        const levelLabels = { low: 'Düşük', medium: 'Orta', high: 'Yüksek', unknown: '-' };
        rfSummary.innerHTML = `
            <div class="risk-score-block risk-${risk.level}">
                <span class="risk-score-number">${risk.score}</span>
                <span class="risk-score-max">/100</span>
                <span class="risk-score-label">${levelLabels[risk.level] || '-'} Risk</span>
            </div>
        `;
        if (risk.factors && risk.factors.length > 0) {
            rfList.innerHTML = risk.factors.slice(0, 3).map(f => `
                <div class="risk-factor-item severity-${f.severity}">
                    <div class="risk-factor-header">
                        <span class="risk-factor-name">${escapeHtml(f.name)}</span>
                        <span class="risk-factor-severity ${f.severity}">${f.severity === 'high' ? 'Yüksek' : f.severity === 'medium' ? 'Orta' : 'Düşük'}</span>
                    </div>
                    <div class="risk-factor-desc">${escapeHtml(f.description)}</div>
                    <div class="risk-factor-advice"><b>Takip aksiyonu:</b> ${escapeHtml(buildRiskAdvice(f))}</div>
                </div>
            `).join('');
        } else {
            rfList.innerHTML = `
                <div class="risk-factor-item severity-low no-critical-risk">
                    <div class="risk-factor-header">
                        <span class="risk-factor-name">Şu anda kritik anomali yok</span>
                        <span class="risk-factor-severity low">Düşük</span>
                    </div>
                    <div class="risk-factor-desc">Satış volatilitesi, düşüş trendi ve sınırlı veri göstergelerinde kritik eşik aşımı görülmedi.</div>
                    <div class="risk-factor-advice"><b>İzlenen göstergeler:</b> volatilite, ardışık düşüş, veri kapsamı.</div>
                </div>
            `;
        }
        rfCard.style.display = 'block';
    } else if (rfCard) {
        rfCard.style.display = 'none';
    }
}

function renderSeriesStatsGrid(gridId, stats) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    if (!stats) {
        grid.innerHTML = normalizeMetricMarkup([], 12, 'bstat');
        return;
    }
    const items = [
        { label: 'Toplam', value: formatCurrency(stats.sum), hint: `${stats.n} ay` },
        { label: 'Ortalama', value: formatCurrency(stats.mean), hint: 'Aylık' },
        { label: 'Medyan', value: formatCurrency(stats.median), hint: 'Orta değer' },
        { label: 'Std. Sapma', value: formatCurrency(stats.stdDev), hint: 'Volatilite' },
        { label: 'Varyasyon Kats.', value: `%${stats.cv}`, hint: 'CV — tutarlılık', cls: stats.cv < 15 ? 'good' : stats.cv < 30 ? 'ok' : 'bad' },
        { label: 'Maksimum', value: formatCurrency(stats.max), hint: formatDateLabel(stats.maxMonth) },
        { label: 'Minimum', value: formatCurrency(stats.min), hint: formatDateLabel(stats.minMonth) },
        { label: 'İlk → Son Değişim', value: fmtPct(stats.totalChangePct), hint: 'Tüm dönem', cls: stats.totalChangePct > 0 ? 'good' : stats.totalChangePct < 0 ? 'bad' : '' }
    ];
    if (stats.momPct != null) items.push({ label: 'MoM', value: fmtPct(stats.momPct), hint: 'Son ay', cls: stats.momPct > 0 ? 'good' : stats.momPct < 0 ? 'bad' : '' });
    if (stats.qoqPct != null) items.push({ label: 'QoQ', value: fmtPct(stats.qoqPct), hint: 'Son çeyrek', cls: stats.qoqPct > 0 ? 'good' : stats.qoqPct < 0 ? 'bad' : '' });
    if (stats.yoyPct != null) items.push({ label: 'YoY', value: fmtPct(stats.yoyPct), hint: 'Yıllık', cls: stats.yoyPct > 0 ? 'good' : stats.yoyPct < 0 ? 'bad' : '' });
    items.push({ label: 'Pozitif Ay', value: `${stats.positiveMonths} / ${stats.n}`, hint: 'Veri kaydı var' });

    const normalizedItems = normalizeMetricItems(items, 12, 'bstat');
    grid.innerHTML = normalizedItems.map(i => `
        <div class="bstat-item ${i.cls || ''}">
            <span class="bstat-label">${i.label}</span>
            <span class="bstat-value">${i.value}</span>
            <span class="bstat-hint">${i.hint || ''}</span>
        </div>
    `).join('');
}

function setupBstatTabs() {
    const tabs = document.querySelectorAll('.bstat-subtab');
    tabs.forEach(tab => {
        tab.onclick = () => {
            const target = tab.dataset.bstat;
            tabs.forEach(t => t.classList.toggle('active', t === tab));
            ['sales', 'purchase', 'profit'].forEach(key => {
                const grid = document.getElementById(`bstat${key.charAt(0).toUpperCase() + key.slice(1)}Grid`);
                if (grid) grid.style.display = (key === target) ? 'grid' : 'none';
            });
        };
    });
}

function healthRow(label, value, hint, cls) {
    return `
        <div class="fhealth-item ${cls || ''}">
            <span class="fhealth-label">${escapeHtml(label)}</span>
            <span class="fhealth-value">${value}</span>
            <span class="fhealth-hint">${escapeHtml(hint || '')}</span>
        </div>
    `;
}

function growthRow(label, value, hint, signalValue) {
    let cls = '';
    if (typeof signalValue === 'number') {
        if (signalValue > 0) cls = 'good';
        else if (signalValue < 0) cls = 'bad';
    }
    return `
        <div class="growth-item ${cls}">
            <span class="growth-label">${escapeHtml(label)}</span>
            <span class="growth-value">${value}</span>
            <span class="growth-hint">${escapeHtml(hint || '')}</span>
        </div>
    `;
}

function normalizeMetricItems(items, targetCount, baseClass) {
    return Array.isArray(items) ? items.slice(0, targetCount) : [];
}

function normalizeMetricMarkup(rows, targetCount, baseClass) {
    return normalizeMetricItems(rows, targetCount, baseClass)
        .map(row => typeof row === 'string' ? row : renderPlaceholderMetricMarkup(baseClass, row))
        .join('');
}

function renderPlaceholderMetricMarkup(baseClass, item) {
    return `
        <div class="${baseClass}-item ${item.cls || ''}">
            <span class="${baseClass}-label">${escapeHtml(item.label)}</span>
            <span class="${baseClass}-value">${escapeHtml(item.value)}</span>
            <span class="${baseClass}-hint">${escapeHtml(item.hint || '')}</span>
        </div>
    `;
}

function fmtPct(v) {
    if (v == null || !Number.isFinite(v)) return '-';
    const sign = v > 0 ? '+' : '';
    return `${sign}${Number(v).toFixed(1)}%`;
}

let predictionChartInstance = null;

function renderPredictionChart(monthlyData, predictions, monthlyPurchases, predData) {
    const canvas = document.getElementById('predictionChart');
    if (!canvas) return;
    const emptyEl = document.getElementById('predictionChartEmpty');
    const rootStyles = getComputedStyle(document.documentElement);
    const axisColor = rootStyles.getPropertyValue('--text-muted').trim() || '#94a3b8';
    const gridColor = rootStyles.getPropertyValue('--border-color').trim() || 'rgba(148, 163, 184, 0.22)';
    const tooltipSurface = rootStyles.getPropertyValue('--tooltip-bg').trim()
        || rootStyles.getPropertyValue('--popover').trim()
        || 'rgba(0, 0, 0, 0.9)';

    if (predictionChartInstance) {
        predictionChartInstance.destroy();
    }

    if (!Array.isArray(monthlyData) || monthlyData.length < 2 || !Array.isArray(predictions) || predictions.length === 0) {
        canvas.style.display = 'none';
        if (emptyEl) emptyEl.style.display = 'grid';
        return;
    }

    canvas.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';

    // Son 12 ayı göster
    const recentSales = monthlyData.slice(-12);
    const recentPurchases = (monthlyPurchases || []).slice(-12);

    // Compute historical profit
    const recentProfit = recentSales.map((s, i) => {
        const p = recentPurchases[i]?.amount || 0;
        return { month: s.month, amount: s.amount - p };
    });

    // Labels
    const historyLabels = recentSales.map(d => formatDateLabel(d.month));
    const predLabels = predictions.map(p => formatDateLabel(p.month));

    // Duplicate check
    const lastHistoryLabel = historyLabels[historyLabels.length - 1];
    const firstPredLabel = predLabels[0];
    const duplicateFirstPred = (lastHistoryLabel && firstPredLabel && lastHistoryLabel === firstPredLabel);

    const allLabels = duplicateFirstPred
        ? [...historyLabels, ...predLabels.slice(1)]
        : [...historyLabels, ...predLabels];

    const predCount = duplicateFirstPred ? predictions.length - 1 : predictions.length;

    // === Historical datasets ===
    const salesHistory = recentSales.map(d => d.amount);
    const purchaseHistory = recentPurchases.map(d => d.amount || 0);
    const profitHistory = recentProfit.map(d => d.amount);

    // Pad with nulls for prediction area
    const pad = (arr) => { const a = [...arr]; for (let i = 0; i < predCount; i++) a.push(null); return a; };

    // === Prediction datasets ===
    const lastSalesVal = salesHistory[salesHistory.length - 1];
    const predSalesValues = duplicateFirstPred
        ? predictions.slice(1).map(p => p.amount)
        : predictions.map(p => p.amount);

    const salesPredData = new Array(salesHistory.length - 1).fill(null);
    salesPredData.push(lastSalesVal);
    salesPredData.push(...predSalesValues);

    // Confidence band
    const confidenceBands = (predData?.allConfidenceBands && predictions.length > (predData?.confidenceBands || []).length)
        ? predData.allConfidenceBands
        : (predData?.confidenceBands || []);
    const cbValues = duplicateFirstPred ? confidenceBands.slice(1) : confidenceBands;

    const upperBandData = new Array(salesHistory.length - 1).fill(null);
    upperBandData.push(lastSalesVal);
    for (const cb of cbValues) upperBandData.push(cb.upper);

    const lowerBandData = new Array(salesHistory.length - 1).fill(null);
    lowerBandData.push(lastSalesVal);
    for (const cb of cbValues) lowerBandData.push(cb.lower);

    const datasets = [
        // Confidence band upper (will be filled between upper and lower)
        {
            label: 'Güven Aralığı üst',
            data: upperBandData,
            borderColor: 'transparent',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            fill: '+1',
            pointRadius: 0,
            tension: 0.3,
            order: 5
        },
        // Confidence band lower
        {
            label: 'Güven Aralığı alt',
            data: lowerBandData,
            borderColor: 'transparent',
            backgroundColor: 'transparent',
            fill: false,
            pointRadius: 0,
            tension: 0.3,
            order: 6
        },
        // Historical Sales
        {
            label: 'Satış',
            data: pad(salesHistory),
            borderColor: '#059669',
            backgroundColor: 'rgba(5, 150, 105, 0.08)',
            tension: 0.3,
            fill: false,
            pointRadius: 3,
            borderWidth: 2,
            order: 2
        },
        // Historical Purchases
        {
            label: 'Alış',
            data: pad(purchaseHistory),
            borderColor: '#e67e22',
            backgroundColor: 'rgba(230, 126, 34, 0.08)',
            tension: 0.3,
            fill: false,
            pointRadius: 3,
            borderWidth: 2,
            order: 3
        },
        // Historical Profit
        {
            label: 'Brüt Kâr',
            data: pad(profitHistory),
            borderColor: '#1d4ed8',
            backgroundColor: 'rgba(29, 78, 216, 0.08)',
            tension: 0.3,
            fill: false,
            pointRadius: 3,
            borderWidth: 2,
            order: 4
        },
        // Sales Prediction
        {
            label: 'Satış Tahmini',
            data: salesPredData,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            borderDash: [6, 4],
            tension: 0.3,
            fill: false,
            pointRadius: 5,
            pointStyle: 'rectRot',
            borderWidth: 2.5,
            order: 1
        }
    ];

    predictionChartInstance = new Chart(canvas, {
        type: 'line',
        data: { labels: allLabels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'start',
                    labels: {
                        font: { family: 'IBM Plex Sans', size: 12, weight: '600' },
                        color: axisColor,
                        usePointStyle: true,
                        boxWidth: 8,
                        boxHeight: 8,
                        filter: function (item) {
                            // Hide confidence band entries from legend
                            return !item.text.includes('Güven Aralığı');
                        }
                    }
                },
                tooltip: {
                    backgroundColor: tooltipSurface,
                    titleFont: { family: 'IBM Plex Sans', weight: '700' },
                    bodyFont: { family: 'IBM Plex Sans' },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true,
                    filter: function (item) {
                        return !item.dataset.label.includes('Güven Aralığı');
                    },
                    callbacks: {
                        label: function (context) {
                            if (context.raw == null) return null;
                            return context.dataset.label + ': ' + formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Dönem',
                        color: axisColor,
                        font: { family: 'IBM Plex Sans', size: 11, weight: '600' }
                    },
                    grid: { display: false },
                    ticks: {
                        font: { family: 'IBM Plex Sans', size: 11 },
                        color: axisColor
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Tutar (TL)',
                        color: axisColor,
                        font: { family: 'IBM Plex Sans', size: 11, weight: '600' }
                    },
                    border: { display: false },
                    grid: { color: gridColor },
                    ticks: {
                        font: { family: 'IBM Plex Sans', size: 11 },
                        color: axisColor,
                        callback: function (value) {
                            if (Math.abs(value) >= 1000000) return '₺' + (value / 1000000).toFixed(1) + 'M';
                            if (Math.abs(value) >= 1000) return '₺' + (value / 1000).toFixed(0) + 'K';
                            return '₺' + value;
                        }
                    }
                }
            }
        }
    });
}

function formatDateLabel(yyyyMM) {
    if (!yyyyMM) return '';
    const parts = yyyyMM.split('-');
    if (parts.length < 2) return yyyyMM;

    // Check if valid date
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1);
    if (isNaN(date.getTime())) return yyyyMM;

    return date.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
}

// ========================================
// Şifre Değiştir Modal
// ========================================
window.openPasswordModal = function () {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        document.getElementById('passwordModalError').style.display = 'none';
    }
};

window.closePasswordModal = function () {
    const modal = document.getElementById('passwordModal');
    if (modal) modal.style.display = 'none';
};

window.submitPasswordChange = async function (e) {
    e.preventDefault();
    const current = document.getElementById('currentPassword').value;
    const newP = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    const errEl = document.getElementById('passwordModalError');

    if (newP !== confirm) {
        errEl.textContent = 'Yeni şifre ve tekrar alanı eşleşmiyor.';
        errEl.style.display = 'block';
        return;
    }
    if (newP.length < 6) {
        errEl.textContent = 'Yeni şifre en az 6 karakter olmalıdır.';
        errEl.style.display = 'block';
        return;
    }

    errEl.style.display = 'none';
    try {
        const response = await fetch('/api/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: current, newPassword: newP })
        });
        const data = await response.json();
        if (data.success) {
            closePasswordModal();
            showSuccessToast(data.message || 'Şifre başarıyla değiştirildi.');
        } else {
            errEl.textContent = data.error || 'Şifre güncellenemedi.';
            errEl.style.display = 'block';
        }
    } catch (err) {
        errEl.textContent = 'Sunucu hatası.';
        errEl.style.display = 'block';
    }
};

function showSuccessToast(message) {
    notify.showFloatingSuccess(message);
}

// ========================================
// Excel Export
// ========================================
function exportSummaryPdf() {
    if (!resultsSection || resultsSection.style.display === 'none') {
        showError('Önce bir analiz sonucu oluşturun.');
        return;
    }

    const summaryText = document.getElementById('summaryText')?.textContent || '';
    const timestamp = document.getElementById('timestamp')?.textContent || '';
    const totalSales = document.getElementById('totalSales')?.textContent || '-';
    const totalPurchase = document.getElementById('totalPurchase')?.textContent || '-';
    const salesTax = document.getElementById('salesTax')?.textContent || '-';
    const purchaseTax = document.getElementById('purchaseTax')?.textContent || '-';
    const profitValue = document.getElementById('profitLossValue')?.textContent || '-';
    const netTax = document.getElementById('netTax')?.textContent || '-';

    const printable = window.open('', '_blank', 'noopener,noreferrer');
    if (!printable) {
        showError('PDF özeti açmak için tarayıcı açılır pencerelerine izin verin.');
        return;
    }

    const html = `
<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <title>Analizcim Özet Raporu</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f1f1f; margin: 24px; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    .meta { color: #5f5f5f; font-size: 12px; margin-bottom: 18px; }
    .box { border: 1px solid #d9d9d9; border-radius: 8px; padding: 14px; margin-bottom: 14px; }
    .summary { line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; }
    td, th { border: 1px solid #e5e5e5; padding: 10px; text-align: left; }
    th { background: #f7f7f7; }
  </style>
</head>
<body>
  <h1>Analizcim - Yönetici Özeti</h1>
  <div class="meta">Oluşturulma: ${escapeHtml(new Date().toLocaleString('tr-TR'))}</div>
  <div class="box summary">
    <strong>Analiz Özeti:</strong><br>
    ${escapeHtml(summaryText)}<br><br>
    <strong>Analiz Zamanı:</strong> ${escapeHtml(timestamp)}
  </div>
  <div class="box">
    <table>
      <tr><th>Gösterge</th><th>Değer</th></tr>
      <tr><td>Toplam Satış</td><td>${escapeHtml(totalSales)}</td></tr>
      <tr><td>Toplam Alış</td><td>${escapeHtml(totalPurchase)}</td></tr>
      <tr><td>Satış KDV</td><td>${escapeHtml(salesTax)}</td></tr>
      <tr><td>Alış KDV</td><td>${escapeHtml(purchaseTax)}</td></tr>
      <tr><td>Brüt Kâr/Zarar</td><td>${escapeHtml(profitValue)}</td></tr>
      <tr><td>Net KDV</td><td>${escapeHtml(netTax)}</td></tr>
    </table>
  </div>
</body>
</html>`;

    printable.document.open();
    printable.document.write(html);
    printable.document.close();
    printable.focus();
    printable.print();
}

window.exportHistoryExcel = function () {
    window.location.href = '/api/export/history';
};

window.exportHistoryJson = function () {
    window.location.href = '/api/export/history/json';
};

window.exportDashboardExcel = function () {
    const yearSelect = document.getElementById('yearSelect');
    const year = yearSelect ? yearSelect.value : new Date().getFullYear();
    window.location.href = '/api/export/dashboard?year=' + encodeURIComponent(year);
};

// ========================================
// Yıl Karşılaştırma (Standalone Page)
// ========================================

async function initCompareYears() {
    try {
        const response = await fetch('/api/history');
        if (!response.ok) return;
        const data = await response.json();
        if (!data.success) return;

        const history = data.history || [];
        const years = new Set();
        history.forEach(entry => {
            const result = parseDateFromFilename(entry.salesFileName) || parseDateFromFilename(entry.purchaseFileName);
            const year = result ? result.year : new Date(entry.date).getFullYear();
            years.add(year);
        });
        const sortedYears = Array.from(years).sort((a, b) => b - a);

        const y1 = document.getElementById('compareYear1');
        const y2 = document.getElementById('compareYear2');

        if (y1 && (y1.options.length === 0)) {
            sortedYears.forEach(y => y1.appendChild(new Option(y, y)));
            if (sortedYears.length >= 2) y1.value = sortedYears[1];
        }
        if (y2 && (y2.options.length === 0)) {
            sortedYears.forEach(y => y2.appendChild(new Option(y, y)));
            if (sortedYears.length >= 1) y2.value = sortedYears[0];
        }
    } catch (err) {
        console.error('initCompareYears error:', err);
    }
}

let compareMonthlyChartInstance = null;

function setComparePanelVisibility(show) {
    const deltaCards = document.getElementById('compareDeltaCards');
    const chartSection = document.getElementById('compareChartSection');
    const monthlySection = document.getElementById('compareMonthlySection');
    const emptyState = document.getElementById('compareEmpty');
    if (deltaCards) deltaCards.style.display = show ? 'grid' : 'none';
    if (chartSection) chartSection.style.display = show ? 'block' : 'none';
    if (monthlySection) monthlySection.style.display = show ? 'block' : 'none';
    if (emptyState) emptyState.style.display = show ? 'none' : 'flex';
}

function updateCompareDeltaCard(cardId, valueId, metaId, label, percent, diff) {
    const card = document.getElementById(cardId);
    const valueEl = document.getElementById(valueId);
    const metaEl = document.getElementById(metaId);
    if (!card || !valueEl || !metaEl) return;
    const numericPercent = percent == null ? null : Number(percent);
    const numericDiff = Number(diff || 0);
    const tone = numericPercent == null || numericPercent === 0 ? 'neutral' : (numericPercent > 0 ? 'positive' : 'negative');
    const arrow = numericPercent == null || numericPercent === 0 ? '→' : (numericPercent > 0 ? '↗' : '↘');
    card.className = 'compare-delta-card ' + tone;
    valueEl.textContent = numericPercent == null ? '-' : arrow + ' ' + (numericPercent >= 0 ? '+' : '') + numericPercent.toFixed(1) + '%';
    metaEl.textContent = label + ': ' + (numericDiff >= 0 ? '+' : '') + formatCurrency(numericDiff);
}

function renderCompareMonthlyChart(year1, year2) {
    const canvas = document.getElementById('compareMonthlyChart');
    if (!canvas || !window.Chart) return;
    const rootStyles = getComputedStyle(document.documentElement);
    const axisColor = rootStyles.getPropertyValue('--text-muted').trim() || '#737373';
    const gridColor = rootStyles.getPropertyValue('--border-color').trim() || '#e5e5e5';
    const labels = (year1.monthly || []).map(item => item.monthName);

    if (compareMonthlyChartInstance) {
        compareMonthlyChartInstance.destroy();
    }

    compareMonthlyChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: year1.year + ' Satış',
                    data: (year1.monthly || []).map(item => item.sales || 0),
                    backgroundColor: 'rgba(5, 150, 105, 0.72)',
                    borderRadius: 5
                },
                {
                    label: year1.year + ' Alış',
                    data: (year1.monthly || []).map(item => item.purchase || 0),
                    backgroundColor: 'rgba(217, 119, 6, 0.62)',
                    borderRadius: 5
                },
                {
                    label: year2.year + ' Satış',
                    data: (year2.monthly || []).map(item => item.sales || 0),
                    backgroundColor: 'rgba(14, 165, 233, 0.72)',
                    borderRadius: 5
                },
                {
                    label: year2.year + ' Alış',
                    data: (year2.monthly || []).map(item => item.purchase || 0),
                    backgroundColor: 'rgba(100, 116, 139, 0.58)',
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 10, color: axisColor } },
                tooltip: {
                    callbacks: {
                        label: (context) => (context.dataset.label || '') + ': ' + formatCurrency(context.raw || 0)
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: axisColor, maxRotation: 0, autoSkip: true } },
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor },
                    ticks: {
                        color: axisColor,
                        callback: (value) => formatCompactCurrency(value)
                    }
                }
            }
        }
    });
}

window.loadCompare = async function () {
    const y1 = document.getElementById('compareYear1')?.value;
    const y2 = document.getElementById('compareYear2')?.value;
    if (!y1 || !y2) {
        showError('İki yıl seçin.');
        return;
    }

    setComparePanelVisibility(true);

    try {
        const response = await fetch('/api/compare?year1=' + encodeURIComponent(y1) + '&year2=' + encodeURIComponent(y2));
        const data = await response.json();
        if (!data.success) {
            showError(data.error || 'Karşılaştırma yapılamadı.');
            setComparePanelVisibility(false);
            return;
        }

        const a = data.year1;
        const b = data.year2;
        const growth = data.growth || {};

        updateCompareDeltaCard('compareSalesDeltaCard', 'compareSalesDeltaValue', 'compareSalesDeltaMeta', 'Satış farkı', growth.sales, b.sales - a.sales);
        updateCompareDeltaCard('compareCostDeltaCard', 'compareCostDeltaValue', 'compareCostDeltaMeta', 'Alış farkı', growth.purchase, b.purchase - a.purchase);
        updateCompareDeltaCard('compareNetDeltaCard', 'compareNetDeltaValue', 'compareNetDeltaMeta', 'Net kâr farkı', growth.net_profit, (b.net_profit ?? b.profit) - (a.net_profit ?? a.profit));

        const chartMeta = document.getElementById('compareChartMeta');
        if (chartMeta) chartMeta.textContent = a.year + ' - ' + b.year;
        renderCompareMonthlyChart(a, b);

        const monthY1 = document.getElementById('compareMonthY1Label');
        const monthY2 = document.getElementById('compareMonthY2Label');
        if (monthY1) monthY1.textContent = a.year;
        if (monthY2) monthY2.textContent = b.year;

        const monthlyBody = document.getElementById('compareMonthlyBody');
        if (monthlyBody && a.monthly && b.monthly) {
            const monthlyRows = a.monthly.map((m1, i) => {
                const m2 = b.monthly[i] || {};
                const s1 = m1.sales || 0;
                const s2 = m2.sales || 0;
                const diff = s2 - s1;
                const growthPct = s1 ? ((s2 - s1) / s1 * 100) : null;
                const diffClass = diff > 0 ? 'value-positive' : (diff < 0 ? 'value-negative' : 'value-neutral');
                const growthClass = growthPct != null ? (growthPct > 0 ? 'value-positive' : (growthPct < 0 ? 'value-negative' : 'value-neutral')) : '';
                const growthText = growthPct != null ? ((growthPct >= 0 ? '+' : '') + growthPct.toFixed(1) + '%') : '-';

                return `<tr>
                    <td>${m1.monthName || ''}</td>
                    <td>${formatCurrency(s1)}</td>
                    <td>${formatCurrency(s2)}</td>
                    <td class="${diffClass}">${(diff >= 0 ? '+' : '') + formatCurrency(diff)}</td>
                    <td class="${growthClass}">${growthText}</td>
                </tr>`;
            });
            const totalDiff = b.sales - a.sales;
            const totalGrowth = a.sales ? ((b.sales - a.sales) / a.sales * 100) : null;
            const totalDiffClass = totalDiff > 0 ? 'value-positive' : (totalDiff < 0 ? 'value-negative' : 'value-neutral');
            const totalGrowthClass = totalGrowth != null ? (totalGrowth > 0 ? 'value-positive' : (totalGrowth < 0 ? 'value-negative' : 'value-neutral')) : '';
            const totalGrowthText = totalGrowth != null ? ((totalGrowth >= 0 ? '+' : '') + totalGrowth.toFixed(1) + '%') : '-';
            monthlyRows.push(`<tr class="compare-total-row">
                <td>Toplam</td>
                <td>${formatCurrency(a.sales)}</td>
                <td>${formatCurrency(b.sales)}</td>
                <td class="${totalDiffClass}">${(totalDiff >= 0 ? '+' : '') + formatCurrency(totalDiff)}</td>
                <td class="${totalGrowthClass}">${totalGrowthText}</td>
            </tr>`);
            monthlyBody.innerHTML = monthlyRows.join('');
        }

    } catch (err) {
        console.error('loadCompare error:', err);
        showError('Karşılaştırma yüklenirken hata oluştu.');
        setComparePanelVisibility(false);
    }
};

// ========================================
// Predictions: Resize wrappers, Layout, Drag & Drop
// ========================================
const PRED_ORDER_KEY = 'predictions_card_order_v4';
const PRED_LAYOUT_KEY = 'predictions_layout_id';
let _draggedCard = null;

/** Kartları kesikli çerçeve ve resize için saran wrapper ekler (bir kez). */
function wrapPredictionCardsForResize() {
    const grid = document.getElementById('predictionsGrid');
    if (!grid) return;

    const cards = grid.querySelectorAll('.pred-card[draggable="true"]');
    cards.forEach(card => {
        if (card.closest('.pred-card-resize-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'pred-card-resize-wrapper';
        wrapper.dataset.cardId = card.dataset.cardId || '';
        card.setAttribute('draggable', 'false');
        card.parentNode.insertBefore(wrapper, card);
        wrapper.appendChild(card);
    });

    syncPredictionWrapperVisibility();
}

function syncPredictionWrapperVisibility() {
    const grid = document.getElementById('predictionsGrid');
    if (!grid) return;

    grid.querySelectorAll('.pred-card-resize-wrapper').forEach(wrapper => {
        const card = wrapper.querySelector('.pred-card');
        if (!card) return;
        const hidden = card.style.display === 'none' || card.hidden || getComputedStyle(card).display === 'none';
        wrapper.style.display = hidden ? 'none' : '';
    });
}

/** Layout seçicisini bağlar ve kayıtlı layout'u uygular (sadece stil; sıra restorePredictionOrder ile). */
async function initPredictionsLayout() {
    const grid = document.getElementById('predictionsGrid');
    const select = document.getElementById('predictionLayoutSelect');
    if (!grid || !select) return;

    let savedLayout = null;
    try {
        const response = await fetch('/api/user/preferences?keys=predictions_layout_id');
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.preferences && data.preferences.predictions_layout_id) {
                savedLayout = data.preferences.predictions_layout_id;
            }
        }
    } catch (_) { }
    if (!savedLayout) {
        try { savedLayout = localStorage.getItem(PRED_LAYOUT_KEY); } catch (_) { }
        if (savedLayout) {
            try {
                await fetch('/api/user/preferences/migrate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ predictions_layout_id: savedLayout })
                });
            } catch (_) { }
        }
    }
    if (savedLayout) select.value = savedLayout;
    setPredictionLayoutStyle(select.value);

    select.addEventListener('change', async function () {
        const val = this.value;
        setPredictionLayoutStyle(val);
        applyPredictionLayoutOrder(val);
        try { localStorage.setItem(PRED_LAYOUT_KEY, val); } catch (_) { }
        try {
            await fetch('/api/user/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ predictions_layout_id: val })
            });
        } catch (_) { }
    });
}

/** Sadece grid data-layout (stil) ayarlar; sıra değişmez. */
function setPredictionLayoutStyle(layoutId) {
    const grid = document.getElementById('predictionsGrid');
    if (!grid) return;
    grid.dataset.layout = layoutId || 'default';
}

/** Taslak layout'a göre kart sırasını uygular (kullanıcı dropdown'dan seçtiğinde). */
function applyPredictionLayoutOrder(layoutId) {
    const grid = document.getElementById('predictionsGrid');
    if (!grid) return;
    syncPredictionWrapperVisibility();

    const orderByLayout = {
        default: ['table', 'chart', 'risk-factors', 'scenarios', 'financial-health', 'growth-metrics', 'decision-impact', 'actions', 'cfo-missing'],
        'chart-first': ['chart', 'table', 'risk-factors', 'scenarios', 'financial-health', 'growth-metrics', 'decision-impact', 'actions', 'cfo-missing'],
        'tables-top': ['table', 'scenarios', 'chart', 'risk-factors', 'financial-health', 'growth-metrics', 'decision-impact', 'actions', 'cfo-missing'],
        compact: ['table', 'chart', 'risk-factors', 'scenarios', 'decision-impact', 'financial-health', 'growth-metrics', 'actions', 'cfo-missing'],
        'summary-focus': ['risk-factors', 'table', 'chart', 'scenarios', 'decision-impact', 'financial-health', 'growth-metrics', 'actions', 'cfo-missing']
    };

    const order = orderByLayout[layoutId] || orderByLayout.default;
    const wrappers = [...grid.querySelectorAll('.pred-card-resize-wrapper')];
    const byId = {};
    wrappers.forEach(w => { byId[w.dataset.cardId] = w; });

    order.forEach(id => {
        const w = byId[id];
        if (w) grid.appendChild(w);
    });

    savePredictionOrder();

    if (typeof predictionChartInstance !== 'undefined' && predictionChartInstance) {
        setTimeout(() => predictionChartInstance.resize(), 50);
    }
}

/** Grafik kartı resize edildiğinde Chart'ı yeniden boyutlandırır. */
function observePredictionChartResize() {
    const grid = document.getElementById('predictionsGrid');
    if (!grid) return;

    const chartWrapper = grid.querySelector('.pred-card-resize-wrapper[data-card-id="chart"]');
    if (!chartWrapper || typeof predictionChartInstance === 'undefined' || !predictionChartInstance) return;

    const ro = new ResizeObserver(() => {
        if (predictionChartInstance) predictionChartInstance.resize();
    });
    ro.observe(chartWrapper);
}

function initPredictionsDragDrop() {
    const grid = document.getElementById('predictionsGrid');
    if (!grid) return;

    const wrappers = grid.querySelectorAll('.pred-card-resize-wrapper');
    wrappers.forEach(wrapper => {
        wrapper.setAttribute('draggable', 'true');
        // Idempotent bağlama: filtre/sekme değişince initPredictionsDragDrop tekrar çağrılıyor;
        // önce kaldır sonra ekle ki aynı elemana dinleyiciler birikmesin (sürükle-bırak bozulmasın).
        wrapper.removeEventListener('dragstart', onPredDragStart);
        wrapper.addEventListener('dragstart', onPredDragStart);
        wrapper.removeEventListener('dragend', onPredDragEnd);
        wrapper.addEventListener('dragend', onPredDragEnd);
        wrapper.removeEventListener('dragover', onPredDragOver);
        wrapper.addEventListener('dragover', onPredDragOver);
        wrapper.removeEventListener('dragenter', onPredDragEnter);
        wrapper.addEventListener('dragenter', onPredDragEnter);
        wrapper.removeEventListener('dragleave', onPredDragLeave);
        wrapper.addEventListener('dragleave', onPredDragLeave);
        wrapper.removeEventListener('drop', onPredDrop);
        wrapper.addEventListener('drop', onPredDrop);
    });

    restorePredictionOrder();
}

function onPredDragStart(e) {
    _draggedCard = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.cardId);
}

function onPredDragEnd() {
    this.classList.remove('dragging');
    _draggedCard = null;
    document.querySelectorAll('.pred-card-resize-wrapper.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function onPredDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function onPredDragEnter(e) {
    e.preventDefault();
    if (this !== _draggedCard) {
        this.classList.add('drag-over');
    }
}

function onPredDragLeave() {
    this.classList.remove('drag-over');
}

function onPredDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (!_draggedCard || _draggedCard === this) return;

    const grid = document.getElementById('predictionsGrid');
    const wrappers = [...grid.querySelectorAll('.pred-card-resize-wrapper')];
    const fromIdx = wrappers.indexOf(_draggedCard);
    const toIdx = wrappers.indexOf(this);

    if (fromIdx < toIdx) {
        grid.insertBefore(_draggedCard, this.nextSibling);
    } else {
        grid.insertBefore(_draggedCard, this);
    }

    savePredictionOrder();

    if (typeof predictionChartInstance !== 'undefined' && predictionChartInstance) {
        setTimeout(() => predictionChartInstance.resize(), 50);
    }
}

async function savePredictionOrder() {
    const grid = document.getElementById('predictionsGrid');
    if (!grid) return;
    const order = [...grid.querySelectorAll('.pred-card-resize-wrapper')].map(w => w.dataset.cardId);
    try { localStorage.setItem(PRED_ORDER_KEY, JSON.stringify(order)); } catch (_) { }
    try {
        await fetch('/api/user/preferences', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [PRED_ORDER_KEY]: order })
        });
    } catch (_) { }
}

async function restorePredictionOrder() {
    const grid = document.getElementById('predictionsGrid');
    if (!grid) return;

    const wrappers = [...grid.querySelectorAll('.pred-card-resize-wrapper')];
    if (wrappers.length === 0) return;

    let order = null;
    try {
        const response = await fetch('/api/user/preferences?keys=' + encodeURIComponent(PRED_ORDER_KEY));
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.preferences && data.preferences[PRED_ORDER_KEY] != null) {
                const raw = data.preferences[PRED_ORDER_KEY];
                order = typeof raw === 'string' ? JSON.parse(raw) : raw;
            }
        }
    } catch (_) { }
    if (!order || !Array.isArray(order) || order.length === 0) {
        try { order = JSON.parse(localStorage.getItem(PRED_ORDER_KEY)); } catch (_) { return; }
        if (!order || !Array.isArray(order) || order.length === 0) return;
        try {
            await fetch('/api/user/preferences/migrate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [PRED_ORDER_KEY]: order })
            });
        } catch (_) { }
    }

    const byId = {};
    wrappers.forEach(w => { byId[w.dataset.cardId] = w; });

    order.forEach(id => {
        const w = byId[id];
        if (w) grid.appendChild(w);
    });

    if (typeof predictionChartInstance !== 'undefined' && predictionChartInstance) {
        setTimeout(() => predictionChartInstance.resize(), 50);
    }
}

// ========================================
// Admin Panel Functions
// ========================================

let _adminTabsSetup = false;

function setupAdminTabs() {
    if (_adminTabsSetup) return;
    _adminTabsSetup = true;

    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.classList.contains('admin-only') && !isCurrentUserAdmin()) return;
            openSettingsTab(tab.dataset.adminTab);
        });
    });
}

function isPendingUsersViewActive() {
    const activeAdminTab = document.querySelector('.admin-tab.active');
    return currentTab === 'admin' && activeAdminTab?.dataset.adminTab === 'users';
}

function syncPendingUsersPolling({ forceLoad = false } = {}) {
    if (!isCurrentUserAdmin()) {
        stopPendingUsersPolling();
        return;
    }

    if (!isPendingUsersViewActive()) {
        stopPendingUsersPolling();
        return;
    }

    startPendingUsersPolling(forceLoad);
}

window.openSettingsTab = function openSettingsTab(targetTab = 'account') {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(t => {
        const isActive = t.dataset.adminTab === targetTab;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.style.display = 'none';
    });
    const targetContent = document.getElementById('admin' + targetTab.charAt(0).toUpperCase() + targetTab.slice(1) + 'Tab');
    if (targetContent) targetContent.style.display = 'block';

    if (targetTab === 'system' && typeof window.loadBackupsList === 'function') {
        window.loadBackupsList();
        if (typeof window.loadAuditLogs === 'function') window.loadAuditLogs();
    }
    if (targetTab === 'archive') {
        loadArchivesList();
        populateArchiveYearSelect();
    }

    populateSettingsAccountSummary();
    setupThemePreferenceControls();
    syncPendingUsersPolling({ forceLoad: targetTab === 'users' });
};

function populateSettingsAccountSummary() {
    const summary = document.getElementById('settingsAccountSummary');
    if (!summary) return;
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const username = user.username || 'Bilinmiyor';
        const role = user.is_admin ? 'Yönetici' : 'Kullanıcı';
        summary.innerHTML =
            '<div class="settings-info-row"><span>Kullanıcı</span><strong>' + escapeHtml(username) + '</strong></div>' +
            '<div class="settings-info-row"><span>Rol</span><strong>' + role + '</strong></div>';
    } catch (_) {
        summary.innerHTML = '';
    }
}

// ========================================
// Archive Functions
// ========================================
async function loadArchivesList() {
    try {
        const res = await fetch('/api/archive');
        const data = await res.json();
        const list = document.getElementById('archiveList');
        if (!list) return;
        if (!data.success || data.archives.length === 0) {
            list.innerHTML = '<div class="history-empty">Henüz arşivlenmiş yıl bulunmuyor.</div>';
            return;
        }
        list.innerHTML = data.archives.map(a => `
            <div class="history-card" style="margin-bottom:8px;">
                <div class="history-card-info">
                    <strong>${a.year}</strong>
                    <span class="history-card-date">${a.sizeFormatted} — ${new Date(a.created).toLocaleDateString('tr-TR')}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Arşiv listesi yüklenemedi:', error);
    }
}

async function populateArchiveYearSelect() {
    const select = document.getElementById('archiveYearSelect');
    if (!select) return;
    try {
        const res = await fetch('/api/history?limit=1&sort=date_asc');
        const data = await res.json();
        const archiveBtn = document.getElementById('archiveYearBtn');
        const restoreBtn = document.getElementById('restoreArchiveBtn');
        const deleteBtn = document.getElementById('deleteArchiveBtn');
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let y = currentYear; y >= 2000; y--) {
            years.push(y);
        }
        select.innerHTML = '<option value="">— Yıl Seçin —</option>' + years.map(y =>
            `<option value="${y}">${y}</option>`
        ).join('');
        select.onchange = () => {
            const val = select.value;
            if (archiveBtn) archiveBtn.disabled = !val;
            if (restoreBtn) restoreBtn.disabled = !val;
            if (deleteBtn) deleteBtn.disabled = !val;
        };
    } catch (error) {
        console.error('Yıl seçici yüklenemedi:', error);
    }
}

async function archiveSelectedYear() {
    const select = document.getElementById('archiveYearSelect');
    const year = select?.value;
    if (!year) return;
    if (!(await showConfirm({ message: `${year} yılına ait tüm verileri arşivlemek istediğinize emin misiniz? Bu işlem verileri ana veritabanından taşır.`, confirmText: 'Arşivle' }))) return;
    try {
        const res = await fetch('/api/archive/' + year, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
            showError(data.error || 'Arşivleme başarısız.');
            return;
        }
        showSuccessToast(`${year} yılı arşivlendi (${data.analyses} analiz, ${data.summaries} özet, ${data.expenses} gider).`);
        loadArchivesList();
    } catch (error) {
        showError('Arşivleme sırasında hata oluştu.');
    }
}

async function restoreSelectedArchive() {
    const select = document.getElementById('archiveYearSelect');
    const year = select?.value;
    if (!year) return;
    if (!(await showConfirm({ message: `${year} yılı arşivini geri yüklemek istediğinize emin misiniz?`, confirmText: 'Geri Yükle' }))) return;
    try {
        const res = await fetch('/api/archive/' + year + '/restore', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
            showError(data.error || 'Geri yükleme başarısız.');
            return;
        }
        showSuccessToast(`${year} yılı geri yüklendi (${data.analyses} analiz, ${data.summaries} özet, ${data.expenses} gider).`);
        loadArchivesList();
    } catch (error) {
        showError('Geri yükleme sırasında hata oluştu.');
    }
}

async function deleteSelectedArchive() {
    const select = document.getElementById('archiveYearSelect');
    const year = select?.value;
    if (!year) return;
    if (!(await showConfirm({ message: `${year} yılı arşivini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`, danger: true, confirmText: 'Sil' }))) return;
    try {
        const res = await fetch('/api/archive/' + year, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) {
            showError(data.error || 'Silme başarısız.');
            return;
        }
        showSuccessToast(`${year} yılı arşivi silindi.`);
        loadArchivesList();
    } catch (error) {
        showError('Arşiv silinirken hata oluştu.');
    }
}

async function loadAdminData() {
    if (!isCurrentUserAdmin()) return;
    try {
        const usersRes = await fetch('/api/users');
        const usersData = await usersRes.json();
        
        const historyRes = await fetch('/api/history?limit=1');
        const historyData = await historyRes.json();
        
        document.getElementById('adminTotalUsers').textContent = usersData.success ? usersData.users.length : '-';
        document.getElementById('adminTotalAnalyses').textContent = historyData.total || '-';

        renderAdminUsers(usersData.success ? usersData.users : []);
        loadAdminDataCounts();
        if (typeof window.loadBackupsList === 'function') window.loadBackupsList();
        if (typeof window.loadAuditLogs === 'function') window.loadAuditLogs();
        if (typeof window.loadPendingUsers === 'function' && isPendingUsersViewActive()) window.loadPendingUsers();

    } catch (error) {
        console.error('Admin veri yükleme hatası:', error);
    }
}

// ========================================
// Pending Users (Admin Approval)
// ========================================
let _pendingUsersPollTimer = null;
const PENDING_POLL_INTERVAL_MS = 5000;

window.loadPendingUsers = async function () {
    try {
        const response = await fetch('/api/admin/pending-users');
        if (!response.ok) {
            // Admin değilse sessizce atla (normal kullanıcıya görünmemeli)
            if (response.status === 403 || response.status === 401) {
                stopPendingUsersPolling();
                return;
            }
            return;
        }
        const data = await response.json();
        if (!data.success) return;
        renderPendingUsers(data.users || []);
        updatePendingBadge(data.count || 0);
    } catch (error) {
        console.error('Onay bekleyen kullanıcıları yükleme hatası:', error);
    }
};

function renderPendingUsers(users) {
    const section = document.getElementById('pendingUsersSection');
    const listEl = document.getElementById('pendingUsersList');
    const badgeEl = document.getElementById('pendingUsersBadge');
    const emptyEl = document.getElementById('pendingUsersEmpty');
    if (!section || !listEl) return;

    if (!users || users.length === 0) {
        section.style.display = 'block';
        listEl.innerHTML = '';
        if (badgeEl) badgeEl.textContent = '0';
        if (emptyEl) emptyEl.style.display = 'block';
        return;
    }

    section.style.display = 'block';
    if (badgeEl) badgeEl.textContent = users.length;
    if (emptyEl) emptyEl.style.display = 'none';

    listEl.innerHTML = users.map(u => `
        <div class="pending-user-card" data-user-id="${u.id}">
            <div class="pending-user-info">
                <div class="pending-user-avatar">${escapeHtml(u.username.charAt(0).toUpperCase())}</div>
                <div class="pending-user-details">
                    <span class="pending-user-name">${escapeHtml(u.username)}</span>
                    <span class="pending-user-meta">
                        <span class="pending-badge">Onay Bekliyor</span>
                        <span class="pending-user-date">Kayıt: ${new Date(u.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                </div>
            </div>
            <div class="pending-user-actions">
                <button class="pending-btn approve" onclick="approvePendingUser(${u.id}, '${escapeAttr(u.username)}')" title="Onayla">
                    Onayla
                </button>
                <button class="pending-btn reject" onclick="rejectPendingUser(${u.id}, '${escapeAttr(u.username)}')" title="Reddet">
                    Reddet
                </button>
            </div>
        </div>
    `).join('');
}

function updatePendingBadge(count) {
    const navBadge = document.getElementById('adminPendingBadge');
    if (navBadge) {
        if (count > 0) {
            navBadge.textContent = count;
            navBadge.style.display = 'inline-flex';
        } else {
            navBadge.style.display = 'none';
        }
    }
}

window.approvePendingUser = async function (id, username) {
    if (!(await showConfirm({ message: `"${username}" kullanıcısını onaylamak istediğinize emin misiniz? Onay sonrası sisteme giriş yapabilecektir.`, confirmText: 'Onayla' }))) return;
    try {
        const response = await fetch(`/api/admin/users/${id}/approve`, { method: 'POST' });
        const data = await response.json();
        if (response.ok && data.success) {
            showSuccessToast(`"${username}" kullanıcısı onaylandı.`);
            loadPendingUsers();
            loadAdminData();
        } else {
            showError(data.error || 'Onaylama başarısız.');
        }
    } catch (error) {
        console.error('Onaylama hatası:', error);
        showError('Onaylama sırasında hata oluştu.');
    }
};

window.rejectPendingUser = async function (id, username) {
    if (!(await showConfirm({ message: `"${username}" kullanıcısının kaydını reddetmek istediğinize emin misiniz? Bu kullanıcı sisteme giriş yapamayacaktır.`, danger: true, confirmText: 'Reddet' }))) return;
    try {
        const response = await fetch(`/api/admin/users/${id}/reject`, { method: 'POST' });
        const data = await response.json();
        if (response.ok && data.success) {
            showSuccessToast(`"${username}" kullanıcısı reddedildi.`);
            loadPendingUsers();
            loadAdminData();
        } else {
            showError(data.error || 'Reddetme başarısız.');
        }
    } catch (error) {
        console.error('Reddetme hatası:', error);
        showError('Reddetme sırasında hata oluştu.');
    }
};

function startPendingUsersPolling(forceLoad = false) {
    if (forceLoad) loadPendingUsers();
    if (_pendingUsersPollTimer) return;
    _pendingUsersPollTimer = setInterval(() => {
        if (!isPendingUsersViewActive()) {
            stopPendingUsersPolling();
            return;
        }
        loadPendingUsers();
    }, PENDING_POLL_INTERVAL_MS);
}

function stopPendingUsersPolling() {
    if (_pendingUsersPollTimer) {
        clearInterval(_pendingUsersPollTimer);
        _pendingUsersPollTimer = null;
    }
}

window.addEventListener('beforeunload', stopPendingUsersPolling);

async function loadAdminDataCounts() {
    try {
        const historyRes = await fetch('/api/history?limit=1000');
        const historyData = await historyRes.json();
        document.getElementById('adminAnalysesCount').textContent = historyData.total || '0';

        const currentYear = new Date().getFullYear();
        const summariesRes = await fetch('/api/summaries/' + currentYear);
        const summariesData = await summariesRes.json();
        document.getElementById('adminSummariesCount').textContent = summariesData.success ? summariesData.summaries.length : '0';

        const expensesRes = await fetch('/api/expenses-local/years');
        const expensesData = await expensesRes.json();
        document.getElementById('adminExpensesCount').textContent = expensesData.success ? expensesData.years.length + ' yıl' : '0';

    } catch (error) {
        console.error('Admin veri sayıları yükleme hatası:', error);
    }
}

function getUserStatusBadge(user) {
    const status = user.status || 'approved';
    if (status === 'pending') return '<span class="admin-status-badge pending">Onay bekliyor</span>';
    if (status === 'rejected') return '<span class="admin-status-badge rejected">Reddedildi</span>';
    return '<span class="admin-status-badge approved">Onaylı</span>';
}

function renderAdminUsers(users) {
    const listEl = document.getElementById('adminUsersList');
    if (!listEl) return;

    if (!users || users.length === 0) {
        listEl.innerHTML = '<div class="admin-empty"><p>Kullanıcı bulunamadı</p></div>';
        return;
    }

    listEl.innerHTML = users.map(user => `
        <div class="admin-user-card" data-user-id="${user.id}">
            <div class="admin-user-info">
                <div class="admin-user-avatar">${escapeHtml(user.username.charAt(0).toUpperCase())}</div>
                <div class="admin-user-details">
                    <span class="admin-user-name">${escapeHtml(user.username)}</span>
                    <span class="admin-user-meta">
                        ${user.is_admin ? '<span class="admin-badge">Admin</span>' : '<span class="user-badge">Kullanıcı</span>'}
                        ${getUserStatusBadge(user)}
                        <span class="admin-user-date">Kayıt: ${new Date(user.created_at).toLocaleDateString('tr-TR')}</span>
                    </span>
                </div>
            </div>
            <div class="admin-user-actions">
                <button class="admin-user-btn" onclick="toggleUserRole(${user.id}, ${user.is_admin})" title="Rolü değiştir">
                    ${user.is_admin ? 'Kullanıcı yap' : 'Admin yap'}
                </button>
                <button class="admin-user-btn danger" onclick="deleteUser(${user.id})" title="Kullanıcıyı sil">
                    Sil
                </button>
            </div>
        </div>
    `).join('');
}

window.toggleUserRole = async function(userId, currentRole) {
    const newRole = currentRole ? 'user' : 'admin';
    if (!(await showConfirm({ message: 'Kullanıcı rolünü "' + newRole + '" olarak değiştirmek istediğinize emin misiniz?', confirmText: 'Değiştir' }))) {
        return;
    }

    try {
        const response = await fetch('/api/users/' + userId + '/role', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: newRole })
        });
        const data = await response.json();
        if (data.success) {
            showSuccessToast('Kullanıcı rolü güncellendi.');
            loadAdminData();
        } else {
            showError(data.error || 'Rol güncellenemedi.');
        }
    } catch (error) {
        console.error('Rol güncelleme hatası:', error);
        showError('Rol güncellenirken hata oluştu.');
    }
};

window.deleteUser = async function(userId) {
    if (!(await showConfirm({ message: 'Bu kullanıcıyı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!', danger: true, confirmText: 'Sil' }))) {
        return;
    }

    try {
        const response = await fetch('/api/users/' + userId, {
            method: 'DELETE'
        });
        const data = await response.json();
        if (data.success) {
            showSuccessToast('Kullanıcı silindi.');
            loadAdminData();
        } else {
            showError(data.error || 'Kullanıcı silinemedi.');
        }
    } catch (error) {
        console.error('Kullanıcı silme hatası:', error);
        showError('Kullanıcı silinirken hata oluştu.');
    }
};

window.openAddUserModal = function() {
    const modal = document.getElementById('addUserModal');
    if (modal) {
        modal.style.display = 'flex';
        document.getElementById('newUsername').value = '';
        document.getElementById('newUserPassword').value = '';
        document.getElementById('newUserRole').value = 'user';
        document.getElementById('addUserModalError').style.display = 'none';
    }
};

window.closeAddUserModal = function() {
    const modal = document.getElementById('addUserModal');
    if (modal) modal.style.display = 'none';
};

window.submitAddUser = async function(e) {
    e.preventDefault();
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newUserPassword').value;
    const role = document.getElementById('newUserRole').value;
    const errEl = document.getElementById('addUserModalError');

    if (!username || username.length < 3) {
        errEl.textContent = 'Kullanıcı adı en az 3 karakter olmalıdır.';
        errEl.style.display = 'block';
        return;
    }

    if (!password || password.length < 8) {
        errEl.textContent = 'Şifre en az 8 karakter olmalıdır.';
        errEl.style.display = 'block';
        return;
    }

    errEl.style.display = 'none';

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, role })
        });
        const data = await response.json();
        if (data.success) {
            closeAddUserModal();
            showSuccessToast('Kullanıcı başarıyla eklendi.');
            loadAdminData();
        } else {
            errEl.textContent = data.error || 'Kullanıcı eklenemedi.';
            errEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Kullanıcı ekleme hatası:', error);
        errEl.textContent = 'Sunucu hatası.';
        errEl.style.display = 'block';
    }
};

// Mevcut "Yedekle" üst butonu — sunucu tarafında yedek oluşturur
window.createBackup = async function() {
    await createServerBackup();
};

// ========================================
// Backup Manager (Sunucu tarafı)
// ========================================

window.createServerBackup = async function () {
    const btn = document.getElementById('adminCreateBackupBtn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
    try {
        const response = await fetch('/api/admin/backups', { method: 'POST' });
        const data = await response.json();
        if (response.ok && data.success) {
            const deletedMsg = (data.deleted && data.deleted.length > 0)
                ? ` (${data.deleted.length} eski yedek silindi)` : '';
            showSuccessToast('Yedek başarıyla oluşturuldu.' + deletedMsg);
            await loadBackupsList();
            // Ana ekrandaki son yedekleme bilgisini de güncelle
            const lastBackupEl = document.getElementById('adminLastBackup');
            if (lastBackupEl) {
                lastBackupEl.textContent = new Date().toLocaleDateString('tr-TR');
            }
        } else {
            showError(data.error || 'Yedek oluşturulamadı.');
        }
    } catch (error) {
        console.error('Yedekleme hatası:', error);
        showError('Yedekleme sırasında hata oluştu.');
    } finally {
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
    }
};

window.loadBackupsList = async function () {
    const listEl = document.getElementById('adminBackupsList');
    if (!listEl) return;
    listEl.innerHTML = '<div class="admin-empty"><p>Yükleniyor...</p></div>';
    try {
        const response = await fetch('/api/admin/backups');
        const data = await response.json();
        if (!response.ok || !data.success) {
            listEl.innerHTML = `<div class="admin-empty"><p>${escapeHtml(data.error || 'Yedekler yüklenemedi.')}</p></div>`;
            return;
        }
        renderBackupsList(data.backups, data);

        // Son yedekleme tarihini ana panele yansıt
        const lastBackupEl = document.getElementById('adminLastBackup');
        if (lastBackupEl) {
            if (data.backups && data.backups.length > 0) {
                lastBackupEl.textContent = formatBackupDate(data.backups[0].created_at);
            } else {
                lastBackupEl.textContent = 'Yok';
            }
        }
    } catch (error) {
        console.error('Yedek listesi yüklenemedi:', error);
        listEl.innerHTML = '<div class="admin-empty"><p>Yedekler yüklenirken hata oluştu.</p></div>';
    }
};

function formatAuditAction(action) {
    const labels = {
        'user.approve': 'Kullanıcı onaylandı',
        'user.reject': 'Kullanıcı reddedildi',
        'user.delete': 'Kullanıcı silindi',
        'user.role.update': 'Kullanıcı rolü değişti',
        'archive.year': 'Yıl arşivlendi',
        'archive.restore': 'Arşiv geri yüklendi',
        'archive.delete': 'Arşiv silindi',
        'backup.create': 'Yedek oluşturuldu',
        'backup.restore': 'Yedekten geri yüklendi',
        'backup.delete': 'Yedek silindi',
        'backup.download': 'Veritabanı dışa aktarıldı',
        'backup.upload.restore': 'Dosyadan geri yükleme yapıldı'
    };
    return labels[action] || action;
}

function formatAuditMeta(log) {
    const details = log.details || {};
    if (details.username) return escapeHtml(details.username);
    if (details.newRole) return `${escapeHtml(details.previousRole || '-')} -> ${escapeHtml(details.newRole)}`;
    if (log.entityId) return escapeHtml(String(log.entityId));
    return 'Genel işlem';
}

function renderAuditLogs(logs) {
    const listEl = document.getElementById('auditLogList');
    if (!listEl) return;

    if (!logs || logs.length === 0) {
        listEl.innerHTML = '<div class="admin-empty"><p>Henüz kayıtlı operasyon bulunmuyor.</p></div>';
        return;
    }

    listEl.innerHTML = logs.map((log) => `
        <div class="audit-log-item">
            <div class="audit-log-main">
                <div class="audit-log-title-row">
                    <span class="audit-log-title">${escapeHtml(formatAuditAction(log.action))}</span>
                    <span class="audit-log-actor">${escapeHtml(log.actorUsername || 'sistem')}</span>
                </div>
                <div class="audit-log-meta">
                    <span>${formatAuditMeta(log)}</span>
                    <span>${new Date(log.createdAt).toLocaleString('tr-TR')}</span>
                    ${log.ipAddress ? `<span>${escapeHtml(log.ipAddress)}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

window.loadAuditLogs = async function () {
    const listEl = document.getElementById('auditLogList');
    if (!listEl) return;

    try {
        const response = await fetch('/api/admin/audit-logs?limit=20');
        if (!response.ok) {
            listEl.innerHTML = '<div class="admin-empty"><p>Operasyon kayıtları yüklenemedi.</p></div>';
            return;
        }
        const data = await response.json();
        if (!data.success) {
            listEl.innerHTML = '<div class="admin-empty"><p>Operasyon kayıtları yüklenemedi.</p></div>';
            return;
        }
        renderAuditLogs(data.logs || []);
    } catch (error) {
        console.error('Audit log yükleme hatası:', error);
        listEl.innerHTML = '<div class="admin-empty"><p>Operasyon kayıtları yüklenirken hata oluştu.</p></div>';
    }
};

function renderBackupsList(backups, meta) {
    const listEl = document.getElementById('adminBackupsList');
    if (!listEl) return;

    if (!backups || backups.length === 0) {
        listEl.innerHTML = '<div class="admin-empty"><p>Henüz yedek alınmamış. "Yeni Yedek Al" butonuna tıklayarak ilk yedeğinizi oluşturabilirsiniz.</p></div>';
        return;
    }

    const max = meta?.maxBackups ?? 2;
    const interval = meta?.autoBackupIntervalDays ?? 5;

    listEl.innerHTML = `
        <div class="backup-meta-bar">
            <span>${backups.length} / ${max} yedek</span>
            <span>Otomatik: her ${interval} günde bir</span>
        </div>
        ${backups.map(b => `
            <div class="backup-item">
                <div class="backup-item-main">
                    <div class="backup-item-icon">${b.type === 'auto' ? 'A' : 'M'}</div>
                    <div class="backup-item-info">
                        <span class="backup-item-title">${escapeHtml(b.name)}</span>
                        <span class="backup-item-meta">
                            <span class="backup-type-badge ${b.type}">${b.type === 'auto' ? 'Otomatik' : 'Manuel'}</span>
                            <span>${formatBackupDate(b.created_at)}</span>
                            <span>${formatFileSize(b.size)}</span>
                        </span>
                    </div>
                </div>
                <div class="backup-item-actions">
                    <button class="backup-btn" onclick="downloadBackup('${escapeAttr(b.name)}')" title="Yedeği indir">
                        İndir
                    </button>
                    <button class="backup-btn primary" onclick="restoreBackupConfirm('${escapeAttr(b.name)}')" title="Bu yedekten geri yükle">
                        Geri Yükle
                    </button>
                    <button class="backup-btn danger" onclick="deleteBackupConfirm('${escapeAttr(b.name)}')" title="Yedeği sil">
                        Sil
                    </button>
                </div>
            </div>
        `).join('')}
    `;
}

window.restoreBackupConfirm = async function (name) {
    if (!(await showConfirm({ message: 'Bu yedekten geri yükleme yapılacak. Mevcut veritabanınız otomatik olarak önceden yedeklenir, ancak devam etmek istediğinize emin misiniz?\n\nYedek: ' + name, confirmText: 'Geri Yükle' }))) {
        return;
    }
    try {
        const response = await fetch('/api/admin/backups/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            showSuccessToast('Veritabanı başarıyla geri yüklendi. Sayfa yenileniyor...');
            setTimeout(() => window.location.reload(), 1800);
        } else {
            showError(data.error || 'Geri yükleme başarısız.');
        }
    } catch (error) {
        console.error('Geri yükleme hatası:', error);
        showError('Geri yükleme sırasında hata oluştu.');
    }
};

window.deleteBackupConfirm = async function (name) {
    if (!(await showConfirm({ message: 'Bu yedeği silmek istediğinize emin misiniz? Bu işlem geri alınamaz.\n\nYedek: ' + name, danger: true, confirmText: 'Sil' }))) {
        return;
    }
    try {
        const response = await fetch('/api/admin/backups/' + encodeURIComponent(name), {
            method: 'DELETE'
        });
        const data = await response.json();
        if (response.ok && data.success) {
            showSuccessToast('Yedek silindi.');
            loadBackupsList();
        } else {
            showError(data.error || 'Yedek silinemedi.');
        }
    } catch (error) {
        console.error('Yedek silme hatası:', error);
        showError('Yedek silinirken hata oluştu.');
    }
};

window.downloadBackup = function (name) {
    const url = '/api/admin/backups/' + encodeURIComponent(name) + '/download';
    window.location.href = url;
};

function formatFileSize(bytes) {
    if (bytes == null) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatBackupDate(iso) {
    if (!iso) return '-';
    try {
        const d = new Date(iso);
        return d.toLocaleString('tr-TR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch {
        return iso;
    }
}

function escapeAttr(s) {
    return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

window.loadAdminSummaries = async function() {
    const currentYear = new Date().getFullYear();
    alert('Özet verileri "Geçmiş" sekmesinde görüntülenebilir. Toplam ' + currentYear + ' yılı için özet verileri mevcut.');
};
