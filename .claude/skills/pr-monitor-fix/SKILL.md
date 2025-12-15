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
- **Enhanced monitoring**: "Start enhanced monitoring for PR [number] (detailed analysis)"
- **Stop monitoring**: "Stop monitoring PR [number]"
- **Check status**: "What's the current status of PR [number]?"
- **List monitored PRs**: "List all PRs I'm monitoring"

### Fix Management
- **Update plan**: "Update the fix plan for PR [number] with new comments"
- **Execute fixes**: "Execute the next item in the fix plan for PR [number]"
- **Complete fix**: "Mark this fix as complete and continue with next item"

### Comment Resolution Tracking
- **Check resolution status**: "What's the resolution status of comments in PR [number]?"
- **Mark comment resolved**: "Mark comment [id] as resolved in PR [number]"
- **Auto-resolve comments**: "Auto-resolve comments in PR [number] from commit messages"
- **Generate resolution report**: "Generate a comment resolution summary for PR [number]"

### Enhanced Monitoring Features
- **Detailed analysis**: Use enhanced monitoring for comprehensive issue detection
- **Smart categorization**: Automatically categorize issues by priority and type
- **Status persistence**: Track resolution status across monitoring sessions
- **Auto-reporting**: Generate reports when issues are resolved or new issues appear

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

## Advanced Usage

### Enhanced Monitoring with Comment Resolution
```
User: Start enhanced monitoring for PR #108 with comment tracking

Claude: I'll start comprehensive monitoring with comment resolution tracking:

1. **Enhanced Monitoring**: Deep issue detection and categorization
2. **Comment Tracker**: Initialize resolution status tracking
3. **Auto-Sync**: Automatically resolve comments from commit messages
4. **Status Reports**: Generate periodic resolution summaries

[Background tasks started with enhanced scripts]
```

### Comment Resolution Workflow
```
User: What's the resolution status of PR #108?

Claude: Let me check the current resolution status...

[Uses comment_tracker.sh to analyze]

Current Status for PR #108:
- Total review comments: 5
- Resolved comments: 2
- Unresolved comments: 3

Unresolved Comments:
  - Comment #2618274248: background_monitor.sh:10 (API rate limiting)
  - Comment #2618274171: contracts/x402x-mint/X402X.sol:2 (pragma solidity)
  - Comment #2618274145: contracts/x402x-mint/X402X_flat_new.sol:757 (hex literal)

Would you like me to auto-resolve comments from recent commits or mark specific ones as resolved?
```

### Smart Comment Resolution
```
User: Auto-resolve comments in PR #108

Claude: Analyzing recent commits for comment references...

Found 2 comments automatically resolved:
- Comment #2618274171: Referenced in commit abc123 (Solidity pragma fix)
- Comment #2618274145: Referenced in commit def456 (hex literal fix)

Remaining unresolved comments have been updated in the resolution tracker.
```

### Resolution Reports and Sharing
```
User: Generate a resolution summary for PR #108

Claude: I'll create a comprehensive resolution summary:

[Uses comment_tracker.sh summary command]

# PR #108 Comment Resolution Summary

## Statistics
- **Total Review Comments**: 5
- **Resolved Comments**: 3
- **Pending Comments**: 2

## Resolved Comments
- **Comment 2618274248**: background_monitor.sh:10 (resolved at 2025-01-15T15:45:00Z)
- **Comment 2618274171**: contracts/x402x-mint/X402X.sol:2 (resolved at 2025-01-15T15:30:00Z)
- **Comment 2618274145**: contracts/x402x-mint/X402X_flat_new.sol:757 (resolved at 2025-01-15T15:35:00Z)

The resolution summary has been saved and can be shared with the PR reviewers.
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

### Enhanced Monitoring Scripts

The skill now includes integrated scripts for comprehensive monitoring:

#### background_monitor_enhanced.sh
- **Comprehensive monitoring**: Fetches all PR data including comments, reviews, and CI status
- **Smart issue detection**: Automatically categorizes and prioritizes issues
- **Real-time reporting**: Generates alerts and summaries when changes occur
- **Persistent state**: Maintains state across monitoring sessions

#### comment_tracker.sh
- **Resolution tracking**: Tracks which comments have been resolved
- **Auto-resolution**: Automatically detects resolved comments from commit messages
- **Status reports**: Generates comprehensive resolution summaries
- **Batch operations**: Supports bulk marking resolved/unresolved

#### Integration Benefits
- **No manual script execution**: All functionality accessible through natural language
- **Smart workflows**: Automatic detection and categorization of issues
- **Persistent tracking**: Resolution status preserved across sessions
- **Team collaboration**: Easy sharing of resolution reports

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

## Enhanced Usage & Workflows

### Quick Start

#### Enhanced Monitoring
```
"Start enhanced monitoring for PR #108"
```

#### Comment Resolution
```
"What's the resolution status of comments in PR #108?"
```

### Enhanced Monitoring Features

#### 1. Comprehensive Data Collection
The enhanced monitor captures:
- **PR metadata**: Title, state, author, mergeable status
- **All comments**: Including line comments and review comments
- **Review data**: Complete review threads and decisions
- **CI/CD status**: All status checks and workflows
- **Historical data**: State changes over time

#### 2. Smart Issue Detection
Issues are automatically categorized:
- **CI Failures**: Failed builds, tests, or checks
- **Review Comments**: Code changes requested by reviewers
- **Suggestions**: Improvements and best practices
- **Priority Levels**: High/Medium/Low based on impact

#### 3. Real-time Notifications
Get notified when:
- New review comments are posted
- CI status changes (failures/successes)
- Commits are added
- Review decisions are made

### Comment Resolution Workflow

#### Checking Resolution Status
```
"Check the resolution status of PR #108"
```

Output example:
```
Current Status for PR #108:
- Total review comments: 5
- Resolved comments: 3
- Unresolved comments: 2

