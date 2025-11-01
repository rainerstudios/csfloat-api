# CSFloat API - Feature Roadmap

Complete roadmap for enhancing the CS2 portfolio tracking and float inspection system.

---

## ✅ Currently Implemented

### Portfolio Management
- ✅ Add/Edit/Delete investments
- ✅ Track purchase price, quantity, marketplace
- ✅ Portfolio statistics (total invested, current value, ROI)
- ✅ Realized vs unrealized profit tracking
- ✅ Record sales (full and partial)
- ✅ Batch operations (add/delete multiple items)
- ✅ Portfolio snapshots and history
- ✅ CSV/JSON export
- ✅ Investment scoring algorithm
- ✅ Float rarity detection
- ✅ Pattern detection (Blue Gems, etc.)
- ✅ Quick Actions API (quick add, quick sell, quick price check)
- ✅ Reverse sales (undo completed sales)

### Steam Integration
- ✅ Fetch Steam inventory
- ✅ Sync inventory to portfolio (auto or manual)
- ✅ Inventory value calculation
- ✅ Better Auth + Steam OAuth
- ✅ Sync all marketable items (cases, stickers, graffiti, music kits)

### Pricing
- ✅ Multi-market pricing (Buff163, Skinport, CSFloat, Steam)
- ✅ Price caching (5 min TTL)
- ✅ Price history tracking
- ✅ Float-based price premium calculation
- ✅ Price change tracking database schema (tables created, endpoints pending)

### Float Inspection
- ✅ Single and bulk float inspection
- ✅ Float ranking (top 1000)
- ✅ Ownership history tracking
- ✅ Sticker detection
- ✅ Pattern seed tracking

---

## 🎯 High Priority (Q1 2025)

### 1. Real-Time Price Alerts
**From:** CS2SkinTracker + User Request

**Status:** 🟡 Partially Complete (Database schema created, endpoints pending)

**Features:**
- [x] ✅ Database schema for price tracking (price_changes, price_alerts, user_notifications)
- [ ] Price drop notifications API (email/Discord/webhook)
- [ ] Price spike alerts API
- [ ] Threshold-based triggers (e.g., alert if price drops 10%)
- [ ] Watch all portfolio items automatically
- [ ] Custom alert conditions
- [ ] Background job to detect price changes

**Implementation:**
```javascript
POST /api/alerts/create
{
  "itemName": "AK-47 | Redline (FT)",
  "alertType": "price_drop",
  "threshold": 10,  // 10% drop
  "notificationMethod": "discord"
}
```

**Database:** ✅ **COMPLETED** (migration 006_price_changes.sql)
```sql
-- Already created:
CREATE TABLE price_changes (...);
CREATE TABLE price_alerts (...);
CREATE TABLE user_notifications (...);
CREATE VIEW recent_price_changes (...);
```

---

### 2. Portfolio Analytics Dashboard
**From:** CS2SkinTracker + SkinWatch

**Features:**
- [ ] Asset allocation breakdown (knives, gloves, weapons, stickers)
- [ ] Risk metrics (concentration risk, volatility)
- [ ] Diversification score
- [ ] Performance comparison vs Steam Market average
- [ ] Best/worst performers
- [ ] Time-weighted returns

**Endpoints:**
```javascript
GET /api/portfolio/analytics/:userId
Response: {
  allocation: {
    knives: { count: 5, value: 5000, percentage: 50 },
    rifles: { count: 20, value: 3000, percentage: 30 }
  },
  risk: {
    concentrationRisk: "High",  // Top 3 items = 80% of portfolio
    volatilityScore: 7.5,
    diversificationScore: 4.2
  },
  performance: {
    bestPerformer: { item: "...", roi: 35.5 },
    worstPerformer: { item: "...", roi: -12.3 }
  }
}
```

---

### 3. Inventory CSV Export with Pricing
**From:** imlokesh/csgo-inventory-csv

**Features:**
- [ ] Export Steam inventory to CSV with current prices
- [ ] Include float values, stickers, patterns
- [ ] Customizable columns
- [ ] Excel-compatible formatting

