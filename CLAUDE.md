# Analizcim - AI Geliştirme Talimatları

## Proje Özeti

Analizcim, yerel ortamda çalışan bir Excel analiz uygulamasıdır. Uygulama; satış, alış, KDV, brüt kâr, net kâr, gider, geçmiş analiz ve tahmin verilerini küçük işletme sahibi, muhasebe/finans kullanıcısı ve admin için daha anlaşılır hale getirmeyi hedefler.

Ürünün ana amacı yalnızca veri göstermek değil, karar destek paneli sunmaktır. Özellikle Dashboard ve Tahminler sayfalarında kullanıcı şu sorulara kısa sürede cevap alabilmelidir:

- İşletmenin genel durumu nasıl?
- Risk veya fırsat nerede?
- Hangi alan iyi, hangi alan dikkat istiyor?
- Şimdi hangi aksiyon alınmalı?

Uygulama lokal çalışır. Finansal veriler kullanıcının kendi ortamında kalır. Sunum katmanı sade, güven veren ve modern dark/light SaaS yaklaşımına uygun olmalıdır.

## Temel Çalışma Kuralları

- Önce dosya yapısını ve ilgili modülü oku.
- Mevcut akışı anlamadan tahmine dayalı kod değiştirme.
- Backend, data, API ve hesaplama mantığına gereksiz dokunma.
- İstek UI ise öncelikle frontend, layout, component, className, CSS ve görsel hiyerarşi tarafında çalış.
- Yeni dependency ekleme; gerçekten gerekiyorsa gerekçesini açıkla.
- ARIMA için `arima` dependency'si bilinçli olarak eklenmiştir; gerçek ARIMA/SARIMA tahmini için kullanılmalıdır.
- Mevcut dark/light tema sistemine uy.
- Dashboard veya tahmin verilerini placeholder ile ezme.
- Finansal değerlerin anlamını değiştirme.
- Var olan veri prop yapısını bozma.
- Route ve auth davranışını sessizce değiştirme.
- Build, lint veya test çalıştırabiliyorsan çalıştır.
- İş sonunda ne yaptığını, neye dokunmadığını ve doğrulama sonucunu raporla.

## Kod Değişikliği Politikası

- Küçük görsel düzeltmeler hedefli yapılmalı.
- Büyük refactor yalnızca açık bir gerekçe varsa yapılmalı.
- Veri hesaplama mantığı korunmalı.
- API yanıt şeması ve veri dönüştürme katmanı bozulmamalı.
- Route, login, logout, session ve kullanıcı yetki akışları korunmalı.
- App shell değişiklikleri Dashboard, Tahminler ve diğer sayfaların içeriğini bozmamalı.
- Sadece dokümantasyon istenmişse kod dosyalarına dokunma.
- Auth middleware değişikliklerinde `login`, `styles`, `favicon` gibi public asset yollarının yanlışlıkla korunaksız veya kilitli hale gelmediğini kontrol et.
- Excel import akışında mevcut satış, alış, KDV, kâr ve tahmin hesaplamalarını bozmadan yan veri üret.

## Cari Yönetimi Standartları

Analizcim'de cari alanı artık iki parçalı düşünülmelidir:

- Faz 1: manuel müşteri yönetimi
- Faz 1.5: Excel'den otomatik müşteri ve tedarikçi analizi

Kurallar:

- Manuel müşteri CRUD akışı korunmalı.
- Satış faturalarından gelen karşı taraflar `müşteri` olarak işlenmeli.
- Alış faturalarından gelen karşı taraflar `tedarikçi` olarak işlenmeli.
- Aynı Excel veya aynı satır tekrar işlendiğinde mükerrer hareket oluşmamalı.
- Cari analitiği mevcut finansal özetin yerine geçmemeli; onu tamamlamalı.
- Yeni cari UI mevcut dark/light ve pozitif/negatif renk semantiğine uymalı.

Beklenen veri modeli:

