/**
 * Float Display Component
 * Displays float values with copy functionality and visual styling
 */

import { DisplayComponent } from '../base/DisplayComponent.js';
import { createElement } from '../../utils/dom.js';
import { formatFloat, getWearCondition } from '../../utils/format.js';
import { isValidFloat } from '../../utils/validation.js';
import { CSS_CLASSES, Z_INDEX } from '../../utils/constants.js';

export class FloatDisplay extends DisplayComponent {
    constructor(options = {}) {
        super(options);
        
        this.floatValue = null;
        this.paintSeed = null;
        this.ranking = null;
        this.displayType = options.displayType || 'inline'; // 'inline', 'tooltip', 'overlay'
        this.precision = options.precision || 4;
        this.enableCopy = options.enableCopy !== false;
        this.showWearName = options.showWearName !== false;
    }
    
    /**
     * Get CSS class name for float display
     * @returns {string} CSS class name
     */
    getClassName() {
        return `${CSS_CLASSES.FLOAT_DISPLAY} cs2-float-display-${this.displayType}`;
    }
    
    /**
     * Create the float display structure
     */
    createElement() {
        super.createElement();
        
        // Apply specific styling based on display type
        this.applyDisplayTypeStyles();
    }
    
    /**
     * Apply styles based on display type
     */
    applyDisplayTypeStyles() {
        const baseStyles = {
            fontFamily: 'Arial, sans-serif',
            fontSize: '11px',
            lineHeight: '1.2'
        };
        
        switch (this.displayType) {
            case 'inline':
                Object.assign(this.element.style, {
                    ...baseStyles,
                    display: 'inline-block',
                    marginLeft: '4px',
                    verticalAlign: 'middle'
                });
                break;
                
            case 'tooltip':
                Object.assign(this.element.style, {
                    ...baseStyles,
                    position: 'absolute',
                    background: 'rgba(0, 0, 0, 0.9)',
                    color: 'white',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    border: '1px solid #333',
                    zIndex: Z_INDEX.TOOLTIP,
                    whiteSpace: 'nowrap',
                    pointerEvents: 'auto'
                });
                break;
                
            case 'overlay':
                Object.assign(this.element.style, {
                    ...baseStyles,
                    position: 'absolute',
                    background: 'rgba(0, 0, 0, 0.8)',
                    color: 'white',
                    padding: '4px 6px',
                    borderRadius: '3px',
                    zIndex: Z_INDEX.FLOAT_DISPLAY,
                    fontSize: '10px'
                });
                break;
        }
    }
    
    /**
     * Set float data
     * @param {Object} data - Float data object
     */
    setFloatData(data) {
        if (!data) {
            this.showError('No float data available');
            return;
        }
        
        this.floatValue = data.floatvalue || data.float_value;
        this.paintSeed = data.paintseed || data.paint_seed;
        this.ranking = data.ranking;
        
        // Validate float value
        if (!isValidFloat(this.floatValue)) {
            this.showError('Invalid float value');
            return;
        }
        
        this.setData(data);
    }
    
    /**
     * Render the float display content
     */
    renderContent() {
        if (!this.validateData() || !isValidFloat(this.floatValue)) {
            return;
        }
        
        this.contentElement.innerHTML = '';
        
        const container = this.createContainer([
            this.createFloatValueElement(),
            this.showWearName ? this.createWearConditionElement() : null,
            this.paintSeed ? this.createPatternElement() : null,
            this.ranking ? this.createRankingElement() : null
        ].filter(Boolean), {
            direction: this.displayType === 'tooltip' ? 'vertical' : 'horizontal',
            gap: this.displayType === 'tooltip' ? '2px' : '4px'
        });
        
        this.contentElement.appendChild(container);
    }
    
    /**
     * Create float value element
     * @returns {HTMLElement} Float value element
     */
    createFloatValueElement() {
        const wearCondition = getWearCondition(this.floatValue);
        const color = wearCondition?.color || '#ccc';
        
        const floatElement = this.createValueElement(this.floatValue, {
            type: 'float',
            precision: this.precision,
            className: `${CSS_CLASSES.FLOAT_VALUE} ${this.enableCopy ? CSS_CLASSES.FLOAT_COPYABLE : ''}`,
            color,
            copyable: this.enableCopy,
            tooltip: this.enableCopy ? `Click to copy: ${formatFloat(this.floatValue, this.precision)}` : null
        });
        
        // Add float label
        const label = this.createLabelElement('Float:', { color: '#8F98A0' });
        
        return this.createContainer([label, floatElement], {
            direction: 'horizontal',
            gap: '2px'
        });
    }
    
    /**
     * Create wear condition element
     * @returns {HTMLElement|null} Wear condition element
     */
    createWearConditionElement() {
        const wearCondition = getWearCondition(this.floatValue);
        if (!wearCondition) return null;
        
        const wearElement = createElement('span', {
            className: 'cs2-wear-condition',
            textContent: `(${wearCondition.shortName})`,
            styles: {
                color: wearCondition.color,
                fontSize: '10px',
                fontWeight: 'bold'
            }
        });
        
        return wearElement;
    }
    
