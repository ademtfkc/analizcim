# 🧠 PROJE DURUMU — Ekibin Ortak Hafızası

> Bu dosya projenin beynidir. **Bu dosya varken kod baştan aşağı taranmaz.**
> Oturum başında İLK İŞ bu dosyayı oku; sadece o görevde değişecek dosyaları aç.

---

## 0. KULLANIM KURALLARI (BU BÖLÜM ASLA SİLİNMEZ — herkes uyar)

1. **Oturum başında İLK İŞ bu dosyayı oku.** Projeyi baştan tarama; "Proje Haritası"
   bölümü neyin nerede olduğunu söyler. Sadece o görevde değişecek dosyaları aç.
2. **Her işlemden sonra bu dosyayı güncelle:** hem ilgili bölümü, hem de en alttaki
   **İşlem Günlüğü**'ne tek satır ekle (Tarih | Ajan | Ne yapıldı | Hangi dosyalar).
3. **Neyi nereye kaydettiysen buraya yaz.** Yeni dosya/klasör açtıysan Proje
   Haritası'na ekle; API yazdıysan API bölümüne, tablo kurduysan Veri bölümüne işle.
4. **Dosya ile kod çelişirse koda güven**, bu dosyayı düzelt ve günlüğe not düş.
5. **Her ajan devrinde** devralan uzman önce bu dosyayı okur — kimse bağlamsız çalışmaz.
6. Dosya çok uzarsa: 30 günden eski günlük satırlarını en alttaki **Arşiv**'e taşı.
7. Sırların **değerleri buraya ASLA yazılmaz** — sadece adları ve nerede tanımlı oldukları.
8. Onay kapıları (tasarım seçimi, veri silme, canlıya alma, ücretli servis) CEO
   onayı olmadan geçilmez; bekleyenler "Bekleyen Onaylar" bölümüne yazılır.

---

## 1. Proje Kimliği
- **Proje adı:** Analizcim
- **Tek cümlelik hedef:** Küçük işletme/muhasebe kullanıcısının Excel satış-alış verisini
  anlaşılır bir karar destek paneline (dashboard + tahmin + cari analizi) çeviren lokal uygulama.
- **Hedef kitle:** Küçük işletme sahibi, muhasebe/finans kullanıcısı, admin.
- **Durum:** 🔨 Geliştirme / bakım (çalışan uygulama; güvenlik + finansal + doküman + Tier 3 + **Kokpit tasarım turu (6 sayfa)** tamam, CI yeşil)
- **Canlı adres:** Yok (lokal çalışır, finansal veri kullanıcının makinesinde kalır)
- **Sürüm kontrolü:** git (main) + **private GitHub deposu**: https://github.com/ademtfkc/analizcim (`.env`/`data/` git'e girmez)
- **İlgili dokümanlar:** README.md · docs/api.md · docs/openapi.json · CLAUDE.md

## 2. Teknoloji ve Komutlar
- **Stack:** Node.js + Express 4 (backend) · SQLite (sqlite3) · express-session · multer (Excel yükleme)
  · xlsx (Excel ayrıştırma) · pino (loglama) · bcrypt (şifre) · arima (tahmin) · vanilla JS + Chart.js (frontend, build adımı yok)
- **Çalıştırma:** `npm start` (→ `node src/server.js`), varsayılan `PORT=3000`
- **Test:** `npm test` · `npm run test:unit` · `npm run test:integration` · `npm run test:smoke`
- **Lint:** `npm run lint` (`eslint src tests`)
- **Toplu doğrulama:** `npm run verify` (lint+unit+integration+smoke) · `npm run verify:fast` (lint+unit+smoke)
- **Ortam değişkenleri:** `.env` içinde tanımlı (adları, değerleri DEĞİL): `SESSION_SECRET`,
  bootstrap admin (`BOOTSTRAP_ADMIN_USERNAME`/`PASSWORD`), `NODE_ENV`, `HOST`, `PORT`, `TEST_DATABASE_PATH`.
  Şablon: `.env.example`.

## 3. Proje Haritası 🗺️

