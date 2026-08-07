/**
 * Password validation utility
 * Validates password strength according to security requirements
 */

/**
 * Validate password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 * 
 * @param {string} password - The password to validate
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validatePassword(password) {
    const errors = [];

    // Check minimum 8 characters
    if (!password || password.length < 8) {
        errors.push('Şifre en az 8 karakter olmalıdır');
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
        errors.push('Şifre en az bir büyük harf içermelidir');
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
        errors.push('Şifre en az bir küçük harf içermelidir');
    }

    // Check for at least one digit
    if (!/[0-9]/.test(password)) {
        errors.push('Şifre en az bir rakam içermelidir');
    }

    // Check for at least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Şifre en az bir özel karakter içermelidir');
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Validate username
 * Requirements:
 * - Required, 3-50 characters
 * - Only alphanumeric and underscore
 * 
 * @param {string} username - The username to validate
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return { valid: false, error: 'Kullanıcı adı gereklidir.' };
    }
    
    const trimmed = username.trim();
    
    if (trimmed.length < 3) {
        return { valid: false, error: 'Kullanıcı adı en az 3 karakter olmalıdır.' };
    }
    
    if (trimmed.length > 50) {
        return { valid: false, error: 'Kullanıcı adı en fazla 50 karakter olabilir.' };
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        return { valid: false, error: 'Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir.' };
    }
    
    return { valid: true, error: null };
}

/**
 * Validate email address
 * Basic email format validation
 * 
 * @param {string} email - The email to validate
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return { valid: false, error: 'E-posta adresi gereklidir.' };
    }
    
    const trimmed = email.trim().toLowerCase();
    
    // Basic email regex pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailRegex.test(trimmed)) {
        return { valid: false, error: 'Geçerli bir e-posta adresi girin.' };
    }
    
    if (trimmed.length > 254) {
        return { valid: false, error: 'E-posta adresi çok uzun.' };
    }
    
    return { valid: true, error: null };
}

/**
 * Validate year
 * Requirements:
 * - 4 digits
 * - Between 2000-2100
 * 
 * @param {string|number} year - The year to validate
 * @returns {Object} - { valid: boolean, error: string|null, value: number|null }
 */
function validateYear(year) {
    if (year == null || year === '') {
        return { valid: false, error: 'Yıl gereklidir.', value: null };
    }
    
    const yearNum = parseInt(year, 10);
    
    if (isNaN(yearNum)) {
        return { valid: false, error: 'Yıl sayı olmalıdır.', value: null };
    }
    
    if (yearNum < 2000 || yearNum > 2100) {
        return { valid: false, error: 'Yıl 2000-2100 arasında olmalıdır.', value: null };
    }
    
    return { valid: true, error: null, value: yearNum };
}

/**
 * Validate month
 * Requirements:
 * - 1-12 or 01-12 format
 * 
 * @param {string|number} month - The month to validate
 * @returns {Object} - { valid: boolean, error: string|null, value: number|null }
 */
function validateMonth(month) {
    if (month == null || month === '' || month === 'all') {
        return { valid: true, error: null, value: null }; // 'all' is allowed
    }
    
    const monthNum = parseInt(month, 10);
    
    if (isNaN(monthNum)) {
        return { valid: false, error: 'Ay sayı olmalıdır.', value: null };
    }
    
    if (monthNum < 1 || monthNum > 12) {
        return { valid: false, error: 'Ay 1-12 arasında olmalıdır.', value: null };
    }
    
    return { valid: true, error: null, value: monthNum };
}

/**
 * Validate amount
 * Requirements:
 * - Numeric
 * - Positive
 * - Max 15 digits
 * 
 * @param {string|number} amount - The amount to validate
 * @returns {Object} - { valid: boolean, error: string|null, value: number|null }
 */
function validateAmount(amount) {
    if (amount == null || amount === '') {
        return { valid: false, error: 'Tutar gereklidir.', value: null };
    }
    
    const amountNum = typeof amount === 'number' ? amount : parseFloat(amount);
    
    if (isNaN(amountNum)) {
        return { valid: false, error: 'Tutar sayı olmalıdır.', value: null };
    }
    
    if (amountNum < 0) {
        return { valid: false, error: 'Tutar pozitif olmalıdır.', value: null };
    }
    
    // Check if it's too large (more than 15 digits)
    if (amountNum > 999999999999999) {
        return { valid: false, error: 'Tutar çok büyük.', value: null };
    }
    
    return { valid: true, error: null, value: amountNum };
}

