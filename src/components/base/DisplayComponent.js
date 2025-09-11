/**
 * Display Component Base Class
 * Base class for components that display information (FloatDisplay, FloatBar, etc.)
 */

import { BaseComponent } from './BaseComponent.js';
import { createElement, createLoadingSpinner } from '../../utils/dom.js';
import { formatFloat, formatPercentage } from '../../utils/format.js';
import { isValidFloat } from '../../utils/validation.js';

export class DisplayComponent extends BaseComponent {
    constructor(options = {}) {
        super(options);
        
        // Display-specific properties
        this.data = null;
        this.isLoading = false;
        this.hasError = false;
        this.errorMessage = '';
        this.loadingElement = null;
        this.contentElement = null;
        this.errorElement = null;
    }
    
    /**
     * Get the CSS class name for display components
     * @returns {string} CSS class name
     */
    getClassName() {
        return 'cs2-display-component';
    }
    
    /**
     * Create the component structure
     */
    createElement() {
        super.createElement();
        
        // Create loading spinner
        this.loadingElement = createLoadingSpinner({
            size: this.options.loadingSize || 16,
            color: this.options.loadingColor || '#22c55e'
        });
        
        // Create content container
        this.contentElement = createElement('div', {
            className: 'cs2-display-content'
        });
        
        // Create error container
        this.errorElement = createElement('div', {
            className: 'cs2-display-error',
            styles: {
                color: '#ef4444',
                fontSize: '11px',
                display: 'none'
            }
        });
        
        // Append to main element
        this.element.appendChild(this.loadingElement);
        this.element.appendChild(this.contentElement);
        this.element.appendChild(this.errorElement);
    }
    
    /**
     * Set the data to display
     * @param {any} data - Data to display
     */
    setData(data) {
        if (this.isDestroyed) return;
        
        this.data = data;
        this.clearError();
        this.render();
    }
    
    /**
     * Show loading state
     */
    showLoading() {
        if (this.isDestroyed) return;
        
        this.isLoading = true;
        this.loadingElement.style.display = 'block';
        this.contentElement.style.display = 'none';
        this.errorElement.style.display = 'none';
    }
    
    /**
     * Hide loading state
     */
    hideLoading() {
        if (this.isDestroyed) return;
        
        this.isLoading = false;
        this.loadingElement.style.display = 'none';
        this.contentElement.style.display = 'block';
    }
    
    /**
     * Show error state
     * @param {string} message - Error message
     */
    showError(message) {
        if (this.isDestroyed) return;
        
        this.hasError = true;
        this.errorMessage = message;
        this.errorElement.textContent = message;
        this.errorElement.style.display = 'block';
        this.contentElement.style.display = 'none';
        this.loadingElement.style.display = 'none';
    }
    
    /**
     * Clear error state
     */
    clearError() {
        if (this.isDestroyed) return;
        
        this.hasError = false;
        this.errorMessage = '';
        this.errorElement.style.display = 'none';
    }
    
    /**
     * Render the display content
     * Override this method in child classes
     */
    render() {
        if (this.isDestroyed || this.isLoading || this.hasError) return;
        
        // Clear existing content
        this.contentElement.innerHTML = '';
        
        // Render the actual content
        this.renderContent();
    }
    
    /**
     * Render the actual content
     * Override this method in child classes
     */
    renderContent() {
        // Override in child classes
        if (this.data) {
            this.contentElement.textContent = JSON.stringify(this.data);
        }
    }
    