**Endpoint:**
```javascript
GET /api/steam/inventory/:steamId/export?format=csv&include=floats,prices,stickers

CSV Output:
Name,Wear,Float,Pattern,Price (Buff),Price (Steam),Stickers,Tradable
"AK-47 | Redline (FT)","Field-Tested",0.25,321,$15.50,$18.00,"Sticker1, Sticker2",true
```

---

### 4. Quick Actions API ✅ **COMPLETED**
**From:** CS2SkinTracker

**Features:**
- [x] ✅ Fast add (minimal required fields, up to 20 items)
- [x] ✅ Quick sell (auto-calculates profit/ROI)
- [x] ✅ Rapid price check (batch lookup up to 50 items)
- [ ] Bulk update marketplace

**Endpoints:** ✅ **IMPLEMENTED**
```javascript
POST /api/portfolio/quick/add
{
  "userId": "steam_12345",
  "itemNames": ["AK-47 | Redline (FT)", "AWP | Asiimov (FT)"],
  "marketplace": "Steam"  // Auto-fetch current prices as purchase prices
}

POST /api/portfolio/quick/sell/:investmentId
{
  "salePrice": 18.50  // Everything else auto-calculated (profit, ROI)
}

POST /api/portfolio/quick/price-check
{
  "itemNames": ["AK-47 | Redline (FT)", ...]  // Up to 50 items
}
```

---

### 5. Reverse Sales (Undo) ✅ **COMPLETED**
**From:** CS2SkinTracker

**Features:**
- [x] ✅ Undo completed sales
- [x] ✅ Restore item to portfolio (marks investment as unsold)
- [x] ✅ Delete sale record
- [ ] Audit trail of reversals (future enhancement)

**Endpoint:** ✅ **IMPLEMENTED**
```javascript
POST /api/portfolio/sale/reverse/:saleId
Response: {
  "success": true,
  "message": "Sale reversed successfully",
  "restoredInvestment": {
    "id": 123,
    "itemName": "AK-47 | Redline (FT)",
    "quantity": 1,
    "originalPrice": 15.00
  }
}
```

---

## 🚀 Medium Priority (Q2 2025)

### 6. Portfolio Leaderboard
**From:** KianAnd19/steam-inventory

**Features:**
- [ ] Public rankings by portfolio value
- [ ] Profit leaderboard
- [ ] ROI rankings
- [ ] Opt-in privacy settings
- [ ] Username display (anonymous option)

**Endpoints:**
```javascript
GET /api/leaderboard/value?limit=100
GET /api/leaderboard/profit?timeframe=30d
GET /api/leaderboard/roi

PUT /api/user/settings
{
  "optInLeaderboard": true,
  "displayName": "TraderPro123"
}
```

---

### 7. Item Comparison Tool
**From:** Multiple sources

**Features:**
- [ ] Side-by-side comparison of similar items
- [ ] Float vs price correlation
- [ ] Pattern value comparison
- [ ] Sticker value impact
- [ ] Historical price trends comparison

**Endpoint:**
```javascript
POST /api/compare/items
{
  "items": [
    "AK-47 | Redline (FT)",
    "AK-47 | Bloodsport (FT)"
  ]
}

Response: {
  comparison: [
    {
      name: "AK-47 | Redline (FT)",
      avgPrice: 15.50,
      avgFloat: 0.25,
      liquidity: "High",
      priceVolatility: 0.15
    },
    ...
  ]
}
```

---

### 8. Trade-Up Contract Calculator
**From:** cs2-inventory-simulator

**Features:**
- [ ] Calculate expected value of trade-up
- [ ] ROI prediction
- [ ] Outcome probabilities
- [ ] Suggest profitable trade-ups

**Endpoint:**
```javascript
POST /api/tradeup/calculate
{
  "inputItems": [
    { "name": "Item1", "float": 0.15, "price": 5.00 },
    // ... 10 items total
  ]
}

Response: {
  inputCost: 50.00,
  expectedValue: 65.50,
  roi: 31.0,
  outcomes: [
    { item: "AWP | ...", probability: 0.1, value: 100.00 },
    { item: "AK-47 | ...", probability: 0.2, value: 45.00 }
  ]
}
```

---

### 9. Float Ranking & Database
**From:** Multiple sources

**Features:**
- [ ] Global float rankings (e.g., "#42 lowest AK Redline FT")
- [ ] Pattern rankings
- [ ] Show user's rank in global database
- [ ] Historical float trends

