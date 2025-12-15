#!/bin/bash

# Enhanced Background PR Monitor Script
# Usage: ./background_monitor.sh <owner> <repo> <pr_number> [check_interval]

OWNER=${1:-""}
REPO=${2:-""}
PR_NUMBER=${3:-""}
CHECK_INTERVAL=${4:-30}  # Default check every 30 seconds

# Enforce a minimum interval to avoid API rate limiting
MIN_INTERVAL=10
if [[ "$CHECK_INTERVAL" -lt "$MIN_INTERVAL" ]]; then
    echo "Warning: CHECK_INTERVAL too low ($CHECK_INTERVAL). Setting to minimum allowed ($MIN_INTERVAL seconds)." | tee -a "$LOG_FILE"
    CHECK_INTERVAL=$MIN_INTERVAL
fi

if [[ -z "$OWNER" || -z "$REPO" || -z "$PR_NUMBER" ]]; then
    echo "Usage: $0 <owner> <repo> <pr_number> [check_interval]"
    exit 1
fi

# Create temporary files to store state
STATE_DIR="/tmp/pr_monitor_${OWNER}_${REPO}_${PR_NUMBER}"
mkdir -p "$STATE_DIR"
STATE_FILE="$STATE_DIR/pr_state.json"
COMMENTS_FILE="$STATE_DIR/comments.json"
REVIEWS_FILE="$STATE_DIR/reviews.json"
ISSUES_FILE="$STATE_DIR/issues.json"
LOG_FILE="$STATE_DIR/monitor.log"

# Use downloaded $JQ_CMD if system $JQ_CMD not available
if command -v $JQ_CMD &> /dev/null; then
    JQ_CMD="$JQ_CMD"
else
    JQ_CMD="/tmp/$JQ_CMD"
fi

echo "$(date): Starting enhanced background monitor for ${OWNER}/${REPO} PR #${PR_NUMBER}" | tee -a "$LOG_FILE"
echo "Check interval: ${CHECK_INTERVAL} seconds" | tee -a "$LOG_FILE"
echo "State directory: $STATE_DIR" | tee -a "$LOG_FILE"

# Function to get comprehensive PR data
get_pr_data() {
    # Get PR basic info
    local pr_data=$(gh pr view ${PR_NUMBER} --repo ${OWNER}/${REPO} \
        --json title,state,reviewDecision,commits,comments,reviews,statusCheckRollup,author,body,mergeable 2>/dev/null)

    if [[ $? -ne 0 ]]; then
        echo "$(date): Error fetching PR basic data" | tee -a "$LOG_FILE"
        return 1
    fi

    # Get detailed comments via API
    local comments_data=$(gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/comments 2>/dev/null)

    # Get detailed reviews via API
    local reviews_data=$(gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/reviews 2>/dev/null)

    # Get issues/threads (for conversation tracking)
    local threads_data=$(gh api repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/review-threads 2>/dev/null)

    # Enhanced thread data with GraphQL support
    local graphql_threads=""
    if command -v node &> /dev/null && [[ -n "$GITHUB_TOKEN" ]]; then
        local pr_url="https://github.com/${OWNER}/${REPO}/pull/${PR_NUMBER}"
        local resolver_script="$(dirname "$0")/github-thread-resolver.js"

        if [[ -f "$resolver_script" ]]; then
            # Try to get GraphQL thread data
            local graphql_output=$(node "$resolver_script" list-threads "$pr_url" 2>/dev/null | $JQ_CMD -Rs 'split("\n")' 2>/dev/null || echo "[]")
            if [[ "$graphql_output" != "[]" ]]; then
                graphql_threads="$graphql_output"
            fi
        fi
    fi

    # Combine all data
    local combined_data=$($JQ_CMD -n \
        --argjson pr "$pr_data" \
        --argjson comments "$comments_data" \
        --argjson reviews "$reviews_data" \
        --argjson threads "$threads_data" \
        --argjson graphql_threads "$graphql_threads" \
        '{
            pr: $pr,
            comments: $comments,
            reviews: $reviews,
            threads: $threads,
            graphql_threads: $graphql_threads,
            timestamp: now | strftime("%Y-%m-%dT%H:%M:%SZ")
        }')

    echo "$combined_data"
}

