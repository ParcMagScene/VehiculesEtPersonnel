#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
# eM@g — Orchestrateur unique de sauvegardes
# ═══════════════════════════════════════════════════════════════════
#
# Pipeline complet :
#   1. Backup DB (PROD + DEV) compressé + intégrité + checksum SHA-256
#   2. Backup médias (incrémental, tar.gz)
#   3. Rotation GFS (Grandfather-Father-Son : 7 daily / 4 weekly / 12 monthly)
#   4. Vérification du dernier backup (restauration test en /tmp)
#   5. Mise à jour du manifest JSON
#
# Cron recommandé (quotidien 2h du matin) :
#   0 2 * * * /Users/reunion/eM@g/scripts/backup/backup-orchestrator.sh
#
# Variables d'environnement :
#   BACKUP_SKIP_MEDIA=1  -> n'exécute pas backup-media.sh
#   BACKUP_SKIP_VERIFY=1 -> n'exécute pas backup-verify.sh
# ═══════════════════════════════════════════════════════════════════

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_DIR/backups/backup.log"

mkdir -p "$PROJECT_DIR/backups"

# Tee toutes les sorties vers le log central (append).
exec > >(tee -a "$LOG_FILE") 2>&1

START_TS=$(date '+%Y-%m-%d %H:%M:%S')
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  📦 eM@g backup orchestrator — start $START_TS"
echo "═══════════════════════════════════════════════════════════"

STATUS=0

# 1) DB (PROD + DEV) — non bloquant si DEV absent ; bloquant si PROD échoue.
echo "── [1/4] Backup DB ──"
if ! bash "$SCRIPT_DIR/backup-db.sh"; then
  echo "❌ backup-db.sh a échoué"
  STATUS=1
fi

# 2) Médias (best-effort, non bloquant).
if [ "${BACKUP_SKIP_MEDIA:-0}" != "1" ]; then
  echo "── [2/4] Backup médias ──"
  if ! bash "$SCRIPT_DIR/backup-media.sh"; then
    echo "⚠️  backup-media.sh a échoué (non bloquant)"
  fi
else
  echo "── [2/4] Backup médias ── SKIPPED (BACKUP_SKIP_MEDIA=1)"
fi

# 3) Rotation GFS (toujours, même si étapes précédentes ont échoué).
echo "── [3/4] Rétention GFS ──"
if ! bash "$SCRIPT_DIR/backup-retention.sh"; then
  echo "⚠️  backup-retention.sh a échoué (non bloquant)"
fi

# 4) Vérification du dernier backup.
if [ "${BACKUP_SKIP_VERIFY:-0}" != "1" ]; then
  echo "── [4/4] Vérification ──"
  if ! bash "$SCRIPT_DIR/backup-verify.sh"; then
    echo "⚠️  backup-verify.sh a échoué (non bloquant)"
  fi
else
  echo "── [4/4] Vérification ── SKIPPED (BACKUP_SKIP_VERIFY=1)"
fi

END_TS=$(date '+%Y-%m-%d %H:%M:%S')
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ end $END_TS  (exit=$STATUS)"
echo "═══════════════════════════════════════════════════════════"
exit "$STATUS"
