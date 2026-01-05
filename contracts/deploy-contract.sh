#!/bin/bash
# Multi-network deployment script for SettlementRouter and Showcase contracts
# Supports: Base Sepolia, Base Mainnet, X-Layer Testnet, X-Layer Mainnet, SKALE Base Sepolia, BSC
# Network configuration is loaded from networks.json (shared with TypeScript)

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

# ============================================
# Network Configuration (from networks.json)
# ============================================

NETWORKS_FILE="networks.json"

# Ensure networks.json exists
if [ ! -f "$NETWORKS_FILE" ]; then
    print_error "networks.json not found!"
    echo ""
    echo "Please generate it first:"
    echo "  pnpm --filter '@x402x/extensions' generate-networks-json"
    exit 1
fi

# Get network config by CAIP-2 ID or v1 alias
get_network_config() {
    local network=$1
    local field=$2

    # Try to find by caip2 or v1Alias
    jq -r --arg network "$network" --arg field "$field" \
        '.networks[] | select(.caip2 == $network or .v1Alias == $network) | .[$field]' \
        "$NETWORKS_FILE" 2>/dev/null
}

# Check if network exists
network_exists() {
    local network=$1
    local count=$(jq -r --arg network "$network" \
        '.networks[] | select(.caip2 == $network or .v1Alias == $network) | .caip2' \
        "$NETWORKS_FILE" 2>/dev/null | wc -l | tr -d ' ')
    [ "$count" -gt 0 ]
}

# Get CAIP-2 ID from v1 alias or CAIP-2
get_caip2_id() {
    local network=$1
    get_network_config "$network" "caip2"
}

# Normalize network to CAIP-2 format
normalize_network() {
    local network=$1
    if [[ "$network" =~ ^eip155:[0-9]+$ ]]; then
        echo "$network"
    else
        get_caip2_id "$network"
    fi
}

# List all supported networks
list_networks() {
    jq -r '.networks[] | "\(.caip2) (\(.v1Alias)): \(.name)"' "$NETWORKS_FILE"
}

# Print usage
usage() {
    echo "Usage: $0 [NETWORK] [OPTIONS]"
    echo ""
    echo "Networks (CAIP-2 format preferred, v1 aliases also supported):"
    list_networks | sed 's/^/  /'
    echo ""
    echo "Options:"
    echo "  --settlement      Deploy only SettlementRouter"
    echo "  --showcase        Deploy all showcase scenarios (requires SETTLEMENT_ROUTER_ADDRESS)"
    echo "  --referral        Deploy only Referral Split scenario"
    echo "  --nft             Deploy only NFT Minting scenario"
    echo "  --reward          Deploy only Reward Points scenario"
    echo "  --hooks           Deploy all built-in Hooks (requires SETTLEMENT_ROUTER_ADDRESS)"
    echo "  --transfer        Deploy only TransferHook (requires SETTLEMENT_ROUTER_ADDRESS)"
    echo "  --all             Deploy SettlementRouter and all showcase (default)"
    echo "  --with-hooks      When used with --all, also deploy built-in Hooks"
    echo "  --verify          Verify contracts on block explorer"
    echo "  --yes             Skip confirmation prompts"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 eip155:1952                    # Deploy everything on X-Layer Testnet (CAIP-2)"
    echo "  $0 xlayer-testnet                # Same as above (v1 alias)"
    echo "  $0 eip155:1952 --settlement      # Deploy only SettlementRouter"
    echo "  $0 eip155:1952 --showcase        # Deploy all showcase scenarios"
    echo "  $0 eip155:1952 --hooks           # Deploy all built-in Hooks"
    echo "  $0 eip155:1952 --transfer        # Deploy only TransferHook"
    echo "  $0 eip155:1952 --nft             # Deploy only NFT scenario"
    echo "  $0 eip155:84532 --all --with-hooks  # Deploy everything including hooks"
    echo "  $0 eip155:84532 --all --verify      # Deploy and verify on Base Sepolia"
    echo ""
    echo "Environment Variables Required:"
    echo "  DEPLOYER_PRIVATE_KEY                 Deployer wallet private key"
    echo ""
    echo "Optional (defaults are provided):"
    echo "  [NETWORK]_RPC_URL                    Custom RPC URL for the network"
    echo "  [NETWORK]_SETTLEMENT_ROUTER_ADDRESS  (Only for showcase) Deployed router address"
    echo ""
    echo "Optional for verification:"
    echo "  BASESCAN_API_KEY                     For Base networks"
    echo "  OKLINK_API_KEY                       For X-Layer networks"
    exit 0
}

