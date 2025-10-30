# CSFloat Trade Reversal Protection - API Research & Implementation Plan

## Executive Summary

Based on recent Reddit discussions in r/GlobalOffensiveTrade and r/csgomarketforum, there's a critical issue with CSFloat's trade reversal system where sellers can cancel trades during the 7-day window with minimal penalties. This creates an asymmetric risk where **sellers have zero risk** while **buyers gamble**.

**Key Problem:** Sellers accept low offers hoping prices drop (profit) or wait for prices to rise and then reverse the trade, eating the small penalty and relisting at higher prices.

## Current API Capabilities (Already Implemented)

Our API already has foundational features:

✅ **Ownership History Tracking** (`/api/ownership-history/:floatId`)
- Tracks item ownership changes over time
- Shows Steam IDs and dates of ownership transfers
- Database: `history` table with floatid, steamid, created_at, price

✅ **Basic Trade Risk Calculation**
- `calculateTradeRisk()` function in index.js:1157
- Detects if item is in 7-day reversal window
- Shows days remaining until "safe"
- Risk levels: HIGH (0-7 days), SAFE (>7 days)

✅ **Multi-Market Price Comparison**
- Real-time pricing from Buff163, Skinport, CS.Money, CSFloat, Steam Market
- Price caching with 5-minute TTL (handles 300+ concurrent users)
- Database: `price_cache`, `item_prices`, `recent_sales`

✅ **Float Rarity Analysis**
- Statistical analysis of float distributions
- Percentile rankings
- Database queries on massive `items` table

## What's Missing - Critical Gaps

### 1. **Seller Reputation System** ❌
Currently we have NO way to:
- Track seller behavior across multiple transactions
- Identify repeat offenders who reverse trades
- Score sellers by account age, trade count, reversal history
- Warn buyers about high-risk sellers

### 2. **Price Volatility Detection** ❌
No tracking of:
- Rapid price swings (>10% in 24h) that trigger reversals
- Price trend analysis that predicts reversal risk
- Correlation between volatility and reversal rates

### 3. **Listing Behavior Analysis** ❌
Can't detect:
- Items being listed/delisted repeatedly (reversal pattern)
- Sellers who list same item multiple times after cancellations
- "Test listings" where sellers accept offers but never deliver

### 4. **Marketplace Safety Scoring** ❌
No systematic comparison of:
- Reversal rates by marketplace (CSFloat vs Buff vs Skinport)
- Penalty systems effectiveness
- Instant delivery vs 7-day hold risks

### 5. **Trade Hold Timeline Visualization** ❌
Basic calculation exists but no:
- Visual countdown for danger zone
- Historical tracking of when reversals typically occur (day 2-4)
- Notification system for when items exit danger zone

---

## Proposed New Features & API Endpoints

## Feature 1: Seller Risk Scoring System

### New Database Tables Needed

