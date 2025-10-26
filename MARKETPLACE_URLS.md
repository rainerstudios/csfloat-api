# 🔗 Marketplace URLs - Complete Guide

## ✅ **IMPLEMENTED**

Your API now returns direct marketplace links with every price check! Users can click to buy instantly.

---

## 📊 **API Response Format**

### Example Response:
```json
{
  "success": true,
  "name": "AK-47 | Redline (Field-Tested)",
  "prices": {
    "buff163": {
      "price_usd": 28.50,
      "price_cny": 202.96,
      "listings": 8387,
      "updated": "2025-10-26T16:47:18.000Z",
      "url": "https://buff.163.com/market/csgo#tab=selling&page_num=1&search=AK-47%20%7C%20Redline%20(Field-Tested)"
    },
    "skinport": {
      "price_usd": 33.40,
      "price_eur": 28.73,
      "listings": 425,
      "updated": "2025-10-26T16:50:30.000Z",
      "url": "https://skinport.com/market?search=AK-47%20%7C%20Redline%20(Field-Tested)"
    },
    "marketCsgo": {
      "price_usd": 38.66,
      "listings": 129,
      "updated": "2025-10-26T16:50:25.000Z",
      "url": "https://cs.money/csgo/trade/?search=AK-47%20%7C%20Redline%20(Field-Tested)"
    },
    "csfloat": {
      "price_usd": 45.20,
      "listings": 234,
      "updated": "2025-10-26T16:51:00.000Z",
      "url": "https://csfloat.com/search?search=AK-47%20%7C%20Redline%20(Field-Tested)"
    },
    "steam": {
      "price_usd": 42.50,
      "volume": 156,
      "updated": "2025-10-26T16:52:00.000Z",
      "url": "https://steamcommunity.com/market/listings/730/AK-47%20%7C%20Redline%20(Field-Tested)"
    }
  },
  "lowestPrice": 28.50,
  "highestPrice": 45.20
}
```

---

## 🔗 **Supported Marketplaces**

| Market | Base URL | Status |
|--------|----------|--------|
| **Buff163** | `https://buff.163.com/market/csgo` | ✅ Working |
| **Skinport** | `https://skinport.com/market` | ✅ Working |
| **CS.MONEY** | `https://cs.money/csgo/trade/` | ✅ Working |
| **CSFloat** | `https://csfloat.com/search` | ✅ Working |
| **Steam Market** | `https://steamcommunity.com/market/listings/730/` | ✅ Working |
| **SkinBaron** | `https://skinbaron.de/offers` | ✅ Working |
| **GamerPay** | `https://gamerpay.gg/en/csgo/` | ✅ Working |
| **WaxPeer** | `https://waxpeer.com/csgo` | ✅ Working |
| **DMarket** | `https://dmarket.com/ingame-items/item-list/csgo-skins` | ✅ Working |
| **ShadowPay** | `https://shadowpay.com/en/csgo` | ✅ Working |

---

## 🎨 **Frontend Integration Examples**

### Example 1: Simple Price List with Buy Links

```javascript
async function displayPrices(itemName) {
  const response = await fetch(`/api/price/${encodeURIComponent(itemName)}`);
  const data = await response.json();

  const priceList = Object.entries(data.prices)
    .filter(([_, market]) => market !== null)
    .sort((a, b) => a[1].price_usd - b[1].price_usd)
    .map(([marketName, market]) => `
      <div class="price-row">
        <span class="market-name">${marketName}</span>
        <span class="price">$${market.price_usd.toFixed(2)}</span>
        <span class="listings">${market.listings} available</span>
        <a href="${market.url}" target="_blank" class="buy-button">
          BUY NOW →
        </a>
      </div>
    `).join('');

  document.getElementById('prices').innerHTML = priceList;
}
```

**Output:**
```html
┌─────────────────────────────────────────────────────┐
│ Buff163     $28.50   8,387 available  [BUY NOW →]  │
│ Skinport    $33.40     425 available  [BUY NOW →]  │
│ CS.MONEY    $38.66     129 available  [BUY NOW →]  │
│ CSFloat     $45.20     234 available  [BUY NOW →]  │
└─────────────────────────────────────────────────────┘
```

---

### Example 2: Highlight Best Deal

```javascript
function displayBestDeal(priceData) {
  const markets = Object.entries(priceData.prices)
    .filter(([_, market]) => market !== null)
    .sort((a, b) => a[1].price_usd - b[1].price_usd);

  const [bestMarket, bestPrice] = markets[0];
  const savings = priceData.highestPrice - bestPrice.price_usd;
  const savingsPercent = ((savings / priceData.highestPrice) * 100).toFixed(1);

  return `
    <div class="best-deal">
      <div class="deal-header">🔥 BEST DEAL</div>
      <div class="market-name">${bestMarket.toUpperCase()}</div>
      <div class="price-large">$${bestPrice.price_usd.toFixed(2)}</div>
      <div class="savings">Save $${savings.toFixed(2)} (${savingsPercent}%)</div>
      <a href="${bestPrice.url}" target="_blank" class="buy-now-button">
        BUY ON ${bestMarket.toUpperCase()} →
      </a>
      <div class="listings">${bestPrice.listings} listings available</div>
    </div>
  `;
}
```

