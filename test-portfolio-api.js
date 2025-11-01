/**
 * Complete API Test Suite for Portfolio Endpoints
 * Run: node test-portfolio-api.js
 */

const BASE_URL = 'http://localhost:3002';
const TEST_USER_ID = 'steam_76561199094452064';
const TEST_STEAM_ID = '76561199094452064';

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

function log(status, message) {
    const emoji = status === 'success' ? '✅' : status === 'error' ? '❌' : status === 'info' ? 'ℹ️' : '⚠️';
    const color = status === 'success' ? colors.green : status === 'error' ? colors.red : status === 'info' ? colors.blue : colors.yellow;
    console.log(`${emoji} ${color}${message}${colors.reset}`);
}

async function testEndpoint(name, method, url, body = null, expectedStatus = 200) {
    try {
        console.log(`\n${'='.repeat(60)}`);
        log('info', `Testing: ${name}`);
        log('info', `${method} ${url}`);

        const options = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };

        if (body) {
            options.body = JSON.stringify(body);
            console.log('Body:', JSON.stringify(body, null, 2));
        }

        const response = await fetch(url, options);
        const data = await response.json();

        if (response.status === expectedStatus) {
            log('success', `Status: ${response.status} (Expected: ${expectedStatus})`);
            console.log('Response:', JSON.stringify(data, null, 2));
            return { success: true, data };
        } else {
            log('error', `Status: ${response.status} (Expected: ${expectedStatus})`);
            console.log('Response:', JSON.stringify(data, null, 2));
            return { success: false, data };
        }
    } catch (error) {
        log('error', `Request failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function runTests() {
    console.log('\n' + '='.repeat(60));
    log('info', 'PORTFOLIO API TEST SUITE');
    console.log('='.repeat(60));

    let testItemId = null;

    // Test 1: Add Portfolio Item
    const addResult = await testEndpoint(
        'Add Portfolio Item',
        'POST',
        `${BASE_URL}/api/portfolio/add`,
        {
            userId: TEST_USER_ID,
            itemName: 'AK-47 | Redline (Field-Tested)',
            purchasePrice: 15.50,
            quantity: 1,
            marketplace: 'Steam',
            notes: 'Test item from API test suite'
        }
    );

    if (addResult.success && addResult.data.investment) {
        testItemId = addResult.data.investment.id;
        log('success', `Created item with ID: ${testItemId}`);
    }

    // Test 2: Get Portfolio
    await testEndpoint(
        'Get Portfolio',
        'GET',
        `${BASE_URL}/api/portfolio/${TEST_USER_ID}`
    );

    // Test 3: Get Portfolio Stats
    await testEndpoint(
        'Get Portfolio Statistics',
        'GET',
        `${BASE_URL}/api/portfolio/stats/${TEST_USER_ID}`
    );

    // Test 4: Record Sale
    if (testItemId) {
        await testEndpoint(
            'Record Sale',
            'POST',
            `${BASE_URL}/api/portfolio/sale`,
            {
                investmentId: testItemId,
                quantity: 1,
                salePrice: 18.00,
                marketplace: 'Buff163',
                notes: 'Test sale'
            }
        );
    }

    // Test 5: Get Portfolio Allocation
    await testEndpoint(
        'Get Portfolio Allocation',
        'GET',
        `${BASE_URL}/api/portfolio/allocation/${TEST_USER_ID}`
    );

    // Test 6: Get Portfolio Health
    await testEndpoint(
        'Get Portfolio Health',
        'GET',
        `${BASE_URL}/api/portfolio/health/${TEST_USER_ID}`
    );

    // Test 7: Batch Add Items
    await testEndpoint(
        'Batch Add Items',
        'POST',
        `${BASE_URL}/api/portfolio/batch/add`,
        {
            userId: TEST_USER_ID,
            investments: [
                {
                    itemName: 'AWP | Asiimov (Field-Tested)',
                    purchasePrice: 45.00,
                    quantity: 1,
                    marketplace: 'Buff163'
                },
                {
                    itemName: 'M4A4 | Howl (Minimal Wear)',
                    purchasePrice: 2500.00,
                    quantity: 1,
                    marketplace: 'CSFloat'
                }
            ]
        }
    );

    // Test 8: Get Portfolio Activity
    await testEndpoint(
        'Get Portfolio Activity',
        'GET',
        `${BASE_URL}/api/portfolio/activity/${TEST_USER_ID}`
    );

    // Test 9: Export Portfolio
    await testEndpoint(
        'Export Portfolio (JSON)',
        'GET',
        `${BASE_URL}/api/portfolio/export/${TEST_USER_ID}?format=json`
    );

    // Test 10: Create Portfolio Snapshot
    await testEndpoint(
        'Create Portfolio Snapshot',
        'POST',
        `${BASE_URL}/api/portfolio/snapshot/create/${TEST_USER_ID}`,
        {}
    );

    // Test 11: Get Snapshot History
    await testEndpoint(
        'Get Snapshot History',
        'GET',
        `${BASE_URL}/api/portfolio/snapshot/history/${TEST_USER_ID}`
    );

    // Test 12: Get Portfolio Chart Data
    await testEndpoint(
        'Get Portfolio Chart Data',
        'GET',
        `${BASE_URL}/api/portfolio/chart/${TEST_USER_ID}?period=30d`
    );

    // Test 13: Get Portfolio P&L
    await testEndpoint(
        'Get Portfolio P&L',
        'GET',
        `${BASE_URL}/api/portfolio/pnl/${TEST_USER_ID}`
    );

    // Test 14: Delete Item (if created)
    if (testItemId) {
        await testEndpoint(
            'Delete Portfolio Item',
            'DELETE',
            `${BASE_URL}/api/portfolio/delete/${testItemId}`
        );
    }

    console.log('\n' + '='.repeat(60));
    log('info', 'TEST SUITE COMPLETED');
    console.log('='.repeat(60) + '\n');
}

// Run tests
runTests().catch(console.error);
