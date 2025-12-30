#!/bin/bash
# Publish all x402x SDK packages to npm
# Usage: ./scripts/publish-packages.sh [version_type] [tag] [options]
# Examples:
#   ./scripts/publish-packages.sh patch latest                 # Increment patch version
#   ./scripts/publish-packages.sh minor latest                 # Increment minor version
#   ./scripts/publish-packages.sh major latest                 # Increment major version
#   ./scripts/publish-packages.sh 1.2.3 latest                 # Use specific version
#   ./scripts/publish-packages.sh patch beta                   # Publish as beta tag
#   ./scripts/publish-packages.sh patch latest --skip-tests    # Skip test runs
#   ./scripts/publish-packages.sh patch latest --dry-run       # Dry run mode

set -e

# Get the absolute path of the project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Get parameters
VERSION_TYPE=${1:-"patch"}
VERSION=""
TAG=${2:-"latest"}
SKIP_TESTS=${3:-"false"}

# Parse additional flags
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            echo "Publish all x402x SDK packages to npm"
            echo ""
            echo "Usage: $0 [version_type] [tag] [options]"
            echo ""
            echo "Arguments:"
            echo "  version_type    Version increment type: patch, minor, major, or specific version (default: patch)"
            echo "  tag             NPM tag to publish under (default: latest)"
            echo ""
            echo "Options:"
            echo "  --skip-tests    Skip running tests before publish"
            echo "  --dry-run       Show what would be published without actually publishing"
            echo "  -h, --help      Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 patch latest                    # Increment patch version"
            echo "  $0 minor latest                    # Increment minor version"
            echo "  $0 1.2.3 latest                    # Use specific version"
            echo "  $0 patch beta --dry-run            # Dry run with beta tag"
            echo "  $0 patch latest --skip-tests       # Skip tests"
            exit 0
            ;;
        --skip-tests)
            SKIP_TESTS="true"
            shift
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        -*|--*)
            print_error "Unknown option: $1"
            print_info "Usage: $0 [version_type] [tag] [--skip-tests] [--dry-run] [-h|--help]"
            exit 1
            ;;
        *)
            # Positional arguments
            if [ -z "$VERSION_TYPE_PARSED" ]; then
                VERSION_TYPE="$1"
                VERSION_TYPE_PARSED="true"
            elif [ -z "$TAG_PARSED" ]; then
                TAG="$1"
                TAG_PARSED="true"
            else
                print_error "Too many arguments"
                print_info "Usage: $0 [version_type] [tag] [--skip-tests] [--dry-run] [-h|--help]"
                exit 1
            fi
            shift
            ;;
    esac
done

