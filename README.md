# Analizcim

Analizcim, lokal Excel verileriyle çalışan; satış, alış, kâr, KDV, gider ve tahmin analizlerini daha anlaşılır hale getiren kullanıcı dostu bir finansal analiz uygulamasıdır.

## Kısa Tanım

Uygulama küçük işletmelerin ve finans ekiplerinin mevcut Excel raporlarını daha görsel, daha düzenli ve daha karar odaklı şekilde incelemesini sağlar. Dashboard ve Tahminler sayfaları, sadece veri sunmak yerine “durum ne, risk ne, şimdi ne yapmalıyım?” sorularına cevap vermeyi hedefler.

## Kimler İçin?

- Küçük işletme sahipleri
- Muhasebe ve finans kullanıcıları
- Kendi Excel verisini daha anlaşılır analiz etmek isteyen kullanıcılar
- Admin veya kontrol paneli kullanan ekip üyeleri

## Temel Özellikler

- Dashboard
- Excel analiz yükleme ve inceleme
- Satış, alış, brüt kâr ve net kâr takibi
- KDV özeti
- Kar/Zarar analizi
- Satış, alış ve net kâr trend grafikleri
- Tahminler / Gelecek Tahmini
- Otomatik model seçimli satış tahmini
- ARIMA destekli istatistiksel tahmin motoru
- Risk öncelikleri
- Senaryo analizi
- Aksiyon planı
- Geçmiş analizler
- Ayarlar ve tema yönetimi
- Dark/light tema desteği
- Collapsible sidebar
- Gider yönetimi
- Toplu geçmiş işlemleri
- Çoklu dosya birleştirme
- Çöp kutusu ve arşivleme
- Manuel müşteri yönetimi
- Excel'den otomatik müşteri ve tedarikçi çıkarımı
- Müşteri ve tedarikçi detay analitiği

## Cari Yönetimi

Uygulamada artık iki katmanlı cari yapısı bulunur:

- Manuel müşteri yönetimi: kullanıcı kendi müşteri kartlarını ekler, düzenler ve siler.
- Excel tabanlı cari analizi: satış dosyalarından müşteri, alış dosyalarından tedarikçi isimleri otomatik çıkarılır.

### Otomatik Çıkarım Mantığı

Excel yükleme sonrasında analiz satırları taranır ve uygun karşı taraf sütunu bulunduğunda şu eşleme yapılır:

- Satış satırları -> `Müşteri`
- Alış satırları -> `Tedarikçi`

Desteklenen karşı taraf başlık örnekleri:

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

Karşı taraf tespitinde cari/müşteri/tedarikçi başlıkları açıklama veya ürün gibi genel açıklama kolonlarına göre önceliklidir. Böylece satış dosyasında müşteri adı, alış dosyasında tedarikçi adı Dashboard ve ilgili sekmelere doğru aktarılır.

Her hareket için tarih, tutar, KDV, dosya kaynağı ve fatura yönü saklanır. Aynı Excel tekrar yüklendiğinde mükerrer hareket oluşmaması için benzersiz bir kaynak anahtarı kullanılır.

### Müşteriler ve Tedarikçiler

Sidebar içinde artık iki ayrı sekme vardır:

- `Müşteriler`
- `Tedarikçiler`

Bu sayfalarda kullanıcı:

- arama yapabilir
- tarih aralığı filtreleyebilir
- minimum işlem hacmi ile daraltabilir
- hacim, isim ve son işlem tarihine göre sıralayabilir

### Cari Detayları

Her müşteri veya tedarikçi detayında:

- toplam işlem hacmi
- net bakiye
- son işlem tarihi ve tutarı
- ortalama işlem tutarı
- aylık hacim grafiği
- son 12 ay trend grafiği
- tam hareket dökümü

gösterilir.

## Dashboard

Dashboard sayfası, işletmenin finansal görünümünü hızlı karar alınabilecek şekilde sunar.

