#!/bin/bash

# Script de sauvegarde automatique de la base de données
# Usage: ./backup-database.sh

# Configuration
DB_FILE="/Users/reunion/Resevation Véhicules/server/vehicules.db"
BACKUP_DIR="/Users/reunion/Resevation Véhicules/server/backups"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/vehicules_backup_$DATE.db"

# Créer le répertoire de backup s'il n'existe pas
mkdir -p "$BACKUP_DIR"

# Vérifier que la base de données existe
if [ ! -f "$DB_FILE" ]; then
    echo "❌ Erreur: Base de données introuvable: $DB_FILE"
    exit 1
fi

# Créer la sauvegarde
echo "📦 Création de la sauvegarde..."
cp "$DB_FILE" "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Sauvegarde créée: $BACKUP_FILE"
    
    # Afficher la taille
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "📊 Taille: $SIZE"
    
    # Garder seulement les 30 dernières sauvegardes
    echo "🧹 Nettoyage des anciennes sauvegardes..."
    cd "$BACKUP_DIR"
    ls -t vehicules_backup_*.db | tail -n +31 | xargs -r rm
    
    # Compter les sauvegardes restantes
    COUNT=$(ls -1 vehicules_backup_*.db 2>/dev/null | wc -l)
    echo "📁 Nombre de sauvegardes: $COUNT"
else
    echo "❌ Erreur lors de la création de la sauvegarde"
    exit 1
fi
