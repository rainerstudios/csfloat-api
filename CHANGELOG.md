# Changelog

All notable changes to the CS2 Float API will be documented in this file.

## [1.4.1] - 2025-11-01

### Fixed
- **Steam Inventory Sync**: Fixed item names saving incorrectly
  - Changed from `item.name` to `item.market_name`
  - Items now save as "AK-47 | Redline (Field-Tested)" instead of just "AK-47"
  - Location: `index.js:4119`

- **Steam Inventory Sync**: Fixed price fetching from cache
  - Changed from `cachedPrice?.price` to `cachedPrice?.lowestPrice`
  - Prices now properly retrieved from cache structure
  - Location: `index.js:4107`

- **Manual Portfolio Add**: Added missing user_steam_id field
  - Items added manually now properly associated with Steam ID
  - Fixes issue where manually added items wouldn't appear in portfolio
  - Location: `index.js:1266-1280`

- **Batch Portfolio Add**: Added missing user_steam_id field
  - Batch added items now properly associated with Steam ID
  - Location: `index.js:2141-2167`

### Added
- **Testing Suite**: Complete test coverage for all portfolio endpoints
  - `test-portfolio-api.js`: Tests 14 portfolio endpoints
  - `test-steam-endpoints.js`: Tests Steam inventory endpoints
  - All tests passing ✅

- **Feature Roadmap**: Comprehensive roadmap with 18 major features
  - `ROADMAP.md`: Based on analysis of CS2SkinTracker and similar projects
  - Organized by priority (P0-P3) and timeline (Q1-Q4 2025)
  - Includes: Price alerts, analytics dashboard, CSV export, leaderboards, and more

### Improved
- **Steam Inventory Sync**: Added duplicate detection
  - Prevents adding items that already exist in portfolio
  - Auto-skips non-weapon items without wear values

- **Error Logging**: Enhanced logging for inventory sync operations
  - Better visibility into sync process
  - Detailed error messages for failed items

## [1.4.0] - 2025-10-XX

### Added
- Investment scoring algorithm
- Float rarity detection
- Pattern detection (Blue Gems, etc.)
- Better Auth + Steam OAuth integration
- Multi-market pricing (Buff163, Skinport, CSFloat, Steam)

## [1.3.0] - 2025-09-XX

### Added
- Steam inventory integration
- Inventory value calculation
- Portfolio snapshots and history
- CSV/JSON export

## [1.2.0] - 2025-08-XX

### Added
- Better Auth integration
- Realized vs unrealized profit tracking
- Record sales (full and partial)
- Batch operations

## [1.1.0] - 2025-07-XX

### Added
- Float inspection (single and bulk)
- Float ranking (top 1000)
- Ownership history tracking
- Sticker detection

## [1.0.0] - 2025-06-XX

### Added
- Initial portfolio tracking
- Add/Edit/Delete investments
- Track purchase price, quantity, marketplace
- Portfolio statistics (total invested, current value, ROI)
- Price caching (5 min TTL)

---

## Testing Results (2025-11-01)

All 14 portfolio endpoints tested and verified working:

✅ POST /api/portfolio/add
✅ GET /api/portfolio/:userId
✅ GET /api/portfolio/stats/:userId
✅ POST /api/portfolio/sale
✅ DELETE /api/portfolio/delete/:investmentId
✅ GET /api/portfolio/allocation/:userId
✅ GET /api/portfolio/health/:userId
✅ POST /api/portfolio/batch/add
✅ GET /api/portfolio/activity/:userId
✅ GET /api/portfolio/export/:userId
✅ POST /api/portfolio/snapshot/create/:userId
✅ GET /api/portfolio/snapshot/history/:userId
✅ GET /api/portfolio/chart/:userId
✅ GET /api/portfolio/pnl/:userId

---

## Known Issues

### Low Priority
- Price cache is empty for most items (requires population)
- Authentication not enforced on all endpoints (security improvement needed)

### Future Improvements
See `ROADMAP.md` for planned features and improvements.

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality (backwards compatible)
- **PATCH** version for bug fixes (backwards compatible)
