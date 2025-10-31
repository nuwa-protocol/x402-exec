#!/bin/bash
# Deployment script for Settlement Showcase scenarios
# 
# Prerequisites:
# 1. SettlementRouter must be deployed first (run: ./deploy.sh)
# 2. SETTLEMENT_HUB_ADDRESS must be set in .env
#
# This script deploys contracts for showcase scenarios:
# - referral: RevenueSplitHook (examples/revenue-split/)
# - nft: NFTMintHook + RandomNFT (examples/nft-mint/)
# - reward: RewardHook + RewardToken (examples/reward-points/)

set -e

# Print usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --all          Deploy all scenarios (default)"
    echo "  --referral     Deploy referral split (revenue-split/)"
    echo "  --nft          Deploy NFT mint (nft-mint/)"
    echo "  --reward       Deploy reward points (reward-points/)"
    echo "  -h, --help     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --all                # Deploy everything"
    echo "  $0 --referral           # Only deploy referral split"
    echo "  $0 --nft                # Only deploy NFT mint"
    echo "  $0 --referral --reward  # Deploy specific scenarios"
    exit 0
}

# Parse arguments
DEPLOY_ALL=false
DEPLOY_REFERRAL=false
DEPLOY_NFT=false
DEPLOY_REWARD=false

if [ $# -eq 0 ]; then
    DEPLOY_ALL=true
fi

while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            DEPLOY_ALL=true
            shift
            ;;
        --referral)
            DEPLOY_REFERRAL=true
            shift
            ;;
        --nft)
            DEPLOY_NFT=true
            shift
            ;;
        --reward)
            DEPLOY_REWARD=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# If --all is set, deploy everything
if [ "$DEPLOY_ALL" = true ]; then
    DEPLOY_REFERRAL=true
    DEPLOY_NFT=true
    DEPLOY_REWARD=true
fi

echo "========================================="
echo "Settlement Showcase - Scenario Deployment"
echo "========================================="
echo ""
echo "Deploying:"
[ "$DEPLOY_REFERRAL" = true ] && echo "  ✓ referral: Referral Split (revenue-split/)"
[ "$DEPLOY_NFT" = true ] && echo "  ✓ nft: NFT Mint (nft-mint/)"
[ "$DEPLOY_REWARD" = true ] && echo "  ✓ reward: Reward Points (reward-points/)"
echo ""

# Check if .env file exists
if [ ! -f "../.env" ]; then
    echo "Error: .env file not found in project root"
    echo "Please create .env and configure the required variables"
    exit 1
fi

# Load environment variables
set -a
source ../.env
set +a

# Verify required variables
if [ -z "$SETTLEMENT_HUB_ADDRESS" ]; then
    echo "Error: SETTLEMENT_HUB_ADDRESS is not set"
    echo "Please deploy SettlementRouter first:"
    echo "  ./deploy.sh"
    exit 1
fi

if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    echo "Error: DEPLOYER_PRIVATE_KEY is not set"
    exit 1
fi

if [ -z "$RPC_URL" ]; then
    echo "Error: RPC_URL is not set"
    exit 1
fi

echo "Network Chain ID: $(cast chain-id --rpc-url $RPC_URL 2>/dev/null || echo 'N/A')"
echo "RPC URL: $RPC_URL"
echo "Settlement Hub: $SETTLEMENT_HUB_ADDRESS"
echo ""

read -p "Deploy to this network? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

echo ""
echo "========================================="
echo "Building contracts..."
echo "========================================="
echo ""

forge build

echo ""
echo "========================================="
echo "Deploying scenarios..."
echo "========================================="
echo ""

# Check if we should verify contracts
VERIFY_FLAG=""
if [ ! -z "$ETHERSCAN_API_KEY" ]; then
    VERIFY_FLAG="--verify"
    echo "Contract verification enabled"
else
    echo "Skipping contract verification (ETHERSCAN_API_KEY not set)"
fi

# Determine which function to call
if [ "$DEPLOY_ALL" = true ]; then
    DEPLOY_FUNC="deployAll()"
    echo "Deploying all scenarios..."
elif [ "$DEPLOY_REFERRAL" = true ] && [ "$DEPLOY_NFT" = false ] && [ "$DEPLOY_REWARD" = false ]; then
    DEPLOY_FUNC="deployReferral()"
    echo "Deploying referral split..."
elif [ "$DEPLOY_REFERRAL" = false ] && [ "$DEPLOY_NFT" = true ] && [ "$DEPLOY_REWARD" = false ]; then
    DEPLOY_FUNC="deployNFT()"
    echo "Deploying NFT mint..."
elif [ "$DEPLOY_REFERRAL" = false ] && [ "$DEPLOY_NFT" = false ] && [ "$DEPLOY_REWARD" = true ]; then
    DEPLOY_FUNC="deployReward()"
    echo "Deploying reward points..."
else
    # Multiple scenarios selected, deploy one by one
    echo "Deploying multiple scenarios..."
    
    if [ "$DEPLOY_REFERRAL" = true ]; then
        echo ""
        echo "--- Deploying referral ---"
        forge script script/DeployShowcase.s.sol:DeployShowcase \
            --sig "deployReferral()" \
            --rpc-url $RPC_URL \
            --broadcast \
            $VERIFY_FLAG \
            -vv
    fi
    
    if [ "$DEPLOY_NFT" = true ]; then
        echo ""
        echo "--- Deploying nft ---"
        forge script script/DeployShowcase.s.sol:DeployShowcase \
            --sig "deployNFT()" \
            --rpc-url $RPC_URL \
            --broadcast \
            $VERIFY_FLAG \
            -vv
    fi
    
    if [ "$DEPLOY_REWARD" = true ]; then
        echo ""
        echo "--- Deploying reward ---"
        forge script script/DeployShowcase.s.sol:DeployShowcase \
            --sig "deployReward()" \
            --rpc-url $RPC_URL \
            --broadcast \
            $VERIFY_FLAG \
            -vv
    fi
    
    echo ""
    echo "========================================="
    echo "✅ All requested scenarios deployed!"
    echo "========================================="
    exit 0
fi

# Deploy with single function call
forge script script/DeployShowcase.s.sol:DeployShowcase \
    --sig "$DEPLOY_FUNC" \
    --rpc-url $RPC_URL \
    --broadcast \
    $VERIFY_FLAG \
    -vv

echo ""
echo "========================================="
echo "✅ Deployment complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Copy the deployed addresses from above"
echo "2. Update examples/settlement-showcase/server/.env with the new addresses"
echo "3. Start the showcase services:"
echo "   cd ../examples/settlement-showcase && npm run dev"
echo ""