```sql
-- Table: seller_profiles
-- Tracks seller reputation and behavior
CREATE TABLE seller_profiles (
    steam_id BIGINT PRIMARY KEY,

    -- Basic Stats
    total_listings INTEGER DEFAULT 0,
    successful_trades INTEGER DEFAULT 0,
    reversed_trades INTEGER DEFAULT 0,

    -- Calculated Metrics
    reversal_rate DECIMAL(5,2) DEFAULT 0.00, -- Percentage
    account_age_days INTEGER,
    steam_level INTEGER,

    -- Risk Score (0-100, lower = riskier)
    risk_score INTEGER DEFAULT 50,
    risk_tier VARCHAR(20), -- 'HIGH', 'MEDIUM', 'LOW', 'TRUSTED'

    -- Flags
    is_blacklisted BOOLEAN DEFAULT FALSE,
    blacklist_reason TEXT,

    -- Timestamps
    first_seen_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW(),
    last_updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_seller_risk ON seller_profiles(risk_score);
CREATE INDEX idx_seller_blacklist ON seller_profiles(is_blacklisted);

-- Table: trade_events
-- Tracks individual trade lifecycle events
CREATE TABLE trade_events (
    event_id SERIAL PRIMARY KEY,
    floatid BIGINT NOT NULL,
    asset_id BIGINT NOT NULL,

    -- Parties
    seller_steam_id BIGINT,
    buyer_steam_id BIGINT,

    -- Event Details
    event_type VARCHAR(50), -- 'LISTED', 'OFFER_ACCEPTED', 'TRADE_COMPLETED', 'TRADE_REVERSED', 'DELISTED'
    event_timestamp TIMESTAMP DEFAULT NOW(),

    -- Pricing
    listing_price INTEGER, -- Price in cents
    accepted_offer_price INTEGER,

    -- Context
    days_since_last_trade INTEGER,
    price_change_24h DECIMAL(5,2), -- Percentage change

    -- Metadata
    marketplace VARCHAR(50) DEFAULT 'csfloat', -- 'csfloat', 'buff163', 'skinport', etc.
    notes TEXT
);

CREATE INDEX idx_trade_floatid ON trade_events(floatid);
CREATE INDEX idx_trade_seller ON trade_events(seller_steam_id);
CREATE INDEX idx_trade_type ON trade_events(event_type);
CREATE INDEX idx_trade_timestamp ON trade_events(event_timestamp);

-- Table: reversal_incidents
-- Specifically tracks trade reversals for analysis
CREATE TABLE reversal_incidents (
    incident_id SERIAL PRIMARY KEY,
    floatid BIGINT NOT NULL,
    asset_id BIGINT NOT NULL,

    -- Seller Info
    seller_steam_id BIGINT NOT NULL,
    seller_account_age_days INTEGER,
    seller_previous_trades INTEGER,

    -- Trade Details
    accepted_price INTEGER, -- Price they accepted
    relisted_price INTEGER, -- Price they relisted at (if applicable)
    reversal_day INTEGER, -- Which day of 7-day window (1-7)

    -- Market Context
    price_change_since_accepted DECIMAL(5,2), -- % change
    market_volatility_24h DECIMAL(5,2), -- % volatility

    -- Timestamps
    listing_date TIMESTAMP,
    acceptance_date TIMESTAMP,
    reversal_date TIMESTAMP NOT NULL,

    -- Outcome
    penalty_paid INTEGER, -- CSFloat penalty in cents
    was_relisted BOOLEAN DEFAULT FALSE,
    relisted_date TIMESTAMP,

    FOREIGN KEY (seller_steam_id) REFERENCES seller_profiles(steam_id)
);

CREATE INDEX idx_reversal_seller ON reversal_incidents(seller_steam_id);
CREATE INDEX idx_reversal_date ON reversal_incidents(reversal_date);
CREATE INDEX idx_reversal_day ON reversal_incidents(reversal_day);

-- Table: price_volatility
-- Tracks price movements to predict reversal risk
CREATE TABLE price_volatility (
    volatility_id SERIAL PRIMARY KEY,
    market_hash_name VARCHAR(255) NOT NULL,

    -- Time Windows
    volatility_1h DECIMAL(5,2),
    volatility_6h DECIMAL(5,2),
    volatility_24h DECIMAL(5,2),
    volatility_7d DECIMAL(5,2),

    -- Price Points
    current_price DECIMAL(10,2),
    price_1h_ago DECIMAL(10,2),
    price_24h_ago DECIMAL(10,2),
    price_7d_ago DECIMAL(10,2),

    -- Trend Analysis
    trend VARCHAR(20), -- 'RISING_FAST', 'RISING', 'STABLE', 'FALLING', 'FALLING_FAST'
    reversal_risk_level VARCHAR(20), -- 'EXTREME', 'HIGH', 'MODERATE', 'LOW'

    -- Timestamps
    recorded_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_volatility_item ON price_volatility(market_hash_name);
CREATE INDEX idx_volatility_risk ON price_volatility(reversal_risk_level);
CREATE INDEX idx_volatility_recorded ON price_volatility(recorded_at);

-- Table: marketplace_safety_metrics
-- Aggregated safety data by marketplace
CREATE TABLE marketplace_safety_metrics (
    marketplace VARCHAR(50) PRIMARY KEY,

    -- Trade Statistics (last 30 days)
    total_trades INTEGER DEFAULT 0,
    successful_trades INTEGER DEFAULT 0,
    reversed_trades INTEGER DEFAULT 0,
    reversal_rate DECIMAL(5,2) DEFAULT 0.00,

    -- Safety Features
    has_trade_hold BOOLEAN DEFAULT TRUE,
    trade_hold_days INTEGER DEFAULT 7,
    has_instant_delivery BOOLEAN DEFAULT FALSE,
    has_escrow BOOLEAN DEFAULT FALSE,
    has_bot_middleman BOOLEAN DEFAULT FALSE,

    -- Penalties
    reversal_penalty_amount INTEGER, -- In cents
    has_permanent_ban BOOLEAN DEFAULT FALSE,
    penalty_severity VARCHAR(20), -- 'NONE', 'LOW', 'MEDIUM', 'HIGH'

    -- Calculated Safety Score (0-100, higher = safer)
    safety_score INTEGER DEFAULT 50,
    safety_tier VARCHAR(20), -- 'UNSAFE', 'RISKY', 'MODERATE', 'SAFE', 'VERY_SAFE'

    -- Additional Context
    average_listing_count INTEGER,
    average_item_price DECIMAL(10,2),

    -- Timestamps
    last_updated_at TIMESTAMP DEFAULT NOW()
);
```

### New API Endpoints

#### 1. **GET /api/seller-risk/:steamId**
Get comprehensive seller risk profile

