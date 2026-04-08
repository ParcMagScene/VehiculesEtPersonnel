#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# eM@g — Backup automatique des bases de données DEV + PROD
# ═══════════════════════════════════════════════════════════════════
#
# Usage:
#   ./scripts/backup-databases.sh           # backup dev + prod
#   ./scripts/backup-databases.sh --prod    # backup prod seulement
#   ./scripts/backup-databases.sh --dev     # backup dev seulement
#
# Ce script :
#   1. Détecte les fichiers DB dev et prod dans apps/api/
#   2. Crée un dossier backups/ horodaté
#   3. Utilise sqlite3 .backup (safe même si la DB est en cours d'utilisation)
#   4. Vérifie l'intégrité de chaque backup
#   5. Ne compresse PAS (pour accélérer les restaurations)
#   6. Ne remplace jamais un backup existant
#
# Prérequis:
#   - sqlite3 doit être installé
#
# Restauration:
#   1. Arrêter le backend:  lsof -ti:3003 | xargs kill -9 2>/dev/null
#   2. Copier le backup:    cp backups/prod-YYYYMMDD-HHMMSS.db apps/api/vehicules.db
#   3. Relancer le backend: npm run dev:start
#
# ⚠️  EXÉCUTER CE SCRIPT AVANT TOUTE SYNCHRONISATION OU MERGE
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ───
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_DIR/apps/api"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')

PROD_DB="$SERVER_DIR/vehicules.db"
DEV_DB="$SERVER_DIR/vehicules-dev.db"

# ─── Parse arguments ───
DO_PROD=true
DO_DEV=true
if [ "${1:-}" = "--prod" ]; then
  DO_DEV=false
elif [ "${1:-}" = "--dev" ]; then
  DO_PROD=false
fi

# ─── Vérifications ───
if ! command -v sqlite3 &>/dev/null; then
  echo "❌ sqlite3 n'est pas installé"
  exit 1
fi

mkdir -p "$BACKUP_DIR"

ERRORS=0
CREATED=0

# ─── Fonction de backup ───
backup_db() {
  local label="$1"
  local src="$2"
  local dest="$BACKUP_DIR/${label}-${TIMESTAMP}.db"

  if [ ! -f "$src" ]; then
    echo "⚠️  [$label] Base introuvable: $src — ignorée"
    return 0
  fi

  # Ne jamais écraser un backup existant
  if [ -f "$dest" ]; then
    echo "⚠️  [$label] Backup déjà existant: $(basename "$dest") — ignoré"
    return 0
  fi

  echo "📦 [$label] Backup en cours..."

  # sqlite3 .backup est safe même pendant les écritures (contrairement à cp)
  if ! sqlite3 "$src" ".backup '$dest'"; then
    echo "❌ [$label] Échec de sqlite3 .backup"
    ERRORS=$((ERRORS + 1))
    return 1
  fi

  # Vérifier l'intégrité
  local integrity
  integrity=$(sqlite3 "$dest" "PRAGMA integrity_check;" 2>&1)
  if [ "$integrity" != "ok" ]; then
    echo "❌ [$label] Intégrité échouée: $integrity"
    rm -f "$dest"
    ERRORS=$((ERRORS + 1))
    return 1
  fi

  # Vérifier la taille
  local src_size dest_size
  src_size=$(wc -c < "$src" | tr -d ' ')
  dest_size=$(wc -c < "$dest" | tr -d ' ')
  local src_mb dest_mb
  src_mb=$(echo "scale=1; $src_size / 1048576" | bc)
  dest_mb=$(echo "scale=1; $dest_size / 1048576" | bc)

  if [ "$dest_size" -eq 0 ]; then
    echo "❌ [$label] Backup vide (0 octets)"
    rm -f "$dest"
    ERRORS=$((ERRORS + 1))
    return 1
  fi

  echo "✅ [$label] $dest"
  echo "   Source: ${src_mb} MB → Backup: ${dest_mb} MB"
  # [PHASE 3 SEC] Permissions restrictives — seul le propriétaire peut lire/écrire
  chmod 600 "$dest"
  CREATED=$((CREATED + 1))
}

# ─── Exécution ───
echo ""
echo "═══════════════════════════════════════════════"
echo "  🔒 Backup bases de données eM@g"
echo "  📅 $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════"
echo ""

if [ "$DO_PROD" = true ]; then
  backup_db "prod" "$PROD_DB"
fi

if [ "$DO_DEV" = true ]; then
  backup_db "dev" "$DEV_DB"
fi

echo ""
echo "───────────────────────────────────────────────"
echo "📁 Dossier backups: $BACKUP_DIR"
echo "📊 Backups créés: $CREATED"

# Lister les backups récents
echo ""
echo "Backups existants:"
ls -lhtr "$BACKUP_DIR"/*.db 2>/dev/null | tail -10 | while read -r line; do
  echo "   $line"
done

# [PHASE 3 SEC] Rétention automatique — suppression des backups > 30 jours
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
OLD_COUNT=$(find "$BACKUP_DIR" -name "*.db" -mtime +${RETENTION_DAYS} 2>/dev/null | wc -l | tr -d ' ')
if [ "$OLD_COUNT" -gt 0 ]; then
  echo ""
  echo "🧹 Nettoyage: suppression de $OLD_COUNT backup(s) de plus de ${RETENTION_DAYS} jours"
  find "$BACKUP_DIR" -name "*.db" -mtime +${RETENTION_DAYS} -delete
fi

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "⚠️  $ERRORS erreur(s) rencontrée(s)"
  exit 1
fi

echo ""
echo "✅ Backup terminé avec succès"
exit 0
