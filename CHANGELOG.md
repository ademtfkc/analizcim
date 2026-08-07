# Değişiklik Günlüğü (CHANGELOG)

Bu dosya, Analizcim'in geliştirme turlarını ve önemli değişiklikleri en yeniden eskiye doğru listeler.
Ürün ve kurulum bilgisi için [README.md](README.md), ekibin ortak hafızası için `PROJE_DURUMU.md`.

---

## 2026-08-07 — Tarayıcı görsel denetim turu (18 bulgu, A/B/C grupları)

Uygulama gerçek verinin bir kopyası üzerinde izole tarayıcıda baştan sona gezildi; 18 bulgu çıktı ve
üç grup halinde kapatıldı. Grup A ve B ayrı commit'lerde (`406400b`, `af9fb51`); aşağıdaki C grubu ve
denetim ajanlarının bulguları bu turun son commit'indedir.

### C grubu — hizalama ve mobil

1. **Geçmiş filtre satırı mobilde kullanılamıyordu (KRİTİK).** `renderHistory()` içindeki
   `filtersEl.style.display = 'flex'` satır içi stili hiçbir `@media` kuralından ezilemediği için
   mobil tek-kolon düzeni **hiç devreye giremiyordu**; 390px'te sekiz kutu ~35 piksele sıkışıyordu.
   Görünürlük artık `is-hidden` sınıfıyla yönetilir (`.history-filters.is-hidden { display: none }`,
   özgüllük 0,2,0 — `!important` gerekmedi). Yeni bir görünürlük kodu yazan herkes satır içi
   `style.display` yerine sınıf kullanmalıdır; regresyon testi bunu kilitler.
2. **Kontrol yükseklikleri.** Geçmiş filtre satırındaki kutular 53/46/38/26/19 piksel arasında
   değişiyordu; hepsi 46 piksele ve aynı taban çizgisine getirildi, satır içi `width:120px` kaldırıldı,
   `.history-header-actions` mobilde 2 kolon × 44 piksele geçti.
3. **Rozetler kelime ortasından bölünüyordu** ("Yükse / k"). `.risk-factor-severity`,
   `.action-priority`, `.missing-area-severity`, `.action-category` → `white-space: nowrap` +
   `flex-shrink: 0`.
4. **Kırpılan metinler.** Tahminler yönetici özeti `-webkit-line-clamp: 2` yüzünden yalnız yasal
   uyarıyı gösteriyor, asıl tahmin tutarını ve brüt kârı gizliyordu → kırpma kaldırıldı. "En Çok"
   sayfasında firma unvanları 253 pikselde `...` ile kesiliyordu → satıra bölünüyor.
5. **Yıl Karşılaştırma filtre alanı.** `.compare-year-card` çerçevesi kaldırıldı (iç boşluk olmadığı
   için "Birinci Yıl" etiketi kenarlığa yapışıktı); `.year-select-large` ve `.compare-vs-badge` kokpit
   ölçü sistemine (`--control-height`) bağlandı — seçici 56px iken buton 38px'ti, artık üçü de aynı.
   Dokunmatik 44 piksel listesine de eklendi.
6. **Panelde iki liste aynı adı taşıyordu.** "Faturalardan Gelen Son 5 Cari" (fatura kaynaklı) ve
   "Elle Eklenen Son 5 Müşteri" (manuel CRUD) olarak ayrıştırıldı. Tıklanamayan isimler `recent-link-btn`
   bağlantı sınıfını kullandığı için koyu temada `#737373` ile okunmuyordu → `recent-plain-name`.
7. **Ayarlar'daki "Veritabanı Boyutu" kutusu hep boştu.** Yeni `GET /api/admin/db-size`
   (`requireAdmin`; yalnız bayt döner, dosya yolu dönmez) + `loadAdminDbSize()`. Footer yılı elle
   yazılmıştı → `#footerYear`.
8. **Sekme değişiminde sayfa başa kaydırılıyor.**

### Yüzde biçimi kaçakları

2026-08-07'de kurulan "tek Türkçe yüzde biçimi" kuralı iki katmana uygulanmamıştı:

