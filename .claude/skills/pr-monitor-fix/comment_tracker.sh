#!/bin/bash

# Comment Resolution Tracker
# Helps track which review comments have been resolved

OWNER=${1:-""}
REPO=${2:-""}
PR_NUMBER=${3:-""}

if [[ -z "$OWNER" || -z "$REPO" || -z "$PR_NUMBER" ]]; then
    echo "Usage: $0 <owner> <repo> <pr_number>"
    exit 1
fi

STATE_DIR="/tmp/pr_monitor_${OWNER}_${REPO}_${PR_NUMBER}"
RESOLVED_FILE="$STATE_DIR/resolved_comments.json"

# Initialize resolved comments file if it doesn't exist
if [[ ! -f "$RESOLVED_FILE" ]]; then
    echo '{}' > "$RESOLVED_FILE"
fi

# Function to list all review comments
list_comments() {
    echo "=== Review Comments for PR #${PR_NUMBER} ==="
    gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/comments | \
        jq -r '.[] | select(.subject_type == "line") | {
            id: .id,
            path: .path,
            line: .originalLine,
            author: .user.login,
            body: .body | split("\n")[0],
            url: .html_url,
            resolved: false
        }' | jq -s '.'
}

# Function to mark a comment as resolved
resolve_comment() {
    local comment_id="$1"

    # Check if comment exists
    local comment=$(gh api repos/${OWNER}/${REPO}/pulls/comments/${comment_id} 2>/dev/null)
    if [[ $? -ne 0 ]]; then
        echo "Error: Comment ${comment_id} not found"
        return 1
    fi

    # Add to resolved list
    local comment_info=$(echo "$comment" | jq '{
        id: .id,
        path: .path,
        line: .originalLine,
        author: .user.login,
        resolved_at: now | strftime("%Y-%m-%dT%H:%M:%SZ")
    }')

    jq --argjson comment "$comment_info" '.[$comment.id] = $comment' "$RESOLVED_FILE" > "${RESOLVED_FILE}.tmp"
    mv "${RESOLVED_FILE}.tmp" "$RESOLVED_FILE"

    echo "Comment ${comment_id} marked as resolved"
}

# Function to mark comment as unresolved
unresolve_comment() {
    local comment_id="$1"

    jq --argjson id "$comment_id" 'del(.[$id])' "$RESOLVED_FILE" > "${RESOLVED_FILE}.tmp"
    mv "${RESOLVED_FILE}.tmp" "$RESOLVED_FILE"

    echo "Comment ${comment_id} marked as unresolved"
}

# Function to show resolution status
show_status() {
    echo "=== Comment Resolution Status ==="

    # Get all comments
    local all_comments=$(gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/comments | \
        jq -r '.[] | select(.subject_type == "line")')

    # Get resolved count
    local resolved_count=$(jq 'keys | length' "$RESOLVED_FILE")

    # Get total count
    local total_count=$(echo "$all_comments" | jq 'length')

    echo "Total review comments: $total_count"
    echo "Resolved comments: $resolved_count"
    echo "Unresolved comments: $((total_count - resolved_count))"
    echo ""

    if [[ $resolved_count -gt 0 ]]; then
        echo "=== Resolved Comments ==="
        jq -r 'to_entries[] | "  \(.value.id): \(.value.path):\(.value.line) (resolved: \(.value.resolved_at))"' "$RESOLVED_FILE"
    fi

    if [[ $((total_count - resolved_count)) -gt 0 ]]; then
        echo ""
        echo "=== Unresolved Comments ==="
        echo "$all_comments" | jq -r '.[] | select(.id as $id | $id | IN($resolved | keys[]) | not) |
            "  \(.id): \(.path):\(.line) by \(.user.login) - \(.body | split("\n")[0])"'
    fi
}

# Function to auto-resolve comments by matching fixed commits
auto_resolve() {
    echo "=== Auto-resolving Comments ==="

    # Get recent commits
    local commits=$(gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/commits | jq -r '.[].sha')

    for commit in $commits; do
        # Get commit message
        local commit_msg=$(gh api repos/${OWNER}/${REPO}/commits/${commit} | jq -r '.message')

        # Look for fix mentions (fixes, resolves, closes)
        local fixed_ids=$(echo "$commit_msg" | grep -oE '#[0-9]+' | grep -oE '[0-9]+' | sort -u)

        for id in $fixed_ids; do
            # Check if this is a comment ID
            local comment=$(gh api repos/${OWNER}/${REPO}/pulls/comments/${id} 2>/dev/null)
            if [[ $? -eq 0 ]]; then
                echo "Auto-resolving comment ${id} (found in commit message)"
                resolve_comment "$id"
            fi
        done
    done
}

# Function to generate resolution summary
generate_summary() {
    local summary_file="${STATE_DIR}/resolution_summary.md"

    cat > "$summary_file" << EOF
# PR #${PR_NUMBER} Comment Resolution Summary

## Statistics
- **Total Review Comments**: $(gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/comments | jq '[.[] | select(.subject_type == "line")] | length')
- **Resolved Comments**: $(jq 'keys | length' "$RESOLVED_FILE")
- **Pending Comments**: $($(gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/comments | jq '[.[] | select(.subject_type == "line")] | length') - $(jq 'keys | length' "$RESOLVED_FILE"))

## Resolved Comments
EOF

    if [[ $(jq 'keys | length' "$RESOLVED_FILE") -gt 0 ]]; then
        jq -r 'to_entries[] |
            "- **Comment \(.key)**: \(.value.path):\(.value.line) (resolved at \(.value.resolved_at))"' "$RESOLVED_FILE" >> "$summary_file"
    fi

    echo "Summary saved to: $summary_file"
}

# Main command handling
case "${1:-list}" in
    "list")
        list_comments
        ;;
    "resolve")
        resolve_comment "${2:-}"
        ;;
    "unresolve")
        unresolve_comment "${2:-}"
        ;;
    "status")
        show_status
        ;;
    "auto")
        auto_resolve
        ;;
    "summary")
        generate_summary
        ;;
    *)
        echo "Usage: $0 [list|resolve <id>|unresolve <id>|status|auto|summary]"
        echo ""
        echo "Commands:"
        echo "  list        - List all review comments"
        echo "  resolve <id> - Mark comment as resolved"
        echo "  unresolve <id> - Mark comment as unresolved"
        echo "  status      - Show resolution status"
        echo "  auto        - Auto-resolve from commit messages"
        echo "  summary     - Generate resolution summary"
        exit 1
        ;;
esac