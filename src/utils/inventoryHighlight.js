/**
 * Inventory Highlighting Module
 * Highlights market items that the user already owns in their inventory
 */

export class InventoryHighlighter {
    constructor() {
        this.ownedItems = new Set();
        this.settings = {
            highlightOwned: true
        };
        this.cache = {
            inventory: null,
            lastFetch: 0,
            expiry: 5 * 60 * 1000 // 5 minutes cache
        };
    }

    log(...args) {
        console.log('[Inventory Highlighter]', ...args);
    }

    async init() {
        this.log('Initializing inventory highlighter...');
        await this.loadSettings();
        
        // Check if we're on inventory page to collect items
        if (this.isInventoryPage()) {
            this.log('On inventory page - collecting owned items...');
            this.collectInventoryItems();
        }
        
        if (this.settings.highlightOwned && this.isMarketPage()) {
            await this.loadUserInventory();
            this.highlightOwnedItems();
        }
    }
    
    isInventoryPage() {
        const url = window.location.href;
        return url.includes('/inventory');
    }
    
    collectInventoryItems() {
        this.log('Starting inventory collection...');
        
        // Function to extract item names when user hovers/clicks items
        const extractFromItemInfo = () => {
            // Check both iteminfo panels
            for (let i = 0; i <= 1; i++) {
                const nameElement = document.querySelector(`#iteminfo${i}_item_name`);
                const descriptorElement = document.querySelector(`#iteminfo${i}_item_descriptors`);
                
                if (nameElement && nameElement.textContent) {
                    let itemName = nameElement.textContent.trim();
                    
                    // Skip if it's just "Counter-Strike 2"
                    if (itemName === 'Counter-Strike 2') continue;
                    
                    // Try to get wear condition from descriptors
                    if (descriptorElement) {
                        const descriptorText = descriptorElement.textContent;
                        // Look for exterior conditions
                        const exteriorMatch = descriptorText.match(/Exterior:\s*(Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)/i);
                        if (exteriorMatch) {
                            const condition = exteriorMatch[1];
                            itemName = `${itemName} (${condition})`;
                            this.log(`Found condition: ${condition}`);
                        }
                    }
                    
                    this.ownedItems.add(itemName);
                    this.log(`Added item: "${itemName}"`);
                    
                    // Save immediately
                    const itemsArray = Array.from(this.ownedItems);
                    localStorage.setItem('cs2_owned_items', JSON.stringify(itemsArray));
                    this.log(`Saved ${itemsArray.length} items to localStorage`);
                }
            }
        };
        
        // Watch for clicks on inventory items
        document.addEventListener('click', (event) => {
            const clickedItem = event.target.closest('.item.app730.context2');
            if (clickedItem) {
                this.log('Clicked CS2 item');
                setTimeout(extractFromItemInfo, 100);
            }
        });
        
        // Watch for hover
        document.addEventListener('mouseover', (event) => {
            const hoveredItem = event.target.closest('.item.app730.context2');
            if (hoveredItem) {
                setTimeout(extractFromItemInfo, 100);
            }
        });
        
        // Check if items already visible
        const items = document.querySelectorAll('.item.app730.context2');
        this.log(`Found ${items.length} CS2 items in inventory`);
        
        // Try to extract from any visible item info panels
        extractFromItemInfo();
        
        // Also try g_ActiveInventory if available
        if (typeof g_ActiveInventory !== 'undefined' && g_ActiveInventory.m_rgAssets) {
            this.log('Found g_ActiveInventory, extracting item names...');
            
            for (const [assetId, asset] of Object.entries(g_ActiveInventory.m_rgAssets)) {
                if (asset.appid === 730) {
                    const description = asset.description;
                    if (description && description.name) {
                        this.ownedItems.add(description.name);
                        this.log(`Added from g_ActiveInventory: "${description.name}"`);
                    }
                }
            }
            
            if (this.ownedItems.size > 0) {
                const itemsArray = Array.from(this.ownedItems);
                localStorage.setItem('cs2_owned_items', JSON.stringify(itemsArray));
                this.log(`Saved ${itemsArray.length} items from g_ActiveInventory`);
            }
        }
    }