- Manuel müşteri tablosu korunur.
- Tedarikçiler ayrı tablo veya eşdeğer kalıcı yapı ile tutulur.
- İşlem geçmişi müşteri/tedarikçi ayrımı taşıyan normalize bir hareket tablosunda saklanır.

Beklenen ekranlar:

- `Müşteriler` sekmesi
- `Tedarikçiler` sekmesi
- Ortak cari detay ekranı

Beklenen detay metrikleri:

- toplam işlem hacmi
- net bakiye
- son işlem tarihi ve tutarı
- ortalama işlem tutarı
- aylık hacim grafiği
- son 12 ay trendi
- tam hareket dökümü

## Excel Otomatik Eşleme Notları

Karşı taraf tespiti esnek olmalıdır. Şu başlıklar desteklenen örneklerdir:

- `Müşteri Adı`
- `Müşteri`
- `Cari Adı`
- `Cari Unvan`
- `Cari Hesap`
- `Tedarikçi`
- `Tedarikçi Adı`
- `Cari Ünvanı`
- `Açıklama`
- `Firma Ünvanı`

Notlar:

- Başlık varyasyonları normalize edilerek eşlenmelidir.
- Cari, müşteri veya tedarikçi anlamı taşıyan başlıklar `Açıklama`, ürün veya kalem gibi genel açıklama kolonlarına göre öncelikli olmalıdır.
- Tarih ve tutar çıkarımı mevcut analyzer mantığına yaslanmalıdır.
- Eğer karşı taraf `Bilinmeyen` kalıyorsa cari importuna alınmamalıdır.

## UI/UX Standartları

- Modern dark/light SaaS görünümü korunmalı.
- Linear/Vercel sadeliği ile finansal dashboard ciddiyeti dengelenmeli.
- Kart, border, radius, spacing ve typography tutarlı olmalı.
- Pozitif, negatif ve nötr renkler anlam taşımalı.
- Boşluklar kartları büyüterek değil doğru grid ve padding ile çözülmeli.
- Her kartın karar değeri olmalı; dekoratif kart eklenmemeli.
- Kullanıcı 10 saniye içinde ana durumu anlayabilmeli.
- Açıklamalar kısa, işlevsel ve anlaşılır olmalı.
- Responsive davranış masaüstü, tablet ve mobil için kontrollü olmalı.

## Dashboard Sayfası Standartları

Dashboard bir operasyon paneli ve rapor özeti gibi çalışmalıdır. Üst bölüm hızlı karar vermeyi, alt bölüm ise detay incelemeyi desteklemelidir.

Beklenen bilgi mimarisi:

1. Yönetici özeti
2. Ana KPI kartları
3. Finansal sağlık göstergeleri
4. KDV özeti
5. Satış, alış ve net kâr trend alanı
6. Kar/Zarar analizi tablosu
7. Son analize göre değişimler
8. İşletme için öncelikler
9. Son eklenen analizler
10. CTA butonları
11. Cari widget'ları

Dashboard yaklaşımı:

- KPI alanı sadece sayı göstermemeli, durumu yorumlamalı.
- KDV alanı görünür ve yönetimsel anlam taşıyan bir blok olarak kalmalı.
- Grafikler dekoratif olmamalı; trend, kıyas ve yorum üretmeli.
- Kar/Zarar tablosu detay isteyen kullanıcı için okunabilir ve kompakt kalmalı.
- Son değişimler bölümünde kısa trend kartları tercih edilmeli.
- Öncelikler bölümü kullanıcıya “neden önemli, ne yapmalı?” sorusunun cevabını vermeli.
- Cari widget'ları mevcut grid düzenini bozmadan eklenmeli.
- Dashboard içinde en az şu cari özetleri bulunmalı:
- toplam müşteri sayısı
- toplam tedarikçi sayısı
- en yüksek hacimli müşteriler
- en yüksek hacimli tedarikçiler
- son eklenen cari hareket özeti
- Ana KPI kartları iki satırda okunmalıdır.
- Sıra 1: Toplam Satış, Toplam Alış, Brüt Kâr, Net Kâr
- Sıra 2: Toplam Analiz, Toplam Gider, Toplam Müşteri, Toplam Tedarikçi
- KPI grid masaüstünde 4 kolon, tablette 2 kolon, mobilde 1 kolon davranışını korumalıdır.

