#!/bin/bash

# Auto Proxy Rotation Script
# Automatically tests proxies and updates config if primary proxies fail
# Run this via cron every hour or when bots disconnect

PROXIES=(
    "31.59.20.176:6754"
    "45.38.107.97:6014"
    "198.23.239.134:6540"
    "107.172.163.27:6543"
    "64.137.96.74:6641"
    "216.10.27.159:6837"
    "142.111.67.146:5611"
    "142.147.128.93:6593"
)

PROXY_USER="pjukyfij"
PROXY_PASS="3q9caatdky72"
CONFIG_FILE="/var/www/csfloat-api/config.js"
WORKING_PROXIES=()
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$TIMESTAMP] === Auto Proxy Rotation Check ==="

# Test each proxy
for proxy in "${PROXIES[@]}"; do
    echo -n "Testing $proxy... "

    # Test proxy with 5 second timeout
    RESULT=$(curl --connect-timeout 5 --max-time 5 \
        --proxy "http://$PROXY_USER:$PROXY_PASS@$proxy/" \
        https://ipv4.webshare.io/ 2>&1)

    if echo "$RESULT" | grep -qE "^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$"; then
        echo "✅ OK"
        WORKING_PROXIES+=("$proxy")
    else
        echo "❌ FAILED"
    fi
done

echo ""
echo "Working proxies: ${#WORKING_PROXIES[@]}/${#PROXIES[@]}"

# Ensure we have at least 3 working proxies
if [ ${#WORKING_PROXIES[@]} -lt 3 ]; then
    echo "⚠️  ERROR: Only ${#WORKING_PROXIES[@]} working proxies found (need minimum 3)"
    echo "Service may experience issues. Manual intervention required."
    exit 1
fi

# Read current proxies from config - simpler extraction
CURRENT_PROXIES=$(grep "http://$PROXY_USER:$PROXY_PASS@" "$CONFIG_FILE" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:[0-9]+" | head -3)
CURRENT_PROXY_1=$(echo "$CURRENT_PROXIES" | sed -n '1p')
CURRENT_PROXY_2=$(echo "$CURRENT_PROXIES" | sed -n '2p')
CURRENT_PROXY_3=$(echo "$CURRENT_PROXIES" | sed -n '3p')

echo ""
echo "Current config proxies (first 3):"
echo "  Bot 0: $CURRENT_PROXY_1"
echo "  Bot 1: $CURRENT_PROXY_2"
echo "  Bot 2: $CURRENT_PROXY_3"

# Check if current proxies are still working
NEEDS_UPDATE=false

if ! [[ " ${WORKING_PROXIES[@]} " =~ " ${CURRENT_PROXY_1} " ]]; then
    echo "⚠️  Bot 0 proxy ($CURRENT_PROXY_1) is DOWN - needs rotation"
    NEEDS_UPDATE=true
fi

if ! [[ " ${WORKING_PROXIES[@]} " =~ " ${CURRENT_PROXY_2} " ]]; then
    echo "⚠️  Bot 1 proxy ($CURRENT_PROXY_2) is DOWN - needs rotation"
    NEEDS_UPDATE=true
fi

if ! [[ " ${WORKING_PROXIES[@]} " =~ " ${CURRENT_PROXY_3} " ]]; then
    echo "⚠️  Bot 2 proxy ($CURRENT_PROXY_3) is DOWN - needs rotation"
    NEEDS_UPDATE=true
fi

if [ "$NEEDS_UPDATE" = false ]; then
    echo "✅ All current proxies are working - no rotation needed"
    exit 0
fi

# Backup current config
cp "$CONFIG_FILE" "${CONFIG_FILE}.backup.$(date +%s)"
echo ""
echo "📝 Updating proxy configuration..."

# Build new proxy array
PROXY_LINES=""
for i in "${!WORKING_PROXIES[@]}"; do
    proxy="${WORKING_PROXIES[$i]}"

    # Add comment based on position
    if [ $i -eq 0 ]; then
        comment="Bot 0 (xgamingserver3)"
    elif [ $i -eq 1 ]; then
        comment="Bot 1 (xgamingserver1)"
    elif [ $i -eq 2 ]; then
        comment="Bot 2 (johnsonk01)"
    else
        comment="Backup proxy $((i+1))"
    fi

    PROXY_LINES+="        'http://$PROXY_USER:$PROXY_PASS@$proxy/',          // $comment ✅"$'\n'
done

# Use awk to replace the proxies section
awk -v proxies="$PROXY_LINES" '
    /^    .proxies.: \[/ {
        print
        print proxies
        # Skip until closing bracket
        while (getline > 0) {
            if (/^    \],/) {
                print
                break
            }
        }
        next
    }
    { print }
' "$CONFIG_FILE" > "${CONFIG_FILE}.tmp" && mv "${CONFIG_FILE}.tmp" "$CONFIG_FILE"

echo "✅ Config updated with working proxies"
echo ""
echo "🔄 Restarting CSFloat API service..."

# Restart the pm2 service (correct name: cs2-float-api)
pm2 restart cs2-float-api

echo "✅ Service restarted"
echo ""
echo "[$TIMESTAMP] Proxy rotation completed successfully"

# Wait a few seconds and check bot status
sleep 5
echo ""
echo "Bot status after rotation:"
curl -s http://localhost:3002/stats | grep -o '"bots_online":[0-9]*' || echo "Could not fetch status"
