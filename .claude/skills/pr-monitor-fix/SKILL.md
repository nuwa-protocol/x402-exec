---
name: pr-monitor-fix
description: Monitor GitHub PRs for review comments and CI failures, then create and execute a systematic fix plan. Use after creating PRs to automatically track and resolve issues.
---

# PR Monitor & Fix Skill

This skill helps you systematically monitor and fix issues in GitHub Pull Requests after they've been submitted.

## Capabilities

- **Monitor PR Status**: Track review comments, CI checks, and PR state changes
- **Analyze Issues**: Categorize and prioritize review comments and CI failures
- **Create Fix Plans**: Generate systematic todo lists for addressing all issues
- **Execute Fixes**: Implement fixes in the correct order with proper validation

## When to Use

- After creating a PR with `gh pr create`
- When you want to continuously monitor a PR for new feedback
- When you need to systematically address multiple review comments
- When CI checks are failing and need to be fixed

## How It Works

### 1. Start Monitoring
```
"Please monitor PR #1234 and create a fix plan for any issues"
```

The skill will:
- Fetch PR details and current status
- Check all CI check runs and their status
- Gather all review comments and regular comments
- Analyze and categorize the findings

### 2. Generate Fix Plan
The skill creates a structured todo list with:
- **CI Failures**: High priority technical issues
- **Review Comments**: Code changes requested by reviewers
- **Suggestions**: Optional improvements mentioned
- **Documentation**: Any documentation or comment updates needed

### 3. Execute Fixes
```
"Please start executing the fix plan for PR #1234"
```

The skill will:
- Work through todos in priority order
- Make necessary code changes
- Commit fixes with appropriate messages
- Push updates and verify CI status

## Monitoring Commands

- **Start monitoring**: "Monitor PR [number] and create a fix plan"
- **Check status**: "What's the current status of PR [number]?"
- **Update plan**: "Update the fix plan for PR [number] with new comments"
- **Execute fixes**: "Execute the next item in the fix plan for PR [number]"
- **Complete fix**: "Mark this fix as complete and continue with next item"

## Issue Categories

### Priority 1: CI Failures
- Broken tests
- Build failures
- Linting errors
- Type checking failures

### Priority 2: Review Comments
- Requested code changes
- Logic corrections
- Security issues
- Performance concerns

### Priority 3: Suggestions
- Code style improvements
- Documentation updates
- Refactoring opportunities
- Best practice recommendations

## Example Workflow

```bash
# User creates a PR
gh pr create --title "Add new feature" --body "Description..."

# User asks Claude to monitor
"Please monitor this new PR and create a fix plan for any issues found"

# Claude analyzes and creates todo list
# User reviews the plan
"Good, please start executing the fix plan"

# Claude works through fixes systematically
# Each fix is committed and pushed
# Progress is tracked and reported
```

## Available Tools

This skill uses GitHub MCP tools to:
- `pull_request_read`: Get PR details, diff, and comments
- `list_commits`: Check commit history
- `get_commit`: Analyze specific commits
- `add_comment_to_pending_review`: Respond to review comments
- `create_or_update_file`: Make code changes
- `push_files`: Commit and push fixes

## Best Practices

1. **Commit Frequency**: Make small, focused commits for each fix
2. **Commit Messages**: Use clear messages linking to the issue being fixed
3. **Progress Tracking**: Mark items as complete before moving to next
4. **Verification**: Re-run CI checks after major fixes
5. **Communication**: Add comments explaining complex fixes

## Configuration

The skill automatically:
- Monitors the current repository/branch context
- Detects the most recent PR if no number is specified
- Updates the fix plan when new comments are added
- Validates that fixes resolve the reported issues

## Notes

- Requires GitHub MCP server to be configured
- Works best with structured review comments that clearly indicate required actions
- CI monitoring requires appropriate repository permissions
- Fix plans are preserved across sessions for ongoing work