## Yıl Karşılaştırma Sayfası Standartları

Yıl Karşılaştırma sayfası modern SaaS finans raporu gibi ele alınmalıdır.

Beklenen yapı:

- Üst bölümde 3 YoY delta kartı: Satış Farkı, Maliyet Farkı, Net Kâr Farkı
- Pozitif değişimler yeşil trend, negatif değişimler kırmızı trend ile gösterilmeli
- Orta bölümde seçili iki yılın Ocak-Aralık satış ve alış verilerini karşılaştıran grouped bar chart bulunmalı
- Alt bölümde aylık karşılaştırma tablosu bulunmalı
- Tablo satırları Ocak-Aralık aylarını ve en sonda Toplam satırını içermeli
- Tablo sütunları: Ay, Yıl 1, Yıl 2, Fark, Değişim %

Kurallar:

- API response şeması gereksiz kırılmamalı.
- Satış, alış ve kâr hesapları mevcut finansal formüllerden sapmamalı.
- Chart widget dark/light tema tokenlarıyla uyumlu olmalı.
- Mobilde tablo okunabilir kalmalı; sayfa yatay scroll tuzağı üretmemeli.

## Tahminler Sayfası Standartları

Tahminler veya Gelecek Tahmini sayfası, klasik bir rapor sayfası gibi değil; karar destek yüzeyi gibi ele alınmalıdır.

Beklenen yapı:

- Başlık ve filtreler: dönem ve model seçimi
- Karar özeti
- Muhasebeci feedback kartı
- KPI’lar
- 1, 3, 6 ve 12 ay horizon kartları
- Ana tahmin grafiği
- Model karşılaştırma tablosu
- Risk öncelikleri
- Senaryo analizi
- Trend veya grafik alanı
- Finansal sağlık göstergeleri
- Büyüme momentumu
- Aksiyon planı
- CFO analizi
- Model ve veri detayları

Kurallar:

- Gereksiz kart eklenmemeli.
- Risk ve senaryo alanları karşılaştırmalı ama kompakt olmalı.
- Teknik detaylar ilk ekranda baskın olmamalı.
- Grafik ve tablo birlikte karar üretmeli.
- Boşluk doldurmak için büyük kartlar kullanılmamalı.
- Eski response alanları kırılmamalı; yeni alanlar ek olarak dönmeli.
- Risk, senaryo, aksiyon planı, CFO analizi ve model detayları korunmalı.
- Tahmin sayfasındaki model seçimi `auto`, `linear`, `exponentialSmoothing`, `holtWinters`, `arima` değerlerini desteklemeli.
- `period` filtresi `6`, `12`, `all` değerlerini desteklemeli.
- A Tahmin tablosu mümkün olduğunca tek ekrana sığmalı; gereksiz `overflow-x` veya kalıcı yatay scroll üretmemeli.
- C Risk ve D Senaryo kartları masaüstünde aynı satırda, eşit yükseklik/genişlik hissiyle hizalanmalıdır.

## Tahmin Motoru Standartları

Tahmin motoru satış verisini aylık bazda kullanır ve `src/predictor.js` içinde tutulur.

Desteklenen modeller:

- Linear Regresyon
- Exponential Smoothing
- Holt-Winters
- ARIMA

Model seçim ilkeleri:

