#!/bin/bash

# Simple Comment Resolution Tracker with Reply-Based Resolution
# Tracks and responds to GitHub review comments by posting replies

OWNER=${1:-""}
REPO=${2:-""}
PR_NUMBER=${3:-""}

if [[ -z "$OWNER" || -z "$REPO" || -z "$PR_NUMBER" ]]; then
    echo "Usage: $0 <owner> <repo> <pr_number>"
    echo ""
    echo "Features:"
    echo "  - Reply to review comments (visible to reviewers)"
    echo "  - Local resolution tracking for monitoring"
    echo "  - Auto-detect GitHub token via 'gh auth token'"
    exit 1
fi

STATE_DIR="/tmp/pr_monitor_${OWNER}_${REPO}_${PR_NUMBER}"
RESOLVED_FILE="$STATE_DIR/resolved_comments.json"

# Use downloaded jq if system jq not available
if command -v jq &> /dev/null; then
    JQ_CMD="jq"
else
    JQ_CMD="/tmp/jq"
fi

# Initialize resolved comments file
mkdir -p "$STATE_DIR"
if [[ ! -f "$RESOLVED_FILE" ]]; then
    echo '{}' > "$RESOLVED_FILE"
fi


# Function to get GitHub token (auto-fetch if not set)
get_github_token() {
    if [[ -n "$GITHUB_TOKEN" ]]; then
        echo "$GITHUB_TOKEN"
        return 0
    fi

    # Try to get token from gh cli
    if command -v gh &> /dev/null; then
        local gh_token=$(gh auth token 2>/dev/null)
        if [[ $? -eq 0 && -n "$gh_token" ]]; then
            echo "$gh_token"
            return 0
        fi
    fi

    return 1
}

# Function to check if GitHub token is available
check_github_token() {
    local token=$(get_github_token)
    if [[ -z "$token" ]]; then
        echo "Error: GitHub token is required for thread resolution functionality"
        echo "Please either:"
        echo "  1. Set GITHUB_TOKEN environment variable, or"
        echo "  2. Run 'gh auth login' to authenticate with GitHub CLI"
        return 1
    fi
    return 0
}

# Function to get PR URL
get_pr_url() {
    echo "https://github.com/${OWNER}/${REPO}/pull/${PR_NUMBER}"
}


# Function to reply to a review comment to acknowledge it's addressed
reply_to_review_comment() {
    local comment_id="$1"
    local reply_message="${2:-"This issue has been addressed. Thank you for the feedback!"}"

    echo "💬 Replying to review comment ${comment_id}..."

    # Try to get comment details
    local comment_data=$(gh api repos/${OWNER}/${REPO}/pulls/comments/${comment_id} 2>/dev/null)
    if [[ $? -ne 0 ]]; then
        echo "❌ Failed to get comment ${comment_id}"
        return 1
    fi

    # Extract the needed fields
    local commit_id=$(echo "$comment_data" | $JQ_CMD -r '.commit_id // empty')
    local path=$(echo "$comment_data" | $JQ_CMD -r '.path // empty')
    local position=$(echo "$comment_data" | $JQ_CMD -r '.position // .original_position // empty')

    echo "🔍 Debug: commit_id=$commit_id, path=$path, position=$position" >&2

    # If we can't get the position, try a simpler approach
    if [[ -z "$commit_id" || -z "$path" || -z "$position" ]]; then
        echo "⚠️  Could not determine exact comment location, trying general reply approach"

        # Try to get the latest commit ID
        local latest_commit=$(gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/commits | $JQ_CMD -r '.[0].sha // empty')

        if [[ -n "$latest_commit" && "$latest_commit" != "null" ]]; then
            commit_id="$latest_commit"
            echo "📋 Using latest commit: ${commit_id}"

            # Create a general review comment
            local review_data=$(cat <<EOF
{
    "body": "Addressing comment #${comment_id}: ${reply_message}",
    "commit_id": "${commit_id}",
    "event": "COMMENT"
}
EOF
)

            if gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/reviews \
                --method POST \
                --input - <<< "$review_data" \
                --jq '.id' > /dev/null 2>&1; then
                echo "✅ Review comment posted successfully for comment ${comment_id}"
                return 0
            else
                echo "❌ Failed to post review comment for ${comment_id}"
                return 1
            fi
        else
            echo "❌ Could not get latest commit ID"
            return 1
        fi
    fi

    # Create a specific reply comment at the same location
    local reply_data=$(cat <<EOF
{
    "body": "${reply_message}",
    "commit_id": "${commit_id}",
    "path": "${path}",
    "position": ${position}
}
EOF
)

    if gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/comments \
        --method POST \
        --input - <<< "$reply_data" \
        --jq '.id' > /dev/null 2>&1; then
        echo "✅ Reply posted successfully for comment ${comment_id}"
        return 0
    else
        echo "❌ Failed to post reply for comment ${comment_id}"
        return 1
    fi
}



