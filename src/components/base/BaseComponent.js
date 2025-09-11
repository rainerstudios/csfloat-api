/**
 * Base Component Class
 * Common functionality for all CS2 Float Extension components
 */

import { generateId, deepClone } from '../../utils/helpers.js';
import { createElement } from '../../utils/dom.js';

export class BaseComponent {
    constructor(options = {}) {
        this.id = options.id || generateId('component');
        this.element = null;
        this.isInitialized = false;
        this.isDestroyed = false;
        this.eventListeners = [];
        this.childComponents = [];
        
        // Component options
        this.options = deepClone(options);
        
        // Initialize component
        this.init();
    }
    
    /**
     * Initialize the component
     * Override this method in child classes
     */
    init() {
        try {
            this.createElement();
            this.bindEvents();
            this.isInitialized = true;
            this.onInit();
        } catch (error) {
            console.error(`[${this.constructor.name}] Initialization error:`, error);
        }
    }
    
    /**
     * Create the main component element
     * Override this method in child classes
     */
    createElement() {
        this.element = createElement('div', {
            id: this.id,
            className: this.getClassName()
        });
    }
    
    /**
     * Get the CSS class name for this component
     * Override this method in child classes
     * @returns {string} CSS class name
     */
    getClassName() {
        return 'cs2-component';
    }
    
    /**
     * Bind event listeners
     * Override this method in child classes
     */
    bindEvents() {
        // Override in child classes
    }
    
    /**
     * Called after component initialization
     * Override this method in child classes
     */
    onInit() {
        // Override in child classes
    }
    
    /**
     * Add event listener with automatic cleanup
     * @param {HTMLElement} element - Element to attach listener to
     * @param {string} event - Event type
     * @param {Function} handler - Event handler
     * @param {Object} options - Event options
     */
    addEventListener(element, event, handler, options = {}) {
        element.addEventListener(event, handler, options);
        
        // Store for cleanup
        this.eventListeners.push({
            element,
            event,
            handler,
            options
        });
    }
    
    /**
     * Remove all event listeners
     */
    removeEventListeners() {
        this.eventListeners.forEach(({ element, event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        this.eventListeners = [];
    }
    
    /**
     * Add a child component
     * @param {BaseComponent} component - Child component to add
     */
    addChild(component) {
        if (component instanceof BaseComponent) {
            this.childComponents.push(component);
        }
    }
    
    /**
     * Remove a child component
     * @param {BaseComponent} component - Child component to remove
     */
    removeChild(component) {
        const index = this.childComponents.indexOf(component);
        if (index !== -1) {
            this.childComponents.splice(index, 1);
            component.destroy();
        }
    }
    
    /**
     * Remove all child components
     */
    removeAllChildren() {
        this.childComponents.forEach(child => child.destroy());
        this.childComponents = [];
    }
    
    /**
     * Render the component to a parent element
     * @param {HTMLElement} parent - Parent element
     */
    render(parent) {
        if (!this.element || this.isDestroyed) {
            console.warn(`[${this.constructor.name}] Cannot render destroyed or uninitialized component`);
            return;
        }
        
        if (parent && parent.appendChild) {
            parent.appendChild(this.element);
            this.onRender();
        }
    }
    
    /**
     * Called after component is rendered
     * Override this method in child classes
     */
    onRender() {
        // Override in child classes
    }
    
    /**
     * Update component with new options
     * @param {Object} newOptions - New options to merge
     */
    update(newOptions = {}) {
        if (this.isDestroyed) {
            console.warn(`[${this.constructor.name}] Cannot update destroyed component`);
            return;
        }
        
        // Merge new options
        this.options = { ...this.options, ...newOptions };
        
        // Trigger update
        this.onUpdate();
    }
    
    /**
     * Called when component is updated
     * Override this method in child classes
     */
    onUpdate() {
        // Override in child classes
    }
    
    /**
     * Show the component
     */
    show() {
        if (this.element && !this.isDestroyed) {
            this.element.style.display = '';
            this.onShow();
        }
    }
    
    /**
     * Hide the component
     */
    hide() {
        if (this.element && !this.isDestroyed) {
            this.element.style.display = 'none';
            this.onHide();
        }
    }
    
    /**
     * Called when component is shown
     * Override this method in child classes
     */
    onShow() {
        // Override in child classes
    }
    
    /**
     * Called when component is hidden
     * Override this method in child classes
     */
    onHide() {
        // Override in child classes
    }
    
    /**
     * Get component data
     * Override this method in child classes
     * @returns {Object} Component data
     */
    getData() {
        return {
            id: this.id,
            options: this.options,
            isInitialized: this.isInitialized,
            isDestroyed: this.isDestroyed
        };
    }
    
    /**
     * Set component data
     * Override this method in child classes
     * @param {Object} data - Data to set
     */
    setData(data) {
        if (data.options) {
            this.update(data.options);
        }
    }
    
    /**
     * Validate component state
     * Override this method in child classes
     * @returns {boolean} True if component is valid
     */
    validate() {
        return this.isInitialized && !this.isDestroyed && this.element !== null;
    }
    
    /**
     * Destroy the component and clean up resources
     */
    destroy() {
        if (this.isDestroyed) {
            return;
        }
        
        // Call pre-destroy hook
        this.onDestroy();
        
        // Remove all child components
        this.removeAllChildren();
        
        // Remove event listeners
        this.removeEventListeners();
        
        // Remove element from DOM
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        // Clean up references
        this.element = null;
        this.options = null;
        this.isDestroyed = true;
        this.isInitialized = false;
    }
    
    /**
     * Called before component is destroyed
     * Override this method in child classes
     */
    onDestroy() {
        // Override in child classes
    }
    
    /**
     * Check if component is visible in viewport
     * @returns {boolean} True if visible
     */
    isVisible() {
        if (!this.element || this.isDestroyed) {
            return false;
        }
        
        const rect = this.element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
    
    /**
     * Get component's position relative to viewport
     * @returns {Object} Position object
     */
    getPosition() {
        if (!this.element || this.isDestroyed) {
            return null;
        }
        
        const rect = this.element.getBoundingClientRect();
        return {
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            bottom: rect.bottom + window.scrollY,
            right: rect.right + window.scrollX,
            width: rect.width,
            height: rect.height
        };
    }
    
    /**
     * Emit a custom event
     * @param {string} eventName - Event name
     * @param {any} data - Event data
     */
    emit(eventName, data = null) {
        if (this.element && !this.isDestroyed) {
            const event = new CustomEvent(`cs2:${eventName}`, {
                detail: { componentId: this.id, data },
                bubbles: true
            });
            this.element.dispatchEvent(event);
        }
    }
    
    /**
     * Listen for custom events
     * @param {string} eventName - Event name
     * @param {Function} handler - Event handler
     */
    on(eventName, handler) {
        if (this.element && !this.isDestroyed) {
            this.addEventListener(this.element, `cs2:${eventName}`, handler);
        }
    }
    
    /**
     * Get string representation of component
     * @returns {string} Component string
     */
    toString() {
        return `${this.constructor.name}#${this.id}`;
    }
}