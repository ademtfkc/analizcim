# API Referansı

Bu dokümantasyon, Analizcim uygulamasının tüm API endpoint'lerini detaylı olarak açıklamaktadır.

## Genel Bilgiler

### Base URL
```
http://localhost:3000/api
```

### Kimlik Doğrulama
Tüm endpoint'ler (login/register hariç) oturum gerektirir. Oturum yönetimi `express-session` ile gerçekleştirilir.

**Kimlik Doğrulama Gerektirmeyen Endpoint'ler:**
- `POST /api/login`
- `POST /api/register`

**Admin Yetkisi Gerektiren Endpoint'ler:**
- `GET /api/users`
- `DELETE /api/users/:id`
- `PUT /api/users/:id/role`

### Rate Limiting
API istekleri için rate limit uygulanmaktadır:
- Genel API: 15 dakikada 100 istek
- Auth endpoint'leri: 15 dakikada 10 istek
- Login: 15 dakikada 5 istek

### Hata Kodları
| Kod | Açıklama |
|-----|----------|
| 400 | Geçersiz istek / Validation hatası |
| 401 | Oturum açılmamış |
| 403 | Yetkisiz erişim (admin gerekli) |
| 404 | Kayıt bulunamadı |
| 409 | Çakışma (duplicate) |
| 429 | Rate limit aşıldı |
| 500 | Sunucu hatası |

---

## Kimlik Doğrulama (Authentication)

### POST /api/login
Kullanıcı girişi yapar.

**Yetki:** Gerekli değil

**Request:**
```json
{
  "username": "admin",
  "password": "<parolanız>"
}
```

**Parametreler:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| username | string | Evet | Kullanıcı adı |
| password | string | Evet | Şifre |

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "is_admin": true
  }
}
```

**Response (Hata - 401):**
```json
{
  "error": "Geçersiz kullanıcı adı veya şifre."
}
```

---

### POST /api/register
Yeni kullanıcı kaydı oluşturur.

**Yetki:** Gerekli değil

**Request:**
```json
{
  "username": "yeni_kullanici",
  "password": "<yeni parola>"
}
```

**Parametreler:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| username | string | Evet | Kullanıcı adı (3-30 karakter, alfanumerik + alt çizgi) |
| password | string | Evet | Şifre (en az 6 karakter, 1 büyük harf, 1 küçük harf, 1 rakam) |

**Validation Kuralları:**
- Kullanıcı adı: 3-30 karakter, sadece harf, rakam ve alt çizgi
- Şifre: En az 6 karakter, en az 1 büyük harf, 1 küçük harf, 1 rakam

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "user": {
    "id": 2,
    "username": "yeni_kullanici"
  }
}
```

**Response (Hata - 400):**
```json
{
  "error": "Kullanıcı adı 3-30 karakter arasında olmalıdır."
}
```

---

### POST /api/logout
Kullanıcı çıkışı yapar.

**Yetki:** Gerekli

**Request:** Body gerekmez

**Response (Başarılı - 200):**
```json
{
  "success": true
}
```

---

### POST /api/change-password
Kullanıcı şifresini değiştirir.

**Yetki:** Gerekli

**Request:**
```json
{
  "currentPassword": "<mevcut parola>",
  "newPassword": "<yeni parola>"
}
```

**Parametreler:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| currentPassword | string | Evet | Mevcut şifre |
| newPassword | string | Evet | Yeni şifre |

**Validation Kuralları:**
- Yeni şifre en az 6 karakter olmalı
- En az 1 büyük harf, 1 küçük harf, 1 rakam içermeli
- Mevcut şifreden farklı olmalı

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "message": "Şifre başarıyla değiştirildi."
}
```

**Response (Hata - 400):**
```json
{
  "error": "Mevcut şifre hatalı."
}
```

---

## Analiz (Analysis)

### POST /api/analyze
Excel dosyalarını analiz eder ve sonuçları kaydeder.

**Yetki:** Gerekli

**Content-Type:** `multipart/form-data`

**Request:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| salesFile | file | Hayır | Satış Excel dosyası (.xlsx, .xls) |
| purchaseFile | file | Hayır | Alış Excel dosyası (.xlsx, .xls) |
| duplicateAction | string | Hayır | Çakışma durumunda işlem: `cancel`, `replace`, `version` |
| salesColumnMap | string | Hayır | Satış dosyası sütun eşlemesi (JSON) |
| purchaseColumnMap | string | Hayır | Alış dosyası sütun eşlemesi (JSON) |

**Sütun Eşleme Formatı:**
```json
{
  "date": "A",
  "counterparty": "B",
  "net": "C",
  "vat": "D",
  "gross": "E"
}
```

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "sales": {
    "totalAmount": 150000,
    "totalTax": 27000,
    "entries": [...]
  },
  "purchase": {
    "totalAmount": 100000,
    "totalTax": 18000,
    "entries": [...]
  },
  "profitLoss": {
    "amount": 50000,
    "percentage": 33.33
  },
  "historyId": 1
}
```