# Parse arguments
NETWORK=""
DEPLOY_MODE="all"  # all | settlement | showcase | referral | nft | reward | hooks | transfer
VERIFY=false
AUTO_YES=false
WITH_HOOKS=false  # Flag for --with-hooks option

while [[ $# -gt 0 ]]; do
    case $1 in
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
        --hooks)
            DEPLOY_MODE="hooks"
            shift
            ;;
        --transfer)
            DEPLOY_MODE="transfer"
            shift
            ;;
        --all)
            DEPLOY_MODE="all"
            shift
            ;;
        --with-hooks)
            WITH_HOOKS=true
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
        --*)
            print_error "Unknown option: $1"
            usage
            ;;
        *)
            # Anything else is treated as network identifier (CAIP-2 or v1 alias)
            NETWORK=$1
            shift
            ;;
    esac
done

# Validate network is specified
if [ -z "$NETWORK" ]; then
    print_error "Network not specified"
    echo ""
    usage
fi

# Validate network is supported
if ! network_exists "$NETWORK"; then
    print_error "Unknown or unsupported network: $NETWORK"
    echo ""
    echo "Supported networks:"
    list_networks | sed 's/^/  /'
    echo ""
    exit 1
fi

# Normalize to CAIP-2 format
CAIP2_ID=$(normalize_network "$NETWORK")
if [ -z "$CAIP2_ID" ]; then
    print_error "Failed to get CAIP-2 ID for network: $NETWORK"
    exit 1
fi

# Header
echo "========================================="
echo "  x402-exec Multi-Network Deployment"
echo "========================================="
echo ""

# Load network configuration from networks.json
ENV_PREFIX=$(get_network_config "$CAIP2_ID" "envPrefix")
NETWORK_NAME=$(get_network_config "$CAIP2_ID" "name")
CHAIN_ID=$(get_network_config "$CAIP2_ID" "chainId")
DEFAULT_RPC_URL=$(get_network_config "$CAIP2_ID" "rpcUrl")
EXPLORER_URL=$(get_network_config "$CAIP2_ID" "explorerUrl")
GAS_MODEL=$(get_network_config "$CAIP2_ID" "gasModel")
NETWORK_TYPE=$(get_network_config "$CAIP2_ID" "type")

# Try to load .env from project root
if [ -f "../.env" ]; then
    set -a
    source ../.env
    set +a
    print_success ".env file loaded"
else
    print_warning ".env file not found in project root, using shell environment variables"
fi

# Get RPC URL from environment or use default from networks.json
RPC_URL_VAR="${ENV_PREFIX}_RPC_URL"
RPC_URL="${!RPC_URL_VAR}"

# Fallback to default RPC URL from networks.json if not set in environment
if [ -z "$RPC_URL" ]; then
    RPC_URL="$DEFAULT_RPC_URL"
    print_info "Using default RPC URL for $NETWORK_NAME"
fi

# Verify required environment variables
if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    print_error "DEPLOYER_PRIVATE_KEY is not set"
    echo ""
    echo "Generate a wallet with: cast wallet new"
    exit 1
fi

if [ -z "$RPC_URL" ]; then
    print_error "Failed to get RPC URL for $NETWORK_NAME"
    echo ""
    echo "This should not happen. Please report this issue."
    exit 1
fi

# Get settlement router address for showcase deployment
SETTLEMENT_ROUTER_VAR="${ENV_PREFIX}_SETTLEMENT_ROUTER_ADDRESS"
SETTLEMENT_ROUTER="${!SETTLEMENT_ROUTER_VAR}"