Öne çıkan alanlar:

- Genel finansal durum özeti
- KPI kartları
- Finansal sağlık göstergeleri
- KDV görünümü
- Trend grafikleri
- Kar/Zarar tablosu
- Son değişimler
- İşletme için öncelikler
- Son eklenen analizler
- Toplam müşteri sayısı
- Toplam tedarikçi sayısı
- En yüksek hacimli müşteriler
- En yüksek hacimli tedarikçiler
- Son eklenen cari hareket özeti
- Önümüzdeki 3 ay için Tahmin Özeti widget'ı

Bu yapı sayesinde kullanıcı yalnızca sayıları değil, o sayıların ne anlama geldiğini de daha hızlı okuyabilir.

Ana KPI kartları iki satırlı, dengeli bir grid olarak düzenlenmiştir:

- Sıra 1: Toplam Satış, Toplam Alış, Brüt Kâr, Net Kâr
- Sıra 2: Toplam Analiz, Toplam Gider, Toplam Müşteri, Toplam Tedarikçi

Responsive davranış `1 / 2 / 4` kolon düzenini korur; masaüstünde 4 eşit kart, tablet görünümde 2 kolon, mobilde tek kolon kullanılır.

## Yıl Karşılaştırma

Yıl Karşılaştırma sayfası iki yıl arasındaki performansı modern SaaS raporu gibi sunar.

Öne çıkan alanlar:

- Satış Farkı, Maliyet Farkı ve Net Kâr Farkı için 3 YoY delta kartı
- Pozitif/negatif trend yönünü renk ve ok ile gösteren mikro KPI yapısı
- Ocak-Aralık satış ve alış değerlerini iki yıl için grouped bar chart ile gösteren grafik
- Aylık karşılaştırma tablosu
- Toplam satırıyla yıl genelindeki satış farkı ve değişim yüzdesi

Bu sayfa yıllık toplamlardan çok ay bazlı kırılmayı görünür kılar. Kullanıcı iki yıl seçip satış, alış ve net kâr yönünü aynı ekranda okuyabilir.

## Tahminler

Tahminler sayfası, önümüzdeki dönem için karar destek görünümü sunar. Sayfa artık yalnızca lineer regresyon çıktısı üretmez; satış verisi üzerinde birden fazla istatistiksel modeli karşılaştırır ve en düşük hata üreten modeli otomatik seçer.

Öne çıkan alanlar:

- Başlık ve filtreler: son 6 ay, son 12 ay veya tüm veri; otomatik veya manuel model seçimi
- Muhasebeci feedback kartı
- 1, 3, 6 ve 12 ay tahmin horizonları
- Geçmiş veri, tahmin çizgisi ve güven aralığı içeren ana grafik
- Model karşılaştırma tablosu
- Detaylı istatistikler ve model parametreleri
- Önümüzdeki dönem görünümü
- Risk ve senaryo takibi
- Finansal sağlık göstergeleri
- Aksiyon planı
- CFO analizi
- Model ve veri detayları

Amaç, tahmin verilerini sadece teknik bir model çıktısı olarak değil; yönetimsel karar akışının parçası olarak sunmaktır.

### Tahmin Motoru

Tahmin motoru `src/predictor.js` içinde çalışır ve aylık satış verisini temel alır. Mevcut response yapısı korunur; yeni alanlar ek olarak döner.

Desteklenen modeller:

- Linear Regresyon
- Exponential Smoothing
- Holt-Winters
- ARIMA

Model seçim mantığı:

- Her model için rolling backtest yapılır.
- MAE, RMSE ve mümkünse MAPE hesaplanır.
- Otomatik modda en düşük RMSE değerine sahip model seçilir.
- Manuel modda kullanıcı `linear`, `exponentialSmoothing`, `holtWinters` veya `arima` seçebilir.
- ARIMA modeli `arima` npm paketiyle çalışır; aday order'lar holdout RMSE ile seçilir.
- 24+ aylık veri varsa seasonal ARIMA adayı da değerlendirilir.