    async loadSettings() {
        // Settings will be passed from content script via postMessage
        // No direct chrome.storage access in injected context
        this.log('Settings will be provided by content script');
    }

    isMarketPage() {
        const url = window.location.href;
        return url.includes('/market/') || 
               url.includes('/market/search') || 
               url.includes('/market/listings/');
    }

    async loadUserInventory() {
        this.log('Loading user inventory...');
        
        // First try to load from localStorage (saved from inventory page)
        try {
            const savedItems = localStorage.getItem('cs2_owned_items');
            if (savedItems) {
                const itemsArray = JSON.parse(savedItems);
                this.log(`Loaded ${itemsArray.length} items from localStorage`);
                itemsArray.forEach(item => this.ownedItems.add(item));
                return;
            }
        } catch (error) {
            this.log('Error loading from localStorage:', error);
        }
        
        // Check cache
        const now = Date.now();
        if (this.cache.inventory && (now - this.cache.lastFetch) < this.cache.expiry) {
            this.log('Using cached inventory data');
            this.processInventoryData(this.cache.inventory);
            return;
        }

        this.log('No saved inventory found');
        
        try {
            // Try to access Steam's internal inventory API if available
            if (window.g_rgAppContextData && window.g_rgAppContextData['730']) {
                this.log('Using Steam internal inventory API');
                const inventoryData = window.g_rgAppContextData['730'];
                this.processInventoryData(inventoryData);
                this.cache.inventory = inventoryData;
                this.cache.lastFetch = now;
                return;
            }
        } catch (error) {
            this.log('Error loading inventory:', error);
        }
    }

    extractSteamId() {
        // Try to extract Steam ID from various sources
        
        // 1. From Steam's global variables
        if (window.g_steamID) {
            return window.g_steamID;
        }

        // 2. From URL patterns
        const urlMatch = window.location.href.match(/steamcommunity\.com\/(id|profiles)\/([^\/]+)/);
        if (urlMatch && urlMatch[2]) {
            return urlMatch[2];
        }

        // 3. From profile data if available
        if (window.g_rgProfileData && window.g_rgProfileData.steamid) {
            return window.g_rgProfileData.steamid;
        }

        return null;
    }

    async fetchInventoryFromAPI(steamId) {
        try {
            // Note: This might require CORS handling or background script assistance
            const apiUrl = `https://steamcommunity.com/${steamId}/inventory/json/730/2`;
            const response = await fetch(apiUrl);
            
            if (response.ok) {
                const data = await response.json();
                this.processInventoryData(data);
                this.cache.inventory = data;
                this.cache.lastFetch = Date.now();
            }
        } catch (error) {
            this.log('API fetch failed:', error);
        }
    }

    processInventoryData(inventoryData) {
        this.ownedItems.clear();
        
        if (!inventoryData || !inventoryData.rgInventory) {
            this.log('No inventory data available');
            return;
        }

        // Extract item names and types from inventory
        for (const [itemId, itemData] of Object.entries(inventoryData.rgInventory)) {
            const description = inventoryData.rgDescriptions?.[itemData.classid + '_' + itemData.instanceid];
            
            if (description && description.appid === 730) { // CS2 items only
                const itemName = this.normalizeItemName(description.market_hash_name || description.name);
                if (itemName) {
                    this.ownedItems.add(itemName);
                }
            }
        }

        this.log(`Processed ${this.ownedItems.size} owned items`);
        this.log('First 10 owned items:', Array.from(this.ownedItems).slice(0, 10));
    }

    normalizeItemName(name) {
        if (!name) return null;
        
        // For now, just trim the name - keep full name including condition
        // We'll do more sophisticated matching later
        return name.trim();
    }

