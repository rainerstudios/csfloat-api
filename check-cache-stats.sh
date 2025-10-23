#!/bin/bash

# Cache Statistics Monitor
# Run this to see how well your cache is performing

echo "=== CSFloat Cache Statistics ==="
echo ""

# Total cached items
TOTAL=$(sudo -u postgres psql -d cs2floatapi -t -c "SELECT COUNT(*) FROM items;")
echo "Total Cached Items: $TOTAL"

# Items cached in last hour
RECENT=$(sudo -u postgres psql -d cs2floatapi -t -c "SELECT COUNT(*) FROM items WHERE updated > NOW() - INTERVAL '1 hour';")
echo "Cached (Last Hour): $RECENT"

# Items cached in last 24h
DAY=$(sudo -u postgres psql -d cs2floatapi -t -c "SELECT COUNT(*) FROM items WHERE updated > NOW() - INTERVAL '24 hours';")
echo "Cached (Last 24h): $DAY"

# Most popular weapons
echo ""
echo "Top 5 Most Cached Weapons:"
sudo -u postgres psql -d cs2floatapi -t -c "
    SELECT weapon_type, COUNT(*) as count
    FROM (
        SELECT defindex,
               CASE defindex
                   WHEN 7 THEN 'AK-47'
                   WHEN 9 THEN 'AWP'
                   WHEN 16 THEN 'M4A4'
                   WHEN 60 THEN 'M4A1-S'
                   WHEN 40 THEN 'USP-S'
                   ELSE 'Other'
               END as weapon_type
        FROM items
    ) AS weapons
    GROUP BY weapon_type
    ORDER BY count DESC
    LIMIT 5;
" | sed 's/^/  /'

echo ""
echo "Cache Health: $(if [ $TOTAL -gt 100 ]; then echo '✅ Excellent'; elif [ $TOTAL -gt 10 ]; then echo '✅ Good'; else echo '⚠️  Building...'; fi)"
