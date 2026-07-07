const logger = require('../logger');

const CUSTOMER_SORT_VALUES = ['created_desc', 'created_asc', 'name_asc', 'name_desc', 'balance_desc', 'balance_asc'];
const BALANCE_STATUS_VALUES = ['', 'all', 'positive', 'negative', 'zero'];

function registerCustomerRoutes(app, deps) {
    const {
        storage,
        validateEmail,
        validateId,
        validateSort,
        sanitizeString
    } = deps;

    function requireSession(req, res) {
        if (!req.session.userId) {
            res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
            return false;
        }
        return true;
    }

    function validateCustomerPayload(payload = {}, { allowBalance = false } = {}) {
        const firstName = sanitizeString(payload.firstName || '');
        const lastName = sanitizeString(payload.lastName || '');
        const phone = sanitizeString(payload.phone || '');
        const email = sanitizeString(payload.email || '').toLowerCase();
        const address = sanitizeString(payload.address || '');
        const taxNumber = sanitizeString(payload.taxNumber || '');
        const notes = sanitizeString(payload.notes || '');
        const balance = allowBalance ? Number(payload.balance || 0) : 0;

        if (!firstName) return { valid: false, error: 'Ad gereklidir.' };
        if (!lastName) return { valid: false, error: 'Soyad gereklidir.' };
        if (firstName.length > 80 || lastName.length > 80) {
            return { valid: false, error: 'Ad ve soyad en fazla 80 karakter olabilir.' };
        }
        if (email) {
            const emailValidation = validateEmail(email);
            if (!emailValidation.valid) return { valid: false, error: emailValidation.error };
        }
        if (phone && !/^\+?[0-9\s()\-]{7,24}$/.test(phone)) {
            return { valid: false, error: 'Telefon formatı geçersiz.' };
        }
        if (taxNumber && !/^[0-9A-Za-z\-]{3,32}$/.test(taxNumber)) {
            return { valid: false, error: 'Vergi numarası formatı geçersiz.' };
        }
        if (!Number.isFinite(balance) || Math.abs(balance) > 999999999999999) {
            return { valid: false, error: 'Bakiye geçersiz.' };
        }

        return {
            valid: true,
            value: { firstName, lastName, phone, email, address, taxNumber, balance, notes }
        };
    }

    app.get('/api/customers/summary', async (req, res) => {
        if (!requireSession(req, res)) return;
        try {
            const summary = await storage.getCustomerDashboardSummary(req.session.userId);
            res.json({ success: true, summary });
        } catch (error) {
            logger.error({ err: error }, 'Müşteri özeti hatası:');
            res.status(500).json({ error: 'Müşteri özeti yüklenirken hata oluştu.' });
        }
    });

    app.get('/api/customers', async (req, res) => {
        if (!requireSession(req, res)) return;
        try {
            const sortValidation = validateSort(req.query.sort, CUSTOMER_SORT_VALUES);
            if (!sortValidation.valid) return res.status(400).json({ error: sortValidation.error });

            const balanceStatus = String(req.query.balanceStatus || '');
            if (!BALANCE_STATUS_VALUES.includes(balanceStatus)) {
                return res.status(400).json({ error: 'Geçersiz bakiye filtresi.' });
            }

            const result = await storage.getCustomers(req.session.userId, {
                search: req.query.search || '',
                balanceStatus: balanceStatus === 'all' ? '' : balanceStatus,
                sort: sortValidation.value,
                limit: req.query.limit,
                offset: req.query.offset
            });
            res.json({ success: true, ...result });
        } catch (error) {
            logger.error({ err: error }, 'Müşteri listeleme hatası:');
            res.status(500).json({ error: 'Müşteriler yüklenirken hata oluştu.' });
        }
    });

    app.get('/api/customers/:id', async (req, res) => {
        if (!requireSession(req, res)) return;
        const idValidation = validateId(req.params.id);
        if (!idValidation.valid) return res.status(400).json({ error: idValidation.error });

        try {
            const customer = await storage.getCustomerById(req.session.userId, idValidation.value);
            if (!customer) return res.status(404).json({ error: 'Müşteri bulunamadı.' });
            res.json({ success: true, customer });
        } catch (error) {
            logger.error({ err: error }, 'Müşteri getirme hatası:');
            res.status(500).json({ error: 'Müşteri yüklenirken hata oluştu.' });
        }
    });

    app.post('/api/customers', async (req, res) => {
        if (!requireSession(req, res)) return;
        const validation = validateCustomerPayload(req.body, { allowBalance: false });
        if (!validation.valid) return res.status(400).json({ error: validation.error });

        try {
            const customer = await storage.createCustomer(req.session.userId, validation.value);
            res.status(201).json({ success: true, customer });
        } catch (error) {
            logger.error({ err: error }, 'Müşteri oluşturma hatası:');
            res.status(500).json({ error: 'Müşteri oluşturulurken hata oluştu.' });
        }
    });

    app.put('/api/customers/:id', async (req, res) => {
        if (!requireSession(req, res)) return;
        const idValidation = validateId(req.params.id);
        if (!idValidation.valid) return res.status(400).json({ error: idValidation.error });

        const validation = validateCustomerPayload(req.body, { allowBalance: true });
        if (!validation.valid) return res.status(400).json({ error: validation.error });

        try {
            const customer = await storage.updateCustomer(req.session.userId, idValidation.value, validation.value);
            if (!customer) return res.status(404).json({ error: 'Müşteri bulunamadı.' });
            res.json({ success: true, customer });
        } catch (error) {
            logger.error({ err: error }, 'Müşteri güncelleme hatası:');
            res.status(500).json({ error: 'Müşteri güncellenirken hata oluştu.' });
        }
    });

    app.delete('/api/customers/:id', async (req, res) => {
        if (!requireSession(req, res)) return;
        const idValidation = validateId(req.params.id);
        if (!idValidation.valid) return res.status(400).json({ error: idValidation.error });

        try {
            const deleted = await storage.deleteCustomer(req.session.userId, idValidation.value);
            if (!deleted) return res.status(404).json({ error: 'Müşteri bulunamadı.' });
            res.json({ success: true });
        } catch (error) {
            logger.error({ err: error }, 'Müşteri silme hatası:');
            res.status(500).json({ error: 'Müşteri silinirken hata oluştu.' });
        }
    });
}

module.exports = { registerCustomerRoutes };
