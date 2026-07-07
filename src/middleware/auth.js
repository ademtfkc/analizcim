const SESSION_PUBLIC_PATHS = ['/login.html', '/styles.css', '/app.js', '/index.html', '/favicon.ico', '/favicon.svg', '/api/login', '/api/register', '/api/health'];
const AUTH_PUBLIC_PATHS = ['/login.html', '/styles.css', '/favicon.ico', '/favicon.svg', '/api/login', '/api/register'];

function createSessionRefreshMiddleware(effectiveTimeout) {
    return (req, res, next) => {
        if (SESSION_PUBLIC_PATHS.includes(req.path) || req.path.startsWith('/api/login') || req.path.startsWith('/api/register')) {
            return next();
        }
        if (req.session && req.session.userId) {
            req.session.cookie.maxAge = effectiveTimeout;
        }
        next();
    };
}

function requireAuth(req, res, next) {
    if (req.session.userId) {
        return next();
    }

    if (AUTH_PUBLIC_PATHS.includes(req.path)) {
        return next();
    }

    if (req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
    }

    return res.redirect('/login.html');
}

function requireAdmin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
    }
    if (!req.session.isAdmin) {
        return res.status(403).json({ error: 'Bu işlem için admin yetkisi gereklidir.' });
    }
    return next();
}

module.exports = {
    createSessionRefreshMiddleware,
    requireAuth,
    requireAdmin
};
