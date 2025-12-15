# PR Monitor & Fix Skill Usage Guide

**🆕 Enhanced with GitHub GraphQL Thread Resolution!** Now you can actually resolve GitHub review threads (not just track them locally).

## Quick Start

### Option 1: Create PR and Monitor (Recommended)
1. **Let Claude create and monitor the PR**:
   ```
   Create a PR for my current branch and start monitoring it
   ```

2. **Claude will**:
   - Create the PR using GitHub MCP or gh cli
   - Start background monitoring automatically
   - Create fix plans when issues are detected

### Option 2: Monitor Existing PR
1. **After creating a PR**, ask Claude to monitor it:
   ```
   Please monitor the current PR and create a fix plan for any issues
   ```

2. **Claude will analyze** the PR and create a structured todo list:
   - CI failures (highest priority)
   - Review comments requesting changes
   - Suggestions and improvements

3. **Execute the fix plan**:
   ```
   Please start executing the fix plan
   ```

## Detailed Usage Examples

### Example 1: Create PR via GitHub MCP
```
User: Create a PR for my current branch

Claude: I'll create a PR for your current branch using GitHub MCP tools.
[checking current branch and changes...]

PR #5678 created successfully!
Title: "Add user authentication feature"
Description: [automatically generated from commit messages]

Would you like me to start background monitoring for this PR?
```

### Example 2: Background Monitoring with Real-time Updates
```
User: Yes, please monitor PR #5678 in background

Claude: Starting background monitor for PR #5678...
[Background task started with PID 12345]

The monitor will check for changes every 30 seconds and notify you immediately when:
- New review comments are posted
- CI status changes
- New commits are pushed
- PR state changes (closed/merged)

✅ Background monitoring active for PR #5678
```

### Example 3: Real-time Notification
```
[System Notification - 5 minutes later]

Claude: 🔔 Update on PR #5678!

New changes detected:
- CI Check: tests (FAILED) - 2 test failures
- Review Comment: @reviewer requested changes at src/auth.js:45

I've created a fix plan with 2 high-priority items:
1. Fix failing tests in UserAuth.test.js
2. Address review comment about input validation

Would you like me to start fixing these issues?
```

### Example 4: Initial PR Monitoring (Manual)
```
User: I just created PR #1234. Can you monitor it for issues?

Claude: I'll monitor PR #1234 and analyze it for any issues.
[fetched PR data, checking CI status and comments...]

I found the following issues in PR #1234:

🔴 HIGH PRIORITY
1. **CI Check: tests** (CI)
   - Status: Failed
   - Details: 2 test failures in UserAuth.test.js

2. **Review request by @reviewer** (REVIEW)
   - Changes requested in review
   - Location: src/auth.js:45
   - Details: "Please add input validation here"

🟡 MEDIUM PRIORITY
3. **Comment by @teammate** (COMMENT)
   - Potential action item in comment
   - Details: "You should consider updating the documentation for this change"

I've created a fix plan. Would you like me to start implementing these fixes?
```

### Example 2: Executing Fixes
```
User: Yes, please start fixing the CI failures first.

Claude: I'll start with the high-priority CI failures.

[Todo list updated - first item marked as in_progress]

Let me check the test failures first...
[examines test output...]
I see the issue. The test expects UserAuth to throw an error when email is invalid, but the current implementation doesn't validate email format.

[Fixes the code]
Now let me run the tests to verify the fix...

[Commits and pushes the fix]
✅ Fixed CI test failures. Moving to the next item...
```

### Example 3: Continuous Monitoring
```
User: Can you check if there are any new comments on PR #1234?

Claude: Let me check for new comments on PR #1234...

There's a new review comment from @senior-dev:
- Location: src/utils.js:128
- "Good catch on the validation! One suggestion: consider using a regex library for email validation"

Should I add this to the fix plan as a suggestion?
```

## Features

### 🆕 GitHub Thread Resolution (NEW!)
- **Actual Thread Resolution**: Resolve GitHub review threads via GraphQL API (not just local tracking)
- **Thread ID Management**: Automatically extract and manage GitHub thread IDs
- **Real-time Sync**: Resolution status synchronized with GitHub (reviewers can see it!)
- **Backward Compatible**: All existing local tracking still works
- **Enhanced Monitoring**: Background monitor now thread-aware

### Automatic Issue Categorization
- **CI Failures**: Test failures, build errors, linting issues
- **Review Comments**: Direct requests for changes (now with actual thread resolution)
- **Suggestions**: Improvements and best practices
- **Documentation**: Missing or outdated docs

### Priority-Based Fixing
1. **High Priority**: Must fix before merge (CI failures, requested changes)
2. **Medium Priority**: Should fix (suggestions, improvements)
3. **Low Priority**: Nice to have (documentation, style)

### Progress Tracking
- Each fix is tracked with status (pending/in_progress/completed)
- Commits are automatically linked to the issues they fix
- Progress reports after each fix

### Smart Commit Messages
```
fix: Add email validation to UserAuth class

Fixes test failures in UserAuth.test.js
Addresses review comment from @reviewer about input validation
```

## Integration with GitHub MCP Tools