    /**
     * Create a value display element
     * @param {any} value - Value to display
     * @param {Object} options - Display options
     * @returns {HTMLElement} Value element
     */
    createValueElement(value, options = {}) {
        const {
            type = 'text',
            className = 'cs2-value',
            color = null,
            copyable = false,
            tooltip = null
        } = options;
        
        let displayValue = value;
        
        // Format value based on type
        switch (type) {
            case 'float':
                displayValue = formatFloat(value, options.precision);
                break;
            case 'percentage':
                displayValue = formatPercentage(value, options.precision);
                break;
            case 'currency':
                displayValue = `$${parseFloat(value).toFixed(2)}`;
                break;
        }
        
        const element = createElement('span', {
            className,
            textContent: displayValue,
            styles: color ? { color } : {}
        });
        
        // Add copy functionality
        if (copyable) {
            element.style.cursor = 'pointer';
            element.style.textDecoration = 'underline';
            
            this.addEventListener(element, 'click', () => {
                this.copyToClipboard(value);
            });
        }
        
        // Add tooltip
        if (tooltip) {
            element.title = tooltip;
        }
        
        return element;
    }
    
    /**
     * Create a label element
     * @param {string} text - Label text
     * @param {Object} options - Label options
     * @returns {HTMLElement} Label element
     */
    createLabelElement(text, options = {}) {
        const { className = 'cs2-label', color = '#888' } = options;
        
        return createElement('span', {
            className,
            textContent: text,
            styles: { color, fontSize: '11px', marginRight: '4px' }
        });
    }
    
    /**
     * Create a container for related elements
     * @param {Array} elements - Elements to contain
     * @param {Object} options - Container options
     * @returns {HTMLElement} Container element
     */
    createContainer(elements, options = {}) {
        const {
            className = 'cs2-container',
            direction = 'horizontal',
            gap = '4px'
        } = options;
        
        const container = createElement('div', {
            className,
            styles: {
                display: 'flex',
                flexDirection: direction === 'horizontal' ? 'row' : 'column',
                gap,
                alignItems: 'center'
            }
        });
        
        elements.forEach(element => {
            if (element) {
                container.appendChild(element);
            }
        });
        
        return container;
    }
    
    /**
     * Copy value to clipboard
     * @param {any} value - Value to copy
     */
    async copyToClipboard(value) {
        try {
            await navigator.clipboard.writeText(String(value));
            this.emit('copy', { value });
            this.showCopyFeedback();
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
        }
    }
    
    /**
     * Show visual feedback after copying
     */
    showCopyFeedback() {
        const feedback = createElement('div', {
            textContent: 'Copied!',
            styles: {
                position: 'absolute',
                background: 'rgba(34, 197, 94, 0.9)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                zIndex: '99999',
                pointerEvents: 'none',
                opacity: '0',
                transition: 'opacity 0.2s'
            }
        });
        
        // Position near this component
        const rect = this.element.getBoundingClientRect();
        feedback.style.left = `${rect.left}px`;
        feedback.style.top = `${rect.top - 30}px`;
        
        document.body.appendChild(feedback);
        
        // Fade in
        setTimeout(() => {
            feedback.style.opacity = '1';
        }, 10);
        
        // Fade out and remove
        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => {
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
            }, 200);
        }, 1000);
    }
    
    /**
     * Update display with new data
     * @param {any} newData - New data to display
     */
    update(newData) {
        super.update();
        
        if (newData !== undefined) {
            this.setData(newData);
        }
    }
    
    /**
     * Validate display data
     * @returns {boolean} True if data is valid
     */
    validateData() {
        return this.data !== null && this.data !== undefined;
    }
    
    /**
     * Get current display state
     * @returns {Object} Display state
     */
    getState() {
        return {
            ...super.getData(),
            data: this.data,
            isLoading: this.isLoading,
            hasError: this.hasError,
            errorMessage: this.errorMessage
        };
    }
    
    /**
     * Reset component to initial state
     */
    reset() {
        this.data = null;
        this.isLoading = false;
        this.hasError = false;
        this.errorMessage = '';
        this.clearError();
        this.hideLoading();
        this.contentElement.innerHTML = '';
    }
    
    /**
     * Cleanup on destroy
     */
    onDestroy() {
        super.onDestroy();
        this.reset();
    }
}