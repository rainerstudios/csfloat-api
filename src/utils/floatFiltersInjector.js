/**
 * Float Filters Injector
 * Handles initialization and message passing for the float filters
 */

import { floatFilters } from './floatFilters.js';

// Listen for initialization messages
window.addEventListener('message', async (event) => {
    if (event.origin !== window.location.origin) {
        return;
    }

    if (event.data && event.data.type === 'CS2_INIT_FLOAT_FILTERS') {
        console.log('[Float Filters Injector] Received init message');
        
        try {
            // Initialize the float filters with settings
            if (event.data.settings) {
                floatFilters.settings = event.data.settings;
            }
            
            await floatFilters.init();
        } catch (error) {
            console.error('[Float Filters Injector] Initialization error:', error);
        }
    }

    if (event.data && event.data.type === 'CS2_SETTINGS_UPDATE') {
        console.log('[Float Filters Injector] Received settings update');
        floatFilters.updateSettings(event.data.settings);
    }
});

// Auto-initialize if on market listing page
if (window.location.href.includes('/market/listings/') && !window.location.href.includes('/market/search')) {
    console.log('[Float Filters Injector] Auto-initializing on market listing page');
    floatFilters.init().catch(console.error);
}