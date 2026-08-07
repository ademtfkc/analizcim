const { describe, test, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

// Kendi izole veritabanı: `src/storage` require anında `src/database`'i açar.
process.env.NODE_ENV = 'test';
const testDbPath = path.join(os.tmpdir(), `analizcim-party-trend-${process.pid}.db`);
process.env.TEST_DATABASE_PATH = testDbPath;

const storage = require('../../src/storage');
const db = require('../../src/database');

// Bu dosyadaki testler saf takvim matematiği ölçer, veritabanına dokunmaz. Ama `src/storage`
// require anında `src/database`'i açıyor ve şema + migration zincirini ASENKRON başlatıyor.
// Testler o zincirden önce bittiği için:
//   - bağlantıyı erken kapatmak "SQLITE_MISUSE: Database handle is closed" üretiyordu,
//   - hiç kapatmamak açık handle bırakıp `--test-force-exit`siz koşuyu sonsuza kilitliyordu.
// Bu yüzden önce zincirin bitmesi beklenir (tüm migration dosyaları kayda geçene kadar),
// sonra bağlantı kapatılıp geçici dosya silinir.
const migrationCount = fs
    .readdirSync(path.join(__dirname, '../../scripts/migrations'))
    .filter((file) => file.endsWith('.js')).length;

function waitForDatabaseReady(timeoutMs = 15000) {
    const started = Date.now();
    return new Promise((resolve, reject) => {
        const tick = () => {
            db.get('SELECT COUNT(*) AS n FROM migrations', [], (err, row) => {
                if (!err && row && row.n >= migrationCount) {
                    resolve();
                    return;
                }
                if (Date.now() - started > timeoutMs) {
                    reject(new Error('Veritabanı hazırlık zinciri zaman aşımına uğradı'));
                    return;
                }
                setTimeout(tick, 25);
            });
        };
        tick();
    });
}

after(async () => {
    await waitForDatabaseReady();
    await new Promise((resolve) => db.close(() => resolve()));
    for (const candidate of [testDbPath, `${testDbPath}-journal`, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
        try { fs.unlinkSync(candidate); } catch (_) { /* zaten yok */ }
    }
});

const ay = (month, amount) => ({ month, amount });

describe('buildLastTwelveMonthsTrend (cari detay "Son 12 Ay")', () => {
    test('boş ayları 0 ile doldurur ve tam 12 takvim ayı döndürür', () => {
        // Arada 10 aylık boşluk var: eski `slice(-12)` davranışı 14 takvim ayına yayılırdı.
        const trend = storage.buildLastTwelveMonthsTrend([
            ay('2025-01', 1000),
            ay('2025-02', 2000),
            ay('2026-04', 3000),
            ay('2026-05', 4000),
            ay('2026-06', 5000)
        ]);

        assert.equal(trend.length, 12);
        assert.equal(trend[0].month, '2025-07');
        assert.equal(trend[11].month, '2026-06');
        // 2025-01 ve 2025-02 pencerenin dışında kaldı
        assert.ok(!trend.some((row) => row.month === '2025-01'));
        assert.equal(trend.find((row) => row.month === '2026-04').amount, 3000);
        assert.equal(trend.find((row) => row.month === '2025-12').amount, 0);
    });

    test('yıl sınırını doğru geçer', () => {
        const trend = storage.buildLastTwelveMonthsTrend([ay('2026-02', 500)]);

        assert.equal(trend.length, 12);
        assert.equal(trend[0].month, '2025-03');
        assert.equal(trend[11].month, '2026-02');
        assert.equal(trend[11].amount, 500);
        assert.equal(trend[0].amount, 0);
    });

    test('tarihsiz satırlar takvim penceresine girmez', () => {
        const trend = storage.buildLastTwelveMonthsTrend([
            ay('Tarihsiz', 900),
            ay('2026-06', 100)
        ]);

        assert.equal(trend.length, 12);
        assert.ok(trend.every((row) => /^\d{4}-\d{2}$/.test(row.month)));
        assert.equal(trend[11].month, '2026-06');
    });

    test('hiç tarihli ay yoksa boş dizi döner', () => {
        assert.deepEqual(storage.buildLastTwelveMonthsTrend([ay('Tarihsiz', 900)]), []);
        assert.deepEqual(storage.buildLastTwelveMonthsTrend([]), []);
    });
});
