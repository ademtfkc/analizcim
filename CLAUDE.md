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

### Kokpit düzeni (2026-08-05'te CEO onayıyla yürürlükte — tasarım yönü "1b Kokpit")

Dashboard iki şeritli bir çalışma yüzeyidir: solda ana kolon, sağda 320px sabit karar paneli.
`.dashboard-cockpit-body` masaüstünde `minmax(0,1fr) 320px` grididir; `≤1240px`'te tek kolona iner,
karar paneli iki kolonlu bloklara dönüşür; `≤960px`'te tamamen alt alta gelir.

- **Ana KPI alanı 4 kutudur:** Toplam Satış, Toplam Alış, Net Kâr, Ödenecek KDV.
  Her kutu: etiket + yıllık değişim rozeti (`+%x`, geçen yıla göre) + mono/tabular ana rakam + kısa
  açıklama + aylık mikro grafik (inline SVG, `currentColor`).
- **Ana 4 kutu dışında kalan sayılar silinmez;** kutuların altındaki ikincil şeritte durur:
  Brüt Kâr, Toplam Analiz, Toplam Gider, Toplam Müşteri, Toplam Tedarikçi. Müşteri/Tedarikçi çipleri
  ilgili sekmeye gider.
- KPI grid masaüstünde 4 kolon, `≤960px` 2 kolon, `≤600px` 1 kolon davranışını korumalıdır.
- **Ana sahne** (`widget-chart`): solda net kâr özeti (dönem, ana rakam, YoY değişim, brüt marj,
  en iyi/en zayıf marj ayı), sağda mevcut trend grafiği.
- **Kâr/zarar tablosu** mono/tabular dizgi kullanır; Marj kolonunda ince oran çubuğu + yüzde bulunur
  (çubuk rengi hücrenin pozitif/negatif tonunu izler). `≤600px`'te çubuk gizlenir, yüzde kalır.
- **Sağ karar paneli** sırasıyla: "Şimdi ne yapmalıyım" (veriden üretilen 3 madde), Tahmin Özeti,
  KDV Özeti, Cari Özeti. Karar maddeleri satır içi `onclick` kullanmaz; `data-rail-tab` /
  `data-rail-scroll` ile tek bir delege dinleyici üzerinden çalışır.
- **Renk disiplini:** yeşil/kırmızı yalnızca finansal sonuç taşıyan alanlarda kullanılır. Ana KPI
  rakamları ve sayaçlar nötr kalır; renk değişim rozetinde, mikro grafikte, net zararda ve
  ödenecek/devreden KDV'de görünür.
- Widget sıralama/gizleme özelliği korunur; her şerit kendi içinde sıralanır ve şerit başlangıcı
  `[data-widget-anchor]` ile işaretlenir.