Yeni API parametreleri:

```text
GET /api/predictions?period=12&model=auto
GET /api/predictions?period=all&model=arima
```

Desteklenen `period` değerleri:

- `6`
- `12`
- `all`

Desteklenen `model` değerleri:

- `auto`
- `linear`
- `exponentialSmoothing`
- `holtWinters`
- `arima`

Ek response alanları:

- `allPredictions`
- `allConfidenceBands`
- `forecastHorizons`
- `modelSelection`
- `modelComparison`
- `accountantFeedback`
- `detailedStatistics`

Geriye dönük uyumluluk için `predictions`, `confidenceBands`, `trend`, `confidence`, `riskAssessment`, `ceoAnalysis`, `businessStats` gibi mevcut alanlar korunur.

### Muhasebeci Feedback Sistemi

Feedback kartı şu bilgileri doğal dilde özetler:

- 3 aylık tahmin toplamı
- %80 güven aralığı
- trend yönü ve şiddeti
- mevsimsel etki
- geçen yıl aynı dönem karşılaştırması
- aksiyon önerisi
- kritik uyarı

Bu bölüm muhasebecinin sayısal sonucu hızlı yorumlaması için sayfanın üst kısmında gösterilir.

## Arayüz ve Kullanıcı Deneyimi

- Modern dark/light SaaS tasarım dili
- Responsive grid yapısı
- Kompakt kart kullanımı
- Okunabilir tablolar
- Karar odaklı dashboard yaklaşımı
- Ayarlar sayfası üzerinden tema yönetimi
- Collapsible sidebar navigasyonu
- Global app header olmadan daha temiz app shell
- Sayfa içi başlık ve filtre satırlarının korunması

## Son UI/Theme Durumu

Yakın dönemde arayüz katmanında şu alanlar netleştirildi:

- Sidebar masaüstünde dar bir rail olarak başlar, açıldığında yaklaşık `240px` genişliğinde overlay panel gibi davranır.
- Sidebar açılış/kapanış geçişi kısa ve simetrik bir animasyon ile çalışır; ana içerik yer değiştirmez.
- Overlay ve blur efekti hafifletilmiştir; dark/light temada daha yumuşak görünür.
- Admin dropdown metin görünürlüğü her iki temada da düzeltilmiştir.
- Login, Ayarlar ve Analiz Geçmişi form alanları tema tokenları ile daha okunabilir hale getirilmiştir.
- Tema temizliği sırasında finansal pozitif/negatif renk semantiği geri kazandırılmıştır.
- Eski lacivert/mavi border veya yüzey kalıntılarının büyük bölümü yeni tema değişkenlerine taşınmıştır.
- Mobil sidebar sekme değişimlerinde güvenli kapanış akışı ile çalışır; ana içerik yer değiştirmez.
- Admin onay bekleyen kullanıcı polling’i yalnız ilgili görünüm aktifken çalışır.
- Favicon asset’i public olarak servis edilir; login redirect’ine düşmez.
- Ayarlar sidebar ikonu modern dişli ikonuyla eşitlendi; diğer navigasyon ikonlarıyla aynı `w-5 h-5` hizasında kalır.
- Tahminler sayfasında A tahmin tablosu yatay scroll ihtiyacı üretmeden responsive tablo düzenine alınmıştır.
- Tahminler sayfasında C Risk ve D Senaryo kartları masaüstünde eşit yükseklik/genişlik davranışıyla hizalanır.

## Geliştirici Notları

- Veri ve hesaplama logic’i korunmalıdır.
- UI değişikliklerinde mevcut data prop yapısı bozulmamalıdır.
- Yeni dependency dikkatli eklenmelidir. ARIMA için `arima` paketi bilinçli olarak eklenmiştir; nedeni gerçek ARIMA/SARIMA tahmini ihtiyacıdır.
- Theme-aware class veya token yaklaşımı tercih edilmelidir.
- Build, lint ve test akışları mümkünse çalıştırılmalıdır.
- App shell değişiklikleri dashboard veya tahmin içeriklerini bozmamalıdır.

