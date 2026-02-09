#!/bin/bash
# ═══════════════════════════════════════════════════
# Démarrage de l'environnement de DÉVELOPPEMENT
# ═══════════════════════════════════════════════════
# Usage: npm run dev:start
# 
# Ce script :
# 1. Copie la DB de prod vers vehicules-dev.db (si elle n'existe pas)
# 2. Lance le backend DEV sur le port 3003
# 3. Lance le frontend DEV sur le port 5174
#
# La production (PM2 ports 3002/4173) n'est PAS affectée.
# ═══════════════════════════════════════════════════

set -e

PROJ_DIR="/Users/reunion/Resevation Véhicules"
SERVER_DIR="$PROJ_DIR/server"
DEV_DB="$SERVER_DIR/vehicules-dev.db"
PROD_DB="$SERVER_DIR/vehicules.db"

echo ""
echo "═══════════════════════════════════════════"
echo "  🔧 Démarrage environnement DÉVELOPPEMENT"
echo "═══════════════════════════════════════════"
echo ""

# 1. S'assurer que la DB dev existe
if [ ! -f "$DEV_DB" ]; then
  echo "📋 Copie de la base de données de production vers dev..."
  cp "$PROD_DB" "$DEV_DB"
  # Copier aussi le WAL et SHM s'ils existent
  [ -f "$PROD_DB-wal" ] && cp "$PROD_DB-wal" "$DEV_DB-wal"
  [ -f "$PROD_DB-shm" ] && cp "$PROD_DB-shm" "$DEV_DB-shm"
  echo "   ✅ vehicules-dev.db créée (copie de la prod)"
else
  echo "   ✅ vehicules-dev.db existe déjà"
  echo "   💡 Pour rafraîchir depuis la prod: npm run dev:reset-db"
fi

# 2. Vérifier que rien ne tourne sur le port 3003
if lsof -ti:3003 > /dev/null 2>&1; then
  echo ""
  echo "⚠️  Port 3003 déjà utilisé. Arrêt du processus..."
  lsof -ti:3003 | xargs kill -9 2>/dev/null
  sleep 2
fi

# 3. Vérifier que rien ne tourne sur le port 5174
if lsof -ti:5174 > /dev/null 2>&1; then
  echo ""
  echo "⚠️  Port 5174 déjà utilisé. Arrêt du processus..."
  lsof -ti:5174 | xargs kill -9 2>/dev/null
  sleep 2
fi

# 4. Vérifier que la production tourne toujours
echo ""
echo "🔍 Vérification de la production..."
if pm2 pid vehicules-backend > /dev/null 2>&1 && [ "$(pm2 pid vehicules-backend)" != "" ]; then
  echo "   ✅ Production backend (port 3002) — EN LIGNE"
else
  echo "   ⚠️  Production backend semble arrêtée"
fi
if pm2 pid vehicules > /dev/null 2>&1 && [ "$(pm2 pid vehicules)" != "" ]; then
  echo "   ✅ Production frontend (port 4173) — EN LIGNE"
else
  echo "   ⚠️  Production frontend semble arrêtée"
fi

echo ""
echo "🚀 Lancement du backend DEV (port 3003)..."
echo "   DB: vehicules-dev.db"
echo ""

# 5. Lancer le backend dev en arrière-plan
cd "$SERVER_DIR"
NODE_ENV=development node server.js --dev &
DEV_BACKEND_PID=$!

# Attendre que le backend soit prêt
sleep 2

if kill -0 $DEV_BACKEND_PID 2>/dev/null; then
  echo "   ✅ Backend dev démarré (PID: $DEV_BACKEND_PID)"
else
  echo "   ❌ Le backend dev n'a pas démarré. Vérifiez les erreurs ci-dessus."
  exit 1
fi

echo ""
echo "🚀 Lancement du frontend DEV (port 5174)..."
echo "   Proxy /api → http://localhost:3003"
echo ""

# 6. Lancer le frontend dev (en premier plan)
cd "$PROJ_DIR"
npx vite

# Quand vite est arrêté (Ctrl+C), arrêter aussi le backend dev
echo ""
echo "🛑 Arrêt du backend dev..."
kill $DEV_BACKEND_PID 2>/dev/null
wait $DEV_BACKEND_PID 2>/dev/null
echo "✅ Environnement de développement arrêté"
echo "   ℹ️  La production n'a PAS été affectée"
