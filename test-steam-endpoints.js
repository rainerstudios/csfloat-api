/**
 * Steam Integration Endpoints Test Suite
 * Run: node test-steam-endpoints.js
 */

const BASE_URL = 'http://localhost:3002';
const TEST_STEAM_ID = '76561199094452064';

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

async function testSteamEndpoints() {
    console.log('\n' + '='.repeat(60));
    log('info', 'STEAM INTEGRATION TEST SUITE');
    console.log('='.repeat(60));

    // Test 1: Get Steam Inventory (Test Endpoint)
    console.log(`\n${'='.repeat(60)}`);
    log('info', 'Test 1: Get Steam Inventory');
    try {
        const response = await fetch(`${BASE_URL}/api/steam/inventory/test/${TEST_STEAM_ID}`);
        const data = await response.json();

        if (data.success) {
            log('success', `Found ${data.total_items} items`);
            console.log('Sample item:', JSON.stringify(data.items[0], null, 2));
        } else {
            log('error', `Failed: ${data.message}`);
        }
    } catch (error) {
        log('error', `Error: ${error.message}`);
    }

    // Test 2: Get Inventory Value
    console.log(`\n${'='.repeat(60)}`);
    log('info', 'Test 2: Get Inventory Value');
    log('warning', 'Skipping - requires authentication');

    // Test 3: Sync Inventory
    console.log(`\n${'='.repeat(60)}`);
    log('info', 'Test 3: Sync Inventory to Portfolio');
    log('warning', 'Skipping - requires authentication');

    console.log('\n' + '='.repeat(60));
    log('info', 'STEAM TEST SUITE COMPLETED');
    console.log('='.repeat(60) + '\n');
}

testSteamEndpoints().catch(console.error);
