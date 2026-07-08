#!/usr/bin/env bash
# =============================================================================
# Daily Database Backup — Al Musafir International ERP
#
# Dumps the Postgres database (DATABASE_URL) to a timestamped, gzip-compressed
# SQL file and prunes backups older than $RETENTION_DAYS (default 14).
#
# Usage:
#   bash scripts/src/backup-db.sh                # backs up to ./backups
#   BACKUP_DIR=/path bash scripts/src/backup-db.sh
#   RETENTION_DAYS=30 bash scripts/src/backup-db.sh
#
# Scheduling (recommended — run once every 24h):
#   Add a cron job, e.g.:
#     0 3 * * * cd /home/runner/workspace && bash scripts/src/backup-db.sh >> backups/backup.log 2>&1
#   Or trigger it from the existing node-cron scheduler in the api-server if
#   you prefer an in-app schedule instead of an OS-level cron entry.
#
# Restore:
#   gunzip -c backups/<file>.sql.gz | psql "$DATABASE_URL"
# =============================================================================

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is not set." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUT_FILE="$BACKUP_DIR/almusafir-db-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[INFO] Backing up database to $OUT_FILE ..."
pg_dump "$DATABASE_URL" | gzip > "$OUT_FILE"
echo "[OK] Backup written: $OUT_FILE ($(du -h "$OUT_FILE" | cut -f1))"

echo "[INFO] Pruning backups older than $RETENTION_DAYS day(s)..."
find "$BACKUP_DIR" -name 'almusafir-db-*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete

echo "[OK] Done."
