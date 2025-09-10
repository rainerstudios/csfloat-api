/**
 * CS2 Float Checker - Simple Content Script
 * Enhanced Steam Community Market with float values
 * Version 1.5.1
 */

// CS2 Float Checker Content Script - Production Ready

(() => {
    'use strict';
    
    // Initialize component classes
    let ProfitCalculator, TradeHoldDisplay, QuickBuyButtons, PatternDatabase, FloatFilter;
    
    const CS2FloatChecker = {
        version: '1.5.1',
        initialized: false,
        floatAPI: null,
        processedItems: new Set(),
        settings: {},
        currentTooltip: null,

        log(...args) {
            console.log(`[CS2 Float Checker v${this.version}]`, ...args);
        },

        setupMessageListener() {
            this.log('Setting up message listener for injected script communication...');
            
            // Listen for messages from popup/background
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'updateSettings') {
                    this.log('🔄 Received settings update:', request.settings);
                    this.settings = { ...this.getDefaultSettings(), ...request.settings };
                    
                    // Restart processing based on new settings
                    this.restartWithNewSettings();
                    sendResponse({ success: true });
                } else if (request.action === 'reloadFloats') {
                    this.log('🔄 Received reload floats request');
                    this.reloadFloats();
                    sendResponse({ success: true });
                }
            });
            
            window.addEventListener('message', async (event) => {
                // Only accept messages from same origin
                if (event.origin !== window.location.origin) {
                    return;
                }
                
                // Check for our specific message type
                if (event.data && event.data.type === 'CS2_FETCH_FLOAT_REQUEST') {
                    this.log('📨 Received float request from injected script:', event.data.payload);
                    
                    try {
                        // Forward request to background script via Chrome API
                        const response = await chrome.runtime.sendMessage({
                            action: 'fetchFloat',
                            inspectLink: event.data.payload.inspectLink,
                            assetId: event.data.payload.assetId
                        });
                        
                        this.log('📨 Received response from background script:', response);
                        
                        // Send response back to injected script
                        window.postMessage({
                            type: 'CS2_FETCH_FLOAT_RESPONSE',
                            payload: {
                                ...response,
                                assetId: event.data.payload.assetId,
                                elementId: event.data.payload.elementId,
                                requestId: event.data.payload.requestId
                            }
                        }, window.location.origin);
                        
                    } catch (error) {
                        this.log('❌ Error forwarding float request:', error);
                        
                        // Send error response back to injected script
                        window.postMessage({
                            type: 'CS2_FETCH_FLOAT_RESPONSE',
                            payload: {
                                error: error.message,
                                assetId: event.data.payload.assetId,
                                elementId: event.data.payload.elementId,
                                requestId: event.data.payload.requestId
                            }
                        }, window.location.origin);
                    }
                }
            });
            
            this.log('✅ Message listener setup complete');
        },

        restartWithNewSettings() {
            this.log('🔄 Restarting with new settings...');
            
            // Send settings update to injected scripts
            window.postMessage({
                type: 'CS2_SETTINGS_UPDATE',
                settings: this.settings
            }, window.location.origin);
            
            // Clear processed items to allow reprocessing
            this.processedItems.clear();
            
            // Re-run setup with new settings
            if (this.isMarketPage() && this.settings.enableMarket) {
                this.log('Market page enabled - reprocessing...');
                this.processMarketPage();
            } else if (this.isInventoryPage() && this.settings.enableInventory) {
                this.log('Inventory page enabled - reprocessing...');
                this.processInventoryPage();
            } else if (this.isMarketPage() && !this.settings.enableMarket) {
                this.log('Market page disabled - removing float displays...');
                this.removeAllFloats();
            } else if (this.isInventoryPage() && !this.settings.enableInventory) {
                this.log('Inventory page disabled - removing float displays...');
                this.removeAllFloats();
            }
        },

        reloadFloats() {
            this.log('🔄 Reloading all floats...');
            this.processedItems.clear();
            if (this.isMarketPage() && this.settings.enableMarket) {
                this.processMarketPage();
            } else if (this.isInventoryPage() && this.settings.enableInventory) {
                this.processInventoryPage();
            }
        },

        removeAllFloats() {
            // Remove all float displays from the page
            const floatElements = document.querySelectorAll('[data-cs2float-display], .cs2-float-value, .cs2-float-tooltip');
            floatElements.forEach(el => el.remove());
            this.log(`Removed ${floatElements.length} float displays`);
        },

        async loadComponents() {
            try {
                // Load our custom components
                const profitScript = document.createElement('script');
                profitScript.src = chrome.runtime.getURL('src/profitCalculator.js');
                document.head.appendChild(profitScript);
                
                const tradeHoldScript = document.createElement('script');
                tradeHoldScript.src = chrome.runtime.getURL('src/tradeHoldDisplay.js');
                document.head.appendChild(tradeHoldScript);
                
                const quickBuyScript = document.createElement('script');
                quickBuyScript.src = chrome.runtime.getURL('src/quickBuyButtons.js');
                document.head.appendChild(quickBuyScript);
                
                const patternScript = document.createElement('script');
                patternScript.src = chrome.runtime.getURL('src/patternDatabase.js');
                document.head.appendChild(patternScript);
                
                const filterScript = document.createElement('script');
                filterScript.src = chrome.runtime.getURL('src/floatFilter.js');
                document.head.appendChild(filterScript);
                
                // Load new visualization components
                const floatBarScript = document.createElement('script');
                floatBarScript.src = chrome.runtime.getURL('src/floatBar.js');
                document.head.appendChild(floatBarScript);
                
                const floatRankingScript = document.createElement('script');
                floatRankingScript.src = chrome.runtime.getURL('src/floatRanking.js');
                document.head.appendChild(floatRankingScript);
                
                // Listing age component removed - keeping only top filter controls
                
                // Wait for scripts to load
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Initialize component classes
                if (window.ProfitCalculator) {
                    ProfitCalculator = new window.ProfitCalculator();
                    this.log('✅ ProfitCalculator loaded');
                }
                if (window.TradeHoldDisplay) {
                    TradeHoldDisplay = new window.TradeHoldDisplay();
                    this.log('✅ TradeHoldDisplay loaded');
                }
                if (window.QuickBuyButtons) {
                    QuickBuyButtons = new window.QuickBuyButtons();
                    this.log('✅ QuickBuyButtons loaded');
                }
                if (window.PatternDatabase) {
                    PatternDatabase = new window.PatternDatabase();
                    this.log('✅ PatternDatabase loaded');
                }
                if (window.FloatFilter) {
                    FloatFilter = new window.FloatFilter();
                    this.log('✅ FloatFilter loaded');
                }
                
                this.log('✅ All components loaded successfully');
            } catch (error) {
                this.log('❌ Error loading components:', error);
            }
        },

        init() {
            if (this.initialized) {
                this.log('Already initialized, skipping...');
                return;
            }
            
            this.log('Initializing CS2 Float Checker...');
            this.log('Current URL:', window.location.href);
            this.log('Document ready state:', document.readyState);
            
            // Check Chrome extension context
            this.log('Chrome available:', typeof chrome !== 'undefined');
            this.log('Chrome runtime available:', typeof chrome !== 'undefined' && !!chrome.runtime);
            
            // Set up message listener for injected script communication
            this.setupMessageListener();
            
            // Create fallback FloatAPI if needed
            this.createFallbackAPI();
            
            // Load our enhanced components
            this.loadComponents();
            
            if (document.readyState === 'loading') {
                this.log('Document still loading, waiting for DOMContentLoaded...');
                document.addEventListener('DOMContentLoaded', () => {
                    this.log('DOMContentLoaded fired, running setup...');
                    this.setup();
                });
            } else {
                this.log('Document already ready, running setup immediately...');
                this.setup();
            }
            
            this.initialized = true;
            this.log('Initialization complete');
        },

        createFallbackAPI() {
            if (!window.FloatAPI) {
                window.FloatAPI = {
                    async getFloatData(inspectLink, retries = 3) {
                        for (let attempt = 1; attempt <= retries; attempt++) {
                            try {
                                // Check if Chrome extension APIs are available
                                if (typeof chrome === 'undefined' || !chrome.runtime) {
                                    console.error('Chrome extension APIs not available');
                                    return null;
                                }
                                
                                // Check if runtime is still valid
                                if (!chrome.runtime.id) {
                                    console.error('Extension context invalidated - runtime ID missing');
                                    return null;
                                }
                                
                                console.log(`📤 Sending fetchFloat message (attempt ${attempt}/${retries}) for:`, inspectLink);
                                
                                // Use Chrome extension fetch to bypass CORS
                                const response = await chrome.runtime.sendMessage({
                                    action: 'fetchFloat',
                                    inspectLink: inspectLink
                                });
                                
                                console.log('📥 Received response:', JSON.stringify(response, null, 2));
                                return response;
                            } catch (error) {
                                console.error(`FloatAPI fetch error (attempt ${attempt}/${retries}):`, error);
                                
                                // Check if it's an extension context error
                                if (error.message && error.message.includes('Extension context invalidated')) {
                                    console.warn('Extension context invalidated - extension may need reload');
                                    return null;
                                }
                                
                                // If it's the last attempt, return null
                                if (attempt === retries) {
                                    console.error('All retry attempts failed');
                                    return null;
                                }
                                
                                // Wait before retrying (exponential backoff)
                                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                            }
                        }
                        return null;
                    }
                };
            }
            this.floatAPI = window.FloatAPI;
        },

        getDefaultSettings() {
            return {
                enableMarket: true,
                enableInventory: true,
                autoLoad: true,
                showStickers: true,
                showKeychains: true,
                highlightLowFloat: true,
                highlightHighFloat: true,
                highlightOwned: true,
                lowFloatThreshold: 0.07,
                highFloatThreshold: 0.93,
                showPaintSeed: true,
                showFloatRank: true,
                enableFloatFilters: true,
                enableQuickBuy: false, // Disabled by default for safety
                showProfitCalculation: true,
                showTradeHold: true,
                floatPrecision: 6,
                cacheExpiry: 24,
                language: 'en'
            };
        },

        async setup() {
            try {
                this.log('Setting up extension...');
                this.log('FloatAPI available:', !!this.floatAPI);
                
                await this.loadSettings();
                this.log('Settings loaded:', this.settings);
                
                this.injectStyles();
                this.log('Styles injected');
                
                this.setupCopyToClipboard();
                this.log('Copy-to-clipboard handlers setup');
                
                // Start processing based on page type and settings
                if (this.isMarketPage() && this.settings.enableMarket) {
                    this.log('Market page detected and enabled - URL contains /market/');
                    this.processMarketPage();
                } else if (this.isInventoryPage() && this.settings.enableInventory) {
                    this.log('Inventory page detected and enabled - URL contains /inventory/');
                    this.processInventoryPage();
                } else if (this.isMarketPage() && !this.settings.enableMarket) {
                    this.log('Market page detected but disabled in settings');
                } else if (this.isInventoryPage() && !this.settings.enableInventory) {
                    this.log('Inventory page detected but disabled in settings');
                } else {
                    this.log('Unknown page type, trying generic processing');
                    this.log('Current pathname:', window.location.pathname);
                    this.processGenericPage();
                }
                
                this.log('Extension setup completed successfully');
            } catch (error) {
                this.log('Error during setup:', error);
                console.error('[CS2 Float Checker] Setup error:', error);
            }
        },

        async loadSettings() {
            try {
                const result = await chrome.storage.local.get(['settings']);
                if (result.settings) {
                    this.settings = { ...this.getDefaultSettings(), ...result.settings };
                } else {
                    this.settings = this.getDefaultSettings();
                }
            } catch (e) {
                this.log('Using default settings');
                this.settings = this.getDefaultSettings();
            }
        },

        isMarketPage() {
            return window.location.href.includes('/market/');
        },

        isInventoryPage() {
            const url = window.location.href;
            const isInventory = url.includes('/inventory/') || 
                               (url.includes('/profiles/') && url.includes('/inventory')) ||
                               (url.includes('/id/') && url.includes('/inventory'));
            
            this.log('Inventory page check:', {
                url: url,
                isInventory: isInventory,
                hasInventoryInUrl: url.includes('/inventory'),
                hasProfilesInUrl: url.includes('/profiles/'),
                hasIdInUrl: url.includes('/id/')
            });
            
            return isInventory;
        },

        processMarketPage() {
            this.log('Processing market page...');
            this.log('Current URL:', window.location.href);
            this.log('Market page detected:', this.isMarketPage());
            
            // Initialize float sorter (replaces old float filters)
            this.initFloatSorter();
            
            // Add advanced filter button if enabled
            if (this.settings.enableFloatFilters && FloatFilter) {
                this.addFilterToggleButton();
            }
            
            // Initialize inventory highlighting if enabled
            this.log('Checking highlightOwned setting:', this.settings.highlightOwned);
            if (this.settings.highlightOwned) {
                this.initInventoryHighlighting();
            }
            
            // Wait for page to load then process
            setTimeout(() => {
                // Look for market listings with more specific selectors
                const selectors = [
                    '.market_listing_row',
                    '.market_recent_listing_row', 
                    '.market_listing_row_link',
                    '#searchResultsRows .market_listing_row'
                ];
                
                let marketListings = [];
                selectors.forEach(selector => {
                    const found = document.querySelectorAll(selector);
                    this.log(`Selector "${selector}" found ${found.length} elements`);
                    found.forEach(element => {
                        if (!marketListings.includes(element)) {
                            marketListings.push(element);
                        }
                    });
                });
                
                this.log(`Total unique market listings found: ${marketListings.length}`);
                
                // Debug current page content
                this.log('Page title:', document.title);
                this.log('Body classes:', document.body.className);
                this.log('Page has listings container:', !!document.querySelector('#searchResultsRows'));
                this.log('Page has market table:', !!document.querySelector('.market_listing_table'));
                
                if (marketListings.length > 0) {
                    marketListings.forEach((listing, index) => {
                        this.log(`Processing listing ${index + 1}/${marketListings.length}`);
                        this.processMarketListing(listing, index);
                    });
                } else {
                    this.log('No market listings found, will try again in 2 seconds');
                    this.log('Available elements:');
                    this.log('- .market_listing_row:', document.querySelectorAll('.market_listing_row').length);
                    this.log('- .market_recent_listing_row:', document.querySelectorAll('.market_recent_listing_row').length);
                    this.log('- .market_listing_row_link:', document.querySelectorAll('.market_listing_row_link').length);
                    setTimeout(() => this.processMarketPage(), 2000);
                }
            }, 1000);
            
            // Set up observer for dynamic content
            this.setupMarketObserver();
        },


        async initFloatFilters() {
            try {
                this.log('Initializing float filters...');
                
                // Inject the float filters script
                const script = document.createElement('script');
                script.type = 'module';
                script.src = chrome.runtime.getURL('src/utils/floatFiltersInjector.js');
                
                script.onload = () => {
                    this.log('✅ Float filters script loaded');
                    
                    // Initialize the float filters
                    setTimeout(() => {
                        window.postMessage({
                            type: 'CS2_INIT_FLOAT_FILTERS',
                            settings: this.settings
                        }, '*');
                    }, 100);
                };
                
                script.onerror = (error) => {
                    this.log('❌ Error loading float filters script:', error);
                };
                
                (document.head || document.documentElement).appendChild(script);
            } catch (error) {
                this.log('Error initializing float filters:', error);
            }
        },

        async initFloatSorter() {
            try {
                this.log('Initializing float sorter...');
                
                // Inject the float sorter script
                const script = document.createElement('script');
                script.type = 'module';
                script.src = chrome.runtime.getURL('src/utils/floatSorterInjector.js');
                
                script.onload = () => {
                    this.log('✅ Float sorter script loaded');
                    
                    // Initialize the float sorter
                    setTimeout(() => {
                        window.postMessage({
                            type: 'CS2_INIT_FLOAT_SORTER',
                            settings: this.settings
                        }, '*');
                    }, 100);
                };
                
                script.onerror = (error) => {
                    this.log('❌ Error loading float sorter script:', error);
                };
                
                (document.head || document.documentElement).appendChild(script);
            } catch (error) {
                this.log('Error initializing float sorter:', error);
            }
        },

        async initInventoryHighlighting() {
            try {
                this.log('Initializing inventory highlighting...');
                
                // Inject the inventory highlighter script using src attribute instead of inline
                const script = document.createElement('script');
                script.type = 'module';
                script.src = chrome.runtime.getURL('src/utils/inventoryHighlightInjector.js');
                
                (document.head || document.documentElement).appendChild(script);
                
                // Send settings to the injected script
                setTimeout(() => {
                    window.postMessage({
                        type: 'CS2_SETTINGS_UPDATE',
                        settings: this.settings
                    }, '*');
                }, 100);
            } catch (error) {
                this.log('Error initializing inventory highlighting:', error);
            }
        },

        processInventoryPage() {
            this.log('Processing inventory page...');
            
            // Initialize inventory highlighting to collect owned items
            this.initInventoryHighlighting();
            
            this.log('Injecting Steam inventory API script...');
            
            // Inject the inventory script that uses Steam's internal APIs
            this.injectInventoryScript();
        },
        
        injectInventoryScript() {
            // Check if already injected
            if (document.querySelector('script[data-cs2-inventory-injector]')) {
                this.log('Inventory script already injected');
                return;
            }
            
            this.log('🚀 Starting inventory script injection...');
            
            try {
                const script = document.createElement('script');
                const scriptUrl = chrome.runtime.getURL('src/inventoryInjector.js');
                
                this.log('📄 Script URL:', scriptUrl);
                
                script.src = scriptUrl;
                script.dataset.cs2InventoryInjector = 'true';
                script.type = 'text/javascript';
                
                script.onload = () => {
                    this.log('✅ Inventory script injected successfully');
                    
                    // Pass settings to the injected script
                    setTimeout(() => {
                        window.postMessage({
                            type: 'CS2_FLOAT_SETTINGS',
                            settings: this.settings
                        }, window.location.origin);
                    }, 100);
                };
                
                script.onerror = (error) => {
                    this.log('❌ Error injecting inventory script:', error);
                    // Error indicator removed for production
                };
                
                this.log('📝 Appending script to document head/documentElement');
                
                // Inject into head for maximum compatibility
                (document.head || document.documentElement).appendChild(script);
                
            } catch (error) {
                this.log('❌ Error creating inventory script:', error);
            }
        },

        processGenericPage() {
            this.log('Processing generic page...');
            
            // Look for any CS2 items
            const items = document.querySelectorAll('[data-inspect], .item[data-economy-item], [href*="steam://rungame/730"]');
            this.log(`Found ${items.length} generic items`);
            
            items.forEach((item, index) => {
                this.processGenericItem(item, index);
            });
        },

        processMarketListing(listing, index) {
            // Use a unique identifier that includes the listing ID to prevent duplicates
            const listingId = listing.id || `listing_${index}`;
            const uniqueKey = `${listingId}_${listing.innerHTML.length}`;
            
            if (this.processedItems.has(uniqueKey)) {
                this.log(`Listing ${index + 1} (${listingId}) already processed, skipping`);
                return;
            }
            this.processedItems.add(uniqueKey);
            
            // Check if float info already exists to prevent duplicates
            if (listing.querySelector('.cs2-float-display')) {
                this.log(`Listing ${index + 1} already has float display, skipping`);
                return;
            }
            
            this.log(`Processing market listing ${index + 1}, ID: ${listingId}`);
            
            // Look for inspect link
            const inspectLink = this.extractInspectLink(listing);
            if (inspectLink) {
                this.log(`Found inspect link: ${inspectLink.substring(0, 80)}...`);
                
                // Success counter debug element removed for production
                
                this.addFloatDisplay(listing, inspectLink, 'market');
            } else {
                this.log(`No inspect link found for listing ${index + 1}`);
                // Log some debugging info about the listing structure
                this.log('Listing innerHTML preview:', listing.innerHTML.substring(0, 200) + '...');
                this.log('Listing has .market_listing_row_action:', !!listing.querySelector('.market_listing_row_action'));
                this.log('Listing has steam:// link:', listing.innerHTML.includes('steam://rungame/730'));
            }
        },

        // Inventory processing now handled by injected Steam API script

        processGenericItem(item, index) {
            if (this.processedItems.has(item)) return;
            this.processedItems.add(item);
            
            this.log(`Processing generic item ${index + 1}`);
            
            // Look for inspect link
            const inspectLink = this.extractInspectLink(item);
            if (inspectLink) {
                this.log(`Found inspect link: ${inspectLink.substring(0, 50)}...`);
                this.addFloatDisplay(item, inspectLink, 'generic');
            }
        },

        extractInspectLink(element) {
            this.log('Extracting inspect link from element:', element.tagName, element.className);
            this.log('Element HTML preview:', element.innerHTML.substring(0, 500) + '...');
            
            // Try multiple methods to find inspect link
            let inspectLink = null;
            
            // Method 1: Look for "Inspect in Game..." link specifically for market listings
            const inspectElement = element.querySelector('a[href*="steam://rungame/730"]');
            if (inspectElement) {
                this.log('Method 1 success: Found steam link in <a> tag');
                this.log('Steam link:', inspectElement.getAttribute('href'));
                return inspectElement.getAttribute('href');
            } else {
                this.log('Method 1 failed: No <a> tag with steam://rungame/730 found');
            }
            
            // Method 2: Look in the market_listing_row_action div
            const actionDiv = element.querySelector('.market_listing_row_action a');
            this.log('Method 2: Action div found:', !!actionDiv);
            if (actionDiv) {
                this.log('Action div href:', actionDiv.href);
            }
            if (actionDiv && actionDiv.href && actionDiv.href.includes('steam://rungame/730')) {
                this.log('Method 2 success: Found steam link in action div');
                return actionDiv.href;
            } else {
                this.log('Method 2 failed: No valid steam link in action div');
            }
            
            // Method 3: data-inspect attribute
            inspectLink = element.getAttribute('data-inspect');
            if (inspectLink) {
                this.log('Method 3 success: Found data-inspect attribute');
                return inspectLink;
            }
            
            // Method 4: Look for inspect link in child elements with data-inspect
            const dataInspectElement = element.querySelector('[data-inspect]');
            if (dataInspectElement) {
                this.log('Method 4 success: Found data-inspect in child element');
                return dataInspectElement.getAttribute('data-inspect');
            }
            
            // Method 5: Look for inspect link in onclick attributes
            const allElements = element.querySelectorAll('*');
            for (const el of allElements) {
                const onclickAttr = el.getAttribute('onclick') || '';
                const steamLinkMatch = onclickAttr.match(/steam:\/\/rungame\/730[^'"]+/);
                if (steamLinkMatch) {
                    this.log('Method 5 success: Found steam link in onclick attribute');
                    return steamLinkMatch[0];
                }
            }
            
            // Method 6: Look in innerHTML for steam links
            const innerHTML = element.innerHTML;
            const steamLinkMatch = innerHTML.match(/steam:\/\/rungame\/730[^'">\s]+/);
            if (steamLinkMatch) {
                this.log('Method 6 success: Found steam link in innerHTML');
                return steamLinkMatch[0];
            }
            
            this.log('All methods failed to find inspect link');
            return null;
        },

        async addFloatDisplay(element, inspectLink, type) {
            try {
                this.log(`Adding float display for ${type} item...`);
                
                // For market listings, find the right place to insert float info
                let insertTarget = element;
                if (type === 'market') {
                    const nameBlock = element.querySelector('.market_listing_item_name_block');
                    const itemName = element.querySelector('.market_listing_item_name');
                    if (nameBlock && itemName) {
                        insertTarget = itemName; // Insert after the item name specifically
                    }
                }
                
                // Add loading indicator
                const loadingIndicator = this.createLoadingIndicator();
                if (type === 'market' && insertTarget !== element) {
                    insertTarget.parentNode.insertBefore(loadingIndicator, insertTarget.nextSibling);
                } else {
                    element.appendChild(loadingIndicator);
                }
                
                // Get float data
                const floatData = await this.floatAPI.getFloatData(inspectLink);
                
                // Remove loading indicator
                if (loadingIndicator.parentNode) {
                    loadingIndicator.remove();
                }
                
                // Check for float value in correct location
                const itemInfo = floatData?.iteminfo || floatData;
                const floatValue = itemInfo?.floatvalue || itemInfo?.float_value;
                
                // Check if this is a melee weapon or other item type without float
                const weaponType = itemInfo?.weapon_type || '';
                const defindex = itemInfo?.defindex || 0;
                const paintindex = itemInfo?.paintindex || 0;
                
                // Items that don't have float values (much more restrictive)
                const isMeleeWeapon = weaponType.includes('★') && (
                    weaponType.includes('Knife') || 
                    weaponType.includes('Bayonet') ||
                    weaponType.includes('Karambit') ||
                    weaponType.includes('Sabre') ||
                    weaponType.includes('Daggers') ||
                    weaponType.includes('Cleaver') ||
                    (defindex >= 500 && defindex < 520) // Melee weapon defindex range
                );
                
                const isNonFloatItem = 
                    weaponType.includes('Patch |') ||            // Patches  
                    weaponType.includes('Music Kit |') ||        // Music kits
                    weaponType.includes('Sealed Graffiti |') ||  // Graffiti
                    weaponType.includes(' Case ') ||             // Cases (more specific)
                    weaponType.includes(' Key') ||               // Keys (more specific)
                    weaponType.includes('Tool') ||               // Tools
                    weaponType.includes('Agent |') ||            // Agent skins
                    (paintindex === 0 && !weaponType.includes('|')); // Vanilla items without skin
                
                const hasNoFloat = isMeleeWeapon || isNonFloatItem;
                
                // Debug logging for troubleshooting
                this.log(`🔍 Item analysis: ${weaponType}`);
                this.log(`   hasNoFloat: ${hasNoFloat}, isMeleeWeapon: ${isMeleeWeapon}, isNonFloatItem: ${isNonFloatItem}`);
                this.log(`   floatValue: ${floatValue}, floatData exists: ${!!floatData}`);
                
                // Check if we have valid float data and the item should show float
                if (floatData && !hasNoFloat && (floatValue !== undefined && floatValue !== null && floatValue >= 0)) {
                    this.log(`✅ Float data received: ${floatValue}`);
                    
                    // Create float display
                    const floatDisplay = this.createFloatDisplay(floatData, type);
                    
                    // Add special item type information if applicable
                    const weaponType = itemInfo?.weapon_type || '';
                    let specialTypeInfo = null;
                    
                    if (weaponType.includes('★')) {
                        specialTypeInfo = { type: 'Knife', color: '#fbbf24' };
                    } else if (weaponType.includes('Doppler')) {
                        specialTypeInfo = { type: 'Doppler', color: '#8b5cf6' };
                    } else if (weaponType.includes('Fade')) {
                        specialTypeInfo = { type: 'Fade', color: '#3b82f6' };
                    } else if (weaponType.includes('Case Hardened')) {
                        specialTypeInfo = { type: 'Case Hardened', color: '#06b6d4' };
                    }
                    
                    if (specialTypeInfo) {
                        const specialDisplay = document.createElement('div');
                        specialDisplay.style.cssText = `
                            font-size: 10px;
                            color: ${specialTypeInfo.color};
                            margin-top: 2px;
                            opacity: 0.9;
                        `;
                        specialDisplay.innerHTML = `${specialTypeInfo.type}`;
                        floatDisplay.appendChild(specialDisplay);
                    }
                    
                    // Check for special patterns
                    if (PatternDatabase && itemInfo) {
                        const patternInfo = PatternDatabase.analyzePattern(itemInfo);
                        if (patternInfo && patternInfo.isSpecial) {
                            const patternDisplay = PatternDatabase.createPatternDisplay(patternInfo, type);
                            if (patternDisplay) {
                                floatDisplay.appendChild(patternDisplay);
                            }
                        }
                    }
                    
                    // Position it correctly for market listings
                    if (type === 'market' && insertTarget !== element) {
                        insertTarget.parentNode.insertBefore(floatDisplay, insertTarget.nextSibling);
                        
                        // Add enhanced market features
                        this.addMarketEnhancements(element, floatData, itemInfo);
                    } else {
                        element.appendChild(floatDisplay);
                    }
                    
                    // Add highlight if needed
                    this.addFloatHighlight(element, floatValue);
                    
                    // Skip hover tooltip for market listings to avoid conflicts with Steam's native hover
                    if (type !== 'market') {
                        this.addHoverTooltip(element, floatData);
                    }
                    
                } else if (floatData && hasNoFloat) {
                    this.log(`✅ Melee weapon or item without float detected: ${weaponType}`);
                    
                    // Create special display for melee weapons
                    const meleeDisplay = this.createMeleeDisplay(itemInfo, type);
                    
                    // Check for special patterns (even for items without float)
                    if (PatternDatabase && itemInfo) {
                        const patternInfo = PatternDatabase.analyzePattern(itemInfo);
                        if (patternInfo && patternInfo.isSpecial) {
                            const patternDisplay = PatternDatabase.createPatternDisplay(patternInfo, type);
                            if (patternDisplay) {
                                meleeDisplay.appendChild(patternDisplay);
                            }
                        }
                    }
                    
                    // Position it correctly for market listings
                    if (type === 'market' && insertTarget !== element) {
                        insertTarget.parentNode.insertBefore(meleeDisplay, insertTarget.nextSibling);
                        
                        // Add enhanced market features for special items
                        this.addMarketEnhancements(element, floatData, itemInfo, true);
                    } else {
                        element.appendChild(meleeDisplay);
                    }
                    
                } else {
                    this.log('No float data received or invalid response');
                    
                    // Determine error type based on floatData
                    let errorType = 'unknown';
                    let errorMessage = '';
                    
                    if (floatData && floatData.error) {
                        errorMessage = floatData.error;
                        if (errorMessage.toLowerCase().includes('rate limit')) {
                            errorType = 'rate_limit';
                        } else if (errorMessage.toLowerCase().includes('timeout')) {
                            errorType = 'timeout';
                        } else {
                            errorType = 'api_error';
                        }
                    }
                    
                    // Show specific error indicator
                    const errorIndicator = this.createErrorIndicator(errorType, errorMessage);
                    if (type === 'market' && insertTarget !== element) {
                        insertTarget.parentNode.insertBefore(errorIndicator, insertTarget.nextSibling);
                    } else {
                        element.appendChild(errorIndicator);
                    }
                }
            } catch (error) {
                this.log('Error adding float display:', error);
                
                // Show error indicator for general errors
                const errorIndicator = this.createErrorIndicator('api_error', error.message);
                element.appendChild(errorIndicator);
            }
        },

        createLoadingIndicator() {
            const loading = document.createElement('div');
            loading.className = 'cs2-float-loading';
            loading.textContent = 'Loading float...';
            loading.style.cssText = `
                position: absolute;
                top: 5px;
                left: 5px;
                background: rgba(34, 197, 94, 0.9);
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: bold;
                z-index: 1000;
                animation: pulse 1s infinite;
            `;
            return loading;
        },

        createFloatDisplay(floatData, type) {
            const container = document.createElement('div');
            container.className = `cs2-float-display cs2-float-${type}`;
            
            // Handle different API response formats
            const itemInfo = floatData.iteminfo || floatData;
            
            // Extract all the data like the competitor does
            const floatValue = itemInfo.floatvalue || itemInfo.float_value || itemInfo.wear_value || null;
            const paintSeed = itemInfo.paintseed || itemInfo.pattern || null;
            const paintIndex = itemInfo.paintindex || null;
            const origin = itemInfo.origin || null;
            const originName = itemInfo.origin_name || itemInfo.originName || this.getOriginName(origin);
            
            if (floatValue === null) {
                this.log('No float value found in response. Available fields:', Object.keys(itemInfo));
                container.innerHTML = `
                    <div class="cs2-float-error" style="background: rgba(220, 38, 38, 0.9); color: white; padding: 4px; font-size: 11px; border-radius: 3px;">
                        ❌ Float data unavailable
                    </div>
                `;
                return container;
            }
            
            // Use user's precision setting
            const precision = this.settings.floatPrecision || 0;
            const displayFloat = precision === 0 ? parseFloat(floatValue).toString() : parseFloat(floatValue).toFixed(precision);
            
            // Add data attribute for float filters
            container.dataset.floatValue = floatValue;
            
            // Store data for visualization components
            container.dataset.floatValue = floatValue;
            container.dataset.minWear = '0.00';
            container.dataset.maxWear = '1.00';
            
            // Create professional display matching competitor format
            if (type === 'inventory') {
                // For inventory - overlay style with better visibility
                container.innerHTML = `
                    <div class="item-info" style="z-index: 10;">
                        <div class="float-data">
                            <div class="item_row item_row__value">
                                <span class="float-value cs2-float-copyable" title="Click to copy float: ${floatValue}" style="
                                    background: rgba(0, 0, 0, 0.8);
                                    color: #4CAF50;
                                    padding: 2px 4px;
                                    border-radius: 3px;
                                    font-size: 11px;
                                    font-weight: bold;
                                    cursor: pointer;
                                    user-select: none;
                                    pointer-events: auto;
                                    position: relative;
                                    z-index: 10;
                                " data-float-value="${floatValue}">${displayFloat}</span>
                                <span style="margin-left: 4px; cursor: pointer; opacity: 0.7; display: inline-block; pointer-events: auto; position: relative; z-index: 10;" class="cs2-float-copyable" data-float-value="${floatValue}" title="Copy float value">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="pointer-events: none;">
                                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                    </svg>
                                </span>
                            </div>
                        </div>
                    </div>
                    ${paintSeed ? `
                    <div class="item-info-paintseed" style="z-index: 11;">
                        <div class="float-data">
                            <div class="item_row item_row__transparent">
                                <span class="paintseed" style="
                                    background: rgba(0, 0, 0, 0.8);
                                    color: #8f98a0;
                                    padding: 1px 3px;
                                    border-radius: 2px;
                                    font-size: 9px;
                                ">#${paintSeed}</span>
                            </div>
                        </div>
                    </div>` : ''}
                `;
            } else {
                // For market listings - inline text style
                container.innerHTML = `
                    <div class="cs2-market-float" style="
                        background: transparent; 
                        color: #8F98A0; 
                        padding: 2px 0; 
                        margin: 2px 0; 
                        border-radius: 0; 
                        font-size: 11px;
                        font-weight: normal;
                        border: none;
                        box-shadow: none;
                        font-family: Arial, Helvetica, sans-serif;
                    ">
                        <div style="line-height: 1.4;">
                            <div style="font-size: 13px; font-weight: 600; color: #4CAF50; margin-bottom: 1px;">
                                Float: <span class="cs2-float-copyable" title="Click to copy float: ${floatValue}" style="cursor: pointer; user-select: none; pointer-events: auto; position: relative; z-index: 10; display: inline-block;" data-float-value="${floatValue}">${displayFloat}</span>
                                <span style="margin-left: 4px; cursor: pointer; opacity: 0.7; display: inline-block; pointer-events: auto; position: relative; z-index: 10;" class="cs2-float-copyable" data-float-value="${floatValue}" title="Copy float value">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="pointer-events: none;">
                                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                    </svg>
                                </span>
                            </div>
                            ${(paintSeed || paintIndex || originName) ? `
                            <div style="font-size: 11px; color: #8F98A0;">
                                ${paintSeed ? `Pattern: ${paintSeed}` : ''}${paintSeed && (paintIndex || originName) ? ' | ' : ''}${paintIndex ? `Paint Index: ${paintIndex}` : ''}${paintIndex && originName ? ' | ' : ''}${originName ? `Origin: ${originName}` : ''}
                            </div>` : ''}
                        </div>
                    </div>
                `;
            }
            
            // Style based on type - integrate with Steam UI
            if (type === 'market') {
                container.style.cssText = `
                    position: relative;
                    background: transparent;
                    color: inherit;
                    padding: 0;
                    border-radius: 0;
                    font-size: inherit;
                    text-align: left;
                    z-index: 1;
                    border: none;
                    margin: 0;
                    box-shadow: none;
                `;
            } else if (type === 'inventory') {
                container.style.cssText = `
                    position: absolute;
                    bottom: 2px;
                    left: 2px;
                    background: rgba(0, 0, 0, 0.9);
                    color: #22c55e;
                    padding: 3px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                    text-align: center;
                    z-index: 1000;
                    border: 1px solid #22c55e;
                    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
                `;
            }
            
            // Add visualization components after container is ready
            setTimeout(() => {
                if (window.CS2FloatBar && typeof window.CS2FloatBar.addFloatBar === 'function') {
                    try {
                        window.CS2FloatBar.addFloatBar(container, floatValue, 0.00, 1.00);
                    } catch (error) {
                        console.log('[CS2 Float] Float bar error:', error);
                    }
                }
                
                if (window.CS2FloatRanking && typeof window.CS2FloatRanking.addRanking === 'function') {
                    try {
                        window.CS2FloatRanking.addRanking(container, floatValue, 0.00, 1.00);
                    } catch (error) {
                        console.log('[CS2 Float] Float ranking error:', error);
                    }
                }
            }, 200);
            
            return container;
        },

        addFilterToggleButton() {
            // Only show filter button on individual CS2 item listing pages, not search pages
            const url = window.location.href;
            if (!url.includes('/market/listings/') || url.includes('/market/search')) {
                this.log('Skipping filter button - not on individual item listing page');
                return;
            }
            
            // Check if button already exists
            if (document.querySelector('.cs2-filter-toggle-btn')) {
                return;
            }

            const toggleButton = document.createElement('button');
            toggleButton.className = 'cs2-filter-toggle-btn';
            toggleButton.innerHTML = '🔍 Advanced Filters';
            toggleButton.title = 'Open advanced float and pattern filters';
            
            toggleButton.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(to bottom, #75b022 5%, #68a54b 100%);
                border: 1px solid #4e7a0d;
                border-radius: 6px;
                color: #ffffff;
                cursor: pointer;
                font-size: 12px;
                font-weight: bold;
                padding: 8px 16px;
                text-align: center;
                text-shadow: 1px 1px 0px #2d4611;
                transition: all 0.2s ease;
                z-index: 9999;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            `;

            toggleButton.addEventListener('mouseenter', () => {
                toggleButton.style.background = 'linear-gradient(to bottom, #68a54b 5%, #75b022 100%)';
                toggleButton.style.transform = 'translateY(-1px)';
                toggleButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
            });

            toggleButton.addEventListener('mouseleave', () => {
                toggleButton.style.background = 'linear-gradient(to bottom, #75b022 5%, #68a54b 100%)';
                toggleButton.style.transform = 'translateY(0)';
                toggleButton.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
            });

            toggleButton.addEventListener('click', () => {
                if (FloatFilter) {
                    const existingPanel = document.querySelector('.cs2-float-filter-panel');
                    if (existingPanel) {
                        existingPanel.remove();
                    } else {
                        FloatFilter.createFilterPanel();
                    }
                }
            });

            document.body.appendChild(toggleButton);
            this.log('✅ Advanced filter toggle button added');
        },

        addMarketEnhancements(marketElement, floatData, itemInfo, isSpecialItem = false) {
            try {
                // Add trade hold display if component is available
                if (TradeHoldDisplay && itemInfo && this.settings.showTradeHold) {
                    const asset = {
                        tradable: itemInfo.tradable !== undefined ? itemInfo.tradable : 1,
                        descriptions: itemInfo.descriptions || [],
                        market_tradable_restriction: itemInfo.market_tradable_restriction || 0
                    };
                    
                    const tradeHoldElement = TradeHoldDisplay.createTradeHoldDisplay(asset, 'market');
                    if (tradeHoldElement) {
                        const actionDiv = marketElement.querySelector('.market_listing_row_action');
                        if (actionDiv) {
                            actionDiv.appendChild(tradeHoldElement);
                        }
                    }
                }
                
                // Add profit display if component is available and not a special item
                if (ProfitCalculator && !isSpecialItem && this.settings.showProfitCalculation) {
                    const listingData = ProfitCalculator.extractListingData(marketElement);
                    if (listingData) {
                        const profitElement = ProfitCalculator.createProfitDisplay(listingData, 'market');
                        if (profitElement) {
                            const actionDiv = marketElement.querySelector('.market_listing_row_action');
                            if (actionDiv) {
                                actionDiv.appendChild(profitElement);
                            }
                        }
                    }
                }
                
                // Add quick buy button if component is available and enabled
                if (QuickBuyButtons && this.settings.enableQuickBuy && !isSpecialItem) {
                    const listingData = ProfitCalculator?.extractListingData(marketElement);
                    const listingId = marketElement.id || `listing_${Date.now()}`;
                    
                    if (listingData) {
                        const quickBuyElement = QuickBuyButtons.createQuickBuyButtons(
                            listingData, 
                            itemInfo, 
                            listingId
                        );
                        
                        if (quickBuyElement) {
                            const actionDiv = marketElement.querySelector('.market_listing_row_action');
                            if (actionDiv) {
                                actionDiv.appendChild(quickBuyElement);
                            }
                        }
                    }
                }
                
            } catch (error) {
                this.log('Error adding market enhancements:', error);
            }
        },

        createMeleeDisplay(itemInfo, type) {
            const container = document.createElement('div');
            container.className = `cs2-float-display cs2-special-${type}`;
            
            const weaponType = itemInfo?.weapon_type || 'Unknown Item';
            const paintSeed = itemInfo?.paintseed || 0;
            const stickers = itemInfo?.stickers || [];
            const keychains = itemInfo?.keychains || [];
            
            // Determine item type
            let itemTypeDisplay = 'Special Item';
            let color = '#fbbf24';
            
            if (weaponType.includes('Sabre') || weaponType.includes('Knife') || weaponType.includes('Bayonet') || weaponType.includes('Karambit')) {
                itemTypeDisplay = 'Melee';
                color = '#fbbf24';
            } else if (weaponType.includes('Sticker') || weaponType.includes('Patch')) {
                itemTypeDisplay = 'Sticker/Patch';
                color = '#8b5cf6';
            } else if (weaponType.includes('Music Kit')) {
                itemTypeDisplay = 'Music Kit';
                color = '#3b82f6';
            } else if (weaponType.includes('Graffiti')) {
                itemTypeDisplay = 'Graffiti';
                color = '#f59e0b';
            } else if (weaponType.includes('Case')) {
                itemTypeDisplay = 'Case';
                color = '#6b7280';
            } else if (weaponType.includes('Key')) {
                itemTypeDisplay = 'Key';
                color = '#f59e0b';
            }
            
            if (type === 'inventory') {
                // For inventory - positioned overlay using CSS classes
                container.innerHTML = `
                    <div class="item-info" style="z-index: 10;">
                        <div class="float-data">
                            <div class="item_row item_row__value">
                                <span class="special-item-type" style="
                                    background: rgba(0, 0, 0, 0.8);
                                    color: ${color};
                                    padding: 2px 4px;
                                    border-radius: 3px;
                                    font-size: 10px;
                                    font-weight: bold;
                                    white-space: nowrap;
                                ">${itemTypeDisplay}</span>
                            </div>
                        </div>
                    </div>
                    ${paintSeed > 0 ? `
                    <div class="item-info-paintseed" style="z-index: 11;">
                        <div class="float-data">
                            <div class="item_row item_row__transparent">
                                <span class="paintseed" style="
                                    background: rgba(0, 0, 0, 0.8);
                                    color: #c7d2fe;
                                    padding: 1px 3px;
                                    border-radius: 2px;
                                    font-size: 9px;
                                ">#{paintSeed}</span>
                            </div>
                        </div>
                    </div>` : ''}
                `;
            } else {
                // For market listings - inline text style
                container.innerHTML = `
                    <div class="cs2-market-special" style="
                        background: transparent; 
                        color: ${color}; 
                        padding: 2px 0; 
                        margin: 2px 0; 
                        border-radius: 0; 
                        font-size: 11px;
                        font-weight: bold;
                        border: none;
                        box-shadow: none;
                    ">
                        ${itemTypeDisplay}${paintSeed > 0 ? ` • #${paintSeed}` : ''}
                    </div>
                `;
            }
            
            return container;
        },

        createErrorIndicator(errorType = 'unknown', errorMessage = '') {
            const error = document.createElement('div');
            error.className = 'cs2-float-error';
            
            // Determine display based on error type
            let displayText = '!';
            let title = 'Float check failed';
            let backgroundColor = 'rgba(239, 68, 68, 0.9)';
            
            if (errorType === 'rate_limit' || errorMessage.toLowerCase().includes('rate limit')) {
                displayText = 'Rate Limited';
                title = 'API rate limit reached - try refreshing in a few moments';
                backgroundColor = 'rgba(245, 158, 11, 0.9)'; // Orange
            } else if (errorType === 'api_error') {
                displayText = 'API Error';
                title = 'API temporarily unavailable';
                backgroundColor = 'rgba(239, 68, 68, 0.9)'; // Red
            } else if (errorType === 'timeout') {
                displayText = 'Timeout';
                title = 'Request timed out - try refreshing';
                backgroundColor = 'rgba(156, 163, 175, 0.9)'; // Gray
            }
            
            error.textContent = displayText;
            error.title = title;
            error.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: ${backgroundColor};
                color: white;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 10px;
                font-weight: bold;
                z-index: 1000;
                cursor: help;
                user-select: none;
            `;
            return error;
        },

        getWearName(floatValue) {
            if (floatValue < 0.07) return 'FN';
            if (floatValue < 0.15) return 'MW';
            if (floatValue < 0.38) return 'FT';
            if (floatValue < 0.45) return 'WW';
            return 'BS';
        },

        getOriginName(origin) {
            const origins = {
                0: 'Timed Drop',
                1: 'Achievement',
                2: 'Purchased',
                3: 'Traded',
                4: 'Crafted',
                5: 'Store Promotion',
                6: 'Gifted',
                7: 'Support Granted',
                8: 'Found in Crate',
                9: 'Earned',
                10: 'Third-Party Site',
                11: 'Halloween Drop',
                12: 'Steam Purchase',
                14: 'Market',
                15: 'Quest Reward',
                16: 'Level Up Reward'
            };
            return origins[origin] || `Origin ${origin}`;
        },

        addFloatHighlight(element, floatValue) {
            if (this.settings.highlightLowFloat && floatValue <= this.settings.lowFloatThreshold) {
                element.style.boxShadow = '0 0 10px #22c55e';
                element.style.border = '2px solid #22c55e';
            } else if (this.settings.highlightHighFloat && floatValue >= this.settings.highFloatThreshold) {
                element.style.boxShadow = '0 0 10px #ef4444';
                element.style.border = '2px solid #ef4444';
            }
        },

        addHoverTooltip(element, floatData) {
            element.addEventListener('mouseenter', (e) => {
                this.showTooltip(e, floatData);
            });
            
            element.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        },

        showTooltip(event, floatData) {
            this.hideTooltip(); // Remove any existing tooltip
            
            const tooltip = document.createElement('div');
            tooltip.className = 'cs2-float-tooltip';
            
            // Extract data correctly from API response
            const itemInfo = floatData?.iteminfo || floatData;
            const floatValue = itemInfo?.floatvalue || itemInfo?.float_value;
            const paintSeed = itemInfo?.paintseed || itemInfo?.paint_seed || 'Unknown';
            const paintIndex = itemInfo?.paintindex || itemInfo?.paint_index || 'Unknown';
            const origin = itemInfo?.origin || 'Unknown';
            const originName = itemInfo?.origin_name || this.getOriginName(origin);
            
            if (!floatValue) {
                this.log('No float value available for tooltip');
                return;
            }
            
            const precision = this.settings.floatPrecision || 0;
            const displayFloat = precision === 0 ? parseFloat(floatValue).toString() : parseFloat(floatValue).toFixed(precision);
            const wearName = this.getWearName(floatValue);
            
            tooltip.innerHTML = `
                <div class="tooltip-header">CS2 Float Info</div>
                <div class="tooltip-row">
                    <span>Float:</span>
                    <span style="color: #8F98A0; font-weight: bold;">${displayFloat}</span>
                </div>
                <div class="tooltip-row">
                    <span>Wear:</span>
                    <span>${wearName}</span>
                </div>
                <div class="tooltip-row">
                    <span>Paint Seed:</span>
                    <span>${paintSeed}</span>
                </div>
                ${paintIndex !== 'Unknown' ? `
                <div class="tooltip-row">
                    <span>Paint Index:</span>
                    <span>${paintIndex}</span>
                </div>` : ''}
                ${originName !== 'Unknown' ? `
                <div class="tooltip-row">
                    <span>Origin:</span>
                    <span>${originName}</span>
                </div>` : ''}
            `;
            
            tooltip.style.cssText = `
                position: fixed;
                background: rgba(42, 50, 58, 0.98);
                color: #c6d4df;
                padding: 12px;
                border-radius: 3px;
                border: 1px solid rgba(102, 119, 136, 0.4);
                font-size: 12px;
                z-index: 99999;
                pointer-events: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
                font-family: Arial, Helvetica, sans-serif;
            `;
            
            // Position tooltip near cursor
            const x = event.clientX + 10;
            const y = event.clientY - 10;
            
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
            
            document.body.appendChild(tooltip);
            this.currentTooltip = tooltip;
        },

        hideTooltip() {
            if (this.currentTooltip) {
                this.currentTooltip.remove();
                this.currentTooltip = null;
            }
        },

        setupMarketObserver() {
            const observer = new MutationObserver((mutations) => {
                let hasNewListings = false;
                
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach((node) => {
                            if (node.nodeType === Node.ELEMENT_NODE) {
                                if (node.classList.contains('market_listing_row') || 
                                    node.querySelector('.market_listing_row')) {
                                    hasNewListings = true;
                                }
                            }
                        });
                    }
                });
                
                if (hasNewListings) {
                    this.log('New market listings detected, processing...');
                    setTimeout(() => this.processMarketPage(), 500);
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        },

        setupCopyToClipboard() {
            const self = this; // Preserve context
            // Simple click handler like CSGOFloat
            document.addEventListener('click', async (event) => {
                // Find the copyable element
                let target = event.target;
                
                // Check if clicking on SVG path
                if (target.tagName === 'path' || target.tagName === 'svg') {
                    target = target.closest('.cs2-float-copyable');
                }
                
                if (!target) {
                    // Look up the tree for copyable element
                    target = event.target;
                    while (target && !target.classList.contains('cs2-float-copyable')) {
                        target = target.parentElement;
                        if (!target || target === document.body) return;
                    }
                }
                
                if (target && target.classList.contains('cs2-float-copyable')) {
                    event.preventDefault();
                    event.stopPropagation();
                    
                    const floatValue = target.getAttribute('data-float-value') || target.dataset.floatValue;
                    if (floatValue) {
                        try {
                            // Show loading state
                            const originalSVG = target.querySelector('svg');
                            if (originalSVG) {
                                // Store original SVG
                                const originalSVGContent = originalSVG.innerHTML;
                                
                                // Show loading spinner
                                originalSVG.innerHTML = `
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
                                    <path d="M22 12A10 10 0 0 0 12 2" stroke="currentColor" stroke-width="2" fill="none">
                                        <animateTransform attributeName="transform" type="rotate" values="0 12 12;360 12 12" dur="1s" repeatCount="indefinite"/>
                                    </path>
                                `;
                                originalSVG.setAttribute('viewBox', '0 0 24 24');
                            }
                            
                            await navigator.clipboard.writeText(floatValue);
                            
                            // Show success tick
                            if (originalSVG) {
                                originalSVG.innerHTML = `
                                    <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
                                `;
                                originalSVG.setAttribute('viewBox', '0 0 24 24');
                                
                                // Reset to original after 2 seconds
                                setTimeout(() => {
                                    originalSVG.innerHTML = originalSVGContent;
                                    originalSVG.setAttribute('viewBox', '0 0 24 24');
                                }, 2000);
                            }
                            
                            console.log('[CS2 Float] Copied to clipboard:', floatValue);
                        } catch (error) {
                            // Fallback copy method with same visual feedback
                            try {
                                const originalSVG = target.querySelector('svg');
                                let originalSVGContent;
                                
                                if (originalSVG) {
                                    originalSVGContent = originalSVG.innerHTML;
                                    // Show loading spinner
                                    originalSVG.innerHTML = `
                                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" opacity="0.3"/>
                                        <path d="M22 12A10 10 0 0 0 12 2" stroke="currentColor" stroke-width="2" fill="none">
                                            <animateTransform attributeName="transform" type="rotate" values="0 12 12;360 12 12" dur="1s" repeatCount="indefinite"/>
                                        </path>
                                    `;
                                    originalSVG.setAttribute('viewBox', '0 0 24 24');
                                }
                                
                                const textArea = document.createElement('textarea');
                                textArea.value = floatValue;
                                textArea.style.position = 'fixed';
                                textArea.style.top = '0';
                                textArea.style.left = '0';
                                textArea.style.width = '2em';
                                textArea.style.height = '2em';
                                textArea.style.padding = '0';
                                textArea.style.border = 'none';
                                textArea.style.outline = 'none';
                                textArea.style.boxShadow = 'none';
                                textArea.style.background = 'transparent';
                                document.body.appendChild(textArea);
                                textArea.focus();
                                textArea.select();
                                
                                const successful = document.execCommand('copy');
                                document.body.removeChild(textArea);
                                
                                if (successful) {
                                    // Show success tick
                                    if (originalSVG) {
                                        originalSVG.innerHTML = `
                                            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
                                        `;
                                        originalSVG.setAttribute('viewBox', '0 0 24 24');
                                        
                                        // Reset to original after 2 seconds
                                        setTimeout(() => {
                                            originalSVG.innerHTML = originalSVGContent;
                                            originalSVG.setAttribute('viewBox', '0 0 24 24');
                                        }, 2000);
                                    }
                                    
                                    console.log('[CS2 Float] Copied to clipboard (fallback):', floatValue);
                                } else {
                                    // Reset SVG on failure
                                    if (originalSVG && originalSVGContent) {
                                        originalSVG.innerHTML = originalSVGContent;
                                        originalSVG.setAttribute('viewBox', '0 0 24 24');
                                    }
                                    throw new Error('Copy command failed');
                                }
                            } catch (fallbackError) {
                                // Reset SVG on complete failure
                                const originalSVG = target.querySelector('svg');
                                if (originalSVG) {
                                    // Reset to copy icon
                                    originalSVG.innerHTML = `
                                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                                    `;
                                    originalSVG.setAttribute('viewBox', '0 0 24 24');
                                }
                                
                                console.error('[CS2 Float] Copy failed:', fallbackError);
                                alert(`Float value: ${floatValue}\n\nCopy failed. Please copy manually.`);
                            }
                        }
                    }
                }
            });
        },

        // Inventory observer no longer needed - Steam API handles dynamic updates

        injectStyles() {
            if (document.getElementById('cs2-float-styles')) return;
            
            const styles = document.createElement('style');
            styles.id = 'cs2-float-styles';
            styles.textContent = `
                .cs2-float-display {
                    font-family: 'Courier New', monospace;
                    user-select: none;
                }
                
                .cs2-float-value {
                    font-weight: bold;
                    font-size: 11px;
                }
                
                .cs2-float-wear {
                    font-size: 9px;
                    opacity: 0.8;
                }
                
                .cs2-float-tooltip {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                }
                
                .cs2-float-tooltip .tooltip-header {
                    font-weight: bold;
                    margin-bottom: 8px;
                    color: #22c55e;
                    border-bottom: 1px solid #333;
                    padding-bottom: 4px;
                }
                
                .cs2-float-tooltip .tooltip-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 4px 0;
                    min-width: 120px;
                }
                
                /* Keep our float display behind Steam popups but allow interaction */
                .cs2-float-display.cs2-float-market {
                    z-index: 1 !important;
                    position: relative !important;
                }
                
                /* Ensure copyable elements are clickable */
                .cs2-float-copyable {
                    pointer-events: auto !important;
                    cursor: pointer !important;
                }
                
                /* Copy icon hover effect */
                .cs2-float-copyable:hover {
                    opacity: 1 !important;
                    transform: scale(1.1);
                    transition: all 0.2s ease;
                }
                
                /* Remove underlines from copyable elements */
                .cs2-float-copyable {
                    text-decoration: none !important;
                }
                
                .cs2-float-copyable:hover {
                    text-decoration: none !important;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `;
            
            document.head.appendChild(styles);
        }
    };

    // Initialize when script loads
    CS2FloatChecker.init();
})();