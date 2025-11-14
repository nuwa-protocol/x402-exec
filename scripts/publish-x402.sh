#!/bin/bash
# Publish @x402x/x402 to npm
# Usage: ./scripts/publish-x402.sh [version] [tag]
# Example: ./scripts/publish-x402.sh 0.6.6-patch.1 latest

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get parameters
VERSION=${1:-""}
TAG=${2:-"latest"}

# Print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in correct directory
if [ ! -f "package.json" ]; then
    print_error "Must run this script from project root directory"
    exit 1
fi

# Navigate to x402 package directory
X402_DIR="deps/x402/typescript/packages/x402"

if [ ! -d "$X402_DIR" ]; then
    print_error "Cannot find x402 package directory: $X402_DIR"
    exit 1
fi

cd "$X402_DIR"

print_info "Current directory: $(pwd)"

# Backup original package.json
cp package.json package.json.backup

# Temporarily change package name for publishing
print_info "Temporarily changing package name to @x402x/x402 for publishing..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.name = '@x402x/x402';
pkg.repository = {
  type: 'git',
  url: 'https://github.com/nuwa-protocol/x402-exec.git',
  directory: 'deps/x402/typescript/packages/x402'
};
pkg.homepage = 'https://github.com/nuwa-protocol/x402-exec';
pkg.description = 'x402 Payment Protocol (patched for x402-exec with paymentRequirements support)';
pkg.keywords = ['x402', 'payment', 'protocol', 'blockchain', 'x402-exec'];
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update package.json version if specified
if [ -n "$VERSION" ]; then
    print_info "Updating version to: $VERSION"
    npm version "$VERSION" --no-git-tag-version --allow-same-version
fi

# Read current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
PACKAGE_NAME=$(node -p "require('./package.json').name")

print_info "Preparing to publish: $PACKAGE_NAME@$CURRENT_VERSION"

# Check if logged in to npm
if ! npm whoami &> /dev/null; then
    # In CI environment, try to authenticate using NPM_TOKEN
    if [ -n "$NPM_TOKEN" ]; then
        print_info "Authenticating with NPM_TOKEN..."
        AUTH_LINE="//registry.npmjs.org/:_authToken=${NPM_TOKEN}"
        if ! grep -Fxq "$AUTH_LINE" ~/.npmrc 2>/dev/null; then
            echo "$AUTH_LINE" >> ~/.npmrc
        fi
        # Auth via .npmrc takes effect immediately
        if ! npm whoami &> /dev/null; then
            print_error "NPM_TOKEN authentication failed"
            exit 1
        fi
    else
        print_error "Not logged in to npm, please run: npm login"
        print_error "Or set NPM_TOKEN environment variable for CI"
        exit 1
    fi
fi

print_info "Current npm user: $(npm whoami)"

# Check if already built
if [ ! -d "dist" ]; then
    print_warning "dist directory not found, starting build..."
    npm run build
else
    print_info "dist directory exists"
    # In CI environment, skip interactive prompt and rebuild
    if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; then
        print_info "CI environment detected, rebuilding automatically..."
        rm -rf dist
        npm run build
    else
        read -p "Rebuild? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_info "Rebuilding..."
            rm -rf dist
            npm run build
        fi
    fi
fi

# Show files to be published
print_info "Files to be published:"
npm pack --dry-run

# Confirm publication
echo ""
print_warning "About to publish $PACKAGE_NAME@$CURRENT_VERSION (tag: $TAG)"

# In CI environment, skip confirmation
if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; then
    print_info "CI environment detected, proceeding with publication..."
else
    read -p "Confirm publish? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Publication cancelled"
        exit 0
    fi
fi

# Publish to npm
print_info "Publishing to npm..."
if [ "$TAG" = "latest" ]; then
    npm publish --access public
    PUBLISH_EXIT_CODE=$?
else
    npm publish --access public --tag "$TAG"
    PUBLISH_EXIT_CODE=$?
fi

# Check publication result
if [ $PUBLISH_EXIT_CODE -eq 0 ]; then
    print_info "✅ Published successfully!"
    print_info ""
    print_info "Third-party developers can use it like this:"
    print_info "  npm install x402@npm:$PACKAGE_NAME@^$CURRENT_VERSION"
    print_info ""
    print_info "Or in package.json:"
    print_info '  "dependencies": {'
    print_info "    \"x402\": \"npm:$PACKAGE_NAME@^$CURRENT_VERSION\""
    print_info '  }'
    print_info ""
    print_info "View the published package:"
    print_info "  https://www.npmjs.com/package/$PACKAGE_NAME"
    
    # Restore original package.json
    print_info ""
    print_info "Restoring original package.json..."
    mv package.json.backup package.json
else
    print_error "❌ Publication failed"
    
    # Restore original package.json on failure
    if [ -f package.json.backup ]; then
        print_info "Restoring original package.json..."
        mv package.json.backup package.json
    fi
    exit 1
fi

