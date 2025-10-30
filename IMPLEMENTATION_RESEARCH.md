# Implementation Research Summary
## Research Date: 2025-10-30

This document summarizes the comprehensive research conducted across cloned repositories and GitHub to identify reusable patterns and features for the CSFloat Investment Tracker API.

---

## Research Sources

### 1. SkinWatch Repository (`/var/www/skinwatch-portfolio`)
**Type:** Supabase (PostgreSQL) + React + Edge Functions
**Key Finding:** Comprehensive portfolio management with time-series tracking

**Valuable Features Found:**
- ✅ Portfolio snapshots with time-series data (hourly/daily/monthly granularity)
- ✅ Price override system (manual price entry for items without market data)
- ✅ Marketplace preference system (per-user and per-item)
- ✅ Partial sales tracking (sell portions of multi-item investments)
- ✅ Batch price updates from CSGOTrader API
- ✅ Chart data endpoints for historical visualization
- ✅ Realized vs unrealized profit/loss calculations
- ✅ Sale reversal functionality
- ✅ RPC functions for complex operations
- ✅ Atomic updates with run_id tracking
- ✅ Cleanup mechanisms for stale data

**Data Sources Used:**
- Steam Community Market
- CSFloat Market
- Skinport
- Buff163
- Via CSGOTrader API: `https://prices.csgotrader.app/latest/{marketplace}.json`

**Edge Functions:**
1. `update-market-prices` - Batch price fetching with marketplace-specific configs
2. `create-portfolio-snapshots` - Automated snapshot creation

### 2. CSGO-API Repository (`/var/www/csgo-item-db`)
**Type:** Static JSON API
**Key Finding:** Comprehensive CS2 item database with metadata

**Valuable Features Found:**
- ✅ Float ranges (min_float/max_float) for all skins
- ✅ Doppler phase identification (Ruby, Sapphire, Black Pearl, Phase 1-4)
- ✅ Gamma Doppler phases (Emerald, Phase 1-4)
- ✅ Rarity classifications with hex color codes
- ✅ Item categorization (weapons, cases, stickers, agents, etc.)
- ✅ Market hash name generation patterns
- ✅ StatTrak/Souvenir availability flags
- ✅ Collection and case relationships
- ✅ Paint index to phase mappings
- ✅ Image URL patterns with CDN fallbacks
- ✅ Multi-language support (25+ languages)
- ✅ Special notes database (historical info like M4A4 Howl)

**Data Files Available:**
- `skins.json` (5.2MB) - Grouped skins
- `skins_not_grouped.json` (26.6MB) - All variations
- `all.json` (47MB) - Complete database
- `crates.json` (6.6MB) - Cases and contents
- `collections.json` (1.3MB) - Collections
- `stickers.json` (15.2MB) - All stickers

**Doppler Phase Mappings:**
```javascript
415: "Ruby"
416: "Sapphire"
417: "Black Pearl"
418-421: "Phase 1-4" (Doppler)
568: "Emerald"
569-572: "Phase 1-4" (Gamma Doppler)
1119-1123: Glock-18 Gamma Doppler phases
```

### 3. SkinVault Repository (`/var/www/skinvault-ts`)
**Type:** React + TypeScript (Frontend Only, localStorage)
**Key Finding:** Clean TypeScript patterns and Steam fee calculation

**Valuable Features Found:**
- ✅ Steam fee calculation (scales 10-13.05% based on price)
- ✅ Multi-level caching (5 min items, 24h nameID)
- ✅ Price history tracking with timestamps
- ✅ Investment analytics (best/worst performers)
- ✅ Auto-refresh with configurable intervals
- ✅ Profit alerts system
- ✅ Export/Import functionality
- ✅ Search with debouncing
- ✅ Clean TypeScript interfaces

**Steam Fee Formula:**
```javascript
// Fee scales from 10% to 13.05% based on price ($0.20 - $1800)
const minPrice = 0.2;
const maxPrice = 1800;
const minFee = 0.10;
const maxFee = 0.1305;

const feePercent = minFee + ((clampedPrice - minPrice) / (maxPrice - minPrice)) * (maxFee - minFee);
const sellerReceives = buyerPrice * (1 - feePercent);
```

### 4. GitHub Research - Additional Repos Found

**CS2InventoryValueTracker** (Atmartushev/CS2InventoryValueTracker)
- Uses SteamWebApi for inventory tracking
- PowerBI visualizations
- 30-day and 90-day price change tracking
- Buy/sell volume analysis