- Her model rolling backtest ile ölçülmeli.
- MAE ve RMSE hesaplanmalı; MAPE mümkünse eklenmeli.
- Otomatik seçimde RMSE öncelikli olmalı.
- Manuel seçimde desteklenen model doğrudan kullanılmalı.
- Veri yetersizse model `available: false` dönmeli; kullanıcıya anlamlı neden verilmelidir.
- Tahminler 1, 3, 6 ve 12 ay horizon üretebilmelidir.
- Güven aralığı tahminle birlikte dönmelidir.
- ARIMA için native `arima` paketi kullanılmalı; eski ARIMA-lite yaklaşımına geri dönülmemelidir.
- ARIMA aday order'ları holdout RMSE ile seçilmeli.
- 24+ aylık veri varsa seasonal ARIMA adayı değerlendirilebilir.

Korunması gereken response alanları:

- `predictions`
- `confidenceBands`
- `trend`
- `confidence`
- `purchasePredictions`
- `profitPredictions`
- `netProfitPredictions`
- `ceoAnalysis`
- `seasonality`
- `riskAssessment`
- `businessStats`

Ek tahmin alanları:

- `allPredictions`
- `allConfidenceBands`
- `forecastHorizons`
- `modelSelection`
- `modelComparison`
- `accountantFeedback`
- `detailedStatistics`

Muhasebeci feedback kuralları:

- 3 aylık tahmin toplamı TL olarak verilmeli.
- %80 güven aralığı anlaşılır cümleyle gösterilmeli.
- Trend yönü ve şiddeti belirtilmeli.
- Mevsimsel etki varsa açıkça yazılmalı.
- Geçen yıl aynı dönem karşılaştırması veri varsa eklenmeli.
- Düşüş, düşük güven veya kritik eşik durumlarında aksiyon önerisi ve uyarı üretilmeli.
- Feedback finansal tavsiye değil, geçmiş veriye dayalı karar destek açıklaması olarak kalmalı.

## Sidebar / AppShell Standartları

Analizcim app shell yaklaşımı:

- Sidebar collapsible olmalı.
- Masaüstünde sidebar varsayılan olarak dar rail halinde durabilir; açıldığında içerik alanını itmeden overlay panel gibi genişlemelidir.
- Açık durumda ikon ve yazı birlikte görünmeli.
- Kapalı durumda yalnız ikonlar görünmeli.
- Aktif menü rafine accent state ile ayırt edilmeli.
- “Yönetim” yerine kullanıcıya görünen label “Ayarlar” olmalı.
- Ayarlar ikonu modern dişli/cog formunda olmalı ve diğer sidebar ikonlarıyla aynı `w-5 h-5` hizasında kalmalı.
- Global header veya top strip kaldırılmıştır; yeniden eklenmemelidir.
- Sayfa içi başlıklar, filtreler ve action satırları korunmalıdır.
- Admin account block, Ayarlar menüsünün hemen altında yer almalıdır.
- Admin account block sidebar footer’a itilmemelidir.
- Admin dropdown içinde yalnızca `Hesap Değiştir` ve `Çıkış Yap` yer almalıdır.
- Admin dropdown metinleri dark/light temada her zaman okunur olmalıdır.
- `Hesap Değiştir` mevcut login sayfasına yönlendirmelidir.
- `Çıkış Yap` mevcut logout davranışını korumalıdır.
- Tema yönetimi header’da değil, Ayarlar sayfasında olmalıdır.
- Sidebar açılış/kapanış animasyonu masaüstünde simetrik, yumuşak ve kısa tutulmalıdır.
- Sidebar overlay/blur efekti hafif olmalı; sert çizgi veya ağır karartma üretmemelidir.

## Tema Sistemi

- Dark ve light tema tutarlı olmalı.
- Light theme seçildiğinde sidebar da light theme’e uyum sağlamalı.
- Hardcoded koyu renklerden kaçınılmalı.
- Theme-aware token, değişken veya class yapısı kullanılmalı.
- Pozitif ve negatif renk semantiği korunmalı; tema temizliği yapılırken yeşil/kırmızı finansal anlam kaybolmamalıdır.
- Header’da ayrı bir tema butonu bulunmamalı.
- Tema tercihi Ayarlar sayfasındaki görünüm bölümünden yönetilmelidir.

## Güncel Uygulama Durumu

