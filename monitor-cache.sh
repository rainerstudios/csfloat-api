#!/bin/bash

# CSFloat Cache Monitor with Discord Notifications
# Monitors cache performance and sends daily reports

DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/1430175040204181520/2DVFasIxOCS_khJOGuELpejAnxpk3Ho5evI7qOM5aHXXQzrfkcFdTnjDSKnYWqMdUyVo"
STATE_FILE="/tmp/csfloat-cache-monitor-state"

# Get cache statistics
TOTAL_ITEMS=$(sudo -u postgres psql -d cs2floatapi -t -c "SELECT COUNT(*) FROM items;" | xargs)
ITEMS_1H=$(sudo -u postgres psql -d cs2floatapi -t -c "SELECT COUNT(*) FROM items WHERE updated > NOW() - INTERVAL '1 hour';" | xargs)
ITEMS_24H=$(sudo -u postgres psql -d cs2floatapi -t -c "SELECT COUNT(*) FROM items WHERE updated > NOW() - INTERVAL '24 hours';" | xargs)
ITEMS_7D=$(sudo -u postgres psql -d cs2floatapi -t -c "SELECT COUNT(*) FROM items WHERE updated > NOW() - INTERVAL '7 days';" | xargs)

# Get top weapons
TOP_WEAPONS=$(sudo -u postgres psql -d cs2floatapi -t -c "
    SELECT weapon_type || ': ' || COUNT(*)
    FROM (
        SELECT CASE defindex
            WHEN 7 THEN 'AK-47'
            WHEN 9 THEN 'AWP'
            WHEN 16 THEN 'M4A4'
            WHEN 60 THEN 'M4A1-S'
            WHEN 40 THEN 'USP-S'
            WHEN 4 THEN 'Glock-18'
            WHEN 1 THEN 'Desert Eagle'
            ELSE 'Other'
        END as weapon_type
        FROM items
    ) AS weapons
    GROUP BY weapon_type
    ORDER BY COUNT(*) DESC
    LIMIT 5;
" | sed 's/^/• /' | sed 's/|//g')

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S UTC')

# Calculate cache health
if [ "$TOTAL_ITEMS" -gt 1000 ]; then
    HEALTH="🟢 Excellent"
    COLOR=3066993  # Green
elif [ "$TOTAL_ITEMS" -gt 100 ]; then
    HEALTH="🟡 Good"
    COLOR=16776960  # Yellow
else
    HEALTH="🟠 Building"
    COLOR=16744192  # Orange
fi

# Estimate cache hit rate (items used in last hour vs last 24h)
if [ "$ITEMS_24H" -gt 0 ]; then
    CACHE_HIT_ESTIMATE=$(awk "BEGIN {printf \"%.0f\", (($ITEMS_1H / $ITEMS_24H) * 100)}")
else
    CACHE_HIT_ESTIMATE="N/A"
fi

# Check if we should send an alert (once per day)
LAST_REPORT_DATE=""
if [ -f "$STATE_FILE" ]; then
    LAST_REPORT_DATE=$(cat "$STATE_FILE")
fi

TODAY=$(date '+%Y-%m-%d')

# Only send report if it's a new day OR if cache is low
SHOULD_SEND=false
if [ "$LAST_REPORT_DATE" != "$TODAY" ]; then
    SHOULD_SEND=true
elif [ "$TOTAL_ITEMS" -lt 50 ]; then
    SHOULD_SEND=true
fi

if [ "$SHOULD_SEND" = true ]; then
    # Send Discord webhook
    curl -H "Content-Type: application/json" \
         -X POST \
         -d "{
            \"embeds\": [{
                \"title\": \"📊 CSFloat Cache Report\",
                \"description\": \"Daily cache performance summary\",
                \"color\": $COLOR,
                \"fields\": [
                    {\"name\": \"Cache Health\", \"value\": \"$HEALTH\", \"inline\": true},
                    {\"name\": \"Total Items Cached\", \"value\": \"$TOTAL_ITEMS\", \"inline\": true},
                    {\"name\": \"Activity (1h)\", \"value\": \"$ITEMS_1H requests\", \"inline\": true},
                    {\"name\": \"Activity (24h)\", \"value\": \"$ITEMS_24H requests\", \"inline\": true},
                    {\"name\": \"Activity (7d)\", \"value\": \"$ITEMS_7D requests\", \"inline\": true},
                    {\"name\": \"Est. Cache Hit Rate\", \"value\": \"~$CACHE_HIT_ESTIMATE%\", \"inline\": true},
                    {\"name\": \"Top Cached Weapons\", \"value\": \"$TOP_WEAPONS\", \"inline\": false}
                ],
                \"footer\": {\"text\": \"CSFloat Cache Monitor • $TIMESTAMP\"}
            }]
         }" \
         "$DISCORD_WEBHOOK_URL" > /dev/null 2>&1

    # Update state file
    echo "$TODAY" > "$STATE_FILE"
    echo "[$TIMESTAMP] Cache report sent to Discord"
else
    echo "[$TIMESTAMP] Report already sent today. Cache: $TOTAL_ITEMS items, Activity: $ITEMS_1H/hour"
fi