# Function to list all review comments
list_comments() {
    echo "=== Review Comments for PR #${PR_NUMBER} ==="
    gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/comments | \
        jq '[.[] | select(.subject_type == "line") | {
            id: .id,
            path: .path,
            line: .originalLine,
            author: .user.login,
            body: .body | split("\n")[0],
            url: .html_url,
            resolved: false
        }]' | jq -s '.'
}

# Function to mark a comment as resolved (now uses reply approach)
resolve_comment() {
    local comment_id="$1"

    echo "🔍 Processing comment ${comment_id}..."

    # Try to reply to the comment on GitHub
    if reply_to_review_comment "$comment_id"; then
        # Mark as resolved locally for tracking
        local comment_data=$(gh api repos/${OWNER}/${REPO}/pulls/comments/${comment_id} 2>/dev/null)
        if [[ $? -eq 0 ]]; then
            local comment_info=$(echo "$comment_data" | $JQ_CMD '{
                id: .id,
                path: .path,
                line: .originalLine,
                author: .user.login,
                resolved_at: now | strftime("%Y-%m-%dT%H:%M:%SZ"),
                replied_on_github: true
            }')

            # Ensure the file exists and is valid JSON
            if [[ ! -f "$RESOLVED_FILE" ]] || [[ ! -s "$RESOLVED_FILE" ]]; then
                echo '{}' > "$RESOLVED_FILE"
            fi

            # Merge new comment info
            $JQ_CMD --argjson comment "$comment_info" '.["\(.comment.id)"] = $comment' "$RESOLVED_FILE" > "${RESOLVED_FILE}.tmp"
            mv "${RESOLVED_FILE}.tmp" "$RESOLVED_FILE"
        fi

        echo "✅ Comment ${comment_id} replied to on GitHub and tracked locally"
        return 0
    else
        echo "⚠️  Failed to reply on GitHub, marking as resolved locally only"

        # Fallback to local tracking
        local comment_info='{
            "id": "'$comment_id'",
            "resolved_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
            "resolved_locally_only": true
        }'

        # Ensure the file exists and is valid JSON
        if [[ ! -f "$RESOLVED_FILE" ]] || [[ ! -s "$RESOLVED_FILE" ]]; then
            echo '{}' > "$RESOLVED_FILE"
        fi

        # Merge new comment info
        $JQ_CMD --argjson comment "$comment_info" '.["\(.comment.id)"] = $comment' "$RESOLVED_FILE" > "${RESOLVED_FILE}.tmp"
        mv "${RESOLVED_FILE}.tmp" "$RESOLVED_FILE"

        echo "Comment ${comment_id} marked as resolved locally only"
        return 0
    fi
}

# Function to mark comment as unresolved (now uses thread unresolution)
unresolve_comment() {
    local comment_id="$1"

    # Check if we have a thread_id for this comment
    local thread_id=$($JQ_CMD -r --arg id "$comment_id" '.[($id | tostring)].thread_id // empty' "$RESOLVED_FILE")

    if [[ -n "$thread_id" && "$thread_id" != "null" ]]; then
        echo "🔄 Unresolving thread ${thread_id} for comment ${comment_id}..."

        # Try to unresolve on GitHub
        if unresolve_thread_api "$thread_id"; then
            echo "✅ Thread unresolved on GitHub"
        else
            echo "⚠️  Failed to unresolve on GitHub, but updating local tracking"
        fi
    else
        echo "🔍 No thread ID found for comment ${comment_id}, updating local tracking only"
    fi

    # Remove from local tracking
    $JQ_CMD --argjson id "$comment_id" 'del(.[("\($id)"])]' "$RESOLVED_FILE" > "${RESOLVED_FILE}.tmp"
    mv "${RESOLVED_FILE}.tmp" "$RESOLVED_FILE"

    echo "Comment ${comment_id} marked as unresolved"
}