Son UI/theme turunda aşağıdaki yapı hedef davranış olarak kabul edilmiştir:

- Tema token entegrasyonu `public/styles.css` içinde merkezileştirildi.
- Sidebar masaüstünde sabit bir rail üzerinden genişleyen overlay panel mantığıyla çalışır.
- Overlay blur değeri hafif tutulur; light modda çok düşük, dark modda kontrollü opaklık kullanılır.
- Sidebar toggle butonu sidebar üst bölümünde kalır; masaüstünde dışarı taşmamalıdır.
- Admin dropdown, login formu, Ayarlar ve Analiz Geçmişi input alanları tema tokenlarıyla okunur halde tutulmalıdır.
- Dashboard ve benzeri finansal yüzeylerde pozitif/negatif renkler `success/danger` semantiğiyle korunmalıdır.

Son güvenli QA ve hata düzeltme turunda aşağıdaki davranışlar doğrulandı:

- `closeMobileSidebar` helper’ı `public/app.js` içinde tanımlıdır; mobilde sekme değişiminde güvenli no-op çalışır, desktop akışını bozmaz.
- Mobil sidebar açıkken sekme değişimi sonrası panel kapanır; `768px` ve `390px` viewport’ta runtime hata üretmemelidir.
- `pending-users` polling yalnızca `Ayarlar > Kullanıcılar` görünümü aktifken çalışmalıdır.
- `favicon.svg` public asset olarak servis edilmelidir; login veya auth redirect’ine düşmemelidir.
- Satış Excel'inden gelen müşteri isimleri otomatik listeye düşmelidir.
- Alış Excel'inden gelen tedarikçi isimleri otomatik listeye düşmelidir.
- `Cari Ünvanı`, `Müşteri`, `Tedarikçi` ve `Açıklama` başlık varyasyonları cari import akışında desteklenmelidir.
- Cari, müşteri ve tedarikçi başlıkları açıklama kolonlarından önce seçilmelidir.
- Aynı Excel tekrar yüklendiğinde cari hareket satırları artmamalıdır.
- `Müşteriler` ve `Tedarikçiler` sekmeleri `390px`, `768px`, `1440px` görünümde kullanılabilir kalmalıdır.
- Cari detay ekranında aylık hacim ve trend chart canvas'ları render edilmelidir.
- Dashboard cari widget'ları ilgili veriyle dolmalı ve sekmelere yönlendirebilmelidir.
- Dashboard KPI alanı iki satırlı 4 kolon mantığını korumalıdır.
- Dashboard Tahmin Özeti widget'ı önümüzdeki 3 ay satış tahminini, trend yönünü, seçilen modeli ve uyarı durumunu göstermelidir.
- Tahmin Özeti widget'ı Tahminler sayfasına yönlendirmelidir.
- Tahminler sayfasında otomatik model seçimi, manuel model seçimi ve ARIMA seçimi çalışmalıdır.
- Tahmin grafiği `390px`, `768px`, `1440px` viewport'larda boş veya aşırı yüksek canvas üretmemelidir.
- Tahminler sayfasında A tablosu gereksiz yatay scroll üretmemeli; C Risk ve D Senaryo kartları hizalı kalmalıdır.
- Yıl Karşılaştırma sayfasında YoY delta kartları, grouped bar chart ve Toplam satırlı aylık tablo bulunmalıdır.
- Model karşılaştırma tablosu seçilen modeli vurgulamalıdır.
- Koyu/açık tema geçişinde tahmin kartları ve finansal pozitif/negatif renk semantiği korunmalıdır.

## Yeni Session Devam Notu

Yeni bir oturum başladığında önce aşağıdakileri kontrol et:

