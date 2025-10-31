#!/bin/bash
# Deployment script for SettlementRouter core contract
# This ONLY deploys the core SettlementRouter contract.
# Hooks and scenarios should be deployed separately.

set -e

echo "========================================="
echo "SettlementRouter - Core Contract Deployment"
echo "========================================="
echo ""
echo "This script deploys ONLY the SettlementRouter contract."
echo "Scenario-specific hooks will be deployed with their scenarios."
echo ""

# Check if .env file exists
if [ ! -f "../.env" ]; then
    echo "Warning: .env file not found in project root"
    echo "Looking for environment variables in current shell..."
fi

# Try to load .env if it exists
if [ -f "../.env" ]; then
    set -a
    source ../.env
    set +a
fi

# Verify required variables
if [ -z "$DEPLOYER_PRIVATE_KEY" ]; then
    echo "Error: DEPLOYER_PRIVATE_KEY is not set"
    echo "Please set it in .env or as an environment variable"
    echo ""
    echo "Quick start: Generate a test wallet with:"
    echo "  cast wallet new"
    exit 1
fi

if [ -z "$RPC_URL" ]; then
    echo "Error: RPC_URL is not set"
    echo "Please set it in .env or as an environment variable"
    echo "Example: export RPC_URL=https://sepolia.base.org"
    exit 1
fi

echo "Network Chain ID: $(cast chain-id --rpc-url $RPC_URL)"
echo "RPC URL: $RPC_URL"
echo "Deployer: $(cast wallet address --private-key $DEPLOYER_PRIVATE_KEY)"
echo ""

read -p "Deploy SettlementRouter to this network? (y/n) " -n 1 -r
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
echo "Deploying SettlementRouter..."
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

forge script script/DeploySettlement.s.sol:DeploySettlement \
    --rpc-url $RPC_URL \
    --broadcast \
    $VERIFY_FLAG \
    -vvv

echo ""
echo "========================================="
echo "✅ SettlementRouter deployed!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Copy the SETTLEMENT_HUB_ADDRESS from above"
echo "2. Update your .env file"
echo "3. Deploy showcase scenarios:"
echo "   ./deploy-showcase.sh --all      # Deploy all scenarios"
echo "   # or deploy specific scenarios:"
echo "   ./deploy-showcase.sh --referral # Referral split"
echo "   ./deploy-showcase.sh --nft      # NFT mint"
echo "   ./deploy-showcase.sh --reward   # Reward points"
echo ""