# Check if we need settlement router for showcase scenarios or hooks
if [ "$DEPLOY_MODE" = "showcase" ] || [ "$DEPLOY_MODE" = "referral" ] || [ "$DEPLOY_MODE" = "nft" ] || [ "$DEPLOY_MODE" = "reward" ] || [ "$DEPLOY_MODE" = "hooks" ] || [ "$DEPLOY_MODE" = "transfer" ] || [ "$DEPLOY_MODE" = "all" ]; then
    if [ "$DEPLOY_MODE" != "all" ] && [ "$DEPLOY_MODE" != "settlement" ] && [ -z "$SETTLEMENT_ROUTER" ]; then
        print_error "${SETTLEMENT_ROUTER_VAR} is not set"
        echo ""
        echo "For showcase or hooks deployment, you must first deploy SettlementRouter or set its address in .env"
        exit 1
    fi
fi

# Display deployment information
print_info "Network: $NETWORK_NAME (Chain ID: $CHAIN_ID)"
print_info "RPC URL: $RPC_URL"
print_info "Deployer: $(cast wallet address --private-key $DEPLOYER_PRIVATE_KEY 2>/dev/null || echo 'N/A')"

# Show settlement router for showcase scenarios and hooks
if [ "$DEPLOY_MODE" = "showcase" ] || [ "$DEPLOY_MODE" = "referral" ] || [ "$DEPLOY_MODE" = "nft" ] || [ "$DEPLOY_MODE" = "reward" ] || [ "$DEPLOY_MODE" = "hooks" ] || [ "$DEPLOY_MODE" = "transfer" ] || [ "$DEPLOY_MODE" = "all" ]; then
    if [ ! -z "$SETTLEMENT_ROUTER" ]; then
        print_info "Settlement Router: $SETTLEMENT_ROUTER"
    fi
fi

echo ""
print_info "Deployment Mode: $DEPLOY_MODE"
if [ "$WITH_HOOKS" = true ]; then
    print_info "With Built-in Hooks: YES"
fi
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

# Prepare verification
# Note: For dedicated contract verification after deployment, use verify-contracts.sh
VERIFY_FLAG=""
if [ "$VERIFY" = true ]; then
    print_info "Contract verification enabled"
    print_warning "Note: Forge's built-in verification may timeout for complex contracts"
    print_warning "If verification fails, run: ./verify-contracts.sh $NETWORK"

    # Build verification flags based on CAIP-2 ID
    case $CAIP2_ID in
        eip155:84532|eip155:8453)
            # Base networks
            if [ -n "$BASESCAN_API_KEY" ]; then
                VERIFY_FLAG="--verify --chain $CHAIN_ID --etherscan-api-key $BASESCAN_API_KEY"
            else
                print_error "BASESCAN_API_KEY not set, skipping verification"
                VERIFY_FLAG=""
            fi
            ;;
        eip155:1952|eip155:196)
            # X-Layer networks
            OKLINK_KEY="${OKLINK_API_KEY:-not-required}"
            VERIFY_FLAG="--verify --chain $CHAIN_ID --verifier-url https://www.oklink.com/api/v5/explorer/contract/verify-source-code-plugin/XLAYER --etherscan-api-key $OKLINK_KEY"
            ;;
        eip155:97|eip155:56)
            # BSC networks
            if [ -n "$BSCSCAN_API_KEY" ]; then
                VERIFY_FLAG="--verify --chain $CHAIN_ID --etherscan-api-key $BSCSCAN_API_KEY"
            else
                print_error "BSCSCAN_API_KEY not set, skipping verification"
                VERIFY_FLAG=""
            fi
            ;;
        eip155:324705682)
            # SKALE - doesn't support automated verification via forge
            print_warning "SKALE Base Sepolia doesn't support automated verification"
            print_warning "You'll need to verify manually after deployment"
            VERIFY_FLAG=""
            ;;
        *)
            print_warning "No verification configuration for $CAIP2_ID"
            VERIFY_FLAG=""
            ;;
    esac
fi

# Export environment variables for Forge scripts
export SETTLEMENT_ROUTER_ADDRESS="$SETTLEMENT_ROUTER"

