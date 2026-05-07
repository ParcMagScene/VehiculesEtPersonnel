#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# eM@g — Backup DB (PROD + DEV) compressé + checksum + manifest
# ═══════════════════════════════════════════════════════════════════
# Sortie : backups/db/YYYY/MM/{prod|dev}-YYYYMMDD-HHMMSS.db.gz (+ .sha256)
# Manifest : backups/manifest.json (mis à jour atomiquement)
# Utilise sqlite3 .backup (safe en cours d'utilisation).
# ═══════════════════════════════════════════════════════════════════

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVER_DIR="$PROJECT_DIR/apps/api"
BACKUP_ROOT="$PROJECT_DIR/backups/db"
MANIFEST="$PROJECT_DIR/backups/manifest.json"

PROD_DB="$SERVER_DIR/vehicules.db"
DEV_DB="$SERVER_DIR/vehicules-dev.db"

YEAR=$(date '+%Y')
MONTH=$(date '+%m')
TS=$(date '+%Y%m%d-%H%M%S')

mkdir -p "$BACKUP_ROOT/$YEAR/$MONTH"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "❌ sqlite3 introuvable" >&2
  exit 1
fi

ERRORS=0

# Backup d'une DB ; ajoute une entrée au manifest temporaire.
# Args : label, source_db, manifest_tmp_file
backup_one() {
  local label="$1"
  local src="$2"
  local manifest_tmp="$3"

  if [ ! -f "$src" ]; then
    echo "⚠️  [$label] base introuvable ($src) — ignorée"
    return 0
  fi

  local dest="$BACKUP_ROOT/$YEAR/$MONTH/${label}-${TS}.db"
  echo "📦 [$label] backup → $(basename "$dest")"

  if ! sqlite3 "$src" ".backup '$dest'"; then
    echo "❌ [$label] sqlite3 .backup KO"
    ERRORS=$((ERRORS + 1))
    return 1
  fi

  # Nettoyage des journaux WAL/SHM créés à côté de la copie (artefacts SQLite).
  rm -f "$dest-wal" "$dest-shm"

  local integrity
  integrity=$(sqlite3 "$dest" "PRAGMA integrity_check;" 2>&1 | head -1)
  if [ "$integrity" != "ok" ]; then
    echo "❌ [$label] integrity_check : $integrity"
    rm -f "$dest"
    ERRORS=$((ERRORS + 1))
    return 1
  fi

  gzip -9 "$dest"
  dest="${dest}.gz"

  # Checksum SHA-256 (portable macOS/Linux).
  local sha
  if command -v sha256sum >/dev/null 2>&1; then
    sha=$(sha256sum "$dest" | awk '{print $1}')
  else
    sha=$(shasum -a 256 "$dest" | awk '{print $1}')
  fi
  echo "$sha  $(basename "$dest")" > "$dest.sha256"

  chmod 600 "$dest" "$dest.sha256"

  local size
  size=$(wc -c < "$dest" | tr -d ' ')

  printf '  {"type":"db","label":"%s","path":"%s","size":%s,"sha256":"%s","created_at":"%s"},\n' \
    "$label" "${dest#$PROJECT_DIR/}" "$size" "$sha" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    >> "$manifest_tmp"

  echo "✅ [$label] OK ($(du -h "$dest" | cut -f1))"
}

MANIFEST_TMP=$(mktemp)
backup_one "prod" "$PROD_DB" "$MANIFEST_TMP"
backup_one "dev"  "$DEV_DB"  "$MANIFEST_TMP"

# ── Mise à jour manifest (append récents en tête, conserve l'historique). ──
# Format : { "entries": [ ... ] } — fichier JSON simple.
{
  echo "{"
  echo "  \"updated_at\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\","
  echo "  \"entries\": ["
  # Nouvelles entrées en premier.
  cat "$MANIFEST_TMP" 2>/dev/null
  # Entrées existantes (dépouillées des accolades / wrapping).
  if [ -f "$MANIFEST" ]; then
    awk '/"entries": \[/{flag=1; next} /^[[:space:]]*\]/{flag=0} flag' "$MANIFEST" 2>/dev/null
  fi
  # Suppression de la dernière virgule potentielle.
  echo "    {\"type\":\"sentinel\"}"
  echo "  ]"
  echo "}"
} > "$MANIFEST.tmp"

mv -f "$MANIFEST.tmp" "$MANIFEST"
rm -f "$MANIFEST_TMP"

if [ "$ERRORS" -gt 0 ]; then
  exit 1
fi
exit 0
