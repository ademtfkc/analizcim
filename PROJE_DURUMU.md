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
- **Durum:** 🔨 Geliştirme / bakım (çalışan uygulama; kalite & düzen turu yapılıyor)
- **Canlı adres:** Yok (lokal çalışır, finansal veri kullanıcının makinesinde kalır)
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
| `public/js/` | Küçük ön yüz modülleri (api, history, notifications, vat-ledger) |
| `public/vendor/` | Dış kütüphane (chart.umd.min.js) |
| `scripts/` | Migration çalıştırıcı + tek seferlik betikler |
| `scripts/migrations/` | Sıralı veritabanı şema değişiklikleri (001…009) |
| `tests/` | `unit/`, `integration/`, `helpers/`, smoke testi |
| `data/` | Yerel SQLite veritabanı + yedekler (git'e girmez) |
| `docs/` | api.md, openapi.json, superpowers |

### Önemli dosyalar
| Dosya | Ne yapar | Satır (kaba) |
|---|---|---|
| `src/server.js` | Express sunucusu, oturum, statik servis, upload, ana rotalar | ~2100 |
| `src/storage.js` | Veri erişim katmanı (SQLite sorguları) | ~2700 |
| `src/predictor.js` | Tahmin motoru: Linear, Exp. Smoothing, Holt-Winters, native ARIMA | ~1550 |
| `src/analyzer.js` | Excel ayrıştırma, satış/alış/KDV/kâr hesabı, cari eşleme | ~1230 |
| `src/validators.js` | Girdi doğrulama | ~410 |
| `src/database.js` | DB bağlantısı ve şema | ~310 |
| `src/backup-manager.js` / `src/archive-manager.js` | Yedekleme / arşiv (soft-delete) | ~290 / ~270 |
| `public/app.js` | TÜM ön yüz mantığı tek dosyada | ~8360 |
| `public/styles.css` | TÜM stiller tek dosyada | ~16900 |
| `public/index.html` | Ana uygulama iskeleti | ~2380 |

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

## 8. Bekleyen Onaylar 🚦
- **`data/pre_restore_1771112753452.db`** (Şubat'tan kalma eski geri-yükleme yedeği, ~270KB) —
  silinsin mi, kalsın mı? Veri olduğu için onay bekliyor.
- **`git init` önerisi:** Proje sürüm kontrolü altında değil. "Gerçek app" için önerilir;
  önce `.gitignore` güçlendirildi (sır/veri sızmaz). CEO onayı ile başlatılabilir.

## 9. Devam Eden İşler 🔨
| İş | Kim | Durum |
|---|---|---|
| Derin kod denetimi (backend, adversarial güvenlik, frontend, iş mantığı) | 4 uzman ajan | ✅ TAMAM (2026-07-07). Backend+güvenlik: RET · Finansal: RET · Frontend: ONAY |
| Kritik/yüksek bulguların düzeltilmesi | (CEO onayı bekliyor) | Karar aşamasında |

## 10. Bilinen Sorunlar 🐞
| Sorun | Ciddiyet | Durum |
|---|---|---|
| **`GET /api/backup` (backups.js:25) `requireAdmin` YOK** → her kullanıcı tüm DB'yi indirebiliyordu | **KRİTİK** | ✅ DÜZELTİLDİ (2026-07-07, `requireAdmin` eklendi) |
| **IDOR: `storage.js:286` `userId \|\| 1` + 5 uçta `userId` eksik** (907, 950, 1009, 1446, 1582) | **YÜKSEK** | ✅ DÜZELTİLDİ (5 uca `userId` eklendi + `||1` yerine hata fırlatma). Testler geçti |
| `ui-structure.test.js` "no gradient" testi düşüyor — `styles.css:16821` tek `linear-gradient` (ÖNCEDEN bozuk, benim değişikliğimle ilgisiz) | Düşük | Tasarım kuralı; CEO görüşü bekliyor (kapsam dışı) |
| `xlsx@0.18.5` bilinen açık (Prototype Pollution + ReDoS), npm'de düzeltme yok | Yüksek | Denetim bulgusu; sürüm yükseltme/izolasyon önerisi |
| Oturum sertleştirme: `sameSite`, girişte `regenerate()`, login limiti 200→10 | Orta | ✅ DÜZELTİLDİ (Grup 3). auth 7/7, rate-limiter testi güncellendi. (Kalan: MemoryStore teknik borç) |
| Hata mesajı sızıntısı (merkezi middleware + dashboard-range) | Orta | ✅ DÜZELTİLDİ (detay log'a, kullanıcıya genel mesaj). Kalan ~11 `err.message` noktası düşük öncelik |
| Excel/CSV dışa aktarımında formül enjeksiyonu (`=`,`+`,`-`,`@` nötrlenmiyor) | Orta→Düşük | AÇIK — IDOR düzeltmesi sonrası risk azaldı (tek kullanıcı kendi verisini export eder); takip maddesi |
| DEPS: 21 açık (1 kritik/10 yüksek). `xlsx` npm'de fix YOK; gerisi `--force` + kırıcı `sqlite3@6` istiyor | Yüksek | KARAR: canlıyı kırmamak için ŞİMDİLİK bağımlılık değiştirilmedi. Gerçek risk düşük (lokal, tek kullanıcı, kendi dosyaları). Mitigasyon: 10MB upload limiti mevcut. Bkz. Karar/Öneri |
| **FİNANSAL: Brüt Kâr KDV DAHİL hesaplanıyordu** → ana kâr KPI'ı KDV kadar şişikti | **KRİTİK** | ✅ DÜZELTİLDİ (2026-07-07). KDV hariç: `calculateSummary`, `getMonthlyProfitLoss` (satır 2555), YoY (`server.js:1486`), `computeAndSaveSummary`. Geçmiş 20 kayıt migration 010 ile yeniden hesaplandı (6.11M→5.11M). Yedek: `data/backups/pre_vat_fix_*.db`. 96/96 test geçti |
| FİNANSAL: `parseNumber` parantezli negatif `(1.234,56)` → 0, satır sessizce kayboluyordu | Yüksek | ✅ DÜZELTİLDİ (parantez+sondaki eksi negatif olarak parse ediliyor, 9/9 kanıt) |
| FİNANSAL: `predictor.js` yetersiz-veri dalında korunması gereken alanlar `undefined` | Yüksek | ✅ DÜZELTİLDİ (confidenceBands/purchase/profit/netProfit/businessStats eklendi) |
| FİNANSAL: son ay 0 ise CEO özetinde "%Infinity" (`predictor.js:880`) | Orta | ✅ DÜZELTİLDİ (sıfıra bölme koruması) |
| FİNANSAL: çoklu dosya birleştirmede mükerrer kontrolü yok (`analyzer.js`) → aynı dosya 2 kez = toplam 2 katı | Orta-Yüksek | AÇIK — Grup 2 kalan; dosya-hash bazlı güvenli dedup önerilir (satır-bazlı riskli) |
| FİNANSAL (minör): kâr oranı % paydası `total_purchases` (KDV dahil) — etiket/payda netleştirilmeli | Düşük | AÇIK — denetim önerisi |
| DEPS: `jsPDF ≤4.2.0` KRİTİK açık (düzeltme yok), sunucu PDF üretiminde aktif | Yüksek | `npm audit`: toplam 18 açık (1 kritik/9 yüksek) |
| FRONTEND: 3 farklı escape fonksiyonu karışık + `escapeAttribute` yanlış bağlamda (bugün sömürülemez, ID'ler tamsayı) | Düşük-Orta | Frontend ONAY verdi; backlog |
| FRONTEND: CSP (Content-Security-Policy) başlığı hiç yok | Düşük | Savunma derinliği önerisi |
| SQL enjeksiyon: **temiz** — kolon/sıralama beyaz liste, değerler parametreli | ✅ | Doğrulandı (ilk şüphe kapandı) |
| İstemci kimlik: **güvenli** — httpOnly çerez, localStorage'da token/şifre yok | ✅ | Frontend denetimi doğruladı |
| Dev dosyalar (`app.js` ~8360, `styles.css` ~16900, `storage.js` ~2700, `server.js` ~2100) bakımı zorlaştırıyor | Orta | Bu tur BÖLÜNMEYECEK; ileride modülerleştirme önerisi |
| Çift `005` migration adı (kozmetik) | Düşük | Dokunulmaz (bkz. Karar 3) |

## 11. Sonraki Adımlar 👉
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

**Kalan (ertelendi):**
- Bağımlılık: `xlsx` (npm fix yok), `sqlite3@6` (kırıcı) — çok kullanıcılı/ağ senaryosunda ayrı tur. dompurify (jsPDF transitive) aktif değil (`.html()` kullanılmıyor).
- MemoryStore → kalıcı session store (teknik borç, yeni bağımlılık).
- Büyük frontend refactor (inline onclick → addEventListener; CSP `'unsafe-inline'` kaldırılabilsin).

---

## 12. İşlem Günlüğü 📓 (Tamamlanan İşler)
| Tarih | Ajan | Ne yapıldı | Dokunulan dosyalar |
|---|---|---|---|
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
