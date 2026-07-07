const logger = require('../logger');

function registerAuthRoutes(app, deps) {
    const {
        authLimiter,
        loginLimiter,
        bcrypt,
        db,
        storage,
        validatePassword,
        validateUsername,
        validateRequired,
        sanitizeString
    } = deps;

    app.post('/api/login', loginLimiter, (req, res) => {
        const { username, password } = req.body;

        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
            return res.status(400).json({ error: usernameValidation.error });
        }

        const passwordValidation = validateRequired(password, 'Şifre');
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.error });
        }

        const sanitizedUsername = sanitizeString(username);

        db.get('SELECT * FROM users WHERE username = ?', [sanitizedUsername], async (err, user) => {
            if (err) return res.status(500).json({ error: 'Sunucu hatası.' });
            if (!user) {
                return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
            }

            const match = await bcrypt.compare(password, user.password_hash);
            if (!match) {
                return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
            }

            const isAdminUser = user.is_admin === 1;
            const status = user.status || 'approved';

            if (!isAdminUser) {
                if (status === 'pending') {
                    return res.status(403).json({
                        error: 'Hesabınız henüz admin tarafından onaylanmadı. Onay sonrası giriş yapabilirsiniz.',
                        status: 'pending'
                    });
                }
                if (status === 'rejected') {
                    return res.status(403).json({
                        error: 'Hesabınız admin tarafından reddedilmiştir. Lütfen yöneticinize başvurun.',
                        status: 'rejected'
                    });
                }
            }

            // Session fixation koruması: girişte oturum kimliğini yenile
            req.session.regenerate((regenErr) => {
                if (regenErr) {
                    logger.error({ err: regenErr }, '[auth] Oturum yenileme hatası:');
                    return res.status(500).json({ error: 'Oturum başlatılamadı, lütfen tekrar deneyin.' });
                }
                req.session.userId = user.id;
                req.session.username = user.username;
                req.session.isAdmin = isAdminUser;
                return res.json({
                    success: true,
                    user: { id: user.id, username: user.username, is_admin: isAdminUser }
                });
            });
        });
    });

    app.post('/api/register', authLimiter, async (req, res) => {
        const { username, password, role } = req.body;

        const usernameValidation = validateUsername(username);
        if (!usernameValidation.valid) {
            return res.status(400).json({ error: usernameValidation.error });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.errors.join(' ') });
        }

        let isAdmin = false;
        if (role) {
            if (!req.session.isAdmin) {
                return res.status(403).json({ error: 'Bu işlem için admin yetkisi gereklidir.' });
            }
            if (!['admin', 'user'].includes(role)) {
                return res.status(400).json({ error: 'Geçersiz rol. "admin" veya "user" olmalıdır.' });
            }
            isAdmin = role === 'admin';
        }

        const sanitizedUsername = sanitizeString(username);

        try {
            const passwordHash = await bcrypt.hash(password, 10);
            const creatorIsAdmin = !!req.session?.isAdmin;
            const status = isAdmin ? 'approved' : (creatorIsAdmin ? 'approved' : 'pending');
            const result = await storage.createUser(sanitizedUsername, passwordHash, isAdmin ? 1 : 0, status);

            if (!result.success) {
                return res.status(400).json({ error: result.error });
            }

            return res.status(201).json({
                success: true,
                user: result.user,
                pending: result.user.status === 'pending',
                message: result.user.status === 'pending'
                    ? 'Kayıt alındı. Hesabınız admin tarafından onaylandıktan sonra giriş yapabilirsiniz.'
                    : 'Kayıt başarılı.'
            });
        } catch (err) {
            logger.error({ err }, 'Kayıt hatası:');
            return res.status(500).json({ error: 'Sunucu hatası.' });
        }
    });

    app.post('/api/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) return res.status(500).json({ error: 'Çıkış yapılamadı.' });
            return res.json({ success: true });
        });
    });

    app.post('/api/change-password', authLimiter, async (req, res) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
        }
        const { currentPassword, newPassword } = req.body;

        const currentPwdValidation = validateRequired(currentPassword, 'Mevcut şifre');
        if (!currentPwdValidation.valid) {
            return res.status(400).json({ error: currentPwdValidation.error });
        }

        const newPwdValidation = validateRequired(newPassword, 'Yeni şifre');
        if (!newPwdValidation.valid) {
            return res.status(400).json({ error: newPwdValidation.error });
        }

        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.valid) {
            return res.status(400).json({ error: passwordValidation.errors[0], errors: passwordValidation.errors });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({ error: 'Yeni şifre mevcut şifreden farklı olmalıdır.' });
        }

        db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], async (err, user) => {
            if (err) return res.status(500).json({ error: 'Sunucu hatası.' });
            if (!user) return res.status(401).json({ error: 'Oturum geçersiz.' });

            const match = await bcrypt.compare(currentPassword, user.password_hash);
            if (!match) {
                return res.status(400).json({ error: 'Mevcut şifre hatalı.' });
            }

            const newHash = await bcrypt.hash(newPassword, 10);
            db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, user.id], function (updateErr) {
                if (updateErr) return res.status(500).json({ error: 'Şifre güncellenemedi.' });
                return res.json({ success: true, message: 'Şifre başarıyla değiştirildi.' });
            });
        });
    });
}

module.exports = { registerAuthRoutes };
