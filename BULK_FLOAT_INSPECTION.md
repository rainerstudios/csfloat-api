# Bulk Float Inspection Endpoint

## Overview

The `/bulk` endpoint allows you to check float values for multiple CS2 items simultaneously by submitting multiple Steam inspect links in a single request.

**Endpoint:** `POST /bulk`

---

## Request Format

### Headers
```
Content-Type: application/json
```

### Body
```json
{
  "links": [
    {
      "link": "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749846A28447481800D7935523737682443036"
    },
    {
      "link": "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749846A28447481801D7935523737682443037"
    },
    {
      "link": "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749846A28447481802D7935523737682443038"
    }
  ]
}
```

### Optional Fields

**bulk_key** (optional): If configured in `config.js`, you must provide this key for authentication.
```json
{
  "bulk_key": "your-secret-key",
  "links": [ ... ]
}
```

**price** (optional): Submit price data for an item (requires `priceKey` configuration).
```json
{
  "links": [
    {
      "link": "steam://...",
      "price": 3500
    }
  ]
}
```

---

## Configuration

### Maximum Simultaneous Requests

Check your `config.js` for the limit:
```javascript
'max_simultaneous_requests': 50  // Default limit
```

If you exceed this limit, you'll receive an error response.

### Bulk Key (Optional Security)

To require authentication for bulk requests, set in `config.js`:
```javascript
'bulk_key': 'your-secret-key-here'
```

Current configuration: **No authentication required** (empty string)

---

## Response Format

The bulk endpoint returns results for all items in a single response:

```json
{
  "iteminfo": {
    "0": {
      "floatvalue": 0.18245,
      "paintindex": 279,
      "defindex": 7,
      "full_item_name": "AK-47 | Redline (Field-Tested)",
      "weapon_type": "AK-47",
      "item_name": "Redline",
      "rarity": 4,
      "quality": 4,
      "stickers": [],
      "paintwear": 0.18245
    },
    "1": {
      "floatvalue": 0.42156,
      "paintindex": 344,
      "defindex": 9,
      "full_item_name": "AWP | Asiimov (Field-Tested)",
      "weapon_type": "AWP",
      "item_name": "Asiimov",
      "rarity": 4,
      "quality": 4,
      "stickers": [],
      "paintwear": 0.42156
    },
    "2": {
      "floatvalue": 0.07654,
      "paintindex": 282,
      "defindex": 7,
      "full_item_name": "AK-47 | Fire Serpent (Minimal Wear)",
      "weapon_type": "AK-47",
      "item_name": "Fire Serpent",
      "rarity": 6,
      "quality": 4,
      "stickers": [],
      "paintwear": 0.07654
    }
  }
}
```

### Response Fields (per item)

- **floatvalue**: Float value (0.00 - 1.00)
- **paintindex**: Paint seed/pattern index
- **defindex**: Item definition index
- **full_item_name**: Complete item name with wear
- **weapon_type**: Base weapon (e.g., "AK-47", "AWP")
- **item_name**: Skin name (e.g., "Redline", "Asiimov")
- **rarity**: Item rarity (1-6)
- **quality**: Item quality
- **stickers**: Array of applied stickers
- **paintwear**: Paint wear value (same as floatvalue)
- **origin**: Item origin ID
- **imageurl**: Image URL for the item

---

## Error Responses

### Invalid Bulk Key
```json
{
  "error": "Bad Secret"
}
```

### Missing or Empty Links Array
```json
{
  "error": "Bad Request Body"
}
```

### Too Many Requests
```json
{
  "error": "Maximum Simultaneous Requests Exceeded"
}
```

### Invalid Inspect Link
```json
{
  "error": "Invalid Inspect Link"
}
```

---

## Frontend Integration Examples

### Example 1: Basic Bulk Request

```javascript
async function checkMultipleFloats(inspectLinks) {
  const response = await fetch('https://api.cs2floatchecker.com/bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      links: inspectLinks.map(link => ({ link }))
    })
  });

  const data = await response.json();
  return data.iteminfo;
}

// Usage
const links = [
  'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749846A28447481800D7935523737682443036',
  'steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749846A28447481801D7935523737682443037'
];

const results = await checkMultipleFloats(links);
console.log(results);
// { "0": { floatvalue: 0.18, ... }, "1": { floatvalue: 0.42, ... } }
```

### Example 2: Process Inventory Items

```javascript
async function processInventoryFloats(inventoryItems) {
  // Extract inspect links from inventory
  const links = inventoryItems
    .filter(item => item.inspect_link)
    .map(item => ({
      link: item.inspect_link,
      assetid: item.assetid  // Track which item this is
    }));

  // Split into batches of 50 (respect max_simultaneous_requests)
  const batchSize = 50;
  const batches = [];

  for (let i = 0; i < links.length; i += batchSize) {
    batches.push(links.slice(i, i + batchSize));
  }

  // Process all batches
  const allResults = [];
  for (const batch of batches) {
    const response = await fetch('https://api.cs2floatchecker.com/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        links: batch.map(item => ({ link: item.link }))
      })
    });

    const data = await response.json();
    allResults.push(data.iteminfo);
  }

  return allResults;
}
```

### Example 3: Display Float Values in UI

