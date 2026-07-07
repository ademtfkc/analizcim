function isValidMonth(value) {
    return !value || /^\d{4}-\d{2}$/.test(String(value));
}

function registerBusinessPartyRoutes(app, deps) {
    const { storage, validateId, validateSort, sanitizeString } = deps;
    const allowedSorts = ['volume_desc', 'volume_asc', 'name_asc', 'name_desc', 'recent_desc'];

    app.get('/api/business-parties/dashboard-summary', async (req, res) => {
        try {
            const summary = await storage.getBusinessPartyDashboardSummary(req.session.userId);
            res.json({ success: true, summary });
        } catch (error) {
            console.error('Business party dashboard summary error:', error);
            res.status(500).json({ success: false, error: 'Cari dashboard özeti alınamadı.' });
        }
    });

    app.get('/api/business-parties', async (req, res) => {
        try {
            const type = String(req.query.type || 'customer');
            if (!['customer', 'supplier'].includes(type)) {
                return res.status(400).json({ success: false, error: 'Geçersiz cari türü.' });
            }

            const sortValidation = validateSort(req.query.sort || 'volume_desc', allowedSorts);
            if (!sortValidation.valid) return res.status(400).json({ success: false, error: sortValidation.error });
            const dateFrom = String(req.query.dateFrom || '').trim();
            const dateTo = String(req.query.dateTo || '').trim();
            if (!isValidMonth(dateFrom) || !isValidMonth(dateTo)) {
                return res.status(400).json({ success: false, error: 'Tarih filtresi YYYY-AA formatında olmalıdır.' });
            }

            const minVolumeRaw = req.query.minVolume;
            const minVolume = minVolumeRaw === undefined || minVolumeRaw === '' ? 0 : Number(minVolumeRaw);
            if (!Number.isFinite(minVolume) || minVolume < 0) {
                return res.status(400).json({ success: false, error: 'İşlem hacmi filtresi geçersiz.' });
            }

            const result = await storage.getBusinessParties(req.session.userId, {
                type,
                search: sanitizeString(req.query.search || ''),
                dateFrom,
                dateTo,
                minVolume,
                sort: sortValidation.value || 'volume_desc',
                limit: req.query.limit,
                offset: req.query.offset
            });
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Business party list error:', error);
            res.status(500).json({ success: false, error: 'Cari listesi alınamadı.' });
        }
    });

    app.get('/api/business-parties/:type/:id', async (req, res) => {
        try {
            const type = String(req.params.type || '');
            if (!['customer', 'supplier'].includes(type)) {
                return res.status(400).json({ success: false, error: 'Geçersiz cari türü.' });
            }
            const idValidation = validateId(req.params.id);
            if (!idValidation.valid) return res.status(400).json({ success: false, error: idValidation.error });

            const detail = await storage.getBusinessPartyDetail(req.session.userId, type, idValidation.value);
            if (!detail) {
                return res.status(404).json({ success: false, error: 'Cari bulunamadı.' });
            }
            res.json({ success: true, detail, ...detail });
        } catch (error) {
            console.error('Business party detail error:', error);
            res.status(500).json({ success: false, error: 'Cari detayı alınamadı.' });
        }
    });
}

module.exports = { registerBusinessPartyRoutes };
