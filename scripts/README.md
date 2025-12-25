# Publishing Scripts Documentation

This directory contains scripts for publishing x402x SDK packages and testing infrastructure.

## Publishing Scripts

### Batch Publishing Script (`publish-packages.sh`)

A script to publish all TypeScript packages to npm at once.

### Features

- 🔄 **Dependency-ordered publishing**: Automatically sorts packages by dependency relationships
- 📦 **Smart version management**: Supports version increments or specific versions
- ✅ **Test validation**: Runs all package tests before publishing
- 🔍 **Dry Run mode**: Preview publishing content without actually publishing
- 🛡️ **Error handling**: Provides rollback guidance when publishing fails
- 🎯 **CI/CD support**: Supports non-interactive publishing

### Publishing Order

The script publishes packages according to their dependencies:

1. `@x402x/core` - Core utility library
2. `@x402x/fetch` - Fetch wrapper (depends on core)
3. `@x402x/express` - Express integration (depends on core)
4. `@x402x/hono` - Hono integration (depends on core)
5. `@x402x/client` - Client SDK (depends on core)
6. `@x402x/react` - React hooks (depends on core, fetch)

### Usage

```bash
# Basic usage
./scripts/publish-packages.sh [version_type] [tag]

# Examples
./scripts/publish-packages.sh patch latest     # Patch version release
./scripts/publish-packages.sh minor latest     # Minor version release
./scripts/publish-packages.sh major latest     # Major version release
./scripts/publish-packages.sh 1.2.3 latest     # Specific version release
./scripts/publish-packages.sh patch beta       # Publish to beta tag
```

### Advanced Options

```bash
# Skip tests (not recommended for production releases)
./scripts/publish-packages.sh patch latest --skip-tests

# Dry run mode (preview only, no actual publishing)
./scripts/publish-packages.sh patch latest --dry-run

# Combined options
./scripts/publish-packages.sh minor beta --skip-tests --dry-run
```

### Version Management

The script supports the following version increment strategies:

- `patch` - Patch version (default): 1.0.0 → 1.0.1
- `minor` - Minor version: 1.0.0 → 1.1.0
- `major` - Major version: 1.0.0 → 2.0.0

Or specify a complete version number directly: `1.2.3`

### Publishing Workflow

1. **Environment Validation**
   - Check project root directory
   - Verify npm login status
   - Run all package tests

2. **Version Update**
   - Calculate new version based on specified strategy
   - Update package.json for all packages

3. **Build Validation**
   - Check or rebuild all packages

4. **Sequential Publishing**
   - Publish each package in dependency order
   - Stop and provide rollback guidance on publishing failure

### CI/CD Usage

In CI environments, the script will:

- Automatically skip confirmation prompts
- Use `NPM_TOKEN` for authentication (if provided)
- Exit immediately on errors

```yaml
# GitHub Actions example
- name: Publish to npm
  run: ./scripts/publish-packages.sh patch latest
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Error Handling and Rollback

If an error occurs during publishing:

1. The script will stop immediately
2. Display the list of successfully published packages
3. Provide rollback commands for immediate revocation

```bash
# Rollback example
npm unpublish @x402x/core@1.0.1 --force
npm unpublish @x402x/fetch@1.0.1 --force
# ... execute for each published package
```

⚠️ **Important**: Unpublish should only be done immediately after publishing. Once other developers have downloaded the packages, unpublish may break their builds.

### Troubleshooting

#### Issue: npm Authentication Failed

```bash
# Solution 1: Interactive login
npm login

# Solution 2: Set environment variable (CI)
export NPM_TOKEN=your_token_here
```

#### Issue: Test Failures

```bash
# View specific test errors
pnpm --filter='./typescript/packages/**' run test

# Force skip tests (for emergency fixes only)
./scripts/publish-packages.sh patch latest --skip-tests
```

#### Issue: Build Failures

```bash
# Manually build all packages
pnpm run build:sdk

# Or build individually
cd typescript/packages/core && npm run build
```

### Other Scripts

- `publish-x402.sh` - Publish x402 core protocol package (located in deps/x402)
- `test-local.sh` - Run local integration tests
- `test-docker-facilitator.sh` - Test Facilitator Docker image build and startup

## Testing Scripts

### Docker Facilitator Test (`test-docker-facilitator.sh`)

Tests the Facilitator Docker image to ensure it builds and starts correctly.

#### Features

- 🏗️ **Build Verification**: Builds Docker image and checks for errors
- 📦 **Package Validation**: Verifies all required packages are included
- 🚀 **Startup Testing**: Starts container and monitors for runtime errors
- 🔍 **Import Detection**: Detects missing module errors early
- 🏥 **Health Check**: Validates service responds correctly

#### Usage

```bash
# From project root
./scripts/test-docker-facilitator.sh
```

#### What It Tests

1. **Static File Check**: Verifies v2 packages exist in the image
   - `@x402x/extensions`
   - `@x402x/facilitator-sdk`

2. **Runtime Import Check**: Starts container and monitors for:
   - ❌ Module import errors
   - ✅ Successful startup message

3. **Health Check**: Tests HTTP endpoints
   - `/health` endpoint response

#### Test Environment

Uses `facilitator/env.docker-test` for safe testing:
- Test private key (no real funds)
- Minimal configuration
- Disabled optional features

See `facilitator/DOCKER_TESTING.md` for detailed documentation.

### Important Notes

1. **Backup is crucial**: Ensure code is backed up before publishing
2. **Test thoroughly**: Run complete tests before publishing
3. **Version consistency**: All packages use the same version number
4. **Dependency order**: Do not change the package publishing order
5. **Emergency rollback**: Unpublish can only be done immediately after publishing
