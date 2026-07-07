# Değişiklik Günlüğü (CHANGELOG)

Bu dosya, Analizcim'in geliştirme turlarını ve önemli değişiklikleri en yeniden eskiye doğru listeler.
Ürün ve kurulum bilgisi için [README.md](README.md), ekibin ortak hafızası için `PROJE_DURUMU.md`.

---

## 2026-07-08 — Kullanıcı testi ve hata düzeltmeleri

Gerçek kullanıcı gibi kapsamlı test (izole demo DB üzerinde 58 HTTP + 10 yazma testi) ve iki uzman
UI/UX incelemesi yapıldı. Bulunan 6 gerçek sorun düzeltildi:

- **PDF dışa aktarma (geçmiş + analiz) 500 hatası** düzeltildi: `doc.save(res)` sunucuda geçersizdi;
  çalışan dashboard deseniyle (`res.send(Buffer.from(doc.output('arraybuffer')))`) değiştirildi.
  (3 PDF ucu da artık geçerli PDF üretiyor.)
- **`showSuccess` tanımsız (10 çağrı)**: Geçmiş/Çöp/Arşiv işlemleri başarılı olsa da ekranda yanlış
  "hata oluştu" gösteriyor ve liste yenilenmiyordu → `showSuccessToast` ile düzeltildi.
- **Dashboard yükleme mesajı**: Panele her girişte yanlışlıkla "Dosyalar analiz ediliyor..." çıkıyordu;
  `showLoading`'e mesaj parametresi eklendi ("Panel yükleniyor", "PDF hazırlanıyor", "Kayıt açılıyor").
- **Tahmin sürükle-bırak dinleyici sızıntısı**: filtre/sekme değişiminde kart taşıma bozuluyordu;
  idempotent bağlama (`removeEventListener` + `addEventListener`) ile düzeltildi.
- **Mobil menü butonu** dokunma alanı 36→44px (erişilebilirlik asgarisi).
- **`.empty-icon`** içindeki gizli ham kelimeler (`Boş`/`Arşiv` vb.) temizlendi (gelecekteki görünme riski).

Doğrulama: 134 birim testi geçti, lint temiz, 3 PDF ucu canlı curl ile doğrulandı. (Ertelenen: tahmin
"layout" ölü kodu — zararsız no-op, çalışan sıra özelliğini riske atmamak için dokunulmadı.)

## 2026-07-07 — Güvenlik, finansal doğruluk ve kalite turu

