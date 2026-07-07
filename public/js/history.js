(function () {
    async function fetchHistory(params = {}) {
        const qs = new URLSearchParams({
            limit: params.limit ?? 100,
            offset: params.offset ?? 0,
            sort: params.sort || 'date_desc'
        });

        if (params.year) qs.set('year', params.year);
        if (params.search) qs.set('search', params.search);
        if (params.type) qs.set('type', params.type);
        if (params.amountMin) qs.set('amount_min', params.amountMin);
        if (params.amountMax) qs.set('amount_max', params.amountMax);
        if (params.dateFrom) qs.set('date_from', params.dateFrom);
        if (params.dateTo) qs.set('date_to', params.dateTo);

        const { data } = await window.AnalizcimApi.requestJSON('/api/history?' + qs.toString());
        return data;
    }

    async function fetchHistoryCount() {
        const { data } = await window.AnalizcimApi.requestJSON('/api/history');
        return data;
    }

    window.AnalizcimHistoryApi = {
        fetchHistory,
        fetchHistoryCount
    };
})();
