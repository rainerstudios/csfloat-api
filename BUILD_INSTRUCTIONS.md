# CS2 Float Extension Enhanced - Build Instructions

## Prerequisites

- Node.js 18+ 
- npm 9+
- Git

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Development build:**
```bash
npm run build:dev
```

3. **Production build:**
```bash
npm run build
```

4. **Watch mode (for development):**
```bash
npm run watch
```

## Testing

### Run tests:
```bash
npm test
```

### Type checking:
```bash
npm run type-check
```

### Linting:
```bash
npm run lint
```

### Format code:
```bash
npm run format
```

## Loading in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the `dist` folder from your project directory

## Development Workflow

1. Make changes to TypeScript files in `src/`
2. Run `npm run watch` to automatically rebuild on changes
3. Reload the extension in Chrome by clicking the refresh icon
4. Test your changes on Steam Community pages

## Features to Test

### 🎯 Core Features
- [x] Enhanced float value display with precision
- [x] Visual float bars with percentile rankings
- [x] Pattern recognition and blue gem detection
- [x] Market intelligence and investment scoring
- [x] Advanced tooltips with comprehensive data

### 📊 Market Page Testing
Navigate to: `https://steamcommunity.com/market/listings/730/AK-47%20%7C%20Case%20Hardened%20%28Field-Tested%29`

**Expected behavior:**
- Loading indicators appear on market listings
- Enhanced float data displays below price
- Visual float bars show wear ranges
- Blue gem detection for Case Hardened items
- Market intelligence panels with investment scores

### 🎒 Inventory Page Testing
Navigate to: `https://steamcommunity.com/id/[steamid]/inventory/#730`

**Expected behavior:**
- Click inventory items to load float data
- Enhanced overlays appear on CS2 items
- Pattern analysis for special skins
- StatTrak counter display
- Float percentile rankings

### 🔄 Trade Offer Testing
Navigate to: `https://steamcommunity.com/tradeoffer/new/`

**Expected behavior:**
- Enhanced data on trade items
- Investment recommendations
- Pattern analysis in trade context
- Real-time market intelligence

## Performance Benchmarks

### API Response Times
- Individual requests: < 2 seconds
- Bulk processing: < 5 seconds for 10 items
- Cache hit response: < 50ms

### Memory Usage
- Base extension: ~10MB
- With 100 cached items: ~15MB
- With visual components: ~20MB

### Features Performance
- Blue gem detection: < 100ms
- Pattern analysis: < 200ms
- Market intelligence: < 500ms
- Visual float bar rendering: < 50ms

## Debugging

### Enable Debug Logging
```javascript
// In Chrome DevTools Console
localStorage.setItem('cs2_debug', 'true');
```

### Check Extension Logs
1. Go to `chrome://extensions/`
2. Find "CS2 Float Extension Enhanced"
3. Click "Inspect views: background page"
4. Check Console tab for background script logs

### Content Script Debugging
1. Right-click on Steam page
2. Select "Inspect"
3. Check Console tab for content script logs

## Common Issues

### TypeScript Compilation Errors
```bash
# Clean build
rm -rf dist/
npm run build
```

### Extension Not Loading
- Check manifest.json syntax
- Verify all file paths exist
- Check permissions in manifest

### API Requests Failing
- Verify network connection
- Check CSP settings in manifest
- Confirm API endpoints are accessible

### Missing Visual Elements
- Check CSS file imports
- Verify web_accessible_resources in manifest
- Inspect element styles in DevTools

## Production Deployment

### Build for Chrome Web Store
```bash
npm run build
cd dist
zip -r ../cs2-float-extension-v2.0.0.zip .
```

### Build for Firefox
```bash
# Firefox build (if needed)
npm run build
# Manual manifest v2 conversion required
```

## Code Quality Checks

### Pre-commit Checklist
- [ ] `npm run lint` passes
- [ ] `npm run type-check` passes  
- [ ] `npm test` passes
- [ ] Manual testing on Steam pages
- [ ] Performance benchmarks met

### Security Checklist
- [ ] No sensitive data in console logs
- [ ] Proper CSP configuration
- [ ] Input sanitization for API responses
- [ ] Safe DOM manipulation practices

## Advanced Features Testing

### Blue Gem Detection
Test with Case Hardened items:
- AK-47 Case Hardened patterns #661, #670, #555
- Five-SeveN Case Hardened patterns #278, #868
- Verify blue percentage calculations
- Check tier classifications

### Pattern Recognition
Test with special patterns:
- Fade items (100%, 95%, 90/10)
- Doppler phases (Ruby, Sapphire, Black Pearl)
- Marble Fade (Fire & Ice patterns)

### Market Intelligence
- Price trend analysis
- Investment scoring accuracy
- Supply/demand indicators
- Risk factor identification

## Extension Structure

```
dist/
├── background.js           # Enhanced background service
├── content.js             # Enhanced content script
├── popup.html            # Extension popup
├── popup.js              # Popup functionality
├── manifest.json         # Extension manifest
├── lib/
│   ├── components/       # UI components
│   ├── services/        # Core services
│   └── page_scripts/    # Page-specific scripts
└── styles/              # CSS files
```

## Next Steps

After successful testing:

1. **Performance Optimization**
   - Implement lazy loading
   - Optimize bundle size
   - Add service worker caching

2. **Advanced Features**
   - Real-time market scanning
   - AI-powered predictions
   - Cross-platform integration

3. **User Experience**
   - Settings panel
   - Achievement system
   - Tutorial overlay

4. **Analytics**
   - Usage tracking
   - Performance monitoring
   - Error reporting