**Response:**
```json
{
  "success": true,
  "steamId": "76561198012345678",
  "riskProfile": {
    "riskScore": 35,
    "riskTier": "HIGH",
    "riskFactors": [
      "New account (23 days old)",
      "Few completed trades (8)",
      "High reversal rate (25%)",
      "2 reversals in last 30 days"
    ]
  },
  "tradeStatistics": {
    "totalListings": 32,
    "successfulTrades": 8,
    "reversedTrades": 2,
    "reversalRate": "25.00%",
    "averageDaysToComplete": 4.2
  },
  "accountInfo": {
    "accountAgeDays": 23,
    "steamLevel": 3,
    "firstSeenDate": "2025-10-04T10:30:00Z",
    "lastActivityDate": "2025-10-27T14:22:00Z"
  },
  "recentActivity": [
    {
      "floatId": "123456789",
      "eventType": "TRADE_REVERSED",
      "date": "2025-10-25T12:00:00Z",
      "priceChangeAtReversal": "+18%"
    }
  ],
  "recommendation": {
    "shouldBuy": false,
    "reason": "High-risk seller with recent reversals during price volatility",
    "alternatives": "Consider waiting 7 days or buying from more established seller"
  }
}
```

#### 2. **GET /api/trade-protection/:floatId**
Enhanced trade protection with seller risk analysis

**Response:**
```json
{
  "success": true,
  "floatId": "987654321",
  "tradeRisk": {
    "overallRisk": "EXTREME",
    "riskScore": 15,
    "canBeReversed": true,
    "daysRemaining": 4,
    "reversibleUntil": "2025-10-31T10:00:00Z",
    "dangerZoneProgress": "57%"
  },
  "sellerAnalysis": {
    "steamId": "76561198012345678",
    "riskScore": 35,
    "riskTier": "HIGH",
    "totalTrades": 8,
    "reversalHistory": 2,
    "accountAgeDays": 23,
    "redFlags": [
      "New Steam account (<30 days)",
      "Multiple reversals in last 30 days",
      "Currently in volatile market period"
    ]
  },
  "priceContext": {
    "currentPrice": 850.00,
    "price24hAgo": 720.00,
    "priceChange24h": "+18.06%",
    "volatility24h": "HIGH",
    "reversalRiskFromVolatility": "EXTREME"
  },
  "recommendations": {
    "action": "WAIT",
    "reasoning": [
      "Item in 7-day reversal window (4 days remaining)",
      "High-risk seller (score: 35/100)",
      "Extreme price volatility (+18% in 24h)",
      "Seller has 2 reversals in last 30 days"
    ],
    "alternatives": [
      {
        "marketplace": "Skinport",
        "price": 865.00,
        "priceDifference": "+$15",
        "safetyScore": 95,
        "features": ["Instant delivery", "No reversals possible"]
      },
      {
        "marketplace": "Buff163",
        "price": 855.00,
        "priceDifference": "+$5",
        "safetyScore": 70,
        "features": ["Reversal penalties", "Seller bans"]
      }
    ]
  },
  "historicalData": {
    "ownershipHistory": [
      {
        "steamId": "76561198012345678",
        "ownedSince": "2025-10-23T10:00:00Z",
        "daysSinceAcquired": 4
      }
    ],
    "listingHistory": [
      {
        "listedDate": "2025-10-23T10:30:00Z",
        "delistedDate": null,
        "listingPrice": 850.00,
        "status": "ACTIVE"
      }
    ]
  }
}
```

#### 3. **GET /api/price-volatility/:marketHashName**
Track price volatility to predict reversal risk

**Response:**
```json
{
  "success": true,
  "itemName": "Butterfly Knife | Fade (Factory New)",
  "currentPrice": 850.00,
  "volatility": {
    "last1h": "+2.3%",
    "last6h": "+8.5%",
    "last24h": "+18.1%",
    "last7d": "+12.4%"
  },
  "trend": {
    "direction": "RISING_FAST",
    "reversalRisk": "EXTREME",
    "reasoning": "Price increased >15% in 24h - high reversal window"
  },
  "priceHistory": {
    "current": 850.00,
    "1hAgo": 830.00,
    "6hAgo": 783.00,
    "24hAgo": 720.00,
    "7dAgo": 756.00
  },
  "reversalStatistics": {
    "reversalsLast7d": 12,
    "reversalsDuringVolatility": 9,
    "correlationToVolatility": "75%"
  },
  "recommendation": {
    "buyNow": false,
    "reason": "Extreme volatility increases reversal risk by 400%",
    "safestTime": "Wait for price to stabilize for 2-3 days"
  }
}
```

