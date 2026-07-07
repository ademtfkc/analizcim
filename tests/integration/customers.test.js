const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { createTestClient, seedUser, uniqueUsername } = require('../helpers/test-server');

describe('Integration Tests - Customers', () => {
    test('customers endpoint requires authentication', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const response = await client.request('/api/customers');
        assert.equal(response.status, 401);
    });

    test('customers can be created, listed, updated, summarized and deleted per user', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('customers'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const createResponse = await client.request('/api/customers', {
            method: 'POST',
            json: {
                firstName: 'Ayse',
                lastName: 'Yilmaz',
                phone: '+90 532 111 22 33',
                email: 'ayse@example.com',
                address: 'Istanbul',
                taxNumber: '1234567890',
                notes: 'Oncelikli musteri'
            }
        });

        assert.equal(createResponse.status, 201);
        assert.equal(createResponse.body.success, true);
        assert.equal(createResponse.body.customer.balance, 0);

        const id = createResponse.body.customer.id;
        const listResponse = await client.request('/api/customers?search=ayse&sort=name_asc');
        assert.equal(listResponse.status, 200);
        assert.equal(listResponse.body.total, 1);
        assert.equal(listResponse.body.customers[0].email, 'ayse@example.com');

        const updateResponse = await client.request(`/api/customers/${id}`, {
            method: 'PUT',
            json: {
                firstName: 'Ayse',
                lastName: 'Kaya',
                phone: '+90 532 111 22 33',
                email: 'ayse.kaya@example.com',
                address: 'Ankara',
                taxNumber: '1234567890',
                balance: 2500,
                notes: 'Guncellendi'
            }
        });

        assert.equal(updateResponse.status, 200);
        assert.equal(updateResponse.body.customer.lastName, 'Kaya');
        assert.equal(updateResponse.body.customer.balance, 2500);

        const summaryResponse = await client.request('/api/customers/summary');
        assert.equal(summaryResponse.status, 200);
        assert.equal(summaryResponse.body.summary.totalCount, 1);
        assert.equal(summaryResponse.body.summary.highestBalanceCustomer.fullName, 'Ayse Kaya');
        assert.equal(summaryResponse.body.summary.recentCustomers.length, 1);

        const deleteResponse = await client.request(`/api/customers/${id}`, { method: 'DELETE' });
        assert.equal(deleteResponse.status, 200);
        assert.equal(deleteResponse.body.success, true);

        const afterDeleteResponse = await client.request('/api/customers');
        assert.equal(afterDeleteResponse.body.total, 0);
    });

    test('customer validation rejects missing names and malformed email or phone', async (t) => {
        const client = await createTestClient(t);
        if (!client) return;

        const user = await seedUser({ username: uniqueUsername('customer_validation'), password: 'Test1234!' });
        await client.login(user.username, user.password);

        const missingName = await client.request('/api/customers', {
            method: 'POST',
            json: { firstName: '', lastName: 'Yilmaz' }
        });
        assert.equal(missingName.status, 400);

        const malformedEmail = await client.request('/api/customers', {
            method: 'POST',
            json: { firstName: 'Ali', lastName: 'Yilmaz', email: 'bad-email' }
        });
        assert.equal(malformedEmail.status, 400);

        const malformedPhone = await client.request('/api/customers', {
            method: 'POST',
            json: { firstName: 'Ali', lastName: 'Yilmaz', phone: 'abc' }
        });
        assert.equal(malformedPhone.status, 400);
    });
});