    highlightOwnedItems() {
        if (!this.settings.highlightOwned) {
            this.log('Highlighting disabled');
            return;
        }

        this.log('Starting to highlight owned items...');
        this.log(`Have ${this.ownedItems.size} owned items in memory`);
        
        // Find all market listing items (both regular listings and search results)
        const selectors = [
            '.market_listing_row',
            '.market_recent_listing_row',
            '#searchResults .market_listing_row',
            '#searchResultsRows .market_listing_row',
            '.market_search_results .market_listing_row'
        ];
        
        let marketItems = [];
        selectors.forEach(selector => {
            const found = document.querySelectorAll(selector);
            this.log(`Selector '${selector}' found ${found.length} items`);
            found.forEach(item => {
                if (!marketItems.includes(item)) {
                    marketItems.push(item);
                }
            });
        });
        
        this.log(`Total market items found: ${marketItems.length}`);
        
        let highlightedCount = 0;

        marketItems.forEach((item, index) => {
            const nameElement = item.querySelector('.market_listing_item_name, .market_listing_item_name_link');
            if (nameElement) {
                const rawName = nameElement.textContent.trim();
                const itemName = this.normalizeItemName(rawName);
                
                this.log(`Item ${index + 1}: Raw="${rawName}", Normalized="${itemName}"`);
                
                // Check for exact match first (with condition)
                let isOwned = this.ownedItems.has(itemName);
                
                if (isOwned) {
                    this.log(`Exact match found for: "${itemName}"`);
                }
                
                if (isOwned) {
                    this.log(`MATCH FOUND: "${itemName}" is owned!`);
                    this.addOwnedHighlight(item);
                    highlightedCount++;
                } else {
                    this.log(`No match for: "${itemName}"`);
                }
            } else {
                this.log(`Item ${index + 1}: No name element found`);
            }
        });

        this.log(`Highlighted ${highlightedCount} owned items`);
        
        // Also watch for dynamically added items
        this.observeNewItems();
    }

    addOwnedHighlight(itemElement) {
        // Add visual highlighting
        itemElement.style.position = 'relative';
        
        // Create highlight overlay with green color
        const highlight = document.createElement('div');
        highlight.className = 'cs2-owned-highlight';
        highlight.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, rgba(76, 175, 80, 0.1) 0%, rgba(76, 175, 80, 0.05) 100%);
            border: 2px solid rgba(76, 175, 80, 0.5);
            border-radius: 4px;
            pointer-events: none;
            z-index: 1;
        `;
        
        // Add "OWNED" badge in bottom right
        const badge = document.createElement('div');
        badge.className = 'cs2-owned-badge';
        badge.textContent = 'OWNED';
        badge.style.cssText = `
            position: absolute;
            bottom: 5px;
            right: 5px;
            background: rgba(76, 175, 80, 0.9);
            color: #fff;
            font-size: 10px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 3px;
            z-index: 2;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
        `;
        
        itemElement.appendChild(highlight);
        itemElement.appendChild(badge);
        
        // Add to processed set to avoid duplicate highlighting
        itemElement.dataset.csOwnedHighlight = 'true';
    }

    observeNewItems() {
        // Watch for new market items being loaded
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const newItems = node.querySelectorAll ? 
                            node.querySelectorAll('.market_listing_row:not([data-cs-owned-highlight])') : 
                            [];
                        
                        newItems.forEach(item => {
                            const nameElement = item.querySelector('.market_listing_item_name');
                            if (nameElement) {
                                const itemName = this.normalizeItemName(nameElement.textContent.trim());
                                
                                if (itemName && this.ownedItems.has(itemName)) {
                                    this.addOwnedHighlight(item);
                                }
                            }
                        });
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // Store observer for cleanup
        this.observer = observer;
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        
        if (this.settings.highlightOwned) {
            this.highlightOwnedItems();
        } else {
            this.removeAllHighlights();
        }
    }

    removeAllHighlights() {
        const highlights = document.querySelectorAll('.cs2-owned-highlight, .cs2-owned-badge');
        highlights.forEach(el => el.remove());
        
        const highlightedItems = document.querySelectorAll('[data-cs-owned-highlight]');
        highlightedItems.forEach(item => {
            delete item.dataset.csOwnedHighlight;
        });
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.removeAllHighlights();
    }
}

// Export singleton instance
export const inventoryHighlighter = new InventoryHighlighter();