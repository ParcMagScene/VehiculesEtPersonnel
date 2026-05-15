#!/bin/zsh
REPO="ParcMagScene/VehiculesEtPersonnel"
REF="feat/web-modal-system-stable"
TOKEN=$(git config --global github.token 2>/dev/null || (grep oauth_token ~/.config/gh/hosts.yml 2>/dev/null | head -1 | awk '{print $2}'))

for i in {1..12}; do
  echo "Polling check status... (Attempt $i)"
  if [ -n "$TOKEN" ]; then
    RESPONSE=$(curl -s -H "Authorization: token $TOKEN" "https://api.github.com/repos/$REPO/commits/$REF/check-runs")
  else
    RESPONSE=$(curl -s "https://api.github.com/repos/$REPO/commits/$REF/check-runs")
  fi

  # Filter for checks containing "build" or "🏗️" (building icon)
  STATUSES=$(echo "$RESPONSE" | jq -r '.check_runs[] | select(.name | contains("build") or contains("🏗️")) | .status' | sort | uniq)
  
  if [[ -n "$STATUSES" && "$STATUSES" == "completed" ]]; then
     echo "All build checks completed."
     echo "$RESPONSE" | jq -r '.check_runs[] | select(.name | contains("build") or contains("🏗️")) | "\(.name): \(.conclusion)"'
     exit 0
  fi

  if [[ -z "$STATUSES" ]]; then
     echo "No checks containing 'build' or '🏗️' found yet."
  else
     echo "Build checks status: $STATUSES"
  fi

  echo "Waiting 30s..."
  sleep 30
done
echo "Timed out after 6 minutes."
exit 1