1. `public/styles.css` içindeki tema token köprüsü, sidebar shell bloğu ve final cleanup override’ları.
2. `public/app.js` içindeki sidebar shell davranışı, chart tooltip/theme stil okumaları ve Yıl Karşılaştırma chart render akışı.
3. `tests/unit/ui-structure.test.js` içindeki sidebar rail, overlay, tema token ve login/sidebar görünürlük doğrulamaları.
4. `src/predictor.js` içindeki model karşılaştırma, ARIMA adaptörü, horizon ve feedback üretimi.
5. `tests/unit/predictor.test.js` içindeki model seçimi, metrik, horizon, native ARIMA ve feedback regresyonları.
6. `src/analyzer.js` içindeki Excel karşı taraf başlık önceliği ve cari mapping normalize akışı.

### 2026-07-07 güncellemesi (güvenlik + finansal + doküman turu)

Bu turda doğrulanan/yürürlükteki güncel durum (detaylı geçmiş: `CHANGELOG.md`):

- **Finansal:** Brüt Kâr artık **KDV hariç** hesaplanıyor (`analyzer.calculateSummary`,
  `storage.getMonthlyProfitLoss`, YoY, `computeAndSaveSummary`); geçmiş `net_profit` `migration 010`
  ile yeniden hesaplandı. Kâr oranı % paydası satış. `parseNumber` parantezli/sondaki-eksi negatifi okur.
- **Güvenlik:** `GET /api/backup` `requireAdmin`; IDOR kapatıldı (`storage.buildHistorySqlFilters`
  userId zorunlu, `||1` yok); oturum `sameSite`+`regenerate`, login limiti 10; CSP + güvenlik başlıkları
  (`server.js` cors sonrası); export formül nötrleme (`validators.neutralizeSpreadsheetCell`); hata
  mesajı hijyeni; `/health`+`/api/health` public uçları.
- **Bağımlılık:** `jsPDF@4.2.1` (kritik açık kapandı); **PDF export onarıldı** (`autoTable` artık
  `require('jspdf-autotable').default`).
- **Diğer:** çoklu yükleme mükerrer dosya koruması (`analyzer.dedupeBuffersByContent`); gradyan kaldırıldı.
- **Sürüm kontrolü:** proje git + **private GitHub deposu** (github.com/ademtfkc/analizcim). `.env`/`data/` git'e girmez.
- **Cari geçmiş davranışı:** Cari import yalnızca yeni yüklemede çalışır. Geçmiş analizlerin ham işlem
  satırları saklanmaz (yalnız özet + top-5 karşı taraf); geçmişi cari'ye katmak Excel'in yeniden
  yüklenmesini gerektirir. (CEO kararı: backfill YAPILMADI.)
- **Test:** 134 birim testi geçti; lint temiz. (Not: birim testler `--test-force-exit` ile temiz kapanır;
  soket gerektiren integration'lar sandbox'ta tekil çalıştırılır.)

Son doğrulanan durum:

- `npm run lint` geçti.
- `npm test` geçti; socket açma izni gerektiren integration case’ler test helper tarafından skip edilebilir.
- `npm run test:unit` geçti.
- `npm run test:smoke` geçti.
- `npm run verify:fast` geçti.
- `NODE_ENV=test node --test tests/unit/analyzer.test.js` geçti.
- `NODE_ENV=test node --test tests/unit/analyzer.test.js tests/integration/business-parties.test.js tests/unit/ui-structure.test.js` geçti; sandbox socket kısıtı olan business party integration case’leri skip edilebilir.
- Tahmin motoru unit testleri geçti: model seçimi, metrik hesaplama, horizon üretimi, native ARIMA ve feedback kuralları.
- `NODE_ENV=test node --test tests/integration/business-parties.test.js` geçti.
- İzole Playwright Chromium ile `127.0.0.1:3000` üstünde login, dashboard, sidebar, ayarlar ve tema turu yapıldı.
- Son Playwright turunda console error `0`, network error `0`.
- İzole browser QA sırasında Excel yükleme, tekrar yükleme, müşteri detayı, tedarikçi detayı ve dashboard widget akışı doğrulandı.
- İzole browser QA sırasında Tahminler sayfası `390px`, `768px`, `1440px` viewport'larda kontrol edildi; Dashboard Tahmin Özeti widget'ı ve Tahminler yönlendirmesi doğrulandı.