- **Not:** `.dashboard-overview-panel` (Yönetici Özeti) mevcut sadeleştirme kuralıyla (`styles.css`
  içinde `display:none !important` listesi) görünmez durumdadır — bu Kokpit turundan önce de böyleydi.
  Yönetici özeti rolünü sağ paneldeki "Şimdi ne yapmalıyım" bloğu ile ana sahnedeki net kâr özeti üstlenir.

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
- **Kart düzeni SABİTTİR (2026-08-06 CEO kararı).** Sürükle-bırak ve kullanıcıya özel sıralama
  kaldırılmıştır, geri eklenmemelidir. Sıra HTML'deki sıradır; yeni kart eklenirse hem HTML sırasına
  hem `data-card-id` genişlik kuralına eklenmelidir.

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
- Cari tablosu (`.business-party-table`) `≤768px`'te kart görünümüne dönüşür (thead gizli, satır=kart, hücre=flex `etiket:değer` via `::before{content:attr(data-label)}`); masaüstünde klasik 5 kolonlu tablo korunur. Yatay kaydırma üretmemelidir.
- Cari detay ekranında aylık hacim ve trend chart canvas'ları render edilmelidir.
- Dashboard cari widget'ları ilgili veriyle dolmalı ve sekmelere yönlendirebilmelidir.
- Dashboard KPI alanı 4 ana kutu + ikincil şerit mantığını korumalıdır (bkz. "Kokpit düzeni").
- Dashboard Tahmin Özeti widget'ı önümüzdeki 3 ay satış tahminini, trend yönünü, seçilen modeli ve uyarı durumunu göstermelidir.
- Tahmin Özeti widget'ı Tahminler sayfasına yönlendirmelidir.
- Tahminler sayfasında otomatik model seçimi, manuel model seçimi ve ARIMA seçimi çalışmalıdır.
- Tahmin grafiği `390px`, `768px`, `1440px` viewport'larda boş veya aşırı yüksek canvas üretmemelidir.
- Tahminler sayfasında A tablosu gereksiz yatay scroll üretmemeli; C Risk ve D Senaryo kartları hizalı kalmalıdır.
- Yıl Karşılaştırma sayfasında YoY delta kartları, grouped bar chart ve Toplam satırlı aylık tablo bulunmalıdır.
- Model karşılaştırma tablosu seçilen modeli vurgulamalıdır.
- Koyu/açık tema geçişinde tahmin kartları ve finansal pozitif/negatif renk semantiği korunmalıdır.
- Silme/onay işlemlerinde native `confirm()` KULLANILMAMALIDIR; tema uyumlu `showConfirm()` modalı (`#confirmModal`) devrededir. Silme işlemleri kırmızı (`.btn-danger`), diğerleri normal buton. İptal / ESC / dış tık (overlay) / X (kapat) → işlem YAPILMAZ; yalnızca Onayla → işlem yapılır. Bu gating birebir korunmalıdır.

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

### 2026-07-08 güncellemesi (Tier 3 UI turu)

Bu turda yürürlüğe giren güncel durum (detaylı geçmiş: `CHANGELOG.md`):

- **Cari tablosu mobilde kart (#2, commit `9754b57`):** `public/styles.css` `@media (max-width:768px)`
  bloğu + `public/app.js renderBusinessPartyRows`'a `data-label`/`bp-cell-name`. Masaüstü tablo aynen;
  tema token'lı, yeşil/kırmızı bakiye semantiği korundu.
- **Native `confirm()` → tema modalı (#3, commit `0b28bea`):** 17 silme/onay çağrısı Promise dönen
  `showConfirm({message,danger,confirmText})` helper'ına çevrildi (`app.js`, `showError`'dan sonra). Yeni
  `#confirmModal` iskeleti (`index.html`) mevcut `.modal-*` token'lı stilleri + yeni `.btn-danger` kullanır.
  Mesajlar `textContent` (XSS güvenli). Enter, odaklı düğmenin native click'ine bırakıldı (İptal odaktayken
  yanlış onay hatası önlendi). `if (!confirm(` kalmadığını doğrulayan ui-structure regresyon kilidi eklendi.
- **#1 (responsive breakpoint konsolidasyonu) ATLANDI:** bug değil, teknik borç; görsel regresyon testi olmadan riskli.
- **Test:** 136 birim testi + smoke + lint temiz; iki commit GitHub main'e push, CI yeşil (`success`).
- **Bilinen küçük backlog:** onay modalında focus-trap yok (ileri Tab arka plana kaçar; yine de yanlış silme
  tetiklemez); `setupKeyboardShortcuts` global Escape'i `#confirmModal`'dan habersiz (pratik risk düşük).

### 2026-08-05 güncellemesi (Dashboard "Kokpit" tasarım turu)

Claude Design projesinden (`Analizcim - Yeni Yönler.dc.html`) gelen iki yönden **1b Kokpit** CEO
tarafından seçildi; kapsam **yalnızca Dashboard** olarak onaylandı. Yürürlükteki durum:

- `public/index.html` Dashboard bölümü iki şeride ayrıldı (`.dashboard-cockpit-body` →
  `.dashboard-cockpit-main` + `#dashboardRail`). Hiçbir element ID'si silinmedi.
- `public/app.js`: `renderCockpitSurfaces` / `renderRailActions` / `renderSparkline` /
  `computeYoyDelta` / `renderMarginBar` eklendi; `applyDashboardWidgetConfig` iki şeritli hale getirildi
  (her şerit kendi içinde, `[data-widget-anchor]` başlangıcından itibaren sıralanır);
  `DEFAULT_WIDGET_CONFIG` sırası tasarıma göre yeniden dizildi ve `widget-customers` eklendi.
- `public/styles.css` sonuna `.dashboard-cockpit` bloğu eklendi; tamamı tema token'lı, sabit renk yok.
- Ödenecek KDV artık ana KPI kutularından biri; Brüt Kâr ikincil şeride indi.
- Yıllık değişim rozeti (YoY) Satış / Alış / Net Kâr için hesaplanır. **KDV kutusunda rozet yoktur:**
  ödenecek KDV devreden-mahsuplu defterden gelir, önceki yıl için aynı defteri kurmadan yapılacak
  karşılaştırma yanıltıcı olurdu. YoY **yalnızca iki yılda da veri bulunan ayları** kıyaslar
  (`computeYoyDelta` → `sharedMonths`); aksi halde 2 aylık bir yıl 12 aylık yılla kıyaslanırdı.

**Denetim turunda düzeltilen 6 hata (test-uzmani + kod-inceleyici):**

1. **KRİTİK / finansal:** Panelin Net Kâr'ı KDV **dahil**, hemen altındaki Kâr/Zarar tablosu KDV
   **hariç** hesaplıyordu; aynı ekranda iki farklı "Net Kâr" görünüyordu (fark = net KDV tutarı).
   2026-07-07'deki "brüt kâr KDV hariç" kararı `/api/dashboard/latest` istemci normalizasyonunda
   uygulanmamıştı. `computeVatExclusiveGrossProfit` ile tek tabana çekildi (`public/app.js`).
   Bu, panelin gösterdiği kâr rakamını **düşürür** (doğru değere). Backend'e dokunulmadı.
2. **Boş durum hiç görünmüyordu:** API veri yokken bile sıfır dolu `summary` döndürdüğü için
   `!summary` koşulu asla tetiklenmiyordu → `hasMeaningfulSummary()`. Ayrıca `.dashboard-stats`
   üzerindeki eski `display: grid !important` satır içi gizlemeyi eziyordu → `.has-no-data` sınıfı.
   Hareketi olmayan dönemde Kâr/Zarar tablosu da artık gizlenir.
3. "En zayıf ay" HTML'de sabit `class="negative"` taşıyordu, marj pozitifken bile kırmızıydı → veriye bağlandı.
4. Net kâr mikro grafiği zarar döneminde de yeşildi → ton `view.netProfit`'e bağlandı.
5. Marj çubuğu negatif marjda `Math.abs` yüzünden dolu görünüyordu → negatifte boş kalır, yüzde görünür.
6. Düz (tüm ayları eşit) seride mikro grafik dibe yapışıyordu → ortadan geçer.

- Doğrulama: 139 birim testi (3 yeni regresyon kilidi) + lint + smoke temiz; izole demo DB ile
  24 aylık kârlı yıl **ve** 2 aylık zarar yılı senaryosu, 1440 / 768 / 390 viewport, koyu ve açık tema,
  0 console hatası; sayfa düzeyinde yatay kaydırma yok. Panel Net Kâr = tablo Net Kâr (fark 0) ölçüldü.
- **Değişmeyenler:** backend finansal kodu, API şeması, route/auth, tahmin motoru, cari import akışı.

### 2026-08-05/06 güncellemesi (Kokpit dili tüm sayfalara yayıldı + 5 sessiz hata)