function validateAmountRange(min, max) {
    let minValue = null;
    let maxValue = null;

    if (min != null && min !== '') {
        const minValidation = validateAmount(min);
        if (!minValidation.valid) {
            return { valid: false, error: `Minimum ${minValidation.error.charAt(0).toLowerCase()}${minValidation.error.slice(1)}`, min: null, max: null };
        }
        if (minValidation.value <= 0) {
            return { valid: false, error: 'Minimum tutar pozitif olmalıdır.', min: null, max: null };
        }
        minValue = minValidation.value;
    }

    if (max != null && max !== '') {
        const maxValidation = validateAmount(max);
        if (!maxValidation.valid) {
            return { valid: false, error: `Maksimum ${maxValidation.error.charAt(0).toLowerCase()}${maxValidation.error.slice(1)}`, min: null, max: null };
        }
        if (maxValidation.value <= 0) {
            return { valid: false, error: 'Maksimum tutar pozitif olmalıdır.', min: null, max: null };
        }
        maxValue = maxValidation.value;
    }

    if (minValue != null && maxValue != null && minValue > maxValue) {
        return { valid: false, error: 'Minimum tutar maksimum tutardan büyük olamaz.', min: null, max: null };
    }

    return { valid: true, error: null, min: minValue, max: maxValue };
}

function validateDateRange(dateFrom, dateTo) {
    const periodRegex = /^\d{4}-(0[1-9]|1[0-2])$/;
    let fromValue = null;
    let toValue = null;

    if (dateFrom != null && dateFrom !== '') {
        fromValue = String(dateFrom).trim();
        if (!periodRegex.test(fromValue)) {
            return { valid: false, error: 'Başlangıç tarihi YYYY-AA formatında olmalıdır.', dateFrom: null, dateTo: null };
        }
    }

    if (dateTo != null && dateTo !== '') {
        toValue = String(dateTo).trim();
        if (!periodRegex.test(toValue)) {
            return { valid: false, error: 'Bitiş tarihi YYYY-AA formatında olmalıdır.', dateFrom: null, dateTo: null };
        }
    }

    if (fromValue != null && toValue != null && fromValue > toValue) {
        return { valid: false, error: 'Başlangıç tarihi bitiş tarihinden sonra olamaz.', dateFrom: null, dateTo: null };
    }

    return { valid: true, error: null, dateFrom: fromValue, dateTo: toValue };
}

function validateFilterType(type) {
    if (type == null || type === '') {
        return { valid: true, error: null, value: '' };
    }

    const value = String(type).trim();
    if (!['sales', 'purchase'].includes(value)) {
        return { valid: false, error: 'Geçersiz filtre türü.', value: '' };
    }

    return { valid: true, error: null, value };
}

/**
 * Validate required field
 * Check if required field exists and is not empty
 * 
 * @param {any} value - The value to check
 * @param {string} fieldName - The name of the field for error message
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateRequired(value, fieldName) {
    if (value == null || value === '') {
        return { valid: false, error: `${fieldName} gereklidir.` };
    }
    
    if (typeof value === 'string' && value.trim() === '') {
        return { valid: false, error: `${fieldName} gereklidir.` };
    }
    
    return { valid: true, error: null };
}

/**
 * Sanitize string
 * Remove potentially dangerous characters and prevent XSS
 * 
 * @param {string} str - The string to sanitize
 * @returns {string} - The sanitized string
 */
