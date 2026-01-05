#!/bin/bash
# Verify USDC EIP-712 domain configuration
# Usage: ./verify-usdc-eip712.sh <RPC_URL> <USDC_ADDRESS>

set -e

RPC_URL=$1
USDC_ADDRESS=$2

if [ -z "$RPC_URL" ] || [ -z "$USDC_ADDRESS" ]; then
    echo "Usage: $0 <RPC_URL> <USDC_ADDRESS>"
    echo ""
    echo "Example:"
    echo "  $0 https://skale-base.skalenodes.com/v1/base 0x85889c8c714505E0c94b30fcfcF64fE3Ac8FCb20"
    exit 1
fi

echo "========================================="
echo "  USDC EIP-712 Domain Verification"
echo "========================================="
echo ""
echo "RPC URL: $RPC_URL"
echo "USDC Address: $USDC_ADDRESS"
echo ""

# Check if contract exists
echo "Checking if contract exists..."
CODE=$(cast code $USDC_ADDRESS --rpc-url $RPC_URL 2>/dev/null)
if [ -z "$CODE" ] || [ "$CODE" = "0x" ]; then
    echo "❌ No contract deployed at $USDC_ADDRESS"
    exit 1
fi
echo "✓ Contract found"
echo ""

# Try to call EIP-712 domain
echo "Fetching EIP-712 domain configuration..."
echo ""

# Method signature for eip712Domain() for newer USDC
# Returns (bytes1 fields, string name, string version, uint256 chainId, address verifyingContract, bytes32 salt, uint256[] extensions)
EIP712_DOMAIN_SELECTOR="0x84b0196e"

# Check if contract has eip712Domain method
echo "Checking for eip712Domain() method..."
HAS_EIP712=$(cast call $USDC_ADDRESS "$EIP712_DOMAIN_SELECTOR()" --rpc-url $RPC_URL 2>/dev/null || echo "")

if [ -n "$HAS_EIP712" ] && [ "$HAS_EIP712" != "0x" ]; then
    echo "✓ Contract has eip712Domain() method (EIP-5267)"
    echo ""

    # Decode the response
    echo "Raw EIP-712 domain data:"
    echo "$HAS_EIP712"
    echo ""

    # For USDC, we can also try to get name and version separately
    echo "Fetching individual parameters..."
    echo ""

    # Get name
    NAME=$(cast call $USDC_ADDRESS "name()(string)" --rpc-url $RPC_URL 2>/dev/null || echo "")
    if [ -n "$NAME" ]; then
        echo "Token Name: $NAME"
    fi

    # Get version
    VERSION=$(cast call $USDC_ADDRESS "version()(string)" --rpc-url $RPC_URL 2>/dev/null || echo "")
    if [ -n "$VERSION" ]; then
        echo "Token Version: $VERSION"
    fi

else
    echo "⚠ Contract does not have eip712Domain() method"
    echo ""
    echo "Fetching name and version separately..."
    echo ""

    # Get name
    NAME=$(cast call $USDC_ADDRESS "name()(string)" --rpc-url $RPC_URL 2>/dev/null || echo "")
    if [ -n "$NAME" ]; then
        echo "Token Name: $NAME"
    fi

    # Get version
    VERSION=$(cast call $USDC_ADDRESS "version()(string)" --rpc-url $RPC_URL 2>/dev/null || echo "")
    if [ -n "$VERSION" ]; then
        echo "Token Version: $VERSION"
    fi
fi

echo ""
echo "========================================="
echo "  Recommended TypeScript Config"
echo "========================================="
echo ""
echo "eip712: {"
if [ -n "$NAME" ]; then
    echo "  name: \"$NAME\","
else
    echo "  name: \"TODO: Verify with contract\","
fi
if [ -n "$VERSION" ]; then
    echo "  version: \"$VERSION\","
else
    echo "  version: \"TODO: Verify with contract\","
fi
echo "}"
