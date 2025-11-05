#!/bin/bash
# Multi-network deployment script for built-in Hooks
# Built-in Hooks are protocol-level Hooks deployed once per network for universal use.
# Supports: Base Sepolia, Base Mainnet, X-Layer Testnet, X-Layer Mainnet

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Function to show usage
show_usage() {
    echo "Usage: ./deploy-builtin-hooks.sh [NETWORK] [OPTIONS]"
    echo ""
    echo "Networks:"
    echo "  base-sepolia      Base Sepolia Testnet (Chain ID: 84532)"
    echo "  base              Base Mainnet (Chain ID: 8453)"
    echo "  xlayer-testnet    X-Layer Testnet (Chain ID: 1952)"
    echo "  xlayer            X-Layer Mainnet (Chain ID: 196)"
    echo ""
    echo "Options:"
    echo "  --all              Deploy all built-in Hooks"
    echo "  --transfer         Deploy TransferHook only"
    echo "  --verify           Verify contracts on block explorer"
    echo "  --yes              Skip confirmation prompts"
    echo "  -h, --help         Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./deploy-builtin-hooks.sh xlayer-testnet --all"
    echo "  ./deploy-builtin-hooks.sh base-sepolia --transfer"
    echo "  ./deploy-builtin-hooks.sh xlayer-testnet --all --verify"
    echo ""
    echo "Built-in Hooks:"
    echo "  - TransferHook: Simple transfers with facilitator fee support"
    echo ""
    echo "Environment Variables Required:"
    echo "  DEPLOYER_PRIVATE_KEY                 Deployer wallet private key"
    echo "  [NETWORK]_RPC_URL                    RPC URL for the network"
    echo "  [NETWORK]_SETTLEMENT_ROUTER_ADDRESS  Deployed SettlementRouter address"
    echo ""
    echo "Optional for verification:"
    echo "  BASESCAN_API_KEY                     For Base networks"
    echo "  OKLINK_API_KEY                       For X-Layer networks"
    echo ""
    exit 0
}

# Parse arguments
NETWORK=""
DEPLOY_ALL=false
DEPLOY_TRANSFER=false
VERIFY=false
AUTO_YES=false

if [ $# -eq 0 ]; then
    show_usage
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        base-sepolia|base|xlayer-testnet|xlayer)
            NETWORK=$1
            shift
            ;;
        --all)
            DEPLOY_ALL=true
            shift
            ;;
        --transfer)
            DEPLOY_TRANSFER=true
            shift
            ;;
        --verify)
            VERIFY=true
            shift
            ;;
        --yes)
            AUTO_YES=true
            shift
            ;;
        -h|--help)
            show_usage
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            ;;
    esac
done

# Validate network is specified
if [ -z "$NETWORK" ]; then
    print_error "Network not specified"
    echo ""
    show_usage
fi

# If --all is set, enable all deployments
if [ "$DEPLOY_ALL" = true ]; then
    DEPLOY_TRANSFER=true
fi

# Validate at least one hook is selected
if [ "$DEPLOY_TRANSFER" = false ]; then
    print_error "No hooks selected for deployment"
    echo ""
    show_usage
fi

# Header
echo "========================================="
echo "  Built-in Hooks - Multi-Network Deployment"
echo "========================================="
echo ""

# Map network to environment variable prefixes
get_env_prefix() {
    case $1 in
        base-sepolia)
            echo "BASE_SEPOLIA"
            ;;
        base)
            echo "BASE"
            ;;
        xlayer-testnet)
            echo "X_LAYER_TESTNET"
            ;;
        xlayer)
            echo "X_LAYER"
            ;;
    esac
}

# Get network display name and chain ID
get_network_info() {
    case $1 in
        base-sepolia)
            echo "Base Sepolia Testnet|84532"
            ;;
        base)
            echo "Base Mainnet|8453"
            ;;
        xlayer-testnet)
            echo "X-Layer Testnet|1952"
            ;;
        xlayer)
            echo "X-Layer Mainnet|196"
            ;;
    esac
}

ENV_PREFIX=$(get_env_prefix $NETWORK)
NETWORK_INFO=$(get_network_info $NETWORK)
NETWORK_NAME=$(echo $NETWORK_INFO | cut -d'|' -f1)
CHAIN_ID=$(echo $NETWORK_INFO | cut -d'|' -f2)

# Try to load .env from project root
if [ -f "../.env" ]; then
    set -a
    source ../.env
    set +a
    print_success ".env file loaded"
else
    print_warning ".env file not found in project root, using shell environment variables"
fi

# Get RPC URL from environment
RPC_URL_VAR="${ENV_PREFIX}_RPC_URL"
RPC_URL="${!RPC_URL_VAR}"

# Get SettlementRouter address from environment
SETTLEMENT_ROUTER_VAR="${ENV_PREFIX}_SETTLEMENT_ROUTER_ADDRESS"
SETTLEMENT_ROUTER_ADDRESS="${!SETTLEMENT_ROUTER_VAR}"

# Verify required variables
if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    print_error "DEPLOYER_PRIVATE_KEY is not set"
    echo ""
    echo "Generate a wallet with: cast wallet new"
    exit 1
fi

if [ -z "$RPC_URL" ]; then
    print_error "${RPC_URL_VAR} is not set"
    echo ""
    echo "Set it in .env or as an environment variable:"
    echo "  export ${RPC_URL_VAR}=https://..."
    exit 1
