/**
 * Filter Component Base Class
 * Base class for components that filter content (FloatFilter, PatternFilter, etc.)
 */

import { BaseComponent } from './BaseComponent.js';
import { createElement } from '../../utils/dom.js';
import { isValidFloat, isValidRange, sanitizeInput } from '../../utils/validation.js';
import { debounce } from '../../utils/dom.js';

export class FilterComponent extends BaseComponent {
    constructor(options = {}) {
        super(options);
        
        // Filter-specific properties
        this.filters = {};
        this.isActive = false;
        this.filterCallbacks = [];
        this.debounceDelay = options.debounceDelay || 300;
        
        // Create debounced filter function
        this.debouncedFilter = debounce(() => {
            this.applyFilters();
        }, this.debounceDelay);
    }
    
    /**
     * Get the CSS class name for filter components
     * @returns {string} CSS class name
     */
    getClassName() {
        return 'cs2-filter-component';
    }
    
    /**
     * Create the component structure
     */
    createElement() {
        super.createElement();
        
        // Create filter container
        this.filterContainer = createElement('div', {
            className: 'cs2-filter-container',
            styles: {
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '8px',
                background: 'rgba(0, 0, 0, 0.8)',
                borderRadius: '4px',
                border: '1px solid #333'
            }
        });
        
        this.element.appendChild(this.filterContainer);
        
        // Create filter controls
        this.createFilterControls();
    }
    
    /**
     * Create filter controls
     * Override this method in child classes
     */
    createFilterControls() {
        // Override in child classes
    }
    
    /**
     * Create a labeled input field
     * @param {string} label - Input label
     * @param {Object} options - Input options
     * @returns {Object} Object with label and input elements
     */
    createLabeledInput(label, options = {}) {
        const {
            type = 'text',
            placeholder = '',
            value = '',
            min = null,
            max = null,
            step = null,
            className = 'cs2-filter-input'
        } = options;
        
        const labelElement = createElement('label', {
            textContent: label,
            styles: {
                color: '#ccc',
                fontSize: '11px',
                fontWeight: 'bold'
            }
        });
        
        const inputElement = createElement('input', {
            attributes: {
                type,
                placeholder,
                value
            },
            className,
            styles: {
                background: '#1e1e1e',
                border: '1px solid #444',
                color: '#fff',
                padding: '4px 6px',
                borderRadius: '3px',
                fontSize: '11px',
                width: '80px'
            }
        });
        
        // Set numeric attributes if applicable
        if (type === 'number' || type === 'range') {
            if (min !== null) inputElement.setAttribute('min', min);
            if (max !== null) inputElement.setAttribute('max', max);
            if (step !== null) inputElement.setAttribute('step', step);
        }
        
        const container = createElement('div', {
            className: 'cs2-input-group',
            styles: {
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
            }
        });
        
        container.appendChild(labelElement);
        container.appendChild(inputElement);
        
        return { container, label: labelElement, input: inputElement };
    }
    
    /**
     * Create a button
     * @param {string} text - Button text
     * @param {Object} options - Button options
     * @returns {HTMLElement} Button element
     */
    createButton(text, options = {}) {
        const {
            className = 'cs2-filter-button',
            variant = 'primary',
            size = 'small'
        } = options;
        
        const styles = {
            padding: size === 'small' ? '4px 8px' : '8px 12px',
            border: 'none',
            borderRadius: '3px',
            fontSize: '11px',
            cursor: 'pointer',
            fontWeight: 'bold',
            transition: 'all 0.2s'
        };
        
        // Variant styles
        switch (variant) {
            case 'primary':
                Object.assign(styles, {
                    background: '#22c55e',
                    color: 'white'
                });
                break;
            case 'secondary':
                Object.assign(styles, {
                    background: '#6b7280',
                    color: 'white'
                });
                break;
            case 'danger':
                Object.assign(styles, {
                    background: '#ef4444',
                    color: 'white'
                });
                break;
        }
        
        const button = createElement('button', {
            textContent: text,
            className,
            styles
        });
        
        // Hover effects
        this.addEventListener(button, 'mouseenter', () => {
            button.style.opacity = '0.8';
        });
        
        this.addEventListener(button, 'mouseleave', () => {
            button.style.opacity = '1';
        });
        
        return button;
    }
    