This skill uses these GitHub MCP tools:
- `pull_request_read` with method "get" to fetch PR details
- `pull_request_read` with method "get_reviews" for review comments
- `pull_request_read` with method "get_comments" for regular comments
- `pull_request_read` with method "get_status" for CI status
- `create_or_update_file` to make code changes
- `push_files` to commit and push fixes

## Best Practices

1. **Small Focused Commits**: One fix per commit when possible
2. **Clear Messages**: Explain what and why in commit messages
3. **Verify Fixes**: Re-run checks after fixing CI issues
4. **Communicate**: Add PR comments explaining complex fixes
5. **Iterate**: Update the fix plan as new issues arise

## Advanced Usage

### Multi-PR Monitoring
```
User: I'm working on 3 PRs. Can you monitor all of them?

Claude: I'll monitor all 3 PRs in parallel:
- PR #1234: "Feature X" (monitoring active)
- PR #1235: "Fix Y" (monitoring active)
- PR #1236: "Update Z" (monitoring active)

Each PR has its own background monitor and fix plan.
```

### Custom Monitoring Intervals
```
User: Monitor this critical PR every 10 seconds

Claude: Starting high-frequency monitor for PR #1234 (10-second interval).
This is useful for active PR reviews or when CI is about to complete.
```

### Selective Fixing
```
User: Only execute the high-priority items in the fix plan

Claude: I'll work on just the high-priority items (CI failures and requested changes).
```

### Automated Responses
```
User: Auto-respond to "fix typos" review comments

Claude: I'll automatically fix minor issues like typos and formatting without asking for confirmation.
Other issues will still be added to the fix plan for review.
```

### Batch Fixes
```
User: Can you fix all documentation-related comments in one commit?

Claude: I'll group all documentation fixes into a single commit for better organization.
```

### Integration with IDE/Editor
The background monitor can integrate with editors for real-time notifications:
- VS Code: Desktop notifications
- Vim/Neovim: Status line updates
- Emacs: Modeline notifications

## 🆕 GitHub Thread Resolution Usage

### Setup Requirements
1. **Node.js** (v14+): For GraphQL API integration
2. **GitHub Token**: Set `GITHUB_TOKEN` environment variable with `repo` scope
3. **Install**: The resolver script is included in the skill

### Basic Thread Resolution Workflow
```
User: Start enhanced monitoring for PR #109 with thread resolution

Claude: I'll start comprehensive monitoring with GraphQL thread resolution:

🔧 Initializing enhanced monitor...
✅ Node.js detected
✅ GitHub token found
🔍 Fetching review threads via GraphQL API...

📋 Found 3 review threads:
1. Thread ID: MDR0VGhyZWFkRmllbGRQdWxsUmVxdWVzdDE0MjUyNjE6MTYxODc5
   Status: ❌ UNRESOLVED - contracts/x402x-mint/X402X.sol:2

2. Thread ID: MDR0VGhyZWFkRmllbGRQdWxsUmVxdWVzdDE0MjUyNjE6MTYxODgw
   Status: ❌ UNRESOLVED - background_monitor.sh:10

✅ Enhanced monitoring active with thread resolution support
```

### Resolving Threads on GitHub
```
User: I've fixed the pragma issue. Can you resolve the thread?

Claude: I'll resolve the thread on GitHub so reviewers can see it's fixed.

🔧 Resolving thread MDR0VGhyZWFkRmllbGRQdWxsUmVxdWVzdDE0MjUyNjE6MTYxODc5 via GitHub GraphQL API...
✅ Thread resolved successfully on GitHub!
   Resolved by: claude at 1/15/2025, 3:45:00 PM
   Thread ID: MDR0VGhyZWFkRmllbGRQdWxsUmVxdWVzdDE0MjUyNjE6MTYxODc5

The thread is now marked as resolved on GitHub for all reviewers to see.
```

### Enhanced Status Monitoring
```
User: What's the current resolution status for PR #109?

Claude: === Enhanced Resolution Status for PR #109 ===

Local Tracking:
- Total review comments: 5
- Resolved comments: 3
- Unresolved comments: 2

GitHub Thread Resolution:
✅ Thread MDR0VGhyZWFk... resolved (contracts/x402x-mint/X402X.sol:2)
❌ Thread MDR0VGhyZWFk... unresolved (background_monitor.sh:10)

💡 Use thread resolution commands to sync local fixes with GitHub
```

### Available Thread Commands
- **List Threads**: `list-threads` - Show all threads with GitHub thread IDs
- **Resolve Thread**: `resolve-thread <id>` - Actually resolve on GitHub
- **Unresolve Thread**: `unresolve-thread <id>` - Mark as unresolved on GitHub
- **Enhanced Status**: `enhanced-status` - Show both local and GitHub status
- **Fetch Threads**: `fetch-threads` - Refresh thread information

### Fallback Mode
If Node.js or GitHub token aren't available, the system automatically falls back to local tracking:
```
⚠️  GraphQL features unavailable (Node.js or GITHUB_TOKEN missing)
✅ Falling back to basic comment tracking (local resolution only)
```

For complete documentation, see: [THREAD_RESOLUTION_GUIDE.md](THREAD_RESOLUTION_GUIDE.md)