**Response (Çakışma - 409):**
```json
{
  "error": "Ocak 2025 için zaten bir satış raporu mevcut.",
  "duplicateType": "sales",
  "existingFile": "satislar_2025_01.xlsx",
  "duplicateAction": "required",
  "duplicateOptions": ["cancel", "replace", "version"],
  "duplicates": [...]
}
```

**Response (Hata - 400):**
```json
{
  "error": "En az bir Excel dosyası yüklemelisiniz."
}
```

---

## Geçmiş (History)

### GET /api/history
Analiz geçmişini listeler.

**Yetki:** Gerekli

**Query Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| year | number | Filtreleme için yıl |
| search | string | Arama terimi |
| sort | string | Sıralama: `date_asc`, `date_desc`, `id_asc`, `id_desc` |
| limit | number | Sayfa başına kayıt sayısı |
| offset | number | Kaydın başlangıç konumu |

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "history": [
    {
      "id": 1,
      "date": "2025-01-15",
      "displayDate": "Ocak 2025",
      "salesFileName": "satislar_2025_01.xlsx",
      "purchaseFileName": "alislar_2025_01.xlsx",
      "sales": {
        "totalAmount": 150000,
        "totalTax": 27000
      },
      "purchase": {
        "totalAmount": 100000,
        "totalTax": 18000
      },
      "profitLoss": {
        "amount": 50000
      }
    }
  ],
  "total": 10
}
```

---

### GET /api/history/:id
Belirli bir geçmiş kaydını getirir.

**Yetki:** Gerekli

**Path Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| id | number | Geçmiş kaydı ID |

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "entry": {
    "id": 1,
    "date": "2025-01-15",
    "salesFileName": "satislar_2025_01.xlsx",
    "purchaseFileName": "alislar_2025_01.xlsx",
    "sales": {...},
    "purchase": {...}
  }
}
```

**Response (Hata - 404):**
```json
{
  "error": "Kayıt bulunamadı."
}
```

---

### DELETE /api/history/:id
Belirli bir geçmiş kaydını siler.

**Yetki:** Gerekli

**Path Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| id | number | Geçmiş kaydı ID |

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "message": "Kayıt silindi."
}
```

**Response (Hata - 404):**
```json
{
  "error": "Kayıt bulunamadı."
}
```

---

### DELETE /api/history
Tüm geçmişi temizler.

**Yetki:** Gerekli

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "message": "Tüm geçmiş temizlendi."
}
```

---

## Dashboard

### GET /api/dashboard/latest
Dashboard için en güncel özet verilerini getirir.

**Yetki:** Gerekli

**Query Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| year | number | İstenen yıl (varsayılan: mevcut yıl) |

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "summary": {
    "total_sales": 1500000,
    "total_purchases": 1000000,
    "total_vat": 270000,
    "gross_profit": 500000,
    "total_expenses": 100000,
    "net_profit": 400000
  },
  "monthly": {
    "labels": ["2025-01", "2025-02", ...],
    "sales": [100000, 120000, ...],
    "purchases": [80000, 90000, ...],
    "vat": [18000, 21600, ...],
    "salesVat": [...],
    "purchasesVat": [...],
    "expenses": [...]
  },
  "deltas": [
    {
      "field": "Satış",
      "previous": 100000,
      "current": 120000,
      "diff": 20000,
      "pct": 20
    }
  ],
  "trend": {
    "direction": "yükselen",
    "slope": 1500.5
  }
}
```

---

## Tahminler (Predictions)

### GET /api/predictions
Gelecek aylar için satış, alış ve gider tahminlerini getirir.

**Yetki:** Gerekli

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "prediction": {
    "nextMonths": [
      {
        "month": "2025-07",
        "predictedSales": 125000,
        "predictedPurchases": 85000,
        "predictedExpenses": 8000,
        "predictedProfit": 32000
      }
    ],
    "trend": "yükselen"
  },
  "monthlyData": [
    {"month": "2025-01", "amount": 100000},
    {"month": "2025-02", "amount": 120000}
  ],
  "monthlyPurchases": [...],
  "avgMonthlyExpense": 8000
}
```