# Determine additional flags based on gas model
LEGACY_FLAG=""
if [ "$GAS_MODEL" = "legacy" ]; then
    LEGACY_FLAG="--legacy"
    print_info "Using legacy gas pricing for $NETWORK_NAME"
fi

# Deploy SettlementRouter
if [ "$DEPLOY_MODE" = "settlement" ] || [ "$DEPLOY_MODE" = "all" ]; then
    echo "========================================="
    echo "  Deploying SettlementRouter..."
    echo "========================================="
    echo ""
    
    forge script script/DeploySettlement.s.sol:DeploySettlement \
        --rpc-url $RPC_URL \
        --broadcast \
        $LEGACY_FLAG \
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
        $LEGACY_FLAG \
        $VERIFY_FLAG \
        -vv
    
    print_success "$SCENARIO_NAME deployed!"
    echo ""
    print_info "Addresses are displayed above with ${ENV_PREFIX}_ prefix"
    echo ""
fi

# Deploy Built-in Hooks
if [ "$DEPLOY_MODE" = "hooks" ] || [ "$DEPLOY_MODE" = "transfer" ] || [ "$WITH_HOOKS" = true ]; then
    if [ -z "$SETTLEMENT_ROUTER_ADDRESS" ]; then
        print_error "Cannot deploy hooks: SETTLEMENT_ROUTER_ADDRESS not set"
        exit 1
    fi
    
    # Verify SettlementRouter is deployed
    if ! cast code $SETTLEMENT_ROUTER_ADDRESS --rpc-url $RPC_URL > /dev/null 2>&1; then
        print_error "SettlementRouter not deployed at $SETTLEMENT_ROUTER_ADDRESS"
        exit 1
    fi
    
    # Deploy TransferHook (currently the only built-in hook)
    if [ "$DEPLOY_MODE" = "hooks" ] || [ "$DEPLOY_MODE" = "transfer" ] || [ "$WITH_HOOKS" = true ]; then
        echo "========================================="
        echo "  Deploying TransferHook..."
        echo "========================================="
        echo ""
        
        forge script script/DeployTransferHook.s.sol:DeployTransferHook \
            --sig "run(address)" "$SETTLEMENT_ROUTER_ADDRESS" \
            --rpc-url $RPC_URL \
            --broadcast \
            $LEGACY_FLAG \
            $VERIFY_FLAG \
            -vvv
        
        print_success "TransferHook deployed!"
        echo ""
    fi
    
    # Future built-in Hooks can be added here
    # Example:
    # if [ "$DEPLOY_MODE" = "hooks" ] || [ "$DEPLOY_BATCH" = true ]; then
    #     echo "Deploying BatchTransferHook..."
    #     forge script script/DeployBatchTransferHook.s.sol:DeployBatchTransferHook ...
    # fi
fi

# Final summary
echo "========================================="
echo "  ✅ Deployment Complete!"
echo "========================================="
echo ""
print_success "All contracts deployed to $NETWORK_NAME"
echo ""

# Offer verification if not done during deployment
if [ "$VERIFY" != true ] && [ "$DEPLOY_MODE" = "settlement" ] || [ "$DEPLOY_MODE" = "all" ]; then
    print_info "Contract verification was not performed during deployment"
    print_info "To verify deployed contracts, run:"
    echo ""
    echo "  cd contracts && ./verify-contracts.sh $NETWORK"
    echo ""
fi

print_warning "Next Steps:"
echo "1. Copy deployed addresses from above"
echo "2. Update .env files:"
echo "   - Project root: ../.env"
echo "   - Server: ../examples/showcase/server/.env"

# Show hooks-specific next steps
if [ "$DEPLOY_MODE" = "hooks" ] || [ "$DEPLOY_MODE" = "transfer" ] || [ "$WITH_HOOKS" = true ]; then
    echo "3. Documentation:"
    echo "   - Built-in Hooks Guide: ./docs/builtin_hooks.md"
    echo "   - Hook Development Guide: ./docs/hook_guide.md"
else
    echo "3. Test the deployment:"
    echo "   cd ../examples/showcase && npm run dev"
fi
echo ""

# Display block explorer link
echo "View contracts: $EXPLORER_URL"
echo ""