**Output:**
```
┌─────────────────────────────┐
│      🔥 BEST DEAL           │
│                             │
│        BUFF163              │
│        $28.50               │
│  Save $16.70 (37.0%)        │
│                             │
│  [ BUY ON BUFF163 → ]       │
│                             │
│  8,387 listings available   │
└─────────────────────────────┘
```

---

### Example 3: Compare All Markets Table

```javascript
function createPriceComparisonTable(priceData) {
  const rows = Object.entries(priceData.prices)
    .filter(([_, market]) => market !== null)
    .sort((a, b) => a[1].price_usd - b[1].price_usd)
    .map(([marketName, market]) => {
      const diff = market.price_usd - priceData.lowestPrice;
      const diffPercent = ((diff / priceData.lowestPrice) * 100).toFixed(1);
      const isCheapest = market.price_usd === priceData.lowestPrice;

      return `
        <tr class="${isCheapest ? 'cheapest' : ''}">
          <td>
            ${isCheapest ? '🏆' : ''}
            <strong>${marketName}</strong>
          </td>
          <td class="price">$${market.price_usd.toFixed(2)}</td>
          <td class="difference">
            ${isCheapest ? 'CHEAPEST' : `+$${diff.toFixed(2)} (+${diffPercent}%)`}
          </td>
          <td class="listings">${market.listings} items</td>
          <td>
            <a href="${market.url}" target="_blank" class="link-button">
              Visit →
            </a>
          </td>
        </tr>
      `;
    }).join('');

  return `
    <table class="price-comparison">
      <thead>
        <tr>
          <th>Market</th>
          <th>Price</th>
          <th>Difference</th>
          <th>Listings</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}
```

**Output:**
```
┌──────────────┬─────────┬─────────────┬──────────┬──────────┐
│ Market       │ Price   │ Difference  │ Listings │ Action   │
├──────────────┼─────────┼─────────────┼──────────┼──────────┤
│ 🏆 Buff163   │ $28.50  │ CHEAPEST    │ 8,387    │ Visit →  │
│ Skinport     │ $33.40  │ +$4.90 (17%)│   425    │ Visit →  │
│ CS.MONEY     │ $38.66  │ +$10.16(36%)│   129    │ Visit →  │
│ CSFloat      │ $45.20  │ +$16.70(59%)│   234    │ Visit →  │
└──────────────┴─────────┴─────────────┴──────────┴──────────┘
```

---

### Example 4: Chrome Extension - Quick Buy Button

```javascript
// Inject buy buttons on CSFloat listings
function addQuickBuyButtons(itemCard) {
  const itemName = itemCard.querySelector('.item-name').textContent;
  const currentPrice = parseFloat(itemCard.querySelector('.price').textContent.replace('$', ''));

  fetch(`https://api.cs2floatchecker.com/api/price/${encodeURIComponent(itemName)}`)
    .then(r => r.json())
    .then(data => {
      // Find cheapest market
      const markets = Object.entries(data.prices)
        .filter(([_, market]) => market !== null)
        .sort((a, b) => a[1].price_usd - b[1].price_usd);

      const [cheapestMarket, cheapestPrice] = markets[0];

      if (cheapestPrice.price_usd < currentPrice) {
        const savings = currentPrice - cheapestPrice.price_usd;
        const savingsPercent = ((savings / currentPrice) * 100).toFixed(1);

        const button = `
          <div class="cheaper-option">
            💰 Cheaper on ${cheapestMarket}: $${cheapestPrice.price_usd.toFixed(2)}
            (Save $${savings.toFixed(2)} / ${savingsPercent}%)
            <a href="${cheapestPrice.url}" target="_blank" class="buy-cheaper">
              BUY HERE →
            </a>
          </div>
        `;

        itemCard.querySelector('.price').insertAdjacentHTML('afterend', button);
      }
    });
}
```

**Result on CSFloat:**
```
╔═══════════════════════════════════════════╗
║ AK-47 | Redline (Field-Tested)            ║
║ Float: 0.18                               ║
║ Price: $45.20                             ║
║                                           ║
║ 💰 Cheaper on Buff163: $28.50            ║
║ (Save $16.70 / 37.0%)                    ║
║ [ BUY HERE → ]                           ║
╚═══════════════════════════════════════════╝
```

---

### Example 5: Mobile-Friendly Price Cards

```javascript
function createMobilePriceCards(priceData) {
  return Object.entries(priceData.prices)
    .filter(([_, market]) => market !== null)
    .sort((a, b) => a[1].price_usd - b[1].price_usd)
    .map(([marketName, market]) => {
      const isCheapest = market.price_usd === priceData.lowestPrice;

      return `
        <div class="price-card ${isCheapest ? 'best-price' : ''}">
          ${isCheapest ? '<div class="badge">BEST PRICE</div>' : ''}
          <div class="market-icon">
            <img src="/icons/${marketName}.png" alt="${marketName}">
          </div>
          <div class="market-info">
            <div class="market-name">${marketName}</div>
            <div class="price">${market.price_usd.toFixed(2)} USD</div>
            <div class="listings">${market.listings} available</div>
          </div>
          <a href="${market.url}" target="_blank" class="buy-button">
            BUY
          </a>
        </div>
      `;
    }).join('');
}
```

---

## 🎨 **CSS Styling Examples**

```css
/* Price comparison table */
.price-comparison {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
}

