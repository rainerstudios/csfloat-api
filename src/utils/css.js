/**
 * CSS Utilities for CS2 Float Extension
 * Functions for CSS generation, injection, and style management
 */

import { Z_INDEX, CSS_CLASSES, ANIMATIONS } from './constants.js';

/**
 * Inject CSS into the page
 * @param {string} css - CSS string to inject
 * @param {string} id - Optional ID for the style element
 * @returns {HTMLStyleElement} The created style element
 */
export function injectCSS(css, id = null) {
    const style = document.createElement('style');
    style.textContent = css;
    
    if (id) {
        style.id = id;
        // Remove existing style with same ID
        const existing = document.getElementById(id);
        if (existing) {
            existing.remove();
        }
    }
    
    document.head.appendChild(style);
    return style;
}

/**
 * Create CSS from a style object
 * @param {Object} styles - Style object
 * @returns {string} CSS string
 */
export function createCSSFromObject(styles) {
    return Object.entries(styles)
        .map(([key, value]) => `${kebabCase(key)}: ${value}`)
        .join('; ');
}

/**
 * Convert camelCase to kebab-case
 * @param {string} str - String to convert
 * @returns {string} Kebab-case string
 */
export function kebabCase(str) {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Create CSS rule
 * @param {string} selector - CSS selector
 * @param {Object} styles - Style object
 * @returns {string} CSS rule
 */
export function createCSSRule(selector, styles) {
    const cssProps = createCSSFromObject(styles);
    return `${selector} { ${cssProps} }`;
}

/**
 * Create multiple CSS rules
 * @param {Object} rules - Object with selectors as keys and style objects as values
 * @returns {string} CSS string
 */
export function createCSSRules(rules) {
    return Object.entries(rules)
        .map(([selector, styles]) => createCSSRule(selector, styles))
        .join('\n');
}

/**
 * Get base styles for extension components
 * @returns {Object} Base styles object
 */
export function getBaseStyles() {
    return {
        // Base component styles
        [`.${CSS_CLASSES.FLOAT_DISPLAY}`]: {
            fontFamily: 'Arial, sans-serif',
            fontSize: '11px',
            lineHeight: '1.2',
            color: '#ffffff',
            userSelect: 'none',
            pointerEvents: 'auto'
        },
        
        // Float value styles
        [`.${CSS_CLASSES.FLOAT_VALUE}`]: {
            fontWeight: 'bold',
            display: 'inline-block'
        },
        
        // Copyable float styles
        [`.${CSS_CLASSES.FLOAT_COPYABLE}`]: {
            cursor: 'pointer',
            textDecoration: 'underline',
            position: 'relative',
            zIndex: '10',
            transition: 'opacity 0.2s'
        },
        
        [`.${CSS_CLASSES.FLOAT_COPYABLE}:hover`]: {
            opacity: '0.8'
        },
        
        // Float bar container
        [`.${CSS_CLASSES.FLOAT_BAR}`]: {
            position: 'relative',
            width: '100px',
            height: '8px',
            background: 'linear-gradient(to right, #4ade80 0%, #22c55e 7%, #facc15 15%, #fb923c 38%, #ef4444 45%, #ef4444 100%)',
            borderRadius: '4px',
            border: '1px solid #333',
            display: 'inline-block',
            verticalAlign: 'middle',
            margin: '0 4px'
        },
        
        [`.${CSS_CLASSES.FLOAT_BAR}::after`]: {
            content: '""',
            position: 'absolute',
            top: '-1px',
            width: '2px',
            height: '10px',
            background: '#ffffff',
            border: '1px solid #000',
            borderRadius: '1px',
            transform: 'translateX(-50%)'
        },
        
        // Float ranking styles
        [`.${CSS_CLASSES.FLOAT_RANKING}`]: {
            display: 'inline-block',
            background: 'rgba(34, 197, 94, 0.9)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '10px',
            fontSize: '10px',
            fontWeight: 'bold',
            marginLeft: '4px'
        },
        
        // Pattern display
        [`.${CSS_CLASSES.PATTERN_DISPLAY}`]: {
            display: 'inline-block',
            color: '#fbbf24',
            fontSize: '10px',
            fontWeight: 'bold',
            marginLeft: '4px'
        },
        
        // Profit display
        [`.${CSS_CLASSES.PROFIT_DISPLAY}`]: {
            display: 'inline-block',
            padding: '2px 4px',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: 'bold',
            marginLeft: '4px'
        },
        
        [`.${CSS_CLASSES.PROFIT_DISPLAY}.positive`]: {
            background: 'rgba(34, 197, 94, 0.2)',
            color: '#22c55e',
            border: '1px solid #22c55e'
        },
        
        [`.${CSS_CLASSES.PROFIT_DISPLAY}.negative`]: {
            background: 'rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            border: '1px solid #ef4444'
        },
        
        // Trade hold display
        [`.${CSS_CLASSES.TRADE_HOLD}`]: {
            display: 'inline-block',
            background: 'rgba(251, 146, 60, 0.9)',
            color: 'white',
            padding: '2px 4px',
            borderRadius: '3px',
            fontSize: '10px',
            fontWeight: 'bold',
            marginLeft: '4px'
        },
        
        // Quick buy button
        [`.${CSS_CLASSES.QUICK_BUY}`]: {
            background: '#22c55e',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: '3px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginLeft: '4px',
            transition: 'all 0.2s'
        },
        
        [`.${CSS_CLASSES.QUICK_BUY}:hover`]: {
            background: '#16a34a',
            transform: 'translateY(-1px)'
        },
        
        // Filter panel
        [`.${CSS_CLASSES.FILTER_PANEL}`]: {
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: 'rgba(0, 0, 0, 0.9)',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '12px',
            zIndex: Z_INDEX.MODAL,
            minWidth: '250px',
            color: '#ffffff',
            fontSize: '12px'
        },
        
        [`.${CSS_CLASSES.FILTER_TOGGLE}`]: {
            position: 'fixed',
            top: '10px',
            right: '10px',
            background: '#22c55e',
            color: 'white',
            border: 'none',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            zIndex: Z_INDEX.MODAL + 1,
            transition: 'all 0.2s'
        },
        
        [`.${CSS_CLASSES.FILTER_TOGGLE}:hover`]: {
            background: '#16a34a'
        },
        
        [`.${CSS_CLASSES.FILTER_TOGGLE}.active`]: {
            background: '#ef4444'
        }
    };
}

/**
 * Get animation keyframes CSS
 * @returns {string} Animation keyframes CSS
 */
export function getAnimationKeyframes() {
    return `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideDown {
            from { 
                opacity: 0; 
                transform: translateY(-10px); 
            }
            to { 
                opacity: 1; 
                transform: translateY(0); 
            }
        }
        
        @keyframes pulse {
            0%, 100% { 
                opacity: 1; 
                transform: scale(1); 
            }
            50% { 
                opacity: 0.7; 
                transform: scale(1.05); 
            }
        }
        
        @keyframes shimmer {
            0% { 
                background-position: -1000px 0; 
            }
            100% { 
                background-position: 1000px 0; 
            }
        }
        
        @keyframes spin {
            from { 
                transform: rotate(0deg); 
            }
            to { 
                transform: rotate(360deg); 
            }
        }
    `;
}

/**
 * Create loading spinner styles
 * @param {Object} options - Spinner options
 * @returns {Object} Spinner styles
 */
export function createSpinnerStyles(options = {}) {
    const { size = 16, color = '#22c55e' } = options;
    
    return {
        width: `${size}px`,
        height: `${size}px`,
        border: `2px solid ${color}33`,
        borderTop: `2px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    };
}

/**
 * Create tooltip styles
 * @param {Object} options - Tooltip options
 * @returns {Object} Tooltip styles
 */
export function createTooltipStyles(options = {}) {
    const {
        background = 'rgba(0, 0, 0, 0.9)',
        color = 'white',
        padding = '6px 10px',
        borderRadius = '4px',
        fontSize = '11px',
        zIndex = Z_INDEX.TOOLTIP
    } = options;
    
    return {
        position: 'absolute',
        background,
        color,
        padding,
        borderRadius,
        fontSize,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 0.2s',
        zIndex: String(zIndex),
        border: '1px solid #333'
    };
}

/**
 * Create button styles
 * @param {Object} options - Button options
 * @returns {Object} Button styles
 */
export function createButtonStyles(options = {}) {
    const {
        variant = 'primary',
        size = 'medium',
        disabled = false
    } = options;
    
    const baseStyles = {
        border: 'none',
        borderRadius: '4px',
        fontWeight: 'bold',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        display: 'inline-block',
        textAlign: 'center',
        textDecoration: 'none',
        outline: 'none'
    };
    
    // Size styles
    const sizeStyles = {
        small: { padding: '4px 8px', fontSize: '10px' },
        medium: { padding: '6px 12px', fontSize: '11px' },
        large: { padding: '8px 16px', fontSize: '12px' }
    };
    
    // Variant styles
    const variantStyles = {
        primary: {
            background: disabled ? '#6b7280' : '#22c55e',
            color: 'white'
        },
        secondary: {
            background: disabled ? '#6b7280' : '#374151',
            color: 'white'
        },
        danger: {
            background: disabled ? '#6b7280' : '#ef4444',
            color: 'white'
        },
        ghost: {
            background: 'transparent',
            color: disabled ? '#6b7280' : '#22c55e',
            border: `1px solid ${disabled ? '#6b7280' : '#22c55e'}`
        }
    };
    
    return {
        ...baseStyles,
        ...sizeStyles[size],
        ...variantStyles[variant]
    };
}

/**
 * Apply styles to an element
 * @param {HTMLElement} element - Element to style
 * @param {Object} styles - Styles to apply
 */
export function applyStyles(element, styles) {
    Object.entries(styles).forEach(([property, value]) => {
        element.style[property] = value;
    });
}

/**
 * Create and inject all base extension styles
 */
export function injectBaseStyles() {
    const baseStyles = getBaseStyles();
    const animationKeyframes = getAnimationKeyframes();
    
    const css = createCSSRules(baseStyles) + '\n' + animationKeyframes;
    
    injectCSS(css, 'cs2-float-extension-styles');
}

/**
 * Remove all extension styles
 */
export function removeExtensionStyles() {
    const styleElement = document.getElementById('cs2-float-extension-styles');
    if (styleElement) {
        styleElement.remove();
    }
}

/**
 * Create responsive styles based on viewport
 * @returns {Object} Responsive styles
 */
export function createResponsiveStyles() {
    const isMobile = window.innerWidth <= 768;
    
    return {
        [`.${CSS_CLASSES.FILTER_PANEL}`]: {
            ...(isMobile && {
                position: 'fixed',
                top: '0',
                right: '0',
                left: '0',
                borderRadius: '0',
                width: '100%',
                maxHeight: '50vh',
                overflow: 'auto'
            })
        },
        
        [`.${CSS_CLASSES.FLOAT_DISPLAY}`]: {
            ...(isMobile && {
                fontSize: '10px'
            })
        }
    };
}

/**
 * Update styles for theme changes
 * @param {Object} theme - Theme object
 */
export function updateThemeStyles(theme) {
    const themeCSS = `
        .${CSS_CLASSES.FLOAT_DISPLAY} {
            color: ${theme.textColor || '#ffffff'};
        }
        
        .${CSS_CLASSES.FILTER_PANEL} {
            background: ${theme.panelBackground || 'rgba(0, 0, 0, 0.9)'};
            border-color: ${theme.borderColor || '#333'};
        }
    `;
    
    injectCSS(themeCSS, 'cs2-float-extension-theme');
}