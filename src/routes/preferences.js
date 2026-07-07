const logger = require('../logger');

function registerPreferenceRoutes(app, deps) {
    const {
        storage,
        sanitizeString
    } = deps;

    app.get('/api/user/preferences', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
        }
        try {
            const keys = req.query.keys ? String(req.query.keys).split(',').map((value) => value.trim()).filter(Boolean) : undefined;
            const preferences = await storage.getUserPreferences(req.session.userId, keys);
            return res.json({ success: true, preferences });
        } catch (error) {
            return res.status(500).json({ error: 'Tercihler yüklenirken hata oluştu.' });
        }
    });

    app.put('/api/user/preferences', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
        }
        try {
            const body = req.body || {};
            const allowedKeys = ['theme', 'predictions_layout_id', 'predictions_card_order', 'chartType'];

            for (const key of allowedKeys) {
                if (!Object.hasOwn(body, key)) continue;
                const rawValue = body[key];
                if (key === 'theme' && rawValue != null && !['light', 'dark'].includes(String(rawValue))) {
                    return res.status(400).json({ error: 'Geçersiz tema değeri.' });
                }
                const value = rawValue == null ? null : sanitizeString(String(rawValue));
                await storage.setUserPreference(req.session.userId, key, value);
            }

            const preferences = await storage.getUserPreferences(req.session.userId);
            return res.json({ success: true, preferences });
        } catch (error) {
            return res.status(500).json({ error: 'Tercihler kaydedilirken hata oluştu.' });
        }
    });

    app.post('/api/user/preferences/migrate', async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
        }
        try {
            const body = req.body || {};
            await storage.migrateUserPreferences(req.session.userId, {
                theme: body.theme ? sanitizeString(String(body.theme)) : undefined,
                predictions_layout_id: body.predictions_layout_id ? sanitizeString(String(body.predictions_layout_id)) : undefined,
                predictions_card_order: body.predictions_card_order ? sanitizeString(String(body.predictions_card_order)) : undefined
            });
            const preferences = await storage.getUserPreferences(req.session.userId);
            return res.json({ success: true, preferences });
        } catch (error) {
            logger.error({ err: error }, 'User preferences migrate error:');
            return res.status(500).json({ error: 'Tercih taşıma sırasında hata oluştu.' });
        }
    });
}

module.exports = { registerPreferenceRoutes };
