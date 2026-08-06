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
            // Tahminler sayfası 2026-08-06'da sabit düzene geçti; `predictions_layout_id` ve
            // `predictions_card_order` anahtarları o gün anlamsızlaştı ve listeden çıkarıldı.
            // Eski DB satırları bilerek silinmedi (zararsız, veri silme CEO onay kapısıdır).
            const allowedKeys = ['theme', 'chartType'];

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
            // Yalnız tema taşınır: tarayıcıdaki eski localStorage tercihini bir kez DB'ye çeker.
            await storage.migrateUserPreferences(req.session.userId, {
                theme: body.theme ? sanitizeString(String(body.theme)) : undefined
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
