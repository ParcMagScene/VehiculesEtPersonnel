#!/bin/bash
# ═══════════════════════════════════════════════════
# Réinitialiser la DB de développement depuis la prod
# ═══════════════════════════════════════════════════
# Usage: npm run dev:reset-db
#
# Écrase vehicules-dev.db avec une copie fraîche de vehicules.db
# ═══════════════════════════════════════════════════

set -e

SERVER_DIR="/Users/reunion/Resevation Véhicules/server"
DEV_DB="$SERVER_DIR/vehicules-dev.db"
PROD_DB="$SERVER_DIR/vehicules.db"

echo ""
echo "🔄 Réinitialisation de la base de données de développement..."
echo ""

# Vérifier qu'aucun backend dev ne tourne
if lsof -ti:3003 > /dev/null 2>&1; then
  echo "⚠️  Le backend dev tourne sur le port 3003."
  echo "   Arrêtez-le d'abord (Ctrl+C dans le terminal dev)"
  exit 1
fi

# Supprimer l'ancienne DB dev
rm -f "$DEV_DB" "$DEV_DB-wal" "$DEV_DB-shm"
echo "   🗑️  Ancienne vehicules-dev.db supprimée"

# Copier depuis la prod
cp "$PROD_DB" "$DEV_DB"
[ -f "$PROD_DB-wal" ] && cp "$PROD_DB-wal" "$DEV_DB-wal"
[ -f "$PROD_DB-shm" ] && cp "$PROD_DB-shm" "$DEV_DB-shm"

echo "   ✅ vehicules-dev.db copiée depuis la production"
echo ""
echo "   Vous pouvez maintenant relancer: npm run dev:start"