**Güvenlik:**
- Yedek indirme ucu (`GET /api/backup`) artık yalnızca admin (önceden her kullanıcı tüm DB'yi indirebiliyordu).
- IDOR düzeltmesi: 5 dışa aktarma/karşılaştırma ucu artık kullanıcı kimliğini geçiriyor; `storage`
  sessizce kullanıcı 1'e düşmüyor (eksikse hata fırlatıyor).
- Oturum sertleştirme: `sameSite`, girişte `session.regenerate()`, login deneme limiti 200 → 10.
- Güvenlik başlıkları eklendi: CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- Dışa aktarımda (Excel) formül enjeksiyonu nötrlendi (`=,+,-,@`).
- Hata mesajı hijyeni: iç hata detayı yalnız log'a, kullanıcıya genel mesaj.
- Eksik `/health` ve `/api/health` public uçları eklendi.
- Çoklu dosya yüklemede içerik-hash bazlı mükerrer dosya koruması.

**Finansal doğruluk:**
- **Brüt Kâr artık KDV hariç hesaplanıyor** (KDV geçiş kalemidir). 4 hesap noktası düzeltildi ve
  geçmiş kayıtlar `migration 010` ile yeniden hesaplandı (işlem öncesi DB yedeği alındı).
- Kâr oranı yüzdesinin paydası satış (ciro) yapıldı — kod tabanının geri kalanıyla tutarlı.
- `parseNumber` artık parantezli/sondaki-eksi negatif formatları (`(1.234,56)`) doğru okur; satırlar
  sessizce kaybolmaz.
- Tahmin motorunda yetersiz-veri dalındaki eksik response alanları ve "%Infinity" (sıfıra bölme) düzeltildi.

**Bağımlılık ve diğer:**
- `jsPDF` 4.1.0 → 4.2.1 (kritik açık kapatıldı; `npm audit` kritik sayısı 1 → 0).
- Önceden bozuk olan **PDF dışa aktarma** onarıldı (`autoTable` yanlış çağrılıyordu → `.default`).
- Tasarım kuralına aykırı tek gradyan kaldırıldı; "no gradient" testi yeşile döndü.
- Proje **git** altına alındı ve **private GitHub deposuna** yüklendi.
- Kök dizin temizliği (`cookies.txt`, `.DS_Store` kaldırıldı), `.gitignore` güçlendirildi,
  `PROJE_DURUMU.md` ortak hafıza dosyası kuruldu.

**Doğrulama:** 134 birim testi geçti, lint temiz, canlı `/health` + güvenlik başlıkları + PDF üretimi doğrulandı.

**Not (cari geçmiş verisi):** Cari import yalnızca yeni yüklemede çalışır; geçmiş analizlerin ham işlem
satırları saklanmadığı için (yalnız özet + top-5 karşı taraf tutulur) geçmişi cari'ye katmak orijinal
Excel'lerin yeniden yüklenmesini gerektirir. Bu turda cari koduna/verisine dokunulmadı.

---

## Faz 1.5 — Cari (müşteri/tedarikçi) analizi

- Excel satış/alış satırlarından otomatik müşteri/tedarikçi çıkarımı.
- Ayrı `Müşteriler` ve `Tedarikçiler` sekmeleri; arama, tarih/hacim filtresi, sıralama.
- Cari detay: toplam hacim, net bakiye, son işlem, ortalama tutar, aylık hacim ve 12 ay trend grafiği,
  tam hareket dökümü.
- Dashboard cari widget'ları (müşteri/tedarikçi sayısı, en yüksek hacimliler, son hareket özeti).
- Aynı Excel tekrar yüklendiğinde mükerrer hareket engelleme (benzersiz kaynak anahtarı).
- Karşı taraf eşlemesinde `Cari Ünvanı`, `Müşteri`, `Tedarikçi`, `Açıklama` varyasyonları; cari başlıkları
  açıklama/ürün kolonlarına göre öncelikli.
- Veri modeli: `scripts/migrations/009_create_suppliers_and_party_transactions.js`.

## Tahmin motoru turu

- Tahminler sayfası modern karar destek yüzeyi olarak yenilendi.
- Linear Regresyon, Exponential Smoothing, Holt-Winters ve ARIMA model karşılaştırması.
- ARIMA için `arima@0.2.8` dependency'si (gerçek ARIMA/SARIMA ihtiyacı).
- Otomatik model seçimi RMSE öncelikli; 1/3/6/12 ay horizonları; güven aralığı; model karşılaştırma tablosu.
- Muhasebeci feedback sistemi; Dashboard'a Tahmin Özeti widget'ı.
- Eski response alanları korunup yeni alanlar ek olarak döndürüldü.

## UI / Tema turu

- Sidebar masaüstünde dar rail; açıldığında ~240px overlay panel; simetrik kısa animasyon.
- Overlay/blur hafifletildi; dark/light tema tutarlılığı; finansal pozitif/negatif renk semantiği korundu.
- Admin dropdown okunabilirliği; login/Ayarlar/Geçmiş form alanları tema tokenlarıyla düzeltildi.
- Dashboard KPI iki satırlı 4 kolon SaaS düzeni; Tahminler tablo taşması ve Risk/Senaryo hizalaması düzeltildi.
- Global header kaldırıldı; daha temiz app shell.

---

## Geliştirici notları

- Veri ve hesaplama mantığı korunmalıdır; UI değişikliklerinde veri prop yapısı bozulmamalıdır.
- Yeni dependency dikkatli eklenir (ör. `arima` bilinçli tercihtir).
- Theme-aware class/token yaklaşımı kullanılır; hardcoded koyu renklerden kaçınılır.
- Build/lint/test akışları mümkünse çalıştırılır.

## Güvenli lokal QA çalıştırma

Gerçek `.env`/DB/kullanıcı verisiyle QA yapmamak için izole akış:

```bash
HOST=127.0.0.1 \
PORT=3000 \
TEST_DATABASE_PATH=/private/tmp/analizcim-qa.db \
BOOTSTRAP_ADMIN_USERNAME=qa_admin \
BOOTSTRAP_ADMIN_PASSWORD='kendi-test-parolaniz' \
npm start
```

- Yalnız `127.0.0.1`/`localhost` üzerinde çalışın; gerçek tarayıcı profillerine bağlanmayın (izole Playwright Chromium).
- `.env` istemeden yükleniyorsa test server'ı nötr bir dizinden başlatıp override'ların baskın olduğundan emin olun.
- Playwright browser binary eksikse: `npx @playwright/mcp install-browser chrome-for-testing` veya `npx playwright install chromium`.
