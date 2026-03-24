#!/usr/bin/env node

/**
 * End-to-End Test: Resource Activation Control
 * 
 * Test scenario:
 * 1. Get all resources as non-admin (should be active only)
 * 2. Get all resources as admin (should be all)
 * 3. Toggle Solar deactivate via API
 * 4. Get resources as non-admin (Solar should be gone)
 * 5. Get resources as admin (Solar should still be there)
 * 6. Toggle Solar back activate
 * 7. Get resources as non-admin (Solar should reappear)
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://localhost:5001';

// Test credentials (from seed data)
let adminToken = null;
let studentToken = null;

function request(method, path, body = null, authToken = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            }
        };

        const req = http.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function login(email, password) {
    console.log(`🔐 Logging in as ${email}...`);
    const res = await request('POST', '/api/auth/login', { email, password });
    assert.strictEqual(res.status, 200, `Login failed: ${JSON.stringify(res.data)}`);
    return res.data.token;
}

async function getResources(authToken, role = 'admin') {
    const res = await request('GET', '/api/resource-config', null, authToken);
    assert.strictEqual(res.status, 200, `Failed to get resources: ${JSON.stringify(res.data)}`);
    return res.data.data || res.data.resources || [];
}

async function updateResource(resourceId, updates, authToken) {
    const res = await request('PUT', `/api/resource-config/${resourceId}`, updates, authToken);
    assert.strictEqual(res.status, 200, `Failed to update resource: ${JSON.stringify(res.data)}`);
    return res.data.data;
}

async function runTests() {
    try {
        console.log('\n📋 Starting End-to-End Test: Resource Activation Control\n');
        console.log('='.repeat(60));

        // Step 1: Login as admin
        console.log('\n✓ Step 1: Login as admin');
        adminToken = await login('admin@college.com', 'Admin@123');
        console.log('  ✓ Admin token obtained');

        // Step 2: Login as warden (non-admin)
        console.log('\n✓ Step 2: Login as warden (non-admin)');
        studentToken = await login('warden@college.com', 'Warden@123');
        console.log('  ✓ Warden token obtained');

        // Step 3: Get all resources as admin (all should be there)
        console.log('\n✓ Step 3: Get all resources as admin');
        let adminResources = await getResources(adminToken, 'admin');
        console.log(`  ✓ Admin sees ${adminResources.length} resource configurations`);
        adminResources.forEach(r => {
            console.log(`    - ${r.name} (isActive: ${r.isActive})`);
        });

        // Step 4: Get all resources as student (only active)
        console.log('\n✓ Step 4: Get all resources as student (should be active only)');
        let studentResources = await getResources(studentToken, 'student');
        console.log(`  ✓ Student sees ${studentResources.length} resource configurations`);
        studentResources.forEach(r => {
            console.log(`    - ${r.name} (isActive: ${r.isActive})`);
        });

        // Find Solar resource
        const solarAdmin = adminResources.find(r => r.name === 'Solar');
        assert.ok(solarAdmin, 'Solar resource not found for admin');
        const solarId = solarAdmin._id;
        const solarInitiallyActive = solarAdmin.isActive;

        console.log(`\n  ℹ️  Solar resource found (ID: ${solarId}, isActive: ${solarInitiallyActive})`);

        // Step 5: Deactivate Solar
        console.log('\n✓ Step 5: Deactivate Solar resource');
        const deactivated = await updateResource(solarId, { isActive: false }, adminToken);
        console.log(`  ✓ Solar deactivated (isActive: ${deactivated.isActive})`);

        // Step 6: Get resources as admin (Solar should still be visible)
        console.log('\n✓ Step 6: Get resources as admin after deactivation');
        adminResources = await getResources(adminToken, 'admin');
        const solarAdminAfter = adminResources.find(r => r.name === 'Solar');
        console.log(`  ✓ Admin still sees Solar (isActive: ${solarAdminAfter?.isActive})`);
        assert.strictEqual(solarAdminAfter?.isActive, false, 'Solar should be deactivated for admin');

        // Step 7: Get resources as student (Solar should be gone)
        console.log('\n✓ Step 7: Get resources as student after deactivation');
        studentResources = await getResources(studentToken, 'student');
        const solarStudentAfter = studentResources.find(r => r.name === 'Solar');
        console.log(`  ✓ Student does NOT see Solar (found: ${!!solarStudentAfter})`);
        assert.strictEqual(solarStudentAfter, undefined, 'Solar should not appear for student after deactivation');
        console.log(`  ✓ Student now sees ${studentResources.length} resources (Solar removed)`);

        // Step 8: Reactivate Solar
        console.log('\n✓ Step 8: Reactivate Solar resource');
        const reactivated = await updateResource(solarId, { isActive: true }, adminToken);
        console.log(`  ✓ Solar reactivated (isActive: ${reactivated.isActive})`);

        // Step 9: Get resources as student (Solar should reappear)
        console.log('\n✓ Step 9: Get resources as student after reactivation');
        studentResources = await getResources(studentToken, 'student');
        const solarStudentFinal = studentResources.find(r => r.name === 'Solar');
        console.log(`  ✓ Solar reappears for student (found: ${!!solarStudentFinal})`);
        assert.ok(solarStudentFinal, 'Solar should reappear for student after reactivation');
        console.log(`  ✓ Student now sees ${studentResources.length} resources (Solar restored)`);

        console.log('\n' + '='.repeat(60));
        console.log('\n✅ ALL TESTS PASSED! Resource activation control is working correctly.\n');
        console.log('Summary:');
        console.log('  ✓ Admin can see all resources (active and inactive)');
        console.log('  ✓ Non-admin only see active resources');
        console.log('  ✓ Deactivating a resource hides it from non-admin immediately');
        console.log('  ✓ Reactivating a resource shows it to non-admin immediately');
        console.log();

        process.exit(0);
    } catch (err) {
        console.error('\n❌ TEST FAILED:', err.message);
        console.error(err);
        process.exit(1);
    }
}

runTests();
