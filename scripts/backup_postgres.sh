#!/usr/bin/env bash
# scripts/backup_postgres.sh
# Run a pg_dump to a timestamped archive and keep the latest N backups

set -euo pipefail

DATABASE_URL="${DATABASE_URL:-${SUPABASE_DB_URL:-${POSTGRES_URL:-}}}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres/karumande}"
KEEP="${KEEP:-7}"

if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_URL (or SUPABASE_DB_URL / POSTGRES_URL) is required"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
DEST="$BACKUP_DIR/backup-$TIMESTAMP.dump"

echo "Running pg_dump -> $DEST"
pg_dump --format=custom --file="$DEST" "$DATABASE_URL"

jq -n --arg ts "$TIMESTAMP" '{timestamp: $ts, engine: "postgresql"}' > "$BACKUP_DIR/backup-$TIMESTAMP.meta.json" 2>/dev/null || echo '{"timestamp":"'"$TIMESTAMP"'","engine":"postgresql"}' > "$BACKUP_DIR/backup-$TIMESTAMP.meta.json"

echo "Backup completed"

ls -1t "$BACKUP_DIR"/*.dump 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f
ls -1t "$BACKUP_DIR"/*.meta.json 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f

echo "Kept latest $KEEP backups in $BACKUP_DIR"
