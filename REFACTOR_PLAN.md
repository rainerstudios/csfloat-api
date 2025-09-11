# CS2 Float Extension - Refactoring Plan

## 🎯 Goals
- Break down monolithic files into smaller, focused modules
- Create reusable components and utilities
- Improve maintainability and testability
- Establish consistent patterns and APIs

## 📁 Proposed New Structure

```
src/
├── core/                          # Core system files
│   ├── ContentManager.js          # Main orchestrator (from simpleContent.js)
│   ├── ComponentLoader.js         # Dynamic component loading
│   ├── EventBus.js               # Centralized event management
│   └── ConfigManager.js          # Settings and configuration
│
├── api/                          # API and data management
│   ├── FloatAPI.js               # Float data fetching
│   ├── SteamAPI.js               # Steam market integration
│   ├── CacheManager.js           # Smart caching system
│   └── RateLimiter.js            # Rate limiting logic
│
├── components/                   # UI Components
│   ├── base/                     # Base classes and shared components
│   │   ├── BaseComponent.js      # Common component functionality
│   │   ├── DisplayComponent.js   # Base for display components
│   │   └── FilterComponent.js    # Base for filter components
│   │
│   ├── display/                  # Display components
│   │   ├── FloatDisplay.js       # Float value display
│   │   ├── FloatBar.js           # Visual float bar
│   │   ├── FloatRanking.js       # Ranking badges
│   │   ├── PatternDisplay.js     # Pattern information
│   │   └── PriceDisplay.js       # Price calculations
│   │
│   ├── filters/                  # Filter components
│   │   ├── FloatFilter.js        # Float range filtering
│   │   ├── PatternFilter.js      # Pattern filtering
│   │   └── PriceFilter.js        # Price filtering
│   │
│   └── interactive/              # Interactive components
│       ├── CopyButton.js         # Copy to clipboard
│       ├── QuickBuy.js           # Quick purchase
│       └── TradeHold.js          # Trade hold display
│
├── utils/                        # Utility functions
│   ├── dom.js                    # DOM manipulation utilities
│   ├── css.js                    # CSS generation and styling
│   ├── format.js                 # Data formatting utilities
│   ├── validation.js             # Input validation
│   ├── constants.js              # Shared constants
│   └── helpers.js                # General helper functions
│
├── detectors/                    # Page and item detection
│   ├── PageDetector.js           # Detect page types
│   ├── ItemDetector.js           # Detect item types
│   └── MarketDetector.js         # Market-specific detection
│
├── styles/                       # Centralized styling
│   ├── BaseStyles.js             # Common CSS
│   ├── ComponentStyles.js        # Component-specific CSS
│   └── ThemeManager.js           # Theme management
│
└── background/                   # Background script modules
    ├── APIHandler.js             # API request handling
    ├── CacheHandler.js           # Cache management
    ├── MessageHandler.js         # Message routing
    └── SettingsHandler.js        # Settings management
```

## 🔧 Refactoring Steps

### Phase 1: Core Infrastructure
1. **Create BaseComponent class** - Common functionality for all components
2. **Extract utility functions** - DOM, CSS, formatting, validation
3. **Create EventBus** - Centralized event management
4. **Extract constants** - Shared values and configurations

### Phase 2: API Layer
1. **Split API logic** - Separate concerns (float API, Steam API, caching)
2. **Create RateLimiter** - Centralized rate limiting
3. **Improve error handling** - Consistent error management

### Phase 3: Component System
1. **Break down simpleContent.js** - Split into focused modules
2. **Create component base classes** - DisplayComponent, FilterComponent
3. **Modularize UI components** - FloatDisplay, FloatBar, etc.

### Phase 4: Styling System
1. **Extract inline CSS** - Move to centralized style system
2. **Create theme system** - Consistent styling approach
3. **CSS utilities** - Reusable style functions

## 🎁 Benefits

### Maintainability
- **Smaller files** - Easier to understand and modify
- **Single responsibility** - Each module has one clear purpose
- **Consistent patterns** - Predictable code structure

### Reusability
- **Component library** - Reusable UI components
- **Utility functions** - Shared helper functions
- **Style system** - Consistent visual design

### Testability
- **Isolated modules** - Easier to unit test
- **Dependency injection** - Better mocking capabilities
- **Clear interfaces** - Predictable component APIs

### Performance
- **Tree shaking** - Only load needed components
- **Lazy loading** - Load components on demand
- **Better caching** - Optimized data management

## 📋 Implementation Priority

1. **High Priority** (Core functionality)
   - BaseComponent class
   - Utility functions extraction
   - Constants extraction
   - Split simpleContent.js

2. **Medium Priority** (Developer experience)
   - Component base classes
   - Style system
   - Event bus

3. **Low Priority** (Polish)
   - Theme system
   - Advanced lazy loading
   - Performance optimizations

## 🧪 Testing Strategy

Each refactored module should have:
- **Unit tests** for individual functions
- **Integration tests** for component interactions
- **E2E tests** for complete workflows