**CS2-tracker** (AnnieCS2/CS2-tracker)
- Discord webhook integration
- CSV export/import
- Automated daily monitoring
- Interactive charts

**SkinsRadar** (Max2772/SkinsRadar)
- Proxy support for bypassing Steam rate limits
- Advanced monitoring features

**awesome-cs2-trading** (redlfox/awesome-cs2-trading)
- Curated list of CS2 trading resources
- Multiple marketplace integrations

---

## Priority Implementation Plan

### Phase 1: CSGO-API Integration (HIGH PRIORITY)
**Value:** Enhance item metadata with accurate float ranges and doppler detection

**Endpoints to Create:**
1. `GET /api/items/float-range/:itemName` - Get min/max float for an item
2. `GET /api/items/doppler-phase/:paintIndex` - Get doppler phase info
3. `GET /api/items/metadata/:itemName` - Get complete item metadata
4. `POST /api/items/sync-database` - Sync from CSGO-API repository

**Implementation Tasks:**
- Download and cache CSGO-API data locally
- Create `game_items_metadata` table with float ranges, doppler phases, rarity data
- Build endpoints to query this data
- Integrate with existing float inspection endpoints

### Phase 2: Portfolio Snapshots & Chart Data (HIGH PRIORITY)
**Value:** Enable portfolio performance visualization over time

**Endpoints to Create:**
1. `POST /api/portfolio/snapshot/create/:userId` - Create portfolio snapshot
2. `GET /api/portfolio/snapshot/history/:userId?granularity=hourly|daily|monthly&period=7d|30d|90d|1y` - Get historical snapshots
3. `GET /api/portfolio/chart/:userId?granularity=daily&days=30` - Get chart-ready data
4. `POST /api/portfolio/snapshot/auto-create` - Scheduled job endpoint

**Database Changes:**
- Already have `portfolio_snapshots` table
- Add `granularity` field (hourly/daily/monthly)
- Add indexes for performance

### Phase 3: Partial Sales & Realized P&L (HIGH PRIORITY)
**Value:** Track partial position exits and calculate realized profits

**Endpoints to Create:**
1. `POST /api/portfolio/sale/partial` - Sell portion of investment
2. `GET /api/portfolio/pnl/:userId?type=realized|unrealized|total` - Get P&L breakdown
3. `POST /api/portfolio/sale/revert/:saleId` - Undo sale transaction

**Database Changes:**
- Update `portfolio_investments` table: Add `original_quantity` field
- Update `portfolio_sales` table: Link to original investment
- Add `quantity_remaining` calculated field

### Phase 4: Price Override & Marketplace Preference (MEDIUM PRIORITY)
**Value:** Handle items without market data and user preferences

**Endpoints to Create:**
1. `PATCH /api/portfolio/investment/:investmentId/price-override` - Set manual price
2. `PATCH /api/portfolio/investment/:investmentId/marketplace-override` - Set preferred marketplace
3. `GET /api/user/settings/:userId` - Get user settings
4. `PATCH /api/user/settings/:userId` - Update marketplace priority

**Database Changes:**
- Add `price_override` field to `portfolio_investments`
- Add `marketplace_override` field to `portfolio_investments`
- Create `user_settings` table with marketplace priority

### Phase 5: Batch Price Updates (MEDIUM PRIORITY)
**Value:** Efficient bulk price updates from external APIs

**Endpoints to Create:**
1. `POST /api/prices/batch-update` - Update prices from CSGOTrader API
2. `POST /api/prices/cleanup` - Remove stale price data
3. `GET /api/prices/sources` - List available price sources

**Implementation:**
- Integrate CSGOTrader API endpoints
- Add `run_id` tracking for atomic updates
- Marketplace-specific batch sizes and timeouts
- Cleanup mechanism for old prices

### Phase 6: Steam Fee Calculation (HIGH PRIORITY)
**Value:** Accurate pricing considering Steam market fees

**Endpoints to Create:**
1. `POST /api/pricing/calculate-fee` - Calculate Steam fee for given price
2. `POST /api/pricing/seller-receives` - Calculate what seller receives

**Implementation:**
- Add utility function for fee calculation
- Integrate into all pricing endpoints
- Support both buyer and seller perspectives

### Phase 7: Discord Webhook Integration (MEDIUM PRIORITY)
**Value:** Real-time notifications for price alerts and portfolio events

**Endpoints to Create:**
1. `POST /api/webhooks/discord/configure/:userId` - Set Discord webhook URL
2. `POST /api/webhooks/discord/test/:userId` - Test webhook
3. `POST /api/webhooks/discord/alerts` - Trigger alerts based on conditions