# Function to extract actionable items from data
extract_issues() {
    local data_file="$1"

    # Extract CI failures
    local ci_failures=$($JQ_CMD -r '
        .pr.statusCheckRollup[]
        | select(.conclusion == "FAILURE" or .status == "IN_PROGRESS" and (.conclusion == null or .conclusion != "SUCCESS"))
        | {
            name: .name,
            status: .status,
            conclusion: .conclusion,
            detailsUrl: .detailsUrl,
            workflowName: .workflowName
        }
    ' "$data_file")

    # Extract unresolved review comments with enhanced thread support
    local review_comments=$($JQ_CMD -r '
        [.comments[] | select(.subject_type == "line" and .path != null)]
        + [.reviews[] | .comments[]? | select(.path != null)]
        + [.threads[] | select(.resolved == false) | .comments[]? | select(.path != null)]
        | group_by(.path + ":" + (.originalLine | tostring))
        | map({
            path: .[0].path,
            line: .[0].originalLine,
            comments: map(.body),
            author: .[0].user.login,
            resolved: false,
            url: .[0].html_url,
            count: length,
            threadId: .[0].threadId // null
        })
    ' "$data_file")

    # Extract GraphQL thread information for enhanced resolution tracking
    local graphql_threads_info=$($JQ_CMD -r '
        if .graphql_threads and (.graphql_threads | length) > 0 then
            ["Enhanced thread resolution available:",
             "GraphQL threads fetched successfully. Use comment_tracker.sh enhanced-status command."]
        else
            ["Basic thread tracking only - GraphQL features require Node.js and GITHUB_TOKEN"]
        end
    ' "$data_file")

    # Extract review decisions
    local review_decision=$($JQ_CMD -r '.pr.reviewDecision' "$data_file")

    # Merge into issues list with enhanced thread tracking
    $JQ_CMD -n \
        --argjson ci "$ci_failures" \
        --argjson comments "$review_comments" \
        --argjson decision "$review_decision" \
        --argjson threads_info "$graphql_threads_info" \
        '{
            ci_failures: $ci,
            review_comments: $comments,
            review_decision: $decision,
            graphql_info: $threads_info,
            unresolved_count: ($comments | map(select(.resolved == false)) | length),
            total_issues: ($ci | length) + ($comments | length),
            has_thread_ids: ($comments | map(select(.threadId != null)) | length > 0)
        }'
}

# Function to detect and report changes
check_changes() {
    local current_data="$1"
    local current_issues_file="$STATE_DIR/current_issues.json"

    # Extract current issues
    extract_issues "$current_data" > "$current_issues_file"

    if [[ ! -f "$STATE_FILE" ]]; then
        echo "$(date): First run - initializing state" | tee -a "$LOG_FILE"
        echo "$current_data" > "$STATE_FILE"

        # Report initial state
        local initial_issues=$($JQ_CMD -r '.total_issues' "$current_issues_file")
        local unresolved=$($JQ_CMD -r '.unresolved_count' "$current_issues_file")
        echo "$(date): Initial state - $initial_issues total issues, $unresolved unresolved" | tee -a "$LOG_FILE"

        return 1
    fi

    # Load previous state
    local previous_data=$(cat "$STATE_FILE")
    local previous_issues_file="$STATE_DIR/previous_issues.json"
    extract_issues "$previous_data" > "$previous_issues_file"

    # Compare issues
    local changes_detected=false

    # Check for new issues
    local new_ci_count=$($JQ_CMD -r '.ci_failures | length' "$current_issues_file")
    local old_ci_count=$($JQ_CMD -r '.ci_failures | length' "$previous_issues_file")

    if [[ $new_ci_count -gt $old_ci_count ]]; then
        echo "$(date): *** NEW CI FAILURES DETECTED ***" | tee -a "$LOG_FILE"
        $JQ_CMD -r '.ci_failures[] | "  - \(.name): \(.status) (\(.conclusion // "IN_PROGRESS"))"' "$current_issues_file" | tee -a "$LOG_FILE"
        changes_detected=true
    fi

    # Check for new review comments
    local new_comments_count=$($JQ_CMD -r '.review_comments | length' "$current_issues_file")
    local old_comments_count=$($JQ_CMD -r '.review_comments | length' "$previous_issues_file")

    if [[ $new_comments_count -gt $old_comments_count ]]; then
        echo "$(date): *** NEW REVIEW COMMENTS DETECTED ***" | tee -a "$LOG_FILE"
        $JQ_CMD -r '.review_comments[-1] | "  - \(.path):\(.line) by \(.author) - \(.count) comment(s)"' "$current_issues_file" | tee -a "$LOG_FILE"
        changes_detected=true
    fi

    # Check for resolved CI issues
    local resolved_ci=$($JQ_CMD -r '
        [.previous_ci_failures[] | select(.name as $name | $name | IN($current_ci_failures[].name) | not)]
        | .name
    ' --argjson current_ci_failures "$($JQ_CMD '.ci_failures' "$current_issues_file")" \
        --argjson previous_ci_failures "$($JQ_CMD '.ci_failures' "$previous_issues_file")" "$previous_issues_file")

    if [[ "$resolved_ci" != "null" && "$resolved_ci" != "" ]]; then
        echo "$(date): *** CI ISSUES RESOLVED ***" | tee -a "$LOG_FILE"
        echo "$resolved_ci" | sed 's/^/  - /' | tee -a "$LOG_FILE"
        changes_detected=true
    fi

    # Update state
    echo "$current_data" > "$STATE_FILE"

    if [[ "$changes_detected" == "true" ]]; then
        echo "$(date): Changes detected, current status:" | tee -a "$LOG_FILE"
        echo "  Total issues: $($JQ_CMD -r '.total_issues' "$current_issues_file")" | tee -a "$LOG_FILE"
        echo "  Unresolved: $($JQ_CMD -r '.unresolved_count' "$current_issues_file")" | tee -a "$LOG_FILE"
        echo "  Review decision: $($JQ_CMD -r '.review_decision // "NONE"' "$current_issues_file")" | tee -a "$LOG_FILE"
        return 1  # Changes detected
    fi

    return 0  # No changes
}

# Function to create summary report
create_summary_report() {
    local data_file="$1"
    local report_file="$STATE_DIR/summary.md"

    cat > "$report_file" << EOF
# PR #${PR_NUMBER} Monitor Summary

## Basic Info
- **Title**: $($JQ_CMD -r '.pr.title' "$data_file")
- **State**: $($JQ_CMD -r '.pr.state' "$data_file")
- **Author**: $($JQ_CMD -r '.pr.author.login' "$data_file")
- **Review Decision**: $($JQ_CMD -r '.pr.reviewDecision // "NONE"' "$data_file")
- **Mergeable**: $($JQ_CMD -r '.pr.mergeable' "$data_file")

## Issues Status
EOF

    local issues_file="$STATE_DIR/current_issues.json"
    if [[ -f "$issues_file" ]]; then
        cat >> "$report_file" << EOF
### CI Failures: $($JQ_CMD -r '.ci_failures | length' "$issues_file")
EOF
        $JQ_CMD -r '.ci_failures[] | "- **\(.name)**: \(.status) (\(.conclusion // "IN_PROGRESS"))"' "$issues_file" >> "$report_file"

        cat >> "$report_file" << EOF

### Review Comments: $($JQ_CMD -r '.unresolved_count' "$issues_file") unresolved
EOF
        $JQ_CMD -r '.review_comments[] | "- **\(.path):\(.line)** by \(.author) (\(.count) comment(s))"' "$issues_file" >> "$report_file"
    fi

    echo "$(date): Summary report created: $report_file" | tee -a "$LOG_FILE"
}

# Function to generate fix plan
generate_fix_plan() {
    local issues_file="$1"
    local plan_file="$STATE_DIR/fix_plan.json"

    if [[ ! -f "$issues_file" ]]; then
        echo "$(date): No issues file found for fix plan generation" | tee -a "$LOG_FILE"
        return 1
    fi

    $JQ_CMD '{
        ci_failures: .ci_failures | map({
            type: "ci",
            priority: "HIGH",
            title: "Fix CI failure: \(.name)",
            description: "CI check \(.name) is \(.conclusion // "failing")",
            file: null,
            line: null,
            resolved: false
        }),
        review_comments: .review_comments | map({
            type: "review",
            priority: "HIGH",
            title: "Address review comment on \(.path)",
            description: "Review comment by \(.author): \(.comments[0] // "Multiple comments")",
            file: .path,
            line: .line,
            resolved: .resolved
        }),
        total_count: (.ci_failures | length) + (.review_comments | length),
        unresolved_count: (.ci_failures | length) + (.review_comments | map(select(.resolved == false)) | length)
    }' "$issues_file" > "$plan_file"

    echo "$(date): Fix plan generated: $plan_file" | tee -a "$LOG_FILE"
    echo "  Total items: $($JQ_CMD -r '.total_count' "$plan_file")" | tee -a "$LOG_FILE"
    echo "  Unresolved: $($JQ_CMD -r '.unresolved_count' "$plan_file")" | tee -a "$LOG_FILE"
}

# Initialize
echo "$(date): Initializing enhanced monitor..." | tee -a "$LOG_FILE"

# Main monitoring loop
while true; do
    sleep "$CHECK_INTERVAL"

    # Check if PR still exists and is open
    pr_state=$(gh pr view ${PR_NUMBER} --repo ${OWNER}/${REPO} --json state -q '.state' 2>/dev/null)

    if [[ "$pr_state" == "CLOSED" || "$pr_state" == "MERGED" ]]; then
        echo "$(date): PR #${PR_NUMBER} is ${pr_state}. Stopping monitor." | tee -a "$LOG_FILE"
        # Create final summary
        local final_data=$(get_pr_data)
        create_summary_report "$final_data"
        break
    fi

    # Get current data and check for changes
    local current_data=$(get_pr_data)
    if [[ $? -eq 0 ]]; then
        if ! check_changes "$current_data"; then
            # Changes detected - generate reports
            create_summary_report "$current_data"
            generate_fix_plan "$STATE_DIR/current_issues.json"

            # Optional: Send notification (implement as needed)
            # send_notification "$STATE_DIR/summary.md"
        fi
    else
        echo "$(date): Failed to fetch PR data, will retry next cycle" | tee -a "$LOG_FILE"
    fi

    # Cleanup old logs (keep last 1000 lines)
    if [[ -f "$LOG_FILE" ]]; then
        tail -1000 "$LOG_FILE" > "${LOG_FILE}.tmp" && mv "${LOG_FILE}.tmp" "$LOG_FILE"
    fi
done

# Cleanup
echo "$(date): Monitor stopped" | tee -a "$LOG_FILE"
echo "State files preserved in: $STATE_DIR" | tee -a "$LOG_FILE"