    /**
     * Create pattern element
     * @returns {HTMLElement} Pattern element
     */
    createPatternElement() {
        if (!this.paintSeed) return null;
        
        const patternElement = this.createValueElement(this.paintSeed, {
            className: 'cs2-pattern-seed',
            copyable: this.enableCopy,
            tooltip: this.enableCopy ? `Click to copy pattern: ${this.paintSeed}` : null
        });
        
        const label = this.createLabelElement('Pattern:', { color: '#8F98A0' });
        
        return this.createContainer([label, patternElement], {
            direction: 'horizontal',
            gap: '2px'
        });
    }
    
    /**
     * Create ranking element
     * @returns {HTMLElement|null} Ranking element
     */
    createRankingElement() {
        if (!this.ranking) return null;
        
        const rankingElement = createElement('span', {
            className: 'cs2-float-ranking',
            textContent: `#${this.ranking}`,
            styles: {
                color: '#22c55e',
                fontSize: '10px',
                fontWeight: 'bold'
            }
        });
        
        const label = this.createLabelElement('Rank:', { color: '#8F98A0' });
        
        return this.createContainer([label, rankingElement], {
            direction: 'horizontal',
            gap: '2px'
        });
    }
    
    /**
     * Position tooltip near target element
     * @param {HTMLElement} targetElement - Element to position near
     * @param {string} position - Position preference
     */
    positionNear(targetElement, position = 'top') {
        if (this.displayType !== 'tooltip') return;
        
        const targetRect = targetElement.getBoundingClientRect();
        const tooltipRect = this.element.getBoundingClientRect();
        
        let left, top;
        
        switch (position) {
            case 'top':
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                top = targetRect.top - tooltipRect.height - 8;
                break;
                
            case 'bottom':
                left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                top = targetRect.bottom + 8;
                break;
                
            case 'left':
                left = targetRect.left - tooltipRect.width - 8;
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                break;
                
            case 'right':
                left = targetRect.right + 8;
                top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                break;
                
            default:
                left = targetRect.left;
                top = targetRect.bottom + 4;
        }
        
        // Keep tooltip within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        left = Math.max(8, Math.min(left, viewportWidth - tooltipRect.width - 8));
        top = Math.max(8, Math.min(top, viewportHeight - tooltipRect.height - 8));
        
        this.element.style.left = `${left + window.scrollX}px`;
        this.element.style.top = `${top + window.scrollY}px`;
    }
    
    /**
     * Show float display with animation
     */
    show() {
        super.show();
        
        if (this.displayType === 'tooltip') {
            this.element.style.opacity = '0';
            this.element.style.transform = 'scale(0.8)';
            this.element.style.transition = 'opacity 0.2s, transform 0.2s';
            
            // Animate in
            setTimeout(() => {
                this.element.style.opacity = '1';
                this.element.style.transform = 'scale(1)';
            }, 10);
        }
    }
    
    /**
     * Hide float display with animation
     */
    hide() {
        if (this.displayType === 'tooltip') {
            this.element.style.opacity = '0';
            this.element.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                super.hide();
            }, 200);
        } else {
            super.hide();
        }
    }
    
    /**
     * Create a standalone float display
     * @param {HTMLElement} container - Container element
     * @param {Object} floatData - Float data
     * @param {Object} options - Display options
     * @returns {FloatDisplay} Created float display instance
     */
    static create(container, floatData, options = {}) {
        const display = new FloatDisplay(options);
        display.setFloatData(floatData);
        display.render(container);
        return display;
    }
    
    /**
     * Create a tooltip float display
     * @param {HTMLElement} targetElement - Element to attach tooltip to
     * @param {Object} floatData - Float data
     * @param {Object} options - Display options
     * @returns {FloatDisplay} Created tooltip instance
     */
    static createTooltip(targetElement, floatData, options = {}) {
        const display = new FloatDisplay({
            ...options,
            displayType: 'tooltip'
        });
        
        display.setFloatData(floatData);
        
        let showTimeout, hideTimeout;
        
        const showTooltip = () => {
            clearTimeout(hideTimeout);
            showTimeout = setTimeout(() => {
                document.body.appendChild(display.element);
                display.positionNear(targetElement, options.position);
                display.show();
            }, options.delay || 200);
        };
        
        const hideTooltip = () => {
            clearTimeout(showTimeout);
            hideTimeout = setTimeout(() => {
                display.hide();
                setTimeout(() => {
                    if (display.element.parentNode) {
                        display.element.parentNode.removeChild(display.element);
                    }
                }, 200);
            }, 100);
        };
        
        targetElement.addEventListener('mouseenter', showTooltip);
        targetElement.addEventListener('mouseleave', hideTooltip);
        
        // Return cleanup function
        display.cleanup = () => {
            targetElement.removeEventListener('mouseenter', showTooltip);
            targetElement.removeEventListener('mouseleave', hideTooltip);
            display.destroy();
        };
        
        return display;
    }
    
    /**
     * Validate float data
     * @returns {boolean} True if data is valid
     */
    validateData() {
        return super.validateData() && isValidFloat(this.floatValue);
    }
    
    /**
     * Get current display state
     * @returns {Object} Display state
     */
    getState() {
        return {
            ...super.getState(),
            floatValue: this.floatValue,
            paintSeed: this.paintSeed,
            ranking: this.ranking,
            displayType: this.displayType,
            precision: this.precision
        };
    }
}