**Database Changes:**
- Create `user_webhooks` table
- Store webhook URLs, alert thresholds

### Phase 8: Advanced Analytics (LOWER PRIORITY)
**Value:** Deeper insights into portfolio performance

**Endpoints to Create:**
1. `GET /api/analytics/price-changes/:userId?period=24h|7d|30d` - Recent price changes
2. `GET /api/analytics/volatility/:userId` - Portfolio volatility metrics
3. `GET /api/analytics/concentration/:userId` - Concentration risk analysis

---

## Data Sources to Integrate

### CSGOTrader Price API
**Base URL:** `https://prices.csgotrader.app/latest/`

**Endpoints:**
- `/steam.json` - Steam Community Market prices
- `/csfloat.json` - CSFloat Market prices
- `/skinport.json` - Skinport prices
- `/buff163.json` - Buff163 prices

**Price Structure:**
```json
{
  "AK-47 | Redline (Field-Tested)": {
    "price": 15.50,
    "starting_at": { "price": 15.50, "volume": 1234 },
    "highest_order": { "price": 14.20, "volume": 567 },
    "last_24h": 15.30,
    "last_7d": 15.10,
    "last_30d": 14.80,
    "last_90d": 14.50
  }
}
```

### CSGO-API Data
**Base URL:** `https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/`

**Files to Download:**
- `skins.json` - Float ranges, rarity, categories
- `crates.json` - Cases and contents
- `collections.json` - Collections
- `stickers.json` - Sticker database

### Steam Item NameID Mapping
**URL:** `https://raw.githubusercontent.com/somespecialone/steam-item-name-ids/refs/heads/master/data/cs2.json`

**Purpose:** Convert item names to Steam nameID for API calls

---

## Implementation Estimates

| Feature | Priority | Effort | Value |
|---------|----------|--------|-------|
| CSGO-API Integration | HIGH | 4-6 hours | ⭐⭐⭐⭐⭐ |
| Portfolio Snapshots | HIGH | 3-4 hours | ⭐⭐⭐⭐⭐ |
| Partial Sales | HIGH | 2-3 hours | ⭐⭐⭐⭐ |
| Steam Fee Calculation | HIGH | 1-2 hours | ⭐⭐⭐⭐ |
| Price Override System | MEDIUM | 2-3 hours | ⭐⭐⭐ |
| Batch Price Updates | MEDIUM | 3-4 hours | ⭐⭐⭐⭐ |
| Discord Webhooks | MEDIUM | 2-3 hours | ⭐⭐⭐ |
| Advanced Analytics | LOWER | 4-6 hours | ⭐⭐⭐ |

**Total Estimated Effort:** 21-31 hours for all features

---

## Recommended Implementation Order

1. **Start with CSGO-API Integration** - Foundational data that enhances all other features
2. **Add Steam Fee Calculation** - Quick win, improves pricing accuracy immediately
3. **Implement Portfolio Snapshots** - Critical for portfolio visualization
4. **Add Partial Sales** - Completes the investment lifecycle tracking
5. **Batch Price Updates** - Improves data freshness and accuracy
6. **Price Override System** - Handles edge cases and rare items
7. **Discord Webhooks** - Adds engagement and notifications
8. **Advanced Analytics** - Nice-to-have enhancements

---

## Files to Create/Modify

### New Files:
- `/var/www/csfloat-api/lib/csgoapi.js` - CSGO-API data integration
- `/var/www/csfloat-api/lib/steam-fees.js` - Steam fee calculations
- `/var/www/csfloat-api/lib/csgotrader.js` - CSGOTrader API client
- `/var/www/csfloat-api/lib/discord.js` - Discord webhook integration
- `/var/www/csfloat-api/data/` - Directory for cached CSGO-API data

### Modified Files:
- `/var/www/csfloat-api/index.js` - Add new endpoints
- `/var/www/csfloat-api/create_portfolio_tables.sql` - Add new tables/fields

### New Database Tables:
- `game_items_metadata` - CSGO-API data cache
- `user_settings` - User preferences and marketplace priority
- `user_webhooks` - Discord webhook configurations
- `price_updates_log` - Track batch price update runs

---

## Next Steps

1. ✅ Complete research (DONE)
2. ⏳ Implement Phase 1: CSGO-API Integration
3. ⏳ Implement Phase 2: Portfolio Snapshots
4. ⏳ Implement Phase 3: Partial Sales
5. ⏳ Continue with remaining phases

**Expected Timeline:** 1-2 weeks for complete implementation of all high-priority features.
