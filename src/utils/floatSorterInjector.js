/**
 * Float Sorter Injector
 * Injects the float sorting and filtering functionality into Steam market pages
 */

import { FloatSorter } from './floatSorter.js';

// Global reference to the float sorter instance
let floatSorterInstance = null;

function initFloatSorter(settings) {
    try {
        console.log('[CS2 Float Sorter] Initializing float sorter...');
        
        // Don't initialize multiple instances
        if (floatSorterInstance) {
            console.log('[CS2 Float Sorter] Already initialized');
            return;
        }
        
        // Check if we're on a market page with listings
        const isMarketPage = window.location.href.includes('/market/') && 
                           (document.querySelector('#searchResultsRows') || document.querySelector('.market_listing_table'));
        
        if (!isMarketPage) {
            console.log('[CS2 Float Sorter] Not a market listings page');
            return;
        }
        
        // Check if settings allow float filters
        if (!settings.enableFloatFilters) {
            console.log('[CS2 Float Sorter] Float filters disabled in settings');
            return;
        }
        
        // Wait for market listings to load
        const waitForListings = () => {
            return new Promise((resolve) => {
                const checkForListings = () => {
                    const listings = document.querySelectorAll('.market_listing_row');
                    if (listings.length > 0) {
                        console.log(`[CS2 Float Sorter] Found ${listings.length} listings`);
                        resolve();
                    } else {
                        setTimeout(checkForListings, 1000);
                    }
                };
                checkForListings();
            });
        };
        
        // Initialize after listings are loaded
        waitForListings().then(() => {
            // Clean up any existing old filters periodically
            const cleanupOldFilters = () => {
                const oldFilterSelectors = ['#cs2-float-filter-controls', '[id*="cs2-minFloat"]', '[id*="cs2-maxFloat"]', '[id*="cs2-float-sort"]'];
                oldFilterSelectors.forEach(selector => {
                    document.querySelectorAll(selector).forEach(el => {
                        console.log('[CS2 Float Sorter] Removing conflicting old filter:', el);
                        el.remove();
                    });
                });
            };
            
            // Clean up immediately and then periodically
            cleanupOldFilters();
            setInterval(cleanupOldFilters, 2000);
            
            floatSorterInstance = new FloatSorter();
            console.log('[CS2 Float Sorter] ✅ Float sorter initialized successfully');
        });
        
    } catch (error) {
        console.error('[CS2 Float Sorter] Error initializing:', error);
    }
}

function updateFloatSorterSettings(newSettings) {
    if (newSettings.enableFloatFilters === false && floatSorterInstance) {
        // Destroy if disabled
        floatSorterInstance.destroy();
        floatSorterInstance = null;
        console.log('[CS2 Float Sorter] Float sorter disabled');
    } else if (newSettings.enableFloatFilters === true && !floatSorterInstance) {
        // Initialize if enabled
        initFloatSorter(newSettings);
    }
}

// Listen for initialization messages from content script
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    switch (event.data.type) {
        case 'CS2_INIT_FLOAT_SORTER':
            console.log('[CS2 Float Sorter] Received init message:', event.data.settings);
            initFloatSorter(event.data.settings || {});
            break;
            
        case 'CS2_SETTINGS_UPDATE':
            console.log('[CS2 Float Sorter] Received settings update');
            updateFloatSorterSettings(event.data.settings || {});
            break;
            
        case 'CS2_RELOAD_FLOATS':
            // When floats are reloaded, re-filter items
            if (floatSorterInstance) {
                setTimeout(() => {
                    floatSorterInstance.filterItems();
                }, 1000);
            }
            break;
    }
});

// Auto-initialize if we're already on a market page
document.addEventListener('DOMContentLoaded', () => {
    // Give some time for other scripts to load
    setTimeout(() => {
        initFloatSorter({ enableFloatFilters: true });
    }, 2000);
});

// Handle page navigation (Steam uses AJAX for market pages)
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;

history.pushState = function() {
    originalPushState.apply(history, arguments);
    handlePageChange();
};

history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    handlePageChange();
};

window.addEventListener('popstate', handlePageChange);

function handlePageChange() {
    setTimeout(() => {
        const isMarketPage = window.location.href.includes('/market/');
        
        if (isMarketPage && !floatSorterInstance) {
            console.log('[CS2 Float Sorter] Navigated to market page, initializing...');
            initFloatSorter({ enableFloatFilters: true });
        } else if (!isMarketPage && floatSorterInstance) {
            console.log('[CS2 Float Sorter] Left market page, cleaning up...');
            floatSorterInstance.destroy();
            floatSorterInstance = null;
        }
    }, 1000);
}

console.log('[CS2 Float Sorter] Injector script loaded');