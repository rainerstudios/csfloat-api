/**
 * Quick Buy Buttons for Steam Market
 * Adds one-click purchase functionality with float validation and confirmation dialogs
 * @version 1.0.0
 * @author CS2 Float Checker Team
 * @note This is a mock implementation - actual Steam API integration would be required for real purchases
 */

class QuickBuyButtons {
    constructor() {
        this.isProcessing = false;
        this.confirmationDialog = null;
    }

    /**
     * Create quick buy button element
     * @param {Object} listingInfo - Steam listing data
     * @param {Object} itemInfo - Float/item information
     * @param {string} listingId - Unique listing ID
     * @returns {HTMLElement} Quick buy button container
     */
    createQuickBuyButtons(listingInfo, itemInfo, listingId) {
        const container = document.createElement('div');
        container.className = `cs2-quick-buy cs2-quick-buy-${listingId}`;
        
        // Extract price information
        const priceInfo = this.extractPriceInfo(listingInfo);
        if (!priceInfo) {
            return null;
        }

        container.innerHTML = `
            <div class="quick-buy-container" style="
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-left: 10px;
            ">
                <button class="quick-buy-btn" data-listing-id="${listingId}" style="
                    background: linear-gradient(to bottom, #75b022 5%, #68a54b 100%);
                    border: 1px solid #4e7a0d;
                    border-radius: 3px;
                    color: #ffffff;
                    cursor: pointer;
                    font-size: 11px;
                    font-weight: bold;
                    padding: 4px 8px;
                    text-align: center;
                    text-shadow: 1px 1px 0px #2d4611;
                    transition: all 0.2s ease;
                    min-width: 70px;
                " onmouseover="this.style.background='linear-gradient(to bottom, #68a54b 5%, #75b022 100%)'; this.style.transform='translateY(-1px)'" onmouseout="this.style.background='linear-gradient(to bottom, #75b022 5%, #68a54b 100%)'; this.style.transform='translateY(0)'">
                    💰 Buy ${priceInfo.displayPrice}
                </button>
                ${this.createFloatValidationWarning(itemInfo)}
            </div>
        `;

        // Add click event listener
        const buyButton = container.querySelector('.quick-buy-btn');
        buyButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handleQuickBuy(listingInfo, itemInfo, listingId);
        });

        return container;
    }

    /**
     * Create float validation warning if needed
     * @param {Object} itemInfo - Float/item information
     * @returns {string} Warning HTML
     */
    createFloatValidationWarning(itemInfo) {
        if (!itemInfo || !itemInfo.floatvalue) {
            return '';
        }

        const floatValue = itemInfo.floatvalue;
        let warningHtml = '';

        // Warn about high float values
        if (floatValue > 0.15) {
            const warningClass = floatValue > 0.25 ? 'high-float-warning' : 'medium-float-warning';
            const warningColor = floatValue > 0.25 ? '#ff4444' : '#ff8800';
            
            warningHtml = `
                <div class="${warningClass}" style="
                    font-size: 9px;
                    color: ${warningColor};
                    text-align: center;
                    padding: 1px 3px;
                    background: rgba(0, 0, 0, 0.3);
                    border-radius: 2px;
                    border: 1px solid ${warningColor}50;
                ">
                    ⚠️ Float: ${floatValue.toFixed(4)}
                </div>
            `;
        }

        return warningHtml;
    }

    /**
     * Handle quick buy button click
     * @param {Object} listingInfo - Steam listing data
     * @param {Object} itemInfo - Float/item information
     * @param {string} listingId - Unique listing ID
     */
    async handleQuickBuy(listingInfo, itemInfo, listingId) {
        if (this.isProcessing) {
            return;
        }

        // Show confirmation dialog
        const confirmed = await this.showConfirmationDialog(listingInfo, itemInfo, listingId);
        if (!confirmed) {
            return;
        }

        this.isProcessing = true;
        
        try {
            // Update button to show processing state
            const buyButton = document.querySelector(`[data-listing-id="${listingId}"]`);
            if (buyButton) {
                buyButton.disabled = true;
                buyButton.style.opacity = '0.6';
                buyButton.innerHTML = '⏳ Processing...';
            }

            // Attempt to purchase (this would need Steam's purchase API)
            const result = await this.executePurchase(listingId);
            
            if (result.success) {
                this.showNotification('Purchase successful!', 'success');
                // Remove the listing or mark as purchased
                this.handlePurchaseSuccess(listingId);
            } else {
                this.showNotification(`Purchase failed: ${result.error}`, 'error');
                this.resetButton(listingId);
            }
            
        } catch (error) {
            console.error('Quick buy error:', error);
            this.showNotification('Purchase failed - please try manually', 'error');
            this.resetButton(listingId);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Show confirmation dialog before purchase
     * @param {Object} listingInfo - Steam listing data
     * @param {Object} itemInfo - Float/item information
     * @param {string} listingId - Unique listing ID
     * @returns {Promise<boolean>} Whether user confirmed
     */
    showConfirmationDialog(listingInfo, itemInfo, listingId) {
        return new Promise((resolve) => {
            // Create modal dialog
            const modal = document.createElement('div');
            modal.className = 'cs2-quick-buy-modal';
            modal.innerHTML = `
                <div class="modal-overlay" style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                ">
                    <div class="modal-content" style="
                        background: #2a2a2a;
                        border-radius: 6px;
                        padding: 20px;
                        max-width: 400px;
                        color: white;
                        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                    ">
                        <h3 style="margin: 0 0 15px 0; color: #4CAF50;">Confirm Purchase</h3>
                        <div class="item-details">
                            ${this.generateItemDetails(listingInfo, itemInfo)}
                        </div>
                        <div class="modal-buttons" style="
                            display: flex;
                            gap: 10px;
                            margin-top: 20px;
                            justify-content: flex-end;
                        ">
                            <button class="cancel-btn" style="
                                background: #666;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                color: white;
                                cursor: pointer;
                            ">Cancel</button>
                            <button class="confirm-btn" style="
                                background: #4CAF50;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 4px;
                                color: white;
                                cursor: pointer;
                                font-weight: bold;
                            ">Purchase Now</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Add event listeners
            modal.querySelector('.cancel-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(false);
            });

            modal.querySelector('.confirm-btn').addEventListener('click', () => {
                document.body.removeChild(modal);
                resolve(true);
            });

            // Close on overlay click
            modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
                if (e.target === e.currentTarget) {
                    document.body.removeChild(modal);
                    resolve(false);
                }
            });
        });
    }

    /**
     * Generate item details for confirmation dialog
     * @param {Object} listingInfo - Steam listing data
     * @param {Object} itemInfo - Float/item information
     * @returns {string} Item details HTML
     */
    generateItemDetails(listingInfo, itemInfo) {
        const priceInfo = this.extractPriceInfo(listingInfo);
        let detailsHtml = `<p><strong>Price:</strong> ${priceInfo?.displayPrice || 'Unknown'}</p>`;
        
        if (itemInfo) {
            if (itemInfo.weapon_type) {
                detailsHtml += `<p><strong>Item:</strong> ${itemInfo.weapon_type}</p>`;
            }
            if (itemInfo.floatvalue) {
                const floatClass = itemInfo.floatvalue > 0.25 ? 'color: #ff4444' : itemInfo.floatvalue > 0.15 ? 'color: #ff8800' : 'color: #4CAF50';
                detailsHtml += `<p><strong>Float:</strong> <span style="${floatClass}">${itemInfo.floatvalue.toFixed(6)}</span></p>`;
            }
            if (itemInfo.paintseed) {
                detailsHtml += `<p><strong>Pattern:</strong> ${itemInfo.paintseed}</p>`;
            }
        }

        return detailsHtml;
    }

    /**
     * Extract price information from listing
     * @param {Object} listingInfo - Steam listing data
     * @returns {Object|null} Price information
     */
    extractPriceInfo(listingInfo) {
        if (!listingInfo) return null;

        try {
            // This would need to be adapted based on Steam's actual listing structure
            const price = listingInfo.price || 0;
            const displayPrice = `$${(price / 100).toFixed(2)}`;
            
            return {
                price,
                displayPrice
            };
        } catch (error) {
            console.error('Error extracting price info:', error);
            return null;
        }
    }

    /**
     * Execute the actual purchase (placeholder - would need Steam API integration)
     * @param {string} listingId - Listing ID to purchase
     * @returns {Promise<Object>} Purchase result
     */
    async executePurchase(listingId) {
        // This is a placeholder - actual implementation would need:
        // 1. Steam session authentication
        // 2. CSRF token handling
        // 3. Steam's purchase API endpoints
        // 4. Wallet balance verification
        
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simulate purchase result
                resolve({
                    success: false,
                    error: 'Quick buy functionality requires Steam API integration'
                });
            }, 1000);
        });
    }

    /**
     * Reset button state after failed purchase
     * @param {string} listingId - Listing ID
     */
    resetButton(listingId) {
        const buyButton = document.querySelector(`[data-listing-id="${listingId}"]`);
        if (buyButton) {
            buyButton.disabled = false;
            buyButton.style.opacity = '1';
            const priceInfo = this.extractPriceInfo({ price: 0 });
            buyButton.innerHTML = `💰 Buy ${priceInfo?.displayPrice || ''}`;
        }
    }

    /**
     * Handle successful purchase
     * @param {string} listingId - Listing ID that was purchased
     */
    handlePurchaseSuccess(listingId) {
        const listingElement = document.getElementById(listingId);
        if (listingElement) {
            listingElement.style.opacity = '0.5';
            listingElement.innerHTML += '<div style="color: #4CAF50; font-weight: bold;">PURCHASED</div>';
        }
    }

    /**
     * Show notification to user
     * @param {string} message - Notification message
     * @param {string} type - Notification type ('success', 'error', 'info')
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `cs2-notification cs2-notification-${type}`;
        
        const bgColor = type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3';
        
        notification.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${bgColor};
                color: white;
                padding: 12px 20px;
                border-radius: 4px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
                z-index: 10001;
                font-size: 14px;
                max-width: 300px;
            ">${message}</div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 3000);
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuickBuyButtons;
} else {
    window.QuickBuyButtons = QuickBuyButtons;
}