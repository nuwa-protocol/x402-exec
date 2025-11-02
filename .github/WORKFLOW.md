# Development Workflow Rules

> **⚠️ IMPORTANT FOR AI AGENTS**: If you are an AI coding assistant working on this repository, **YOU MUST READ THIS FILE FIRST** before making any code changes or commits. These rules are mandatory and will be enforced.

This document defines the Git workflow rules that **ALL agents and contributors MUST follow** when making code changes.

## Git Branch Rules

### 1. Working on Main Branch

**Rule**: If you are currently on the `main` branch, you **MUST**:
- Create a new branch first before making any commits
- Do NOT commit directly to `main`
- Do NOT push directly to `main` without review

**Example**:
```bash
# ✅ CORRECT: Create branch first
git checkout -b feature/my-feature
# ... make changes and commit ...

# ❌ WRONG: Committing directly to main
git checkout main
git commit -m "..."  # DON'T DO THIS
```

### 2. Working on Non-Main Branch

**Rule**: If you are on a non-main branch, you:
- ✅ **CAN** commit changes
- ❌ **MUST NOT** push without review
- ⏳ **WAIT** for code review before pushing

**Example**:
```bash
# ✅ CORRECT: Commit but wait for review
git checkout feature/my-feature
git add .
git commit -m "feat: add feature"
# DON'T push yet - wait for review

# ❌ WRONG: Pushing immediately
git push origin feature/my-feature  # DON'T DO THIS without review
```

### 3. Code Review Process

**Before Pushing**:
1. All changes must be reviewed
2. Ask the user/team for review approval
3. Only push after explicit approval

**After Review**:
- If approved, push the branch
- Create a Pull Request if merging to `main`
- Wait for PR review and approval before merging

## AI Agent Specific Rules

### For AI Coding Assistants

When making code changes:

1. **Check current branch first**:
   ```bash
   git branch --show-current
   ```

2. **If on `main`**:
   - Create new branch: `git checkout -b feature/description`
   - Make changes and commit
   - Ask user for review
   - DO NOT push

3. **If on non-main branch**:
   - Make changes and commit
   - Show summary of changes to user
   - Ask for review
   - DO NOT push until approved

4. **Never push to `main` directly** - always through PR process

### Reminders

- Always inform the user before pushing code
- Always ask for review before pushing
- Prefer creating PRs over direct pushes
- Document significant changes in commit messages

## Summary

```
┌─────────────────┐
│  Current Branch │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
  main    non-main
    │         │
    │    ┌────┴────┐
    │    │         │
    │ Commit │
    │    │    Push  │
    │    ✅    ❌  │
    │              │
Create    Commit & Wait
Branch    for Review
    │         │
    ✅        ✅
```

## Enforcement

This workflow ensures:
- Code quality through reviews
- Collaboration between team members
- Safety of the main branch
- Traceability of all changes

**Remember**: When in doubt, ask for review before pushing!
