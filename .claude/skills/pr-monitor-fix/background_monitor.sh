#!/bin/bash

# Background PR Monitor Script
# Usage: ./background_monitor.sh <owner> <repo> <pr_number> [check_interval]

OWNER=${1:-""}
REPO=${2:-""}
PR_NUMBER=${3:-""}
CHECK_INTERVAL=${4:-30}  # Default check every 30 seconds

if [[ -z "$OWNER" || -z "$REPO" || -z "$PR_NUMBER" ]]; then
    echo "Usage: $0 <owner> <repo> <pr_number> [check_interval]"
    exit 1
fi

# Create a temporary file to store the last known state
STATE_FILE="/tmp/pr_monitor_${OWNER}_${REPO}_${PR_NUMBER}.state"
LOG_FILE="/tmp/pr_monitor_${OWNER}_${REPO}_${PR_NUMBER}.log"

echo "$(date): Starting background monitor for ${OWNER}/${REPO} PR #${PR_NUMBER}" | tee -a "$LOG_FILE"
echo "Check interval: ${CHECK_INTERVAL} seconds" | tee -a "$LOG_FILE"

# Function to get PR state and save to file
get_pr_state() {
    # Use GitHub CLI to fetch PR data
    local pr_data=$(gh pr view ${PR_NUMBER} --repo ${OWNER}/${REPO} --json title,state,reviewDecision,commits,comments,reviews,statusCheckRollup 2>/dev/null)

    if [[ $? -eq 0 ]]; then
        echo "$pr_data" > "$STATE_FILE.tmp"
        mv "$STATE_FILE.tmp" "$STATE_FILE"
        return 0
    else
        echo "$(date): Error fetching PR data" | tee -a "$LOG_FILE"
        return 1
    fi
}

# Function to check for changes
check_changes() {
    if [[ ! -f "$STATE_FILE" ]]; then
        echo "$(date): First run - initializing state" | tee -a "$LOG_FILE"
        return 1
    fi

    # Get current state
    local current_data=$(gh pr view ${PR_NUMBER} --repo ${OWNER}/${REPO} --json title,state,reviewDecision,commits,comments,reviews,statusCheckRollup 2>/dev/null)

    if [[ $? -ne 0 ]]; then
        return 0  # Error fetching, skip this round
    fi

    # Compare with stored state
    local stored_data=$(cat "$STATE_FILE")

    if [[ "$current_data" != "$stored_data" ]]; then
        echo "$(date): *** CHANGE DETECTED ***" | tee -a "$LOG_FILE"
        echo "$current_data" | jq '.' | tee -a "$LOG_FILE"

        # Extract key changes
        local old_commits=$(echo "$stored_data" | jq -r '.commits | length')
        local new_commits=$(echo "$current_data" | jq -r '.commits | length')
        local old_comments=$(echo "$stored_data" | jq -r '.comments | length')
        local new_comments=$(echo "$current_data" | jq -r '.comments | length')
        local old_reviews=$(echo "$stored_data" | jq -r '.reviews | length')
        local new_reviews=$(echo "$current_data" | jq -r '.reviews | length')

        # Report specific changes
        if [[ $new_commits -gt $old_commits ]]; then
            echo "$(date): New commits detected ($old_commits -> $new_commits)" | tee -a "$LOG_FILE"
        fi

        if [[ $new_comments -gt $old_comments ]]; then
            echo "$(date): New comments detected ($old_comments -> $new_comments)" | tee -a "$LOG_FILE"
        fi

        if [[ $new_reviews -gt $old_reviews ]]; then
            echo "$(date): New reviews detected ($old_reviews -> $new_reviews)" | tee -a "$LOG_FILE"
        fi

        # Update stored state
        echo "$current_data" > "$STATE_FILE"
        return 1  # Changes detected
    fi

    return 0  # No changes
}

# Initialize
get_pr_state

# Main monitoring loop
while true; do
    sleep "$CHECK_INTERVAL"

    # Check if PR still exists and is open
    local pr_state=$(gh pr view ${PR_NUMBER} --repo ${OWNER}/${REPO} --json state -q '.state' 2>/dev/null)

    if [[ "$pr_state" == "CLOSED" || "$pr_state" == "MERGED" ]]; then
        echo "$(date): PR #${PR_NUMBER} is ${pr_state}. Stopping monitor." | tee -a "$LOG_FILE"
        break
    fi

    # Check for changes
    if ! check_changes; then
        # Changes detected - could trigger notifications here
        echo "$(date): Notifying about changes..." | tee -a "$LOG_FILE"
        # In a real implementation, this could:
        # - Send a desktop notification
        # - Call a webhook
        # - Update a status file that Claude can check
    fi
done

# Cleanup
rm -f "$STATE_FILE" "$STATE_FILE.tmp"
echo "$(date): Monitor stopped" | tee -a "$LOG_FILE"