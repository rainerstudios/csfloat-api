#!/bin/bash

# CSFloat Bot Monitor - Discord Notifications
# Checks if bots are online and sends Discord webhook if any are offline

# Configuration
API_URL="http://localhost:3002/stats"
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/1430175040204181520/2DVFasIxOCS_khJOGuELpejAnxpk3Ho5evI7qOM5aHXXQzrfkcFdTnjDSKnYWqMdUyVo"
STATE_FILE="/tmp/csfloat-bot-monitor-state"

# Fetch bot stats
STATS=$(curl -s "$API_URL")

# Extract values using grep/sed (works without jq)
BOTS_ONLINE=$(echo "$STATS" | grep -o '"bots_online":[0-9]*' | grep -o '[0-9]*')
BOTS_TOTAL=$(echo "$STATS" | grep -o '"bots_total":[0-9]*' | grep -o '[0-9]*')
QUEUE_SIZE=$(echo "$STATS" | grep -o '"queue_size":[0-9]*' | grep -o '[0-9]*')

# Check if we got valid data
if [ -z "$BOTS_ONLINE" ] || [ -z "$BOTS_TOTAL" ]; then
    echo "Error: Failed to fetch bot stats"
    exit 1
fi

# Current timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S UTC')

# Check if bots are offline
if [ "$BOTS_ONLINE" -lt "$BOTS_TOTAL" ]; then
    # Check if we've already sent an alert (to avoid spam)
    if [ ! -f "$STATE_FILE" ]; then
        # Create state file to track that we've alerted
        echo "offline" > "$STATE_FILE"

        # Determine alert color and message
        if [ "$BOTS_ONLINE" -eq 0 ]; then
            COLOR=15158332  # Red
            SEVERITY="🚨 CRITICAL"
        else
            COLOR=16776960  # Yellow
            SEVERITY="⚠️ WARNING"
        fi

        BOTS_OFFLINE=$((BOTS_TOTAL - BOTS_ONLINE))

        # Send Discord webhook
        curl -H "Content-Type: application/json" \
             -X POST \
             -d "{
                \"embeds\": [{
                    \"title\": \"$SEVERITY: CSFloat Bots Offline\",
                    \"description\": \"**$BOTS_OFFLINE out of $BOTS_TOTAL bots are offline!**\",
                    \"color\": $COLOR,
                    \"fields\": [
                        {\"name\": \"Bots Online\", \"value\": \"$BOTS_ONLINE/$BOTS_TOTAL\", \"inline\": true},
                        {\"name\": \"Queue Size\", \"value\": \"$QUEUE_SIZE\", \"inline\": true},
                        {\"name\": \"Time\", \"value\": \"$TIMESTAMP\", \"inline\": false}
                    ],
                    \"footer\": {\"text\": \"CSFloat API Monitor\"}
                }]
             }" \
             "$DISCORD_WEBHOOK_URL"

        echo "[$TIMESTAMP] Alert sent: $BOTS_ONLINE/$BOTS_TOTAL bots online"
    else
        echo "[$TIMESTAMP] Bots still offline ($BOTS_ONLINE/$BOTS_TOTAL), alert already sent"
    fi
else
    # All bots are online
    if [ -f "$STATE_FILE" ]; then
        # Bots came back online, send recovery notification
        rm "$STATE_FILE"

        curl -H "Content-Type: application/json" \
             -X POST \
             -d "{
                \"embeds\": [{
                    \"title\": \"✅ RECOVERED: All CSFloat Bots Online\",
                    \"description\": \"All bots have successfully reconnected!\",
                    \"color\": 3066993,
                    \"fields\": [
                        {\"name\": \"Bots Online\", \"value\": \"$BOTS_ONLINE/$BOTS_TOTAL\", \"inline\": true},
                        {\"name\": \"Queue Size\", \"value\": \"$QUEUE_SIZE\", \"inline\": true},
                        {\"name\": \"Time\", \"value\": \"$TIMESTAMP\", \"inline\": false}
                    ],
                    \"footer\": {\"text\": \"CSFloat API Monitor\"}
                }]
             }" \
             "$DISCORD_WEBHOOK_URL"

        echo "[$TIMESTAMP] Recovery alert sent: All bots online"
    else
        echo "[$TIMESTAMP] All bots online ($BOTS_ONLINE/$BOTS_TOTAL)"
    fi
fi
