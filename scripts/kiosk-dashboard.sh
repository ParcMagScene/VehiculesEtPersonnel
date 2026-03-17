#!/bin/bash
# ──────────────────────────────────────────────
# kiosk-dashboard.sh — Lance Chrome en mode kiosk sur le Dashboard TV
# Usage: ./scripts/kiosk-dashboard.sh [URL]
# Par défaut: http://localhost:3001 (TV Dashboard)
# ──────────────────────────────────────────────

URL="${1:-http://localhost:3001}"

# Détecter le navigateur
if [ -d "/Applications/Google Chrome.app" ]; then
    BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [ -d "/Applications/Chromium.app" ]; then
    BROWSER="/Applications/Chromium.app/Contents/MacOS/Chromium"
else
    echo "❌ Chrome ou Chromium non trouvé"
    exit 1
fi

echo "🖥️  Lancement kiosk: $URL"
echo "   Navigateur: $BROWSER"
echo "   Quitter: Cmd+Q ou Alt+F4"

exec "$BROWSER" \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-translate \
    --disable-features=TranslateUI \
    --autoplay-policy=no-user-gesture-required \
    --check-for-update-interval=31536000 \
    --disable-session-crashed-bubble \
    --user-data-dir="/tmp/chrome-kiosk-dashboard" \
    "$URL"
