#!/bin/bash

# Monitor API capacity and alert when scaling needed

API_URL="http://localhost:3002/stats"

while true; do
    # Get stats
    STATS=$(curl -s $API_URL)
    BOTS_ONLINE=$(echo $STATS | python3 -c "import sys, json; print(json.load(sys.stdin)['bots_online'])")
    BOTS_TOTAL=$(echo $STATS | python3 -c "import sys, json; print(json.load(sys.stdin)['bots_total'])")
    QUEUE_SIZE=$(echo $STATS | python3 -c "import sys, json; print(json.load(sys.stdin)['queue_size'])")

    # Calculate percentage
    if [ "$BOTS_TOTAL" -gt 0 ]; then
        BOT_PERCENTAGE=$((BOTS_ONLINE * 100 / BOTS_TOTAL))
    else
        BOT_PERCENTAGE=0
    fi

    # Clear screen and show status
    clear
    echo "=========================================="
    echo "CS2 Float API - Capacity Monitor"
    echo "=========================================="
    echo "Timestamp: $(date)"
    echo ""
    echo "Bots Online: $BOTS_ONLINE / $BOTS_TOTAL ($BOT_PERCENTAGE%)"
    echo "Queue Size: $QUEUE_SIZE"
    echo ""

    # Alert thresholds
    if [ "$QUEUE_SIZE" -gt 100 ]; then
        echo "🚨 CRITICAL: Queue > 100! ADD 4-8 BOTS NOW!"
    elif [ "$QUEUE_SIZE" -gt 50 ]; then
        echo "⚠️  WARNING: Queue > 50. Consider adding 2-4 bots"
    elif [ "$QUEUE_SIZE" -gt 20 ]; then
        echo "⚡ NOTICE: Queue > 20. Monitor closely"
    else
        echo "✅ OK: System running smoothly"
    fi

    echo ""
    echo "Capacity: $(($BOTS_ONLINE * 55)) requests/min"
    echo ""
    echo "Press Ctrl+C to exit"
    echo "=========================================="

    sleep 5
done