---

## Karşılaştırma (Comparison)

### GET /api/compare
İki yılı karşılaştırır.

**Yetki:** Gerekli

**Query Parametreleri:**
| Parametre | Tip | Zorunlu | Açıklama |
|-----------|-----|---------|----------|
| year1 | number | Evet | İlk yıl |
| year2 | number | Evet | İkinci yıl |

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "year1": {
    "year": 2024,
    "count": 12,
    "sales": 1200000,
    "purchase": 800000,
    "salesTax": 216000,
    "purchaseTax": 144000,
    "profit": 400000,
    "netTax": 72000,
    "expenses": 100000,
    "net_profit": 300000,
    "monthly": [
      {
        "month": 1,
        "monthName": "Ocak",
        "sales": 100000,
        "purchase": 80000,
        "profit": 20000
      }
    ]
  },
  "year2": {
    "year": 2025,
    "count": 10,
    "sales": 1500000,
    "purchase": 1000000,
    "salesTax": 270000,
    "purchaseTax": 180000,
    "profit": 500000,
    "netTax": 90000,
    "expenses": 120000,
    "net_profit": 380000,
    "monthly": [...]
  },
  "growth": {
    "sales": "25.0",
    "purchase": "25.0",
    "profit": "25.0",
    "net_profit": "26.7"
  }
}
```

---

## Giderler (Expenses)

### GET /api/expenses-local
Giderleri listeler.

**Yetki:** Gerekli

**Query Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| year | number | Filtreleme için yıl |
| month | number | Filtreleme için ay (1-12) |

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "data": {
    "year": "2025",
    "month": "01",
    "fixed": [
      {"name": "Kira", "amount": 5000, "category": "Sabit"}
    ],
    "variable": [
      {"name": "Elektrik", "amount": 800, "category": "Değişken"}
    ]
  }
}
```

---

### PUT /api/expenses-local
Giderleri günceller/kaydeder.

**Yetki:** Gerekli

**Request:**
```json
{
  "year": 2025,
  "month": 1,
  "fixed": [
    {"name": "Kira", "amount": 5000, "category": "Sabit"},
    {"name": "İnternet", "amount": 300, "category": "Sabit"}
  ],
  "variable": [
    {"name": "Elektrik", "amount": 800, "category": "Değişken"},
    {"name": "Su", "amount": 200, "category": "Değişken"}
  ]
}
```

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "data": {
    "year": "2025",
    "month": "01",
    "fixed": [...],
    "variable": [...]
  }
}
```

---

### POST /api/expenses-local/migrate
Giderleri taşır (farklı bir formattan içe aktarma).

**Yetki:** Gerekli

**Request:**
```json
{
  "items": [
    {"name": "Kira", "amount": 5000, "category": "Sabit", "type": "fixed"},
    {"name": "Elektrik", "amount": 800, "category": "Değişken", "type": "variable"}
  ]
}
```

**Response (Başarılı - 200):**
```json
{
  "success": true
}
```

---

### GET /api/expenses-local/years
Veri olan yılları getirir.

**Yetki:** Gerekli

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "years": [2024, 2025]
}
```

---

## Kullanıcı Yönetimi (User Management)

### GET /api/users
Tüm kullanıcıları listeler. (Admin Only)

**Yetki:** Admin gerekli

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "users": [
    {
      "id": 1,
      "username": "admin",
      "is_admin": 1,
      "created_at": "2025-01-01"
    }
  ]
}
```

---

### GET /api/users/:id
Belirli bir kullanıcıyı getirir.

**Yetki:** Gerekli

**Path Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| id | number | Kullanıcı ID |

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "is_admin": 1
  }
}
```

**Response (Hata - 404):**
```json
{
  "error": "Kullanıcı bulunamadı"
}
```

---

### DELETE /api/users/:id
Kullanıcıyı siler. (Admin Only - kendini silemez)

**Yetki:** Admin gerekli

**Path Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| id | number | Kullanıcı ID |