Kalan muhtemel sonraki işler:

- Bağımlılık: `xlsx` (npm'de yama yok) ve `sqlite3@6` (kırıcı) geçişini çok kullanıcılı/ağ senaryosunda ayrı, tam test edilen turda ele almak.
- MemoryStore yerine kalıcı session store (teknik borç).
- Büyük frontend refactor: inline `onclick` → `addEventListener` (CSP'den `'unsafe-inline'` kaldırılabilsin).
- Genel integration harness içindeki açık handle / kapanış davranışını temizlemek.
- Ekran görüntülerini `docs/screenshots/` altına eklemek (README placeholder'ı).
- Büyük veri setlerinde cari liste/detay performansını ve ARIMA sonuçlarını gözlemlemek.

## Ayarlar Sayfası Standartları

Ayarlar sayfası kullanıcı dostu, sade ve bölüm bazlı olmalıdır.

Beklenen bölümler:

- Görünüm veya Tema
- Hesap
- Uygulama bilgisi
- Veri yönetimi
- Gelişmiş veya Teknik Detaylar

Kurallar:

- “Yönetim” yerine “Ayarlar” dili kullanılmalı.
- Teknik içerikler silinmemeli; gerekiyorsa Gelişmiş altında geri plana alınmalı.
- Hesap alanı sade tutulmalı.
- Tema seçimi net ve anlaşılır olmalı.
- Admin işlemleri kullanıcının gözünü yormadan erişilebilir kalmalı.

## Raporlama Formatı

AI agent iş sonunda mümkünse şu formatta rapor vermelidir:

1. İncelenen dosyalar
2. Tespit edilen sorunlar
3. Yapılan değişiklikler
4. Dokunulmayan data veya logic alanları
5. Responsive veya tema kontrol sonucu
6. Build, lint veya test sonucu
7. Kalan riskler veya öneriler

## Dokümantasyon ve Doğrulama Notları

- Belgeler kod tabanı ile uyumlu tutulmalıdır.
- README, kullanıcı ve geliştirici için sade bir giriş noktası olmalıdır.
- Geliştirme planı, tamamlanan işlerle sıradaki işleri ayırmalıdır.
- `npm run lint`, `npm run test:unit`, `npm run test:smoke`, `npm run verify:fast` ve `npm run verify` scriptleri mevcut proje doğrulama akışlarıdır.
- Faz 1.5 kritik regresyonu için `NODE_ENV=test node --test tests/integration/business-parties.test.js` ayrı bir güvenilir doğrulama komutudur.
- Doğrulama sonucunu aktarırken gerçek hata ile sandbox veya ortam kısıtı kaynaklı skip durumlarını birbirine karıştırma.

## Güvenli Lokal QA Notu

- Lokal QA sırasında gerçek `.env` değerlerini, gerçek kullanıcı verisini ve gerçek veritabanını kullanma.
- Güvenli test ortamı için loopback üstünde çalış: `HOST=127.0.0.1`, `PORT=3000`.
- Geçici veritabanı kullan: `TEST_DATABASE_PATH=/private/tmp/analizcim-playwright.db`.
- Geçici admin hesabı tercih et: `BOOTSTRAP_ADMIN_USERNAME=qa_admin`, `BOOTSTRAP_ADMIN_PASSWORD='Qa123456!'`.
- Eğer `.env` otomatik yükleniyorsa test server’ı repo kökü yerine `/private/tmp` gibi nötr bir çalışma dizininden başlatıp env override’larının etkin olduğundan emin ol.
- Playwright tarafında yalnız izole Chromium kullan; aktif Chrome/Arc/Safari profillerine bağlanma.
- MCP browser binary eksikse önce `npx @playwright/mcp install-browser chrome-for-testing` komutunun izole cache kurulumu yaptığından emin ol; `/Applications` veya symlink gerektiren akışları kullanma.