- **Tahmin motoru (`src/predictor.js`).** Cümle içine gömülen yüzdeler `%33.1` yazıyordu → yeni
  `formatPercentText(deger, ondalik)` yardımcısı. **Sayısal API alanları Number kalmaya devam eder**;
  yalnız metin üretimi değişti, şema kırılmadı.
- **Ön yüz (`public/app.js`).** `%${...toFixed(n)}` deseninden 10 kaçak vardı (Pareto özeti ve grafik
  ipucu, kâr/zarar yüzdesi, aykırı değer sapması, cari karar panelindeki "İlk 3", gider karar
  panelindeki dört cümle). Hepsi `formatPercent`'e bağlandı; kodda o desenden sıfır tane kaldı.

### Test edilebilirlik

- **Yıl karşılaştırmasının "ortak ay" hesabı saf modüle taşındı:** `src/compare-metrics.js` →
  `buildComparableSummary(y1, y2)`. Veritabanı ve oturum gerektirmez, 5 gerçek sayı senaryosuyla
  test edilir (`tests/unit/compare-metrics.test.js`). Emsali `public/js/dashboard-metrics.js`.
  Davranış korundu: canlı uçtan ölçüldü — ortak 6 ay, satış +%32,5, kâr +%130,8.
- `GET /api/admin/db-size` için 401 / 403 / 200 entegrasyon testi.

**Kalite kapısı iki tur döndü.** kod-inceleyici ilk turda RET verdi (yeni admin ucu testsiz, ortak-ay
hesabı yalnız regex ile doğrulanıyor); test-uzmani ilk turda RET verdi (yukarıdaki 1 numaralı kritik
hata ve Pareto yüzdesi). Hepsi kapatıldıktan sonra ikisi de ONAY verdi; her iki ajan da düzeltmeleri
geçici olarak bozup testlerin gerçekten kırıldığını bağımsız kanıtladı.

**Doğrulama:** lint temiz, **207 birim + 38 entegrasyon + 1 smoke**. Dokuz sekme × (1440 + 768 + 390) ×
(koyu + açık): 0 konsol hatası, sayfa düzeyinde 0 yatay kaydırma.

---

## 2026-08-07 — Denetim raporu düzeltmeleri (9 madde)

Depo + ekran görüntüsü denetiminde bulunan bulgular CEO onayıyla sırayla kapatıldı.

1. **Kenar çubuğundaki beyaz çerçeve.** Koyu temada `--sidebar-border` değeri `#ffffff` idi; kullanıcı
   kartının etrafında bembeyaz bir kutu çiziyordu. Dört yerde (iki token tanımı + iki yedek değer)
   `#2e2e2e` yapıldı. 8 ekran görüntüsünün hepsinde görünen kusurdu.
2. **Renk disiplini geri kazandırıldı.** `NUMERIC_COLOR_SELECTOR` 25 seçiciden 9'a indi. Artık yalnız
   finansal **sonuç** taşıyan değerler renklenir (kâr/zarar, fark, marj, KDV sonucu, büyüme, trend).
   Hacim, ciro, alış tutarı, gider tutarı ve sayaçlar nötr kalır — alış tutarının yeşil görünmesi
   "iyi haber" yanılsaması üretiyordu. `.sales`/`.purchase`/`.expense` modifikatörleri `:not()` ile
   dışarıda bırakıldı. Ölü seçiciler (`.compare-table td`, `.scenarios-table td`) da temizlendi;
   tahmin tablosunun anlamlı renkleri kendi `text-success`/`text-danger` sınıflarından gelmeye devam eder.
3. **Tahmin kartı harfleri düzeltildi.** `B) Trend` karttan önce `A) Tahmin` geliyordu ve E/G/H/I
   harfleri ikişer kez kullanılmıştı. 13 kart HTML sırasına göre **A–M** olarak yeniden harflendi.
4. **Gider sayfasındaki tekrar kaldırıldı.** Dönem şeridi ile özet kartları aynı Sabit/Değişken
   rakamlarını gösteriyordu. Şerit artık yalnız dönem kimliği + Toplam Gider taşır.