.price-comparison th {
  background: #2a2a2a;
  padding: 0.75rem;
  text-align: left;
  font-weight: bold;
}

.price-comparison td {
  padding: 0.75rem;
  border-bottom: 1px solid #333;
}

.price-comparison tr.cheapest {
  background: linear-gradient(135deg, #1e1e1e 0%, #1a2d1a 100%);
  border-left: 4px solid #4caf50;
}

.link-button {
  display: inline-block;
  padding: 0.5rem 1rem;
  background: #2196f3;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  transition: background 0.3s;
}

.link-button:hover {
  background: #1976d2;
}

/* Best deal card */
.best-deal {
  background: linear-gradient(135deg, #1e1e1e 0%, #2d1a1a 100%);
  border: 2px solid #ffd700;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  margin: 2rem 0;
}

.deal-header {
  font-size: 0.9rem;
  color: #ffd700;
  font-weight: bold;
  margin-bottom: 0.5rem;
}

.price-large {
  font-size: 3rem;
  font-weight: bold;
  color: #4caf50;
  margin: 1rem 0;
}

.savings {
  font-size: 1.2rem;
  color: #ffd700;
  margin-bottom: 1.5rem;
}

.buy-now-button {
  display: inline-block;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-size: 1.1rem;
  font-weight: bold;
  transition: transform 0.2s;
}

.buy-now-button:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
}

/* Mobile price cards */
.price-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #2a2a2a;
  border-radius: 8px;
  margin-bottom: 1rem;
  position: relative;
}

.price-card.best-price {
  background: linear-gradient(135deg, #2a2a2a 0%, #1a2d1a 100%);
  border: 2px solid #4caf50;
}

.price-card .badge {
  position: absolute;
  top: -10px;
  left: 10px;
  background: #4caf50;
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: bold;
}

.market-icon img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.market-info {
  flex: 1;
}

.market-info .price {
  font-size: 1.2rem;
  font-weight: bold;
  color: #4caf50;
}

.price-card .buy-button {
  padding: 0.5rem 1.5rem;
  background: #2196f3;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  font-weight: bold;
}
```

---

## 🚀 **Advanced Features**

### Feature 1: Price Drop Alerts

```javascript
async function checkPriceDrops(itemName, targetPrice) {
  const data = await fetch(`/api/price/${encodeURIComponent(itemName)}`)
    .then(r => r.json());

  const dealsUnderTarget = Object.entries(data.prices)
    .filter(([_, market]) => market !== null && market.price_usd <= targetPrice)
    .map(([marketName, market]) => ({
      market: marketName,
      price: market.price_usd,
      url: market.url,
      savings: targetPrice - market.price_usd
    }));

  if (dealsUnderTarget.length > 0) {
    return `
      🚨 PRICE ALERT! ${itemName} is under $${targetPrice}!

      ${dealsUnderTarget.map(deal => `
        ${deal.market}: $${deal.price} (Save $${deal.savings.toFixed(2)})
        Buy now: ${deal.url}
      `).join('\n')}
    `;
  }
}
```

### Feature 2: Arbitrage Opportunities

```javascript
function findArbitrageOpportunities(priceData) {
  const markets = Object.entries(priceData.prices)
    .filter(([_, market]) => market !== null)
    .sort((a, b) => a[1].price_usd - b[1].price_usd);

  const [buyMarket, buyPrice] = markets[0];
  const [sellMarket, sellPrice] = markets[markets.length - 1];

  const profit = sellPrice.price_usd - buyPrice.price_usd;
  const profitPercent = ((profit / buyPrice.price_usd) * 100).toFixed(1);

  if (profit > 5) {
    return {
      profitable: true,
      buyFrom: {
        market: buyMarket,
        price: buyPrice.price_usd,
        url: buyPrice.url
      },
      sellTo: {
        market: sellMarket,
        price: sellPrice.price_usd,
        url: sellPrice.url
      },
      profit: profit,
      profitPercent: profitPercent
    };
  }

  return { profitable: false };
}
```

---

## ✅ **Summary**

**What You Get:**
- ✅ Direct buy links for 10+ marketplaces
- ✅ URL encoding handles special characters (★, |, etc.)
- ✅ Works with all item types (skins, knives, gloves)
- ✅ Ready for Chrome extension integration
- ✅ Mobile-friendly implementation

**Supported Features:**
- Price comparison tables
- Best deal highlights
- Quick buy buttons
- Arbitrage detection
- Price drop alerts
- Mobile cards

**Next Steps:**
1. Add marketplace icons to your frontend
2. Implement "Buy Now" buttons in Chrome extension
3. Add price comparison tooltips
4. Enable arbitrage alerts

---

Last Updated: October 26, 2025
