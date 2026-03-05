#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════
# MAGLOG — Script de backup SQLite
# ═══════════════════════════════════════════════════════
#
# Usage:
#   ./scripts/backup-db.sh              # backup par défaut (vehicules.db)
#   ./scripts/backup-db.sh vehicules-dev.db  # backup d'une autre DB
#   DB_PATH=vehicules-dev.db ./scripts/backup-db.sh
#
# Crontab (quotidien à 2h du matin):
#   0 2 * * * /path/to/eM@g/scripts/backup-db.sh >> /path/to/eM@g/backups/backup.log 2>&1
#
# Rétention: 30 jours par défaut (configurable via BACKUP_RETENTION_DAYS)
# ═══════════════════════════════════════════════════════

set -euo pipefail

# ─── Configuration ───
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_DIR/server"

DB_FILENAME="${1:-${DB_PATH:-vehicules.db}}"
DB_FILE="$SERVER_DIR/$DB_FILENAME"
BACKUP_DIR="$PROJECT_DIR/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# ─── Vérifications ───
if [ ! -f "$DB_FILE" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Base de données introuvable: $DB_FILE"
  exit 1
fi

# Vérifier que sqlite3 est disponible
if ! command -v sqlite3 &>/dev/null; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] sqlite3 n'est pas installé"
  exit 1
fi

# ─── Créer le dossier de backup ───
mkdir -p "$BACKUP_DIR"

# ─── Nom du fichier de backup ───
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
DB_BASENAME=$(basename "$DB_FILENAME" .db)
BACKUP_FILE="$BACKUP_DIR/${DB_BASENAME}_backup_${TIMESTAMP}.db"

# ─── Backup via SQLite .backup (safe même si la DB est en cours d'utilisation) ───
echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Backup de $DB_FILENAME..."
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

# ─── Vérifier l'intégrité du backup ───
INTEGRITY=$(sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" 2>&1)
if [ "$INTEGRITY" != "ok" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') [ERROR] Intégrité du backup échouée: $INTEGRITY"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# ─── Compresser ───
gzip "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo "$(date '+%Y-%m-%d %H:%M:%S') [OK] Backup créé: $(basename "$BACKUP_FILE") ($BACKUP_SIZE)"

# ─── Nettoyage des anciens backups ───
DELETED=$(find "$BACKUP_DIR" -name "${DB_BASENAME}_backup_*.db.gz" -mtime +"$RETENTION_DAYS" -delete -print | wc -l | tr -d ' ')
if [ "$DELETED" -gt 0 ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] $DELETED ancien(s) backup(s) supprimé(s) (rétention: ${RETENTION_DAYS}j)"
fi

# ─── Résumé ───
TOTAL=$(find "$BACKUP_DIR" -name "${DB_BASENAME}_backup_*.db.gz" | wc -l | tr -d ' ')
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
echo "$(date '+%Y-%m-%d %H:%M:%S') [INFO] Total backups: $TOTAL fichier(s), $TOTAL_SIZE"
