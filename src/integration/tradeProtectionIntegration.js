/**
 * Trade Protection Tracker Integration
 * Add this to your simpleContent.js to enable the killer feature
 */

// Import the Trade Protection Tracker
// Add this near the top of simpleContent.js with other imports:
// const TradeProtectionTracker = require('./tradeProtectionTracker');

/**
 * Example integration into existing CS2FloatChecker object
 */

// Step 1: Initialize the tracker in your init function
function initializeTradeProtectionTracker(apiBaseUrl) {
    const tracker = new TradeProtectionTracker(apiBaseUrl || 'http://localhost:3000');

    // Inject CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('src/tradeProtectionTracker.css');
    document.head.appendChild(link);

    return tracker;
}

// Step 2: Add to CS2FloatChecker object initialization
const CS2FloatCheckerEnhanced = {
    // ... existing properties ...
    tradeProtectionTracker: null,

    async init() {
        // ... existing init code ...

        // Initialize Trade Protection Tracker
        this.tradeProtectionTracker = initializeTradeProtectionTracker();
        this.log('✅ Trade Protection Tracker initialized');

        // ... rest of init code ...
    },

    // Step 3: Enhance existing float display function
    async displayFloatValue(element, floatData) {
        // ... existing float display code ...

        // Add Trade Protection tracking
        if (this.tradeProtectionTracker && floatData.floatid) {
            try {
                await this.tradeProtectionTracker.injectIntoListing(element, floatData);
                this.log('✅ Trade risk injected for float ID:', floatData.floatid);
            } catch (error) {
                this.log('❌ Failed to inject trade risk:', error);
            }
        }

        // ... rest of display code ...
    }
};

/**
 * Standalone usage example (without integrating into existing code)
 */
function standaloneTradeProtectionDemo() {
    // Create tracker instance
    const tracker = new TradeProtectionTracker('http://localhost:3000');

    // Monitor all market listings on page
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    // Check if it's a market listing
                    if (node.classList && node.classList.contains('market_listing_row')) {
                        // Extract float data from the listing (you'll need your own logic here)
                        const floatData = extractFloatDataFromListing(node);

                        if (floatData && floatData.floatid) {
                            tracker.injectIntoListing(node, floatData);
                        }
                    }
                }
            });
        });
    });

    // Start observing the market page
    const marketContainer = document.querySelector('#searchResultsTable');
    if (marketContainer) {
        observer.observe(marketContainer, {
            childList: true,
            subtree: true
        });
    }
}

/**
 * Helper function to extract float data from listing
 * (This is placeholder - adapt to your actual data structure)
 */
function extractFloatDataFromListing(listingElement) {
    // Look for existing float data that your extension might have already injected
    const floatElement = listingElement.querySelector('[data-float-id]');

    if (floatElement) {
        return {
            floatid: floatElement.getAttribute('data-float-id'),
            floatvalue: parseFloat(floatElement.getAttribute('data-float-value')),
            defindex: parseInt(floatElement.getAttribute('data-defindex')),
            paintindex: parseInt(floatElement.getAttribute('data-paintindex'))
        };
    }

    return null;
}

/**
 * Quick setup for testing
 * Paste this in browser console on Steam market page
 */
function quickSetup() {
    // Load the CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('src/tradeProtectionTracker.css');
    document.head.appendChild(link);

    // Load and initialize tracker
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/tradeProtectionTracker.js');
    script.onload = () => {
        console.log('✅ Trade Protection Tracker loaded!');
        window.tradeTracker = new TradeProtectionTracker('http://localhost:3000');

        // Example: Test with a specific float ID
        window.tradeTracker.getTradeRisk('YOUR_FLOAT_ID_HERE').then(data => {
            console.log('Trade Risk Data:', data);
        });
    };
    document.head.appendChild(script);
}

// Export for use in main content script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeTradeProtectionTracker,
        standaloneTradeProtectionDemo,
        quickSetup
    };
}