### Klasör yapısı
| Klasör | Ne var içinde |
|---|---|
| `src/` | Sunucu tarafı tüm mantık (backend) |
| `src/routes/` | API rota modülleri (auth, history, backups, customers, expenses, business-parties, preferences) |
| `src/middleware/` | `auth.js` (yetki koruması) + `rate-limiters.js` (hız sınırı) |
| `public/` | Frontend: `index.html`, `login.html`, `app.js`, `styles.css`, `favicon.svg` |
| `public/js/` | Küçük ön yüz modülleri (api, history, notifications, vat-ledger, **dashboard-metrics**) |
| `public/vendor/` | Dış kütüphane (chart.umd.min.js) |
| `scripts/` | Migration çalıştırıcı + tek seferlik betikler |
| `scripts/migrations/` | Sıralı veritabanı şema değişiklikleri (001…010) |
| `tests/` | `unit/`, `integration/`, `helpers/`, smoke testi |
| `data/` | Yerel SQLite veritabanı + yedekler (git'e girmez) |
| `docs/` | api.md, openapi.json, screenshots/, superpowers/ |

### Önemli dosyalar
| Dosya | Ne yapar | Satır (kaba) |
|---|---|---|
| `src/server.js` | Express sunucusu, oturum, statik servis, upload, ana rotalar | ~2160 |
| `src/storage.js` | Veri erişim katmanı (SQLite sorguları) | ~2710 |
| `src/predictor.js` | Tahmin motoru: Linear, Exp. Smoothing, Holt-Winters, native ARIMA | ~1560 |
| `src/analyzer.js` | Excel ayrıştırma, satış/alış/KDV/kâr hesabı, cari eşleme | ~1280 |
| `src/validators.js` | Girdi doğrulama (+ `repairUploadFilename` Türkçe dosya adı onarımı) | ~425 |
| `src/compare-metrics.js` | Yıl karşılaştırmasının "ortak ay" kıyası — SAF fonksiyon, DB gerektirmez | ~80 |
| `src/database.js` | DB bağlantısı ve şema | ~310 |
| `src/backup-manager.js` / `src/archive-manager.js` | Yedekleme / arşiv (soft-delete) | ~290 / ~270 |
| `public/app.js` | TÜM ön yüz mantığı tek dosyada (`showConfirm` onay modalı dahil) | ~8970 |
| `public/styles.css` | TÜM stiller tek dosyada (kokpit ölçü sistemi + mobil kart + `.btn-danger` dahil) | ~17640 |
| `public/index.html` | Ana uygulama iskeleti (`#confirmModal` iskeleti dahil) | ~2540 |

## 4. Veri Yapısı Özeti 🗄️
_(Migration dosyalarından çıkarıldı — kod ile çelişirse koda güvenilir.)_
| Tablo | Ne tutar | Not |
|---|---|---|
| `users` | Kullanıcılar + `status` (onay durumu) | bcrypt şifre |
| `analyses` | Yüklenen analizler; `user_id`, `deleted_at` (soft-delete), `outliers_json` | Kullanıcıya bağlı |
| `summaries` | Analiz özetleri | |
| `customers` | Manuel + otomatik müşteriler | Faz 1 / 1.5 |
| `suppliers` + `party_transactions` | Tedarikçiler ve normalize cari hareketleri | Faz 1.5 |
| `user_preferences` | Kullanıcı tercihleri (tema vb.) | anahtar-değer |
| `audit_logs` | Denetim kayıtları | |
| _(kaldırılan)_ | `predictions` (003), `expenses` tablosu (004) migrasyonla kaldırılmış | |

## 5. API Uçları 🔌
_(Modüller `src/routes/` altında; detay denetim sonrası doldurulacak.)_
| Uç grubu | Ne yapar | Yetki |
|---|---|---|
| `routes/auth.js` | Giriş / çıkış / oturum | Public giriş, gerisi korumalı |
| `routes/history.js` | Analiz geçmişi listeleme/silme/geri-yükleme | Kullanıcı |
| `routes/customers.js` · `business-parties.js` | Müşteri/tedarikçi CRUD + cari analiz | Kullanıcı |
| `routes/expenses.js` | Gider işlemleri | Kullanıcı |
| `routes/backups.js` | Yedek al/geri yükle | Admin |
| `routes/preferences.js` | Tercih kaydet/oku | Kullanıcı |
| `GET /api/admin/db-size` (`src/server.js`) | Veritabanı dosyasının boyutunu bayt olarak döner (Ayarlar'daki kutuyu doldurur). Dosya yolu yanıta YAZILMAZ | Admin (`requireAdmin`) |
| `GET /api/compare` (`src/server.js`) | Yıl karşılaştırması. `comparable` alanı ortak-ay kıyasıdır; hesabı `src/compare-metrics.js` içindeki saf `buildComparableSummary()` yapar | Kullanıcı |

## 6. Tasarım Sistemi Özeti 🎨
- **Kokpit dili (2026-08-05/06):** 6 sayfa iki şeritli — ana kolon + 320px karar paneli. Ortak
  sınıflar `.cockpit-page / .cockpit-body / .cockpit-main / .cockpit-rail`, ortak parçalar
  `.rail-block`, `.rail-facts`, `.rail-action*` ve `renderRailFacts()` / `renderRailActionItems()`.
- **Tek ölçü sistemi:** `.cockpit-page` altında `--control-height: 38px`, `--control-radius: 9px`,
  `--control-gap`, `--section-gap`. Tüm buton/seçici yükseklikleri ve bölüm boşlukları buradan gelir.
  Dokunmatik cihazda 44px hedefi ayrı bir medya sorgusuyla korunur.
- **Kenar çubuğu:** bulanıklık yok, panel opak + yumuşak gölge (CEO kararı).
- **Yaklaşım:** Modern dark/light SaaS; Linear/Vercel sadeliği + finansal dashboard ciddiyeti.
- **Renk semantiği:** pozitif=success(yeşil), negatif=danger(kırmızı), nötr — anlam taşır, korunur.
- **Tema:** `public/styles.css` içinde token bazlı; tema tercihi Ayarlar sayfasında.
- **Kural:** Her kartın karar değeri olmalı; dekoratif kart yok. (Detay: CLAUDE.md)

## 7. Onaylanan Kararlar ✅
| Tarih | Karar | Neden |
|---|---|---|
| 2026-07-07 | Düzen turu = **cerrahi temizlik** (dev dosyalar bu turda BÖLÜNMEZ) | En düşük risk; çalışan uygulama korunur |
| 2026-07-07 | Kod inceleme = **derin denetim** (4 uzman ajan) | "Gerçek app" kalite/güvenlik kapısı isteniyor |
| 2026-07-07 | Çift `005` migration'ı yeniden ADLANDIRILMAZ | Runner dosya adıyla takip ediyor; yeniden ad → gerçek DB'de tekrar çalışma riski |
| 2026-07-07 | **Cari geçmiş verisi: dokunma (backfill YOK)** | Geçmiş analizlerde ham satır saklanmıyor (yalnız özet+top-5, tarih yok); tam/doğru cari ancak Excel yeniden yüklenerek gelir. Cari kodu/verisi değiştirilmedi |
| 2026-07-07 | README = tam profesyonel düzen; iç günlükler CHANGELOG.md'ye | "Repoda olması gereken gibi" istendi; doküman işi, kod güvende |
| 2026-07-08 | **Tier 3:** A) önce #2 (mobil kart), sonra #3 (onay modalı); #1 ATLA | En iyi değer/risk sırası; #1 bug değil, görsel regresyon testi olmadan riskli |
| 2026-07-08 | Tier 3 = **iki ayrı commit** (#2 `9754b57`, #3 `0b28bea`) | Temiz geçmiş; her iş tek başına geri alınabilir. Toplam orijinalle birebir doğrulandı |
| 2026-08-05 | **Tasarım yönü: "1b Kokpit"** (Claude Design `Analizcim - Yeni Yönler.dc.html`) | CEO seçimi. Alternatif "1a Defter" açık temalı, kenar çubuğunu kaldıran daha büyük kırılım olurdu; 1b mevcut iskelete (ikon şeridi + koyu/açık tema + tablo) en yakın, riski en düşük yön |
| 2026-08-05 | **Kapsam: yalnızca Dashboard** (app shell ve diğer sayfalar dokunulmadı) | CEO seçimi. Sonuç hemen görülür, risk dar; beğenilirse sonraki turlarda diğer sayfalara yayılır |
| 2026-08-05 | 8 KPI kartı **silinmedi**, 4 ana kutu + ikincil şerit oldu | Tasarım "KPI 8→4" diyor ama hiçbir sayı kaybolmamalı; Brüt Kâr/Analiz/Gider/Müşteri/Tedarikçi ikincil şeritte duruyor |
| 2026-08-05 | KDV kutusuna **yıllık değişim rozeti konmadı** | Ödenecek KDV devreden-mahsuplu defterden geliyor; önceki yıl için aynı defter kurulmadan yapılan kıyas yanıltıcı olurdu. Rozet yerine boş bırakıldı |
| 2026-08-06 | **Kokpit dili dört sayfaya yayıldı — "tam yeniden düzen"** | CEO seçimi. Riski önden bildirildi; Tahminler'in sürükle-bırak kart düzeni yıkılmadan iki şeritli kabuğa alındı |
| 2026-08-06 | **Tahminler'de sürükle-bırak KALDIRILDI, düzen sabit** | CEO kararı. "Kaç zamandır adam akıllı layout oturtamadık" sorununun kökü sıranın kullanıcıya bırakılmasıydı; sabit düzen olmadan garanti verilemiyordu |
| 2026-08-06 | Kenar çubuğunda **bulanıklık kalksın, panel opak** | CEO kararı. Bulanık şerit yapay duruyordu ve ekranı keskin bir dikey çizgiyle bölüyordu |
| 2026-08-06 | Revizyon kapsamı = **görsel düzensizlik** (içerik yeniden kurgulanmadı) | CEO kararı. Sorun bilgide değil ölçüde/hizalamada; tek ölçü sistemi kuruldu |
| 2026-08-06 | Cari ekranında **"Bakiye" etiketi düzeltildi, gerçek bakiye takibi YAPILMADI** | Rakam ödenmemiş kalan değil fatura toplamı; etiketi düzeltmek risksiz, gerçek takip ise kapsam genişlemesi (tahsilat/ödeme kaydı + giriş ekranı) ve CEO onayı bekliyor |
| 2026-08-06 | Hedef **lokal, tek kullanıcı** | CEO seçimi. Oturum saklama, bağımlılık yükseltmesi ve CSP sertleştirmesi bu hedefte gereksiz; enerji hata avı ve cilaya harcandı |
| 2026-08-06 | Eski yedek `data/pre_restore_1771112753452.db` **kalsın** | CEO kararı; bekleyen onaylardan çıkarıldı, bir daha sorulmayacak |
| 2026-08-05 | **Panel kârı KDV hariç tabana çekildi** (istemci tarafı, backend'e dokunulmadı) | Panel KDV dahil, tablo KDV hariç hesaplıyordu → aynı ekranda iki farklı "Net Kâr". 2026-07-07'de CEO onayıyla alınan "brüt kâr KDV hariç" kararı bu noktada uygulanmamıştı; yeni bir finansal karar değil, eksik kalan uygulamanın tamamlanması. **Panelde görünen kâr rakamı düşer (doğru değere).** Geri alınması gerekirse tek fonksiyon (`computeVatExclusiveGrossProfit`) yeter |

## 8. Bekleyen Onaylar 🚦
- **Gerçek bakiye takibi yapılsın mı?** Bugünkü "Fatura Toplamı" ödenmemiş kalanı göstermiyor; gerçek
  borç/alacak için `invoice_type`'a `payment`/`collection` eklemek + tahsilat/ödeme giriş ekranı
  gerekiyor. Kapsam genişlemesi olduğu için CEO onayı bekliyor.
- **Eski raporlar cari listesine katılsın mı?** Tek yol ilgili Excel dosyalarını yeniden yüklemek
  (backfill teknik olarak imkânsız — satır bazlı veri saklanmıyor). Hangi dönemler isteniyorsa CEO
  belirtecek. Mükerrer koruması çalışıyor, ikinci yükleme veriyi ikiye katlamaz.
- **Ekran görüntüleri yenilensin mi?** `docs/screenshots/` içindeki 8 görsel 2026-08-07 denetim
  turundan ÖNCEYE ait; kenar çubuğu kenarlığı, madalya renkleri, gider şeridi ve cari kolonları
  değiştiği için artık uygulamayı tam yansıtmıyorlar. Yenileme yaklaşık yarım saatlik ayrı bir iş
  (izole QA sunucusu + demo veri + 1440×900 koyu tema çekim).
- _(kapandı 2026-08-07)_ `data/pre_restore_1771112753452.db` ve `data/backups/` içindeki 3 yedek,
  CEO'nun sıfırlama onayı kapsamında **silindi**. (2026-08-06'daki "kalsın" kararı bu onayla değişti.)
- _(Not: `git init` + private GitHub deposu 2026-07-07'de CEO onayıyla TAMAMLANDI; CI kurulu ve yeşil.)_

## 9. Devam Eden İşler 🔨
| İş | Kim | Durum |
|---|---|---|
| Derin kod denetimi (backend, adversarial güvenlik, frontend, iş mantığı) | 4 uzman ajan | ✅ TAMAM (2026-07-07) |
| Kritik/yüksek güvenlik+finansal bulguların düzeltilmesi (Grup 1-4) | ana asistan | ✅ TAMAM (2026-07-07) |
| Tier 3 UI turu (#2 mobil kart, #3 onay modalı) | ana asistan + test-uzmani + kod-inceleyici | ✅ TAMAM (2026-07-08), push + CI yeşil |
| Dashboard "Kokpit" tasarım turu (yön 1b) | ana asistan | ✅ TAMAM — CEO onayladı, commit `7b783e1`, CI yeşil |
| Kokpit dilinin dört sayfaya yayılması (Karşılaştırma, Gider, Cari, Tahminler) | ana asistan | ✅ TAMAM (2026-08-06), 4 commit push'landı |
| Test altyapısı + finansal kök + küçük hata avı | ana asistan | ✅ TAMAM (2026-08-06) |
| CEO revizyon turu (renk bandı, kenar çubuğu, sabit tahmin düzeni, En Çok ay filtresi, tek ölçü, cari etiket) | ana asistan + 2 denetim ajanı | ✅ TAMAM (2026-08-06), commit `7732e4f`, CI yeşil |
| Sağlamlaştırma turu (3 sessiz hata + ölü ayar + güvenli bağımlılık yamaları) | ana asistan + test-uzmani + kod-inceleyici | ✅ TAMAM (2026-08-07), commit `d4542c2` + `f4730b7` |
| Depo denetim raporunun 9 maddesi (beyaz kenarlık, harf sırası, gider şeridi, cari kolonları, son 12 ay penceresi, yüzde biçimi, renk disiplini, madalya renkleri, jsPDF aralığı) | ana asistan + test-uzmani + kod-inceleyici | ✅ TAMAM (2026-08-07), commit `f2768d4`, CI yeşil (22 sn) |
| Tarayıcı görsel denetim turu — 18 bulgu, A/B/C grupları | ana asistan + test-uzmani + kod-inceleyici | ✅ TAMAM (2026-08-07). Kalite kapısı 2 tur döndü, ikisi de ONAY. 3 commit |
| _Başka aktif iş yok_ — kalanlar "Sonraki Adımlar" backlog'unda | — | Beklemede |

## 10. Bilinen Sorunlar 🐞
| Sorun | Ciddiyet | Durum |
|---|---|---|
| **`GET /api/backup` (backups.js:25) `requireAdmin` YOK** → her kullanıcı tüm DB'yi indirebiliyordu | **KRİTİK** | ✅ DÜZELTİLDİ (2026-07-07, `requireAdmin` eklendi) |
| **IDOR: `storage.js:286` `userId \|\| 1` + 5 uçta `userId` eksik** (907, 950, 1009, 1446, 1582) | **YÜKSEK** | ✅ DÜZELTİLDİ (5 uca `userId` eklendi + `||1` yerine hata fırlatma). Testler geçti |
| `ui-structure.test.js` "no gradient" testi — tek `linear-gradient` | Düşük | ✅ DÜZELTİLDİ (gradyan kaldırıldı; `grep linear-gradient styles.css` = 0, test geçiyor) |
| `xlsx@0.18.5` bilinen açık (Prototype Pollution + ReDoS), npm'de düzeltme yok | Yüksek | AÇIK — npm'de yama yok. Risk düşük (lokal, tek kullanıcı, kendi dosyaları) + 10MB upload limiti. Çok kullanıcılı senaryoda ayrı tur |
| Oturum sertleştirme: `sameSite`, girişte `regenerate()`, login limiti 200→10 | Orta | ✅ DÜZELTİLDİ (Grup 3). auth 7/7, rate-limiter testi güncellendi. (Kalan: MemoryStore teknik borç) |
| Hata mesajı sızıntısı (merkezi middleware + dashboard-range) | Orta | ✅ DÜZELTİLDİ (detay log'a, kullanıcıya genel mesaj). Kalan ~11 `err.message` noktası düşük öncelik |
| Excel/CSV dışa aktarımında formül enjeksiyonu (`=`,`+`,`-`,`@` nötrlenmiyor) | Orta→Düşük | ✅ DÜZELTİLDİ (`validators.neutralizeSpreadsheetCell` + `buildHistoryExcelBuffer`, 3 test) |
| DEPS: `npm audit` = **8 açık (1 kritik / 5 yüksek / 2 düşük)** — 2026-08-07'de 20'den indi | Yüksek | KISMEN KAPATILDI (2026-08-07, `f4730b7`). `npm audit fix` (`--force` YOK) 12 açığı kapattı; `package.json` değişmedi, yalnız lockfile minor/patch aldı. **Kalan 1 kritik yeni değil:** `tar` ← `node-gyp` ← `sqlite3` derleme zinciri; yalnız `npm install` sırasında native binding derlerken çalışır, çalışan sunucu tetiklemez. `sqlite3@6` kırıcı olduğu için ertelendi. `xlsx` npm'de hâlâ yamasız (lokal tek kullanıcı + 10MB limit mitigasyon) |
| **Silinen (soft-delete) analizin cari hareketleri listede/detayda/panel özetinde kalıyordu** → rakamlar şişik | Yüksek | ✅ DÜZELTİLDİ (2026-08-07). `storage.livePartyTransactionCondition()` + 6 sorgu. `NOT EXISTS` kullanıldı ki `source_history_id IS NULL` eski satırlar hayatta kalsın; entegrasyon testi bu inceliği kilitliyor |
| **Çöpten kalıcı silinen analizin cari hareketleri SAHİPSİZ kalıyor ve listede sayılmaya devam ediyordu** | Yüksek | ✅ DÜZELTİLDİ (2026-08-07, CEO "A seçeneği" kararı). `permanentlyDeleteFromTrash` / `permanentlyDeleteTrashBatch` yalnız `analyses` satırını siler; eski süzgeç sadece "kaynağı var AMA soft-delete edilmiş" satırları eliyordu, kaynağı hiç kalmayan satır canlı sayılıyordu (gerçek DB'de 118 sahipsiz satır, Haziran 2026 hacmi ~3 katı). Yeni koşul: `source_history_id IS NULL` **VEYA** eşleşen `analyses` satırı var ve `deleted_at IS NULL` — eski NULL satırlar yaşamaya devam eder. Satır silme YAPILMADI (veri silme CEO onay kapısı); sahipsiz satırlar diskte durur, hiçbir ekranda görünmez. Kalıcı regresyon testi: `tests/integration/business-parties.test.js` → "permanently deleted analysis leaves no orphan party rows"; düzeltme geçici geri alınıp testin gerçekten kırıldığı kanıtlandı |
| Panelde "En Yüksek Bakiyeli Müşteri" Excel carilerinde hep boştu (manuel `customers.balance`'tan besleniyordu) | Orta | ✅ DÜZELTİLDİ (2026-08-07). Artık fatura hacminden besleniyor, etiket "En Yüksek Fatura Hacimli Müşteri". Ayrıca `dashTotalCustomers` sayacının iki yazıcısı (yarış durumu) teke indi. Manuel müşteri CRUD ve `customers.balance` alanı korundu |
| `getMonthlyTotals` KDV tuzağı: `sales`/`purchases` KDV DAHİL, `vat` ise satış+alış birleşik → yeni bir tüketici `sales - purchases` yaparsa finansal hata döner | Orta | ✅ AZALTILDI (2026-08-07). Eklemeli `salesVat`/`purchasesVat` dizileri + fonksiyon başına uyarı JSDoc'u; mevcut alanlar birebir aynı. `getMonthlyTotalsInRange` ile ~60 satır kopya kod paylaşılan yardımcılara indi |
| Öksüz tercih anahtarları (`predictions_layout_id`, `predictions_card_order`) allowlist'te duruyordu | Düşük | ✅ DÜZELTİLDİ (2026-08-07). Allowlist'ten, varsayılan okuma listesinden ve migrate ucundan çıkarıldı. DB satırları bilerek silinmedi (veri silme CEO onay kapısı) |
| **FİNANSAL: Brüt Kâr KDV DAHİL hesaplanıyordu** → ana kâr KPI'ı KDV kadar şişikti | **KRİTİK** | ✅ DÜZELTİLDİ (2026-07-07). KDV hariç: `calculateSummary`, `getMonthlyProfitLoss` (satır 2555), YoY (`server.js:1486`), `computeAndSaveSummary`. Geçmiş 20 kayıt migration 010 ile yeniden hesaplandı (6.11M→5.11M). Yedek: `data/backups/pre_vat_fix_*.db`. 96/96 test geçti |
| FİNANSAL: `parseNumber` parantezli negatif `(1.234,56)` → 0, satır sessizce kayboluyordu | Yüksek | ✅ DÜZELTİLDİ (parantez+sondaki eksi negatif olarak parse ediliyor, 9/9 kanıt) |
| FİNANSAL: `predictor.js` yetersiz-veri dalında korunması gereken alanlar `undefined` | Yüksek | ✅ DÜZELTİLDİ (confidenceBands/purchase/profit/netProfit/businessStats eklendi) |
| FİNANSAL: son ay 0 ise CEO özetinde "%Infinity" (`predictor.js:880`) | Orta | ✅ DÜZELTİLDİ (sıfıra bölme koruması) |
| FİNANSAL: çoklu dosya birleştirmede mükerrer kontrolü yok (`analyzer.js`) → aynı dosya 2 kez = toplam 2 katı | Orta-Yüksek | ✅ DÜZELTİLDİ (`analyzer.dedupeBuffersByContent`, dosya-hash bazlı, 3 test) |
| FİNANSAL (minör): kâr oranı % paydası `total_purchases` (KDV dahil) — etiket/payda netleştirilmeli | Düşük | ✅ DÜZELTİLDİ (payda satış'a çevrildi, kod tabanıyla tutarlı) |
| DEPS: `jsPDF ≤4.2.0` KRİTİK açık, sunucu PDF üretiminde aktif | Yüksek | ✅ DÜZELTİLDİ (jsPDF `4.2.1`, audit kritik 1→0). Ayrıca kırık PDF export bug'ı da onarıldı (`autoTable.default`) |
| FRONTEND: 3 farklı escape fonksiyonu karışık + `escapeAttribute` yanlış bağlamda (bugün sömürülemez, ID'ler tamsayı) | Düşük-Orta | Kısmen düzeltildi (`escapeAttr`); tam konsolidasyon backlog |
| FRONTEND: CSP (Content-Security-Policy) başlığı hiç yok | Düşük | ✅ DÜZELTİLDİ (CSP + güvenlik başlıkları `server.js`; `'unsafe-inline'` inline onclick için, kaldırma backlog) |
| SQL enjeksiyon: **temiz** — kolon/sıralama beyaz liste, değerler parametreli | ✅ | Doğrulandı (ilk şüphe kapandı) |
| İstemci kimlik: **güvenli** — httpOnly çerez, localStorage'da token/şifre yok | ✅ | Frontend denetimi doğruladı |
| **Cari detayındaki "son 12 ay" penceresi son 12 KAYDI alıyordu** (`monthly.slice(-12)`) → hareketsiz aylar atlandığı için pencere 3 yıla yayılabiliyordu | Orta | ✅ DÜZELTİLDİ (2026-08-07, `f2768d4`). `storage.buildLastTwelveMonthsTrend()` son tarihli aydan geriye tam 12 takvim ayı kurar, hareketsiz ayları 0 yazar, tarihsiz satırları eler. 4 birim testi (`tests/unit/storage-party-trend.test.js`) |
| **`npm run verify` / `npm run test:unit` hiç bitmiyordu** (bu iki script `--test-force-exit` taşımaz, açık SQLite handle koşuyu kilitler) | Yüksek (test altyapısı) | ✅ DÜZELTİLDİ (2026-08-07). Sebep yeni test dosyasının teardown'ıydı: `src/database` require anında migration zincirini ASENKRON başlatır; saf fonksiyon testi zincirden önce biter, `after()` handle'ı zincir ortasında kapatınca `SQLITE_MISUSE` çıkar, hiç kapatmayınca koşu asılır. `after()` artık `migrations` tablosu `scripts/migrations` dosya sayısına ulaşana kadar bekler, sonra kapatır ve siler. **Yeni birim testi yazan herkes bu kalıbı kullanmalı** (CLAUDE.md'de de yazılı) |
| Renk disiplini kodda uygulanmıyordu: alış tutarı, ciro, gider ve sayaçlar yeşile boyanıyordu ("iyi haber" yanılsaması) | Orta | ✅ DÜZELTİLDİ (2026-08-07). `NUMERIC_COLOR_SELECTOR` 25 → 9 seçici; yalnız finansal SONUÇ taşıyan değerler renklenir. `.dashboard-pl-value:not(...)` seçicisi bilinçli KORUNDU (HTML bu sınıfı çıplak taşır, modifikatörü JS veri gelince yazar) |
| Koyu temada kenar çubuğu kenarlığı `#ffffff` idi (dört yerde), kullanıcı kartının etrafında beyaz kutu | Düşük (görsel) | ✅ DÜZELTİLDİ (2026-08-07). `#2e2e2e`. Yedek değerler dahil hiçbir yerde `#ffffff` bırakılmamalı |
| **Geçmiş filtre satırı mobilde kullanılamıyordu** — `filtersEl.style.display = 'flex'` satır içi stili hiçbir `@media` kuralından ezilemediği için mobil tek-kolon düzeni HİÇ devreye girmiyordu; 390px'te 8 kutu ~35 piksele sıkışıyordu | **KRİTİK (görsel/kullanılabilirlik)** | ✅ DÜZELTİLDİ (2026-08-07, C grubu). `classList.add/remove('is-hidden')` + `.history-filters.is-hidden { display: none }` (özgüllük 0,2,0, `!important` gerekmedi). test-uzmani bulmuştu. Regresyon testi `filtersEl.style.display` ifadesinin kaynakta bulunmamasını kilitler |
| Ön yüzde `%${...toFixed(n)}` deseninden 10 yüzde kaçağı (Pareto özeti ve grafik ipucu, kâr/zarar yüzdesi, aykırı değer sapması, cari "İlk 3", gider karar panelinde 4 cümle) | Düşük | ✅ DÜZELTİLDİ. Hepsi `formatPercent`'e bağlandı; kodda o desenden 0 tane kaldı, tarayan regresyon testi var |
| Tahminler yönetici özeti iki satıra kırpılıyordu (`-webkit-line-clamp: 2`) → yalnız yasal uyarı görünüyor, tahmin tutarı ve brüt kâr cümlesi gizleniyordu | Orta | ✅ DÜZELTİLDİ (2026-08-07, C grubu). Kırpma kaldırıldı; regresyon testi `ui-structure.test.js` |
| "En Çok" listesinde firma unvanları `...` ile kesiliyordu (253px'te tek satır) — hangi firma olduğu okunmuyordu | Orta | ✅ DÜZELTİLDİ. `.topn-table .name-cell` artık satıra bölünür |
| Risk/aksiyon rozetleri kelime ortasından bölünüyordu ("Yükse / k") | Düşük (görsel) | ✅ DÜZELTİLDİ. 4 rozet sınıfına `white-space: nowrap` + `flex-shrink: 0` |
| Yıl Karşılaştırma filtre satırı: kart çerçevesinin iç boşluğu yoktu (etiket kenarlığa yapışık), seçici 56px iken buton 38px'ti | Düşük (görsel) | ✅ DÜZELTİLDİ. `.compare-year-card` çerçevesiz; seçici + VS rozeti + buton üçü de `--control-height` |
| Panelde iki liste "Son Eklenen 5 …" adını taşıyordu (biri faturadan, biri elle eklenen) ve elle eklenen isimler koyu temada `#737373` ile okunmuyordu | Orta | ✅ DÜZELTİLDİ. Etiketler ayrıştırıldı ("Faturalardan Gelen Son 5 Cari" / "Elle Eklenen Son 5 Müşteri"); tıklanamayan isim `recent-plain-name` sınıfına geçti |
| Ayarlar'daki "Veritabanı Boyutu" kutusu hep boştu; footer yılı elle yazılmıştı | Düşük | ✅ DÜZELTİLDİ. Yeni `GET /api/admin/db-size` (`requireAdmin`) + `loadAdminDbSize()`; footer yılı `#footerYear` |
| Tahmin motorunun ürettiği CÜMLELERDE yüzde hâlâ İngilizce yazımdaydı (`%33.1`) — 2026-08-07'deki tek-biçim kararı yalnız ön yüze uygulanmıştı | Düşük | ✅ DÜZELTİLDİ. `predictor.formatPercentText()`; sayısal API alanları Number kalmaya devam eder (şema kırılmadı) |
| **"Karşılaştır" butonu devre dışı gibi gri görünüyor** — hata değil: koyu temanın vurgu rengi (`--accent-primary`) zaten `#737373`, tüm ana butonlar aynı. Metin kontrastı ~4,36:1 (WCAG AA eşiği 4,5) | Düşük | 🚦 **CEO KARARI BEKLİYOR** — vurgu rengini değiştirmek tasarım yönü kararıdır, dokunulmadı |
| Dev dosyalar (`app.js` ~8360, `styles.css` ~16900, `storage.js` ~2700, `server.js` ~2100) bakımı zorlaştırıyor | Orta | Bu tur BÖLÜNMEYECEK; ileride modülerleştirme önerisi |
| Çift `005` migration adı (kozmetik) | Düşük | Dokunulmaz (bkz. Karar 3) |

## 11. Sonraki Adımlar 👉

### 🔜 SONRAKİ OTURUM — BURADAN BAŞLA

**Önce bunu bil (2026-08-07 sonu):** Gün içinde **beş tur** yapıldı, hepsi bitti, hepsi push edildi,
CI yeşil. **Aktif iş yok.** Ayrıca **veritabanı CEO onayıyla sıfırlandı ve iki hesaplı düzene geçildi.**

| Commit | İş |
|---|---|
| `d4542c2` | Üç sessiz hata (silinen analizin carileri, panel müşteri widget'ı, KDV tuzağı) + ölü tercih anahtarları |
| `f4730b7` | Güvenli bağımlılık yamaları (20 açık → 8) + KDV alan adı hizalaması |
| `059d045` | Kalıcı silinen analizin sahipsiz cari hareketleri süzülüyor (CEO "A" kararı) |
| `f2768d4` | **Denetim raporunun 9 maddesi** (beyaz kenarlık, tahmin harfleri A–M, gider şeridi, cari kolonları, son 12 ay takvim penceresi, tek yüzde biçimi, renk disiplini, madalya token'ları, jsPDF aralığı) |
| `406400b` · `af9fb51` · `72bf065` | **Tarayıcı görsel denetim turu — 18 bulgu** (A: yanlış bilgi · B: renk ve yazım · C: hizalama ve mobil). Detay `CHANGELOG.md` |
| `32ab1f0` | Veritabanı sıfırlaması + iki hesaplı düzen işlem günlüğüne işlendi |

Doğrulama: lint temiz, **207 birim + 38 entegrasyon + 1 smoke**. Son turda kalite kapısı **iki tur
döndü** — kod-inceleyici RET (testsiz admin ucu + regex ile doğrulanan finansal hesap),
test-uzmani RET (KRİTİK: satır içi `style.display` mobil düzeltmeyi eziyordu). Şartlar kapatıldıktan
sonra ikisi de ONAY. Ayrıntı Bölüm 10 ve `CLAUDE.md`'deki "tarayıcı görsel denetim turu" bölümü.

**GİRİŞ HESAPLARI (2026-08-07):** iki yönetici hesabı var — **`admin`** (gerçek veri için, boş) ve
**`test`** (18 dönemlik demo veri: 657 fatura satırı, 12 müşteri, 8 tedarikçi, 108 gider kalemi).
Verileri birbirinden tamamen ayrıdır; tüm veri tabloları `user_id` taşır, doğrulandı. **Parola
değerleri bu dosyaya yazılmaz** (anayasa kuralı); proje kökündeki `GIRIS_BILGILERI.md` dosyasındadır
(o dosya `.gitignore`'dadır, git'e girmez) ve geçicidir —
CEO Ayarlar → Hesap → Şifre Değiştir'den değiştirmelidir.

⚠️ **Ekran görüntüleri bayat:** `docs/screenshots/` içindeki 8 görsel `f2768d4` öncesine ait
(kenar çubuğu, madalya renkleri, gider şeridi, cari kolonları değişti). CEO kararı bekliyor (Bölüm 8).

ℹ️ **2026-08-07 notu:** kod-inceleyici ajanı denetim sırasında repo kökündeki 7 geçici QA ekran
görüntüsünü (iz sürülmeyen `.png`) CEO onayı almadan sildi ve bunu kendisi bildirdi. Depoya hiç
girmemiş, README kullanmıyordu; kalıcı kayıp yok. Ajanların iz sürülmeyen dosyaları temizlememesi
gerektiği hatırlatması bu satırda duruyor.

✅ **GitHub CI ÇALIŞIYOR — önceki "çalışmıyor" tespiti YANLIŞTI (2026-08-07 akşamı düzeltildi).**
`101c833` (README turu) ve `4c2079b` (Actions yükseltmesi) push'larında koşu anında kuyruğa girdi ve
sırasıyla 22 sn / 25 sn'de **yeşil** döndü. Kota/faturalandırma sorunu yok; CEO'nun bakması gereken
bir şey kalmadı. Muhtemel sebep geçici bir kuyruk gecikmesiydi. `9d3e1f3` koşusu `failure` olarak
duruyor (o an eski Actions sürümleriyle koştu), sonrasındaki iki koşu başarılı.

**Actions sürümleri (2026-08-07):** `actions/checkout@v7`, `actions/setup-node@v7`. Önceki `@v4`
sürümleri Node.js 20 tabanlıydı ve GitHub emeklilik uyarısı basıyordu; yükseltme sonrası koşuda
annotation kalmadı. Yükseltme yalnız runtime değişimidir, kullanılan girdiler (`node-version`,
`cache`) aynı.

| Commit | İş |
|---|---|
| `7b783e1` | Panel "Kokpit" düzeni + panel kârı KDV hariç tabana çekildi |
| `f50a989` | Özel Aralık kâr/zarar süzmesi, onay modalı odak tuzağı, mobil rapor butonları |
| `508ddac` | Panel hesapları `dashboard-metrics.js` modülüne + KDV hariç kâr sunucuda kapatıldı |
| `afccd3f` | Ortak kokpit temeli + Yıl Karşılaştırma |
| `22be1cf` | Gider sayfası + 3 sessiz veri kaybı hatası |
| `95b73a6` | Cari sayfaları (Müşteriler / Tedarikçiler / detay) |
| `77af643` | Tahminler sayfası |
| `f56c7c6` | Doküman turu |
| `7732e4f` | **CEO revizyon turu** (renk bandı, kenar çubuğu, sabit tahmin düzeni, En Çok ay filtresi, tek ölçü sistemi, cari etiket dürüstlüğü) |

Detay okuma sırası: CLAUDE.md → "2026-08-07 güncellemesi (sağlamlaştırma turu)",
"2026-08-06 güncellemesi (CEO revizyon turu + cari bakiye gerçeği)"
ve "2026-08-05/06 güncellemesi (Kokpit dili tüm sayfalara yayıldı + 5 sessiz hata)".

**CEO'ya sorulmuş, cevap bekleyen üç soru (Bölüm 8'de de var):**
1. Gerçek bakiye takibi (tahsilat/ödeme kaydı) istenir mi? — kapsam genişlemesi.
2. _(kapandı 2026-08-07)_ Eski dönem Excel'leri — veritabanı sıfırlandığı için konu düştü;
   CEO `admin` hesabına baştan yükleyecek.
3. README ekran görüntüleri yenilensin mi? (8 görsel `f2768d4` öncesine ait, ~yarım saatlik iş.)

### ✅ ESKİ DÖNEM EXCEL'LERİ — MADDE KAPANDI (2026-08-07, veritabanı sıfırlandı)

Bu madde artık geçersizdir. 2026-08-07'de CEO "bütün uygulama verilerini sıfırlayalım, zaten yeni
Excel yüklemem gerekiyordu" diyerek sıfırlamayı onayladı; **20 analizin tamamı ve 486 cari hareketi
kalıcı olarak silindi.** Yani "15 dönemin cari hareketi eksik" tespiti artık anlamsız — hiçbir dönem
yüklü değil.

CEO `admin` hesabına istediği dönemleri baştan yükleyecek. Cari import yalnız yeni yüklemede
çalıştığı için, yüklenen her dönem cari listesine de otomatik girer — eski turlardaki eksiklik
tekrarlanmaz. Mükerrer koruması çalışıyor; aynı dosya ikinci kez 0 satır ekler.

**Kalıcı ders (silinmez):** `analyses.sales_json` satır bazlı karşı taraf/tarih saklamaz, yalnız
analiz başına en büyük 5 karşı tarafın tarihsiz toplamını tutar. Bu yüzden cari veriyi veritabanı
üzerinden geri doldurmak (backfill) **teknik olarak imkânsızdır**; tek yol Excel'i yeniden yüklemektir.

**2026-08-07 turunda KAPATILAN dört madde:** silinen analizin cari hareketleri, panel müşteri
widget'ı, `getMonthlyTotals` KDV tuzağı ve öksüz tercih anahtarları (detay: Bölüm 10).

**Kalan teknik notlar (hiçbiri acil değil, hedef lokal/tek kullanıcı):**
- **KDV türetmesi iki yerde:** `src/server.js`'in iki ucu (`/api/dashboard/latest` ve özel aralık)
  `getHistory({limit: 1000})` ile KDV'yi yeniden hesaplayıp storage'dan gelen `salesVat`/`purchasesVat`
  dizilerini eziyor. Sadeleştirme bilerek ertelendi: sunucu bloğu önce JSON `totalTax`'ı, storage ise
  önce `sales_tax` kolonunu okuyor — eski kayıtlarda ikisi ayrışabilir, tek tabana çekmek ayrı bir
  doğrulama turu ister. Ayrıca oradaki `limit: 1000` sessiz bir tavandır. Kodda "BORÇ" notu var.

Kokpit turunun bilinçli olarak kapsam dışı bıraktıkları (CEO isterse sıradaki iş olabilir):
- Tasarımdaki **1b sol ikon şeridi** uygulanmadı; mevcut app shell kenar çubuğu korundu (kapsam kararı).
- **Mobilde (390px) başlık butonları sıkışık** görünüyor (`Excel'e Aktar / PDF Raporu / Widget Düzeni`).
  Bu **Kokpit turundan ÖNCE de aynıydı** (ekran görüntüsüyle doğrulandı); `.dashboard-action-btn`
  paylaşımlı olduğu için ayrı, dar kapsamlı bir turda ele alınmalı.
- **Yönetici Özeti paneli** (`.dashboard-overview-panel`) mevcut sadeleştirme kuralıyla gizli
  (`styles.css` içindeki `display:none !important` listesi) — bu da tur öncesinden geliyor.
  Kokpit'te bu rolü sağ karar paneli üstleniyor. Geri getirilmesi istenirse ayrı karar gerekir.
- Widget düzeni ekranı tek liste; iki şeritli düzende bir widget'ı diğer şeride taşımak mümkün değil
  (her şerit kendi içinde sıralanır). Kullanıcıya şerit seçimi gerekirse ayrı iş.

Kokpit turu öncesi backlog (hâlâ geçerli):

- _(kapandı 2026-08-06, `f50a989`)_ ~~Onay modalı focus-trap + Escape çakışması~~ — odak tuzağı ve
  capture aşamasında `stopPropagation` eklendi.
- **Alternatif 1 — MemoryStore → kalıcı session store** (orta, teknik borç): sunucu yeniden başlayınca
  oturumlar düşmesin. Tek kullanıcı/lokal için kritik değil ama "gerçek app" olgunluğu.
- **Alternatif 2 — Bağımlılık turu (`xlsx` / `sqlite3@6`)** (YÜKSEK RİSK, kırıcı): ayrı, tam test edilen tur
  gerektirir. **Güvenli olan kısım 2026-08-07'de zaten yapıldı** (20 açık → 8); kalan 8 için `--force` ve
  kırıcı büyük sürüm şart. Şimdilik risk düşük (lokal, tek kullanıcı, 10MB limit). Acele YOK.
- **Bekleyen küçük karar:** `data/pre_restore_1771112753452.db` (~270KB eski yedek) silinsin mi? (Bölüm 8.)

**Not:** Büyük frontend refactor (inline `onclick` → `addEventListener`) CSP'den `'unsafe-inline'`
kaldırmayı sağlar ama geniş kapsamlı; ancak CEO net isterse yapılmalı.

---

**Yapıldı:** Grup 1 (güvenlik) ✅ · Grup 2 finansal ✅ · Grup 3 (sertleştirme) ✅ · Grup 4 değerlendirildi.
**Geliştirme turu (2026-07-07) ✅:**
- Mükerrer dosya kontrolü (dosya-hash, `analyzer.js dedupeBuffersByContent`) — 3 test.
- Export formül enjeksiyonu nötrleme (`validators.neutralizeSpreadsheetCell`, buildHistoryExcelBuffer) — 3 test.
- Kalan 10 `err.message` sızıntısı kapatıldı (375/544 kontrollü mesajlar korundu).
- `/health` + `/api/health` public uçları eklendi (canlı 200 doğrulandı).
- Güvenlik başlıkları + CSP (canlı header doğrulandı; dış kaynak yok, `'unsafe-inline'` inline onclick için).
- Kâr oranı % paydası satış'a çevrildi (kod tabanıyla tutarlı).
- Frontend escape: `app.js:3864` escapeAttribute→escapeAttr.
- jsPDF 4.1.0→4.2.1 (kritik açık kapandı: audit 1 kritik→0). **Ayrıca ÖNCEDEN kırık PDF export bug'ı düzeltildi** (`autoTable` yanlış çağrılıyordu → `.default`, 3 nokta; PDF üretimi doğrulandı).
- Gradyan kaldırıldı (`styles.css:16821`), ui-structure 25/25.

**Doküman + repo turu (2026-07-07) ✅:** README profesyonelleştirildi + katlanabilir demo ekran görüntüleri
(`docs/screenshots/`), CHANGELOG.md + LICENSE (ISC), `.env.example` tamamlandı, CLAUDE.md güncellendi.
Proje **git + private GitHub deposu** altında: https://github.com/ademtfkc/analizcim. **CI (GitHub Actions)**
kurulu ve yeşil (`.github/workflows/ci.yml` → `npm ci` + lint + `npm run test:ci`). package.json standartları
(main/engines/repository/author).

**Kullanıcı testi + hata düzeltme turu (2026-07-08) ✅:** İzole demo DB'de 58 HTTP + 10 yazma testi + 2 UI/UX
ajanı. 6 gerçek bug düzeltildi (CHANGELOG'da detay): PDF export 500 (`server.js` `doc.save(res)`→`doc.output`),
`showSuccess` tanımsız ×10 → `showSuccessToast`, dashboard yükleme mesajı (`showLoading`'e mesaj param), tahmin
sürükle-bırak dinleyici sızıntısı (`initPredictionsDragDrop` idempotent), mobil buton 44px, empty-icon temizliği.
134 test + lint temiz, CI yeşil (commit `b39820d`).

### Tier 3 turu (2026-07-08) — CEO kararı: A) önce #2, sonra #3; #1 atlandı
- **#2 Cari tablosu mobilde kart görünümü** ✅ TAMAM (2026-07-08). `styles.css`'e `@media (max-width:768px)`
  kart bloğu (`.business-party-table` → thead gizli, satır=kart, hücre=flex "etiket:değer" via
  `::before{content:attr(data-label)}`); `app.js renderBusinessPartyRows` 5 `<td>`'ye `data-label` +
  `bp-cell-name`. Masaüstü tablo aynen. Tema token'lı, sabit renk yok, yeşil/kırmızı bakiye korundu.
  ui-structure regresyon kilidi testi eklendi. İzole QA 390/768/1440 GEÇTİ (0 console/network err).
  Kod inceleyici ONAY. **Commit `9754b57` — GitHub'a push'landı, CI yeşil.**
- **#3 `confirm()` → özel onay modalı** ✅ TAMAM (2026-07-08). 17 `confirm()` → `showConfirm({message,danger,
  confirmText})` Promise helper (`app.js` showError'dan sonra). Yeni `#confirmModal` iskeleti (`index.html`,
  mevcut `.modal-*` token'lı stiller + yeni `.btn-danger`=`var(--danger)`, `.confirm-modal-message`
  `white-space:pre-line`). Mesajlar `textContent` (XSS güvenli). İptal/ESC/dış tık/X=false, Onayla=true; modal
  yoksa `window.confirm` fallback. Silme işlemleri kırmızı, diğerleri normal. Regresyon kilidi testi (136 test).
  **Kod inceleyici İLK TURDA RET verdi:** `onKey` Enter dalı odaktan bağımsız `cleanup(true)` yapıyordu →
  İptal odaktayken Enter siliyordu. **Düzeltildi** (Enter dalı kaldırıldı, native buton aktivasyonuna bırakıldı).
  Test uzmanı 3 klavye senaryosu (Enter-açılışta-sil / Tab-İptal-Enter-silmez / Escape-silmez) + fare
  regresyonu GEÇTİ, 0 err. Kod inceleyici koşullu ONAY (reçetesi birebir uygulandı). **Commit `0b28bea` —
  GitHub'a push'landı, CI yeşil.**
- **#1 Responsive breakpoint konsolidasyonu** (YÜKSEK RİSK — ATLANDI): 92 `@media`, 18 max-width. Bug değil,
  teknik borç; görsel regresyon testi olmadan riskli. İleride ayrı turda.

### Diğer ertelenenler (backlog)
- _(kapandı 2026-08-06)_ ~~Onay modalı focus-trap yok · Escape çakışması~~ — `f50a989` ile kapatıldı.
- _(kapandı 2026-08-06)_ ~~Tahmin "layout" ölü kodu (`initPredictionsLayout`)~~ — sabit düzen turunda silindi.
- Bağımlılık: `xlsx` (npm fix yok), `sqlite3@6` (kırıcı, altındaki `tar` kritiğini de taşıyor) — çok
  kullanıcılı senaryoda ayrı tur.
- MemoryStore → kalıcı session store · CONTRIBUTING/issue şablonları.

### Güvenli test/QA yöntemi (yeni oturumda tekrar kurulabilir)
Gerçek `data/analiz.db`'ye DOKUNMADAN test için: sunucuyu izole geçici DB ile başlat —
`ANALIZCIM_DB_PATH=/private/tmp/analizcim-demo.db BOOTSTRAP_ADMIN_USERNAME=demo_admin
BOOTSTRAP_ADMIN_PASSWORD='Demo12345!' SESSION_SECRET=... PORT=3131 node src/server.js` (repo kökü DIŞINDA bir
cwd'den çalıştır ki gerçek `.env` yüklenmesin). Demo veri: `analyzer.analyzeFiles(salesBuf, purchaseBuf,
{salesColumnMap:{date:'A',counterparty:'C',net:'I',vat:'K',gross:'L'}, purchaseColumnMap:{date:'A',
counterparty:'B',net:'H',vat:'J',gross:'K'}})` + `storage.addToHistory` + `storage.importBusinessPartyTransactions`.
Kullanıcı testi HTTP fetch + cookie jar ile yapıldı (Playwright'sız). Ekran görüntüsü gerekiyorsa: `playwright-core`
+ ms-playwright cache'indeki chrome-for-testing binary (izole).
**UYARI (2026-07-08):** QA'da `NODE_ENV=production` KULLANMA. `express-session` `cookie.secure=true` iken düz HTTP'de
çerezi hiç göndermez → login imkansız. İzole QA'yı `NODE_ENV` set etmeden (veya `test`) çalıştır. Diğer izolasyon
(geçici DB, loopback, repo-dışı cwd) aynı. Cari (kart) QA'sı için `customers`/`suppliers`/`party_transactions`
tablolarına en az 4-5'er satır tohumla, yoksa liste boş görünür.

---

## 12. İşlem Günlüğü 📓 (Tamamlanan İşler)
| Tarih | Ajan | Ne yapıldı | Dokunulan dosyalar |
|---|---|---|---|
| 2026-08-07 | ana asistan | **Veritabanı CEO onayıyla sıfırlandı, iki hesaplı düzene geçildi (kod dosyasına dokunulmadı).** CEO admin parolasını kaybetmişti; parola bcrypt ile saklandığı için geri getirilemez, `.env`'de de `BOOTSTRAP_ADMIN_PASSWORD` yoktu. CEO "bütün uygulama verilerini sıfırlayalım, admin ve test hesabı ayrı olsun, test hesabında demo veri olsun" dedi. Silinenler (**geri dönüşü yok, CEO rakamları görüp onayladı**): 20 analiz, 486 cari hareket, 47 müşteri, 38 tedarikçi, 5 dönem özeti, eski `admin` hesabı, 4 yedek dosyası (`data/backups/` + `pre_restore_*.db`). Sonra temiz şema kuruldu (11 migration) ve iki yönetici hesabı açıldı: **`admin`** (gerçek veri için, boş) ve **`test`** (demo veri). Parolalar bu dosyaya YAZILMAZ. Demo veri gerçek akıştan geçirildi — scratchpad'deki üretici Türkçe başlıklı (`Tarih`, `Cari Ünvanı`, `Ara Toplam`, `Toplam KDV`, `Genel Toplam`) Excel'ler üretip `/api/analyze` ucuna yükledi; böylece KDV, özet ve cari hareketler uygulamanın kendi mantığıyla oluştu. Sonuç: 18 dönem (2025 tam + 2026 ilk 6 ay), 657 fatura satırı, 12 uydurma müşteri, 8 uydurma tedarikçi, 108 gider kalemi, mevsimsellik + yıllık büyüme deseni. **Hesap ayrımı doğrulandı:** tüm veri tabloları `user_id` taşır; `admin` ile giriş yapıldığında geçmiş, cari özeti ve panel özeti boş döner (veri sızıntısı yok). Üretici betik bilerek repo'ya alınmadı (scratchpad'de kaldı) | `data/analiz.db` (yeniden oluşturuldu), `data/backups/` (boşaltıldı), `PROJE_DURUMU.md` |
| 2026-08-07 | ana asistan | **Tarayıcı görsel denetim turu — C grubu (hizalama ve mobil).** CEO "görsel olarak hatalar var, Chrome'da gerçekten incele" dedi; izole Playwright Chromium + gerçek DB'nin kopyası (`/private/tmp/analizcim-qa.db`, port 3100) ile 18 bulgu çıkarıldı ve A (yanlış bilgi) / B (renk-yazım) / C (hizalama-mobil) olarak gruplandı. Bu satır C grubudur: (9-10) Geçmiş filtre satırındaki kontroller farklı yüksekliklerdeydi ve mobilde `flex-direction: column` etkisizdi → tümü 46px, mobilde tek kolonlu ızgara, satır içi `width:120px` kaldırıldı, `.history-header-actions` 2 kolon × 44px. (11) Risk/aksiyon rozetleri dar flex kolonunda kelime ortasından bölünüyordu ("Yükse / k") → 4 rozet sınıfına `white-space: nowrap` + `flex-shrink: 0`. (12) Tahminler yönetici özeti `-webkit-line-clamp: 2` yüzünden yalnız yasal uyarıyı gösteriyor, asıl tahmin tutarını gizliyordu → kırpma kaldırıldı; "En Çok" firma unvanları `...` ile kesiliyordu → satıra bölünüyor. (15) Yıl Karşılaştırma filtre kartının iç boşluğu yoktu (etiket kenarlığa yapışık) ve seçici 56px iken buton 38px'ti → kart çerçevesiz, seçici + VS rozeti + buton üçü de `--control-height`. (16) Panelde iki liste aynı adı taşıyordu ve elle eklenen isimler koyu temada `#737373` ile okunmuyordu → etiketler ayrıştırıldı, tıklanamayan isim `recent-plain-name` sınıfına geçti. (17) "Veritabanı Boyutu" kutusu hep boştu → yeni `GET /api/admin/db-size` (`requireAdmin`, yalnız bayt döner, dosya yolu dönmez) + `loadAdminDbSize()`; footer yılı `#footerYear` ile otomatik. (18) Sekme değişiminde sayfa başa kaydırılıyor. **Ek:** tahmin motorunun ürettiği cümlelerdeki yüzdeler Türkçe biçime geçti (`%33,1`) — yeni `predictor.formatPercentText()`; sayısal API alanları Number kalmaya devam ediyor. **Kalite kapısı İKİ TUR DÖNDÜ.** kod-inceleyici RET: yeni admin ucu testsiz + ortak-ay hesabı yalnız regex ile doğrulanıyor (kaynak metninde anahtar kelime arayan test kanıt sayılmaz) → hesap `src/compare-metrics.js` adlı SAF modüle taşındı ve 5 gerçek sayı senaryosuyla test edildi, admin ucuna 401/403/200 entegrasyon testi yazıldı. test-uzmani RET: **KRİTİK** — `filtersEl.style.display = 'flex'` satır içi stili hiçbir `@media` kuralından ezilemediği için 9/10 numaralı maddeler pratikte HİÇ çalışmıyordu (390px'te 8 kutu ~35 piksele sıkışıyordu) → `classList.add/remove('is-hidden')` + `.history-filters.is-hidden` kuralı; ayrıca Pareto cümlesindeki `%72.4` kaçağı ve aynı desenden 9 kaçak daha `formatPercent`'e bağlandı. İkinci turda **ikisi de ONAY** verdi; her iki ajan da düzeltmeleri geçici bozup testlerin gerçekten kırıldığını bağımsız kanıtladı. **Ölçüm:** lint temiz, **207 birim + 38 entegrasyon + 1 smoke**; 9 sekme × (1440 + 768 + 390) × (koyu + açık), 0 konsol hatası, sayfa düzeyinde 0 yatay kaydırma; Excel/JSON dışa aktarma ve sıfır-sonuç senaryosu canlıda denendi. **CEO'ya bırakılan tek madde:** "Karşılaştır" butonunun gri görünmesi hata değil, temanın vurgu rengi zaten gri — değiştirmek tasarım yönü kararı | `public/styles.css`, `public/index.html`, `public/app.js`, `src/server.js`, `src/predictor.js`, `src/compare-metrics.js` (yeni), `tests/unit/ui-structure.test.js`, `tests/unit/predictor.test.js`, `tests/unit/compare-metrics.test.js` (yeni), `tests/integration/admin.test.js`, `CHANGELOG.md`, `CLAUDE.md` |
| 2026-08-07 | ana asistan | **Depo denetim raporunun 9 maddesi uygulandı (CEO onayı sonrası).** (1) Kenar çubuğu kenarlığı koyu temada bembeyazdı (`--sidebar-border: #ffffff`, 4 yerde) → `#2e2e2e`. (2) Tahminler'deki 13 bölüm harfi HTML sırasına göre yeniden dizildi (A–M); eskiden aynı harf iki kartta görünüyor, sıra atlıyordu. (3) Gider dönem şeridindeki "Sabit"/"Değişken" kutuları hiçbir zaman doldurulmuyordu (yazıcı kod yok) → kaldırıldı, "Toplam" → "Toplam Gider". (4) Cari listesindeki "Fatura Toplamı" kolonu hacim kolonuyla matematiksel olarak AYNI sayıyı gösteriyordu → yerine **"Ortalama İşlem"** (hacim ÷ işlem adedi); cari detayındaki "Net Fatura Tutarı" kutusu da aynı sebeple **"Son 12 Ay Hacmi"** oldu. (5) Cari detayındaki "son 12 ay" trendi kayıt listesinin son 12 satırıydı; hareketsiz aylar atlandığı için 3 yıla yayılabiliyordu → `storage.buildLastTwelveMonthsTrend()` takvimden 12 ay üretir, boş aylar 0. (6) Yüzde biçimi 3 farklı yazımdaydı (`12.3%`, `%12,3`, `+12.3%`) → tek `formatPercent`/`formatPercentSigned` (Türkçe: işaret + `%` + virgül). (7) Renk disiplini belgeye uydu: `NUMERIC_COLOR_SELECTOR` 25 seçiciden 9'a indi; ciro/alış/gider/sayaç artık nötr, yeşil-kırmızı yalnız finansal sonuçta. (8) Açık temada sıralama madalyaları (altın/gümüş/bronz) okunmuyordu → `--rank-*` token'ları + kopya CSS kuralı birleştirildi. (9) `package.json`'daki `jspdf: ^4.1.0` aralığı kurulu 4.2.1 ile çelişiyordu (temiz kurulumda kritik açık geri gelirdi) → `^4.2.1`; README'deki 03 numaralı görselin yanlış açıklaması düzeltildi. Yeni test dosyası: `storage-party-trend.test.js` (4 test). **Kalite kapısı:** test-uzmani 9 maddeyi izole tarayıcıda doğruladı (0 console hatası) ve iki yüzde kaçağı buldu (Finansal Sağlık kartları + Kâr/Zarar marj hücresi) — düzeltildi. kod-inceleyici RET verdi: yeni test dosyası veritabanı bağlantısını kapatmadan geçici dosyayı siliyordu; kapatmayı eklemek tek başına yetmedi, çünkü `src/database` require anında migration zincirini asenkron başlatıyor ve handle zincir ortasında kapanıyordu (`SQLITE_MISUSE`). `after()` artık zincirin bitmesini bekliyor. **Bu düzeltmeden önce `npm run verify` hiç bitmiyordu.** Doğrulama: `npm run verify` yeşil — **183 birim + 37 entegrasyon + 1 smoke** | `public/styles.css`, `public/index.html`, `public/app.js`, `src/storage.js`, `package.json`, `package-lock.json`, `README.md`, `CHANGELOG.md`, `tests/unit/ui-structure.test.js`, `tests/unit/storage-party-trend.test.js` (yeni) |
| 2026-08-07 | ana asistan + kod-inceleyici | **Sahipsiz cari hareketi süzgeci (CEO "A" kararı).** `storage.livePartyTransactionCondition()` yeniden yazıldı: satır artık ancak `source_history_id IS NULL` ise VEYA bağlı olduğu `analyses` satırı duruyor ve soft-delete edilmemişse canlı sayılır. Böylece hem çöpe atılmış hem çöpten kalıcı silinmiş analizin hareketleri süzülür; cari import öncesi yazılmış NULL satırlar korunur. Süzgeci kullanan 6 sorgunun tamamı otomatik faydalanır. **Hiçbir satır silinmedi** (veri silme CEO onay kapısı). Yeni entegrasyon testi eklendi; düzeltme geçici geri alınıp testin gerçekten kırıldığı kanıtlandı (4 geçen / 1 kırılan). kod-inceleyici KOŞULLU ONAY verdi (tek şart: commit) — SQL mantığı 4 senaryoda doğru, enjeksiyon yok, yetki temiz; `source_history_id` indeksi bugünkü veri hacminde gerekli değil, 5-10 kat büyürse eklenmeli. Doğrulama: lint temiz, **179 birim + 37 entegrasyon + 1 smoke** | `src/storage.js`, `tests/integration/business-parties.test.js`, `CHANGELOG.md`, `PROJE_DURUMU.md`, `CLAUDE.md` |
| 2026-08-07 | ana asistan | **CI bakımı + cari kapsam denetimi (kod dosyasına dokunulmadı).** (1) `actions/checkout` ve `actions/setup-node` `@v4` → `@v7`; eski sürümler Node.js 20 tabanlıydı ve her koşuda emeklilik uyarısı basıyordu. Yükseltme yalnız runtime değiştirir, girdiler (`node-version: 22.x`, `cache: npm`) aynı. Koşu `31156660663` 25 sn'de yeşil, annotation 0. (2) **Önceki turun "GitHub CI çalışmıyor / Actions kotası bitti" tespiti YANLIŞ çıktı** — bugünkü iki push'ta koşu anında kuyruğa girdi ve yeşil döndü; CEO'nun faturalandırmaya bakmasına gerek yok, o uyarı Bölüm 11'den kaldırıldı. (3) Eski dönem Excel'leri işi denetlendi: gerçek DB salt okunur incelendi, **15 dönemin (Ocak–Aralık 2025, Ocak–Mart 2026) cari hareketi yok**; kaynak `.xlsx` dosyaları bu bilgisayarda hiç bulunmuyor ve `sales_json` satır bazlı veri saklamadığı için backfill imkânsız — iş CEO dosya verene kadar **bloke**. (4) Denetim sırasında yeni bir hata bulundu: **çöpten kalıcı silinen analizin cari hareketleri sahipsiz kalıp listede sayılmaya devam ediyor** (gerçek DB'de 118 sahipsiz satır, Haziran 2026); Bölüm 10'a açık madde olarak yazıldı, düzeltme CEO kararına bırakıldı | `.github/workflows/ci.yml`, `CHANGELOG.md`, `PROJE_DURUMU.md` |
| 2026-08-07 | ana asistan | **README vitrin turu (yalnızca doküman + görsel, kod dosyasına dokunulmadı).** Eski 3 ekran görüntüsü 7 Temmuz tarihliydi (Kokpit öncesi arayüz) ve tam sayfa çekildikleri için GitHub'da okunmuyordu (`01-dashboard.png` 2880×8318 piksel). İzole QA sunucusu + geçici DB (`/private/tmp/analizcim-readme-shots.db`, iş sonunda silindi) üzerinde uydurma firma adlarıyla 24 aylık demo veri üretildi; 7 görsel 1440×900 koyu temada, üstlerinde kırmızı "DEMO VERİ" bandıyla çekildi (3'ü üzerine yazıldı, 4'ü yeni: yıl karşılaştırma, gider, en çok, cari detay). Toplam görsel boyutu 2,7 MB → 1,2 MB. README vitrin düzenine geçti: hero başlık + rozet satırı (CI korundu, statik "testler" rozeti eklendi), `mermaid` 3 adımlı akış, ikonlu özellik tablosu, katlanır `<details>` yerine doğrudan görünen görseller. **Bayat bölüm düzeltildi:** README'nin anlattığı iki satırlı KPI düzeni koddaki 4 ana kutu + ikincil şerit düzeniyle değiştirildi (anayasa: dosya ile kod çelişirse koda güvenilir). Gerçek `data/analiz.db` ve gerçek `.env` kullanılmadı. Doğrulama: lint temiz, 179 birim + 36 entegrasyon + 1 smoke geçti, çapa ve görsel yolları tarandı, 0 console hatası | `README.md`, `docs/screenshots/` (8 dosya), `CHANGELOG.md`, `PROJE_DURUMU.md` |
| 2026-08-07 | ana asistan + test-uzmani + kod-inceleyici | **Sağlamlaştırma turu (`d4542c2` + `f4730b7`).** CEO odak kararı: görünür yeni özellik yok, sessiz hataları kapat. (1) Silinen analizin cari hareketleri listede/detayda/panel özetinde kalıyordu → `livePartyTransactionCondition()` yardımcısı + `party_transactions`'a dokunan 6 sorgu. `NOT EXISTS` seçildi ki `source_history_id IS NULL` eski satırlar hayatta kalsın. (2) Panelin "En Yüksek Bakiyeli Müşteri" kutusu manuel `customers.balance`'tan besleniyordu, Excel carilerinde hep 0'dı → fatura hacmine bağlandı, etiket "En Yüksek Fatura Hacimli Müşteri"; ayrıca `dashTotalCustomers` sayacının iki yazıcısı (yarış durumu) teke indi ve cari detayındaki bilgi taşımayan sabit renk kaldırıldı. (3) `getMonthlyTotals`/`getMonthlyTotalsInRange` eklemeli `salesVat`/`purchasesVat` döndürüyor + uyarı JSDoc'u; ~60 satır kopya kod paylaşılan yardımcılara indi. (4) Ölü tercih anahtarları (`predictions_layout_id`, `predictions_card_order`) allowlist'ten çıkarıldı, DB satırları bilerek silinmedi. (5) `npm audit fix` (`--force` YOK): 20 açık → 8; `package.json` değişmedi. **Kalite kapısı:** test-uzmani düzeltmeleri geçici olarak bozup testlerin gerçekten kırıldığını kanıtladı, kod-inceleyici ONAY verdi (SQL enjeksiyon/IDOR temiz, lockfile'da sürüm düşüşü yok). 179 birim + 36 entegrasyon + 1 smoke geçti. **Not:** push edildi ama GitHub CI hiç tetiklenmedi (bkz. Bölüm 11 uyarısı) | `src/storage.js`, `src/server.js` (yalnız borç notu), `src/routes/preferences.js`, `public/app.js`, `public/index.html`, `public/styles.css`, 4 test dosyası (1 yeni), `package-lock.json` |
| 2026-08-06 | ana asistan + test-uzmani + kod-inceleyici | **CEO revizyon turu (`7732e4f`):** 6 iş — (1) KPI ızgarasındaki gri bant (eski `gap:1rem !important` hairline'ı eziyordu) → `gap:1px !important`; (2) kenar çubuğu bulanıklığı kaldırıldı, panel opak; (3) Tahminler'de sürükle-bırak TAMAMEN kaldırıldı, tek sabit düzen + 128 ölü CSS kuralı (~27 KB) silindi; (4) "En Çok" başlığı kısaldı + yıl/ay filtresi (backend `month` parametresi, filtre iki döngüde de); (5) tek ölçü sistemi (`--control-height:38px` vb.) 8 sayfaya uygulandı, Ayarlar da `.cockpit-page` oldu; (6) cari "Bakiye" → "Fatura Toplamı" (araştırma: rakam ödenmemiş bakiye değil, fatura toplamı) + hep 0 dönen `lastTransactionAmount` düzeltildi. **Kalite kapısı 2 tur döndü:** test-uzmani mobilde flex-basis'in yükseklik olarak okunduğunu (butonlar 140px, başlıklar 280px) yakaladı; kod-inceleyici RET verdi (dokunmatik 44px ezilmesi, sabit cari rengi, eksik kalıcı test) — hepsi düzeltildi. 174 birim + 34 entegrasyon + smoke geçti, CI yeşil | `public/index.html`, `public/app.js`, `public/styles.css`, `src/server.js`, `src/storage.js`, 2 test dosyası |
| 2026-08-06 | araştırma ajanı | **Cari bakiye araştırması:** "Bakiye" kolonunun gerçekte ödenmemiş bakiye DEĞİL, kesilen faturaların toplamı olduğu kanıtlandı (sistemde tahsilat/ödeme kavramı yok, şema `invoice_type IN ('sales','purchase')` ile kilitli). Eski analizlerin cari ekranına hiç girmediği ve satır bazlı veri saklanmadığı için backfill'in imkânsız olduğu doğrulandı. Ayrıca `lastTransactionAmount`'ın SQL'de hiç seçilmediği (hep 0 döndüğü) ve silinen analizlerin cari hareketlerinin listede kaldığı tespit edildi | (okuma + izole test DB) |
| 2026-08-06 | ana asistan | **Kokpit dili dört sayfaya yayıldı (adım 3):** ortak `.cockpit-page/.cockpit-body/.cockpit-main/.cockpit-rail` temeli kuruldu; Yıl Karşılaştırma (`afccd3f`), Gider (`22be1cf`), Cari — Müşteriler/Tedarikçiler/detay (`95b73a6`) ve Tahminler (`77af643`) iki şeritli düzene geçti. Her sayfaya veriden üretilen karar paneli eklendi (satır içi onclick yok). Tahminler'in sürükle-bırak kart düzeni, cari mobil kart görünümü ve tüm element ID'leri korundu. Doğrulama: `npm run verify` yeşil (171 birim + 33 entegrasyon + smoke), 6 sekme 1440/390 + koyu/açık tema, 0 console hatası | `public/index.html`, `public/app.js`, `public/styles.css`, `tests/unit/ui-structure.test.js` |
| 2026-08-06 | ana asistan | **Gider modülünde 3 sessiz veri kaybı hatası (tasarım turunda ortaya çıktı):** (1) gider adları hiç kaydedilmiyordu — validator `name` isterken ön yüz `label` gönderiyor, hata `catch(_){}` ile yutuluyordu; (2) her tuş vuruşunda kayıt + DELETE/INSERT yarışı satırları çoğaltıyordu; (3) "tüm yıl" giderleri panelde görünmüyordu. Üçü de düzeltildi, 3 yeni entegrasyon testi eklendi | `src/routes/expenses.js`, `src/storage.js`, `public/app.js`, `tests/integration/expenses.test.js` |
| 2026-08-06 | ana asistan | **Adım 2 — test altyapısı + finansal kök (`508ddac`):** panel hesapları `public/js/dashboard-metrics.js` modülüne çıkarıldı + 26 gerçek birim testi; `/api/dashboard/latest` ve `/range` artık KDV hariç `grossProfit` serisi döndürüyor (summary.gross_profit 10.439.320 → 8.699.433, profit-loss ucuyla fark 0); `npm run test:integration` `--test-force-exit` ile kapanıyor | `public/js/dashboard-metrics.js`, `src/server.js`, `public/app.js`, `package.json`, +2 test dosyası |
| 2026-08-06 | ana asistan | **Adım 1 — küçük hata avı (`f50a989`):** Özel Aralık Kâr/Zarar bölümünü hiç etkilemiyordu (başlık bayat + tablo 12 ay) → aralığa göre süzme + tek dönem etiketi; onay modalına odak tuzağı ve Escape yalıtımı; mobilde sıkışan rapor butonları | `public/app.js`, `public/styles.css`, `tests/unit/ui-structure.test.js` |
| 2026-08-05 | test-uzmani + kod-inceleyici + ana asistan | **Kokpit kalite kapısı — 6 hata bulundu ve düzeltildi.** test-uzmani: (1) KRİTİK panel Net Kâr ≠ tablo Net Kâr (KDV dahil/hariç çelişkisi, fark = net KDV), (2) YÜKSEK boş durum ekranı hiç tetiklenmiyor (API sıfır dolu summary dönüyor + `.dashboard-stats` üzerinde `display:grid !important`), (3) kısmi yıl YoY'u tam yılla kıyaslıyor. kod-inceleyici **RET**: (4) "En zayıf ay" HTML'de sabit `class="negative"`, (5) net kâr mikro grafiği zararda da yeşil; ayrıca `.pl-margin*` scope'suz, dinamik bölüm fallback'i şerit dışına düşebiliyor, düz seride sparkline dibe yapışıyor. Ana asistan ek olarak (6) negatif marjda dolu görünen marj çubuğunu düzeltti ve artık gereksiz `console.log("[KDV]")` satırını sildi. **Doğrulama:** 139 birim testi (3 yeni kilit) + lint + smoke temiz; izole demo DB'de kârlı yıl (24 ay) ve zarar yılı (2 ay) senaryosu, 1440/768/390, koyu+açık tema, 0 console hatası. Panel Net Kâr = tablo Net Kâr (fark **0**) ölçüldü; zararda hero/spark/tile kırmızı, kârda "en zayıf ay" artık kırmızı değil | `public/app.js`, `public/index.html`, `public/styles.css`, `tests/unit/ui-structure.test.js`, `CLAUDE.md`, `PROJE_DURUMU.md` |
| 2026-08-05 | ana asistan | **Dashboard "Kokpit" tasarım turu (yön 1b, kapsam sadece Dashboard):** Claude Design projesi (`0e4fb079…`) okundu; `support.js` yalnızca tasarım tuvali motoru olduğu için koda taşınmadı. Dashboard iki şeride ayrıldı (ana kolon + 320px karar paneli). 4 ana KPI kutusu (Satış/Alış/Net Kâr/Ödenecek KDV) mikro grafik + YoY rozetiyle; kalan 5 sayı ikincil şeritte korundu. Ana sahne net kâr özeti + grafik; Kâr/Zarar tablosuna marj çubuğu; sağ panele veriden üretilen "Şimdi ne yapmalıyım" (satır içi onclick YOK, delege dinleyici). `applyDashboardWidgetConfig` iki şeritli hale getirildi. Ölü kod temizliği: kullanılmayan `profitIcon` değişkeni + `dashProfitIcon`/`dashNetProfitIcon` ikon elemanları. **Doğrulama:** lint temiz, 137 birim testi (1 yeni regresyon kilidi), smoke geçti; izole demo DB (24 ay) ile 1440/768/390 + koyu/açık tema turu, 0 console hatası, sayfa düzeyinde yatay kaydırma yok. Finansal hesap / API / route-auth / tahmin motoru / cari import'a dokunulmadı | `public/index.html`, `public/app.js`, `public/styles.css`, `tests/unit/ui-structure.test.js`, `CLAUDE.md`, `PROJE_DURUMU.md` |
| 2026-07-08 | ana asistan | **Oturum kapanış notu:** Bölüm 11'e "🔜 SONRAKİ OTURUM — buradan başla" bloğu eklendi (öneri: onay modalı focus-trap + Escape; alternatifler: session store, bağımlılık turu, pre_restore.db kararı). Yeni oturum ambiguity'siz devralsın diye | `PROJE_DURUMU.md` |
| 2026-07-08 | ana asistan | **Doküman düzeltme turu:** CLAUDE.md/README.md/PROJE_DURUMU.md güncel koda göre uyumlandı. Migration 001→010, `docs/` içeriği (screenshots+superpowers), dosya satır sayıları, npm audit (20 açık/0 kritik), stale "AÇIK" satırlar ✅ olarak düzeltildi (CSP, formül nötrleme, dedup, jsPDF, gradyan, kâr paydası), git init "bekleyen onay"dan çıkarıldı, Tier 3 davranışları/kararları işlendi. Yalnız doküman; kod dosyalarına dokunulmadı | `CLAUDE.md`, `README.md`, `PROJE_DURUMU.md` |
| 2026-07-08 | ana asistan | **Tier 3 commit + push:** #2 ve #3 iç içe değişiklikleri hunk bazında iki ayrı commit'e ayrıldı (`9754b57` mobil kart, `0b28bea` onay modalı). Toplam orijinalle birebir doğrulandı (268+/29-). GitHub main'e push, CI yeşil (`success`) | `git`, GitHub |
| 2026-07-08 | ana asistan + test-uzmani + kod-inceleyici | **Tier 3 / İş #3 — confirm() → özel onay modalı:** 17 `confirm()` → `showConfirm()` Promise helper + `#confirmModal` iskeleti + `.btn-danger`. Kod inceleyici RET (Enter odaktan bağımsız siliyordu) → düzeltildi (Enter dalı kaldırıldı). Test-uzmani 3 klavye senaryosu + fare GEÇTİ, 0 err. 136 test + lint temiz. Commit `0b28bea`, push + CI yeşil | `public/app.js`, `public/index.html`, `public/styles.css`, `tests/unit/ui-structure.test.js` |
| 2026-07-08 | ana asistan + test-uzmani + kod-inceleyici | **Tier 3 / İş #2 — cari tablosu mobilde kart:** `styles.css`'e `@media(max-width:768px)` kart bloğu + `app.js renderBusinessPartyRows`'a `data-label`/`bp-cell-name`. Masaüstü tablo korundu. Regresyon kilidi testi. İzole QA 390/768/1440 GEÇTİ (0 err), kod inceleyici ONAY. Commit `9754b57`, push + CI yeşil | `public/app.js`, `public/styles.css`, `tests/unit/ui-structure.test.js` |
| 2026-07-08 | ana asistan | **Kullanıcı testi + hata düzeltme turu:** izole demo DB'de 58 HTTP + 10 yazma testi + 2 UI/UX ajanı. 6 gerçek bug düzeltildi (PDF export 500, showSuccess ×10, dashboard yükleme mesajı, sürükle-bırak sızıntısı, mobil buton 44px, empty-icon). 134 test + lint temiz, PDF canlı doğrulandı | `server.js`, `public/app.js`, `public/index.html`, `public/styles.css` |
| 2026-07-07 | ana asistan | **Doküman turu:** README profesyonel yeniden düzen (iç günlükler CHANGELOG.md'ye taşındı), CHANGELOG.md + LICENSE (ISC) eklendi, .env.example eksik değişkenler + doğru default'lar, CLAUDE.md durum bölümü güncellendi. Cari geçmiş davranışı belgelendi | `README.md`, `CHANGELOG.md`, `LICENSE`, `.env.example`, `CLAUDE.md`, `PROJE_DURUMU.md` |
| 2026-07-07 | ana asistan | **Sürüm kontrolü:** git init (main) + ilk commit + private GitHub deposu (github.com/ademtfkc/analizcim) push. Commit öncesi sır/veri sızıntı denetimi yapıldı (temiz) | `.git`, GitHub |
| 2026-07-07 | ana asistan | **Geliştirme turu:** dedup, export formül nötrleme, 10 hata sızıntısı, /health, CSP+güvenlik başlıkları, kâr oranı paydası, escape, jsPDF 4.2.1 + kırık PDF export düzeltmesi, gradyan kaldırma. 134 birim test geçti, canlı health+CSP+PDF doğrulandı | `analyzer.js`, `validators.js`, `server.js`, `public/app.js`, `public/styles.css`, `package.json`, +2 yeni test |
| 2026-07-07 | ana asistan | **Grup 4 (bağımlılık) değerlendirildi:** güvenli fix yok; `--force` sqlite3@6 (kırıcı) istiyor. Canlıyı korumak için değişiklik YAPILMADI, karar+öneri raporlandı | (inceleme) |
| 2026-07-07 | ana asistan | **Grup 3 (sertleştirme):** session `sameSite`, girişte `regenerate()`, login limiti 200→10, hata sızıntısı kapatıldı. auth 7/7, rate-limiter testi güncellendi, lint temiz | `server.js`, `routes/auth.js`, `middleware/rate-limiters.js`, rate-limiter testi |
| 2026-07-07 | ana asistan | **Brüt Kâr KDV hariç yapıldı** (Grup 2 ana madde): 4 hesap noktası + migration 010 ile geçmiş 20 kayıt yeniden hesaplandı (6.11M→5.11M KDV hariç). Canlı DB önce yedeklendi. Tests + testler güncellendi, 96/96 geçti | `analyzer.js`, `storage.js`, `server.js`, `migrations/010_*`, 3 test |
| 2026-07-07 | ana asistan | **Grup 2 (temiz fix'ler):** parseNumber parantezli negatif; predictor yetersiz-veri eksik alanları; %Infinity sıfıra bölme koruması. parseNumber 9/9, analyzer+predictor 95/95 geçti | `analyzer.js`, `predictor.js` |
| 2026-07-07 | ana asistan | **Grup 1 (güvenlik) düzeltildi:** backup ucuna requireAdmin; 5 uca userId; storage `||1` yerine hata. Lint temiz, alan testleri 103/103 geçti | `routes/backups.js`, `server.js`, `storage.js` |
| 2026-07-07 | 4 denetim ajanı | Derin kod denetimi tamamlandı; 3 kritik (backup ucu, IDOR, KDV'li brüt kâr) ana asistan tarafından kodda bizzat doğrulandı | (okuma) |
| 2026-07-07 | ana asistan | Onaylı silme: `cookies.txt` + 9 `.DS_Store` kalıcı silindi | (silindi) |
| 2026-07-07 | ana asistan | `PROJE_DURUMU.md` sıfırdan oluşturuldu (ortak hafıza kuruldu) | `PROJE_DURUMU.md` |
| 2026-07-07 | ana asistan | `.gitignore` güçlendirildi (cookies.txt, araç klasörleri, yedek/temp eklendi) | `.gitignore` |
| 2026-07-07 | ana asistan | `openapi.json` kök dizinden `docs/` altına taşındı (referanssız, güvenli) | `openapi.json → docs/openapi.json` |
| 2026-07-07 | ana asistan | Yapı + güvenlik koklama taraması yapıldı; 4 derin denetim ajanı başlatıldı | (okuma) |

## 13. Arşiv 🗃️
- _(boş)_