Kapsam CEO onayıyla genişletildi: "tam yeniden düzen", dört sayfa. Hedef **lokal, tek kullanıcı**.

**Ortak kokpit temeli:** `.cockpit-page` / `.cockpit-body` / `.cockpit-main` / `.cockpit-rail`
sayfa bağımsız sınıflardır; her sayfa ana kolon + 320px karar paneli düzenini paylaşır
(`≤1240px` tek kolon, `≤960px` tamamen alt alta). Ortak parçalar: `.rail-block`, `.rail-title`,
`.rail-facts`/`.rail-fact`, `.rail-action*` ve `renderRailFacts()` / `renderRailActionItems()`
yardımcıları. Karar panelleri **her zaman veriden üretilir**, satır içi `onclick` kullanılmaz.

| Sayfa | Karar panelinde ne var |
|---|---|
| Panel (Dashboard) | Şimdi ne yapmalıyım · Tahmin Özeti · KDV Özeti · Cari Özeti |
| Yıl Karşılaştırma | Şimdi ne yapmalıyım · Yıl özeti · Öne çıkan aylar |
| Gider | Şimdi ne yapmalıyım · Gider yapısı · En büyük kalemler |
| Müşteriler / Tedarikçiler | Şimdi ne yapmalıyım · Portföy-tedarik özeti · En yüksek hacim |
| Tahminler | Şimdi ne yapmalıyım · 3 aylık beklenti · Model ve veri künyesi |

**Korunanlar:** Tahminler'in sürükle-bırak kart düzeni (9 kart), cari tablosunun mobil kart
görünümü, widget sıralama/gizleme, tüm element ID'leri, finansal formüller, route/auth.

**Tasarım turu sırasında bulunan ve düzeltilen 5 sessiz hata:**

1. **Gider adları hiç kaydedilmiyordu (KRİTİK).** `routes/expenses.js` validator `item.name`
   isterken ön yüz `label` gönderiyordu; her kayıt 400 dönüyor, `setExpensesLocalData` hatayı
   `catch (_) {}` ile yutuyordu. Giderler yalnız localStorage'da kalıyordu. Sanitizer de
   storage'ın okuduğu `{label,id,date}` yerine `{name,amount,category}` üretiyordu.
2. **Her tuş vuruşunda kayıt isteği** gidiyordu ("debounceSave" adına rağmen gecikme yoktu);
   DELETE+INSERT eşzamanlı çalışınca satırlar çoğalıyordu. 450 ms gecikme + promise zinciri.
3. **"Tüm yıl" giderleri panelde görünmüyordu.** `getExpenseItemsTotalByYear` `month='all'`
   satırlarını `byMonth`'a koymuyordu; `getMonthlyProfitLoss` ise 12 aya dağıtıyordu. Aynı kural
   uygulandı.
4. **Özel Aralık Kâr/Zarar bölümünü hiç etkilemiyordu** (başlık bayat, tablo 12 ay). Artık
   aralığa göre süzülüyor, toplamlar backend formülüyle yeniden hesaplanıyor; tüm dönem
   başlıkları tek `_dashboardPeriodLabel`'dan besleniyor.
5. **Onay modalında klavye tuzağı yoktu**, Escape global kısayola sızıyordu. Odak tuzağı +
   capture aşamasında `stopPropagation` eklendi; gating aynen korundu.

