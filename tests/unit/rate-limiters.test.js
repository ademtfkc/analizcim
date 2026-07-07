const { describe, test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { getRateLimitConfig } = require('../../src/middleware/rate-limiters');

const RATE_ENV_KEYS = [
    'RATE_LIMIT_WINDOW',
    'RATE_LIMIT_MAX',
    'AUTH_RATE_LIMIT_MAX',
    'LOGIN_RATE_LIMIT_MAX'
];

describe('Rate limiter configuration', () => {
    afterEach(() => {
        for (const key of RATE_ENV_KEYS) {
            delete process.env[key];
        }
    });

    test('defaults keep normal authenticated SPA browsing away from the API ceiling', () => {
        const config = getRateLimitConfig();

        assert.equal(config.apiRateLimitWindow, 15 * 60 * 1000);
        assert.ok(config.apiRateLimitMax >= 1000);
        assert.equal(config.authRateLimitMax, 60);
        // Giriş limiti kaba kuvvete karşı sıkılaştırıldı (200 → 10); yalnız başarısız denemeler sayılır
        assert.equal(config.loginRateLimitMax, 10);
    });

    test('environment overrides still control the API ceiling', () => {
        process.env.RATE_LIMIT_MAX = '42';

        const config = getRateLimitConfig();

        assert.equal(config.apiRateLimitMax, 42);
    });
});
