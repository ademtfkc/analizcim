const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '../..');

function readPublicFile(file) {
    return fs.readFileSync(path.join(rootDir, 'public', file), 'utf8');
}

function getRuleBody(css, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
    return match ? match[1] : '';
}

describe('UI structure rules', () => {
    test('account actions and theme controls live in settings instead of the top header', () => {
        const html = readPublicFile('index.html');
        const adminStart = html.indexOf('<section class="admin-section');
        const admin = html.slice(adminStart, html.indexOf('</section>', adminStart));

        assert.doesNotMatch(html, /<header class="header">/);
        assert.match(admin, /id="adminAccountTab"/);
        assert.match(admin, /openPasswordModal/);
        assert.match(admin, /id="themePreferenceControl"/);
        assert.match(admin, /data-theme-choice="system"/);
        assert.match(admin, /data-theme-choice="light"/);
        assert.match(admin, /data-theme-choice="dark"/);
        assert.match(admin, /logout\(\)/);
    });

    test('compare and topn year controls do not define gradient backgrounds', () => {
        const css = readPublicFile('styles.css');
        const selectors = ['.compare-controls-main', '.year-select-large', '.topn-filters', '.topn-filters select'];

        for (const selector of selectors) {
            assert.doesNotMatch(getRuleBody(css, selector), /gradient/i, selector);
        }
    });

    test('payable KDV keeps the value red even after numeric coloring', () => {
        const css = readPublicFile('styles.css');

        assert.match(css, /\.dashboard-kdv-item\.net\.payable\s+\.dashboard-kdv-value(?:\.numeric-positive)?[\s\S]*?color:\s*var\(--danger\)\s*!important/);
    });

    test('topn company names expose the full name on hover', () => {
        const js = readPublicFile('app.js');

        assert.match(js, /class="name-cell"\s+title="\$\{safeNameTitle\}"/);
        assert.match(js, /function escapeAttribute/);
    });

    test('dashboard loads the VAT carryover helper before the app bundle', () => {
        const html = readPublicFile('index.html');
        const helperIndex = html.indexOf('<script src="js/vat-ledger.js"></script>');
        const appIndex = html.indexOf('<script src="app.js"></script>');

        assert.ok(helperIndex > -1);
        assert.ok(appIndex > helperIndex);
        assert.match(html, /id="dashKdvNetHint"/);
    });

    test('analysis results clear selected upload files and render explicit VAT status', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');

        assert.match(html, /id="netTaxHint"/);
        assert.match(js, /function renderAnalysisVatSummary/);
        assert.match(js, /resetFileInputs\(\);\s*}\s*$/m);
        assert.match(js, /renderAnalysisVatSummary\(result\)/);
    });

    test('history groups start collapsed and month rows open summary modal', () => {
        const js = readPublicFile('app.js');

        assert.match(js, /history-year-content collapsed/);
        assert.match(js, /year-toggle-icon">▶/);
        assert.match(js, /history-month-summary/);
        assert.match(js, /openHistoryMonthSummary\(/);
        assert.match(js, /En Çok Satış Yapılan Müşteri/);
    });

    test('prediction cards use one fixed grid, no drag-and-drop leftovers', () => {
        const css = readPublicFile('styles.css');
        const js = readPublicFile('app.js');
        const html = readPublicFile('index.html');

        // Sürükleme tamamen kaldırıldı (CEO kararı 2026-08-06)
        assert.doesNotMatch(html, /draggable="true"/);
        assert.doesNotMatch(js, /pred-card-resize-wrapper/);
        assert.doesNotMatch(css, /pred-card-resize-wrapper/);
        ['initPredictionsDragDrop', 'savePredictionOrder', 'restorePredictionOrder',
         'wrapPredictionCardsForResize', 'initPredictionsLayout'].forEach(fn => {
            assert.doesNotMatch(js, new RegExp(fn));
        });

        // Sabit düzen: 2 kolon, grafik/tablo/CFO tam genişlik
        assert.match(css, /\.prediction-section\.cockpit-page \.predictions-layout\s*\{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\) !important/);
        assert.match(css, /data-card-id="chart"\],[\s\S]*?data-card-id="table"\],[\s\S]*?data-card-id="cfo-missing"\]\s*\{[\s\S]*?grid-column: span 2 !important/);

        // Kart sırası HTML'de sabit: önce grafik, sonra tablo
        const chartIndex = html.indexOf('data-card-id="chart"');
        const tableIndex = html.indexOf('data-card-id="table"');
        assert.ok(chartIndex > -1 && tableIndex > chartIndex, 'grafik tablodan önce gelmeli');
    });

    test('prediction page has a metric guide and no marketing overview bubbles', () => {
        const html = readPublicFile('index.html');

        assert.match(html, /id="predictionMetricsGuide"/);
        ['QoQ', 'MoM', 'YoY', 'CMGR', 'CV', 'R²', 'SEE', 'P10', 'P50', 'P90'].forEach(term => {
            assert.match(html, new RegExp(term.replace('²', '\\u00b2')));
        });
        assert.doesNotMatch(html, /Trend, güven ve risk aynı anda okunur/);
        assert.doesNotMatch(html, /Sürüklenebilir kart yapısı ekip çalışma stiline uyum sağlar/);
        assert.doesNotMatch(html, /Öneri ve senaryolar operasyona çevrilebilir çıktılar üretir/);
    });

    test('admin uses compact sidebar workspace and removes command banner', () => {
        const html = readPublicFile('index.html');
        const css = readPublicFile('styles.css');

        assert.match(html, /class="admin-workspace"/);
        assert.match(html, /class="admin-sidebar"/);
        assert.match(html, /class="admin-main"/);
        assert.doesNotMatch(html, /admin-command-bar/);
        assert.match(css, /\.admin-workspace\s*\{/);
        assert.match(css, /\.admin-sidebar\s*\{/);
    });

    test('global top header is removed and nav tabs use sidebar svg labels', () => {
        const html = readPublicFile('index.html');

        assert.doesNotMatch(html, /<header class="header">/);
        assert.doesNotMatch(html, /class="header-meta"/);
        ['#icon-layout-dashboard', '#icon-bar-chart', '#icon-wallet', '#icon-arrows-left-right', '#icon-trending-up', '#icon-trophy', '#icon-clock', '#icon-settings'].forEach(iconRef => {
            assert.match(html, new RegExp(iconRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        });
        ['Dashboard', 'Analiz', 'Gider', 'Karşılaştırma', 'Tahminler', 'En Çok', 'Geçmiş', 'Ayarlar'].forEach(label => {
            assert.match(html, new RegExp(label));
        });
        assert.match(html, /Hesap Değiştir/);
        assert.match(html, /Çıkış Yap/);
    });

    test('sidebar account menu keeps visible labels and history date range exposes explicit field labels', () => {
        const html = readPublicFile('index.html');
        const css = readPublicFile('styles.css');

        assert.match(html, /class="history-date-range"/);
        assert.match(html, /for="historyDateFrom">Başlangıç Tarihi</);
        assert.match(html, /for="historyDateTo">Bitiş Tarihi</);
        assert.doesNotMatch(css, /body\.sidebar-collapsed\s+\.sidebar-account-action\s+span\s*\{\s*display:\s*none/i);
        assert.match(css, /\.sidebar-account-action span\s*\{[\s\S]*?color:\s*inherit/);
    });

    test('desktop sidebar uses a fixed rail that expands into a tokenized overlay panel', () => {
        const css = readPublicFile('styles.css');
        const js = readPublicFile('app.js');

        assert.match(css, /--sidebar-width:\s*240px;\s*\/\* Desktop sidebar panel width \*\//);
        assert.match(css, /--sidebar-rail-width:\s*72px/);
        assert.match(css, /--sidebar-overlay-width:\s*calc\(var\(--sidebar-width\) \+ 156px\)/);
        assert.match(css, /--transition-shell:\s*0\.2s cubic-bezier\(0\.65,\s*0,\s*0\.35,\s*1\)/);
        assert.match(css, /\.sidebar\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?width:\s*var\(--sidebar-rail-width\);[\s\S]*?transition:\s*width var\(--transition-shell\), min-width var\(--transition-shell\), box-shadow var\(--transition-shell\), background var\(--transition-shell\)/);
        assert.match(css, /\.sidebar\.open\s*\{[\s\S]*?width:\s*var\(--sidebar-width\)/);
        assert.match(css, /\.app-shell-toggle\s*\{[\s\S]*?display:\s*none/);
        assert.match(css, /\.sidebar-overlay\.visible\s*\{[\s\S]*?background:\s*var\(--sidebar-overlay-strip-bg\);[\s\S]*?backdrop-filter:\s*blur\(1\.5px\);[\s\S]*?box-shadow:\s*var\(--sidebar-overlay-shadow\)/);
        assert.match(css, /@media \(min-width:\s*1024px\)\s*\{[\s\S]*?\.sidebar:not\(\.open\)\s+\.sidebar-brand-copy[\s\S]*?display:\s*none/);
        assert.match(css, /@media \(max-width:\s*1023px\)\s*\{[\s\S]*?\.app-shell-toggle\s*\{[\s\S]*?top:\s*max\(1rem,\s*calc\(env\(safe-area-inset-top,\s*0px\) \+ 0\.5rem\)\);[\s\S]*?left:\s*max\(1rem,\s*calc\(env\(safe-area-inset-left,\s*0px\) \+ 0\.5rem\)\)/);
        assert.match(css, /@media \(max-width:\s*1023px\)\s*\{[\s\S]*?\.sidebar\s*\{[\s\S]*?transition:\s*transform var\(--transition-shell\), box-shadow var\(--transition-shell\);[\s\S]*?transform:\s*translateX\(-100%\);[\s\S]*?\.sidebar\.open\s*\{[\s\S]*?transform:\s*translateX\(0\)/);
        assert.match(css, /@media \(max-width:\s*1023px\)\s*\{[\s\S]*?\.sidebar-overlay\.visible\s*\{[\s\S]*?background:\s*var\(--overlay-bg\)/);
        assert.match(js, /document\.body\.classList\.toggle\('sidebar-open', isOpen\)/);
        assert.match(js, /sidebarCollapseBtn\?\.addEventListener\('click', window\.toggleSidebar\)/);
    });

    test('login form keeps readable placeholders and resolves system theme preference', () => {
        const html = readPublicFile('login.html');

        assert.match(html, /id="username"[\s\S]*placeholder="ornek\.kullanici"/);
        assert.match(html, /id="password"[\s\S]*placeholder="••••••••"/);
        assert.match(html, /function resolveEffectiveTheme\(themePreference\)/);
        assert.match(html, /document\.documentElement\.setAttribute\('data-theme-preference', normalized\)/);
        assert.match(html, /if \(\(localStorage\.getItem\('theme'\) \|\| 'system'\) === 'system'\)/);
    });

    test('theme cleanup bridges legacy aliases to token variables and removes blue admin rings', () => {
        const css = readPublicFile('styles.css');
        const login = readPublicFile('login.html');

        assert.match(css, /--bg-primary:\s*var\(--background,\s*#ffffff\)/);
        assert.match(css, /--positive:\s*#16a34a/);
        assert.match(css, /--success:\s*var\(--positive\)/);
        assert.match(css, /--tooltip-bg:\s*color-mix\(in srgb,\s*var\(--popover\)/);
        assert.match(css, /:focus-visible\s*\{[\s\S]*?outline:\s*2px solid var\(--ring,\s*var\(--accent-primary\)\)/);
        assert.match(css, /--ring-soft:\s*color-mix\(in srgb,\s*var\(--ring\)\s*18%,\s*transparent\)/);
        assert.match(css, /Theme Token Cleanup Final/);
        assert.match(css, /\.admin-tab\.active,\s*[\s\S]*?\.theme-choice-btn\.active\s*\{[\s\S]*?border-color:\s*var\(--ring-strong\)\s*!important/);
        assert.match(css, /\.modal-content \.form-input:focus[\s\S]*?box-shadow:\s*0 0 0 2px var\(--ring-soft\)\s*!important/);
        assert.match(login, /\.form-input:focus\s*\{[\s\S]*?border-color:\s*var\(--ring\)/);
        assert.match(login, /\.theme-toggle-login:hover\s*\{[\s\S]*?border-color:\s*var\(--ring\)/);
    });

    test('favicon is explicitly linked for both app and login screens', () => {
        const indexHtml = readPublicFile('index.html');
        const loginHtml = readPublicFile('login.html');
        const faviconSvg = readPublicFile('favicon.svg');

        assert.match(indexHtml, /rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"/);
        assert.match(loginHtml, /rel="icon" href="\/favicon\.svg" type="image\/svg\+xml"/);
        assert.match(faviconSvg, /<svg/);
    });

    test('sidebar tab switch uses a safe mobile-only close helper and admin polling is view scoped', () => {
        const js = readPublicFile('app.js');

        assert.match(js, /function closeMobileSidebar\(\)\s*\{[\s\S]*?sidebar\?\.classList\.contains\('open'\)[\s\S]*?matchMedia\('\(max-width: 1023px\)'\)\.matches[\s\S]*?setSidebarOpen\(false\)/);
        assert.match(js, /window\.closeMobileSidebar = closeMobileSidebar/);
        assert.match(js, /function isPendingUsersViewActive\(\)\s*\{[\s\S]*?currentTab === 'admin'[\s\S]*?dataset\.adminTab === 'users'/);
        assert.match(js, /syncPendingUsersPolling\(\{ forceLoad: targetTab === 'users' \}\)/);
        assert.match(js, /if \(typeof window\.loadPendingUsers === 'function' && isPendingUsersViewActive\(\)\) window\.loadPendingUsers\(\)/);
        assert.doesNotMatch(js, /fetch\('\/api\/admin\/pending-users'\)\.then/);
    });

    test('stylesheet contains no gradient effects anywhere', () => {
        const css = readPublicFile('styles.css');

        assert.doesNotMatch(css, /gradient/i);
    });

    test('business statistics subtabs keep readable text contrast', () => {
        const css = readPublicFile('styles.css');

        assert.match(css, /\.bstat-subtab\s*\{[\s\S]*?color:\s*var\(--text-primary\)/);
        assert.match(css, /\.bstat-subtab\.active\s*\{[\s\S]*?background:\s*var\(--bg-secondary\)/);
    });

    test('analysis upload exposes guidance and selected file summaries', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        assert.match(html, /class="upload-guidance"/);
        assert.match(html, /id="salesFileSummary"/);
        assert.match(html, /id="purchaseFileSummary"/);
        assert.match(html, /YYYY_AA_tip\.xlsx/);
        assert.match(js, /function updateSelectedFileSummary/);
        assert.match(js, /resetSelectedFileSummaries/);
        assert.match(css, /\.upload-guidance\s*\{/);
        assert.match(css, /\.selected-file-summary\s*\{/);
    });

    test('expenses screen exposes period context and combined total without backend changes', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        assert.match(html, /id="expensesPeriodSummary"/);
        assert.match(html, /id="expensePeriodFixedTotal"/);
        assert.match(html, /id="expensePeriodVariableTotal"/);
        assert.match(html, /id="expensePeriodCombinedTotal"/);
        assert.match(js, /function updateExpensePeriodSummary/);
        assert.match(js, /updateExpensePeriodSummary\(year, month, fixedTotal, variableTotal\)/);
        assert.match(css, /\.expenses-period-summary\s*\{/);
    });

    test('customers module exposes sidebar entry, workspace, dashboard widgets and handlers', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        assert.match(html, /id="tabCustomers"/);
        assert.match(html, /id="customersSection"/);
        assert.match(html, /id="customerForm"/);
        assert.match(html, /id="dashboardCustomersSection"/);
        assert.match(html, /id="dashTotalCustomers"/);
        assert.match(html, /id="dashboardRecentCustomersList"/);
        assert.match(html, /id="dashboardTopCustomer"/);
        assert.match(js, /function loadCustomers\(/);
        assert.match(js, /function saveCustomer\(/);
        assert.match(js, /function deleteCustomer\(/);
        assert.match(js, /function loadCustomerDashboardSummary\(/);
        assert.match(js, /switchTab\('customers'\)/);
        assert.match(css, /\.customers-section\s*\{/);
        assert.match(css, /\.customers-grid\s*\{/);
        assert.match(css, /\.customer-form-grid\s*\{/);
        assert.match(css, /\.dashboard-customers-section\s*\{/);
    });

    test('business parties expose supplier tab, analytics detail view and dashboard widgets', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        assert.match(html, /id="tabSuppliers"/);
        assert.match(html, /id="suppliersSection"/);
        assert.match(html, /id="partyDetailSection"/);
        assert.match(html, /id="partyMonthlyChart"/);
        assert.match(html, /id="partyTrendChart"/);
        assert.match(html, /id="dashTotalSuppliers"/);
        assert.match(html, /id="dashboardTopCustomersList"/);
        assert.match(html, /id="dashboardTopSuppliersList"/);
        assert.match(html, /id="dashboardRecentPartiesList"/);
        assert.match(js, /function loadBusinessParties\(/);
        assert.match(js, /function openBusinessPartyDetail\(/);
        assert.match(js, /function renderPartyDetailCharts\(/);
        assert.match(js, /function loadBusinessPartyDashboardSummary\(/);
        assert.match(js, /switchTab\('suppliers'\)/);
        assert.match(css, /\.party-detail-section\s*\{/);
        assert.match(css, /\.business-party-table\s*\{/);
        assert.match(css, /\.party-dashboard-grid\s*\{/);
    });

    test('business party rows collapse into labeled cards on mobile without horizontal scroll', () => {
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        // Render adds per-cell labels so mobile cards can show "etiket: değer"
        assert.match(js, /data-label="İşlem Hacmi"/);
        assert.match(js, /data-label="Fatura Toplamı"/);
        assert.match(js, /class="bp-cell-name"/);

        // Mobile media query turns rows into cards and drops the min-width scroll
        assert.match(css, /@media \(max-width: 768px\)[\s\S]*\.business-party-table thead\s*\{\s*display: none;/);
        assert.match(css, /\.business-party-table td\[data-label\]::before\s*\{\s*content: attr\(data-label\)/);
    });

    test('dashboard uses the cockpit layout: 4 KPI tiles, hero stage and a decision rail', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        // İki şeritli iskelet: ana kolon + sağ karar paneli
        assert.match(html, /class="dashboard-section dashboard-cockpit cockpit-page"/);
        assert.match(html, /class="cockpit-main"/);
        assert.match(html, /id="dashboardRail"/);

        // 4 ana KPI kutusu mikro grafik + yıllık değişim rozeti taşır
        ['dashSalesSpark', 'dashPurchaseSpark', 'dashNetProfitSpark', 'dashVatSpark'].forEach(id => {
            assert.match(html, new RegExp('id="' + id + '"'));
        });
        ['dashSalesDelta', 'dashPurchaseDelta', 'dashNetProfitDelta'].forEach(id => {
            assert.match(html, new RegExp('id="' + id + '"'));
        });

        // Ana 4 kutu dışında kalan sayılar ikincil şeritte korunur (veri kaybı yok)
        ['dashTotalProfit', 'dashTotalAnalyses', 'dashTotalExpenses', 'dashTotalCustomers', 'dashTotalSuppliers'].forEach(id => {
            assert.match(html, new RegExp('id="' + id + '"'));
        });

        // Ana sahne: net kâr özeti grafiğin yanında
        assert.match(html, /id="dashHeroValue"/);
        assert.match(html, /id="dashHeroMargin"/);
        assert.match(html, /id="salesTrendChart"/);

        // "Şimdi ne yapmalıyım" paneli veriden üretilir ve satır içi onclick kullanmaz
        assert.match(html, /id="dashboardRailActionList"/);
        assert.match(js, /function renderRailActions\(/);
        assert.match(js, /data-rail-tab=/);
        assert.doesNotMatch(js, /rail-action-cta"\s*onclick/);

        // Widget sıralaması iki şeridi de tanır (şerit başı [data-widget-anchor] ile işaretli)
        assert.match(html, /data-widget-anchor/);
        assert.match(js, /\[data-widget-anchor\]/);

        // Tema token'ları: kokpit bloğunda sabit renk yok
        const cockpitBlock = css.slice(css.indexOf('.cockpit-page {'));
        assert.ok(cockpitBlock.length > 0);
        assert.doesNotMatch(cockpitBlock, /#[0-9a-fA-F]{3,8}\b/);
        assert.match(cockpitBlock, /\.cockpit-page \.cockpit-body\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\) var\(--cockpit-rail-width\)/);
    });

    test('confirm modal traps focus and keeps Escape from reaching global shortcuts', () => {
        const js = readPublicFile('app.js');

        // Odak tuzağı: Tab modal içinde döner
        assert.match(js, /CONFIRM_FOCUSABLE_SELECTOR/);
        assert.match(js, /if \(event\.key !== 'Tab'\) return;/);
        assert.match(js, /event\.preventDefault\(\);\s*\n\s*last\.focus\(\);/);
        assert.match(js, /event\.preventDefault\(\);\s*\n\s*first\.focus\(\);/);

        // Escape yalnızca bu modalı kapatır (capture aşaması + stopPropagation)
        assert.match(js, /document\.addEventListener\('keydown', onKey, true\)/);
        assert.match(js, /document\.removeEventListener\('keydown', onKey, true\)/);
        assert.match(js, /event\.stopPropagation\(\);\s*\n\s*cleanup\(false\);/);
    });

    test('custom range drives both the profit/loss rows and every period heading', () => {
        const js = readPublicFile('app.js');

        // Başlıklar tek bir dönem etiketinden beslenir
        assert.match(js, /let _dashboardPeriodLabel = '';/);
        assert.match(js, /_dashboardPeriodLabel = isRangeMode/);
        assert.match(js, /const yearDisplay = _dashboardPeriodLabel \|\| yearStr \|\| 'Tüm Yıllar';/);
        assert.match(js, /function renderProfitLoss\(data, periodLabel\)/);
        assert.match(js, /yearDisplay\.textContent = periodLabel \|\|/);

        // Kâr/Zarar tablosu aralığa göre süzülür ve toplamlar yeniden hesaplanır
        assert.match(js, /async function loadProfitLoss\(year, periodLabel, range\)/);
        assert.match(js, /if \(y === startYear && m\.month < startMonth\) continue;/);
        assert.match(js, /if \(y === endYear && m\.month > endMonth\) continue;/);
    });

    test('dashboard profit uses the VAT-excluded base so the hero number matches the P&L table', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');

        // Saf hesap fonksiyonları ayrı modülde ve app.js'ten ÖNCE yüklenir (birim testi için)
        const metricsIndex = html.indexOf('<script src="js/dashboard-metrics.js"></script>');
        const appIndex = html.indexOf('<script src="app.js"></script>');
        assert.ok(metricsIndex > -1);
        assert.ok(appIndex > metricsIndex);
        assert.match(js, /\} = window\.DashboardMetrics;/);

        // Tek kaynak: panel aylık verisi de Kâr/Zarar tablosuyla aynı KDV hariç tabanı kullanır
        assert.ok((js.match(/computeVatExclusiveGrossProfit\(/g) || []).length >= 3);

        // Regresyon kilidi: ham (KDV dahil) satış - alış farkı doğrudan gross_profit'e yazılmaz
        assert.doesNotMatch(js, /gross_profit:\s*\(sales\[i\]\s*\|\|\s*0\)\s*-\s*\(purchases\[i\]\s*\|\|\s*0\)/);

        // Boş panel gerçekten tetiklenebilmeli (API sıfır dolu summary döndürüyor)
        assert.match(js, /monthly\.length === 0 && !hasMeaningfulSummary\(summary\)/);
    });

    test('cockpit colors follow the data instead of hardcoded tones', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');

        // "En zayıf ay" her zaman kırmızı olmamalı; sınıf veriye göre atanır
        assert.doesNotMatch(html, /id="dashHeroWorst"[^>]*class="[^"]*negative/);
        assert.match(js, /heroWorst\.classList\.toggle\('negative',[^\n]*margin < 0\)/);
        assert.match(js, /heroBest\.classList\.toggle\('negative',[^\n]*margin < 0\)/);

        // Net kâr mikro grafiği zararda yeşil kalmamalı
        assert.match(js, /renderSparkline\('dashNetProfitSpark',[^\n]*view\.netProfit < 0 \? 'negative' : 'positive'\)/);

        // Yıllık değişim mantığı ayrı modülde birim testleriyle korunur
        const metrics = fs.readFileSync(path.join(rootDir, 'public', 'js', 'dashboard-metrics.js'), 'utf8');
        assert.match(metrics, /if \(sharedMonths === 0 \|\| previousSum === 0\) return null;/);
    });

    test('year comparison page uses the cockpit two-lane layout with a data-driven rail', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        // İki şerit + karar paneli
        assert.match(html, /class="compare-section cockpit-page"/);
        assert.match(html, /id="compareCockpitBody"/);
        assert.match(html, /id="compareRail"/);
        assert.match(html, /id="compareRailActionList"/);
        assert.match(html, /id="compareRailFacts"/);
        assert.match(html, /id="compareRailMonths"/);
        assert.match(html, /id="compareHeadMeta"/);

        // Panel veriden üretilir, satır içi onclick yok
        assert.match(js, /function renderCompareRail\(a, b, growth\)/);
        assert.match(js, /renderCompareRail\(a, b, growth\);/);
        assert.doesNotMatch(js, /rail-action-title"[^\n]*onclick/);

        // Maliyet artışı kırmızı olmalı (ters yön bayrağı)
        assert.match(js, /const isGood = inverse \? !isUp : isUp;/);
        assert.match(js, /growth\.purchase, b\.purchase - a\.purchase, true\);/);

        // Yüzde puan ayrı birim, yuvarlanan sıfır "-0,0" görünmez
        assert.match(js, /function pointText\(/);
        assert.match(js, /Math\.abs\(n\) < 0\.05 \? 0 : n/);

        // Ortak kokpit stilleri sayfa bağımsız
        assert.match(css, /\.cockpit-page \.rail-fact\s*\{/);
        assert.match(css, /\.compare-section\.cockpit-page \.compare-delta-grid\s*\{/);
    });

    test('expenses page uses the cockpit layout and saves without losing data', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        assert.match(html, /class="expenses-section cockpit-page"/);
        assert.match(html, /id="expensesRail"/);
        assert.match(html, /id="expensesRailActionList"/);
        assert.match(html, /id="expensesRailFacts"/);
        assert.match(html, /id="expensesRailTop"/);
        assert.match(js, /function renderExpensesRail\(view\)/);
        assert.match(css, /\.expenses-section\.cockpit-page \.expenses-summary-cards\s*\{/);

        // Kayıt hatası sessizce yutulmamalı (giderler veritabanına gitmiyordu)
        assert.match(js, /Giderler kaydedilemedi/);
        assert.doesNotMatch(js, /body: JSON\.stringify\(\{\s*\n\s*year,\s*\n[\s\S]{0,200}?\}\)\s*\n\s*\}\);\s*\n\s*\} catch \(_\) \{ \}/);

        // Her tuş vuruşunda istek atılmamalı; kayıtlar sıraya girmeli
        assert.match(js, /function scheduleExpensesSave\(section\)/);
        assert.match(js, /clearTimeout\(_expenseSaveTimer\)/);
        assert.match(js, /_expenseSaveChain = _expenseSaveChain/);
    });

    test('cari pages use the cockpit layout with a data-driven rail', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        assert.match(html, /class="customers-section cockpit-page" id="customersSection"/);
        assert.match(html, /class="customers-section cockpit-page" id="suppliersSection"/);
        assert.match(html, /class="party-detail-section cockpit-page"/);

        ['customersRail', 'customersRailActionList', 'customersRailFacts', 'customersRailTop',
         'suppliersRail', 'suppliersRailActionList', 'suppliersRailFacts', 'suppliersRailTop',
         'customersHeadMeta', 'suppliersHeadMeta'].forEach(id => {
            assert.match(html, new RegExp('id="' + id + '"'));
        });

        assert.match(js, /function renderBusinessPartyRail\(type, parties\)/);
        assert.match(js, /renderBusinessPartyRail\(type, data\.parties \|\| \[\]\);/);
        assert.match(css, /\.party-detail-section\.cockpit-page \.party-metrics-grid\s*\{/);

        // Mobil kart görünümü korunmalı (isim hücresi mono dizgiye kaçmasın)
        assert.match(css, /\.customers-section\.cockpit-page \.business-party-table td\.bp-cell-name\s*\{[\s\S]*?font-family: inherit/);
    });

    test('predictions page keeps its decision cards inside the cockpit shell', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        assert.match(html, /class="prediction-section cockpit-page"/);
        assert.match(html, /id="predictionsRail"/);
        assert.match(html, /id="predictionsRailActionList"/);
        assert.match(html, /id="predictionsRailFacts"/);
        assert.match(html, /id="predictionsHeadMeta"/);

        // Yönetici özetinin sayısal yanı panele taşındı; ID'ler korunmalı
        ['execTotalExpectation', 'execGrowth', 'execRisk', 'execConfidence', 'execDataQuality',
         'ceoOutlook', 'refreshPredictionsBtn'].forEach(id => {
            assert.match(html, new RegExp('id="' + id + '"'));
        });

        // 9 karar kartı korunur (sıra artık sabit, sürükleme yok)
        assert.ok((html.match(/data-card-id="/g) || []).length >= 9);
        assert.match(js, /function renderPredictionsRail\(view\)/);
        assert.match(css, /\.prediction-section\.cockpit-page \.predictions-layout\s*\{/);
    });

    test('every cockpit page shares one control size system', () => {
        const css = readPublicFile('styles.css');
        const html = readPublicFile('index.html');

        // Tek ölçü kaynağı
        assert.match(css, /\.cockpit-page\s*\{[\s\S]*?--control-height: 38px/);
        assert.match(css, /\.cockpit-page \.dashboard-action-btn,[\s\S]*?height: var\(--control-height\)/);

        // Ayarlar ve En Çok da aynı sisteme dahil
        assert.match(html, /class="admin-section cockpit-page"/);
        assert.match(html, /class="topn-section cockpit-page"/);

        // KPI hairline'ı eski `gap: 1rem !important` kuralına yenilmemeli
        assert.match(css, /\.dashboard-cockpit \.dashboard-stats\s*\{[\s\S]*?gap: 1px !important/);

        // Kenar çubuğunda bulanıklık yok (CEO kararı 2026-08-06)
        assert.match(css, /\.sidebar-overlay,\s*\n\.sidebar-overlay\.visible\s*\{[\s\S]*?backdrop-filter: none !important/);

        // Dokunmatik cihazda 44px hedef korunmalı: kokpit ölçüsü (38px) bunu ezmemeli
        assert.match(css, /@media \(hover: none\) and \(pointer: coarse\)[\s\S]*?\.cockpit-page \.dashboard-action-btn,[\s\S]*?min-height: 44px/);
    });

    test('top-N page is named "En Çok" and filters by year and month', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const storage = fs.readFileSync(path.join(rootDir, 'src', 'storage.js'), 'utf8');
        const server = fs.readFileSync(path.join(rootDir, 'src', 'server.js'), 'utf8');

        assert.match(html, /<h2>En Çok<\/h2>/);
        assert.doesNotMatch(html, /En Çok Satılan Firmalar ve Ürünler/);
        assert.match(html, /id="topnMonth"/);
        assert.match(js, /if \(month && month !== 'all'\) customersQs\.append\('month', month\)/);
        assert.match(js, /if \(month && month !== 'all'\) productsQs\.append\('month', month\)/);

        // Backend: ay parametresi hem ana döngüde hem yıl bazlı döngüde uygulanır
        assert.match(server, /storage\.getTopCustomers\(userId, year, type, limit, month\)/);
        assert.match(server, /storage\.getTopProducts\(userId, year, type, limit, month\)/);
        assert.ok((storage.match(/Number\(rowMonth\) !== Number\(month\)/g) || []).length >= 2);
        assert.ok((storage.match(/Number\(rowMonthInYear\) !== Number\(month\)/g) || []).length >= 2);
    });

    test('cari screens label invoice totals honestly (no fake balance)', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');

        // "Bakiye" yanıltıcıydı: sistemde tahsilat/ödeme kaydı yok, rakam fatura toplamı
        assert.match(html, /<th>Fatura Toplamı<\/th>/);
        assert.match(html, /Net Fatura Tutarı/);
        assert.match(js, /data-label="Fatura Toplamı"/);
        assert.doesNotMatch(js, /caride açık bakiye var/);
        assert.doesNotMatch(js, /Tahsilat takibi gereken kayıtlar olabilir/);
        assert.match(js, /kesilen faturaların toplamıdır/);

        // Renk sinyali kaldırıldı: bu tutar müşteride hep artı, tedarikçide hep eksi
        // çıkıyor; sabit yeşil/kırmızı veriye göre değişmeyen yanlış bir sinyaldi.
        assert.doesNotMatch(js, /data-label="Fatura Toplamı"><strong class="\$\{customerBalanceClass/);
    });

    test('destructive actions use the themed confirm modal instead of native confirm()', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        // Reusable Promise-based helper + themed modal skeleton exist
        assert.match(js, /function showConfirm\(/);
        assert.match(html, /id="confirmModal"/);
        assert.match(html, /id="confirmModalMessage"/);
        assert.match(html, /id="confirmModalConfirm"/);
        assert.match(html, /id="confirmModalCancel"/);

        // Every gated action awaits the helper (17 call sites)
        assert.ok((js.match(/await showConfirm\(/g) || []).length >= 17);

        // Regression lock: no bare `if (!confirm(` gates remain (native confirm banned except helper fallback)
        assert.doesNotMatch(js, /if\s*\(!confirm\(/);

        // Danger variant + multiline message support are tokenized, not hardcoded
        assert.match(css, /\.btn-danger\s*\{[\s\S]*background: var\(--danger\)/);
        assert.match(css, /\.confirm-modal-message\s*\{[\s\S]*white-space: pre-line/);
    });

    test('admin users expose status badges and pending empty state', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        assert.match(html, /id="pendingUsersEmpty"/);
        assert.match(js, /function getUserStatusBadge/);
        assert.match(js, /pendingUsersEmpty/);
        assert.match(js, /admin-status-badge/);
        assert.match(css, /\.admin-status-badge\s*\{/);
        assert.match(css, /\.pending-users-empty\s*\{/);
    });

    test('system tab exposes recent audit operations list', () => {
        const html = readPublicFile('index.html');
        const js = readPublicFile('app.js');
        const css = readPublicFile('styles.css');

        assert.match(html, /id="auditLogList"/);
        assert.match(html, /Son Operasyonlar/);
        assert.match(js, /window\.loadAuditLogs\s*=\s*async function/);
        assert.match(js, /function renderAuditLogs/);
        assert.match(css, /\.audit-log-list\s*\{/);
        assert.match(css, /\.audit-log-item\s*\{/);
    });
});