**Endpoint:**
```javascript
GET /api/float/rank/:defindex/:paintindex/:floatValue
Response: {
  globalRank: 42,
  totalTracked: 15230,
  percentile: 0.27,
  rarity: "Top 1%"
}
```

---

### 10. Sticker Value Calculator
**From:** cs2-inventory-simulator

**Features:**
- [ ] Calculate total sticker value
- [ ] Overpay percentage based on stickers
- [ ] Rare sticker detection
- [ ] Position value (craft #1, #2, etc.)

**Endpoint:**
```javascript
POST /api/stickers/value
{
  "baseItem": "AK-47 | Redline (FT)",
  "stickers": [
    { "name": "Katowice 2014 iBUYPOWER (Holo)", "position": 1 },
    { "name": "...", "position": 2 }
  ]
}

Response: {
  baseValue: 15.00,
  stickerValue: 850.00,
  totalValue: 865.00,
  overpayPercentage: 5666.67
}
```

---

## 💎 Advanced Features (Q3-Q4 2025)

### 11. Pattern Recognition & Detection
**From:** Multiple sources

**Features:**
- [ ] Blue Gem detection (Case Hardened)
- [ ] Fire & Ice detection (Marble Fade)
- [ ] Max Blue/Pink detection
- [ ] Pattern tier rankings
- [ ] Automatic value multiplier

**Database:**
```javascript
const valuablePatterns = {
  "AK-47 | Case Hardened": {
    blueGems: [661, 670, 151, 321],
    tier1: [/* patterns */],
    tier2: [/* patterns */],
    multipliers: { blueGem: 10.0, tier1: 3.0 }
  },
  "Karambit | Marble Fade": {
    fireAndIce: [412, 413, 856],
    maxBlue: [/* patterns */]
  }
}
```

---

### 12. Market Arbitrage Detector
**From:** Original feature

**Features:**
- [ ] Find price differences across markets
- [ ] Calculate profit after fees
- [ ] Real-time opportunities
- [ ] Auto-notification of profitable flips

**Endpoint:**
```javascript
GET /api/arbitrage/opportunities?minProfit=5&market1=buff163&market2=steam

Response: {
  opportunities: [
    {
      item: "AWP | Asiimov (FT)",
      buyFrom: "Buff163",
      buyPrice: 40.00,
      sellTo: "Steam",
      sellPrice: 48.00,
      profit: 6.50,  // After fees
      profitPercent: 16.25
    }
  ]
}
```

---

### 13. Investment Recommendations
**From:** Original feature

**Features:**
- [ ] AI-powered buy recommendations
- [ ] Trending items
- [ ] Undervalued items detection
- [ ] Risk-adjusted suggestions
- [ ] Historical performance analysis

**Endpoint:**
```javascript
GET /api/recommendations/buy?budget=100&risk=medium

Response: {
  recommendations: [
    {
      item: "M4A1-S | Printstream (FT)",
      currentPrice: 25.00,
      confidence: 0.85,
      expectedROI: 15.5,
      timeframe: "3 months",
      reasoning: "Price trend upward, low supply, major tournament coming"
    }
  ]
}
```

---

### 14. Portfolio Templates
**From:** Original feature

**Features:**
- [ ] Pre-made portfolio allocations
- [ ] "Safe" portfolio (low volatility)
- [ ] "Aggressive" portfolio (high risk/reward)
- [ ] One-click portfolio creation

**Templates:**
```javascript
{
  "safe": {
    "knives": 0.40,
    "gloves": 0.30,
    "redSkins": 0.20,
    "stickers": 0.10
  },
  "aggressive": {
    "newCase": 0.50,
    "rareSkins": 0.30,
    "tradeUps": 0.20
  }
}
```

---

### 15. Social Features
**From:** Original feature

**Features:**
- [ ] Share portfolio publicly
- [ ] Follow other traders
- [ ] Copy trades
- [ ] Community discussions
- [ ] Trading tips & strategies

---

### 16. Mobile App Support
**From:** Market demand

**Features:**
- [ ] Push notifications
- [ ] Quick price checks
- [ ] Mobile-optimized endpoints
- [ ] QR code login
- [ ] Offline mode

---

### 17. Tax Reporting
**From:** User request

**Features:**
- [ ] Capital gains/loss calculation
- [ ] Export for tax software
- [ ] Yearly summaries
- [ ] Country-specific formats (US, EU, etc.)

**Endpoint:**
```javascript
GET /api/portfolio/tax-report/:userId?year=2024

CSV Output:
Date,Item,Type,Amount,Cost Basis,Proceeds,Gain/Loss
2024-01-15,"AK-47 | Redline",Sale,1,$15.00,$18.00,$3.00
```

---

### 18. AI Chat Assistant
**From:** Modern trend

**Features:**
- [ ] Natural language queries
- [ ] Portfolio analysis via chat
- [ ] Price predictions
- [ ] Investment advice

**Example:**
```
User: "What's my best performing item this month?"
AI: "Your best performer is AWP | Asiimov (FT) with a 25.5% ROI ($10.50 profit)"

User: "Should I sell my Karambit now?"
AI: "Based on market trends, I'd recommend holding. Knife prices typically rise before major tournaments."
```

---

## 🔧 Technical Improvements

### Code Quality
- [ ] Add TypeScript
- [ ] Implement Zod validation
- [ ] Add comprehensive error handling
- [ ] Add request/response logging
- [ ] Add Sentry error tracking
- [ ] Add API rate limiting per user
- [ ] Add request caching (Redis)

### Testing
- [ ] Unit tests (80% coverage)
- [ ] Integration tests
- [ ] E2E tests
- [ ] Performance testing
- [ ] Load testing

### Documentation
- [ ] OpenAPI/Swagger docs
- [ ] Auto-generated API reference
- [ ] Code examples for all endpoints
- [ ] Postman collection

### Security
- [ ] Add authentication to all endpoints
- [ ] Add authorization checks
- [ ] Add SQL injection protection
- [ ] Add XSS protection
- [ ] Add CSRF tokens
- [ ] Add API key rotation
- [ ] Add audit logging

### Performance
- [ ] Database query optimization
- [ ] Add database indexes
- [ ] Add connection pooling
- [ ] Add query result caching
- [ ] Add CDN for static assets
- [ ] Add compression (gzip)

### Monitoring
- [ ] Health check endpoint
- [ ] Metrics endpoint (Prometheus)
- [ ] Performance monitoring (New Relic)
- [ ] Error tracking (Sentry)
- [ ] User analytics
- [ ] API usage analytics

---

## 📊 Priority Matrix

| Feature | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Price Alerts | High | Low | **P0** |
| Analytics Dashboard | High | Medium | **P0** |
| CSV Export | High | Low | **P0** |
| Quick Actions | Medium | Low | **P1** |
| Leaderboard | Medium | Medium | **P1** |
| Trade-Up Calculator | High | High | **P1** |
| Pattern Detection | High | High | **P2** |
| Arbitrage Detector | Medium | Medium | **P2** |
| Tax Reporting | Medium | High | **P2** |
| AI Assistant | Low | Very High | **P3** |

---

## 🎯 Next Sprint Goals

**Sprint Duration:** 2 weeks

### Must Have:
1. ✅ Fix Steam inventory sync bugs
2. ✅ Add user_steam_id to manual add
3. 🟡 Price alerts system (database ✅, endpoints pending)
4. ⏳ Portfolio analytics dashboard

### Should Have:
1. CSV export with pricing
2. ✅ Quick actions API
3. ✅ Reverse sales functionality

### Nice to Have:
1. Leaderboard system
2. Item comparison tool

---

## 📝 Feature Request Process

**How to add new features:**
1. Create GitHub issue
2. Label with feature/enhancement
3. Discuss priority
4. Assign to sprint
5. Implement & test
6. Document & deploy

---

## 🔄 Version History

- **v1.0.0** - Initial portfolio tracking
- **v1.1.0** - Steam integration added
- **v1.2.0** - Better Auth integration
- **v1.3.0** - Multi-market pricing
- **v1.4.0** - Investment scoring
- **v1.5.0** - Quick Actions, Reverse Sales, Price Tracking Infrastructure (current)
- **v1.6.0** - Price alerts & notifications (planned)
- **v2.0.0** - Analytics dashboard (planned)

---

Would you like me to implement any of these features? Let me know which ones are highest priority!
