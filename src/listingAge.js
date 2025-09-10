/**
 * Listing Age Display Component
 * Shows how long ago an item was listed on the market
 */

class ListingAge {
    constructor() {
        this.listingTimes = new Map();
        this.updateInterval = null;
    }

    /**
     * Format time ago display
     */
    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        
        if (seconds < 60) {
            return { text: 'Just now', color: '#10b981', urgency: 'new' };
        } else if (minutes < 60) {
            return { 
                text: `${minutes}m ago`, 
                color: '#22c55e',
                urgency: minutes < 5 ? 'new' : 'recent'
            };
        } else if (hours < 24) {
            return { 
                text: `${hours}h ago`, 
                color: hours < 3 ? '#22c55e' : '#3b82f6',
                urgency: hours < 3 ? 'recent' : 'normal'
            };
        } else if (days < 7) {
            return { 
                text: `${days}d ago`, 
                color: '#6366f1',
                urgency: 'normal'
            };
        } else if (weeks < 4) {
            return { 
                text: `${weeks}w ago`, 
                color: '#8b5cf6',
                urgency: 'old'
            };
        } else {
            return { 
                text: `${months}mo ago`, 
                color: '#a78bfa',
                urgency: 'very_old'
            };
        }
    }

    /**
     * Extract listing timestamp from Steam's data
     */
    extractListingTime(element) {
        // Try to find timestamp in various places
        
        // Method 1: Check data attributes
        const timestamp = element.dataset.listingTimestamp;
        if (timestamp) {
            return parseInt(timestamp);
        }
        
        // Method 2: Parse from listing ID (Steam includes timestamps in some IDs)
        const listingId = element.id || element.dataset.listingid;
        if (listingId) {
            // Steam listing IDs sometimes contain timestamps
            const match = listingId.match(/\d{10,}/);
            if (match) {
                const possibleTimestamp = parseInt(match[0]);
                // Validate it's a reasonable timestamp (2020-2030)
                if (possibleTimestamp > 1577836800 && possibleTimestamp < 1893456000) {
                    return possibleTimestamp * 1000; // Convert to milliseconds
                }
            }
        }
        
        // Method 3: Check for Steam's time elements
        const timeElement = element.querySelector('.market_listing_listed_date, .listing_age, time');
        if (timeElement) {
            const dateStr = timeElement.textContent || timeElement.dateTime;
            const parsed = Date.parse(dateStr);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }
        
        // Method 4: Use current time as fallback (for new listings)
        // Store it so we can track from when we first saw it
        const cacheKey = element.id || element.innerHTML.substring(0, 100);
        if (!this.listingTimes.has(cacheKey)) {
            this.listingTimes.set(cacheKey, Date.now());
        }
        return this.listingTimes.get(cacheKey);
    }

    /**
     * Create listing age display element
     */
    createAgeElement(timestamp) {
        const ageData = this.formatTimeAgo(timestamp);
        
        const container = document.createElement('span');
        container.className = 'cs2-listing-age';
        container.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 1px 4px;
            background: ${ageData.color}15;
            color: ${ageData.color};
            border: 1px solid ${ageData.color}30;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 600;
            margin-left: 8px;
            vertical-align: middle;
            animation: fadeIn 0.3s ease-in;
        `;

        // Add icon based on urgency
        const icon = document.createElement('span');
        icon.style.cssText = 'font-size: 12px;';
        switch(ageData.urgency) {
            case 'new':
                icon.textContent = '🆕';
                container.style.animation = 'pulse 2s ease-in-out infinite';
                break;
            case 'recent':
                icon.textContent = '⏰';
                break;
            case 'normal':
                icon.textContent = '📅';
                break;
            case 'old':
            case 'very_old':
                icon.textContent = '📆';
                break;
        }
        
        const text = document.createElement('span');
        text.textContent = ageData.text;
        text.className = 'cs2-age-text';
        
        container.appendChild(icon);
        container.appendChild(text);
        
        // Add tooltip with exact time
        const tooltip = document.createElement('div');
        tooltip.className = 'cs2-age-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 11px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 10000;
            margin-bottom: 4px;
        `;
        
        const exactDate = new Date(timestamp);
        tooltip.innerHTML = `
            Listed: ${exactDate.toLocaleDateString()} ${exactDate.toLocaleTimeString()}
            <br>
            <span style="color: ${ageData.color}; font-size: 10px;">
                ${ageData.urgency === 'new' ? '⚡ New listing!' : 
                  ageData.urgency === 'recent' ? '🔥 Recently listed' : 
                  ageData.urgency === 'old' ? '⏳ Been listed for a while' : 
                  '📊 Standard listing'}
            </span>
        `;
        
        container.style.position = 'relative';
        container.appendChild(tooltip);
        
        // Show tooltip on hover
        container.addEventListener('mouseenter', () => {
            tooltip.style.opacity = '1';
        });
        
        container.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
        });
        
        // Store timestamp for updates
        container.dataset.timestamp = timestamp;
        
        return container;
    }

    /**
     * Add listing age to an element
     */
    addListingAge(element) {
        // Skip if already has age display
        if (element.querySelector('.cs2-listing-age')) {
            return;
        }
        
        const timestamp = this.extractListingTime(element);
        const ageElement = this.createAgeElement(timestamp);
        
        // Find best place to insert - avoid overlapping with price
        const nameElement = element.querySelector('.market_listing_item_name');
        const gameElement = element.querySelector('.market_listing_game_name');
        const ownerElement = element.querySelector('.market_listing_owner_actions');
        const stickerElement = element.querySelector('.market_listing_stickers');
        
        // Try to insert in a safe location that won't overlap price
        if (nameElement && nameElement.parentElement) {
            // Insert right after the item name, before stickers
            const nameContainer = nameElement.parentElement;
            if (stickerElement) {
                nameContainer.insertBefore(ageElement, stickerElement);
            } else {
                nameContainer.appendChild(ageElement);
            }
        } else if (gameElement && gameElement.parentElement) {
            // Insert after game name
            gameElement.parentElement.insertBefore(ageElement, gameElement.nextSibling);
        } else if (ownerElement) {
            // Insert before owner actions
            ownerElement.parentElement.insertBefore(ageElement, ownerElement);
        } else {
            // Fallback: append to element but ensure it's not in price column
            const leftColumn = element.querySelector('.market_listing_item_name_block');
            if (leftColumn) {
                leftColumn.appendChild(ageElement);
            } else {
                element.appendChild(ageElement);
            }
        }
    }

    /**
     * Remove all listing age displays from the page
     */
    removeAllAges() {
        const ageElements = document.querySelectorAll('.cs2-listing-age');
        ageElements.forEach(element => {
            element.remove();
        });
        console.log(`[ListingAge] Removed ${ageElements.length} age displays`);
    }
    
    /**
     * Update all listing ages on the page (disabled)
     */
    updateAllAges() {
        // Disabled - we're not showing individual ages
        return;
    }

    /**
     * Initialize listing age display
     */
    init() {
        console.log('[ListingAge] Disabling individual listing age displays...');
        
        // Remove any existing age displays
        this.removeAllAges();
        
        // Don't process or observe listings - we're keeping only the top filter
        // The filter controls at the top of the page remain functional
    }

    /**
     * Process existing listings on the page
     */
    processListings() {
        const listings = document.querySelectorAll('.market_listing_row, .market_recent_listing_row');
        listings.forEach(listing => {
            this.addListingAge(listing);
        });
    }

    /**
     * Inject required CSS styles
     */
    injectStyles() {
        if (document.getElementById('cs2-listing-age-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'cs2-listing-age-styles';
        styles.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-5px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            @keyframes pulse {
                0%, 100% { 
                    opacity: 1; 
                    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
                }
                50% { 
                    opacity: 0.9; 
                    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0);
                }
            }
            
            .cs2-listing-age {
                transition: all 0.2s ease;
                cursor: help;
                user-select: none;
            }
            
            .cs2-listing-age:hover {
                transform: scale(1.05);
                box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            }
            
            .market_listing_row:has(.cs2-listing-age[data-urgency="new"]) {
                background: linear-gradient(90deg, transparent, rgba(16, 185, 129, 0.05), transparent);
            }
        `;
        document.head.appendChild(styles);
    }

    /**
     * Observe for new listings being added
     */
    observeListings() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) {
                        // Check if this is a listing
                        if (node.classList && (
                            node.classList.contains('market_listing_row') ||
                            node.classList.contains('market_recent_listing_row')
                        )) {
                            this.addListingAge(node);
                        }
                        
                        // Check for listings within added node
                        if (node.querySelectorAll) {
                            const listings = node.querySelectorAll('.market_listing_row, .market_recent_listing_row');
                            listings.forEach(listing => {
                                this.addListingAge(listing);
                            });
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Cleanup when extension is disabled
     */
    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
    window.CS2ListingAge = new ListingAge();
    
    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.CS2ListingAge.init();
        });
    } else {
        window.CS2ListingAge.init();
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ListingAge;
}