function sanitizeString(str) {
    if (str == null || typeof str !== 'string') {
        return '';
    }
    
    let sanitized = str;
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Remove control characters (except newlines and tabs which might be needed)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Escape HTML entities to prevent XSS
    const htmlEntities = {
        '&': '&',
        '<': '<',
        '>': '>',
        '"': '"',
        "'": '&#x27;',
        '/': '&#x2F;'
    };
    
    sanitized = sanitized.replace(/[&<>"'\/]/g, char => htmlEntities[char]);
    
    return sanitized;
}

/**
 * Validate pagination parameters
 * 
 * @param {string|number} limit - The limit parameter
 * @param {string|number} offset - The offset parameter
 * @returns {Object} - { valid: boolean, error: string|null, limit: number, offset: number }
 */
function validatePagination(limit, offset) {
    let limitNum = 100;
    let offsetNum = 0;
    
    if (limit != null && limit !== '') {
        limitNum = parseInt(limit, 10);
        if (isNaN(limitNum) || limitNum < 1) {
            return { valid: false, error: 'Geçersiz limit değeri.', limit: 100, offset: 0 };
        }
        if (limitNum > 1000) {
            limitNum = 1000; // Cap at 1000
        }
    }
    
    if (offset != null && offset !== '') {
        offsetNum = parseInt(offset, 10);
        if (isNaN(offsetNum) || offsetNum < 0) {
            return { valid: false, error: 'Geçersiz offset değeri.', limit: limitNum, offset: 0 };
        }
    }
    
    return { valid: true, error: null, limit: limitNum, offset: offsetNum };
}

/**
 * Validate sort parameter
 * 
 * @param {string} sort - The sort parameter
 * @param {string[]} allowedValues - Allowed sort values
 * @returns {Object} - { valid: boolean, error: string|null, value: string }
 */
function validateSort(sort, allowedValues = ['date_desc', 'date_asc', 'amount_desc', 'amount_asc']) {
    if (!sort || sort === '') {
        return { valid: true, error: null, value: 'date_desc' };
    }
    
    if (!allowedValues.includes(sort)) {
        return { valid: false, error: 'Geçersiz sıralama parametresi.', value: 'date_desc' };
    }
    
    return { valid: true, error: null, value: sort };
}

/**
 * Validate ID parameter
 * 
 * @param {string|number} id - The ID to validate
 * @returns {Object} - { valid: boolean, error: string|null, value: number|null }
 */
function validateId(id) {
    if (id == null || id === '') {
        return { valid: false, error: 'ID gereklidir.', value: null };
    }

    const strId = String(id).trim();
    if (strId.length === 0) {
        return { valid: false, error: 'ID gereklidir.', value: null };
    }

    return { valid: true, error: null, value: strId };
}

/**
 * Excel/CSV formül enjeksiyonu koruması. Bir hücre değeri `=`, `+`, `-`, `@`, tab veya CR ile
 * başlıyorsa, hücreyi açan uygulama (Excel/Sheets) onu formül olarak yorumlar. Başına tek tırnak
 * ekleyerek metni zararsızlaştırır. Sadece string değerlere uygulanır; sayı/tarih değişmez.
 */
function neutralizeSpreadsheetCell(value) {
    if (typeof value !== 'string' || value.length === 0) return value;
    return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/**
 * Yüklenen dosya adındaki Türkçe karakter bozulmasını onarır.
 *
 * Sorun: multipart form gövdesindeki dosya adını busboy varsayılan olarak latin1 okur.
 * `nisan_2026_satış.xlsx` bu yüzden `nisan_2026_satÄ±s.xlsx` olarak gelir ve veritabanına
 * da böyle yazılır (2026-08-07 tarayıcı denetiminde yakalandı).
 *
 * Çözüm: adı latin1 baytlarına geri çevirip UTF-8 olarak yeniden okur. Dönüşüm bozuk
 * çıkarsa (replacement karakteri) veya adda zaten latin1 üstü karakter yoksa ad
 * OLDUĞU GİBİ döner — yani ASCII adlar ve hâlihazırda doğru adlar etkilenmez.
 */
function repairUploadFilename(name) {
    if (typeof name !== 'string' || name.length === 0) return name;
    // Mojibake izi: latin1 okunmuş UTF-8 baytları bu aralıkta görünür (Ã, Ä, Å, Â ...).
    if (!/[À-ÿ]/.test(name)) return name;
    let decoded;
    try {
        decoded = Buffer.from(name, 'latin1').toString('utf8');
    } catch (_) {
        return name;
    }
    if (decoded.includes('�')) return name;
    return decoded;
}

module.exports = {
    validatePassword,
    validateUsername,
    validateEmail,
    validateYear,
    validateMonth,
    validateAmount,
    validateAmountRange,
    validateDateRange,
    validateFilterType,
    validateRequired,
    sanitizeString,
    validatePagination,
    validateSort,
    validateId,
    neutralizeSpreadsheetCell,
    repairUploadFilename
};
