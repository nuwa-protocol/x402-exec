# Adding Network Support to x402x

This guide explains how to add support for a new blockchain network to the x402x ecosystem (contracts, TypeScript SDK, facilitator, and showcase).

## Overview

Adding a new network requires updates across multiple components:

1. **Network Configuration** - TypeScript SDK network definitions
2. **Smart Contracts** - Deploy contracts to the new network
3. **Facilitator Configuration** - Update facilitator settings
4. **Showcase/Examples** - Update demo applications

## Prerequisites

- Network RPC URL
- Block explorer URL
- USDC (or other payment token) contract address
- Deployer private key with sufficient gas tokens
- (Optional) Block explorer API key for contract verification

## Step 1: Add Network Configuration

### 1.1 Update Network Aliases

Edit `typescript/packages/extensions/src/network-utils.ts`:

```typescript
export const NETWORK_ALIASES_V1_TO_V2: Record<string, Network> = {
  // ... existing networks
  "your-network": "eip155:<CHAIN_ID>",  // Add human-readable name to CAIP-2 mapping
};
```

### 1.2 Add Token Asset Configuration

Edit `typescript/packages/extensions/src/network-utils.ts`:

```typescript
const DEFAULT_ASSETS: Record<Network, AssetInfo> = {
  // ... existing networks
  "eip155:<CHAIN_ID>": {
    address: "0x<TOKEN_CONTRACT_ADDRESS>",
    decimals: 6,
    eip712: {
      name: "<Token Name>",  // e.g., "USD Coin"
      version: "2",
    },
  },
};
```

**Important**: Verify the token's EIP-712 domain name and version on-chain:

```bash
cast call <TOKEN_ADDRESS> "eip712Domain()" --rpc-url <RPC_URL>
```

Or use the verification script:

```bash
./contracts/verify-usdc-eip712.sh <RPC_URL> <TOKEN_ADDRESS>
```

### 1.3 Add Viem Chain Definition

Edit `typescript/packages/extensions/src/chains.ts`:

```typescript
export const CHAINS: Record<number, Chain> = {
  // ... existing chains
  <CHAIN_ID>: defineChain({
    id: <CHAIN_ID>,
    name: "<Network Name>",
    nativeCurrency: {
      name: "<Native Token Name>",
      symbol: "<SYMBOL>",
      decimals: 18
    },
    rpcUrls: {
      default: { http: ["<RPC_URL>"] },
    },
    blockExplorers: {
      default: {
        name: "<Explorer Name>",
        url: "<EXPLORER_URL>"
      },
    },
    testnet: <true|false>,
  }),
};
```

### 1.4 Add Complete Network Configuration

Edit `typescript/packages/extensions/src/networks.ts`:

```typescript
export const networks: Record<Network, NetworkConfig> = {
  // ... existing networks
  "eip155:<CHAIN_ID>": {
    chainId: <CHAIN_ID>,
    name: "<Network Name>",
    type: "testnet" | "mainnet",
    addressExplorerBaseUrl: "<EXPLORER_URL>/address/",
    txExplorerBaseUrl: "<EXPLORER_URL>/tx/",
    settlementRouter: "<SETTLEMENT_ROUTER_ADDRESS>",
    defaultAsset: getDefaultAssetConfig("eip155:<CHAIN_ID>"),
    hooks: {
      transfer: "<TRANSFER_HOOK_ADDRESS>",
    },
    demoHooks: {
      nftMint: "<NFT_MINT_HOOK_ADDRESS>",
      randomNFT: "<RANDOM_NFT_ADDRESS>",
      reward: "<REWARD_HOOK_ADDRESS>",
      rewardToken: "<REWARD_TOKEN_ADDRESS>",
    },
    metadata: {
      gasModel: "eip1559" | "legacy",
      nativeToken: "<NATIVE_TOKEN_SYMBOL>",
    },
  },
};
```

**Note**: Contract addresses can be filled in after deployment (Step 2).

