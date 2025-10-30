#!/bin/bash
# Database Backup Script
# Usage: ./backup-db.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/var/www/csfloat-api/backup_${TIMESTAMP}.sql"

echo "Starting database backup..."
echo "Backup file: $BACKUP_FILE"

PGPASSWORD='cs2pass123' pg_dump -U cs2user -h 127.0.0.1 cs2floatapi > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup completed successfully!"
    ls -lh "$BACKUP_FILE"
else
    echo "❌ Backup failed!"
    exit 1
fi
