# CS2 Float Checker - Complete API Documentation

**Version:** 1.1.0
**Base URL:** `http://localhost:3002` (Production: `https://api.cs2floatchecker.com`)
**Last Updated:** October 30, 2025

## Overview

Complete API documentation for the CS2 Float Checker system, covering:
- **Float Inspection** - Steam item float value inspection and caching
- **Multi-Market Pricing** - Buff163, Skinport, CSFloat, CS.MONEY, Steam pricing
- **Portfolio Tracking** - Investment management and analytics
- **Batch Processing** - Bulk operations for float checks and pricing
- **Trade Protection** - Ownership history tracking

## Table of Contents

### Core CSFloat API
1. [Float Inspection](#float-inspection-endpoints)
2. [Market Pricing](#market-pricing-endpoints)
3. [Batch Operations](#batch-operations-endpoints)
4. [Trade Protection](#trade-protection-endpoints)
5. [System Status](#system-status)

### Portfolio API
6. [Portfolio Management](#portfolio-management-endpoints)
7. [Portfolio Analytics](#portfolio-analytics-endpoints)
8. [Investment Scoring](#investment-scoring-endpoints)

### Reference
9. [Authentication](#authentication)
10. [Error Handling](#error-handling)
11. [Data Models](#data-models)

---

## Float Inspection Endpoints

### 1. Single Float Inspection

Inspect a single CS2 item to get float value, pattern seed, and sticker data.

**Endpoint:** `GET /?url={inspectUrl}` or `GET /?a={a}&d={d}&s={s}`

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | string | Yes* | Full Steam inspect URL |
| `a` | string | Yes* | Asset ID (alternative to url) |
| `d` | string | Yes* | D parameter (alternative to url) |
| `s` | string | Yes** | S parameter (alternative to url) |
| `m` | string | Yes** | M parameter (alternative to url) |

*Use either `url` OR `a`/`d`/`s`/`m` parameters
**Use either `s` OR `m` parameter

#### Response (Success)

```json
{
  "iteminfo": {
    "accountid": null,
    "itemid": "29195031916",
    "defindex": 7,
    "paintindex": 282,
    "rarity": 6,
    "quality": 4,
    "killeaterscoretype": null,
    "killeatervalue": null,
    "customname": null,
    "stickers": [],
    "inventory": 0,
    "origin": 8,
    "questid": null,
    "dropreason": 0,
    "musicindex": null,
    "entindex": null,
    "min": 0.06,
    "max": 0.8,
    "weapon_type": "Rifle",
    "item_name": "AK-47",
    "rarity_name": "Covert",
    "quality_name": "Unique",
    "origin_name": "Found in Crate",
    "wear_name": "Field-Tested",
    "full_item_name": "AK-47 | Redline (Field-Tested)",
    "floatvalue": 0.25436,
    "paintseed": 742,
    "imageurl": "https://community.cloudflare.steamstatic.com/economy/image/-9a81...",
    "floatid": "29195031916",
    "a": "29195031916",
    "s": "76561198084749120",
    "d": "16747013944935990643",
    "paintwear": 0.25436
  }
}
```

#### Example Requests

```bash
# Using full URL
curl "http://localhost:3002/?url=steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749120A29195031916D16747013944935990643"

# Using parameters
curl "http://localhost:3002/?a=29195031916&d=16747013944935990643&s=76561198084749120"
```

---

### 2. Bulk Float Inspection

Inspect up to 50 items in a single request.

**Endpoint:** `POST /bulk`

#### Request Body

```json
{
  "bulk_key": "your_bulk_key",
  "links": [
    {
      "link": "steam://rungame/730/..."
    },
    {
      "link": "steam://rungame/730/..."
    }
  ]
}
```

#### Response (Success)

```json
{
  "results": [
    {
      "iteminfo": { ... },
      "status": "success"
    },
    {
      "error": "Item not found",
      "status": "error"
    }
  ]
}
```

---

## Market Pricing Endpoints

### 3. Get Item Price

Get current prices from multiple marketplaces (Buff163, Skinport, CSFloat, CS.MONEY, Steam).

**Endpoint:** `GET /api/price/:marketHashName`

#### Response (Success)

```json
{
  "success": true,
  "name": "AK-47 | Redline (Field-Tested)",
  "prices": {
    "buff163": {
      "price_usd": 42.30,
      "price_cny": 298.50,
      "listings": 847,
      "updated": "2025-10-30T12:00:00.000Z",
      "url": "https://buff.163.com/market/csgo#tab=selling&search=AK-47%20%7C%20Redline%20..."
    },
    "skinport": {
      "price_usd": 45.99,
      "price_eur": 42.50,
      "listings": 32,
      "updated": "2025-10-30T12:05:00.000Z",
      "url": "https://skinport.com/market?search=AK-47..."
    },
    "csfloat": {
      "price_usd": 44.50,
      "listings": 127,
      "updated": "2025-10-30T12:03:00.000Z",
      "url": "https://csfloat.com/search?search=AK-47..."
    },
    "marketCsgo": {
      "price_usd": 46.20,
      "listings": 89,
      "updated": "2025-10-30T12:02:00.000Z",
      "url": "https://cs.money/csgo/trade/?search=AK-47..."
    },
    "steam": {
      "price_usd": 48.50,
      "volume": 234,
      "updated": "2025-10-30T12:04:00.000Z",
      "url": "https://steamcommunity.com/market/listings/730/AK-47..."
    }
  },
  "lowestPrice": 42.30,
  "highestPrice": 48.50,
  "cached": true
}
```

**Cache:** 5-minute TTL

#### Example Request

```bash
curl "http://localhost:3002/api/price/AK-47%20%7C%20Redline%20(Field-Tested)"
```

---

### 4. Get Price History

Get historical price data for an item (7, 14, or 30 days).

**Endpoint:** `GET /api/price-history/:marketHashName?timeframe=30`

#### Query Parameters

| Parameter | Type | Default | Options | Description |
|-----------|------|---------|---------|-------------|
| `timeframe` | string | '30' | '7', '14', '30' | Number of days of history |

#### Response (Success)

```json
{
  "success": true,
  "name": "AK-47 | Redline (Field-Tested)",
  "timeframe": "30 days",
  "markets": [
    {
      "name": "Buff163",
      "type": "marketplace",
      "prices": [
        {
          "date": "2025-10-01T00:00:00.000Z",
          "price": 38.50,
          "quantity": 892
        },
        {
          "date": "2025-10-02T00:00:00.000Z",
          "price": 39.20,
          "quantity": 847
        }
      ]
    }
  ]
}
```

---

### 5. Get Recent Sales

Get recent sales data with float values, patterns, and stickers.

**Endpoint:** `GET /api/recent-sales/:marketHashName`

#### Response (Success)

```json
{
  "success": true,
  "name": "AK-47 | Redline (Field-Tested)",
  "totalSales": 15,
  "sales": [
    {
      "price": 45.30,
      "float": 0.234,
      "pattern": 742,
      "stickers": [],
      "date": "2025-10-30T10:23:15.000Z",
      "market": {
        "name": "CSFloat Market",
        "url": "https://csfloat.com/..."
      }
    }
  ],
  "averagePrice": "44.52"
}
```

**Note:** Recent sales are automatically stored in database for float-price correlation analysis.

---

## Batch Operations Endpoints

### 6. Batch Price Check

Check prices for up to 50 items at once.

**Endpoint:** `POST /api/batch/prices`

#### Request Body

```json
{
  "items": [
    "AK-47 | Redline (Field-Tested)",
    "AWP | Asiimov (Field-Tested)",
    "M4A4 | Howl (Minimal Wear)"
  ]
}
```

#### Response (Success)

```json
{
  "success": true,
  "total": 3,
  "successful": 3,
  "failed": 0,
  "results": [
    {
      "index": 0,
      "itemName": "AK-47 | Redline (Field-Tested)",
      "prices": { ... },
      "lowestPrice": 42.30,
      "highestPrice": 48.50,
      "cached": true
    }
  ]
}
```

---

### 7. Batch Float Rarity Check

Check float rarity for up to 100 items at once.

**Endpoint:** `POST /api/batch/rarity`

#### Request Body

```json
{
  "items": [
    {
      "defindex": 7,
      "paintindex": 282,
      "floatvalue": 0.25436
    },
    {
      "defindex": 9,
      "paintindex": 344,
      "floatvalue": 0.18234
    }
  ]
}
```

#### Response (Success)

```json
{
  "success": true,
  "total": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "index": 0,
      "item": { "defindex": 7, "paintindex": 282, "floatvalue": 0.25436 },
      "rarity": {
        "floatValue": 0.25436,
        "rarityScore": 68,
        "rarityTier": "Rare (Top 32%)",
        "percentile": 32,
        "totalSeen": 45892,
        "betterFloats": 14685,
        "worseFloats": 31207,
        "statistics": {
          "bestFloat": 0.06234,
          "worstFloat": 0.79832,
          "avgFloat": 0.35678
        }
      }
    }
  ]
}
```

---

### 8. Batch Float Premium Calculator

Calculate float premiums for up to 50 items at once.

**Endpoint:** `POST /api/batch/float-premium`

#### Request Body

```json
{
  "items": [
    {
      "marketHashName": "AK-47 | Redline (Field-Tested)",
      "floatValue": 0.18
    }
  ]
}
```

---

## Trade Protection Endpoints

### 9. Get Ownership History

Get trade history for an item to detect reversible trades.

**Endpoint:** `GET /api/ownership-history/:floatId`

#### Response (Success)

```json
{
  "floatId": "29195031916",
  "ownershipHistory": [
    {
      "owner": "76561198084749120",
      "date": "2025-10-28T14:30:00.000Z"
    },
    {
      "owner": "76561198012345678",
      "date": "2025-10-15T10:20:00.000Z"
    }
  ],
  "tradeRisk": {
    "risk": "HIGH",
    "message": "⚠️ Item traded within 7 days - REVERSIBLE!",
    "canReverse": true,
    "daysRemaining": 5,
    "lastTradeDate": "2025-10-28T14:30:00.000Z",
    "reversibleUntil": "2025-11-04T14:30:00.000Z"
  },
  "totalOwners": 2
}
```

---

## System Status

### 10. Get Bot Status

Check status of Steam bots and queue size.

**Endpoint:** `GET /stats`

#### Response (Success)

```json
{
  "bots_online": 4,
  "bots_total": 4,
  "queue_size": 12,
  "queue_concurrency": 4
}
```

---

## Portfolio Management Endpoints

### 11. Add Investment

*(See existing Portfolio API documentation below)*

---

## Authentication
   - [Add Investment](#1-add-investment)
   - [Get User Portfolio](#2-get-user-portfolio)
   - [Get Portfolio Statistics](#3-get-portfolio-statistics)
   - [Record Sale](#4-record-sale)
   - [Delete Investment](#5-delete-investment)
   - [Calculate Investment Score](#6-calculate-investment-score)
3. [Data Models](#data-models)
4. [Investment Scoring Algorithm](#investment-scoring-algorithm)
5. [Blue Gem Pattern Detection](#blue-gem-pattern-detection)
6. [Error Handling](#error-handling)
7. [Integration Examples](#integration-examples)

---

## Authentication

**Current Version:** No authentication required for testing
**Production:** Will require API key or user authentication (TBD)

For now, use a unique `userId` to identify different users. In production, this will be tied to actual user accounts.

---

## Endpoints

### 1. Add Investment

Add a new investment to a user's portfolio.

**Endpoint:** `POST /api/portfolio/add`

#### Request Body

```json
{
  "userId": "string (required)",
  "itemName": "string (required)",
  "purchasePrice": "number (required)",
  "quantity": "number (optional, default: 1)",
  "inspectLink": "string (optional)",
  "marketplace": "string (optional, default: 'Steam')",
  "notes": "string (optional)"
}
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | User identifier |
| `itemName` | string | Yes | Full item name (e.g., "AK-47 \| Redline (Field-Tested)") |
| `purchasePrice` | number | Yes | Purchase price in USD |
| `quantity` | number | No | Number of items purchased (default: 1) |
| `inspectLink` | string | No | Steam inspect link for float data |
| `marketplace` | string | No | Marketplace name (e.g., "Steam", "Buff163", "CSFloat") |
| `notes` | string | No | Personal notes about the investment |

#### Response (Success)

```json
{
  "success": true,
  "investment": {
    "id": 1,
    "itemName": "AK-47 | Redline (Field-Tested)",
    "purchasePrice": 45.50,
    "floatValue": 0.25,
    "investmentScore": 6.8,
    "patternTier": "Standard",
    "rarityTier": "Very Rare (Top 5%)"
  }
}
```

#### Example Request (curl)

```bash
curl -X POST http://localhost:3002/api/portfolio/add \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_12345",
    "itemName": "AK-47 | Redline (Field-Tested)",
    "purchasePrice": 45.50,
    "quantity": 1,
    "marketplace": "Steam",
    "notes": "Good deal, clean look"
  }'
```

#### Example Request (JavaScript/Fetch)

```javascript
const response = await fetch('http://localhost:3002/api/portfolio/add', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    userId: 'user_12345',
    itemName: 'AK-47 | Redline (Field-Tested)',
    purchasePrice: 45.50,
    quantity: 1,
    marketplace: 'Steam',
    notes: 'Good deal, clean look'
  })
});

const data = await response.json();
console.log(data);
```

#### TypeScript Interface

```typescript
interface AddInvestmentRequest {
  userId: string;
  itemName: string;
  purchasePrice: number;
  quantity?: number;
  inspectLink?: string;
  marketplace?: string;
  notes?: string;
}

interface AddInvestmentResponse {
  success: boolean;
  investment: {
    id: number;
    itemName: string;
    purchasePrice: number;
    floatValue: number | null;
    investmentScore: number | null;
    patternTier: string;
    rarityTier: string | null;
  };
}
```

---

### 2. Get User Portfolio

Retrieve all investments for a specific user, enriched with current prices and profit/loss calculations.

**Endpoint:** `GET /api/portfolio/:userId`

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | User identifier |

#### Response (Success)

```json
{
  "success": true,
  "investments": [
    {
      "id": 1,
      "user_id": "user_12345",
      "item_name": "AK-47 | Redline (Field-Tested)",
      "purchase_price": "45.50",
      "purchase_date": "2025-10-30T12:45:39.166Z",
      "quantity": 1,
      "marketplace": "Steam",
      "float_value": 0.25,
      "pattern_index": 123,
      "defindex": 7,
      "paintindex": 282,
      "wear": "FT",
      "is_stattrak": false,
      "investment_score": 6.8,
      "investment_score_breakdown": {
        "float_rarity": 9.5,
        "pattern_value": 5.0,
        "liquidity": 7.5,
        "weapon_popularity": 10.0,
        "price_trend": 6.5,
        "volatility": 8.0
      },
      "float_rarity_score": 95,
      "pattern_tier": "Standard",
      "pattern_value_multiplier": "1.00",
      "stickers": null,
      "notes": "Good deal, clean look",
      "tags": null,
      "is_sold": false,
      "created_at": "2025-10-30T12:45:39.166Z",
      "updated_at": "2025-10-30T12:45:39.166Z",
      "sold_quantity": "0",
      "realized_profit": "0",
      "current_price": 52.00,
      "unrealized_profit": 6.50,
      "unrealized_roi": 14.29,
      "total_profit": 6.50
    }
  ]
}
```

#### Example Request (curl)

```bash
curl -X GET http://localhost:3002/api/portfolio/user_12345
```

#### Example Request (JavaScript/Fetch)

```javascript
const response = await fetch('http://localhost:3002/api/portfolio/user_12345');
const data = await response.json();
console.log(data.investments);
```

#### TypeScript Interface

```typescript
interface Investment {
  id: number;
  user_id: string;
  item_name: string;
  purchase_price: string;
  purchase_date: string;
  quantity: number;
  marketplace: string;
  float_value: number | null;
  pattern_index: number | null;
  defindex: number | null;
  paintindex: number | null;
  wear: string | null;
  is_stattrak: boolean;
  investment_score: number | null;
  investment_score_breakdown: {
    float_rarity: number;
    pattern_value: number;
    liquidity: number;
    weapon_popularity: number;
    price_trend: number;
    volatility: number;
  } | null;
  float_rarity_score: number | null;
  pattern_tier: string;
  pattern_value_multiplier: string;
  stickers: any | null;
  notes: string | null;
  tags: string[] | null;
  is_sold: boolean;
  created_at: string;
  updated_at: string;
  sold_quantity: string;
  realized_profit: string;
  current_price: number;
  unrealized_profit: number;
  unrealized_roi: number;
  total_profit: number;
}

interface GetPortfolioResponse {
  success: boolean;
  investments: Investment[];
}
```

---

### 3. Get Portfolio Statistics

Get aggregated statistics for a user's portfolio including total invested, current value, profits, and ROI.

**Endpoint:** `GET /api/portfolio/stats/:userId`

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | User identifier |

#### Response (Success)

```json
{
  "success": true,
  "stats": {
    "totalInvested": 2500.00,
    "currentValue": 2850.00,
    "realizedProfit": 150.00,
    "unrealizedProfit": 200.00,
    "totalProfit": 350.00,
    "totalROI": 14.00,
    "itemCount": 15,
    "avgInvestmentScore": 7.2
  }
}
```

#### Example Request (curl)

```bash
curl -X GET http://localhost:3002/api/portfolio/stats/user_12345
```

#### Example Request (JavaScript/Fetch)

```javascript
const response = await fetch('http://localhost:3002/api/portfolio/stats/user_12345');
const data = await response.json();
console.log(data.stats);
```

#### TypeScript Interface

```typescript
interface PortfolioStats {
  totalInvested: number;      // Total amount invested across all items
  currentValue: number;        // Current market value of all unsold items
  realizedProfit: number;      // Profit from completed sales
  unrealizedProfit: number;    // Potential profit from unsold items at current prices
  totalProfit: number;         // realizedProfit + unrealizedProfit
  totalROI: number;            // Total return on investment (percentage)
  itemCount: number;           // Number of investments in portfolio
  avgInvestmentScore: number;  // Average investment score (1-10 scale)
}

interface GetStatsResponse {
  success: boolean;
  stats: PortfolioStats;
}
```

---

### 4. Record Sale

Record a sale for an investment. Automatically calculates profit/loss and marks as fully sold if quantity is exhausted.

**Endpoint:** `POST /api/portfolio/sale`

#### Request Body

```json
{
  "investmentId": "number (required)",
  "quantity": "number (required)",
  "salePrice": "number (required)",
  "marketplace": "string (optional, default: 'Steam')",
  "notes": "string (optional)"
}
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `investmentId` | number | Yes | ID of the investment being sold |
| `quantity` | number | Yes | Number of items sold |
| `salePrice` | number | Yes | Sale price per item in USD |
| `marketplace` | string | No | Marketplace where sold |
| `notes` | string | No | Notes about the sale |

#### Response (Success)

```json
{
  "success": true,
  "sale": {
    "investmentId": 1,
    "quantity": 1,
    "salePrice": 52.00,
    "profitLoss": 6.50,
    "roiPercent": 14.29,
    "isFullySold": true
  }
}
```

#### Example Request (curl)

```bash
curl -X POST http://localhost:3002/api/portfolio/sale \
  -H "Content-Type: application/json" \
  -d '{
    "investmentId": 1,
    "quantity": 1,
    "salePrice": 52.00,
    "marketplace": "CSFloat",
    "notes": "Sold for profit"
  }'
```

#### Example Request (JavaScript/Fetch)

```javascript
const response = await fetch('http://localhost:3002/api/portfolio/sale', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    investmentId: 1,
    quantity: 1,
    salePrice: 52.00,
    marketplace: 'CSFloat',
    notes: 'Sold for profit'
  })
});

const data = await response.json();
console.log(data.sale);
```

#### TypeScript Interface

```typescript
interface RecordSaleRequest {
  investmentId: number;
  quantity: number;
  salePrice: number;
  marketplace?: string;
  notes?: string;
}

interface RecordSaleResponse {
  success: boolean;
  sale: {
    investmentId: number;
    quantity: number;
    salePrice: number;
    profitLoss: number;
    roiPercent: number;
    isFullySold: boolean;
  };
}
```

---

### 5. Delete Investment

Delete an investment from the portfolio. This will cascade delete any associated sales records.

**Endpoint:** `DELETE /api/portfolio/delete/:investmentId`

#### URL Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `investmentId` | number | Yes | ID of investment to delete |

#### Response (Success)

```json
{
  "success": true,
  "message": "Investment deleted successfully"
}
```

#### Example Request (curl)

```bash
curl -X DELETE http://localhost:3002/api/portfolio/delete/1
```

#### Example Request (JavaScript/Fetch)

```javascript
const response = await fetch('http://localhost:3002/api/portfolio/delete/1', {
  method: 'DELETE'
});

const data = await response.json();
console.log(data.message);
```

#### TypeScript Interface

```typescript
interface DeleteInvestmentResponse {
  success: boolean;
  message: string;
}
```

---

### 6. Calculate Investment Score

Calculate an investment score (1-10) for a specific item based on float rarity, pattern value, liquidity, weapon popularity, price trends, and volatility.

**Endpoint:** `POST /api/investment-score`

#### Request Body

```json
{
  "itemName": "string (required)",
  "floatValue": "number (required)",
  "patternIndex": "number (optional)",
  "defindex": "number (optional)",
  "paintindex": "number (optional)"
}
```

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `itemName` | string | Yes | Full item name |
| `floatValue` | number | Yes | Float value (0.00 - 1.00) |
| `patternIndex` | number | No | Pattern seed/index |
| `defindex` | number | No | Item definition index |
| `paintindex` | number | No | Paint kit index |

#### Response (Success)

```json
{
  "success": true,
  "itemName": "AK-47 | Case Hardened (Factory New)",
  "floatValue": 0.01,
  "investmentScore": {
    "overall": 7.7,
    "breakdown": {
      "float_rarity": 10.0,
      "pattern_value": 10.0,
      "liquidity": 2.0,
      "weapon_popularity": 10.0,
      "price_trend": 5.0,
      "volatility": 5.0
    }
  },
  "patternInfo": {
    "tier": "Tier 1",
    "multiplier": 125.0,
    "description": "The #1 most sought-after AK-47 Blue Gem. Sold for $1,000,000 in FN condition (June 2024).",
    "score": 10.0
  },
  "rarityInfo": {
    "floatValue": 0.01,
    "rarityScore": 100,
    "rarityTier": "Ultra Rare (Top 0.1%)",
    "percentile": 0,
    "totalSeen": 220,
    "betterFloats": 0,
    "worseFloats": 220,
    "statistics": {
      "bestFloat": 0.01163024,
      "worstFloat": 0.98124897,
      "avgFloat": 0.20805031
    }
  }
}
```

#### Example Request (curl)

```bash
curl -X POST http://localhost:3002/api/investment-score \
  -H "Content-Type: application/json" \
  -d '{
    "itemName": "AK-47 | Case Hardened (Factory New)",
    "floatValue": 0.01,
    "patternIndex": 661,
    "defindex": 7,
    "paintindex": 44
  }'
```

#### Example Request (JavaScript/Fetch)

```javascript
const response = await fetch('http://localhost:3002/api/investment-score', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    itemName: 'AK-47 | Case Hardened (Factory New)',
    floatValue: 0.01,
    patternIndex: 661,
    defindex: 7,
    paintindex: 44
  })
});

const data = await response.json();
console.log(data.investmentScore);
```

#### TypeScript Interface

```typescript
interface CalculateScoreRequest {
  itemName: string;
  floatValue: number;
  patternIndex?: number;
  defindex?: number;
  paintindex?: number;
}

interface InvestmentScore {
  overall: number;
  breakdown: {
    float_rarity: number;
    pattern_value: number;
    liquidity: number;
    weapon_popularity: number;
    price_trend: number;
    volatility: number;
  };
}

interface PatternInfo {
  tier: string;
  multiplier: number;
  description: string;
  score: number;
}

interface RarityInfo {
  floatValue: number;
  rarityScore: number;
  rarityTier: string;
  percentile: number;
  totalSeen: number;
  betterFloats: number;
  worseFloats: number;
  statistics: {
    bestFloat: number;
    worstFloat: number;
    avgFloat: number;
  };
}

interface CalculateScoreResponse {
  success: boolean;
  itemName: string;
  floatValue: number;
  investmentScore: InvestmentScore;
  patternInfo: PatternInfo;
  rarityInfo: RarityInfo | null;
}
```

---

## Data Models

### Database Schema

#### portfolio_investments

```sql
CREATE TABLE portfolio_investments (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_name TEXT NOT NULL,

    -- Purchase details
    purchase_price DECIMAL(10,2) NOT NULL,
    purchase_date TIMESTAMP DEFAULT NOW(),
    quantity INTEGER DEFAULT 1,
    marketplace TEXT,

    -- Float data
    float_value DECIMAL(10,8),
    pattern_index INTEGER,
    defindex INTEGER,
    paintindex INTEGER,
    wear TEXT,
    is_stattrak BOOLEAN DEFAULT false,

    -- Investment analysis
    investment_score DECIMAL(3,1),
    investment_score_breakdown JSONB,
    float_rarity_score INTEGER,
    pattern_tier TEXT,
    pattern_value_multiplier DECIMAL(5,2),

    -- Stickers
    stickers JSONB,

    -- Metadata
    notes TEXT,
    tags TEXT[],
    is_sold BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### portfolio_sales

```sql
CREATE TABLE portfolio_sales (
    id SERIAL PRIMARY KEY,
    investment_id INTEGER REFERENCES portfolio_investments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,

    quantity INTEGER NOT NULL,
    sale_price DECIMAL(10,2) NOT NULL,
    sale_date TIMESTAMP DEFAULT NOW(),
    marketplace TEXT,

    -- Calculated fields
    profit_loss DECIMAL(10,2),
    roi_percent DECIMAL(5,2),

    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Investment Scoring Algorithm

The investment score is calculated on a **1-10 scale** using a weighted algorithm that considers 6 key factors:

### Scoring Breakdown

| Factor | Weight | Description |
|--------|--------|-------------|
| **Float Rarity** | 25% | Percentile ranking of float value (lower is rarer for most skins) |
| **Pattern Value** | 20% | Special pattern detection (Blue Gems, Fade %, Doppler phases) |
| **Liquidity** | 20% | Number of market listings (higher = easier to sell) |
| **Weapon Popularity** | 15% | S/A/B/C tier classification (AK-47, AWP = S-tier) |
| **Price Trend** | 15% | 30-day price movement (uptrend = higher score) |
| **Volatility** | 10% | Price stability (lower volatility = higher score) |

### Score Interpretation

| Score | Rating | Investment Quality |
|-------|--------|-------------------|
| 9.0 - 10.0 | Excellent | Premium investment opportunity |
| 7.5 - 8.9 | Very Good | Strong investment with good fundamentals |
| 6.0 - 7.4 | Good | Solid investment, relatively safe |
| 4.5 - 5.9 | Fair | Average investment, moderate risk |
| 3.0 - 4.4 | Below Average | Higher risk, be cautious |
| 1.0 - 2.9 | Poor | High risk investment |

### Example Calculation

For an **AK-47 | Redline (FT)** with float 0.18:

```
Float Rarity:        9.5/10 (Top 5% float)
Pattern Value:       5.0/10 (Standard pattern)
Liquidity:           7.5/10 (100+ listings)
Weapon Popularity:  10.0/10 (AK-47 is S-tier)
Price Trend:         6.5/10 (Slight uptrend)
Volatility:          8.0/10 (Stable prices)

Overall Score = (9.5×0.25) + (5.0×0.20) + (7.5×0.20) + (10.0×0.15) + (6.5×0.15) + (8.0×0.10)
              = 2.375 + 1.0 + 1.5 + 1.5 + 0.975 + 0.8
              = 8.15/10 (Very Good)
```

---

## Blue Gem Pattern Detection

The API includes a database of **Blue Gem patterns** for Case Hardened skins, starting with the AK-47.

### Pattern Tiers

#### Tier 1 - Legendary (125x - 100x value multiplier)
- **Pattern #661** - 92% blue, $1,000,000 sale (FN, June 2024)
- **Pattern #387** - 90% blue, extremely rare
- **Pattern #670** - 88% blue, near-perfect coverage
- **Pattern #321** - 87% blue, one of the "Big 4"

#### Tier 2 - High-Tier (15x - 12x value multiplier)
- **Pattern #151** - 75% blue, clean top
- **Pattern #179** - 73% blue, solid pattern
- **Pattern #470** - 72% blue, consistent coverage
- **Pattern #555** - 70% blue, popular among collectors

#### Tier 3 - Mid-Tier (5x - 4x value multiplier)
- **Pattern #103** - 60% blue, good coverage
- **Pattern #147** - 58% blue, noticeable pattern
- **Pattern #168** - 57% blue, mid-tier value
- **Pattern #592** - 55% blue, decent coverage

### Example Detection

```javascript
// Pattern #661 (Legendary Blue Gem)
{
  "patternInfo": {
    "tier": "Tier 1",
    "multiplier": 125.0,
    "description": "The #1 most sought-after AK-47 Blue Gem. Sold for $1,000,000 in FN condition (June 2024).",
    "score": 10.0
  }
}

// Pattern #151 (High-Tier)
{
  "patternInfo": {
    "tier": "Tier 2",
    "multiplier": 15.0,
    "description": "Clean blue top with minimal purple. Highly desirable.",
    "score": 9.0
  }
}

// Standard Pattern
{
  "patternInfo": {
    "tier": "Standard",
    "multiplier": 1.0,
    "description": "Standard pattern",
    "score": 5.0
  }
}
```

---

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success |
| 400 | Bad Request (missing parameters, invalid format) |
| 404 | Not Found (investment doesn't exist) |
| 500 | Internal Server Error |

### Error Examples

#### Missing Required Fields
```json
{
  "success": false,
  "error": "Missing required fields: userId, itemName, purchasePrice"
}
```

#### Investment Not Found
```json
{
  "success": false,
  "error": "Investment not found"
}
```

#### Invalid Parameters
```json
{
  "success": false,
  "error": "Missing required fields: itemName, floatValue"
}
```

---

## Integration Examples

### React Component - Add Investment Form

```typescript
import { useState } from 'react';

interface AddInvestmentFormProps {
  userId: string;
  onSuccess: () => void;
}

export function AddInvestmentForm({ userId, onSuccess }: AddInvestmentFormProps) {
  const [itemName, setItemName] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [marketplace, setMarketplace] = useState('Steam');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3002/api/portfolio/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          itemName,
          purchasePrice: parseFloat(purchasePrice),
          marketplace,
          notes
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Investment added successfully!');
        onSuccess();
        // Reset form
        setItemName('');
        setPurchasePrice('');
        setNotes('');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to add investment');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Item Name"
        value={itemName}
        onChange={(e) => setItemName(e.target.value)}
        required
      />
      <input
        type="number"
        step="0.01"
        placeholder="Purchase Price"
        value={purchasePrice}
        onChange={(e) => setPurchasePrice(e.target.value)}
        required
      />
      <select value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
        <option value="Steam">Steam</option>
        <option value="Buff163">Buff163</option>
        <option value="CSFloat">CSFloat</option>
        <option value="Skinport">Skinport</option>
      </select>
      <textarea
        placeholder="Notes"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Adding...' : 'Add Investment'}
      </button>
    </form>
  );
}
```

### React Hook - Fetch Portfolio

```typescript
import { useState, useEffect } from 'react';

interface Investment {
  id: number;
  item_name: string;
  purchase_price: string;
  current_price: number;
  unrealized_profit: number;
  unrealized_roi: number;
  // ... other fields
}

export function usePortfolio(userId: string) {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPortfolio() {
      try {
        const response = await fetch(`http://localhost:3002/api/portfolio/${userId}`);
        const data = await response.json();

        if (data.success) {
          setInvestments(data.investments);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError('Failed to fetch portfolio');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchPortfolio();
  }, [userId]);

  return { investments, loading, error };
}

// Usage in component
function PortfolioView({ userId }: { userId: string }) {
  const { investments, loading, error } = usePortfolio(userId);

  if (loading) return <div>Loading portfolio...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {investments.map((inv) => (
        <div key={inv.id}>
          <h3>{inv.item_name}</h3>
          <p>Purchase: ${inv.purchase_price}</p>
          <p>Current: ${inv.current_price}</p>
          <p>Profit: ${inv.unrealized_profit.toFixed(2)} ({inv.unrealized_roi.toFixed(2)}%)</p>
        </div>
      ))}
    </div>
  );
}
```

### Vue.js Composition API Example

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface PortfolioStats {
  totalInvested: number;
  currentValue: number;
  totalProfit: number;
  totalROI: number;
  itemCount: number;
}

const userId = ref('user_12345');
const stats = ref<PortfolioStats | null>(null);
const loading = ref(true);

async function fetchStats() {
  loading.value = true;
  try {
    const response = await fetch(`http://localhost:3002/api/portfolio/stats/${userId.value}`);
    const data = await response.json();

    if (data.success) {
      stats.value = data.stats;
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchStats();
});
</script>

<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="stats">
    <h2>Portfolio Summary</h2>
    <div class="stats-grid">
      <div>Total Invested: ${{ stats.totalInvested.toFixed(2) }}</div>
      <div>Current Value: ${{ stats.currentValue.toFixed(2) }}</div>
      <div>Total Profit: ${{ stats.totalProfit.toFixed(2) }}</div>
      <div>ROI: {{ stats.totalROI.toFixed(2) }}%</div>
      <div>Items: {{ stats.itemCount }}</div>
    </div>
  </div>
</template>
```

---

## Enhanced Portfolio Endpoints

### 7. Get Asset Allocation

Get breakdown of portfolio by item categories (Knives, Rifles, Cases, etc.).

**Endpoint:** `GET /api/portfolio/allocation/:userId`

#### Response (Success)

```json
{
  "success": true,
  "totalValue": 6382.50,
  "allocation": {
    "Knives": {
      "value": 1500.00,
      "percentage": 23.50
    },
    "Rifles": {
      "value": 4636.50,
      "percentage": 72.64
    },
    "Snipers": {
      "value": 196.00,
      "percentage": 3.07
    },
    "Cases": {
      "value": 50.00,
      "percentage": 0.78
    }
  },
  "categories": ["Cases", "Knives", "Rifles", "Snipers"]
}
```

#### Example Request (curl)

```bash
curl -X GET http://localhost:3002/api/portfolio/allocation/user_12345
```

---

### 8. Get Portfolio Health Metrics

Calculate portfolio health scores including diversity, risk, and liquidity.

**Endpoint:** `GET /api/portfolio/health/:userId`

#### Response (Success)

```json
{
  "success": true,
  "health": {
    "overallScore": 6.8,
    "diversityScore": 7.5,
    "riskScore": 5.2,
    "liquidityScore": 8.1
  },
  "allocation": {
    "safe": 1250.00,
    "risky": 3500.00,
    "liquid": 4200.00,
    "safePercentage": 26.32,
    "riskyPercentage": 73.68,
    "liquidPercentage": 88.42
  },
  "metrics": {
    "totalCategories": 6,
    "totalItems": 24,
    "totalValue": 4750.00,
    "totalInvested": 4200.00
  }
}
```

#### Health Score Breakdown

| Metric | Description | Calculation |
|--------|-------------|-------------|
| **Overall Score** | Combined health (1-10) | Weighted average of all scores |
| **Diversity Score** | How spread out investments are | Based on number of categories and distribution |
| **Risk Score** | Portfolio risk level (10 = highest) | Percentage of risky items (knives, blue gems) |
| **Liquidity Score** | How easily sellable (1-10) | Based on market listings > 100 |

**Safe Items**: Cases, Keys, Stickers, Capsules
**Risky Items**: Knives, Blue Gems, Rare Patterns

#### Example Request (curl)

```bash
curl -X GET http://localhost:3002/api/portfolio/health/user_12345
```

---

### 9. Batch Add Investments

Add multiple investments in a single request (up to 50 items).

**Endpoint:** `POST /api/portfolio/batch/add`

#### Request Body

```json
{
  "userId": "user_12345",
  "investments": [
    {
      "itemName": "AK-47 | Redline (Field-Tested)",
      "purchasePrice": 45.50,
      "quantity": 3,
      "marketplace": "Steam"
    },
    {
      "itemName": "AWP | Asiimov (Field-Tested)",
      "purchasePrice": 98.00,
      "quantity": 2,
      "marketplace": "Buff163"
    }
  ]
}
```

#### Response (Success)

```json
{
  "success": true,
  "total": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    {
      "index": 0,
      "id": 101,
      "itemName": "AK-47 | Redline (Field-Tested)",
      "success": true
    },
    {
      "index": 1,
      "id": 102,
      "itemName": "AWP | Asiimov (Field-Tested)",
      "success": true
    }
  ]
}
```

#### Example Request (curl)

```bash
curl -X POST http://localhost:3002/api/portfolio/batch/add \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_12345",
    "investments": [
      {"itemName": "AK-47 | Redline (FT)", "purchasePrice": 45.50, "quantity": 3},
      {"itemName": "AWP | Asiimov (FT)", "purchasePrice": 98.00, "quantity": 2}
    ]
  }'
```

---

### 10. Batch Delete Investments

Delete multiple investments in a single request (up to 100 items).

**Endpoint:** `POST /api/portfolio/batch/delete`

#### Request Body

```json
{
  "userId": "user_12345",
  "investmentIds": [101, 102, 103, 104]
}
```

#### Response (Success)

```json
{
  "success": true,
  "deleted": 4,
  "deletedIds": [101, 102, 103, 104]
}
```

---

### 11. Get Recent Activity

Get recent investments and sales activity with pagination.

**Endpoint:** `GET /api/portfolio/activity/:userId?limit=20&offset=0`

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Number of activities to return |
| `offset` | number | 0 | Pagination offset |

#### Response (Success)

```json
{
  "success": true,
  "activities": [
    {
      "id": 7,
      "item_name": "M4A4 | Howl (Minimal Wear)",
      "purchase_price": "4500.00",
      "quantity": 1,
      "marketplace": "Skinport",
      "created_at": "2025-10-30T13:27:59.261Z",
      "type": "investment"
    },
    {
      "id": 1,
      "item_name": "AK-47 | Redline (Field-Tested)",
      "sale_price": "52.00",
      "quantity": 1,
      "marketplace": "CSFloat",
      "profit_loss": "6.50",
      "roi_percent": "14.29",
      "created_at": "2025-10-30T12:48:45.380Z",
      "type": "sale"
    }
  ],
  "total": 2,
  "limit": 20,
  "offset": 0
}
```

---

### 12. Export Portfolio

Export complete portfolio data in JSON or CSV format.

**Endpoint:** `GET /api/portfolio/export/:userId?format=json`

#### Query Parameters

| Parameter | Type | Default | Options | Description |
|-----------|------|---------|---------|-------------|
| `format` | string | 'json' | 'json' or 'csv' | Export format |

#### Response (JSON Format)

```json
{
  "success": true,
  "exportDate": "2025-10-30T13:28:49.835Z",
  "userId": "user_12345",
  "totalInvestments": 6,
  "investments": [...]
}
```

#### Response (CSV Format)

```csv
ID,Item Name,Purchase Price,Quantity,Marketplace,Purchase Date,Float Value,Pattern Index,Wear,Investment Score,Pattern Tier,Notes,Is Sold
7,"M4A4 | Howl (Minimal Wear)",4500.00,1,Skinport,2025-10-30,,,,,,false
6,"Prisma Case",0.50,100,Steam,2025-10-30,,,,,,false
```

#### Example Requests

```bash
# JSON Export
curl -X GET "http://localhost:3002/api/portfolio/export/user_12345?format=json"

# CSV Export
curl -X GET "http://localhost:3002/api/portfolio/export/user_12345?format=csv" -o portfolio.csv
```

---

### 13. Update Investment

Update an existing investment's details.

**Endpoint:** `PATCH /api/portfolio/update/:investmentId`

#### Request Body

```json
{
  "purchasePrice": 48.00,
  "quantity": 2,
  "marketplace": "CSFloat",
  "notes": "Updated after price change",
  "tags": ["blue-gem", "long-term"]
}
```

**Note:** Only include fields you want to update. All fields are optional.

#### Response (Success)

```json
{
  "success": true,
  "investment": {
    "id": 3,
    "user_id": "user_12345",
    "item_name": "★ Karambit | Fade (Factory New)",
    "purchase_price": "48.00",
    "quantity": 2,
    "marketplace": "CSFloat",
    "notes": "Updated after price change",
    "tags": ["blue-gem", "long-term"],
    "updated_at": "2025-10-30T14:15:22.123Z"
  }
}
```

#### Example Request (curl)

```bash
curl -X PATCH http://localhost:3002/api/portfolio/update/3 \
  -H "Content-Type: application/json" \
  -d '{"notes": "Great investment!", "tags": ["long-term"]}'
```

---

## Error Codes Reference

All enhanced endpoints include standardized error codes for better error handling:

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `ALLOCATION_ERROR` | 500 | Failed to calculate asset allocation |
| `HEALTH_CALCULATION_ERROR` | 500 | Failed to calculate portfolio health |
| `BATCH_ADD_ERROR` | 500 | Batch add operation failed |
| `BATCH_DELETE_ERROR` | 500 | Batch delete operation failed |
| `BATCH_LIMIT_EXCEEDED` | 400 | Exceeded max items per batch request |
| `ACTIVITY_FETCH_ERROR` | 500 | Failed to fetch recent activity |
| `EXPORT_ERROR` | 500 | Export operation failed |
| `UPDATE_ERROR` | 500 | Failed to update investment |
| `INVALID_REQUEST` | 400 | Missing or invalid request parameters |
| `NO_UPDATES` | 400 | No fields provided to update |
| `NOT_FOUND` | 404 | Investment not found |

---

## Testing with Postman

### Collection Setup

1. **Create Collection:** "CS2 Portfolio API"
2. **Set Base URL Variable:** `{{baseUrl}}` = `http://localhost:3002`
3. **Import Endpoints** from the examples above

### Example Postman Test Script

```javascript
// Test: Add Investment
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has success field", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('success');
    pm.expect(jsonData.success).to.be.true;
});

pm.test("Response contains investment ID", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.investment).to.have.property('id');
    pm.environment.set("lastInvestmentId", jsonData.investment.id);
});
```

---

## Rate Limiting

**Current Status:** No rate limiting implemented
**Production Plan:**
- 100 requests per minute per user
- 1000 requests per hour per user
- Burst allowance: 20 requests

---

## Changelog

### Version 1.1.0 (October 30, 2025) - Enhanced Edition
- **7 new enhanced endpoints** added (total: 13 endpoints)
- ✅ Asset allocation breakdown by category
- ✅ Portfolio health metrics (diversity, risk, liquidity scores)
- ✅ Batch operations (add up to 50, delete up to 100 items)
- ✅ Recent activity tracking with pagination
- ✅ Export functionality (CSV/JSON)
- ✅ Update investment endpoint
- Error code standardization across all endpoints
- Inspired by SkinWatch and SkinVault patterns
- Item categorization system (11 categories: Knives, Rifles, Snipers, Pistols, SMGs, Heavy, Cases, Keys, Stickers, Capsules, Agents, Other)

### Version 1.0.0 (October 30, 2025)
- Initial release
- 6 core endpoints implemented
- Investment scoring algorithm (weighted 1-10 scale)
- Blue Gem pattern detection (AK-47, 14 patterns)
- PostgreSQL database integration
- Real-time price enrichment
- Database schema with 6 tables

### Planned Features (v2.0.0)
- Daily portfolio snapshots (automated)
- Historical performance charts
- Email/webhook notifications for price changes
- More pattern detection (Fade %, Doppler phases, Crimson Web)
- WebSocket support for real-time updates
- Advanced filtering and sorting options

---

## Support

**API Issues:** Create an issue in the GitHub repository
**Questions:** Contact development team
**Documentation Updates:** Pull requests welcome

---

## License

Internal use only. Not for public distribution.
