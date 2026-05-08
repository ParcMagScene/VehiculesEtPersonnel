#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# eM@g — Rétention GFS (Grandfather-Father-Son)
# ═══════════════════════════════════════════════════════════════════
# Politique :
#   - DAILY_KEEP   : 7 jours (les + récents)
#   - WEEKLY_KEEP  : 4 semaines (1 par semaine ISO)
#   - MONTHLY_KEEP : 12 mois  (1 par mois)
#
# Compatible bash 3.2 (macOS) — pas de `declare -A`.
# ═══════════════════════════════════════════════════════════════════

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_ROOT="$PROJECT_DIR/backups"

DAILY_KEEP=${BACKUP_DAILY_KEEP:-7}
WEEKLY_KEEP=${BACKUP_WEEKLY_KEEP:-4}
MONTHLY_KEEP=${BACKUP_MONTHLY_KEEP:-12}

# week_id <YYYYMMDD>  -> "YYYY-WW" (best-effort GNU/BSD).
week_id() {
  local ts="$1"
  if date -j -f "%Y%m%d" "$ts" "+%G-%V" >/dev/null 2>&1; then
    date -j -f "%Y%m%d" "$ts" "+%G-%V"
  else
    date -d "${ts:0:4}-${ts:4:2}-${ts:6:2}" "+%G-%V" 2>/dev/null || echo "$ts"
  fi
}

# rotate_pattern <root> <glob>
rotate_pattern() {
  local root="$1"
  local pattern="$2"

  if [ ! -d "$root" ]; then
    return 0
  fi

  local files_tmp keep_tmp seen_w seen_m
  files_tmp=$(mktemp)
  keep_tmp=$(mktemp)
  seen_w=$(mktemp)
  seen_m=$(mktemp)

  find "$root" -type f -name "$pattern" 2>/dev/null | sort -r > "$files_tmp"

  local total
  total=$(wc -l < "$files_tmp" | tr -d ' ')
  if [ "$total" = "0" ]; then
    rm -f "$files_tmp" "$keep_tmp" "$seen_w" "$seen_m"
    return 0
  fi

  local daily_kept=0 weekly_kept=0 monthly_kept=0
  local file basename ts week month kept

  while IFS= read -r file; do
    [ -z "$file" ] && continue
    basename=$(basename "$file")
    ts=$(echo "$basename" | grep -oE '[0-9]{8}' | head -1)
    [ -z "$ts" ] && continue
    week=$(week_id "$ts")
    month="${ts:0:6}"

    kept=0
    if [ "$daily_kept" -lt "$DAILY_KEEP" ]; then
      echo "$file" >> "$keep_tmp"
      daily_kept=$((daily_kept + 1))
      kept=1
    fi
    if [ "$kept" = "0" ] && [ "$weekly_kept" -lt "$WEEKLY_KEEP" ] && ! grep -qxF "$week" "$seen_w"; then
      echo "$file" >> "$keep_tmp"
      echo "$week" >> "$seen_w"
      weekly_kept=$((weekly_kept + 1))
      kept=1
    fi
    if [ "$kept" = "0" ] && [ "$monthly_kept" -lt "$MONTHLY_KEEP" ] && ! grep -qxF "$month" "$seen_m"; then
      echo "$file" >> "$keep_tmp"
      echo "$month" >> "$seen_m"
      monthly_kept=$((monthly_kept + 1))
      kept=1
    fi
  done < "$files_tmp"

  # Suppression de ce qui n'est pas dans keep_tmp.
  local removed=0
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    if ! grep -qxF "$file" "$keep_tmp"; then
      rm -f "$file" "$file.sha256"
      removed=$((removed + 1))
    fi
  done < "$files_tmp"

  if [ "$removed" -gt 0 ]; then
    echo "🧹 [$pattern] kept=$((daily_kept + weekly_kept + monthly_kept)) removed=$removed (D=$daily_kept W=$weekly_kept M=$monthly_kept)"
  fi

  rm -f "$files_tmp" "$keep_tmp" "$seen_w" "$seen_m"
}

echo "── rétention GFS (D=$DAILY_KEEP W=$WEEKLY_KEEP M=$MONTHLY_KEEP) ──"
rotate_pattern "$BACKUP_ROOT/db"    "prod-*.db.gz"
rotate_pattern "$BACKUP_ROOT/db"    "dev-*.db.gz"
rotate_pattern "$BACKUP_ROOT/media" "media-*.tar.gz"
exit 0