**Response (Başarılı - 200):**
```json
{
  "success": true
}
```

**Response (Hata - 400):**
```json
{
  "error": "Kendi hesabınızı silemezsiniz."
}
```

---

### PUT /api/users/:id/role
Kullanıcı rolünü günceller. (Admin Only)

**Yetki:** Admin gerekli

**Path Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| id | number | Kullanıcı ID |

**Request:**
```json
{
  "role": "admin"
}
```

**Rol Değerleri:** `admin`, `user`

**Response (Başarılı - 200):**
```json
{
  "success": true
}
```

**Response (Hata - 400):**
```json
{
  "error": "Geçersiz rol. \"admin\" veya \"user\" olmalıdır."
}
```

---

## Özetler (Summaries)

### GET /api/summaries/:year
Belirli bir yılın önceden hesaplanmış aylık özetlerini getirir.

**Yetki:** Gerekli

**Path Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| year | number | Yıl |

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "summaries": [
    {
      "month": "2025-01",
      "total_sales": 150000,
      "total_purchases": 100000,
      "total_vat": 27000,
      "gross_profit": 50000,
      "total_expenses": 10000,
      "net_profit": 40000
    }
  ]
}
```

---

### DELETE /api/summaries/:year/:month
Belirli bir ayın özetini siler.

**Yetki:** Gerekli

**Path Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| year | number | Yıl |
| month | number | Ay (1-12) |

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "message": "Özet silindi."
}
```

**Response (Hata - 404):**
```json
{
  "error": "Özet bulunamadı."
}
```

---

## Kullanıcı Tercihleri (User Preferences)

### GET /api/user/preferences
Kullanıcı tercihlerini getirir.

**Yetki:** Gerekli

**Query Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| keys | string | İstenen tercik anahtarları (virgülle ayrılmış) |

**İzin Verilen Anahtarlar:** `theme`, `predictions_layout_id`, `predictions_card_order`

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "preferences": {
    "theme": "dark",
    "predictions_layout_id": "layout_1",
    "predictions_card_order": "sales,purchases,expenses"
  }
}
```

---

### PUT /api/user/preferences
Kullanıcı tercihlerini günceller.

**Yetki:** Gerekli

**Request:**
```json
{
  "theme": "dark",
  "predictions_layout_id": "layout_2",
  "predictions_card_order": ["sales", "purchases", "expenses"]
}
```

**İzin Verilen Değerler:**
- theme: `light`, `dark`, `system`

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "preferences": {
    "theme": "dark",
    "predictions_layout_id": "layout_2",
    "predictions_card_order": "[\"sales\",\"purchases\",\"expenses\"]"
  }
}
```

---

### POST /api/user/preferences/migrate
Kullanıcı tercihlerini taşır.

**Yetki:** Gerekli

**Request:**
```json
{
  "theme": "dark",
  "predictions_layout_id": "layout_1",
  "predictions_card_order": "sales,expenses"
}
```

**Response (Başarılı - 200):**
```json
{
  "success": true,
  "preferences": {...}
}
```

---

## Dışa Aktarım (Export)

### GET /api/export/history
Analiz geçmişini Excel olarak dışa aktarır.

**Yetki:** Gerekli

**Response:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

**İndirilen Dosya:** `analizcim-gecmis.xlsx`

---

### GET /api/export/dashboard
Dashboard özetini Excel olarak dışa aktarır.

**Yetki:** Gerekli

**Query Parametreleri:**
| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| year | number | İstenen yıl (varsayılan: mevcut yıl) |

**Response:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

**İndirilen Dosya:** `analizcim-dashboard-2025.xlsx`

---

## Ek Bilgiler

### Dosya Adı Formatları
Excel dosyaları için beklenen format:
- Satış: `satislar_YYYY_AA.xlsx` (örn: `satislar_2025_01.xlsx`)
- Alış: `alislar_YYYY_AA.xlsx` (örn: `alislar_2025_01.xlsx`)

### Session Yönetimi
- Session timeout: .env dosyasında `SESSION_TIMEOUT` ile ayarlanabilir (milisaniye)
- Varsayılan: 24 saat
- Session yenileme: Her istekte otomatik olarak süre uzatılır

### Rate Limit Yanıtları
Rate limit aşıldığında dönen hata:
```json
{
  "error": "Çok fazla istek. Lütfen daha sonra tekrar deneyin."
}
```
