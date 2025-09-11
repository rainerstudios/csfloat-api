/**
 * DOM Utilities for CS2 Float Extension
 * Common DOM manipulation and creation functions
 */

import { CSS_CLASSES, SELECTORS, Z_INDEX, TIMEOUTS } from './constants.js';

/**
 * Create an element with properties and styles
 * @param {string} tag - HTML tag name
 * @param {Object} options - Element options
 * @param {Object} options.className - CSS class name
 * @param {Object} options.id - Element ID
 * @param {Object} options.styles - CSS styles object
 * @param {Object} options.attributes - HTML attributes
 * @param {string} options.innerHTML - Inner HTML content
 * @param {string} options.textContent - Text content
 * @returns {HTMLElement} Created element
 */
export function createElement(tag, options = {}) {
    const element = document.createElement(tag);
    
    if (options.className) {
        element.className = options.className;
    }
    
    if (options.id) {
        element.id = options.id;
    }
    
    if (options.styles) {
        Object.assign(element.style, options.styles);
    }
    
    if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }
    
    if (options.innerHTML) {
        element.innerHTML = options.innerHTML;
    }
    
    if (options.textContent) {
        element.textContent = options.textContent;
    }
    
    return element;
}

/**
 * Find element by selector with optional parent
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {HTMLElement|null} Found element
 */
export function findElement(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Find all elements by selector with optional parent
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {NodeList} Found elements
 */
export function findElements(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

/**
 * Check if element exists in DOM
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 * @returns {boolean} True if element exists
 */
export function elementExists(selector, parent = document) {
    return parent.querySelector(selector) !== null;
}

/**
 * Wait for element to appear in DOM
 * @param {string} selector - CSS selector
 * @param {Object} options - Wait options
 * @param {number} options.timeout - Timeout in ms (default: 5000)
 * @param {number} options.interval - Check interval in ms (default: 100)
 * @param {HTMLElement} options.parent - Parent element (default: document)
 * @returns {Promise<HTMLElement>} Promise that resolves with element
 */
export function waitForElement(selector, options = {}) {
    const { timeout = 5000, interval = 100, parent = document } = options;
    
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const checkElement = () => {
            const element = parent.querySelector(selector);
            
            if (element) {
                resolve(element);
                return;
            }
            
            if (Date.now() - startTime > timeout) {
                reject(new Error(`Element ${selector} not found within ${timeout}ms`));
                return;
            }
            
            setTimeout(checkElement, interval);
        };
        
        checkElement();
    });
}

/**
 * Remove element from DOM if it exists
 * @param {string|HTMLElement} elementOrSelector - Element or selector
 * @param {HTMLElement} parent - Parent element (default: document)
 */
export function removeElement(elementOrSelector, parent = document) {
    let element;
    
    if (typeof elementOrSelector === 'string') {
        element = parent.querySelector(elementOrSelector);
    } else {
        element = elementOrSelector;
    }
    
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

/**
 * Remove all elements matching selector
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element (default: document)
 */
export function removeElements(selector, parent = document) {
    const elements = parent.querySelectorAll(selector);
    elements.forEach(element => element.remove());
}

/**
 * Insert element after target element
 * @param {HTMLElement} newElement - Element to insert
 * @param {HTMLElement} targetElement - Target element
 */
export function insertAfter(newElement, targetElement) {
    targetElement.parentNode.insertBefore(newElement, targetElement.nextSibling);
}

/**
 * Insert element before target element
 * @param {HTMLElement} newElement - Element to insert
 * @param {HTMLElement} targetElement - Target element
 */
export function insertBefore(newElement, targetElement) {
    targetElement.parentNode.insertBefore(newElement, targetElement);
}

/**
 * Create and show tooltip
 * @param {HTMLElement} targetElement - Element to attach tooltip to
 * @param {string} content - Tooltip content
 * @param {Object} options - Tooltip options
 * @param {string} options.position - Position ('top', 'bottom', 'left', 'right')
 * @param {number} options.delay - Show delay in ms
 * @returns {HTMLElement} Tooltip element
 */
export function createTooltip(targetElement, content, options = {}) {
    const { position = 'top', delay = TIMEOUTS.TOOLTIP_DELAY } = options;
    
    const tooltip = createElement('div', {
        className: 'cs2-tooltip',
        textContent: content,
        styles: {
            position: 'absolute',
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            opacity: '0',
            transition: 'opacity 0.2s',
            zIndex: Z_INDEX.TOOLTIP
        }
    });
    
    // Position tooltip
    const positionTooltip = () => {
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        switch (position) {
            case 'top':
                tooltip.style.left = `${rect.left + rect.width / 2 - tooltipRect.width / 2}px`;
                tooltip.style.top = `${rect.top - tooltipRect.height - 4}px`;
                break;
            case 'bottom':
                tooltip.style.left = `${rect.left + rect.width / 2 - tooltipRect.width / 2}px`;
                tooltip.style.top = `${rect.bottom + 4}px`;
                break;
            case 'left':
                tooltip.style.left = `${rect.left - tooltipRect.width - 4}px`;
                tooltip.style.top = `${rect.top + rect.height / 2 - tooltipRect.height / 2}px`;
                break;
            case 'right':
                tooltip.style.left = `${rect.right + 4}px`;
                tooltip.style.top = `${rect.top + rect.height / 2 - tooltipRect.height / 2}px`;
                break;
        }
    };
    
    let showTimeout;
    let hideTimeout;
    
    const showTooltip = () => {
        clearTimeout(hideTimeout);
        showTimeout = setTimeout(() => {
            document.body.appendChild(tooltip);
            positionTooltip();
            tooltip.style.opacity = '1';
        }, delay);
    };
    
    const hideTooltip = () => {
        clearTimeout(showTimeout);
        hideTimeout = setTimeout(() => {
            tooltip.style.opacity = '0';
            setTimeout(() => {
                if (tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
            }, 200);
        }, 100);
    };
    
    targetElement.addEventListener('mouseenter', showTooltip);
    targetElement.addEventListener('mouseleave', hideTooltip);
    
    return tooltip;
}

/**
 * Add click outside handler to element
 * @param {HTMLElement} element - Element to handle clicks outside of
 * @param {Function} callback - Callback function
 * @returns {Function} Cleanup function
 */
export function addClickOutsideHandler(element, callback) {
    const handleClick = (event) => {
        if (!element.contains(event.target)) {
            callback(event);
        }
    };
    
    document.addEventListener('click', handleClick);
    
    // Return cleanup function
    return () => {
        document.removeEventListener('click', handleClick);
    };
}

/**
 * Get element's position relative to viewport
 * @param {HTMLElement} element - Target element
 * @returns {Object} Position object with top, left, bottom, right
 */
export function getElementPosition(element) {
    const rect = element.getBoundingClientRect();
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
 * Check if element is visible in viewport
 * @param {HTMLElement} element - Target element
 * @returns {boolean} True if visible
 */
export function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * Scroll element into view smoothly
 * @param {HTMLElement} element - Element to scroll to
 * @param {Object} options - Scroll options
 */
export function scrollToElement(element, options = {}) {
    element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest',
        ...options
    });
}

/**
 * Create loading spinner element
 * @param {Object} options - Spinner options
 * @returns {HTMLElement} Spinner element
 */
export function createLoadingSpinner(options = {}) {
    const { size = 16, color = '#22c55e' } = options;
    
    return createElement('div', {
        className: 'cs2-loading-spinner',
        styles: {
            width: `${size}px`,
            height: `${size}px`,
            border: `2px solid ${color}33`,
            borderTop: `2px solid ${color}`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
        }
    });
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in ms
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}