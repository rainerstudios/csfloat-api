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
        
        if (this.settings.highlightOwned && this.isMarketPage()) {
            await this.loadUserInventory();
            this.highlightOwnedItems();
        }
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['settings']);
            if (result.settings) {
                this.settings = { ...this.settings, ...result.settings };
            }
        } catch (error) {
            this.log('Error loading settings:', error);
        }
    }

    isMarketPage() {
        return window.location.href.includes('/market/');
    }

    async loadUserInventory() {
        // Check cache first
        const now = Date.now();
        if (this.cache.inventory && (now - this.cache.lastFetch) < this.cache.expiry) {
            this.log('Using cached inventory data');
            this.processInventoryData(this.cache.inventory);
            return;
        }

        this.log('Fetching user inventory...');
        
        try {
            // Get Steam ID from current page or profile
            const steamId = this.extractSteamId();
            if (!steamId) {
                this.log('Could not determine Steam ID');
                return;
            }

            // Try to access Steam's internal inventory API if available
            if (window.g_rgAppContextData && window.g_rgAppContextData['730']) {
                this.log('Using Steam internal inventory API');
                const inventoryData = window.g_rgAppContextData['730'];
                this.processInventoryData(inventoryData);
                this.cache.inventory = inventoryData;
                this.cache.lastFetch = now;
                return;
            }

            // Fallback: Try to get from Steam Community API
            await this.fetchInventoryFromAPI(steamId);
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
    }

    normalizeItemName(name) {
        if (!name) return null;
        
        // Remove quality indicators, StatTrak, etc. for comparison
        return name
            .replace(/^★\s*/, '') // Remove star
            .replace(/^StatTrak™\s*/, '') // Remove StatTrak
            .replace(/^Souvenir\s*/, '') // Remove Souvenir
            .replace(/\s*\([^)]+\)$/, '') // Remove condition in parentheses
            .trim();
    }

    highlightOwnedItems() {
        if (!this.settings.highlightOwned) {
            this.log('Highlighting disabled');
            return;
        }

        this.log('Starting to highlight owned items...');
        
        // Find all market listing items
        const marketItems = document.querySelectorAll('.market_listing_row, .market_recent_listing_row');
        let highlightedCount = 0;

        marketItems.forEach(item => {
            const nameElement = item.querySelector('.market_listing_item_name');
            if (nameElement) {
                const itemName = this.normalizeItemName(nameElement.textContent.trim());
                
                if (itemName && this.ownedItems.has(itemName)) {
                    this.addOwnedHighlight(item);
                    highlightedCount++;
                }
            }
        });

        this.log(`Highlighted ${highlightedCount} owned items`);
        
        // Also watch for dynamically added items
        this.observeNewItems();
    }

    addOwnedHighlight(itemElement) {
        // Add visual highlighting
        itemElement.style.position = 'relative';
        
        // Create highlight overlay
        const highlight = document.createElement('div');
        highlight.className = 'cs2-owned-highlight';
        highlight.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(45deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 215, 0, 0.05) 100%);
            border: 2px solid rgba(255, 215, 0, 0.4);
            border-radius: 4px;
            pointer-events: none;
            z-index: 1;
        `;
        
        // Add "OWNED" badge
        const badge = document.createElement('div');
        badge.className = 'cs2-owned-badge';
        badge.textContent = 'OWNED';
        badge.style.cssText = `
            position: absolute;
            top: 5px;
            right: 5px;
            background: rgba(255, 215, 0, 0.9);
            color: #000;
            font-size: 10px;
            font-weight: bold;
            padding: 2px 6px;
            border-radius: 3px;
            z-index: 2;
            text-shadow: none;
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