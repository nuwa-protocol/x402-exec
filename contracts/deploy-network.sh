#!/bin/bash
# Multi-network deployment script for SettlementRouter and Showcase contracts
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

# Print usage
usage() {
    echo "Usage: $0 [NETWORK] [OPTIONS]"
    echo ""
    echo "Networks:"
    echo "  base-sepolia      Base Sepolia Testnet (Chain ID: 84532)"
    echo "  base              Base Mainnet (Chain ID: 8453)"
    echo "  xlayer-testnet    X-Layer Testnet (Chain ID: 1952)"
    echo "  xlayer            X-Layer Mainnet (Chain ID: 196)"
    echo ""
    echo "Options:"
    echo "  --settlement      Deploy only SettlementRouter"
    echo "  --showcase        Deploy all showcase scenarios (requires SETTLEMENT_ROUTER_ADDRESS)"
    echo "  --referral        Deploy only Referral Split scenario"
    echo "  --nft             Deploy only NFT Minting scenario"
    echo "  --reward          Deploy only Reward Points scenario"
    echo "  --all             Deploy both SettlementRouter and all showcase (default)"
    echo "  --verify          Verify contracts on block explorer"
    echo "  --yes             Skip confirmation prompts"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 xlayer-testnet                    # Deploy everything on X-Layer Testnet"
    echo "  $0 xlayer-testnet --settlement       # Deploy only SettlementRouter"
    echo "  $0 xlayer-testnet --showcase         # Deploy all showcase scenarios"
    echo "  $0 xlayer-testnet --nft              # Deploy only NFT scenario"
    echo "  $0 base-sepolia --all --verify       # Deploy and verify on Base Sepolia"
    echo ""
    echo "Environment Variables Required:"
    echo "  DEPLOYER_PRIVATE_KEY                 Deployer wallet private key"
    echo "  [NETWORK]_RPC_URL                    RPC URL for the network (e.g., X_LAYER_TESTNET_RPC_URL)"
    echo "  [NETWORK]_SETTLEMENT_ROUTER_ADDRESS  (Only for showcase) Deployed router address"
    echo ""
    echo "Optional for verification:"
    echo "  BASESCAN_API_KEY                     For Base networks"
    echo "  OKLINK_API_KEY                       For X-Layer networks"
    exit 0
}

# Parse arguments
NETWORK=""
DEPLOY_MODE="all"  # all | settlement | showcase | referral | nft | reward
VERIFY=false
AUTO_YES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        base-sepolia|base|xlayer-testnet|xlayer)
            NETWORK=$1
            shift
            ;;
        --settlement)
            DEPLOY_MODE="settlement"
            shift
            ;;
        --showcase)
            DEPLOY_MODE="showcase"
            shift
            ;;
        --referral)
            DEPLOY_MODE="referral"
            shift
            ;;
        --nft)
            DEPLOY_MODE="nft"
            shift
            ;;
        --reward)
            DEPLOY_MODE="reward"
            shift
            ;;
        --all)
            DEPLOY_MODE="all"
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
            usage
            ;;
        *)
            print_error "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate network is specified
if [ -z "$NETWORK" ]; then
    print_error "Network not specified"
    echo ""
    usage
fi

# Header
echo "========================================="
echo "  x402-exec Multi-Network Deployment"
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

# Fallback to generic RPC_URL if network-specific not set
if [ -z "$RPC_URL" ]; then
    RPC_URL="${RPC_URL}"
fi

# Verify required environment variables
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

# Get settlement router address for showcase deployment
SETTLEMENT_ROUTER_VAR="${ENV_PREFIX}_SETTLEMENT_ROUTER_ADDRESS"
SETTLEMENT_ROUTER="${!SETTLEMENT_ROUTER_VAR}"

# Check if we need settlement router for showcase scenarios
if [ "$DEPLOY_MODE" = "showcase" ] || [ "$DEPLOY_MODE" = "referral" ] || [ "$DEPLOY_MODE" = "nft" ] || [ "$DEPLOY_MODE" = "reward" ] || [ "$DEPLOY_MODE" = "all" ]; then
    if [ "$DEPLOY_MODE" != "all" ] && [ -z "$SETTLEMENT_ROUTER" ]; then
        print_error "${SETTLEMENT_ROUTER_VAR} is not set"
        echo ""
        echo "For showcase deployment, you must first deploy SettlementRouter or set its address in .env"
        exit 1
    fi
fi

# Display deployment information
print_info "Network: $NETWORK_NAME (Chain ID: $CHAIN_ID)"
print_info "RPC URL: $RPC_URL"
print_info "Deployer: $(cast wallet address --private-key $DEPLOYER_PRIVATE_KEY 2>/dev/null || echo 'N/A')"

# Show settlement router for any showcase scenario
if [ "$DEPLOY_MODE" = "showcase" ] || [ "$DEPLOY_MODE" = "referral" ] || [ "$DEPLOY_MODE" = "nft" ] || [ "$DEPLOY_MODE" = "reward" ] || [ "$DEPLOY_MODE" = "all" ]; then
    if [ ! -z "$SETTLEMENT_ROUTER" ]; then
        print_info "Settlement Router: $SETTLEMENT_ROUTER"
    fi
