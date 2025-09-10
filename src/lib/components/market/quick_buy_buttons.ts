import {css, html, nothing, TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {CustomElement, InjectAppend, InjectionMode} from '../injectors';
import {FloatElement} from '../custom';
import {ListingData, rgAsset} from '../../types/steam';
import {ItemInfo} from '../../bridge/handlers/fetch_inspect_info';

@CustomElement()
@InjectAppend('#searchResultsRows .market_listing_row_action', InjectionMode.CONTINUOUS)
export class QuickBuyButtons extends FloatElement {
    @property({type: Object}) listingInfo!: ListingData;
    @property({type: Object}) asset?: rgAsset;
    @property({type: Object}) itemInfo?: ItemInfo;
    @property({type: String}) listingId!: string;
    
    @state() private isProcessing = false;
    @state() private showConfirmation = false;
    
    static styles = [
        ...FloatElement.styles,
        css`
            :host {
                display: inline-block;
                margin-left: 10px;
            }
            
            .quick-buy-container {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .quick-buy-btn {
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
            }
            
            .quick-buy-btn:hover:not(:disabled) {
                background: linear-gradient(to bottom, #68a54b 5%, #75b022 100%);
                transform: translateY(-1px);
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .quick-buy-btn:active {
                transform: translateY(0);
                box-shadow: none;
            }
            
            .quick-buy-btn:disabled {
                background: #666;
                border-color: #444;
                cursor: not-allowed;
                opacity: 0.6;
            }
            
            .confirmation-dialog {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #2a2a2a;
                border: 2px solid #4e7a0d;
                border-radius: 6px;
                padding: 20px;
                z-index: 10000;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
                min-width: 300px;
            }
            
            .confirmation-header {
                color: #beee11;
                font-weight: bold;
                margin-bottom: 15px;
                font-size: 14px;
            }
            
            .confirmation-details {
                color: #ccc;
                margin-bottom: 15px;
                font-size: 12px;
                line-height: 1.4;
            }
            
            .confirmation-actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
            }
            
            .confirm-btn {
                background: linear-gradient(to bottom, #75b022 5%, #68a54b 100%);
                border: 1px solid #4e7a0d;
                color: white;
                padding: 6px 12px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
            }
            
            .cancel-btn {
                background: linear-gradient(to bottom, #cc4444 5%, #aa2222 100%);
                border: 1px solid #8b1a1a;
                color: white;
                padding: 6px 12px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
            }
            
            .float-warning {
                color: #ffa500;
                font-weight: bold;
                margin-top: 5px;
            }
            
            .overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 9999;
            }
        `,
    ];
    
    private get price(): number {
        if (!this.listingInfo) return 0;
        return (this.listingInfo.price + this.listingInfo.fee) / 100;
    }
    
    private get currency(): string {
        // Simple currency detection - could be enhanced with proper currency mapping
        return '$';
    }
    
    private formatPrice(): string {
        return `${this.currency}${this.price.toFixed(2)}`;
    }
    
    private handleQuickBuy() {
        if (this.isProcessing) return;
        
        // Show confirmation dialog
        this.showConfirmation = true;
    }
    
    private async confirmPurchase() {
        this.isProcessing = true;
        this.showConfirmation = false;
        
        try {
            // Extract the actual Steam purchase logic
            // This would need to integrate with Steam's existing purchase flow
            await this.executePurchase();
            
            this.showNotification(`Successfully initiated purchase for ${this.formatPrice()}!`, 'success');
        } catch (error: any) {
            console.error('Purchase failed:', error);
            this.showNotification(`Purchase failed: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
        }
    }
    
    private async executePurchase(): Promise<void> {
        // This is where we would integrate with Steam's purchase API
        // For now, we'll simulate the purchase process
        
        if (!this.listingId) {
            throw new Error('No listing ID available');
        }
        
        // Check if user has sufficient wallet balance
        // In a real implementation, this would check g_rgWalletInfo
        const walletBalance = 1000; // Mock balance
        if (this.price > walletBalance) {
            throw new Error('Insufficient wallet balance');
        }
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // In a real implementation, this would call Steam's purchase API:
        // - CreateMarketTransaction
        // - ConfirmPurchase
        // - HandlePurchaseResult
        
        console.log(`Mock purchase executed for listing ${this.listingId} at ${this.formatPrice()}`);
    }
    
    private cancelPurchase() {
        this.showConfirmation = false;
    }
    
    private showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
        // Create a notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4c6c22' : type === 'error' ? '#a52a2a' : '#46698c'};
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10001;
            font-size: 13px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
    
    private getFloatWarning(): string {
        if (!this.itemInfo) return '';
        
        const floatValue = this.itemInfo.floatvalue;
        if (floatValue > 0.7) {
            return 'High float value - Battle-Scarred condition';
        } else if (floatValue > 0.45) {
            return 'High float value - Well-Worn condition';
        } else if (floatValue > 0.37) {
            return 'Medium float value - Field-Tested condition';
        }
        
        return '';
    }
    
    connectedCallback() {
        super.connectedCallback();
        
        // Get listing info from the row
        const row = this.closest('.market_listing_row');
        if (row) {
            const listingIdMatch = row.querySelector('.market_listing_item_name')?.id?.match(/listing_(\d+)_name/);
            if (listingIdMatch) {
                this.listingId = listingIdMatch[1];
                this.listingInfo = g_rgListingInfo[this.listingId];
            }
        }
    }
    
    render() {
        if (!this.listingInfo) {
            return nothing;
        }
        
        const floatWarning = this.getFloatWarning();
        
        return html`
            ${this.showConfirmation ? html`
                <div class="overlay" @click=${this.cancelPurchase}></div>
                <div class="confirmation-dialog">
                    <div class="confirmation-header">Confirm Quick Purchase</div>
                    <div class="confirmation-details">
                        Price: <strong>${this.formatPrice()}</strong><br>
                        ${this.itemInfo ? html`Float: <strong>${this.itemInfo.floatvalue.toFixed(6)}</strong><br>` : nothing}
                        ${this.itemInfo ? html`Paint Seed: <strong>#${this.itemInfo.paintseed}</strong><br>` : nothing}
                        ${floatWarning ? html`<div class="float-warning">${floatWarning}</div>` : nothing}
                    </div>
                    <div class="confirmation-actions">
                        <button class="cancel-btn" @click=${this.cancelPurchase}>Cancel</button>
                        <button class="confirm-btn" @click=${this.confirmPurchase} ?disabled=${this.isProcessing}>
                            ${this.isProcessing ? 'Processing...' : 'Confirm Purchase'}
                        </button>
                    </div>
                </div>
            ` : nothing}
            
            <div class="quick-buy-container">
                <button 
                    class="quick-buy-btn" 
                    @click=${this.handleQuickBuy}
                    ?disabled=${this.isProcessing}
                    title="Quick buy this item for ${this.formatPrice()}"
                >
                    ${this.isProcessing ? 'Processing...' : `Buy ${this.formatPrice()}`}
                </button>
            </div>
        `;
    }
}