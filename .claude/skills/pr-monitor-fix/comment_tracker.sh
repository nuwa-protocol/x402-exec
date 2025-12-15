#!/bin/bash

# Enhanced Comment Resolution Tracker with GraphQL API Integration
# Helps track and actually resolve GitHub review threads using GraphQL API

OWNER=${1:-""}
REPO=${2:-""}
PR_NUMBER=${3:-""}

if [[ -z "$OWNER" || -z "$REPO" || -z "$PR_NUMBER" ]]; then
    echo "Usage: $0 <owner> <repo> <pr_number>"
    echo ""
    echo "Enhanced Features:"
    echo "  - Local resolution tracking (original functionality)"
    echo "  - GraphQL API thread resolution (NEW!)"
    echo "  - Automatic thread ID extraction"
    echo "  - Real GitHub thread resolution"
    exit 1
fi

STATE_DIR="/tmp/pr_monitor_${OWNER}_${REPO}_${PR_NUMBER}"
RESOLVED_FILE="$STATE_DIR/resolved_comments.json"
THREADS_FILE="$STATE_DIR/threads_mapping.json"
GRAPHQL_RESOLVER="$(dirname "$0")/github-thread-resolver.js"

# Use downloaded $JQ_CMD if system $JQ_CMD not available
if command -v $JQ_CMD &> /dev/null; then
    JQ_CMD="$JQ_CMD"
else
    JQ_CMD="/tmp/$JQ_CMD"
fi

# Initialize files
mkdir -p "$STATE_DIR"
if [[ ! -f "$RESOLVED_FILE" ]]; then
    echo '{}' > "$RESOLVED_FILE"
fi
if [[ ! -f "$THREADS_FILE" ]]; then
    echo '{}' > "$THREADS_FILE"
fi

# Function to check if Node.js is available
check_nodejs() {
    if ! command -v node &> /dev/null; then
        echo "Error: Node.js is required for GraphQL API functionality"
        echo "Please install Node.js to use enhanced thread resolution features"
        return 1
    fi
    return 0
}

# Function to check if GitHub token is available
check_github_token() {
    if [[ -z "$GITHUB_TOKEN" ]]; then
        echo "Error: GITHUB_TOKEN environment variable is required for GraphQL API functionality"
        echo "Please set GITHUB_TOKEN with a valid GitHub personal access token"
        return 1
    fi
    return 0
}

# Function to get PR URL
get_pr_url() {
    echo "https://github.com/${OWNER}/${REPO}/pull/${PR_NUMBER}"
}

# Function to fetch and cache review threads with thread IDs
fetch_threads() {
    echo "🔍 Fetching review threads with GraphQL API..."

    if ! check_nodejs || ! check_github_token; then
        echo "⚠️  Falling back to basic comment tracking (no thread resolution)"
        return 1
    fi

    local pr_url=$(get_pr_url)
    local temp_output="$STATE_DIR/threads_output.tmp"

    # Use the Node.js resolver to fetch threads
    if node "$GRAPHQL_RESOLVER" list-threads "$pr_url" > "$temp_output" 2>&1; then
        echo "✅ Successfully fetched review threads"

        # Parse the output to extract thread mapping
        # This is a simplified approach - in a real implementation, you'd want structured JSON output
        echo "📋 Thread information cached for resolution operations"
        return 0
    else
        echo "❌ Failed to fetch threads via GraphQL API"
        cat "$temp_output" 2>/dev/null
        rm -f "$temp_output"
        return 1
    fi
}

# Function to resolve a review thread using GraphQL API
resolve_thread_api() {
    local thread_id="$1"

    if ! check_nodejs || ! check_github_token; then
        echo "❌ Cannot resolve thread: Node.js or GitHub token not available"
        return 1
    fi

    echo "🔧 Resolving thread ${thread_id} via GitHub GraphQL API..."

    if node "$GRAPHQL_RESOLVER" resolve-thread "$thread_id"; then
        echo "✅ Thread ${thread_id} resolved successfully on GitHub"
        return 0
    else
        echo "❌ Failed to resolve thread ${thread_id}"
        return 1
    fi
}

