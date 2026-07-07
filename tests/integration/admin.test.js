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
});
