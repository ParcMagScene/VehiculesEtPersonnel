#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# eM@g — Backup médias (incrémental tar.gz)
# ═══════════════════════════════════════════════════════════════════
# Sauvegarde les répertoires public/{attachments,avatars,Photos,
# messaging-uploads,supplier-docs,Logos,catalogues}.
#
# Stratégie : tar.gz complet hebdomadaire (dimanche), incrémental
# quotidien basé sur le snapshot tar (--listed-incremental).
# ═══════════════════════════════════════════════════════════════════

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PUBLIC_DIR="$PROJECT_DIR/public"
BACKUP_ROOT="$PROJECT_DIR/backups/media"
SNAPSHOT="$BACKUP_ROOT/.snar"

YEAR=$(date '+%Y')
MONTH=$(date '+%m')
TS=$(date '+%Y%m%d-%H%M%S')
DOW=$(date '+%u')   # 1=lundi … 7=dimanche

mkdir -p "$BACKUP_ROOT/$YEAR/$MONTH"

# Liste des sous-dossiers à inclure (n'échoue pas si absent).
TARGETS=()
for d in attachments avatars Photos messaging-uploads supplier-docs Logos catalogues; do
  if [ -d "$PUBLIC_DIR/$d" ]; then
    TARGETS+=("$d")
  fi
done

if [ ${#TARGETS[@]} -eq 0 ]; then
  echo "⚠️  aucun dossier média à sauvegarder"
  exit 0
fi

# Reset snapshot le dimanche → backup full.
KIND="incr"
if [ "$DOW" = "7" ] || [ ! -f "$SNAPSHOT" ]; then
  rm -f "$SNAPSHOT"
  KIND="full"
fi

DEST="$BACKUP_ROOT/$YEAR/$MONTH/media-${KIND}-${TS}.tar.gz"
echo "📸 backup médias ($KIND) → $(basename "$DEST")"

# tar avec --listed-incremental fournit l'incrémental cross-platform (BSD tar
# macOS le supporte aussi en mode GNU si gtar est dispo). Fallback : full.
TAR_BIN="tar"
if command -v gtar >/dev/null 2>&1; then
  TAR_BIN="gtar"
fi

if "$TAR_BIN" --version 2>/dev/null | head -1 | grep -q "GNU"; then
  "$TAR_BIN" --listed-incremental="$SNAPSHOT" -czf "$DEST" -C "$PUBLIC_DIR" "${TARGETS[@]}"
else
  # BSD tar : full uniquement (pas d'incrémental compatible).
  "$TAR_BIN" -czf "$DEST" -C "$PUBLIC_DIR" "${TARGETS[@]}"
  KIND="full"
fi

chmod 600 "$DEST"
SIZE=$(wc -c < "$DEST" | tr -d ' ')
echo "✅ médias OK ($(du -h "$DEST" | cut -f1), kind=$KIND)"
exit 0
