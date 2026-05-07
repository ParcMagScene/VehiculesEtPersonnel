#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# eM@g — Vérification d'un backup DB
# ═══════════════════════════════════════════════════════════════════
# Restaure le dernier backup PROD dans /tmp et lance integrity_check.
# Best-effort : sortie 0 si OK, 1 si KO (mais non bloquant cron).
# ═══════════════════════════════════════════════════════════════════

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_ROOT="$PROJECT_DIR/backups/db"

LATEST=$(find "$BACKUP_ROOT" -type f -name "prod-*.db.gz" 2>/dev/null | sort -r | head -1)
if [ -z "$LATEST" ]; then
  echo "⚠️  aucun backup prod trouvé"
  exit 0
fi

echo "🔍 vérification : $(basename "$LATEST")"

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

cp "$LATEST" "$TMP/test.db.gz"
gunzip "$TMP/test.db.gz"

INTEGRITY=$(sqlite3 "$TMP/test.db" "PRAGMA integrity_check;" 2>&1 | head -1)
if [ "$INTEGRITY" = "ok" ]; then
  TABLES=$(sqlite3 "$TMP/test.db" "SELECT count(*) FROM sqlite_master WHERE type='table';")
  echo "✅ vérif OK ($TABLES tables)"
  exit 0
fi

echo "❌ vérif KO : $INTEGRITY"
exit 1