# Version management
generate_version() {
    local type=$1
    local base_version=$(node -p "require('./typescript/packages/extensions/package.json').version")

    # Parse version components
    local major=$(echo $base_version | cut -d. -f1)
    local minor=$(echo $base_version | cut -d. -f2)
    local patch=$(echo $base_version | cut -d. -f3 | sed 's/[^0-9]*$//')

    case $type in
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "patch")
            patch=$((patch + 1))
            ;;
        *)
            # If it's a full version string like "1.2.3"
            if [[ $type =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                echo $type
                return 0
            else
                print_error "Invalid version type: $type"
                print_error "Use: major, minor, patch, or full version like 1.2.3"
                exit 1
            fi
            ;;
    esac

    echo "$major.$minor.$patch"
}

# Check if running in correct directory
if [ ! -f "package.json" ] || [ ! -f "pnpm-workspace.yaml" ]; then
    print_error "Must run this script from project root directory"
    exit 1
fi

# Check if typescript/packages directory exists
if [ ! -d "typescript/packages" ]; then
    print_error "typescript/packages directory not found"
    exit 1
fi

# Package list in dependency order (important!)
# Note: @x402x/core is v1 legacy package and should not be published
PACKAGES=("extensions" "facilitator-sdk" "client")

# Generate version if needed
if [[ $VERSION_TYPE =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    VERSION=$VERSION_TYPE
else
    VERSION=$(generate_version $VERSION_TYPE)
fi

if [ "$DRY_RUN" = "true" ]; then
    print_warning "🔍 DRY RUN MODE - No packages will be published"
fi

if [ "$SKIP_TESTS" = "true" ]; then
    print_warning "⚠️  TESTS SKIPPED - Make sure all packages are properly tested"
fi

print_info "🚀 Starting batch publish for x402x SDK packages"
print_info "Packages to publish: ${PACKAGES[*]}"
print_info "Version type: $VERSION_TYPE"
print_info "Target version: $VERSION"
print_info "Target tag: $TAG"
echo ""

# Check npm login status
print_step "Checking npm authentication..."
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

CURRENT_USER=$(npm whoami)
print_info "Authenticated as: $CURRENT_USER"
echo ""

# Run tests if not skipped
if [ "$SKIP_TESTS" != "true" ]; then
    print_step "Running tests for all packages..."
    if pnpm --filter='./typescript/packages/**' run test; then
        print_info "✅ All tests passed"
    else
        print_error "❌ Some tests failed"
        if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; then
            print_error "CI environment detected, continuing anyway..."
        else
            read -p "Continue with publish despite test failures? (y/N) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_error "Publication cancelled due to test failures"
                exit 1
            fi
        fi
    fi
    echo ""
fi

# Function to publish a single package
publish_package() {
    local package_name=$1
    local package_dir="typescript/packages/$package_name"

    # Ensure we're in the project root directory
    cd "$PROJECT_ROOT"

    if [ ! -d "$package_dir" ]; then
        print_error "Package directory not found: $package_dir (PWD: $(pwd))"
        return 1
    fi

    print_step "Publishing @x402x/$package_name..."

    cd "$package_dir"

    # Read current package info
    local current_version=$(node -p "require('./package.json').version")
    local package_name_full=$(node -p "require('./package.json').name")

    print_info "Package: $package_name_full@$current_version"

    # Update version
    print_info "Updating version to: $VERSION"
    npm version "$VERSION" --no-git-tag-version --allow-same-version

    # Build package if dist doesn't exist or is empty
    if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
        print_info "Building package..."
        npm run build
    else
        print_info "Using existing build"
    fi

    # Show files to be published
    print_info "Files to be published:"
    npm pack --dry-run | grep -E "^[^/]*\.(tgz|tar\.gz)$" || true

    # Publish to npm
    if [ "$DRY_RUN" = "true" ]; then
        print_info "🔍 DRY RUN: Would publish $package_name_full@$VERSION to npm"
        publish_exit_code=0
    else
        print_info "Publishing $package_name_full@$VERSION to npm..."
        if [ "$TAG" = "latest" ]; then
            pnpm publish --access public --no-git-checks
            publish_exit_code=$?
        else
            pnpm publish --access public --tag "$TAG" --no-git-checks
            publish_exit_code=$?
        fi
    fi

    if [ $publish_exit_code -eq 0 ]; then
        print_info "✅ $package_name_full published successfully!"
    else
        print_error "❌ Failed to publish $package_name_full"
        cd ../../../..
        return 1
    fi

    cd ../../../..
    echo ""
}

# Confirm publication
echo ""
print_warning "About to publish ${#PACKAGES[@]} packages to npm"
print_warning "All packages will be updated to version: $VERSION"
print_warning "Tag: $TAG"
echo ""

# In CI environment, skip confirmation
if [ -n "$CI" ] || [ -n "$GITHUB_ACTIONS" ]; then
    print_info "CI environment detected, proceeding with publication..."
else
    read -p "Confirm batch publish? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Publication cancelled"
        exit 0
    fi
fi

echo ""
print_info "Starting batch publication..."
echo "========================================"

# Track published packages for rollback if needed
published_packages=()

# Publish packages in dependency order
for package in "${PACKAGES[@]}"; do
    if publish_package "$package"; then
        published_packages+=("$package")
    else
        print_error "Failed to publish $package, stopping batch publish"
        print_warning "Published packages so far: ${published_packages[*]}"

        if [ "$DRY_RUN" != "true" ]; then
            print_warning "To rollback published packages, run these commands:"
            for pub_pkg in "${published_packages[@]}"; do
                echo "  npm unpublish @x402x/$pub_pkg@$VERSION --force"
            done
            echo ""
            print_warning "Note: Unpublishing should only be done immediately after publish"
            print_warning "Once packages are downloaded by others, unpublish may break their builds"
        fi

        exit 1
    fi
done

echo "========================================"
print_info "🎉 All packages published successfully!"
echo ""
print_info "Published packages:"
for package in "${PACKAGES[@]}"; do
    if [ -n "$VERSION" ]; then
        echo "  - @x402x/$package@$VERSION"
    else
        # Get actual version from package.json
        pkg_version=$(node -p "require('./typescript/packages/$package/package.json').version")
        echo "  - @x402x/$package@$pkg_version"
    fi
done

echo ""
print_info "View published packages:"
for package in "${PACKAGES[@]}"; do
    echo "  https://www.npmjs.com/package/@x402x/$package"
done

print_info "✅ Batch publish completed!"