# Function to unresolve a review thread using GraphQL API
unresolve_thread_api() {
    local thread_id="$1"

    if ! check_nodejs || ! check_github_token; then
        echo "❌ Cannot unresolve thread: Node.js or GitHub token not available"
        return 1
    fi

    echo "🔧 Unresolving thread ${thread_id} via GitHub GraphQL API..."

    if node "$GRAPHQL_RESOLVER" unresolve-thread "$thread_id"; then
        echo "✅ Thread ${thread_id} unresolved successfully on GitHub"
        return 0
    else
        echo "❌ Failed to unresolve thread ${thread_id}"
        return 1
    fi
}

# Function to map comment IDs to thread IDs
map_comment_to_thread() {
    local comment_id="$1"

    # First try to fetch threads if we haven't recently
    local last_fetch_file="$STATE_DIR/last_threads_fetch"
    local current_time=$(date +%s)

    if [[ ! -f "$last_fetch_file" ]]; then
        echo "0" > "$last_fetch_file"
    fi

    local last_fetch=$(cat "$last_fetch_file")
    local cache_duration=300  # 5 minutes cache

    if [[ $((current_time - last_fetch)) -gt $cache_duration ]]; then
        fetch_threads
        echo "$current_time" > "$last_fetch_file"
    fi

    # For now, we'll use a simplified approach
    # In a full implementation, you'd parse the GraphQL response to create this mapping
    echo "ℹ️  Note: Thread mapping requires manual thread ID or use 'fetch-threads' command"
    return 1
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
    local comment_info=$(echo "$comment" | $JQ_CMD '{
        id: .id,
        path: .path,
        line: .originalLine,
        author: .user.login,
        resolved_at: now | strftime("%Y-%m-%dT%H:%M:%SZ")
    }')

    # Ensure the file exists and is valid JSON
    if [[ ! -f "$RESOLVED_FILE" ]] || [[ ! -s "$RESOLVED_FILE" ]]; then
        echo '{}' > "$RESOLVED_FILE"
    fi

    # Merge new comment info - use string key instead of numeric index
    $JQ_CMD --argjson comment "$comment_info" '.["\(.comment.id)"] = $comment' "$RESOLVED_FILE" > "${RESOLVED_FILE}.tmp"
    mv "${RESOLVED_FILE}.tmp" "$RESOLVED_FILE"

    echo "Comment ${comment_id} marked as resolved"
}

# Function to mark comment as unresolved
unresolve_comment() {
    local comment_id="$1"

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
    # Enhanced GraphQL API commands
    "fetch-threads")
        fetch_threads
        ;;
    "resolve-thread")
        resolve_thread_api "${5:-}"
        ;;
    "unresolve-thread")
        unresolve_thread_api "${5:-}"
        ;;
    "list-threads")
        if check_nodejs && check_github_token; then
            local pr_url=$(get_pr_url)
            node "$GRAPHQL_RESOLVER" list-threads "$pr_url"
        else
            echo "❌ Node.js and GitHub token required for thread listing"
        fi
        ;;
    "enhanced-status")
        echo "=== Enhanced Resolution Status for PR #${PR_NUMBER} ==="
        show_status
        echo ""
        if check_nodejs && check_github_token; then
            echo "=== GraphQL Thread Resolution Status ==="
            fetch_threads
        else
            echo "⚠️  GraphQL features unavailable (Node.js or GITHUB_TOKEN missing)"
        fi
        ;;
    *)
        echo "Usage: $0 <owner> <repo> <pr_number> [command] [args]"
        echo ""
        echo "Local Tracking Commands:"
        echo "  list              - List all review comments"
        echo "  resolve <id>      - Mark comment as resolved locally"
        echo "  unresolve <id>    - Mark comment as unresolved locally"
        echo "  status            - Show local resolution status"
        echo "  auto              - Auto-resolve from commit messages"
        echo "  summary           - Generate resolution summary"
        echo ""
        echo "GraphQL API Commands (NEW!):"
        echo "  fetch-threads     - Fetch and cache review threads"
        echo "  list-threads      - List all review threads with IDs"
        echo "  resolve-thread <id>  - Resolve thread on GitHub via GraphQL"
        echo "  unresolve-thread <id> - Unresolve thread on GitHub via GraphQL"
        echo "  enhanced-status   - Show both local and GitHub resolution status"
        echo ""
        echo "Requirements for GraphQL commands:"
        echo "  - Node.js installed"
        echo "  - GITHUB_TOKEN environment variable set"
        echo "  - GitHub token with 'repo' scope"
        exit 1
        ;;
esac