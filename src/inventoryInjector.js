// Steam Inventory Injector - Uses Steam's internal APIs
(() => {
    'use strict';
    
    const InventoryFloatChecker = {
        initialized: false,
        processedAssets: new Set(),
        settings: {
            autoLoad: true,
            showStickers: true,
            showKeychains: true,
            floatPrecision: 6
        },
        
        log(...args) {
            console.log('[CS2 Inventory Float Checker]', ...args);
        },

        formatFloat(floatValue) {
            return floatValue.toString();
        },
        
        init() {
            if (this.initialized) return;
            this.initialized = true;
            
            this.log('Initializing inventory float checker...');
            
            // Listen for settings updates
            this.setupSettingsListener();
            
            // Set up click handler for item inspection
            this.setupItemClickHandler();
            
            this.waitForSteamInventory();
        },

        setupSettingsListener() {
            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'CS2_FLOAT_SETTINGS') {
                    this.log('📨 Received settings:', event.data.settings);
                    this.settings = { ...this.settings, ...event.data.settings };
                    
                    // Restart processing with new settings
                    this.processedAssets.clear();
                    if (this.settings.autoLoad) {
                        this.waitForSteamInventory();
                    }
                }
            });
        },
        
        setupItemClickHandler() {
            this.log('🖱️ Setting up item click handler...');
            
            // Listen for clicks on inventory items
            document.addEventListener('click', (event) => {
                const clickedItem = event.target.closest('.item.app730.context2');
                if (clickedItem) {
                    this.log(`🖱️ Clicked on CS2 item: ${clickedItem.id}`);
                    
                    // Wait a bit for Steam to update the item info panel
                    setTimeout(() => {
                        this.processClickedItem(clickedItem.id);
                    }, 500);
                }
            });
        },
        
        processClickedItem(itemId) {
            this.log(`🔍 Processing clicked item: ${itemId}`);
            
            // Try to extract float from the now-active item info panel
            const floatData = this.extractFloatFromActiveItemInfo();
            if (floatData) {
                this.log(`✅ Extracted float from Steam UI: ${floatData.float}`);
                this.displayFloatDirectly(itemId, floatData);
                
                // Debug display removed for production
            } else {
                this.log(`❌ Could not extract float data for ${itemId}`);
            }
        },
        
        extractFloatFromActiveItemInfo() {
            // Check both iteminfo panels
            for (let i = 0; i <= 1; i++) {
                const itemInfoId = `iteminfo${i}`;
                const itemInfo = document.getElementById(itemInfoId);
                
                if (itemInfo && (itemInfo.style.opacity === '1' || itemInfo.style.zIndex > 1)) {
                    const assetProps = document.getElementById(`${itemInfoId}_item_asset_properties_content`);
                    if (assetProps && assetProps.textContent) {
                        const text = assetProps.textContent;
                        this.log(`📄 Found asset properties in ${itemInfoId}:`, text);
                        
                        // Extract float value (format: "Wear Rating: 0.359675586")
                        const floatMatch = text.match(/Wear Rating:\s*([\d.]+)/);
                        const seedMatch = text.match(/Pattern Template:\s*(\d+)/);
                        
                        if (floatMatch) {
                            return {
                                float: parseFloat(floatMatch[1]),
                                paintSeed: seedMatch ? parseInt(seedMatch[1]) : null
                            };
                        }
                    }
                }
            }
            
            return null;
        },
        
        waitForSteamInventory() {
            // Check if Steam's inventory system is available
            if (typeof g_ActiveInventory === 'undefined') {
                this.log('Steam inventory not ready, retrying in 1s...');
                
                // Also try DOM-based fallback approach
                this.checkDOMInventory();
                
                setTimeout(() => this.waitForSteamInventory(), 1000);
                return;
            }
            
            this.log('Steam inventory detected:', g_ActiveInventory);
            this.setupInventoryHooks();
            
            // Also run DOM-based auto-loading as backup
            setTimeout(() => {
                this.runAutoLoader();
            }, 2000);
        },
        
        checkDOMInventory() {
            // Fallback: Check if CS2 items are visible in DOM
            const cs2Items = document.querySelectorAll('.item.app730.context2');
            this.updateDebugStats(null, cs2Items.length);
            
            if (cs2Items.length > 0) {
                this.log(`🎯 DOM Fallback: Found ${cs2Items.length} CS2 items in DOM`);
                // Debug display removed
                
                // Log each item's details from DOM
                cs2Items.forEach((item, index) => {
                    this.log(`DOM Item ${index + 1}:`, {
                        id: item.id,
                        classes: item.className,
                        hasInspectLink: !!item.querySelector('a[href*="steam://rungame/730"]'),
                        hasAssetProps: !!document.getElementById('iteminfo1_item_asset_properties_content')?.textContent
                    });
                });
                
                // Try to process DOM items directly  
                this.processDOMItems(cs2Items);
            } else {
                this.log('❌ No CS2 items found in DOM either');
                // Debug display removed
            }
        },
        
        processDOMItems(items) {
            this.log('🔧 Processing DOM items directly with auto-loading...');
            let processedCount = 0;
            
            // Process each CS2 item automatically
            items.forEach((item, index) => {
                const itemId = item.id;
                
                if (itemId) {
                    this.log(`📋 DOM Item ${index + 1}: ${itemId}`);
                    
                    // Extract asset ID from item ID (format: appid_contextid_assetid)  
                    const parts = itemId.split('_');
                    const assetId = parts[2];
                    
                    if (assetId) {
                        // Try to auto-extract float by simulating a click to load item info
                        this.autoLoadFloatForItem(itemId, index);
                        processedCount++;
                    }
                }
            });
            
            if (processedCount > 0) {
                // this.updateDebugDisplay(`🔄 Auto-loading ${processedCount} floats...`, 'orange');
            }
        },
        
        autoLoadFloatForItem(itemId, index) {
            // Simulate clicking the item to load its info, then extract float
            setTimeout(() => {
                this.log(`🔄 Auto-loading float for ${itemId}...`);
                
                // Click the item to load its data into Steam's item info panel
                const item = document.getElementById(itemId);
                if (item) {
                    // Simulate the click that Steam uses to load item info
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    item.dispatchEvent(clickEvent);
                    
                    // Wait for Steam to load the item info, then extract float
                    setTimeout(() => {
                        this.processClickedItem(itemId);
                    }, 300);
                }
            }, index * 200); // Stagger the loading to avoid overwhelming Steam's system
        },
        
        runAutoLoader() {
            if (!this.settings.autoLoad) {
                this.log('⏸️ Auto-load disabled, skipping automatic float loading...');
                return;
            }
            
            this.log('🚀 Running automatic float loader...');
            
            // Find all CS2 items in the inventory
            const cs2Items = document.querySelectorAll('.item.app730.context2');
            if (cs2Items.length > 0) {
                this.log(`🔍 Found ${cs2Items.length} CS2 items, auto-loading floats...`);
                this.processDOMItems(cs2Items);
            } else {
                this.log('⚠️ No CS2 items found for auto-loading');
            }
        },
        
        extractFloatFromItemInfo(itemId) {
            // Look for Steam's item info panel that contains float data
            const itemInfoId = 'iteminfo1'; // Steam uses iteminfo0 and iteminfo1
            const itemInfo = document.getElementById(itemInfoId);
            
            if (itemInfo && itemInfo.style.opacity === '1') {
                // Check if this iteminfo corresponds to our item
                const assetProps = document.getElementById(`${itemInfoId}_item_asset_properties_content`);
                if (assetProps && assetProps.textContent) {
                    const text = assetProps.textContent;
                    this.log('📄 Found asset properties:', text);
                    
                    // Extract float value (format: "Wear Rating: 0.359675586")
                    const floatMatch = text.match(/Wear Rating:\s*([\d.]+)/);
                    const seedMatch = text.match(/Pattern Template:\s*(\d+)/);
                    
                    if (floatMatch) {
                        return {
                            float: parseFloat(floatMatch[1]),
                            paintSeed: seedMatch ? parseInt(seedMatch[1]) : null
                        };
                    }
                }
            }
            
            return null;
        },
        
        displayFloatDirectly(itemId, floatData) {
            const element = document.getElementById(itemId);
            if (!element) {
                this.log(`❌ Cannot find DOM element for ${itemId}`);
                return;
            }
            
            // Remove existing float displays
            element.querySelectorAll('.float_block, .item-info, .item-info-paintseed, .cs2-float-display').forEach(el => el.remove());
            
            // Use competitor-style display
            this.createCompetitorStyleDisplay(element, floatData);
            this.log(`✅ Displayed float for ${itemId}: ${floatData.float}`);
        },
        
        setupInventoryHooks() {
            this.log('Setting up inventory hooks...');
            // this.updateDebugDisplay('🔧 Setting up hooks...', 'yellow');
            
            // Log current inventory state
            this.log('Inventory state check:');
            this.log('- appid:', g_ActiveInventory?.appid);
            this.log('- m_bFullyLoaded:', g_ActiveInventory?.m_bFullyLoaded);
            this.log('- m_rgPages exists:', !!g_ActiveInventory?.m_rgPages);
            this.log('- m_rgAssets exists:', !!g_ActiveInventory?.m_rgAssets);
            
            if (g_ActiveInventory?.m_rgAssets) {
                const assetCount = Object.keys(g_ActiveInventory.m_rgAssets).length;
                this.log('- Total assets:', assetCount);
                // this.updateDebugDisplay(`📦 Found ${assetCount} assets`, 'blue');
            }
            
            // Hook into inventory loading
            if (g_ActiveInventory && g_ActiveInventory.m_bFullyLoaded) {
                this.log('✅ Inventory fully loaded, processing existing items...');
                // this.updateDebugDisplay('✅ Fully loaded - processing items', 'green');
                this.processInventoryItems();
            } else if (g_ActiveInventory && g_ActiveInventory.m_rgPages) {
                this.log('⏳ Inventory partially loaded, processing pages...');
                // this.updateDebugDisplay('⏳ Partially loaded - processing pages', 'orange');
                this.processInventoryPages();
            } else {
                this.log('❌ Inventory not ready');
                // this.updateDebugDisplay('❌ Inventory not ready', 'red');
            }
            
            // Hook into page transitions for dynamic loading
            this.hookPageTransitions();
        },
        
        processInventoryItems() {
            if (!g_ActiveInventory || g_ActiveInventory.appid !== 730) {
                this.log('❌ Not CS2 inventory or no g_ActiveInventory');
                // this.updateDebugDisplay('❌ Not CS2 inventory', 'red');
                return;
            }
            
            this.log('🎮 Processing CS2 inventory items...');
            // this.updateDebugDisplay('🎮 Processing CS2 inventory...', 'blue');
            
            if (g_ActiveInventory.m_rgAssets) {
                const assets = Object.values(g_ActiveInventory.m_rgAssets);
                this.log(`📦 Found ${assets.length} total assets`);
                
                // Debug: Log first few assets to understand structure
                assets.slice(0, 3).forEach((asset, index) => {
                    this.log(`Asset ${index + 1}:`, {
                        assetid: asset.assetid,
                        appid: asset.appid,
                        name: asset.description?.name || 'No name',
                        market_hash_name: asset.description?.market_hash_name || 'No hash name',
                        hasElement: !!asset.element,
                        elementId: asset.element?.id,
                        hasMarketActions: !!asset.description?.market_actions?.length
                    });
                });
                
                // Filter and process CS2 items with skins
                const cs2Items = assets.filter(asset => 
                    typeof asset === 'object' && 
                    asset !== null && 
                    asset.appid !== undefined && 
                    asset.appid === 730 && 
                    this.isCS2Skin(asset.description?.market_hash_name)
                );
                
                this.log(`🔫 Found ${cs2Items.length} CS2 skin items`);
                // this.updateDebugDisplay(`🔫 Found ${cs2Items.length} CS2 skins`, 'green');
                
                let processedCount = 0;
                let successCount = 0;
                
                cs2Items.forEach(asset => {
                    processedCount++;
                    const success = this.processAsset(asset);
                    if (success) successCount++;
                    
                    // Update counter every 10 items or on last item
                    if (processedCount % 10 === 0 || processedCount === cs2Items.length) {
                        // this.updateDebugDisplay(`📊 Processed: ${processedCount}/${cs2Items.length} (${successCount} successful)`, 'blue');
                    }
                });
            } else {
                this.log('❌ No m_rgAssets found in g_ActiveInventory');
                // this.updateDebugDisplay('❌ No assets found', 'red');
            }
        },
        
        processInventoryPages() {
            if (!g_ActiveInventory || g_ActiveInventory.appid !== 730) return;
            
            this.log('Processing inventory pages...');
            this.waitForPageItems();
        },
        
        waitForPageItems() {
            const checkInterval = setInterval(() => {
                const currentPage = g_ActiveInventory?.m_rgPages?.[g_ActiveInventory.m_iCurrentPage];
                if (currentPage?.m_bPageItemsCreated) {
                    clearInterval(checkInterval);
                    this.log('Page items created, processing...');
                    this.processPageItems(currentPage.m_$Page[0].children);
                }
            }, 500);
            
            // Cleanup after 10 seconds
            setTimeout(() => clearInterval(checkInterval), 10000);
        },
        
        processPageItems(pageElements) {
            this.log(`Processing ${pageElements.length} page items`);
            
            for (let i = 0; i < pageElements.length; i++) {
                const element = pageElements[i];
                const item = element.rgItem;
                
                if (item && item.appid === 730 && this.isCS2Skin(item.description.market_hash_name)) {
                    this.processAsset(item);
                }
            }
        },
        
        hookPageTransitions() {
            // Hook CInventory.prototype.FinishPageTransition
            if (typeof CInventory !== 'undefined' && CInventory.prototype.FinishPageTransition) {
                const originalFinish = CInventory.prototype.FinishPageTransition;
                CInventory.prototype.FinishPageTransition = function(page, success) {
                    originalFinish.apply(this, arguments);
                    
                    if (success && g_ActiveInventory?.appid === 730) {
                        setTimeout(() => {
                            InventoryFloatChecker.log('Page transition completed, processing new items...');
                            InventoryFloatChecker.waitForPageItems();
                        }, 500);
                    }
                };
            }
            
            // Hook ShowItemInventory for item selections
            if (typeof ShowItemInventory !== 'undefined') {
                const originalShow = ShowItemInventory;
                window.ShowItemInventory = function(appid, contextid, assetid, owner) {
                    originalShow.apply(this, arguments);
                    
                    if (appid === 730) {
                        setTimeout(() => {
                            InventoryFloatChecker.log('Item inventory shown, processing...');
                            InventoryFloatChecker.waitForPageItems();
                        }, 100);
                    }
                };
            }
        },
        
        processAsset(asset) {
            if (this.processedAssets.has(asset.assetid)) {
                this.log(`⏭️ Asset ${asset.assetid} already processed, skipping`);
                return false;
            }
            this.processedAssets.add(asset.assetid);
            
            this.log(`🔍 Processing asset: ${asset.description?.name || asset.assetid}`);
            
            try {
                // Get inspect URL from market actions (same pattern as competitor)
                const marketActions = asset.description?.market_actions;
                if (!marketActions || !marketActions.length) {
                    this.log(`❌ No market actions for asset ${asset.assetid}`);
                    return false;
                }
                
                const inspectUrl = marketActions[0]?.link
                    ?.replace('%assetid%', asset.assetid)
                    ?.replace('%listingid%', g_ActiveInventory.m_steamid);
                
                if (!inspectUrl) {
                    this.log(`❌ No inspect URL found for asset ${asset.assetid}`);
                    return false;
                }
                
                // Get the DOM element ID (competitor pattern)
                const elementId = asset.element?.id;
                if (!elementId) {
                    this.log(`❌ No element ID found for asset ${asset.assetid}`);
                    return false;
                }
                
                // Check if DOM element exists
                const element = document.getElementById(elementId);
                if (!element) {
                    this.log(`❌ DOM element not found for ID: ${elementId}`);
                    return false;
                }
                
                this.log(`✅ Asset ${asset.assetid} ready:`, {
                    name: asset.description.name,
                    elementId: elementId,
                    inspectUrl: inspectUrl.substring(0, 100) + '...'
                });
                
                // Remove existing float displays
                const existingFloats = element.querySelectorAll('.float_block, .item-info, .item-info-paintseed, .cs2-float-display');
                if (existingFloats.length > 0) {
                    this.log(`🧹 Removing ${existingFloats.length} existing float displays`);
                    existingFloats.forEach(el => el.remove());
                }
                
                // Create float data request (like competitor)
                const floatData = {
                    itemUrl: inspectUrl,
                    elementId: elementId,
                    assetId: asset.assetid
                };
                
                this.log(`📡 Dispatching getFloatInventory event for ${asset.assetid}`);
                
                // Dispatch event to fetch float data (competitor pattern)
                document.dispatchEvent(new CustomEvent('getFloatInventory', {
                    detail: { floatData }
                }));
                
                return true;
                
            } catch (error) {
                this.log(`❌ Error processing asset ${asset.assetid}:`, error);
                return false;
            }
        },
        
        async fetchFloatData(inspectUrl, elementId) {
            try {
                // Send message to background script for API call
                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action: 'fetchFloat',
                        inspectLink: inspectUrl
                    }, resolve);
                });
                
                if (response && response.error) {
                    this.log('API error for element:', elementId, response.error);
                } else if (response && response.iteminfo && response.iteminfo.floatvalue !== undefined) {
                    this.displayFloat(elementId, response.iteminfo);
                } else {
                    this.log('No float data received for element:', elementId);
                }
                
            } catch (error) {
                this.log('Error fetching float data:', error);
            }
        },
        
        displayFloat(elementId, floatData) {
            const element = document.getElementById(elementId);
            if (!element) {
                this.log('Element not found:', elementId);
                return;
            }
            
            this.log(`Displaying float for ${elementId}: ${floatData.floatvalue}`);
            
            // Create float display matching competitor structure
            const floatInfo = document.createElement('div');
            floatInfo.className = 'item-info cs2-float-display';
            
            const floatContainer = document.createElement('div');
            floatContainer.className = 'float-data';
            
            const floatRow = document.createElement('div');
            floatRow.className = 'item_row item_row__value';
            
            const floatValue = document.createElement('span');
            floatValue.className = 'float-value';
            floatValue.title = 'Click to copy float';
            floatValue.textContent = this.formatFloat(floatData.floatvalue);
            floatValue.onclick = () => this.copyToClipboard(this.formatFloat(floatData.floatvalue));
            
            floatRow.appendChild(floatValue);
            floatContainer.appendChild(floatRow);
            floatInfo.appendChild(floatContainer);
            
            // Add paint seed if available
            if (floatData.paintseed) {
                const seedInfo = document.createElement('div');
                seedInfo.className = 'item-info-paintseed cs2-float-display';
                
                const seedContainer = document.createElement('div');
                seedContainer.className = 'float-data';
                
                const seedRow = document.createElement('div');
                seedRow.className = 'item_row item_row__transparent';
                
                const seedValue = document.createElement('span');
                seedValue.className = 'paintseed';
                seedValue.textContent = floatData.paintseed;
                
                seedRow.appendChild(seedValue);
                seedContainer.appendChild(seedRow);
                seedInfo.appendChild(seedContainer);
                
                element.appendChild(seedInfo);
            }
            
            element.appendChild(floatInfo);
            
            // Add styles if not already present
            this.injectStyles();
        },
        
        async copyToClipboard(text) {
            try {
                await navigator.clipboard.writeText(text);
                this.log(`Copied: ${text}`);
                // Could add toast notification here
            } catch (error) {
                this.log('Copy failed:', error);
            }
        },
        
        injectStyles() {
            if (document.getElementById('cs2-inventory-float-styles')) return;
            
            const styles = document.createElement('style');
            styles.id = 'cs2-inventory-float-styles';
            styles.textContent = `
                .item-info {
                    position: absolute;
                    bottom: 2px;
                    left: 2px;
                    right: 2px;
                    background: rgba(0, 0, 0, 0.8);
                    border-radius: 2px;
                    font-size: 10px;
                    color: #fff;
                    z-index: 10;
                }
                
                .item-info-paintseed {
                    position: absolute;
                    bottom: 14px;
                    left: 2px;
                    right: 2px;
                    background: rgba(0, 0, 0, 0.6);
                    border-radius: 2px;
                    font-size: 9px;
                    color: #ccc;
                    z-index: 10;
                }
                
                .float-data .item_row {
                    padding: 1px 4px;
                    text-align: center;
                }
                
                .float-value {
                    cursor: pointer;
                    font-weight: bold;
                }
                
                .float-value:hover {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 2px;
                }
                
                .paintseed {
                    opacity: 0.8;
                }
            `;
            document.head.appendChild(styles);
        },
        
        isCS2Skin(marketHashName) {
            if (!marketHashName) return false;
            
            const conditions = [
                'Factory New',
                'Minimal Wear', 
                'Field-Tested',
                'Well-Worn',
                'Battle-Scarred'
            ];
            
            return conditions.some(condition => marketHashName.includes(condition));
        },
        
        createDebugDisplay() {
            // Remove existing debug display
            const existing = document.getElementById('cs2-inventory-debug');
            if (existing) existing.remove();
            
            // Create debug display
            const debugDiv = document.createElement('div');
            debugDiv.id = 'cs2-inventory-debug';
            debugDiv.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 10px;
                font-family: monospace;
                font-size: 12px;
                z-index: 999999;
                border: 2px solid #4CAF50;
                border-radius: 5px;
                min-width: 300px;
                max-width: 400px;
            `;
            
            // Debug display removed for production
        },
        
        updateDebugStats(steamApi = null, domItems = null) {
            if (steamApi !== null) {
                const steamSpan = document.getElementById('debug-steam-api');
                if (steamSpan) {
                    steamSpan.textContent = steamApi ? '✅' : '❌';
                    steamSpan.style.color = steamApi ? 'lightgreen' : 'red';
                }
            }
            
            if (domItems !== null) {
                const domSpan = document.getElementById('debug-dom-items');
                if (domSpan) {
                    domSpan.textContent = domItems > 0 ? `✅ (${domItems})` : '❌';
                    domSpan.style.color = domItems > 0 ? 'lightgreen' : 'red';
                }
            }
        },
        
        updateDebugDisplay(message, color = 'white') {
            const statusDiv = document.getElementById('cs2-debug-status');
            if (statusDiv) {
                statusDiv.innerHTML = `<span style="color: ${color};">${message}</span>`;
                statusDiv.style.color = color;
            }
        }
    };
    
    // Set up event listener for float data requests
    document.addEventListener('getFloatInventory', async (event) => {
        const { floatData } = event.detail;
        
        InventoryFloatChecker.log('📨 Received getFloatInventory event:', floatData);
        
        if (!floatData || !floatData.itemUrl) {
            InventoryFloatChecker.log('❌ Invalid floatData received:', floatData);
            return;
        }

        try {
            InventoryFloatChecker.log('📡 Sending message to content script for:', floatData.assetId);
            
            // Send message to content script via window postMessage (since we can't use chrome.runtime directly)
            window.postMessage({
                type: 'CS2_FETCH_FLOAT_REQUEST',
                payload: {
                    action: 'fetchFloat',
                    inspectLink: floatData.itemUrl,
                    assetId: floatData.assetId,
                    elementId: floatData.elementId
                }
            }, window.location.origin);
            
        } catch (error) {
            InventoryFloatChecker.log(`❌ Error handling inventory float request for ${floatData.assetId}:`, error);
        }
    });

    // Listen for responses from content script
    window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        
        if (event.data.type === 'CS2_FETCH_FLOAT_RESPONSE') {
            const payload = event.data.payload;
            const { elementId, assetId, error } = payload;
            
            InventoryFloatChecker.log('📥 Received response from content script:', payload);
            
            if (error) {
                InventoryFloatChecker.log(`❌ Error getting float data for ${assetId}: ${error}`);
                return;
            }
            
            // Check different response formats (the response data is spread into payload)
            const floatValue = payload.iteminfo?.floatvalue || payload.floatvalue || payload.float_value;
            const paintSeed = payload.iteminfo?.paintseed || payload.paintseed || payload.paint_seed;
            const stickers = payload.iteminfo?.stickers || payload.stickers || [];
            const keychains = payload.iteminfo?.keychains || payload.keychains || [];
            
            if (floatValue !== undefined) {
                InventoryFloatChecker.log(`✅ Successfully got float data for ${assetId}: ${floatValue}`);
                
                InventoryFloatChecker.displayFloatFromEvent(elementId, {
                    float: floatValue,
                    paintSeed: paintSeed,
                    stickers: stickers,
                    keychains: keychains
                });
                
                // Debug display removed for production
                
            } else {
                InventoryFloatChecker.log(`❌ No float data received for element: ${elementId}`, payload);
            }
        }
    });

    // Add the display function that matches competitor pattern
    InventoryFloatChecker.displayFloatFromEvent = function(elementId, floatData) {
        const element = document.getElementById(elementId);
        if (!element) {
            this.log('Element not found:', elementId);
            return;
        }
        
        // Remove existing float displays
        element.querySelectorAll('.float_block, .item-info, .item-info-paintseed, .cs2-float-display').forEach(el => el.remove());
        
        // Use the competitor's exact display function pattern
        this.createCompetitorStyleDisplay(element, floatData);
    };

    InventoryFloatChecker.createCompetitorStyleDisplay = function(element, floatData) {
        // Create our unique float display with multiple style options
        const displayStyle = this.getDisplayStyle(); // We'll add this function
        
        if (displayStyle === 'modern-card') {
            this.createModernCardDisplay(element, floatData);
        } else if (displayStyle === 'minimal-badge') {
            this.createMinimalBadgeDisplay(element, floatData);
        } else if (displayStyle === 'corner-overlay') {
            this.createCornerOverlayDisplay(element, floatData);
        } else {
            this.createDefaultDisplay(element, floatData);
        }
    };
    
    InventoryFloatChecker.getDisplayStyle = function() {
        // For now, let's use modern-card. Later we can make this configurable
        return 'modern-card';
    };
    
    // Style 1: Modern Card Display (bottom overlay with gradient)
    InventoryFloatChecker.createModernCardDisplay = function(element, floatData) {
        const floatContainer = document.createElement('div');
        floatContainer.className = 'cs2-float-modern-card';
        floatContainer.style.cssText = `
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: transparent;
            color: white;
            padding: 4px 6px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 11px;
            font-weight: 600;
            text-align: center;
            border-radius: 0 0 3px 3px;
            cursor: pointer;
            transition: all 0.2s ease;
            z-index: 15;
        `;
        
        floatContainer.innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center;">
                <span style="font-family: 'Courier New', monospace; font-weight: bold; color: #4CAF50;">${this.formatFloat(floatData.float)}</span>
            </div>
        `;
        
        // Add hover tooltip
        this.addHoverTooltip(floatContainer, floatData);
        
        floatContainer.onclick = () => this.copyToClipboard(this.formatFloat(floatData.float));
        
        element.appendChild(floatContainer);
    };
    
    // Style 2: Minimal Badge Display (top-right corner)
    InventoryFloatChecker.createMinimalBadgeDisplay = function(element, floatData) {
        const floatBadge = document.createElement('div');
        floatBadge.className = 'cs2-float-minimal-badge';
        floatBadge.style.cssText = `
            position: absolute;
            top: 3px;
            right: 3px;
            background: rgba(33, 150, 243, 0.95);
            color: white;
            padding: 2px 5px;
            font-family: 'Courier New', monospace;
            font-size: 9px;
            font-weight: bold;
            border-radius: 8px;
            cursor: pointer;
            z-index: 15;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        `;
        
        floatBadge.textContent = this.formatFloat(floatData.float);
        floatBadge.title = `Float: ${this.formatFloat(floatData.float)}${floatData.paintSeed ? ` | Seed: ${floatData.paintSeed}` : ''}\nClick to copy`;
        
        floatBadge.onmouseover = () => {
            floatBadge.style.background = 'rgba(33, 150, 243, 1)';
            floatBadge.style.transform = 'scale(1.05)';
        };
        floatBadge.onmouseout = () => {
            floatBadge.style.background = 'rgba(33, 150, 243, 0.95)';
            floatBadge.style.transform = 'scale(1)';
        };
        
        floatBadge.onclick = () => this.copyToClipboard(this.formatFloat(floatData.float));
        
        element.appendChild(floatBadge);
    };
    
    // Style 3: Corner Overlay Display (left side)
    InventoryFloatChecker.createCornerOverlayDisplay = function(element, floatData) {
        const floatOverlay = document.createElement('div');
        floatOverlay.className = 'cs2-float-corner-overlay';
        floatOverlay.style.cssText = `
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            background: linear-gradient(90deg, rgba(255, 152, 0, 0.9) 0%, transparent 100%);
            color: white;
            padding: 6px 8px 6px 4px;
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 10px;
            font-weight: 600;
            cursor: pointer;
            z-index: 15;
            transition: all 0.2s ease;
            text-shadow: none;
        `;
        
        floatOverlay.innerHTML = `
            <div style="writing-mode: vertical-rl; text-orientation: mixed;">
                <div style="font-size: 8px; opacity: 0.8;">FLOAT</div>
                <div style="font-family: 'Courier New', monospace; margin-top: 2px;">${floatData.float.toString()}</div>
            </div>
        `;
        
        floatOverlay.title = `Float: ${floatData.float.toString()}${floatData.paintSeed ? ` | Seed: ${floatData.paintSeed}` : ''}\nClick to copy`;
        
        floatOverlay.onmouseover = () => {
            floatOverlay.style.background = 'linear-gradient(90deg, rgba(255, 152, 0, 1) 0%, rgba(255, 152, 0, 0.3) 100%)';
            floatOverlay.style.transform = 'translateY(-50%) translateX(2px)';
        };
        floatOverlay.onmouseout = () => {
            floatOverlay.style.background = 'linear-gradient(90deg, rgba(255, 152, 0, 0.9) 0%, transparent 100%)';
            floatOverlay.style.transform = 'translateY(-50%)';
        };
        
        floatOverlay.onclick = () => this.copyToClipboard(floatData.float.toString());
        
        element.appendChild(floatOverlay);
    };
    
    // Default fallback style
    InventoryFloatChecker.createDefaultDisplay = function(element, floatData) {
        const floatDisplay = document.createElement('div');
        floatDisplay.className = 'cs2-float-default';
        floatDisplay.style.cssText = `
            position: absolute;
            bottom: 2px;
            left: 2px;
            right: 2px;
            background: rgba(0, 0, 0, 0.8);
            color: #4CAF50;
            padding: 2px 4px;
            font-family: 'Courier New', monospace;
            font-size: 10px;
            text-align: center;
            border-radius: 2px;
            cursor: pointer;
            z-index: 15;
        `;
        
        floatDisplay.textContent = `⚡ ${floatData.float.toString()}`;
        floatDisplay.title = `Click to copy float${floatData.paintSeed ? ` | Seed: ${floatData.paintSeed}` : ''}`;
        floatDisplay.onclick = () => this.copyToClipboard(floatData.float.toString());
        
        element.appendChild(floatDisplay);
    };

    // Add hover tooltip functionality
    InventoryFloatChecker.addHoverTooltip = function(element, floatData) {
        let tooltip = null;
        
        element.addEventListener('mouseenter', (e) => {
            if (tooltip) return; // Prevent multiple tooltips
            
            tooltip = document.createElement('div');
            tooltip.className = 'cs2-inventory-tooltip';
            tooltip.style.cssText = `
                position: fixed;
                background: rgba(42, 50, 58, 0.98);
                color: #c6d4df;
                padding: 12px;
                border-radius: 3px;
                border: 1px solid rgba(102, 119, 136, 0.4);
                font-size: 12px;
                z-index: 999999;
                pointer-events: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.8);
                font-family: Arial, Helvetica, sans-serif;
                max-width: 250px;
            `;
            
            const floatValue = floatData.float.toString();
            const wearName = InventoryFloatChecker.getWearName(floatData.float);
            
            tooltip.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 8px; color: #4CAF50; border-bottom: 1px solid #333; padding-bottom: 4px;">
                    CS2 Float Info
                </div>
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                    <span>Float:</span>
                    <span style="color: #4CAF50; font-weight: bold; font-family: monospace;">${floatValue}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                    <span>Wear:</span>
                    <span>${wearName}</span>
                </div>
                ${floatData.paintSeed ? `
                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                    <span>Paint Seed:</span>
                    <span>${floatData.paintSeed}</span>
                </div>` : ''}
                ${InventoryFloatChecker.settings.showStickers && floatData.stickers && floatData.stickers.length > 0 ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #333;">
                    <div style="font-weight: bold; margin-bottom: 4px;">Stickers:</div>
                    ${floatData.stickers.map(sticker => `<div style="margin: 2px 0; font-size: 12px;">${sticker.name || 'Sticker'}</div>`).join('')}
                </div>` : ''}
                ${InventoryFloatChecker.settings.showKeychains && floatData.keychains && floatData.keychains.length > 0 ? `
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #333;">
                    <div style="font-weight: bold; margin-bottom: 4px;">Keychains:</div>
                    ${floatData.keychains.map(keychain => `<div style="margin: 2px 0; font-size: 12px;">${keychain.name || 'Keychain'}</div>`).join('')}
                </div>` : ''}
            `;
            
            // Position tooltip near cursor
            const x = e.clientX + 10;
            const y = e.clientY - 10;
            
            tooltip.style.left = x + 'px';
            tooltip.style.top = y + 'px';
            
            document.body.appendChild(tooltip);
        });
        
        element.addEventListener('mouseleave', () => {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
        });
    };
    
    // Add wear name function
    InventoryFloatChecker.getWearName = function(floatValue) {
        if (floatValue < 0.07) return 'Factory New';
        if (floatValue < 0.15) return 'Minimal Wear';
        if (floatValue < 0.38) return 'Field-Tested';
        if (floatValue < 0.45) return 'Well-Worn';
        return 'Battle-Scarred';
    };

    // Debug load indicator removed for production
    
    // Initialize when script loads
    InventoryFloatChecker.init();
    
    // Expose for debugging
    window.InventoryFloatChecker = InventoryFloatChecker;
    
    // Log to console immediately
    console.log('🎮 CS2 Inventory Float Checker Script Loaded!', new Date().toLocaleTimeString());
})();