fi

if [ -z "$SETTLEMENT_ROUTER_ADDRESS" ]; then
    print_error "${SETTLEMENT_ROUTER_VAR} is not set"
    echo ""
    echo "Please deploy SettlementRouter first with:"
    echo "  ./deploy-network.sh $NETWORK --settlement"
    exit 1
fi

# Display deployment information
print_info "Network: $NETWORK_NAME (Chain ID: $CHAIN_ID)"
print_info "RPC URL: $RPC_URL"
print_info "Deployer: $(cast wallet address --private-key $DEPLOYER_PRIVATE_KEY 2>/dev/null || echo 'N/A')"
print_info "SettlementRouter: $SETTLEMENT_ROUTER_ADDRESS"
echo ""

# Verify chain ID matches
ACTUAL_CHAIN_ID=$(cast chain-id --rpc-url $RPC_URL 2>/dev/null || echo "")
if [ ! -z "$ACTUAL_CHAIN_ID" ] && [ "$ACTUAL_CHAIN_ID" != "$CHAIN_ID" ]; then
    print_error "Chain ID mismatch!"
    echo "  Expected: $CHAIN_ID"
    echo "  Actual:   $ACTUAL_CHAIN_ID"
    exit 1
fi

# Verify SettlementRouter is deployed
if ! cast code $SETTLEMENT_ROUTER_ADDRESS --rpc-url $RPC_URL > /dev/null 2>&1; then
    print_error "SettlementRouter not deployed at $SETTLEMENT_ROUTER_ADDRESS"
    exit 1
fi

# Show deployment plan
print_info "Deployment Plan:"
if [ "$DEPLOY_TRANSFER" = true ]; then
    echo "  ✓ TransferHook"
fi

if [ "$VERIFY" = true ]; then
    print_info "Contract Verification: ENABLED"
else
    print_warning "Contract Verification: DISABLED (use --verify to enable)"
fi
echo ""

# Confirmation prompt
if [ "$AUTO_YES" = false ]; then
    read -p "Deploy built-in hooks to $NETWORK_NAME? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Deployment cancelled"
        exit 0
    fi
    echo ""
fi

# Build contracts
echo "========================================="
echo "  Building contracts..."
echo "========================================="
echo ""
forge build
print_success "Contracts built successfully"
echo ""

# Prepare verification flag
VERIFY_FLAG=""
if [ "$VERIFY" = true ]; then
    # Check for appropriate API key based on network
    case $NETWORK in
        base-sepolia|base)
            if [ -z "$BASESCAN_API_KEY" ]; then
                print_warning "BASESCAN_API_KEY not set, skipping verification"
            else
                VERIFY_FLAG="--verify"
                export ETHERSCAN_API_KEY="$BASESCAN_API_KEY"
            fi
            ;;
        xlayer-testnet|xlayer)
            if [ -z "$OKLINK_API_KEY" ]; then
                print_warning "OKLINK_API_KEY not set, skipping verification"
            else
                VERIFY_FLAG="--verify"
                export ETHERSCAN_API_KEY="$OKLINK_API_KEY"
            fi
            ;;
    esac
fi

# Deploy TransferHook
if [ "$DEPLOY_TRANSFER" = true ]; then
    echo "========================================="
    echo "  Deploying TransferHook..."
    echo "========================================="
    echo ""
    
    forge script script/DeployTransferHook.s.sol:DeployTransferHook \
        --sig "run(address)" "$SETTLEMENT_ROUTER_ADDRESS" \
        --rpc-url $RPC_URL \
        --broadcast \
        $VERIFY_FLAG \
        -vvv
    
    print_success "TransferHook deployed!"
    echo ""
fi

# Future built-in Hooks can be added here
# Example:
# if [ "$DEPLOY_BATCH" = true ]; then
#     echo "Deploying BatchTransferHook..."
#     forge script script/DeployBatchTransferHook.s.sol:DeployBatchTransferHook ...
# fi

# Final summary
echo "========================================="
echo "  ✅ Deployment Complete!"
echo "========================================="
echo ""
print_success "Built-in Hooks deployed to $NETWORK_NAME"
echo ""
echo "Deployed Hooks:"
if [ "$DEPLOY_TRANSFER" = true ]; then
    echo "  ✓ TransferHook"
fi
echo ""
print_warning "Next Steps:"
echo "1. Copy the deployed TransferHook address from above"
echo "2. Update README.md with the deployment address"
echo "3. Configure your Resource Server to use TransferHook:"
echo "   - For simple transfers with facilitator fee support"
echo "   - Set hook address in PaymentRequirements extra field"
echo ""
print_info "Documentation:"
echo "- Built-in Hooks Guide: ./docs/builtin_hooks.md"
echo "- Hook Development Guide: ./docs/hook_guide.md"
echo ""

# Display block explorer link
case $NETWORK in
    base-sepolia)
        echo "View contracts: https://sepolia.basescan.org/"
        ;;
    base)
        echo "View contracts: https://basescan.org/"
        ;;
    xlayer-testnet)
        echo "View contracts: https://www.oklink.com/xlayer-test"
        ;;
    xlayer)
        echo "View contracts: https://www.oklink.com/xlayer"
        ;;
esac
echo ""

