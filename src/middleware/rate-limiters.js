const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

function buildAuthKey(req) {
    const ip = ipKeyGenerator(req.ip || req.headers['x-forwarded-for'] || 'unknown');
    const username = String(req.body?.username || '').trim().toLowerCase();
    return username ? `${ip}:${username}` : ip;
}

function readPositiveIntEnv(name, fallback) {
    const value = parseInt(process.env[name], 10);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getRateLimitConfig() {
    return {
        apiRateLimitWindow: readPositiveIntEnv('RATE_LIMIT_WINDOW', 15 * 60 * 1000),
        apiRateLimitMax: readPositiveIntEnv('RATE_LIMIT_MAX', 1500),
        authRateLimitMax: readPositiveIntEnv('AUTH_RATE_LIMIT_MAX', 60),
        loginRateLimitMax: readPositiveIntEnv('LOGIN_RATE_LIMIT_MAX', 10)
    };
}

function createRateLimiters({ isTestEnv }) {
    const {
        apiRateLimitWindow,
        apiRateLimitMax,
        authRateLimitMax,
        loginRateLimitMax
    } = getRateLimitConfig();

    const apiLimiter = rateLimit({
        windowMs: apiRateLimitWindow,
        max: apiRateLimitMax,
        message: { error: 'Çok fazla istek. Lütfen daha sonra tekrar deneyin.' },
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path === '/health' || req.path === '/api/health' || isTestEnv
    });

    const authLimiter = rateLimit({
        windowMs: apiRateLimitWindow,
        max: authRateLimitMax,
        message: { error: 'Çok fazla giriş denemesi. Lütfen daha sonra tekrar deneyin.' },
        standardHeaders: true,
        legacyHeaders: false,
        skip: () => isTestEnv
    });

    const loginLimiter = rateLimit({
        windowMs: apiRateLimitWindow,
        max: loginRateLimitMax,
        message: { error: 'Çok fazla giriş denemesi. Lütfen kısa bir süre sonra tekrar deneyin.' },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        keyGenerator: buildAuthKey,
        skip: () => isTestEnv
    });

    return {
        apiLimiter,
        authLimiter,
        loginLimiter
    };
}

module.exports = { createRateLimiters, getRateLimitConfig };
