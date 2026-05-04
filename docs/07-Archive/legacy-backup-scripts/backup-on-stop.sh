#!/bin/bash
set -euo pipefail

# Script de sauvegarde automatique lors de l'arrêt du serveur
# Ce script est appelé par PM2 avant l'arrêt

# Configuration
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
DB_FILE="$SCRIPT_DIR/vehicules.db"
BACKUP_DIR="$SCRIPT_DIR/backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/vehicules_backup_stop_$DATE.db"

# Créer le répertoire de backup s'il n'existe pas
mkdir -p "$BACKUP_DIR"

# Vérifier que la base de données existe
if [ ! -f "$DB_FILE" ]; then
    echo "❌ Erreur: Base de données introuvable: $DB_FILE"
    exit 1
fi

# Créer la sauvegarde
echo "💾 Sauvegarde automatique lors de l'arrêt..."
cp "$DB_FILE" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Sauvegarde d'arrêt créée: $BACKUP_FILE"
    
    # Afficher la taille
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "📊 Taille: $SIZE"
else
    echo "❌ Erreur lors de la sauvegarde d'arrêt"
    exit 1
fi
