# X402 Development Guide

This guide explains how to modify and publish x402 patch versions in the x402-exec project.

## Prerequisites

- All packages reference x402 via npm alias: `npm:@x402x/x402@0.6.6-patch.5`
- x402 source code is located in `deps/x402/` directory
- GitHub repository must have `NPM_TOKEN` secret configured for automated publishing

## Modifying X402

### 1. Edit X402 Source Code

Navigate to the x402 source directory:

```bash
cd deps/x402/typescript/packages/x402
```

The main source files are in the `src/` directory.

### 2. Build and Test Locally

Build x402 from the project root:

```bash
pnpm run build:x402-dev
```

Or build directly in the x402 directory:

```bash
cd deps/x402/typescript/packages/x402
npm run build
```

### 3. Test Local Changes

To test x402 changes with x402x packages:

```bash
# Build x402
pnpm run build:x402-dev

# Temporarily link local x402 for testing
# Edit package.json in the package you want to test:
# "x402": "file:../../../deps/x402/typescript/packages/x402"

# Reinstall dependencies
pnpm install

# Test your changes
pnpm run test

# Restore npm alias after testing:
# "x402": "npm:@x402x/x402@0.6.6-patch.5"
```

## Publishing New Patch Versions

### Automated Publishing (Recommended)

Use the dedicated GitHub workflow:

1. Commit your x402 changes to the main branch
2. Go to GitHub Actions → "Build and Publish X402"
3. Click "Run workflow"
4. Enter version number (e.g., `0.6.6-patch.3`) and tag (latest/beta/alpha)

### Manual Publishing

Use the publish script:

```bash
# Build x402
pnpm run build:x402-dev

# Set NPM_TOKEN environment variable
export NPM_TOKEN=your_npm_token_here

# Publish new version
./scripts/publish-x402.sh 0.6.6-patch.3 latest
```

### Getting NPM_TOKEN

1. Log in to [npmjs.com](https://npmjs.com)
2. Go to Access Tokens page
3. Click "Generate New Token"
4. Select "Automation" type
5. Copy the generated token

### GitHub Secrets Setup

Add `NPM_TOKEN` to repository secrets:
- Go to GitHub → Settings → Secrets and variables → Actions
- Add repository secret: `NPM_TOKEN`
- Paste your npm automation token

## Updating Dependencies

After publishing a new version, update all package references:

```bash
# Update version numbers in all package.json files
# Change from current version to new version

# Update lockfile
pnpm install
```

## Testing New Versions

```bash
# Full build and test
pnpm run build
pnpm run test

# Start development server
pnpm run dev
```

## X402 Source Structure

```
deps/x402/
├── typescript/
│   └── packages/
│       └── x402/           # Main x402 package
│           ├── src/
│           │   ├── paywall/    # Payment UI components
│           │   ├── types/      # TypeScript definitions
│           │   └── index.ts    # Main entry point
│           ├── package.json
│           └── tsconfig.json
├── examples/              # Example code
├── e2e/                   # End-to-end tests
└── python/                # Python version
```

## Important Notes

1. **Version Format**: Use `0.6.6-patch.X` where X is an incrementing number
2. **Backward Compatibility**: Ensure changes don't break existing functionality
3. **Testing**: Test thoroughly across multiple scenarios before publishing
4. **Documentation**: Update version numbers in README and related docs

## Troubleshooting

### Build Failures

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm run build:x402-dev
```

### Publishing Failures

Check:
- npm login status: `npm whoami`
- Network connectivity
- Version number uniqueness

### Dependency Issues

```bash
# Force reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Related Scripts

- `scripts/publish-x402.sh` - Publish x402 to npm
- `pnpm run build:x402-dev` - Build x402 locally
- `.github/workflows/build-x402.yml` - CI build and publish workflow

## Support

For x402 development issues:

1. Check the x402 official repository: https://github.com/coinbase/x402
2. Review project issues and discussions
3. Reference existing patch modification history
