# PR Monitor & Fix Skill Usage Guide

**Simple Reply-Based Comment Resolution** - Monitor PRs and resolve review comments by posting reply acknowledgments.

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

### Reply-Based Comment Resolution
- **GitHub Reply Integration**: Post reply comments to acknowledge review feedback
- **Auto Token Detection**: Automatically uses GitHub token from `gh auth token`
- **Local Tracking**: Maintain resolution status for monitoring and progress tracking
- **Lightweight**: No complex dependencies, uses reliable GitHub REST API
- **Real-time Notifications**: Background monitoring detects new comments instantly

### Automatic Issue Categorization
- **CI Failures**: Test failures, build errors, linting issues
- **Review Comments**: Direct requests for changes (with reply-based resolution)
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

## Simple Setup Requirements

### Prerequisites
1. **GitHub CLI (gh)**: Install and authenticate with `gh auth login`
2. **GitHub Token**: Either from `gh auth login` or set `GITHUB_TOKEN` environment variable
3. **jq**: JSON processor for data handling

### Basic Resolution Workflow
```
User: Start monitoring for PR #109

Claude: I'll start comprehensive monitoring with reply-based resolution:

🔧 Initializing monitor...
✅ GitHub CLI detected
✅ GitHub token found via 'gh auth token'
🔍 Fetching review comments...

📋 Found 3 review comments:
1. Comment ID: 123456 - contracts/x402x-mint/X402X.sol:2
2. Comment ID: 123457 - background_monitor.sh:10
3. Comment ID: 123458 - src/utils.js:45

✅ Monitoring active with reply-based resolution
```

### Resolving Comments with Replies
```
User: I've fixed the pragma issue. Can you resolve the comment?

Claude: I'll post a reply comment to acknowledge the fix:

🔧 Posting reply to comment #123456...
✅ Reply posted successfully!
   Comment: "This issue has been addressed. Thank you for the feedback!"
   Location: contracts/x402x-mint/X402X.sol:2

The reviewer can see the reply and understand the issue is resolved.
```

### Available Commands
- **list**: List all review comments
- **resolve <id>**: Post a reply acknowledging the issue is addressed
- **unresolve <id>**: Remove from local resolution tracking
- **status**: Show current resolution status
- **auto**: Auto-resolve from commit message references
- **summary**: Generate resolution summary report