5. **"Son 12 Ay" gerçekten 12 takvim ayı.** `monthly.slice(-12)` son 12 **kaydı** alıyordu; boş aylar
   varsa pencere 14 takvim ayına yayılıyordu. Yeni `storage.buildLastTwelveMonthsTrend()` son hareketli
   aydan geriye 12 ardışık ay üretir, hareketsiz ayları 0 ile doldurur, tarihsiz satırları dışarıda
   bırakır. 4 yeni birim testi (`tests/unit/storage-party-trend.test.js`).
6. **Cari ekranlarındaki çift gösterim kaldırıldı.** "Fatura Toplamı" kolonu ile "İşlem Hacmi",
   "Net Fatura Tutarı" kutusu ile "Toplam Hacim" birebir aynı sayıydı (bakiye = hacim, çünkü bir cari
   ya hep satış ya hep alış hareketi taşır). Yerlerine bilgi taşıyan **Ortalama İşlem** kolonu ve
   **Son 12 Ay Hacmi** kutusu geldi.
7. **Tek yüzde biçimi.** `%12,34` ile `12,3%` yan yana kullanılıyordu. Yeni `formatPercentSigned()`
   ile altı çağrı yeri Türkçe yazıma çekildi (`+%12,3`).
8. **Madalya renkleri temaya bağlandı.** Sabit `#FFD700/#C0C0C0/#CD7F32` yerine `--rank-gold`,
   `--rank-silver`, `--rank-bronze` tokenları (koyu ve açık tema için ayrı ton). Çift tanımlı
   `.topn-table .amount-cell` kuralı tek kurala birleştirildi.
9. **Belge tutarlılığı.** `package.json` jsPDF aralığı `^4.1.0` → `^4.2.1` (kurulu sürüm zaten 4.2.1'di;
   kilit dosyası yalnız bu satır için güncellendi, paket sürümü değişmedi). README'deki müşteri görseli
   hangi katmanı gösterdiğini söyleyen bir alt yazıyla netleştirildi.

**Kalite kapısında eklenen üç düzeltme:**

- Test uzmanı iki yüzde kaçağı yakaladı: Finansal Sağlık kartları (`'%' + val.toFixed(1)`) ve
  Kâr/Zarar tablosunun marj hücresi (`value + '%'`) hâlâ eski yazımdaydı. İkisi de `formatPercent()`
  kullanıyor; "tek yüzde biçimi" kuralı artık istisnasız.
- Kod inceleyici RET verdi: yeni test dosyası veritabanı bağlantısını kapatmadan geçici dosyayı
  siliyordu. Kapatmayı eklemek tek başına yetmedi — `src/database` require anında şema + migration
  zincirini **asenkron** başlatıyor, saf fonksiyon testleri o zincirden önce bitiyor ve handle
  zincirin ortasında kapanıyordu (`SQLITE_MISUSE`). Çözüm: `after()` önce `migrations` tablosundaki
  kayıt sayısı `scripts/migrations` altındaki dosya sayısına ulaşana kadar bekler, sonra kapatır ve
  siler. **`npm run verify` bu düzeltmeden önce hiç bitmiyordu, artık sonuna kadar çalışıyor.**
- `.dashboard-pl-value:not(...)` seçicisi bilinçli olarak korundu: `index.html` bu sınıfı çıplak
  taşıyor, sınıf modifikatörünü ancak veri geldiğinde JavaScript yazıyor.

**Doğrulama:** `npm run verify` yeşil — **183 birim + 37 entegrasyon + 1 smoke**, lint temiz.
İzole tarayıcı QA'sında 9 maddenin tamamı koyu/açık temada ve 1440/390 viewport'ta doğrulandı,
0 console hatası.

**Dokunulmayanlar:** backend finansal formüller, API şeması, route/auth, tahmin motoru, cari import
akışı, manuel müşteri CRUD ve `customers.balance` alanı, sabit tahmin kart düzeni.

---

## 2026-08-07 — Sahipsiz cari hareketi süzgeci (CEO "A" kararı)

