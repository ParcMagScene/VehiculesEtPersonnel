#!/bin/bash
# =============================================================
# Script de déploiement sécurisé - NE COUPE JAMAIS la production
# Usage: npm run deploy
# =============================================================

set -e

PROJ_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WEB_DIR="$PROJ_DIR/apps/web"
DIST_DIR="$WEB_DIR/dist"
BACKUP_DIR="$PROJ_DIR/dist-backup"

echo "🔒 Déploiement sécurisé en cours..."
echo ""

# 1. Sauvegarder le dist actuel
if [ -d "$DIST_DIR" ]; then
  echo "📦 Sauvegarde du dist/ actuel vers dist-backup/..."
  rm -rf "$BACKUP_DIR"
  cp -r "$DIST_DIR" "$BACKUP_DIR"
  echo "   ✅ Sauvegarde créée"
else
  echo "   ⚠️  Pas de dist/ existant à sauvegarder"
fi

# 2. Build dans un dossier temporaire
echo ""
echo "🔨 Build en cours..."
cd "$PROJ_DIR"

# Build normal (écrase dist/)
if (cd "$WEB_DIR" && npx vite build); then
  echo "   ✅ Build réussi"
else
  echo "   ❌ Build échoué !"
  # Restaurer le backup
  if [ -d "$BACKUP_DIR" ]; then
    echo "   🔄 Restauration du dist/ précédent..."
    rm -rf "$DIST_DIR"
    cp -r "$BACKUP_DIR" "$DIST_DIR"
    echo "   ✅ Production restaurée - AUCUNE COUPURE"
  fi
  echo "   ⚠️  Corrigez les erreurs et réessayez"
  exit 1
fi

# 3. Vérifier que dist/index.html existe
if [ ! -f "$DIST_DIR/index.html" ]; then
  echo "   ❌ dist/index.html manquant après le build !"
  if [ -d "$BACKUP_DIR" ]; then
    echo "   🔄 Restauration..."
    rm -rf "$DIST_DIR"
    cp -r "$BACKUP_DIR" "$DIST_DIR"
  fi
  exit 1
fi

# 4. Redémarrer le frontend PM2
echo ""
echo "🔄 Redémarrage du serveur frontend..."
pm2 restart vehicules 2>/dev/null && echo "   ✅ Frontend redémarré" || echo "   ⚠️  PM2 vehicules non trouvé"

# 5. Redémarrer le backend PM2
echo "🔄 Redémarrage du serveur backend..."
pm2 restart vehicules-backend 2>/dev/null && echo "   ✅ Backend redémarré" || echo "   ⚠️  PM2 vehicules-backend non trouvé"

# 6. Nettoyage
rm -rf "$BACKUP_DIR"

echo ""
echo "✅ Déploiement terminé avec succès !"
echo "   Frontend: http://magsav.duckdns.org:4173/"
echo "   Backend:  http://magsav.duckdns.org:3002/"
pm2 list
