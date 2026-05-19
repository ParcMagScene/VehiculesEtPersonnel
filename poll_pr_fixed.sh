repo="ParcMagScene/VehiculesEtPersonnel"
branch="chore/web-modal-cleanup"
max_attempts=4 # Enough to verify since they seem done
attempt=1

while [ $attempt -le $max_attempts ]; do
    echo "Attempt $attempt/$(date +%H:%M:%S): Fetching check runs..."
    
    sha=$(curl -s "https://api.github.com/repos/$repo/commits/$branch" | jq -r '.sha')
    
    if [ "$sha" == "null" ] || [ -z "$sha" ] ; then
        echo "Error: Could not find branch or commit."
    else
        echo "Latest SHA: $sha"
        response=$(curl -s "https://api.github.com/repos/$repo/commits/$sha/check-runs")
        
        # Correctly filter and count
        build_checks=$(echo "$response" | jq -c '.check_runs[] | select(.name | contains("build") or contains("🏗️"))')
        
        if [ -z "$build_checks" ]; then
            echo "No build checks found yet."
        else
            total=$(echo "$build_checks" | jq -s 'length')
            completed=$(echo "$build_checks" | jq -s '[.[] | select(.status == "completed")] | length')
            
            echo "Found $total build check(s). Completed: $completed."
            
            if [ "$total" -eq "$completed" ] && [ "$total" -gt 0 ]; then
                echo "All build checks completed!"
                echo "$build_checks" | jq -r -s '.[] | .name + ": " + .conclusion'
                exit 0
            fi
        fi
    fi
    
    [ $attempt -lt $max_attempts ] && sleep 10
    attempt=$((attempt + 1))
done

exit 1