    /**
     * Create a range slider with min/max inputs
     * @param {string} label - Range label
     * @param {Object} options - Range options
     * @returns {Object} Range control elements
     */
    createRangeControl(label, options = {}) {
        const {
            min = 0,
            max = 1,
            step = 0.01,
            defaultMin = min,
            defaultMax = max
        } = options;
        
        const container = createElement('div', {
            className: 'cs2-range-control',
            styles: {
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
            }
        });
        
        const labelElement = createElement('label', {
            textContent: label,
            styles: {
                color: '#ccc',
                fontSize: '11px',
                fontWeight: 'bold'
            }
        });
        
        const inputsContainer = createElement('div', {
            styles: {
                display: 'flex',
                gap: '4px',
                alignItems: 'center'
            }
        });
        
        const minInput = createElement('input', {
            attributes: {
                type: 'number',
                min,
                max,
                step,
                value: defaultMin,
                placeholder: 'Min'
            },
            styles: {
                background: '#1e1e1e',
                border: '1px solid #444',
                color: '#fff',
                padding: '4px 6px',
                borderRadius: '3px',
                fontSize: '11px',
                width: '60px'
            }
        });
        
        const separator = createElement('span', {
            textContent: '-',
            styles: { color: '#ccc' }
        });
        
        const maxInput = createElement('input', {
            attributes: {
                type: 'number',
                min,
                max,
                step,
                value: defaultMax,
                placeholder: 'Max'
            },
            styles: {
                background: '#1e1e1e',
                border: '1px solid #444',
                color: '#fff',
                padding: '4px 6px',
                borderRadius: '3px',
                fontSize: '11px',
                width: '60px'
            }
        });
        
        inputsContainer.appendChild(minInput);
        inputsContainer.appendChild(separator);
        inputsContainer.appendChild(maxInput);
        
        container.appendChild(labelElement);
        container.appendChild(inputsContainer);
        
        return {
            container,
            label: labelElement,
            minInput,
            maxInput,
            getValue: () => ({
                min: parseFloat(minInput.value) || min,
                max: parseFloat(maxInput.value) || max
            }),
            setValue: (minVal, maxVal) => {
                minInput.value = minVal;
                maxInput.value = maxVal;
            }
        };
    }
    
    /**
     * Set filter value
     * @param {string} key - Filter key
     * @param {any} value - Filter value
     */
    setFilter(key, value) {
        this.filters[key] = value;
        this.updateActiveState();
        this.debouncedFilter();
    }
    
    /**
     * Get filter value
     * @param {string} key - Filter key
     * @returns {any} Filter value
     */
    getFilter(key) {
        return this.filters[key];
    }
    
    /**
     * Remove filter
     * @param {string} key - Filter key
     */
    removeFilter(key) {
        delete this.filters[key];
        this.updateActiveState();
        this.debouncedFilter();
    }
    
    /**
     * Clear all filters
     */
    clearFilters() {
        this.filters = {};
        this.updateActiveState();
        this.clearFilterControls();
        this.debouncedFilter();
    }
    
    /**
     * Clear filter control values
     * Override this method in child classes
     */
    clearFilterControls() {
        // Override in child classes
    }
    
    /**
     * Update active state based on filters
     */
    updateActiveState() {
        const hasActiveFilters = Object.keys(this.filters).length > 0;
        
        if (hasActiveFilters !== this.isActive) {
            this.isActive = hasActiveFilters;
            this.element.classList.toggle('active', this.isActive);
            this.onActiveStateChange(this.isActive);
        }
    }
    
    /**
     * Called when active state changes
     * @param {boolean} isActive - New active state
     */
    onActiveStateChange(isActive) {
        this.emit('activeStateChange', { isActive });
    }
    
    /**
     * Apply filters to items
     * Override this method in child classes
     */
    applyFilters() {
        // Override in child classes
        this.emit('filtersApplied', { filters: this.filters });
        
        // Call registered callbacks
        this.filterCallbacks.forEach(callback => {
            try {
                callback(this.filters);
            } catch (error) {
                console.error('Filter callback error:', error);
            }
        });
    }
    
    /**
     * Register filter callback
     * @param {Function} callback - Callback function
     */
    onFilter(callback) {
        if (typeof callback === 'function') {
            this.filterCallbacks.push(callback);
        }
    }
    
    /**
     * Check if item passes all filters
     * @param {any} item - Item to check
     * @returns {boolean} True if item passes filters
     */
    itemPassesFilters(item) {
        // Override in child classes
        return true;
    }
    
    /**
     * Validate filter input
     * @param {string} type - Input type
     * @param {any} value - Input value
     * @returns {Object} Validation result
     */
    validateInput(type, value) {
        return sanitizeInput(value, type);
    }
    
    /**
     * Get current filter state
     * @returns {Object} Filter state
     */
    getState() {
        return {
            ...super.getData(),
            filters: { ...this.filters },
            isActive: this.isActive
        };
    }
    
    /**
     * Restore filter state
     * @param {Object} state - State to restore
     */
    setState(state) {
        if (state.filters) {
            this.filters = { ...state.filters };
            this.updateActiveState();
            this.restoreFilterControls();
        }
    }
    
    /**
     * Restore filter control values from current filters
     * Override this method in child classes
     */
    restoreFilterControls() {
        // Override in child classes
    }
    
    /**
     * Cleanup on destroy
     */
    onDestroy() {
        super.onDestroy();
        this.filterCallbacks = [];
        this.filters = {};
    }
}