# Function to show resolution status
show_status() {
    echo "=== Comment Resolution Status ==="

    # Get all comments count directly
    local total_count=$(gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/comments | \
        $JQ_CMD '[.[] | select(.subject_type == "line")] | length' | tr -d '\n')

    # Get resolved count
    local resolved_count=$($JQ_CMD 'keys | length' "$RESOLVED_FILE" | tr -d '\n')

    # Get all comments for unresolved listing
    local all_comments=$(gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/comments | \
        $JQ_CMD '[.[] | select(.subject_type == "line")]')

    echo "Total review comments: $total_count"
    echo "Resolved comments: $resolved_count"
    echo "Unresolved comments: $((total_count - resolved_count))"
    echo ""

    if [[ $resolved_count -gt 0 ]]; then
        echo "=== Resolved Comments ==="
        $JQ_CMD -r 'to_entries[] | "  \(.value.id): \(.value.path):\(.value.line) (resolved: \(.value.resolved_at))"' "$RESOLVED_FILE"
    fi

    if [[ $((total_count - resolved_count)) -gt 0 ]]; then
        echo ""
        echo "=== Unresolved Comments ==="
        echo "$all_comments" | $JQ_CMD -r --argjson resolved "$(cat "$RESOLVED_FILE")" '.[] | select(.id as $id | ($id | tostring) | IN($resolved | keys[]) | not) |
            "  \(.id): \(.path):\(.line) by \(.user.login) - \(.body | split("\n")[0])"'
    fi
}

# Function to auto-resolve comments by matching fixed commits
auto_resolve() {
    echo "=== Auto-resolving Comments ==="

    # Get recent commits
    local commits=$(gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/commits | $JQ_CMD -r '.[].sha')

    for commit in $commits; do
        # Get commit message
        local commit_msg=$(gh api repos/${OWNER}/${REPO}/commits/${commit} | $JQ_CMD -r '.message')

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

    # Calculate counts first
    local total_count=$(gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/comments | \
        $JQ_CMD '[.[] | select(.subject_type == "line")] | length' | tr -d '\n')
    local resolved_count=$($JQ_CMD 'keys | length' "$RESOLVED_FILE" | tr -d '\n')
    local pending_count=$((total_count - resolved_count))

    cat > "$summary_file" << EOF
# PR #${PR_NUMBER} Comment Resolution Summary

## Statistics
- **Total Review Comments**: ${total_count}
- **Resolved Comments**: ${resolved_count}
- **Pending Comments**: ${pending_count}

## Resolved Comments
EOF

    if [[ ${resolved_count} -gt 0 ]]; then
        $JQ_CMD -r 'to_entries[] |
            "- **Comment \(.key)**: \(.value.path):\(.value.line) (resolved at \(.value.resolved_at))"' "$RESOLVED_FILE" >> "$summary_file"
    fi

    echo "Summary saved to: $summary_file"
}

# Main command handling
COMMAND="${4:-list}"

case "$COMMAND" in
    "list")
        list_comments
        ;;
    "resolve")
        resolve_comment "${5:-}"
        ;;
    "unresolve")
        unresolve_comment "${5:-}"
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
        echo "Usage: $0 <owner> <repo> <pr_number> [command] [args]"
        echo ""
        echo "Simple Comment Resolution Commands:"
        echo "  list              - List all review comments"
        echo "  resolve <id>      - Resolve comment by posting a reply on GitHub"
        echo "  unresolve <id>    - Unresolve comment (removes from local tracking)"
        echo "  status            - Show resolution status"
        echo "  auto              - Auto-resolve from commit messages"
        echo "  summary           - Generate resolution summary"
        echo ""
        echo "Features:"
        echo "  ✅ Auto-detects GitHub token via 'gh auth token'"
        echo "  ✅ Posts replies to GitHub review comments (visible to reviewers)"
        echo "  ✅ Falls back to local tracking if GitHub API fails"
        echo "  ✅ Tracks resolution status locally for monitoring"
        echo "  ✅ Simple and lightweight - no complex dependencies"
        echo ""
        echo "How it works:"
        echo "  • 'resolve' posts a reply comment acknowledging the issue is addressed"
        echo "  • Reviewers can see the reply and understand the status"
        echo "  • Local tracking maintains resolution state for monitoring"
        echo ""
        echo "Requirements:"
        echo "  - GitHub CLI (gh) authenticated OR GITHUB_TOKEN environment variable"
        echo "  - GitHub token with 'repo' scope"
        exit 1
        ;;
esac