- **Sorun:** bir analiz çöpten *kalıcı* silindiğinde `party_transactions` satırları geride kalıyordu.
  Süzgeç yalnız "kaynağı var ama çöpe atılmış" satırları eliyordu; kaynağı hiç kalmayan satır canlı
  sayılıyor, cari listesini ve panel sayaçlarını şişiriyordu (gerçek veritabanında 118 satır,
  Haziran 2026 hacmi yaklaşık üç katı görünüyordu).
- **Düzeltme:** `storage.livePartyTransactionCondition()` yeniden yazıldı. Bir satır artık ancak
  `source_history_id IS NULL` ise (cari import öncesi yazılmış eski satırlar) **veya** bağlı olduğu
  `analyses` satırı duruyor ve soft-delete edilmemişse canlı sayılır. Süzgeci kullanan altı sorgunun
  tamamı otomatik faydalanır.
- **Hiçbir satır silinmedi.** Sahipsiz satırlar diskte duruyor, yalnız hiçbir ekranda görünmüyor
  (veri silme CEO onay kapısıdır).
- Yeni entegrasyon testi: "permanently deleted analysis leaves no orphan party rows in list or
  summary". Düzeltme geçici olarak geri alınıp testin gerçekten kırıldığı kanıtlandı.
- Doğrulama: lint temiz, 179 birim + 37 entegrasyon + 1 smoke testi geçti. kod-inceleyici onayladı.

---

## 2026-08-07 — CI bakımı + cari kapsam denetimi (kod dosyasına dokunulmadı)

- **GitHub Actions sürümleri yükseltildi:** `actions/checkout@v4` → `@v7`, `actions/setup-node@v4` →
  `@v7`. Eski sürümler Node.js 20 tabanlıydı ve her koşuda emeklilik uyarısı basıyordu. Yükseltme
  yalnız koşucu runtime'ını değiştirir; kullanılan girdiler (`node-version: 22.x`, `cache: npm`) aynı
  kaldı. Sonuç: koşu 25 saniyede yeşil, uyarı (annotation) sayısı 0.
- **Önceki turun "CI çalışmıyor, muhtemelen Actions kotası bitti" tespiti yanlış çıktı.** Bugünkü iki
  push'ta koşu anında kuyruğa girdi ve yeşil döndü. Kota/faturalandırma sorunu yok; ilgili uyarı
  `PROJE_DURUMU.md`'den kaldırıldı.
- **Eski dönem Excel'leri işi bloke.** Gerçek veritabanı salt okunur incelendi: 15 dönemin
  (Ocak–Aralık 2025 ve Ocak–Mart 2026) cari hareketi yok; Nisan/Mayıs/Haziran 2026 dolu. Kaynak
  `.xlsx` dosyaları bu bilgisayarda bulunmuyor ve `analyses.sales_json` satır bazlı karşı taraf/tarih
  saklamadığı için veritabanı üzerinden geri doldurma teknik olarak imkânsız. CEO dosyaları verene
  kadar bekliyor.
- **Yeni hata tespit edildi (henüz düzeltilmedi):** çöpten *kalıcı* silinen bir analizin
  `party_transactions` satırları sahipsiz kalıyor ve cari listesinde sayılmaya devam ediyor.
  `livePartyTransactionCondition()` yalnız "kaynağı var ama soft-delete edilmiş" satırları eler.
  Gerçek veritabanında 118 sahipsiz satır ölçüldü (Haziran 2026). Detay ve önerilen koşul:
  `PROJE_DURUMU.md` Bölüm 10.

---

## 2026-08-07 — README vitrin turu (yalnızca doküman + görsel)

CEO isteği: "GitHub'daki README daha görsel ve albenili olsun." Hiçbir kod dosyasına dokunulmadı.

- **Yedi yeni ekran görüntüsü.** Eski üç görsel 7 Temmuz tarihliydi ve Kokpit öncesi arayüzü
  gösteriyordu; ayrıca tam sayfa çekildikleri için (ör. 2880×8318 piksel) GitHub'da okunmaz bir
  şeride dönüşüyorlardı. Hepsi ekran dolusu (1440×900, koyu tema) yeniden çekildi ve dört yeni
  ekran eklendi: Yıl Karşılaştırma, Gider, En Çok, cari detay. Toplam boyut 2,7 MB'tan 1,2 MB'a indi.