Unresolved Comments:
  - Comment #2618274248: background_monitor.sh:10 (API rate limiting)
  - Comment #2618274171: contracts/x402x-mint/X402X.sol:2 (pragma solidity)
```

#### Marking Comments as Resolved
```
"Mark comment #2618274248 as resolved in PR #108"
```

#### Auto-Resolution from Commits
```
"Auto-resolve comments in PR #108"
```

The system automatically:
- Scans commit messages for comment references (`fixes #xxx`, `resolves #xxx`)
- Updates resolution status accordingly
- Provides summary of changes

#### Generating Resolution Reports
```
"Generate a comment resolution summary for PR #108"
```

Creates a detailed markdown report with:
- Resolution statistics
- List of resolved comments with timestamps
- Pending items needing attention

### Advanced Workflows

#### Complete Monitoring Setup
```
"Start enhanced monitoring for PR #108 with auto-resolution tracking"
```

This starts:
1. Enhanced monitoring with comprehensive analysis
2. Comment tracker with resolution status
3. Auto-sync from commit messages
4. Periodic status reports

#### Multi-PR Management
```
"I'm monitoring PRs #108, #109, and #110. What's their combined resolution status?"
```

#### Integration with Fix Execution
```
"Start enhanced monitoring for PR #108"
→ [Monitors for changes]
→ "Found 3 new review comments, creating fix plan..."
→ "Executing fix for background_monitor.sh API rate limiting"
→ "Comment #2618274248 marked as resolved"
→ "Committing fix with proper message"
```

### Data Persistence

All monitoring and resolution data is stored in:
```
/tmp/pr_monitor_<owner>_<repo>_<pr_number>/
├── pr_state.json          # Current PR state
├── comments.json           # Comments history
├── reviews.json            # Reviews data
├── issues.json             # Issues analysis
├── resolved_comments.json   # Resolution tracking
├── summary.md             # Status summaries
└── monitor.log             # Activity log
```

This data persists across monitoring sessions, allowing:
- Continuous tracking after restarts
- Historical analysis and reporting
- State comparison and change detection

### Best Practices

#### 1. Enhanced Monitoring for Active PRs
Use enhanced monitoring when:
- PR is under active review
- Multiple reviewers are involved
- CI checks are critical
- Complex changes are being discussed

#### 2. Comment Resolution Tracking
Track resolution when:
- Working on PRs with many review comments
- Need to demonstrate progress to reviewers
- Collaborating with team members
- Preparing for PR completion

#### 3. Auto-Resolution Benefits
Enable auto-resolution to:
- Automatically track fixed issues
- Maintain accurate status without manual updates
- Reduce administrative overhead
- Generate comprehensive progress reports

#### 4. Resolution Reporting
Generate summaries when:
- Requesting PR merge
- Creating status updates
- Documenting progress
- Handing off to other team members

## Notes

- Requires GitHub MCP server to be configured
- Works best with structured review comments that clearly indicate required actions
- CI monitoring requires appropriate repository permissions
- Fix plans are preserved across sessions for ongoing work
- Enhanced monitoring requires jq and GitHub CLI to be installed
- Comment resolution tracking uses local state persistence for reliability