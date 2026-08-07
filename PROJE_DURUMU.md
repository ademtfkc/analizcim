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
| `src/validators.js` | Girdi doğrulama | ~410 |
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
- _(kapandı)_ `data/pre_restore_1771112753452.db` için CEO 2026-08-06'da "kalsın" dedi.
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
| Dev dosyalar (`app.js` ~8360, `styles.css` ~16900, `storage.js` ~2700, `server.js` ~2100) bakımı zorlaştırıyor | Orta | Bu tur BÖLÜNMEYECEK; ileride modülerleştirme önerisi |
| Çift `005` migration adı (kozmetik) | Düşük | Dokunulmaz (bkz. Karar 3) |

## 11. Sonraki Adımlar 👉

### 🔜 SONRAKİ OTURUM — BURADAN BAŞLA

**Önce bunu bil:** 2026-08-07'de bir **sağlamlaştırma turu** yapıldı (CEO odak kararı: görünür yeni
özellik yok, sessiz hataları kapat). Kokpit tasarım turu ve CEO revizyon turu bundan önce bitmişti.
**Hepsi commit edildi.** Aktif iş yok.

| Commit | İş |
|---|---|
| `d4542c2` | Üç sessiz hata (silinen analizin carileri, panel müşteri widget'ı, KDV tuzağı) + ölü tercih anahtarları |
| `f4730b7` | Güvenli bağımlılık yamaları (20 açık → 8) + KDV alan adı hizalaması |

Doğrulama: lint temiz, **179 birim + 36 entegrasyon + 1 smoke** geçiyor. İki denetim ajanı da ONAY
verdi; test-uzmani düzeltmeleri geçici olarak bozup testlerin gerçekten kırıldığını kanıtladı.

⚠️ **GitHub CI ÇALIŞMIYOR (2026-08-07 tespiti).** Son yeşil çalıştırma `7732e4f`; ondan sonraki
`50a109a`, `d4542c2`, `f4730b7`, `9d3e1f3` push'ları için **hiç run oluşmadı**. Elle tetiklenen
rerun 5+ dakika `queued`'da bekledi ve başlamadı. Depo ayarları temiz (`actions/permissions` →
`enabled: true`, workflow `active`, repo arşivlenmemiş), yani kod/ayar sorunu değil — büyük
olasılıkla özel depo için aylık Actions dakikası tükenmiş. Doğrulama şimdilik yerelde yapılıyor.
CEO'nun GitHub faturalandırma/kullanım limitine bakması gerekiyor.

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

**CEO'ya sorulmuş, cevap bekleyen iki soru (Bölüm 8'de de var):**
1. Gerçek bakiye takibi (tahsilat/ödeme kaydı) istenir mi? — kapsam genişlemesi.
2. Eski raporların cari listesine katılması için hangi dönemlerin Excel'i yeniden yüklenecek?

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