**Test altyapısı:** panel hesapları `public/js/dashboard-metrics.js` modülüne çıkarıldı
(`vat-ledger.js` ile aynı UMD kalıbı, `app.js`'ten ÖNCE yüklenir) ve **26 gerçek birim testi**
yazıldı. `npm run test:integration` artık `--test-force-exit` ile kapanıyor.

**Doğrulanan son durum:** `npm run verify` yeşil — **171 birim + 33 entegrasyon + 1 smoke**.
Altı sekme 1440/390 viewport, koyu+açık tema, 0 console hatası, sayfa düzeyinde yatay kaydırma yok.

### 2026-08-06 güncellemesi (CEO revizyon turu + cari bakiye gerçeği)

**Yürürlükteki 6 değişiklik (commit `7732e4f`):**

1. **KPI hairline'ı:** `.dashboard-stats` üzerindeki eski `gap: 1rem !important` kuralı 1px ayırıcıyı
   eziyordu (kalın gri bant). Kokpit ızgaralarında `gap: 1px !important` kullanılır — bu `!important`
   gereklidir, kaldırılırsa bant geri gelir.
2. **Kenar çubuğu:** bulanıklık (`backdrop-filter`) KALDIRILDI (CEO kararı). `.sidebar-overlay` görünmez
   tam ekran tıklama yakalayıcıdır; `.sidebar.open` opak panel + yumuşak gölge. Geri eklenmemelidir.
3. **Tahminler sabit düzen:** sürükle-bırak ve kullanıcıya özel sıralama TAMAMEN kaldırıldı.
   Kart sırası HTML'deki sıradır: grafik (tam) → tablo (tam) → risk+senaryo → finansal sağlık+büyüme →
   karar etkisi+aksiyon → CFO (tam). Genişlikler `data-card-id` ile CSS'te verilir. Yan yana çiftler
   aynı ızgara satırında olduğu için yükseklikleri otomatik eşitlenir (C/D kuralı böyle sağlanıyor).
4. **"En Çok" sekmesi:** başlık kısa, **yıl + ay** filtresi var. `getTopCustomers`/`getTopProducts`
   `month` parametresi alır ve filtreyi **iki döngüde de** uygular (ana döngü + yıl seçiliyken çalışan
   ikinci döngü). İkincisi atlanırsa ay filtresi sessizce etkisiz kalır — bu hata bir kez yaşandı.
5. **Tek ölçü sistemi:** `.cockpit-page` altında `--control-height: 38px`, `--control-radius`,
   `--control-gap`, `--section-gap`. Tüm başlık satırları, buton/seçici yükseklikleri, filtre satırları
   ve bölüm arası boşluklar buradan gelir. **Dikkat:** dokunmatik cihazda 44px hedefi, aynı
   `.cockpit-page` önekiyle `@media (hover:none) and (pointer:coarse)` içinde geri kazandırılmıştır;
   ölçü sistemine yeni seçici eklerken bu listeye de eklenmelidir.
6. **Cari etiket dürüstlüğü:** "Bakiye" → "Fatura Toplamı", "Net Bakiye" → "Net Fatura Tutarı".
   Renk sinyali kaldırıldı (aşağıdaki gerekçe).

**CARİ BAKİYE GERÇEĞİ (araştırma sonucu — yeni özellik yazmadan önce oku):**

- `party_transactions.balance = salesVolume - purchaseVolume`. Bir cari kaydı ya tamamen satış
  (müşteri) ya tamamen alış (tedarikçi) hareketinden oluşur (`storage.js`: `partyType = invoiceType
  === 'sales' ? 'customer' : 'supplier'`). Sonuç: **bakiye matematiksel olarak hacme eşittir**;
  müşteride hep artı, tedarikçide hep eksi. Renk sabit olduğu için hiçbir bilgi taşımıyordu, kaldırıldı.
- **Sistemde tahsilat/ödeme kaydı kavramı YOK.** Şema `invoice_type IN ('sales','purchase')` ile
  kilitli. Yani gösterilen rakam ödenmemiş kalan değil, kesilen faturaların toplamıdır.
- **Eski analizler cari ekranında görünmez.** `party_transactions` yalnızca yeni yükleme sırasında
  dolar (`server.js` `/api/analyze` ve `/api/analyze/merge`). Migration geriye dönük doldurma yapmaz.
- **Backfill teknik olarak mümkün değil:** `analyses.sales_json` satır bazlı karşı taraf/tarih
  saklamaz, yalnızca analiz başına en büyük 5 karşı tarafın tarihsiz toplamı vardır. Doğru cari ancak
  Excel yeniden yüklenerek gelir (mükerrer koruması çalışıyor, ikinci import 0 satır ekler).
- Gerçek borç/alacak takibi istenirse bu bir **kapsam genişlemesidir**: `invoice_type`'a
  `payment`/`collection` eklemek + giriş ekranı gerekir. Etiket düzeltmesiyle karıştırılmamalıdır.

**Kalite kapısı bu turda 2 tur döndü:** test-uzmani mobilde flex-basis'in yükseklik olarak okunduğunu
(butonlar 140px, başlıklar 280px) yakaladı; kod-inceleyici RET verip dokunmatik 44px ezilmesini, sabit
cari rengini ve eksik kalıcı testleri tespit etti. Hepsi düzeltildi.

**Doğrulanan son durum:** lint temiz, **174 birim + 34 entegrasyon + 1 smoke** geçti. 8 sekmede tüm
kontroller 38px, sayfa düzeyinde yatay kaydırma 0, 390px'te buton çakışması yok.

### 2026-08-07 güncellemesi (sağlamlaştırma turu)

CEO odak kararı: görünür yeni özellik yok, sessiz hataları kapat. **Yürürlükteki 5 değişiklik**
(commit `d4542c2` + `f4730b7`, detay: `CHANGELOG.md`):

1. **Silinen analizin cari hareketleri artık süzülüyor.** `storage.livePartyTransactionCondition(alias)`
   yardımcısı `party_transactions`'a dokunan **6 sorgunun tamamında** kullanılır. Yeni bir cari sorgusu
   yazan herkes bu yardımcıyı çağırmalıdır. **`NOT EXISTS` deseni bilinçlidir:** `INNER JOIN`'e
   çevrilirse `source_history_id` alanı `NULL` olan eski satırlar sessizce kaybolur (entegrasyon
   testi bu inceliği kilitler).
2. **Panelin tepe müşteri kutusu fatura hacminden beslenir**, manuel `customers.balance`'tan değil.
   Etiket: **"En Yüksek Fatura Hacimli Müşteri"**. `renderDashboardTopCustomer` bilerek renk sınıfı
   vermez (müşteri hacmi tanım gereği hep pozitiftir). `dashTotalCustomers` sayacının **tek** yazıcısı
   vardır (`loadBusinessPartyDashboardSummary`); ikinci bir yazıcı eklenirse yarış durumu geri gelir.
   Manuel müşteri CRUD akışı ve `customers.balance` alanı korunur.
3. **`getMonthlyTotals` / `getMonthlyTotalsInRange` artık `salesVat` ve `purchasesVat` de döndürür.**
   Ekleme yapıldı, mevcut `sales` / `purchases` / `vat` alanları birebir aynı. **Tuzak aynen duruyor:**
   `sales` ve `purchases` KDV **dahil**, `vat` ise satış+alış **birleşik**. Doğru türetme:
   `brüt kâr = (sales - salesVat) - (purchases - purchasesVat)`. `sales - purchases` brüt kâr DEĞİLDİR.
4. **Ölü tercih anahtarları kaldırıldı:** `predictions_layout_id`, `predictions_card_order` artık
   allowlist'te, varsayılan okuma listesinde ve migrate ucunda yok. DB satırları bilerek silinmedi.
5. **Bağımlılık:** `npm audit fix` (`--force` YOK) ile **20 açık → 8**. `package.json` değişmedi.
   Kalan 8'in **1'i kritik** (`tar` ← `node-gyp` ← `sqlite3` derleme zinciri) — bu tur eklemedi,
   önceden de vardı; yalnız `npm install` sırasında derleme yaparken çalışır, çalışan sunucu
   tetiklemez. Kapatmak kırıcı `sqlite3@6` ister.

**Bilinçli borç (kodda "BORÇ" notu var):** `src/server.js`'in iki ucu (`/api/dashboard/latest` ve özel
aralık) `getHistory({limit: 1000})` ile KDV'yi yeniden türetip storage'dan gelen dizileri **ezer**.
Sadeleştirilmedi çünkü sunucu bloğu önce JSON `totalTax`'ı, storage önce `sales_tax` kolonunu okur;
eski kayıtlarda ikisi ayrışabilir. Oradaki `limit: 1000` sessiz bir tavandır.