## Proje Durumu

Analizcim aktif geliştirme sürecinde olan bir üründür. Uygulama son dönemde dashboard, tahminler, sidebar, app shell, tema yönetimi ve ayarlar sayfası tarafında önemli görsel ve kullanıcı deneyimi iyileştirmeleri almıştır.

Son geliştirme turunda Faz 1.5 cari analizi eklendi:

- Excel satış/alım satırlarından otomatik müşteri/tedarikçi çıkarımı
- Ayrı müşteri ve tedarikçi sekmeleri
- Cari detay grafik ve hareket dökümü
- Dashboard cari widget güncellemesi
- Tekrar yüklemede mükerrer hareket engelleme

Son UI/UX ve cari düzeltme turunda:

- Excel karşı taraf eşlemesinde `Cari Ünvanı`, `Müşteri`, `Tedarikçi` ve `Açıklama` varyasyonları daha güvenilir okundu
- Cari/müşteri/tedarikçi başlıkları açıklama kolonlarına göre öncelikli hale getirildi
- Dashboard müşteri ve tedarikçi sayaçlarının Excel import sonrası sıfır kalma riski azaltıldı
- Dashboard KPI grid’i iki satırlı 4 kolon SaaS düzenine alındı
- Tahminler sayfasında tablo taşması ve Risk/Senaryo kart hizalaması düzeltildi
- Yıl Karşılaştırma sayfası YoY delta kartları, grouped bar chart ve aylık toplam satırlı tablo yapısıyla yenilendi
- Ayarlar sidebar ikonu modern dişli ikonuyla değiştirildi

Son tahminleme geliştirme turunda:

- Tahminler sayfası modern karar destek yüzeyi olarak yenilendi
- Linear Regresyon, Exponential Smoothing, Holt-Winters ve ARIMA model karşılaştırması eklendi
- ARIMA için `arima@0.2.8` dependency eklendi
- Otomatik model seçimi RMSE öncelikli hale getirildi
- 1, 3, 6 ve 12 aylık horizon çıktıları eklendi
- Güven aralığı ve model karşılaştırma tablosu eklendi
- Muhasebeci feedback sistemi eklendi
- Dashboard'a Tahmin Özeti widget'ı eklendi
- Eski tahmin response alanları korunup yeni alanlar ek olarak döndürüldü

Genel durum:

- Ürün kullanılabilir durumdadır
- UI/UX tarafı belirgin şekilde olgunlaşmıştır
- Bazı alanlarda son polish, responsive kontrol ve kullanıcı testi ihtiyacı devam etmektedir

Son doğrulanan geliştirme turunda:

- `npm run lint` başarılı
- `npm test` başarılı; ortamda socket açma izni gerektiren integration case’ler test helper tarafından skip edildi
- `npm run test:unit` başarılı
- `npm run test:smoke` başarılı
- `npm run verify:fast` başarılı
- `NODE_ENV=test node --test tests/unit/analyzer.test.js` başarılı
- `NODE_ENV=test node --test tests/unit/analyzer.test.js tests/integration/business-parties.test.js tests/unit/ui-structure.test.js` başarılı; sandbox socket kısıtı olan business party integration case’leri skip edildi
- Tahmin motoru unit testleri başarılı: model seçimi, metrik hesaplama, horizon üretimi, native ARIMA, feedback kuralları
- `NODE_ENV=test node --test tests/integration/business-parties.test.js` başarılı
- Gerçek tarayıcıda `390px`, `768px`, `1440px` görünümleri doğrulandı
- Aynı Excel tekrar yüklendiğinde cari hareket sayıları sabit kaldı

Devam eden odak alanları:

- Genel entegrasyon test helper yapısındaki açık handle davranışının temizlenmesi
- Kalan grafik paletlerinin token bazlı sadeleştirilmesi
- Büyük veri setlerinde cari tablo performansının gözlenmesi

## Kurulum / Çalıştırma

Proje scriptleri `package.json` üzerinden doğrulanmıştır.

### Gereksinimler

- Node.js 18+
- npm

### Kurulum

```bash
npm install
cp .env.example .env
npm start
```

Uygulama varsayılan olarak:

```text
http://localhost:3000
```

adresinde çalışır.

### Güvenli Lokal QA Çalıştırma

Gerçek `.env`, gerçek DB veya gerçek kullanıcı verisiyle QA yapmak istemiyorsanız güvenli lokal test akışı aşağıdaki gibi tutulmalıdır:

```bash
HOST=127.0.0.1 \
PORT=3000 \
TEST_DATABASE_PATH=/private/tmp/analizcim-playwright.db \
BOOTSTRAP_ADMIN_USERNAME=qa_admin \
BOOTSTRAP_ADMIN_PASSWORD='Qa123456!' \
npm start
```

Notlar:

- Sadece `127.0.0.1` veya `localhost` üzerinde çalışın.
- Gerçek browser profillerine bağlanmayın; izole Playwright Chromium kullanın.
- Eğer çalışma ortamı `.env` dosyasını istemeden yüklüyorsa test server’ı `/private/tmp` gibi nötr bir çalışma dizininden başlatıp environment override’larının baskın olduğundan emin olun.
- Playwright MCP browser binary eksikse tercih edilen izole kurulum:

```bash
npx @playwright/mcp install-browser chrome-for-testing
```

- Genel Playwright Chromium eksikse alternatif kurulum:

```bash
npx playwright install chromium
```

### Kullanılabilir Scriptler

```bash
npm start
npm run lint
npm test
npm run test:unit
npm run test:integration
npm run test:smoke
npm run smoke
npm run verify:fast
npm run verify
```

Not:

- `test:integration` scripti projede mevcut olsa da mevcut helper altyapısında açık handle davranisi nedeniyle her zaman temiz kapanmayabilir.
- Faz 1.5 için kritik regresyon testi `tests/integration/business-parties.test.js` tekil olarak doğrulanmıştır.

## Yeni Session İçin Kısa Not

Projeye daha sonra dönüldüğünde önce şu alanlara bakılması önerilir:

- `public/styles.css`: tema tokenları, sidebar shell, overlay ve final cleanup override’ları
- `public/app.js`: sidebar shell event akışı, chart tooltip/theme yüzey okumaları ve Yıl Karşılaştırma chart render akışı
- `tests/unit/ui-structure.test.js`: güncel UI sözleşmeleri
- `tests/unit/auth-public-paths.test.js`: favicon gibi public asset path sözleşmeleri
- `src/predictor.js`: istatistiksel tahmin motoru, model karşılaştırma, ARIMA adaptörü ve feedback kuralları
- `tests/unit/predictor.test.js`: tahmin motoru regresyon testleri
- `src/analyzer.js`: Excel karşı taraf başlık önceliği ve cari mapping normalize akışı
- `src/storage.js`: cari import, detay metrikleri ve dashboard summary akışı
- `src/routes/business-parties.js`: müşteri/tedarikçi liste ve detay API yüzeyi
- `scripts/migrations/009_create_suppliers_and_party_transactions.js`: Faz 1.5 veri modeli

### İlk Admin Kurulumu

İlk admin hesabı bootstrap değişkenleriyle oluşturulabilir:

```bash
BOOTSTRAP_ADMIN_USERNAME=admin \
BOOTSTRAP_ADMIN_PASSWORD='GucluSifre123!' \
npm start
```

## Lisans / Not

`package.json` lisans alanı `ISC` olarak tanımlıdır.

Bu proje, lokal Excel analiz süreçlerini daha anlaşılır hale getirmek için geliştirilmiştir.
