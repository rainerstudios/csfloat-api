/**
 * Currency Swapper Injector
 * Handles initialization and message passing for the currency swapper
 */

import { currencySwapper } from './currencySwapper.js';

// Listen for initialization messages
window.addEventListener('message', async (event) => {
    if (event.origin !== window.location.origin) {
        return;
    }

    if (event.data && event.data.type === 'CS2_INIT_CURRENCY_SWAPPER') {
        console.log('[Currency Swapper Injector] Received init message');
        
        try {
            // Initialize the currency swapper with settings
            if (event.data.settings) {
                currencySwapper.settings = event.data.settings;
            }
            
            await currencySwapper.init();
        } catch (error) {
            console.error('[Currency Swapper Injector] Initialization error:', error);
        }
    }

    if (event.data && event.data.type === 'CS2_SETTINGS_UPDATE') {
        console.log('[Currency Swapper Injector] Received settings update');
        currencySwapper.updateSettings(event.data.settings);
    }
});

// Auto-initialize if on market page
if (window.location.href.includes('/market/')) {
    console.log('[Currency Swapper Injector] Auto-initializing on market page');
    currencySwapper.init().catch(console.error);
}