```javascript
async function displayFloatsForItems(items) {
  const inspectLinks = items.map(item => item.inspect_link);

  const response = await fetch('https://api.cs2floatchecker.com/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      links: inspectLinks.map(link => ({ link }))
    })
  });

  const data = await response.json();

  // Map results back to UI items
  items.forEach((item, index) => {
    const floatData = data.iteminfo[index];

    if (floatData) {
      // Add float badge
      const badge = document.createElement('div');
      badge.className = 'float-badge';
      badge.textContent = `Float: ${floatData.floatvalue.toFixed(6)}`;

      // Add rarity tier
      const tier = getWearTier(floatData.floatvalue);
      badge.classList.add(tier);

      item.element.appendChild(badge);
    }
  });
}

function getWearTier(floatValue) {
  if (floatValue < 0.07) return 'factory-new';
  if (floatValue < 0.15) return 'minimal-wear';
  if (floatValue < 0.38) return 'field-tested';
  if (floatValue < 0.45) return 'well-worn';
  return 'battle-scarred';
}
```

### Example 4: Error Handling

```javascript
async function safeBulkFloatCheck(links) {
  try {
    const response = await fetch('https://api.cs2floatchecker.com/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        links: links.map(link => ({ link }))
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Check if response has error field
    if (data.error) {
      throw new Error(data.error);
    }

    return data.iteminfo;

  } catch (error) {
    console.error('Bulk float check failed:', error);

    // Fallback to individual requests
    console.warn('Falling back to individual requests...');
    return await fallbackToIndividualRequests(links);
  }
}

async function fallbackToIndividualRequests(links) {
  const results = {};

  for (let i = 0; i < links.length; i++) {
    try {
      const response = await fetch(
        `https://api.cs2floatchecker.com/?url=${encodeURIComponent(links[i])}`
      );
      const data = await response.json();
      results[i] = data.iteminfo;
    } catch (error) {
      console.error(`Failed to check link ${i}:`, error);
      results[i] = null;
    }
  }

  return results;
}
```

---

## Performance Considerations

### Batch Size
- **Recommended**: 20-50 items per request
- **Maximum**: Configured in `config.js` (default: 50)
- **Optimal**: Smaller batches (20-30) complete faster

### Rate Limiting
The bulk endpoint respects the same rate limits as individual requests:
- Steam rate limits apply per bot
- Bots are shared across all requests
- Large batches may queue if bots are busy

### Queue Behavior
```javascript
// Check queue status before sending large batch
const stats = await fetch('https://api.cs2floatchecker.com/stats').then(r => r.json());

console.log(stats);
// {
//   bots_online: 5,
//   bots_total: 5,
//   queue_size: 12,
//   queue_concurrency: 5
// }

// If queue is large, wait or split into smaller batches
if (stats.queue_size > 50) {
  console.log('Queue is busy, waiting...');
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

---

## Combining with Other Batch Endpoints

You can combine the `/bulk` float inspection with other batch endpoints for comprehensive data:

```javascript
async function getCompleteItemData(inspectLinks) {
  // 1. Get float values in bulk
  const floatResponse = await fetch('https://api.cs2floatchecker.com/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      links: inspectLinks.map(link => ({ link }))
    })
  });
  const floatData = await floatResponse.json();

  // 2. Get prices for all items in bulk
  const itemNames = Object.values(floatData.iteminfo).map(item => item.full_item_name);
  const priceResponse = await fetch('https://api.cs2floatchecker.com/api/batch/prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: itemNames })
  });
  const priceData = await priceResponse.json();

  // 3. Get rarity data in bulk
  const rarityItems = Object.values(floatData.iteminfo).map(item => ({
    defindex: item.defindex,
    paintindex: item.paintindex,
    floatvalue: item.floatvalue
  }));
  const rarityResponse = await fetch('https://api.cs2floatchecker.com/api/batch/rarity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: rarityItems })
  });
  const rarityData = await rarityResponse.json();

  // 4. Combine all data
  const completeData = Object.values(floatData.iteminfo).map((item, index) => ({
    ...item,
    prices: priceData.results[index]?.prices,
    lowestPrice: priceData.results[index]?.lowestPrice,
    rarity: rarityData.results[index]?.rarity
  }));

  return completeData;
}
```

---

## Testing

### Test Bulk Endpoint
```bash
curl -X POST http://localhost:3002/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "links": [
      {
        "link": "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749846A28447481800D7935523737682443036"
      }
    ]
  }'
```

### Test with Multiple Links
```bash
curl -X POST http://localhost:3002/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "links": [
      {"link": "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749846A28447481800D7935523737682443036"},
      {"link": "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749846A28447481801D7935523737682443037"},
      {"link": "steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198084749846A28447481802D7935523737682443038"}
    ]
  }'
```

---

## Summary

**Bulk Float Inspection Endpoint:**
- ✅ Endpoint: `POST /bulk`
- ✅ Process up to 50 inspect links at once
- ✅ No authentication required (by default)
- ✅ Returns complete float data for all items
- ✅ Respects Steam rate limits via bot queue
- ✅ Can be combined with other batch endpoints

**Use Cases:**
- Process inventory items in bulk
- Chrome extension: Check multiple visible items
- Trading tools: Analyze multiple trade offers
- Market scanners: Evaluate large item lists

**Performance:**
- Single request: ~2-5 seconds per item
- Bulk request: ~2-5 seconds for 10-20 items (parallel processing)
- Speed improvement: Up to 10x faster for large batches

---

Last Updated: October 26, 2025
API Version: 2.0 with Complete Batch Support