#### 4. **GET /api/marketplace-safety**
Compare marketplace safety ratings

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-10-27T15:00:00Z",
  "marketplaces": [
    {
      "name": "Skinport",
      "safetyScore": 95,
      "safetyTier": "VERY_SAFE",
      "features": {
        "instantDelivery": true,
        "escrow": true,
        "tradeHold": false,
        "botMiddleman": false
      },
      "statistics30d": {
        "totalTrades": 15420,
        "reversedTrades": 0,
        "reversalRate": "0.00%"
      },
      "penalties": {
        "hasReversalPenalty": false,
        "reason": "No reversals possible - instant delivery"
      },
      "pricing": {
        "averagePremium": "+3.2%",
        "priceVsCSFloat": "+$15 average"
      }
    },
    {
      "name": "Buff163",
      "safetyScore": 70,
      "safetyTier": "MODERATE",
      "features": {
        "instantDelivery": false,
        "escrow": true,
        "tradeHold": true,
        "tradeHoldDays": 7,
        "botMiddleman": false
      },
      "statistics30d": {
        "totalTrades": 48230,
        "reversedTrades": 482,
        "reversalRate": "1.00%"
      },
      "penalties": {
        "hasReversalPenalty": true,
        "penaltyAmount": "Market price difference + 10% of sale",
        "permanentBan": false,
        "canPayToUnban": true,
        "effectiveness": "MEDIUM"
      }
    },
    {
      "name": "CSFloat",
      "safetyScore": 40,
      "safetyTier": "RISKY",
      "features": {
        "instantDelivery": false,
        "escrow": false,
        "tradeHold": true,
        "tradeHoldDays": 7,
        "botMiddleman": false
      },
      "statistics30d": {
        "totalTrades": 32180,
        "reversedTrades": 2574,
        "reversalRate": "8.00%"
      },
      "penalties": {
        "hasReversalPenalty": true,
        "penaltyAmount": "$5-15 flat fee",
        "permanentBan": false,
        "effectiveness": "LOW",
        "note": "Penalty too low to deter bad actors"
      },
      "knownIssues": [
        "7-day reversal window with minimal penalties",
        "No seller reputation system",
        "High reversal rate during price volatility",
        "New accounts can list high-value items"
      ]
    },
    {
      "name": "SkinBaron",
      "safetyScore": 92,
      "safetyTier": "VERY_SAFE",
      "features": {
        "instantDelivery": true,
        "escrow": true,
        "tradeHold": false,
        "botMiddleman": true
      },
      "statistics30d": {
        "totalTrades": 8920,
        "reversedTrades": 0,
        "reversalRate": "0.00%"
      },
      "penalties": {
        "hasReversalPenalty": false,
        "reason": "Bot middleman prevents reversals"
      }
    }
  ],
  "recommendations": {
    "safest": ["Skinport", "SkinBaron"],
    "moderate": ["Buff163"],
    "risky": ["CSFloat"],
    "avoid": []
  }
}
```

#### 5. **POST /api/report-reversal**
Crowdsource reversal data from users

**Request:**
```json
{
  "floatId": "123456789",
  "steamId": "76561198012345678",
  "reversalDate": "2025-10-27T12:00:00Z",
  "acceptedPrice": 720.00,
  "currentPrice": 850.00,
  "priceChangePercent": 18.06,
  "dayOfReversal": 4,
  "marketplace": "csfloat",
  "proofUrl": "https://csfloat.com/...",
  "notes": "Seller reversed after 18% price increase"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Reversal incident recorded",
  "incidentId": 4821,
  "sellerProfile": {
    "steamId": "76561198012345678",
    "previousReversals": 2,
    "newReversalCount": 3,
    "riskScore": 28,
    "newRiskTier": "EXTREME"
  },
  "thanksForReporting": true
}
```

#### 6. **GET /api/reversal-analytics**
System-wide reversal statistics and trends

**Response:**
```json
{
  "success": true,
  "period": "last_30_days",
  "globalStatistics": {
    "totalReversals": 2847,
    "totalTrades": 35620,
    "reversalRate": "7.99%",
    "trendVsLastMonth": "-0.5%"
  },
  "reversalPatterns": {
    "byDayOfWeek": {
      "monday": 412,
      "tuesday": 398,
      "wednesday": 421,
      "thursday": 445,
      "friday": 512,
      "saturday": 387,
      "sunday": 272
    },
    "byDayOfTradeHold": {
      "day1": 234,
      "day2": 512,
      "day3": 687,
      "day4": 598,
      "day5": 421,
      "day6": 287,
      "day7": 108
    },
    "peakReversalDay": "day3",
    "peakReversalTime": "Days 2-4 of 7-day window"
  },
  "priceCorrelation": {
    "reversalsDuringRisingPrices": 2145,
    "reversalsDuringFallingPrices": 402,
    "reversalsDuringStablePrices": 300,
    "volatilityCorrelation": "75.3%"
  },
  "sellerProfiles": {
    "uniqueSellers": 1842,
    "repeatOffenders": 312,
    "sellersWithMultipleReversals": [
      {
        "steamId": "76561198012345678",
        "reversalCount": 8,
        "last30Days": true
      }
    ]
  },
  "marketplaceBreakdown": {
    "csfloat": {
      "reversals": 2574,
      "rate": "8.00%"
    },
    "buff163": {
      "reversals": 248,
      "rate": "0.51%"
    },
    "skinport": {
      "reversals": 0,
      "rate": "0.00%"
    }
  }
}
```

---

## Feature 2: Advanced Listing Behavior Tracking

### New Database Tables

```sql
-- Table: listing_behavior
-- Tracks listing/delisting patterns to detect manipulation
CREATE TABLE listing_behavior (
    behavior_id SERIAL PRIMARY KEY,
    floatid BIGINT NOT NULL,
    steam_id BIGINT NOT NULL,

    -- Listing Stats
    total_listings INTEGER DEFAULT 1,
    total_delistings INTEGER DEFAULT 0,
    average_listing_duration_hours DECIMAL(10,2),

    -- Pricing Behavior
    initial_listing_price INTEGER,
    current_listing_price INTEGER,
    highest_listing_price INTEGER,
    lowest_listing_price INTEGER,
    price_adjustments_count INTEGER DEFAULT 0,

    -- Suspicious Patterns
    rapid_relist_count INTEGER DEFAULT 0, -- Relisted <1 hour after delist
    price_manipulation_score INTEGER DEFAULT 0, -- 0-100
    is_flagged BOOLEAN DEFAULT FALSE,
    flag_reason TEXT,

    -- Timestamps
    first_listed_at TIMESTAMP DEFAULT NOW(),
    last_activity_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_listing_floatid ON listing_behavior(floatid);
CREATE INDEX idx_listing_seller ON listing_behavior(steam_id);
CREATE INDEX idx_listing_flagged ON listing_behavior(is_flagged);
```

### New API Endpoint

#### 7. **GET /api/listing-analysis/:floatId**
Analyze listing behavior for manipulation

**Response:**
```json
{
  "success": true,
  "floatId": "123456789",
  "listingHistory": [
    {
      "listedAt": "2025-10-20T10:00:00Z",
      "delistedAt": "2025-10-21T14:30:00Z",
      "duration": "28.5 hours",
      "price": 720.00,
      "status": "DELISTED"
    },
    {
      "listedAt": "2025-10-23T09:00:00Z",
      "delistedAt": "2025-10-24T11:00:00Z",
      "duration": "26 hours",
      "price": 750.00,
      "status": "REVERSED"
    },
    {
      "listedAt": "2025-10-26T15:00:00Z",
      "delistedAt": null,
      "duration": "ongoing (36 hours)",
      "price": 850.00,
      "status": "ACTIVE"
    }
  ],
  "behaviorAnalysis": {
    "totalListings": 3,
    "averageDuration": "27.25 hours",
    "priceProgression": [720, 750, 850],
    "priceIncreaseTrend": "+18.1%",
    "rapidRelistCount": 2,
    "manipulationScore": 78,
    "suspiciousPatterns": [
      "Item relisted 3 times in 7 days",
      "Price increased by 18% across listings",
      "Multiple reversals during price increases",
      "Rapid relisting after delistings (<24h)"
    ]
  },
  "sellerProfile": {
    "steamId": "76561198012345678",
    "totalItemsListed": 15,
    "itemsWithMultipleListings": 8,
    "averageRelistsPerItem": 2.3
  },
  "riskAssessment": {
    "risk": "EXTREME",
    "recommendation": "DO NOT BUY",
    "reasoning": "Clear pattern of listing manipulation and price chasing"
  }
}
```

---

## Feature 3: Real-Time Price Volatility Alerts

### Background Worker Implementation

```javascript
// /lib/volatility_monitor.js

class VolatilityMonitor {
    constructor(postgres) {
        this.postgres = postgres;
        this.checkInterval = 5 * 60 * 1000; // Check every 5 minutes
        this.volatilityThresholds = {
            EXTREME: 15,  // >15% change = EXTREME
            HIGH: 10,     // >10% change = HIGH
            MODERATE: 5,  // >5% change = MODERATE
            LOW: 2        // <2% change = LOW
        };
    }

    async start() {
        setInterval(() => this.checkVolatility(), this.checkInterval);
        winston.info('Volatility Monitor started');
    }

    async checkVolatility() {
        // Fetch recent price changes for all active items
        const items = await this.getActiveListings();

        for (const item of items) {
            const volatility = await this.calculateVolatility(item.marketHashName);
            await this.updateVolatilityRecord(item.marketHashName, volatility);

            // Alert if extreme volatility detected
            if (volatility.level === 'EXTREME') {
                await this.triggerVolatilityAlert(item, volatility);
            }
        }
    }

    async calculateVolatility(marketHashName) {
        const now = Date.now();
        const prices = await this.postgres.getPriceHistory(marketHashName, 7);

        // Calculate % changes across different timeframes
        const current = prices[0].price_usd;
        const price1hAgo = this.getPriceAtTime(prices, now - 3600000);
        const price6hAgo = this.getPriceAtTime(prices, now - 6 * 3600000);
        const price24hAgo = this.getPriceAtTime(prices, now - 24 * 3600000);
        const price7dAgo = this.getPriceAtTime(prices, now - 7 * 24 * 3600000);

        const volatility1h = ((current - price1hAgo) / price1hAgo) * 100;
        const volatility6h = ((current - price6hAgo) / price6hAgo) * 100;
        const volatility24h = ((current - price24hAgo) / price24hAgo) * 100;
        const volatility7d = ((current - price7dAgo) / price7dAgo) * 100;

        // Determine risk level based on 24h volatility
        let level, reversalRisk;
        if (Math.abs(volatility24h) >= this.volatilityThresholds.EXTREME) {
            level = 'EXTREME';
            reversalRisk = 'EXTREME';
        } else if (Math.abs(volatility24h) >= this.volatilityThresholds.HIGH) {
            level = 'HIGH';
            reversalRisk = 'HIGH';
        } else if (Math.abs(volatility24h) >= this.volatilityThresholds.MODERATE) {
            level = 'MODERATE';
            reversalRisk = 'MODERATE';
        } else {
            level = 'LOW';
            reversalRisk = 'LOW';
        }

        return {
            marketHashName,
            current,
            volatility1h,
            volatility6h,
            volatility24h,
            volatility7d,
            level,
            reversalRisk,
            trend: volatility24h > 0 ? 'RISING' : 'FALLING'
        };
    }
}
```

---

## Feature 4: Database Schema Updates

### Required Schema Additions to `lib/postgres.js`

```javascript
// Add to ensureSchema() method

async ensureSchema() {
    // ... existing schema ...

    // Add new tables for trade protection
    await this.pool.query(`
        CREATE TABLE IF NOT EXISTS seller_profiles (
            steam_id BIGINT PRIMARY KEY,
            total_listings INTEGER DEFAULT 0,
            successful_trades INTEGER DEFAULT 0,
            reversed_trades INTEGER DEFAULT 0,
            reversal_rate DECIMAL(5,2) DEFAULT 0.00,
            account_age_days INTEGER,
            steam_level INTEGER,
            risk_score INTEGER DEFAULT 50,
            risk_tier VARCHAR(20),
            is_blacklisted BOOLEAN DEFAULT FALSE,
            blacklist_reason TEXT,
            first_seen_at TIMESTAMP DEFAULT NOW(),
            last_activity_at TIMESTAMP DEFAULT NOW(),
            last_updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS trade_events (
            event_id SERIAL PRIMARY KEY,
            floatid BIGINT NOT NULL,
            asset_id BIGINT NOT NULL,
            seller_steam_id BIGINT,
            buyer_steam_id BIGINT,
            event_type VARCHAR(50),
            event_timestamp TIMESTAMP DEFAULT NOW(),
            listing_price INTEGER,
            accepted_offer_price INTEGER,
            days_since_last_trade INTEGER,
            price_change_24h DECIMAL(5,2),
            marketplace VARCHAR(50) DEFAULT 'csfloat',
            notes TEXT
        );

        CREATE TABLE IF NOT EXISTS reversal_incidents (
            incident_id SERIAL PRIMARY KEY,
            floatid BIGINT NOT NULL,
            asset_id BIGINT NOT NULL,
            seller_steam_id BIGINT NOT NULL,
            seller_account_age_days INTEGER,
            seller_previous_trades INTEGER,
            accepted_price INTEGER,
            relisted_price INTEGER,
            reversal_day INTEGER,
            price_change_since_accepted DECIMAL(5,2),
            market_volatility_24h DECIMAL(5,2),
            listing_date TIMESTAMP,
            acceptance_date TIMESTAMP,
            reversal_date TIMESTAMP NOT NULL,
            penalty_paid INTEGER,
            was_relisted BOOLEAN DEFAULT FALSE,
            relisted_date TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS price_volatility (
            volatility_id SERIAL PRIMARY KEY,
            market_hash_name VARCHAR(255) NOT NULL,
            volatility_1h DECIMAL(5,2),
            volatility_6h DECIMAL(5,2),
            volatility_24h DECIMAL(5,2),
            volatility_7d DECIMAL(5,2),
            current_price DECIMAL(10,2),
            price_1h_ago DECIMAL(10,2),
            price_24h_ago DECIMAL(10,2),
            price_7d_ago DECIMAL(10,2),
            trend VARCHAR(20),
            reversal_risk_level VARCHAR(20),
            recorded_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS marketplace_safety_metrics (
            marketplace VARCHAR(50) PRIMARY KEY,
            total_trades INTEGER DEFAULT 0,
            successful_trades INTEGER DEFAULT 0,
            reversed_trades INTEGER DEFAULT 0,
            reversal_rate DECIMAL(5,2) DEFAULT 0.00,
            has_trade_hold BOOLEAN DEFAULT TRUE,
            trade_hold_days INTEGER DEFAULT 7,
            has_instant_delivery BOOLEAN DEFAULT FALSE,
            has_escrow BOOLEAN DEFAULT FALSE,
            has_bot_middleman BOOLEAN DEFAULT FALSE,
            reversal_penalty_amount INTEGER,
            has_permanent_ban BOOLEAN DEFAULT FALSE,
            penalty_severity VARCHAR(20),
            safety_score INTEGER DEFAULT 50,
            safety_tier VARCHAR(20),
            average_listing_count INTEGER,
            average_item_price DECIMAL(10,2),
            last_updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS listing_behavior (
            behavior_id SERIAL PRIMARY KEY,
            floatid BIGINT NOT NULL,
            steam_id BIGINT NOT NULL,
            total_listings INTEGER DEFAULT 1,
            total_delistings INTEGER DEFAULT 0,
            average_listing_duration_hours DECIMAL(10,2),
            initial_listing_price INTEGER,
            current_listing_price INTEGER,
            highest_listing_price INTEGER,
            lowest_listing_price INTEGER,
            price_adjustments_count INTEGER DEFAULT 0,
            rapid_relist_count INTEGER DEFAULT 0,
            price_manipulation_score INTEGER DEFAULT 0,
            is_flagged BOOLEAN DEFAULT FALSE,
            flag_reason TEXT,
            first_listed_at TIMESTAMP DEFAULT NOW(),
            last_activity_at TIMESTAMP DEFAULT NOW()
        );
    `);

    // Create indexes
    await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_seller_risk ON seller_profiles(risk_score);
        CREATE INDEX IF NOT EXISTS idx_seller_blacklist ON seller_profiles(is_blacklisted);
        CREATE INDEX IF NOT EXISTS idx_trade_floatid ON trade_events(floatid);
        CREATE INDEX IF NOT EXISTS idx_trade_seller ON trade_events(seller_steam_id);
        CREATE INDEX IF NOT EXISTS idx_trade_type ON trade_events(event_type);
        CREATE INDEX IF NOT EXISTS idx_reversal_seller ON reversal_incidents(seller_steam_id);
        CREATE INDEX IF NOT EXISTS idx_reversal_date ON reversal_incidents(reversal_date);
        CREATE INDEX IF NOT EXISTS idx_volatility_item ON price_volatility(market_hash_name);
        CREATE INDEX IF NOT EXISTS idx_volatility_risk ON price_volatility(reversal_risk_level);
        CREATE INDEX IF NOT EXISTS idx_listing_floatid ON listing_behavior(floatid);
        CREATE INDEX IF NOT EXISTS idx_listing_seller ON listing_behavior(steam_id);
    `);
}
```

---

## Implementation Priority

### Phase 1: Foundation (Week 1)
1. ✅ Create database schema for all new tables
2. ✅ Implement seller profile tracking
3. ✅ Build seller risk scoring algorithm
4. ✅ Create `/api/seller-risk/:steamId` endpoint

### Phase 2: Core Features (Week 2)
5. ✅ Enhanced `/api/trade-protection/:floatId` endpoint
6. ✅ Price volatility tracking system
7. ✅ `/api/price-volatility/:marketHashName` endpoint
8. ✅ Background worker for volatility monitoring

### Phase 3: Marketplace Comparison (Week 3)
9. ✅ Marketplace safety metrics aggregation
10. ✅ `/api/marketplace-safety` endpoint
11. ✅ Populate initial marketplace data

### Phase 4: Advanced Analytics (Week 4)
12. ✅ Listing behavior tracking
13. ✅ `/api/listing-analysis/:floatId` endpoint
14. ✅ `/api/report-reversal` crowdsourcing endpoint
15. ✅ `/api/reversal-analytics` system statistics

### Phase 5: Polish & Launch (Week 5)
16. ✅ API documentation
17. ✅ Rate limiting for new endpoints
18. ✅ Monitoring & alerting
19. ✅ Public announcement
20. ✅ Chrome extension integration

---

## Risk Scoring Algorithm

### Seller Risk Score Calculation

```javascript
function calculateSellerRiskScore(sellerProfile) {
    let score = 100; // Start at maximum safety

    // 1. Account Age Penalty (0-30 points)
    if (sellerProfile.accountAgeDays < 30) {
        score -= 30; // New account = very risky
    } else if (sellerProfile.accountAgeDays < 90) {
        score -= 20;
    } else if (sellerProfile.accountAgeDays < 180) {
        score -= 10;
    }

    // 2. Trade Count Penalty (0-25 points)
    if (sellerProfile.successfulTrades < 5) {
        score -= 25; // Very few trades
    } else if (sellerProfile.successfulTrades < 20) {
        score -= 15;
    } else if (sellerProfile.successfulTrades < 50) {
        score -= 5;
    }
    // 50+ trades = no penalty

    // 3. Reversal History Penalty (0-40 points)
    const reversalRate = sellerProfile.reversalRate; // Already as percentage
    if (reversalRate > 20) {
        score -= 40; // >20% reversal rate = EXTREME risk
    } else if (reversalRate > 10) {
        score -= 30;
    } else if (reversalRate > 5) {
        score -= 20;
    } else if (reversalRate > 0) {
        score -= 10;
    }

    // 4. Steam Level Penalty (0-15 points)
    if (sellerProfile.steamLevel < 5) {
        score -= 15;
    } else if (sellerProfile.steamLevel < 10) {
        score -= 10;
    } else if (sellerProfile.steamLevel < 20) {
        score -= 5;
    }

    // 5. Recent Reversal Penalty (0-20 points)
    const recentReversals = sellerProfile.reversalsLast30Days || 0;
    if (recentReversals >= 3) {
        score -= 20;
    } else if (recentReversals === 2) {
        score -= 15;
    } else if (recentReversals === 1) {
        score -= 10;
    }

    // 6. Blacklist Status
    if (sellerProfile.isBlacklisted) {
        score = 0; // Instant zero score
    }

    // Cap between 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine tier
    let tier;
    if (score >= 80) tier = 'TRUSTED';
    else if (score >= 60) tier = 'LOW';
    else if (score >= 40) tier = 'MEDIUM';
    else if (score >= 20) tier = 'HIGH';
    else tier = 'EXTREME';

    return {
        score,
        tier
    };
}
```

---

## Expected Impact

### For Buyers
- ✅ **Visibility into seller risk** before purchasing
- ✅ **Price volatility alerts** to avoid reversal-prone periods
- ✅ **Marketplace safety comparison** to choose safest platform
- ✅ **Informed decisions** with comprehensive data
- ✅ **Reduced reversals** by avoiding high-risk sellers

### For the Ecosystem
- ✅ **Reputation system** that rewards good sellers
- ✅ **Transparency** about reversal rates and patterns
- ✅ **Data-driven insights** into marketplace problems
- ✅ **Pressure on CSFloat** to improve penalty system
- ✅ **Community protection** through crowdsourced reporting

### Monetization Opportunities
- Premium API access for advanced analytics
- White-label solution for other marketplaces
- Consulting for marketplaces to improve safety
- Browser extension with real-time alerts

---

## Next Steps

1. **Approve Implementation Plan** - Review and confirm features
2. **Database Migration** - Run schema updates on production
3. **Implement Phase 1** - Start with seller risk scoring
4. **Test with Real Data** - Use existing ownership history
5. **Launch Beta** - Limited release to test effectiveness
6. **Full Launch** - Public API documentation and announcement
7. **Monitor Impact** - Track reversal rates pre/post implementation

---

## Questions to Resolve

1. **Data Collection**: How do we reliably track trade reversals?
   - Web scraping CSFloat listings?
   - User-submitted reports?
   - Correlation analysis of ownership changes?

2. **Steam API Access**: Can we get seller's Steam profile data?
   - Account age
   - Steam level
   - Profile privacy settings

3. **Real-time Updates**: What's the optimal refresh rate?
   - Every 5 minutes for volatility?
   - Every hour for seller profiles?
   - On-demand for individual queries?

4. **Rate Limiting**: How to handle increased API load?
   - Cache aggressively (already doing this)
   - Implement tiered access (free vs paid)
   - Background workers for heavy computation

5. **Legal/Ethical**: Any concerns with tracking sellers?
   - All data is public and observable
   - No personal information beyond Steam ID
   - Purely statistical analysis

---

## Conclusion

The CSFloat trade reversal crisis represents a **clear market failure** where information asymmetry creates unfair risk distribution. Our API is uniquely positioned to solve this by:

1. **Aggregating ownership and trade data** we already collect
2. **Adding seller reputation tracking** to identify bad actors
3. **Monitoring price volatility** to predict reversal risk
4. **Comparing marketplace safety** to guide buyers
5. **Empowering informed decisions** through comprehensive analytics

This is not just a feature enhancement - it's a **critical infrastructure improvement** for the CS2 trading ecosystem.

**Recommended Action**: Proceed with Phase 1 implementation immediately.

---

*Document prepared: 2025-10-27*
*Author: CS2 Float API Development Team*
*Status: Pending Approval*