### 1.5 Generate Networks JSON

Generate the shared network configuration for shell scripts:

```bash
pnpm generate:networks
```

This creates `contracts/networks.json` from TypeScript definitions.

## Step 2: Deploy Smart Contracts

### 2.1 Deploy All Contracts

Use the deployment script with CAIP-2 network identifier:

```bash
cd contracts
./deploy-contract.sh eip155:<CHAIN_ID> --all --verify
```

This will deploy:
- SettlementRouter
- TransferHook
- NFTMintHook
- RandomNFT
- RewardHook
- RewardToken

### 2.2 Record Deployed Addresses

After deployment, the script will display deployed addresses. Update `typescript/packages/extensions/src/networks.ts` with the actual addresses (if you left them placeholder in Step 1.4).

### 2.3 Verify Deployment

Verify contracts are deployed:

```bash
cast code <SETTLEMENT_ROUTER_ADDRESS> --rpc-url <RPC_URL>
```

Should return bytecode (not `0x`).

## Step 3: Update Facilitator Configuration

### 3.1 Add Native Token Price

Edit `facilitator/src/defaults.ts`:

```typescript
export const NATIVE_TOKEN_PRICE_DEFAULTS = {
  // ... existing prices
  <TOKEN_SYMBOL>: <PRICE_IN_USD>,
  GENERIC: 100,
} as const;
```

The price is used as fallback when CoinGecko doesn't have data for the network's native token.

### 3.2 Update Price Matching Logic

If the new network requires special handling, edit `facilitator/src/config.ts` in the `parseGasCostConfig()` function:

```typescript
if (networkAlias.includes("<network-keyword>")) {
  nativeTokenPrice[network] = DEFAULTS.nativeTokenPrice.<TOKEN_SYMBOL>;
}
```

**Note**: Place the check **before** more generic matches to ensure precedence.

### 3.3 Add CoinGecko Mapping (Optional)

If the network is listed on CoinGecko, edit `facilitator/src/token-price.ts`:

```typescript
const DEFAULT_NETWORK_COIN_IDS: Record<string, string> = {
  // ... existing mappings
  "eip155:<CHAIN_ID>": "<coingecko-coin-id>",
};
```

### 3.4 Rebuild Facilitator

```bash
pnpm --filter '@x402x/facilitator' run build
```

## Step 4: Update Environment Configuration

### 4.1 Update .env File

Add network configuration to `contracts/.env`:

```bash
# <Network Name> (Chain ID: <CHAIN_ID>)
<NETWORK_PREFIX>_RPC_URL=<RPC_URL>
<NETWORK_PREFIX>_SETTLEMENT_ROUTER_ADDRESS=<ROUTER_ADDRESS>
<NETWORK_PREFIX>_TRANSFER_HOOK_ADDRESS=<HOOK_ADDRESS>
<NETWORK_PREFIX>_NFT_MINT_HOOK_ADDRESS=<NFT_MINT_ADDRESS>
<NETWORK_PREFIX>_RANDOM_NFT_ADDRESS=<RANDOM_NFT_ADDRESS>
<NETWORK_PREFIX>_REWARD_HOOK_ADDRESS=<REWARD_HOOK_ADDRESS>
<NETWORK_PREFIX>_REWARD_TOKEN_ADDRESS=<REWARD_TOKEN_ADDRESS>
```

Replace placeholders with actual values.

### 4.2 Add Explorer API Keys (Optional)

If contract verification is needed:

```bash
# For Base networks
BASESCAN_API_KEY=<your-key>

# For X-Layer networks
OKLINK_API_KEY=<your-key>

# For BSC networks
BSCSCAN_API_KEY=<your-key>
```

## Step 5: Testing

### 5.1 Unit Tests

Run TypeScript SDK tests:

```bash
pnpm --filter '@x402x/extensions' test
```

Ensure all network alignment tests pass.

### 5.2 Integration Tests

Start the facilitator:

```bash
pnpm dev:facilitator
```