- **README yeniden düzenlendi:** vitrin başlık + rozet satırı, 3 adımlı `mermaid` akış şeması,
  ikonlu özellik tablosu ve her ekranın kendi açıklamasıyla **doğrudan görünen** görselleri
  (katlanır `<details>` bölümleri kaldırıldı, CEO kararı). Bilgi taşıyan hiçbir bölüm silinmedi.
- **Bayat bölüm düzeltildi:** README hâlâ eski iki satırlı KPI düzenini ("Sıra 1 … Sıra 2 …")
  anlatıyordu. Koddaki gerçek düzenle değiştirildi: 4 ana kutu (Satış · Alış · Net Kâr · Ödenecek
  KDV) + ikincil şerit, ve KDV kutusunda neden yıllık değişim rozeti olmadığının gerekçesi.
- **Görseller demo veriyle üretildi.** Gerçek `data/analiz.db` ve gerçek `.env` kullanılmadı;
  izole bir QA sunucusu, geçici veritabanı ve uydurma firma adlarıyla 24 aylık veri üretildi.
  Her görselin üstünde kırmızı "DEMO VERİ" bandı vardır; geçici veritabanı iş sonunda silindi.
- Doğrulama: lint temiz, 179 birim + 36 entegrasyon + 1 smoke testi geçti (kod değişmediğinin kanıtı),
  README'deki tüm iç bağlantı çapaları ve görsel yolları tarandı.

---

## 2026-08-07 — Sağlamlaştırma turu

CEO odak kararı: görünür yeni özellik yok. Belgede yazılı ama hiç kapatılmamış sessiz hatalar
kapatıldı, ölü ayarlar temizlendi, dış kütüphane açıkları güvenli sınırlar içinde azaltıldı.

**Düzeltilen sessiz hatalar**

