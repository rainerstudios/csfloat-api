import {css, html, nothing, TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {CustomElement} from '../injectors';
import {FloatElement} from '../custom';
import {ListingData} from '../../types/steam';

interface FeeStructure {
    steamFee: number;      // Steam takes 5%
    publisherFee: number;  // Game publisher takes 10% (varies by game, CS2 is 10%)
    totalFee: number;      // Total combined fee (15% for CS2)
}

@CustomElement()
export class ProfitCalculator extends FloatElement {
    @property({type: Object}) listingInfo!: ListingData;
    @property({type: String}) currency: string = '$';
    
    static styles = [
        ...FloatElement.styles,
        css`
            :host {
                display: inline-block;
                font-size: 11px;
                margin-left: 10px;
            }
            
            .profit-info {
                display: inline-flex;
                flex-direction: column;
                gap: 2px;
                padding: 4px 6px;
                background: rgba(0, 0, 0, 0.15);
                border-radius: 3px;
                border-left: 3px solid #4CAF50;
                min-width: 120px;
            }
            
            .profit-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .profit-label {
                color: #8f98a0;
                font-size: 10px;
            }
            
            .profit-value {
                font-weight: bold;
                font-size: 11px;
            }
            
            .gross-price {
                color: #ffa500;
            }
            
            .fees {
                color: #ff6b6b;
            }
            
            .net-profit {
                color: #4CAF50;
                font-size: 12px;
            }
            
            .fee-breakdown {
                font-size: 9px;
                color: #666;
                margin-top: 2px;
                padding-top: 2px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
        `,
    ];
    
    private get feeStructure(): FeeStructure {
        // CS2/Steam marketplace fee structure
        return {
            steamFee: 0.05,      // 5% Steam fee
            publisherFee: 0.10,  // 10% Publisher fee for CS2
            totalFee: 0.15       // Total 15% fee
        };
    }
    
    private calculateProfitInfo() {
        if (!this.listingInfo) {
            return null;
        }
        
        // Get the gross price (price + fee that buyer pays)
        const grossPrice = (this.listingInfo.price + this.listingInfo.fee) / 100;
        
        // Calculate individual fees
        const fees = this.feeStructure;
        const steamFee = grossPrice * fees.steamFee;
        const publisherFee = grossPrice * fees.publisherFee;
        const totalFees = steamFee + publisherFee;
        
        // Calculate net amount seller receives
        const netProfit = grossPrice - totalFees;
        
        // Calculate fee percentage of gross price
        const feePercentage = (totalFees / grossPrice) * 100;
        
        return {
            grossPrice,
            steamFee,
            publisherFee,
            totalFees,
            netProfit,
            feePercentage
        };
    }
    
    private formatCurrency(amount: number): string {
        return `${this.currency}${amount.toFixed(2)}`;
    }
    
    render() {
        if (!this.listingInfo) {
            return nothing;
        }
        
        const profitInfo = this.calculateProfitInfo();
        
        if (!profitInfo) {
            return nothing;
        }
        
        const tooltipText = `
Steam Fee: ${this.formatCurrency(profitInfo.steamFee)} (5%)
Publisher Fee: ${this.formatCurrency(profitInfo.publisherFee)} (10%)
Total Fees: ${this.formatCurrency(profitInfo.totalFees)} (${profitInfo.feePercentage.toFixed(1)}%)
        `.trim();
        
        return html`
            <div class="profit-info">
                ${this.tooltip(tooltipText)}
                <div class="profit-row">
                    <span class="profit-label">Gross Price:</span>
                    <span class="profit-value gross-price">${this.formatCurrency(profitInfo.grossPrice)}</span>
                </div>
                <div class="profit-row">
                    <span class="profit-label">Fees (-15%):</span>
                    <span class="profit-value fees">-${this.formatCurrency(profitInfo.totalFees)}</span>
                </div>
                <div class="profit-row">
                    <span class="profit-label">Net Profit:</span>
                    <span class="profit-value net-profit">${this.formatCurrency(profitInfo.netProfit)}</span>
                </div>
                <div class="fee-breakdown">
                    Steam: ${this.formatCurrency(profitInfo.steamFee)} | 
                    Publisher: ${this.formatCurrency(profitInfo.publisherFee)}
                </div>
            </div>
        `;
    }
}