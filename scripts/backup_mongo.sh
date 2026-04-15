#!/usr/bin/env bash
# scripts/backup_mongo.sh
# Run a mongodump to a timestamped folder and keep last N backups

set -euo pipefail

MONGO_URI="${MONGO_URI:-mongodb://localhost:27017/karumande}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mongo/karumande}"
KEEP=${KEEP:-7}

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DEST="$BACKUP_DIR/dump-$TIMESTAMP"

echo "Running mongodump -> $DEST"

mongodump --uri="$MONGO_URI" --archive="$DEST.archive" --gzip

# Create a small metadata file
jq -n --arg ts "$TIMESTAMP" '{timestamp: $ts}' > "$DEST.meta.json" 2>/dev/null || echo '{"timestamp":"'$TIMESTAMP'"}' > "$DEST.meta.json"

echo "Backup completed"

# Prune older backups
ls -1t $BACKUP_DIR/*.archive 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
ls -1t $BACKUP_DIR/*.meta.json 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f

echo "Kept latest $KEEP backups in $BACKUP_DIR"
