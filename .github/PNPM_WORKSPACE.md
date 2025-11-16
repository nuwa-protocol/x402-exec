# PNPM Workspace Guide

## About pnpm-lock.yaml

In a pnpm workspace monorepo, **there should only be one `pnpm-lock.yaml` file in the root directory**, and all workspace packages share this lock file.

### ✅ Correct Project Structure

```
x402_settle/
├── pnpm-lock.yaml         ✅ Single lock file
├── pnpm-workspace.yaml
├── package.json
├── typescript/packages/
│   ├── core/
│   │   └── package.json
│   ├── react/
│   │   └── package.json   ❌ Should NOT have pnpm-lock.yaml
│   └── hono/
│       └── package.json   ❌ Should NOT have pnpm-lock.yaml
└── facilitator/
    └── package.json       ❌ Should NOT have pnpm-lock.yaml
```

### ❌ Not Recommended

**Although pnpm will look up for workspace configuration, it's still not recommended to run `pnpm install` directly in a subpackage directory:**

```bash
# ⚠️ Not recommended: Although pnpm can find the workspace, it may cause unexpected behavior
cd typescript/packages/react
pnpm install
# Issues:
# - Some versions/scenarios may create independent pnpm-lock.yaml
# - Behavior is less explicit than running from root
# - May affect dependency resolution of other packages

# ✅ Recommended: Always install from root directory
cd /path/to/x402_settle
pnpm install
```

**Why do this even though pnpm can find the workspace?**

1. **Behavior consistency**: Different pnpm versions may handle it differently
2. **Avoid surprises**: Ensure using the root lock file
3. **Clear intent**: Explicitly indicate operating on the entire workspace

### ✅ Correct Workflow

1. **Install dependencies**: Always run from root directory
   ```bash
   pnpm install
   ```

2. **Add dependencies to a specific package**: Use `--filter`
   ```bash
   # Add dependency to @x402x/react
   pnpm add react --filter @x402x/react
   
   # Add dev dependency to @x402x/hono
   pnpm add -D vitest --filter @x402x/hono
   ```

3. **Run subpackage scripts**: Use `--filter`
   ```bash
   pnpm --filter @x402x/react build
   pnpm --filter @x402x/hono test
   ```

4. **Install all package dependencies**
   ```bash
   pnpm install
   ```

### Exceptions

According to `package.json` configuration, only the following packages can have independent lock files:

- `web/frontend/` - Managed independently using `--ignore-workspace` flag

This is because it uses a different package management strategy or needs isolated dependencies.

### If You Accidentally Created an Independent Lock File

1. Delete `pnpm-lock.yaml` in the subpackage
2. Delete the subpackage's `node_modules`
3. Reinstall from root directory:
   ```bash
   rm typescript/packages/react/pnpm-lock.yaml
   rm -rf typescript/packages/react/node_modules
   pnpm install
   ```

### `.gitignore` Configuration

The `.gitignore` has been updated to prevent accidentally committing lock files in subpackages:

```gitignore
# Prevent pnpm-lock.yaml in workspace packages (should only be in root)
# Exception: web/frontend has its own lock file (uses --ignore-workspace)
typescript/packages/*/pnpm-lock.yaml
facilitator/pnpm-lock.yaml
examples/**/pnpm-lock.yaml
apps/*/pnpm-lock.yaml
```

## References

- [PNPM Workspace Documentation](https://pnpm.io/workspaces)
- [PNPM --filter Documentation](https://pnpm.io/filtering)

