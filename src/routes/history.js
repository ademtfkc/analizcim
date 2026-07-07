function registerHistoryRoutes(app, deps) {
    const {
        storage,
        validateYear,
        validateMonth,
        validateAmount,
        validateAmountRange,
        validateDateRange,
        validateFilterType,
        validatePagination,
        validateSort,
        validateId,
        sanitizeString
    } = deps;

    app.get('/api/history', async (req, res) => {
        try {
            const userId = req.session.userId;

            let yearValue = null;
            if (req.query.year != null && req.query.year !== '') {
                const yearValidation = validateYear(req.query.year);
                if (!yearValidation.valid) {
                    return res.status(400).json({ error: yearValidation.error });
                }
                yearValue = yearValidation.value;
            }

            let monthValue = null;
            if (req.query.month != null && req.query.month !== '') {
                const monthValidation = validateMonth(req.query.month);
                if (!monthValidation.valid) {
                    return res.status(400).json({ error: monthValidation.error });
                }
                monthValue = monthValidation.value;
            }

            const paginationValidation = validatePagination(req.query.limit, req.query.offset);
            if (!paginationValidation.valid) {
                return res.status(400).json({ error: paginationValidation.error });
            }

            const sortValidation = validateSort(req.query.sort);
            if (!sortValidation.valid) {
                return res.status(400).json({ error: sortValidation.error });
            }

            const typeValidation = validateFilterType(req.query.type);
            if (!typeValidation.valid) {
                return res.status(400).json({ error: typeValidation.error });
            }

            const amountRangeValidation = validateAmountRange(req.query.amount_min, req.query.amount_max);
            if (!amountRangeValidation.valid) {
                return res.status(400).json({ error: amountRangeValidation.error });
            }

            const dateRangeValidation = validateDateRange(req.query.date_from, req.query.date_to);
            if (!dateRangeValidation.valid) {
                return res.status(400).json({ error: dateRangeValidation.error });
            }

            const searchValue = req.query.search ? sanitizeString(req.query.search) : '';

            const options = {
                userId,
                year: yearValue,
                month: monthValue,
                search: searchValue,
                type: typeValidation.value,
                amount_min: amountRangeValidation.min,
                amount_max: amountRangeValidation.max,
                date_from: dateRangeValidation.dateFrom,
                date_to: dateRangeValidation.dateTo,
                sort: sortValidation.value,
                limit: paginationValidation.limit,
                offset: paginationValidation.offset
            };
            const [history, total] = await Promise.all([
                storage.getHistory(options),
                options.limit ? storage.getHistoryCount(options) : Promise.resolve(null)
            ]);
            if (total !== null) {
                return res.json({ success: true, history, total });
            }
            return res.json({ success: true, history });
        } catch (error) {
            return res.status(500).json({ error: 'Geçmiş yüklenirken hata oluştu.' });
        }
    });

    app.post('/api/history/batch-delete', async (req, res) => {
        try {
            const userId = req.session.userId;
            const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
            if (!ids || ids.length === 0) {
                return res.status(400).json({ error: 'Silinecek kayıt seçilmelidir.' });
            }

            const validatedIds = [];
            for (const id of ids) {
                const idValidation = validateId(id);
                if (!idValidation.valid) {
                    return res.status(400).json({ error: idValidation.error });
                }
                validatedIds.push(String(idValidation.value));
            }

            const deleted = await storage.deleteHistoryBatch(validatedIds, userId);
            return res.json({ success: true, deleted });
        } catch (error) {
            return res.status(500).json({ error: 'Kayıtlar silinirken hata oluştu.' });
        }
    });

    app.get('/api/history/:id', async (req, res) => {
        try {
            const userId = req.session.userId;

            const idValidation = validateId(req.params.id);
            if (!idValidation.valid) {
                return res.status(400).json({ error: idValidation.error });
            }

            const entry = await storage.getHistoryById(idValidation.value, userId);
            if (!entry) {
                return res.status(404).json({ error: 'Kayıt bulunamadı.' });
            }
            return res.json({ success: true, entry });
        } catch (error) {
            return res.status(500).json({ error: 'Kayıt yüklenirken hata oluştu.' });
        }
    });

    app.put('/api/history/:id', async (req, res) => {
        try {
            const userId = req.session.userId;

            const idValidation = validateId(req.params.id);
            if (!idValidation.valid) {
                return res.status(400).json({ error: idValidation.error });
            }

            const updates = {};
            if (req.body?.sales != null) {
                if (typeof req.body.sales !== 'object' || Array.isArray(req.body.sales)) {
                    return res.status(400).json({ error: 'Satış bilgileri geçersiz.' });
                }
                updates.sales = {};
                if (req.body.sales.totalAmount != null) {
                    const amountValidation = validateAmount(req.body.sales.totalAmount);
                    if (!amountValidation.valid) return res.status(400).json({ error: amountValidation.error });
                    updates.sales.totalAmount = amountValidation.value;
                }
                if (req.body.sales.totalTax != null) {
                    const taxValidation = validateAmount(req.body.sales.totalTax);
                    if (!taxValidation.valid) return res.status(400).json({ error: taxValidation.error });
                    updates.sales.totalTax = taxValidation.value;
                }
            }

            if (req.body?.purchase != null) {
                if (typeof req.body.purchase !== 'object' || Array.isArray(req.body.purchase)) {
                    return res.status(400).json({ error: 'Alış bilgileri geçersiz.' });
                }
                updates.purchase = {};
                if (req.body.purchase.totalAmount != null) {
                    const amountValidation = validateAmount(req.body.purchase.totalAmount);
                    if (!amountValidation.valid) return res.status(400).json({ error: amountValidation.error });
                    updates.purchase.totalAmount = amountValidation.value;
                }
                if (req.body.purchase.totalTax != null) {
                    const taxValidation = validateAmount(req.body.purchase.totalTax);
                    if (!taxValidation.valid) return res.status(400).json({ error: taxValidation.error });
                    updates.purchase.totalTax = taxValidation.value;
                }
            }

            if (req.body?.displayDate != null) {
                updates.displayDate = sanitizeString(req.body.displayDate).slice(0, 255);
            }

            if (req.body?.summary != null) {
                updates.summary = sanitizeString(req.body.summary).slice(0, 5000);
            }

            const entry = await storage.updateHistoryEntry(String(idValidation.value), userId, updates);
            if (!entry) {
                return res.status(404).json({ error: 'Kayıt bulunamadı.' });
            }
            return res.json({ success: true, entry });
        } catch (error) {
            return res.status(500).json({ error: 'Kayıt güncellenirken hata oluştu.' });
        }
    });

    app.delete('/api/history/:id', async (req, res) => {
        try {
            const userId = req.session.userId;

            const idValidation = validateId(req.params.id);
            if (!idValidation.valid) {
                return res.status(400).json({ error: idValidation.error });
            }

            const deleted = await storage.deleteHistoryById(idValidation.value, userId);
            if (!deleted) {
                return res.status(404).json({ error: 'Kayıt bulunamadı.' });
            }
            return res.json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Kayıt silinirken hata oluştu.' });
        }
    });

    app.delete('/api/history', async (req, res) => {
        try {
            await storage.clearHistory(req.session.userId);
            return res.json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Geçmiş temizlenirken hata oluştu.' });
        }
    });

    // ============================================
    // TRASH ENDPOINTS
    // ============================================

    app.get('/api/trash', async (req, res) => {
        try {
            const userId = req.session.userId;
            const trash = await storage.getTrashHistory(userId);
            return res.json({ success: true, trash, total: trash.length });
        } catch (error) {
            return res.status(500).json({ error: 'Çöp kutusu yüklenirken hata oluştu.' });
        }
    });

    app.get('/api/trash/count', async (req, res) => {
        try {
            const userId = req.session.userId;
            const count = await storage.getTrashCount(userId);
            return res.json({ success: true, count });
        } catch (error) {
            return res.status(500).json({ error: 'Çöp kutusu sayısı alınırken hata oluştu.' });
        }
    });

    app.post('/api/trash/:id/restore', async (req, res) => {
        try {
            const userId = req.session.userId;
            const idValidation = validateId(req.params.id);
            if (!idValidation.valid) {
                return res.status(400).json({ error: idValidation.error });
            }
            const restored = await storage.restoreFromTrash(idValidation.value, userId);
            if (!restored) {
                return res.status(404).json({ error: 'Kayıt bulunamadı.' });
            }
            return res.json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Kayıt geri alınırken hata oluştu.' });
        }
    });

    app.post('/api/trash/batch-restore', async (req, res) => {
        try {
            const userId = req.session.userId;
            const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
            if (!ids || ids.length === 0) {
                return res.status(400).json({ error: 'Geri alınacak kayıt seçilmelidir.' });
            }
            const validatedIds = [];
            for (const id of ids) {
                const idValidation = validateId(id);
                if (!idValidation.valid) {
                    return res.status(400).json({ error: idValidation.error });
                }
                validatedIds.push(String(idValidation.value));
            }
            const restored = await storage.restoreHistoryBatch(validatedIds, userId);
            return res.json({ success: true, restored });
        } catch (error) {
            return res.status(500).json({ error: 'Kayıtlar geri alınırken hata oluştu.' });
        }
    });

    app.delete('/api/trash/:id', async (req, res) => {
        try {
            const userId = req.session.userId;
            const idValidation = validateId(req.params.id);
            if (!idValidation.valid) {
                return res.status(400).json({ error: idValidation.error });
            }
            const deleted = await storage.permanentlyDeleteFromTrash(idValidation.value, userId);
            if (!deleted) {
                return res.status(404).json({ error: 'Kayıt bulunamadı.' });
            }
            return res.json({ success: true });
        } catch (error) {
            return res.status(500).json({ error: 'Kayıt kalıcı olarak silinirken hata oluştu.' });
        }
    });

    app.post('/api/trash/batch-delete', async (req, res) => {
        try {
            const userId = req.session.userId;
            const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;
            if (!ids || ids.length === 0) {
                return res.status(400).json({ error: 'Silinecek kayıt seçilmelidir.' });
            }
            const validatedIds = [];
            for (const id of ids) {
                const idValidation = validateId(id);
                if (!idValidation.valid) {
                    return res.status(400).json({ error: idValidation.error });
                }
                validatedIds.push(String(idValidation.value));
            }
            const deleted = await storage.permanentlyDeleteTrashBatch(validatedIds, userId);
            return res.json({ success: true, deleted });
        } catch (error) {
            return res.status(500).json({ error: 'Kayıtlar kalıcı olarak silinirken hata oluştu.' });
        }
    });

    app.delete('/api/trash', async (req, res) => {
        try {
            const userId = req.session.userId;
            const deleted = await storage.emptyTrash(userId);
            return res.json({ success: true, deleted });
        } catch (error) {
            return res.status(500).json({ error: 'Çöp kutusu temizlenirken hata oluştu.' });
        }
    });
}

module.exports = { registerHistoryRoutes };