- **Silinen analizin cari hareketleri listede kalıyordu.** Bir analiz silindiğinde (soft-delete)
  o analizden gelen fatura satırları cari listesinde, cari detayında ve panel widget'larında
  durmaya devam ediyordu; rakamlar şişik kalıyordu. `storage.livePartyTransactionCondition()`
  yardımcısı yazıldı ve `party_transactions`'a dokunan 6 sorgunun tamamına uygulandı — böylece
  ileride yeni bir sorgu eklenirse süzgeç unutulamaz. `INNER JOIN` yerine `NOT EXISTS` seçildi:
  `source_history_id` alanı `NULL` olan eski satırlar (ve kaydı bulunmayan id'ler) hayatta kalır.
- **Panelin "En Yüksek Bakiyeli Müşteri" kutusu Excel carileri için hep boştu.** Kutu manuel
  girilen `customers.balance` alanından besleniyordu; Excel'den otomatik oluşan carilerde bu alan
  hep `0`. Artık cari sayfasıyla aynı dili konuşuyor: fatura hacmi, etiket **"En Yüksek Fatura
  Hacimli Müşteri"**. Manuel müşteri CRUD akışı ve `customers.balance` alanı korundu.
- **`dashTotalCustomers` sayacının iki yazıcısı vardı** (manuel müşteri özeti + cari özeti);
  hangisi sonra dönerse o kazanıyordu. Tek yazıcıya indirildi.
- **Cari detayındaki sabit yeşil/kırmızı renk kaldırıldı.** `balance = satış hacmi − alış hacmi`
  ve bir cari ya hep satış ya hep alış hareketi taşıdığı için işaret carinin türüne göre sabitti;
  renk bilgi taşımıyor, "borç/alacak" yanılsaması üretiyordu. 2026-08-06 etiket dürüstlüğü
  kararının kalan ayağı.
- **`getMonthlyTotals` KDV tuzağı azaltıldı.** Fonksiyon `sales`/`purchases` dizilerini KDV
  **dahil**, KDV'yi ise satış+alış birleşik tek `vat` dizisinde döndürüyor; yeni bir tüketici
  `sales - purchases` yazsa 2026-07-07'de kapatılan finansal hata geri gelirdi. Dönüşe `salesVat`
  ve `purchasesVat` dizileri **eklendi** (mevcut alanlar birebir aynı kaldı) ve fonksiyon başına
  tuzağı anlatan bir uyarı yazıldı. `getMonthlyTotalsInRange` ile paylaşılan ~60 satır kopya kod
  tek yere indi.

**Temizlik**

- Tahminler sayfası sabit düzene geçtiğinde (2026-08-06) anlamsızlaşan `predictions_layout_id` ve
  `predictions_card_order` tercih anahtarları allowlist'ten, varsayılan okuma listesinden ve
  taşıma ucundan çıkarıldı. Veritabanındaki eski satırlar **bilerek silinmedi**.
- `public/styles.css`'ten üç ölü cari renk kuralı silindi.

**Bağımlılıklar**

- `npm audit fix` (**`--force` kullanılmadı**): **20 açık → 8**. `package.json` değişmedi; yalnız
  `package-lock.json` minor/patch yükseltmeler aldı (express 4.22.2, qs 6.15.3, dompurify 3.4.13,
  express-rate-limit 8.6.2, ajv, body-parser, minimatch, js-yaml, flatted, ip-address vb.).
- Kalan 8 açığın 1'i kritik: `tar` ← `node-gyp` ← `sqlite3` derleme zinciri. Bu açık **bu turda
  eklenmedi**, önceden de vardı; yalnız `npm install` sırasında native binding derlenirken çalışır,
  çalışan sunucu tetiklemez. Kapatmak `sqlite3@6` (kırıcı büyük sürüm) ister — ayrı tur.
- `xlsx` için npm'de hâlâ yama yok. Mitigasyon aynı: lokal, tek kullanıcı, 10MB yükleme limiti.

**Bilinçli olarak ertelenen**

- `src/server.js`'in iki ucu (`/api/dashboard/latest` ve özel aralık) KDV'yi `getHistory` üzerinden
  yeniden türetip storage'dan geleni eziyor. Sadeleştirme ertelendi: sunucu bloğu önce JSON
  `totalTax`'ı, storage ise önce `sales_tax` kolonunu okuyor; eski kayıtlarda ikisi ayrışabilir.
  Koda "BORÇ" notu düşüldü. Oradaki `limit: 1000` de sessiz bir tavan.

**Doğrulama:** `npm run lint` temiz; **179 birim + 36 entegrasyon + 1 smoke** geçti (önceki tur:
174 + 34 + 1). İzole QA (geçici veritabanı, loopback, gerçek veriye dokunulmadan) panel, tahmin ve
cari akışlarını doğruladı. Kalite kapısında test-uzmani düzeltmeleri geçici olarak bozup testlerin
gerçekten kırıldığını kanıtladı; kod-inceleyici SQL enjeksiyonu, yetki kontrolü ve lockfile farkını
denetleyip **ONAY** verdi.

---

## 2026-08-06 — CEO revizyon turu

CEO'nun ekran görüntüleriyle bildirdiği 5 sorun + 1 soru ele alındı.

- **KPI ızgarasındaki gri bant** düzeltildi: `.dashboard-stats` üzerindeki eski `gap: 1rem !important`
  kuralı 1px hairline aralığını eziyordu. Kokpit ızgaralarında `gap: 1px !important` kullanılıyor.
- **Kenar çubuğu bulanıklığı kaldırıldı**: `.sidebar-overlay` artık görünmez tam ekran tıklama
  yakalayıcı, `.sidebar.open` opak panel + yumuşak gölge. Ekranı bölen keskin dikey şerit gitti.
- **Tahminler sabit düzene geçti**: sürükle-bırak ve kullanıcıya özel sıralama tamamen kaldırıldı
  (10 fonksiyon + 128 ölü CSS kuralı, ~27 KB silindi). Yeni sıra: grafik → tablo → risk+senaryo →
  finansal sağlık+büyüme → karar etkisi+aksiyon → CFO. Yan yana çiftler otomatik eşit yükseklikte.
- **"En Çok" sekmesi**: başlık kısaldı, **yıl + ay filtresi** eklendi (firmalar ve ürünler).
  Backend `getTopCustomers`/`getTopProducts` `month` parametresi aldı; filtre hem ana döngüde hem
  yıl seçiliyken çalışan ikinci döngüde uygulanıyor. API yanıtına `month` alanı eklendi.
- **Tek ölçü sistemi**: `.cockpit-page` altında `--control-height: 38px` vb.; 8 sayfada başlıklar,
  butonlar, seçiciler, filtre satırları ve bölüm boşlukları tek kaynaktan geliyor. Ayarlar da dahil.
  Dokunmatik cihazda 44px hedefi ayrı medya sorgusuyla korundu.
- **Cari etiket dürüstlüğü**: "Bakiye" → "Fatura Toplamı", "Net Bakiye" → "Net Fatura Tutarı".
  Araştırma, bu rakamın ödenmemiş bakiye değil kesilen faturaların toplamı olduğunu kanıtladı
  (sistemde tahsilat/ödeme kaydı kavramı yok). Yanıltıcı "tahsilat takibi" metni ve veriye göre
  değişmeyen sabit yeşil/kırmızı renk kaldırıldı.
- **Hata düzeltmesi**: `getBusinessParties` SQL'inde hiç seçilmediği için API'de hep `0` dönen
  `lastTransactionAmount` alt sorguyla düzeltildi.

Kalite kapısı iki tur döndü: test-uzmani mobilde `flex-basis` değerlerinin yükseklik olarak
okunduğunu (butonlar 140px, başlıklar 280px) yakaladı; kod-inceleyici RET verip dokunmatik 44px
hedefinin ezilmesini, sabit cari rengini ve eksik kalıcı testleri tespit etti. Hepsi düzeltildi.

Doğrulama: lint temiz, 174 birim + 34 entegrasyon (2 yeni) + smoke geçti.

## 2026-08-05 — Kokpit tasarım turu (6 sayfa)

Claude Design projesindeki iki yönden **1b "Kokpit"** CEO tarafından seçildi ve altı sayfaya yayıldı:
Panel, Yıl Karşılaştırma, Gider, Müşteriler, Tedarikçiler, Tahminler. Her sayfa iki şeride bölündü
(ana kolon + 320px karar paneli); karar panelleri veriden üretiliyor, satır içi `onclick` kullanmıyor.

Tasarım turu sırasında ortaya çıkan ve düzeltilen sessiz hatalar:

- **Panel kârı KDV dahil hesaplanıyordu**, Kâr/Zarar tablosu KDV hariç — aynı ekranda iki farklı
  "Net Kâr" görünüyordu (fark = net KDV). Hem istemcide hem `/api/dashboard/*` uçlarında tek tabana
  çekildi; sunucu artık KDV hariç `grossProfit` serisi döndürüyor.
- **Gider adları hiç kaydedilmiyordu**: validator `name` isterken ön yüz `label` gönderiyor, hata
  `catch (_) {}` ile yutuluyordu. Giderler yalnızca localStorage'da kalıyordu.
- **Her tuş vuruşunda kayıt isteği** gidiyordu; DELETE+INSERT yarışı satırları çoğaltıyordu
  (450 ms gecikme + promise zinciri).
- **"Tüm yıl" giderleri panelde görünmüyordu** (`getExpenseItemsTotalByYear` `month='all'` satırlarını
  aylara dağıtmıyordu).
- **Özel Aralık, Kâr/Zarar bölümünü hiç etkilemiyordu** (başlık bayat, tablo 12 ay gösteriyordu).
- **Onay modalında odak tuzağı yoktu**, Escape global kısayola sızıyordu.

Test altyapısı: panel hesapları `public/js/dashboard-metrics.js` modülüne çıkarıldı ve 26 gerçek
birim testi yazıldı; `npm run test:integration` artık `--test-force-exit` ile kapanıyor.

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