fi

echo ""
print_info "Deployment Mode: $DEPLOY_MODE"
if [ "$VERIFY" = true ]; then
    print_info "Contract Verification: ENABLED"
else
    print_warning "Contract Verification: DISABLED (use --verify to enable)"
fi
echo ""

# Verify chain ID matches
ACTUAL_CHAIN_ID=$(cast chain-id --rpc-url $RPC_URL 2>/dev/null || echo "")
if [ ! -z "$ACTUAL_CHAIN_ID" ] && [ "$ACTUAL_CHAIN_ID" != "$CHAIN_ID" ]; then
    print_error "Chain ID mismatch!"
    echo "  Expected: $CHAIN_ID"
    echo "  Actual:   $ACTUAL_CHAIN_ID"
    exit 1
fi

# Confirmation prompt
if [ "$AUTO_YES" = false ]; then
    read -p "Deploy to $NETWORK_NAME? (y/n) " -n 1 -r
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
    VERIFY_FLAG="--verify"
fi

# Export environment variables for Forge scripts
export SETTLEMENT_ROUTER_ADDRESS="$SETTLEMENT_ROUTER"

# Deploy SettlementRouter
if [ "$DEPLOY_MODE" = "settlement" ] || [ "$DEPLOY_MODE" = "all" ]; then
    echo "========================================="
    echo "  Deploying SettlementRouter..."
    echo "========================================="
    echo ""
    
    forge script script/DeploySettlement.s.sol:DeploySettlement \
        --rpc-url $RPC_URL \
        --broadcast \
        $VERIFY_FLAG \
        -vvv
    
    print_success "SettlementRouter deployed!"
    echo ""
    
    # Extract deployed address from broadcast file
    BROADCAST_FILE="broadcast/DeploySettlement.s.sol/$CHAIN_ID/run-latest.json"
    if [ -f "$BROADCAST_FILE" ]; then
        DEPLOYED_ROUTER=$(jq -r '.transactions[0].contractAddress' "$BROADCAST_FILE" 2>/dev/null || echo "")
        if [ ! -z "$DEPLOYED_ROUTER" ] && [ "$DEPLOYED_ROUTER" != "null" ]; then
            export SETTLEMENT_ROUTER_ADDRESS="$DEPLOYED_ROUTER"
            print_success "Deployed SettlementRouter: $DEPLOYED_ROUTER"
            echo ""
            print_warning "Save this to your .env file:"
            echo "${SETTLEMENT_ROUTER_VAR}=$DEPLOYED_ROUTER"
            echo ""
        fi
    fi
fi

# Deploy Showcase scenarios
if [ "$DEPLOY_MODE" = "showcase" ] || [ "$DEPLOY_MODE" = "referral" ] || [ "$DEPLOY_MODE" = "nft" ] || [ "$DEPLOY_MODE" = "reward" ] || [ "$DEPLOY_MODE" = "all" ]; then
    if [ -z "$SETTLEMENT_ROUTER_ADDRESS" ]; then
        print_error "Cannot deploy showcase: SETTLEMENT_ROUTER_ADDRESS not set"
        exit 1
    fi
    
    # Determine which function to call
    DEPLOY_FUNCTION="deployAll"
    SCENARIO_NAME="All Showcase Scenarios"
    
    case $DEPLOY_MODE in
        showcase|all)
            DEPLOY_FUNCTION="deployAll"
            SCENARIO_NAME="All Showcase Scenarios"
            ;;
        referral)
            DEPLOY_FUNCTION="deployReferral"
            SCENARIO_NAME="Referral Split Scenario"
            ;;
        nft)
            DEPLOY_FUNCTION="deployNFT"
            SCENARIO_NAME="NFT Minting Scenario"
            ;;
        reward)
            DEPLOY_FUNCTION="deployReward"
            SCENARIO_NAME="Reward Points Scenario"
            ;;
    esac
    
    echo "========================================="
    echo "  Deploying $SCENARIO_NAME..."
    echo "========================================="
    echo ""
    
    forge script script/DeployShowcase.s.sol:DeployShowcase \
        --sig "${DEPLOY_FUNCTION}(string)" "$ENV_PREFIX" \
        --rpc-url $RPC_URL \
        --broadcast \
        $VERIFY_FLAG \
        -vv
    
    print_success "$SCENARIO_NAME deployed!"
    echo ""
    print_info "Addresses are displayed above with ${ENV_PREFIX}_ prefix"
    echo ""
fi

# Final summary
echo "========================================="
echo "  ✅ Deployment Complete!"
echo "========================================="
echo ""
print_success "All contracts deployed to $NETWORK_NAME"
echo ""
print_warning "Next Steps:"
echo "1. Copy deployed addresses from above"
echo "2. Update .env files:"
echo "   - Project root: ../.env"
echo "   - Server: ../examples/showcase/server/.env"
echo "3. Test the deployment:"
echo "   cd ../examples/showcase && npm run dev"
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

