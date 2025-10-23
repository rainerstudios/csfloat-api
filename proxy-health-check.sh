#!/bin/bash

# Proxy Health Checker with Auto-Rotation
# Tests all proxies and updates config if primary proxies fail

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

echo "=== Proxy Health Check ==="
echo ""

WORKING_PROXIES=()

for proxy in "${PROXIES[@]}"; do
    echo -n "Testing $proxy... "

    # Test proxy with 5 second timeout
    RESULT=$(curl --connect-timeout 5 --max-time 5 \
        --proxy "http://$PROXY_USER:$PROXY_PASS@$proxy/" \
        https://ipv4.webshare.io/ 2>&1)

    if echo "$RESULT" | grep -qE "^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$"; then
        echo "✅ OK"
        WORKING_PROXIES+=("http://$PROXY_USER:$PROXY_PASS@$proxy/")
    else
        echo "❌ FAILED (timeout or error)"
    fi
done

echo ""
echo "=== Results ==="
echo "Working Proxies: ${#WORKING_PROXIES[@]}"
echo "Failed Proxies: $((${#PROXIES[@]} - ${#WORKING_PROXIES[@]}))"
echo ""

if [ ${#WORKING_PROXIES[@]} -ge 3 ]; then
    echo "✅ Enough working proxies (${#WORKING_PROXIES[@]}/3 needed)"
    echo ""
    echo "Top 3 working proxies for config:"
    for i in {0..2}; do
        if [ $i -lt ${#WORKING_PROXIES[@]} ]; then
            echo "  Proxy $i: ${WORKING_PROXIES[$i]}"
        fi
    done
else
    echo "⚠️  WARNING: Only ${#WORKING_PROXIES[@]} working proxies (need 3)"
    echo "Consider running without proxies temporarily"
fi
