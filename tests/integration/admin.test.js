const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestClient, seedUser, uniqueUsername } = require('../helpers/test-server');

describe('Integration Tests - Admin Endpoints', () => {
    test('audit logs endpoint requires admin access', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('member'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const response = await client.request('/api/admin/audit-logs');
        assert.equal(response.status, 403);
    });

    test('approving a pending user creates an audit log entry', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const admin = await seedUser({
            username: uniqueUsername('admin'),
            password: 'Test1234!',
            isAdmin: 1
        });
        const pendingUser = await seedUser({
            username: uniqueUsername('pending'),
            password: 'Test1234!',
            status: 'pending'
        });

        await client.login(admin.username, admin.password);

        const approveResponse = await client.request(`/api/admin/users/${pendingUser.id}/approve`, {
            method: 'POST'
        });
        assert.equal(approveResponse.status, 200);
        assert.equal(approveResponse.body.success, true);

        const logsResponse = await client.request('/api/admin/audit-logs?limit=20');
        assert.equal(logsResponse.status, 200);
        assert.equal(logsResponse.body.success, true);
        assert.ok(Array.isArray(logsResponse.body.logs));

        const auditEntry = logsResponse.body.logs.find((entry) => (
            entry.action === 'user.approve' &&
            String(entry.entityId) === String(pendingUser.id)
        ));

        assert.ok(auditEntry);
        assert.equal(auditEntry.actorUsername, admin.username);
        assert.equal(auditEntry.details.username, pendingUser.username);
    });

    test('database size endpoint is admin-only and returns a numeric size', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        // 1) Oturumsuz istek: giriş kapısına takılmalı
        const anonim = await client.request('/api/admin/db-size');
        assert.equal(anonim.status, 401);

        // 2) Admin olmayan kullanıcı: yetki kapısına takılmalı
        const uye = await seedUser({ username: uniqueUsername('member'), password: 'Test1234!' });
        await client.login(uye.username, uye.password);
        const uyeYaniti = await client.request('/api/admin/db-size');
        assert.equal(uyeYaniti.status, 403);

        // 3) Admin: sayısal boyut döner
        const admin = await seedUser({
            username: uniqueUsername('admin'),
            password: 'Test1234!',
            isAdmin: 1
        });
        await client.login(admin.username, admin.password);
        const adminYaniti = await client.request('/api/admin/db-size');
        assert.equal(adminYaniti.status, 200);
        assert.equal(adminYaniti.body.success, true);
        assert.equal(typeof adminYaniti.body.bytes, 'number');
        assert.ok(adminYaniti.body.bytes > 0);

        // Bilgi sızıntısı olmamalı: dosya yolu yanıta yazılmaz
        assert.equal(adminYaniti.body.path, undefined);
        assert.doesNotMatch(JSON.stringify(adminYaniti.body), /\.db|\//);
    });
});
