# PR Monitor & Fix Skill Usage Guide

## Quick Start

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

### Example 1: Initial PR Monitoring
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

### Automatic Issue Categorization
- **CI Failures**: Test failures, build errors, linting issues
- **Review Comments**: Direct requests for changes
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

### Custom Monitoring
```
User: Monitor PR #1234 but focus only on CI failures and critical review comments

Claude: I'll monitor PR #1234 with a focus on CI failures and critical review comments, ignoring minor suggestions.
```

### Selective Fixing
```
User: Only execute the high-priority items in the fix plan

Claude: I'll work on just the high-priority items (CI failures and requested changes).
```

### Batch Fixes
```
User: Can you fix all documentation-related comments in one commit?

Claude: I'll group all documentation fixes into a single commit for better organization.
```