const logger = require('../logger');

function registerExpenseRoutes(app, deps) {
    const {
        storage,
        validateYear,
        validateMonth,
        validateAmount,
        sanitizeString
    } = deps;

    // Ön yüz gider adını `label` alanında gönderir (buildExpensesDataFromDOM); `name` eski/alternatif ad.
    function expenseItemLabel(item) {
        const raw = item && (item.label != null ? item.label : item.name);
        return typeof raw === 'string' ? raw : '';
    }

    function validateExpenseItems(items) {
        if (!Array.isArray(items)) return { valid: false, error: 'Giderler dizi olmalıdır.' };
        for (const item of items) {
            if (typeof expenseItemLabel(item) !== 'string') {
                return { valid: false, error: 'Gider adı metin olmalıdır.' };
            }
            if (item.amount != null) {
                const amountValidation = validateAmount(item.amount);
                if (!amountValidation.valid) {
                    return { valid: false, error: amountValidation.error };
                }
            }
        }
        return { valid: true };
    }

    // storage.setExpenseItems `label`, `id` ve `date` alanlarını okur; şekil birebir korunmalı,
    // aksi halde gider adı ve tarihi sessizce kaybolur.
    function sanitizeExpenseCollection(items) {
        return (items || []).map((item) => ({
            id: item.id != null ? sanitizeString(String(item.id)) : null,
            label: sanitizeString(expenseItemLabel(item)),
            amount: item.amount != null ? parseFloat(item.amount) : 0,
            date: item.date ? sanitizeString(String(item.date)) : ''
        }));
    }

    app.get('/api/expenses-local', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
        }
        try {
            let yearValue = '';
            if (req.query.year != null && req.query.year !== '') {
                const yearValidation = validateYear(req.query.year);
                if (!yearValidation.valid) {
                    return res.status(400).json({ error: yearValidation.error });
                }
                yearValue = String(yearValidation.value);
            }

            const monthValidation = validateMonth(req.query.month);
            if (!monthValidation.valid) {
                return res.status(400).json({ error: monthValidation.error });
            }

            const monthValue = monthValidation.value != null ? String(monthValidation.value) : 'all';
            const data = await storage.getExpenseItems(req.session.userId, yearValue, monthValue);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error({ err: error }, 'Expenses-local get error:');
            return res.status(500).json({ error: 'Giderler yüklenirken hata oluştu.' });
        }
    });

    app.put('/api/expenses-local', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
        }
        try {
            const { year, month, fixed, variable } = req.body || {};

            const yearValidation = validateYear(year);
            if (!yearValidation.valid) {
                return res.status(400).json({ error: yearValidation.error });
            }

            const monthValidation = validateMonth(month);
            if (!monthValidation.valid) {
                return res.status(400).json({ error: monthValidation.error });
            }

            if (fixed) {
                const fixedValidation = validateExpenseItems(fixed);
                if (!fixedValidation.valid) {
                    return res.status(400).json({ error: fixedValidation.error });
                }
            }
            if (variable) {
                const variableValidation = validateExpenseItems(variable);
                if (!variableValidation.valid) {
                    return res.status(400).json({ error: variableValidation.error });
                }
            }

            const monthStr = monthValidation.value != null ? String(monthValidation.value) : 'all';
            await storage.setExpenseItems(req.session.userId, yearValidation.value, monthStr, {
                fixed: sanitizeExpenseCollection(fixed),
                variable: sanitizeExpenseCollection(variable)
            });
            const data = await storage.getExpenseItems(req.session.userId, yearValidation.value, monthStr);
            return res.json({ success: true, data });
        } catch (error) {
            logger.error({ err: error }, 'Expenses-local put error:');
            return res.status(500).json({ error: 'Giderler kaydedilirken hata oluştu.' });
        }
    });

    app.post('/api/expenses-local/migrate', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
        }
        try {
            const items = Array.isArray(req.body?.items) ? req.body.items : [];

            for (const item of items) {
                if (!item.name || typeof item.name !== 'string') {
                    return res.status(400).json({ error: 'Gider adı gereklidir.' });
                }
                if (item.amount != null) {
                    const amountValidation = validateAmount(item.amount);
                    if (!amountValidation.valid) {
                        return res.status(400).json({ error: amountValidation.error });
                    }
                }
            }

            const sanitizedItems = items.map((item) => ({
                name: sanitizeString(item.name),
                amount: item.amount != null ? parseFloat(item.amount) : 0,
                category: item.category ? sanitizeString(item.category) : '',
                type: item.type ? sanitizeString(item.type) : 'fixed'
            }));

            await storage.migrateExpenseItems(req.session.userId, sanitizedItems);
            return res.json({ success: true });
        } catch (error) {
            logger.error({ err: error }, 'Expenses-local migrate error:');
            return res.status(500).json({ error: 'Gider taşıma sırasında hata oluştu.' });
        }
    });

    app.get('/api/expenses-local/years', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
        }
        try {
            const years = await storage.getExpenseItemYears(req.session.userId);
            return res.json({ success: true, years });
        } catch (error) {
            logger.error({ err: error }, 'Expenses-local years error:');
            return res.status(500).json({ error: 'Yıllar getirilirken hata oluştu.' });
        }
    });
}

module.exports = { registerExpenseRoutes };
