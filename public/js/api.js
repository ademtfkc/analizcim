(function () {
    async function request(path, options = {}) {
        const response = await fetch(path, options);
        const raw = await response.text();

        let data = raw;
        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (_) {
            // Non-JSON response is returned as raw text.
        }

        return { response, data, raw };
    }

    async function requestJSON(path, options = {}) {
        const headers = { ...(options.headers || {}) };
        let body = options.body;

        if (options.json !== undefined) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(options.json);
        }

        return request(path, {
            ...options,
            headers,
            body
        });
    }

    window.AnalizcimApi = {
        request,
        requestJSON
    };
})();