Verify it loads the new network:

```bash
curl http://localhost:3001/supported | jq .
```

Should include your new network.

### 5.3 Test Settlement Flow

Use the showcase client to test a settlement:

1. Start showcase server: `pnpm dev:server`
2. Start showcase client: `pnpm dev:client`
3. Select the new network
4. Complete a payment flow

### 5.4 Verify Contract Calls

Check transaction on block explorer:

```bash
cast <TX_HASH> --rpc-url <RPC_URL>
```

## Step 6: Deployment Scripts

The deployment script (`contracts/deploy-contract.sh`) automatically uses the generated `networks.json`. No manual updates needed.

To verify the script recognizes your network:

```bash
cd contracts
./deploy-contract.sh eip155:<CHAIN_ID> --help
```

## Network Configuration Checklist

Use this checklist to ensure all components are updated:

- [ ] Add network alias in `network-utils.ts`
- [ ] Add USDC asset config with verified EIP-712 domain
- [ ] Add viem chain definition in `chains.ts`
- [ ] Add complete network config in `networks.ts`
- [ ] Generate `networks.json` with `pnpm generate:networks`
- [ ] Deploy SettlementRouter and hooks
- [ ] Update `networks.ts` with deployed addresses
- [ ] Add native token price in `facilitator/src/defaults.ts`
- [ ] Update facilitator price matching logic (if needed)
- [ ] Add CoinGecko mapping (if available)
- [ ] Update `.env` with deployed addresses
- [ ] Run unit tests: `pnpm --filter '@x402x/extensions' test`
- [ ] Test facilitator loads the network
- [ ] Test showcase payment flow
- [ ] Verify transactions on block explorer

## Common Issues and Solutions

### Issue: Chain ID Mismatch

**Error**: `Chain ID mismatch! Expected: X, Actual: Y`

**Solution**: Verify the RPC URL returns the correct Chain ID:

```bash
cast chain-id --rpc-url <RPC_URL>
```

### Issue: Contract Not Found

**Error**: `cast code` returns `0x`

**Solution**:
1. Verify you're using the correct RPC URL
2. Check the deployment was successful
3. Verify the address is correct

### Issue: EIP-712 Signature Failures

**Error**: `Invalid signature` during token transfers

**Solution**:
1. Verify token's EIP-712 domain on-chain
2. Check the name and version match exactly
3. Use the verification script: `./verify-usdc-eip712.sh`

### Issue: Facilitator Fee Incorrect

**Error**: Fee calculation wrong for the network

**Solution**:
1. Check native token price in `defaults.ts`
2. Verify network alias matching logic in `config.ts`
3. Ensure CoinGecko mapping is correct (if applicable)

### Issue: Network Not Loading in Facilitator

**Error**: New network not appearing in facilitator logs

**Solution**:
1. Rebuild extensions package: `pnpm --filter '@x402x/extensions' run build`
2. Rebuild facilitator: `pnpm --filter '@x402x/facilitator' run build`
3. Restart facilitator

## Example: Adding SKALE Networks

For a complete example, refer to PR #197 which added SKALE on Base and SKALE Base Sepolia support:

- **Network Configuration**: `typescript/packages/extensions/src/networks.ts`
- **Chain Definitions**: `typescript/packages/extensions/src/chains.ts`
- **Deployment Script**: `contracts/deploy-contract.sh`
- **Facilitator Fixes**: `facilitator/src/config.ts`, `facilitator/src/defaults.ts`

## Related Documentation

- [Architecture Overview](../x402-exec.md) - System architecture and protocol
- [Development Guide](../development.md) - Local development setup
- [Contract API](../contracts/docs/api.md) - Smart contract interfaces
- [Facilitator Guide](../contracts/docs/facilitator_guide.md) - Running a facilitator

## Support

If you encounter issues while adding network support:

1. Check existing network configurations as references
2. Review test files for expected behavior
3. Search GitHub Issues for similar problems
4. Create a new issue with detailed error messages and logs