**Doğrulanan son durum:** lint temiz, **179 birim + 36 entegrasyon + 1 smoke** geçti. İki denetim
ajanı ONAY: test-uzmani düzeltmeleri geçici bozup testlerin gerçekten kırıldığını kanıtladı,
kod-inceleyici SQL enjeksiyonu / yetki / lockfile farkını denetledi.

Kalan muhtemel sonraki işler (hedef **lokal, tek kullanıcı** olduğu için hiçbiri acil değil):

- Bağımlılık: `xlsx` (npm'de yama yok) ve `sqlite3@6` (kırıcı) — yalnızca çok kullanıcılı/ağ
  senaryosuna geçilirse gerekir.
- MemoryStore yerine kalıcı session store — yalnızca sunucuya kurulursa gerekir.
- Büyük frontend refactor: inline `onclick` → `addEventListener` (CSP'den `'unsafe-inline'`
  kaldırılabilsin). Yeni yazılan karar panellerinde satır içi `onclick` zaten yok.
- `src/server.js`'in iki ucundaki KDV yeniden-türetmesini storage'ın dizilerine indirgemek
  (yukarıdaki "bilinçli borç"), `limit: 1000` tavanı dahil.
- Büyük veri setlerinde cari liste/detay performansını ve ARIMA sonuçlarını gözlemlemek.
- _(kapandı 2026-08-07)_ ~~Çöpten kalıcı silinen analizin cari hareketleri sahipsiz kalıp listede
  sayılıyor~~ — `livePartyTransactionCondition()` artık şu koşulu üretir: `source_history_id IS NULL`
  **VEYA** eşleşen `analyses` satırı var ve `deleted_at IS NULL`. Eski NULL satırlar yaşamaya devam
  eder; entegrasyon testi hem bu inceliği hem kalıcı silme senaryosunu kilitler. Sahipsiz satırlar
  silinmedi, yalnız süzülüyor (veri silme CEO onay kapısı).
- **CEO kararı bekleyen:** gerçek bakiye takibi (tahsilat/ödeme kaydı) — yukarıdaki "cari bakiye
  gerçeği" bölümüne bakın. Ayrıca eski raporların cari listesine katılması için ilgili Excel'lerin
  yeniden yüklenmesi gerekiyor: **15 dönemin cari hareketi yok** (Ocak–Aralık 2025, Ocak–Mart 2026);
  Nisan/Mayıs/Haziran 2026 dolu. Kaynak dosyalar bu bilgisayarda bulunmuyor, DB üzerinden backfill
  imkânsız — CEO dosyaları verecek.
- _(kapandı 2026-08-07)_ ~~Silinen analizin cari hareketleri listede kalıyor~~ · ~~öksüz tercih
  anahtarları~~ — ikisi de yukarıdaki sağlamlaştırma turunda düzeltildi.

## En Çok Sayfası Standartları

- Başlık kısadır: **"En Çok"** (eski "En Çok Satılan Firmalar ve Ürünler" kullanılmaz).
- Dönem seçimi **yıl + ay** olarak yapılır; ay `Tüm yıl` veya 1-12 değerlerini alır.
- Ay filtresi hem "En Çok Satış Yapılan Firmalar" hem "En Çok Alınan Tedarikçiler" listesine uygulanır.
- Dönem bilgisi dosya adından okunur (geçmiş ve panel ile aynı kural).
- API (`/api/analysis/top-customers`, `/api/analysis/top-products`) `month` parametresi alır ve
  yanıtta `month` alanını döndürür; eski alanlar korunur.

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
