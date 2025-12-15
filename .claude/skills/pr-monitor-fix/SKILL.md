---
name: pr-monitor-fix
description: Create GitHub PRs (via gh cli or MCP), monitor them continuously in background, and auto-generate fix plans for review comments and CI failures. Supports real-time monitoring and automated issue resolution.
---

# PR Monitor & Fix Skill

This skill helps you systematically monitor and fix issues in GitHub Pull Requests after they've been submitted.

## Capabilities

- **Create PRs**: Create pull requests using either `gh` cli or GitHub MCP tools
- **Background Monitoring**: Continuously monitor PRs in background using shell tasks
- **Real-time Notifications**: Get notified when new comments, reviews, or CI status changes occur
- **Auto-generate Fix Plans**: Automatically create todo lists when issues are detected
- **Execute Fixes**: Implement fixes systematically with proper validation
- **Multi-PR Support**: Monitor multiple PRs simultaneously

## When to Use

- Before creating a PR - use skill to create PR via MCP or gh
- Immediately after creating a PR - start background monitoring
- When you want to continuously monitor a PR for new feedback
- When you need to systematically address multiple review comments
- When CI checks are failing and need to be fixed
- When managing multiple PRs simultaneously

## How It Works

### 1. Create PR (Optional)
```
"Create a PR for my current branch"  # Uses GitHub MCP
or
"Create a PR for my branch using gh"  # Uses gh cli
```

The skill will:
- Detect current branch and changes
- Create PR using preferred method (MCP or gh)
- Get PR number and details
- Ask if you want to start monitoring

### 2. Start Background Monitoring
```
"Start monitoring PR #1234 in background"
or
"Create a PR and start monitoring it"
```

The skill will:
- Create a background monitoring task
- Check PR status every 30 seconds (configurable)
- Notify immediately when changes are detected
- Auto-generate fix plans when new issues appear

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

### PR Creation
- **Create PR via MCP**: "Create a PR for my current branch"
- **Create PR via gh**: "Create a PR using gh cli"
- **Create and monitor**: "Create PR and start monitoring"

### Background Monitoring
- **Start monitoring**: "Start monitoring PR [number] in background"
- **Stop monitoring**: "Stop monitoring PR [number]"
- **Check status**: "What's the current status of PR [number]?"
- **List monitored PRs**: "List all PRs I'm monitoring"

### Fix Management
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
- `create_pull_request`: Create PRs via MCP
- `pull_request_read`: Get PR details, diff, and comments
- `list_commits`: Check commit history
- `get_commit`: Analyze specific commits
- `add_comment_to_pending_review`: Respond to review comments
- `create_or_update_file`: Make code changes
- `push_files`: Commit and push fixes

And bash tools for background monitoring:
- `Bash` with `run_in_background`: Start background monitoring tasks
- `TaskOutput`: Retrieve monitoring results

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