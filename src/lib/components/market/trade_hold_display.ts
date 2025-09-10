import {css, html, nothing, TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {CustomElement} from '../injectors';
import {FloatElement} from '../custom';
import {rgAsset} from '../../types/steam';

@CustomElement()
export class TradeHoldDisplay extends FloatElement {
    @property({type: Object}) asset!: rgAsset;
    
    static styles = [
        ...FloatElement.styles,
        css`
            :host {
                display: inline-block;
                font-size: 11px;
                color: #8f98a0;
                margin-left: 10px;
            }
            
            .trade-hold-info {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 6px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 3px;
            }
            
            .tradable {
                color: #5bc633;
            }
            
            .not-tradable {
                color: #ff7b7b;
            }
            
            .trade-hold-days {
                color: #ffa500;
            }
            
            .icon {
                width: 14px;
                height: 14px;
                display: inline-block;
                vertical-align: middle;
            }
        `,
    ];
    
    private getTradeHoldInfo(): {tradable: boolean; daysLeft?: number; date?: Date} {
        if (!this.asset) {
            return {tradable: true};
        }
        
        // Check if item is tradable
        if (this.asset.tradable === 0) {
            // Check for trade restriction date in descriptions
            const tradeRestriction = this.asset.descriptions?.find(
                desc => desc.value.includes('Tradable After') || desc.value.includes('This item can be traded after')
            );
            
            if (tradeRestriction) {
                // Parse the date from the description
                const dateMatch = tradeRestriction.value.match(/(\w+ \d+, \d{4})/);
                if (dateMatch) {
                    const tradeDate = new Date(dateMatch[1]);
                    const now = new Date();
                    const daysLeft = Math.ceil((tradeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    
                    return {
                        tradable: false,
                        daysLeft: daysLeft > 0 ? daysLeft : 0,
                        date: tradeDate
                    };
                }
            }
            
            // Check market_tradable_restriction for cooldown period
            if (this.asset.market_tradable_restriction && this.asset.market_tradable_restriction > 0) {
                return {
                    tradable: false,
                    daysLeft: this.asset.market_tradable_restriction
                };
            }
            
            return {tradable: false};
        }
        
        return {tradable: true};
    }
    
    render() {
        if (!this.asset) {
            return nothing;
        }
        
        const tradeInfo = this.getTradeHoldInfo();
        
        if (tradeInfo.tradable) {
            return html`
                <div class="trade-hold-info tradable">
                    ${this.tooltip('Item is tradable')}
                    <span class="icon">✓</span>
                    <span>Tradable</span>
                </div>
            `;
        } else if (tradeInfo.daysLeft !== undefined) {
            const displayText = tradeInfo.daysLeft === 0 
                ? 'Tradable Today' 
                : `${tradeInfo.daysLeft} day${tradeInfo.daysLeft !== 1 ? 's' : ''}`;
            
            const tooltipText = tradeInfo.date 
                ? `Tradable after ${tradeInfo.date.toLocaleDateString()}`
                : `Trade hold: ${tradeInfo.daysLeft} days remaining`;
                
            return html`
                <div class="trade-hold-info trade-hold-days">
                    ${this.tooltip(tooltipText)}
                    <span class="icon">⏱</span>
                    <span>${displayText}</span>
                </div>
            `;
        } else {
            return html`
                <div class="trade-hold-info not-tradable">
                    ${this.tooltip('Item is not tradable')}
                    <span class="icon">🔒</span>
                    <span>Not Tradable</span>
                </div>
            `;
        }
    }
}