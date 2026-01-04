# Multi-Network Deployment Guide

## 📋 Overview

This guide explains how to deploy x402-exec contracts to different networks, with a focus on X-Layer Testnet deployment.

## 🌐 Supported Networks

| Network | CAIP-2 Identifier | Chain ID | RPC Default | Block Explorer |
|---------|------------------|----------|-------------|----------------|
| Base Sepolia | `eip155:84532` | 84532 | https://sepolia.base.org | https://sepolia.basescan.org |
| Base Mainnet | `eip155:8453` | 8453 | https://mainnet.base.org | https://basescan.org |
| X-Layer Testnet | `eip155:1952` | 1952 | https://testrpc.xlayer.tech | https://www.oklink.com/xlayer-test |
| X-Layer Mainnet | `eip155:196` | 196 | https://rpc.xlayer.tech | https://www.oklink.com/xlayer |

**Note:** CAIP-2 identifiers use the format `eip155:<chainId>` and are the recommended format for network identification in x402 v2.

## 🚀 Quick Start: Deploy to X-Layer Testnet

### 1. Prerequisites

```bash
# Install Foundry (if not already installed)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Verify installation
forge --version
cast --version
```

### 2. Configure Environment Variables

Create or update `.env` in **project root** (for contract deployment only):

```bash
# Copy template
cp env.template .env

# Edit .env and fill in:
DEPLOYER_PRIVATE_KEY=0x...
X_LAYER_TESTNET_RPC_URL=https://testrpc.xlayer.tech/terigon

# Optional: For contract verification
OKLINK_API_KEY=your_oklink_api_key_here
```

**Note:** For other services configuration:
- **Facilitator**: See `examples/facilitator/env.example`
- **Showcase Server**: See `examples/showcase/server/env.example`

**Important:** Never commit `.env` to git! It's already in `.gitignore`.

### 3. Fund Your Deployer Wallet

```bash
# Get deployer address
cast wallet address --private-key $DEPLOYER_PRIVATE_KEY

# Get OKB testnet tokens from faucet
# Visit: https://www.okx.com/xlayer/faucet
```

### 4. Deploy Everything (Recommended)

Deploy both SettlementRouter and all showcase scenarios:

```bash
cd contracts
./deploy-contract.sh eip155:1952 --all
```

**Note:** `eip155:1952` is the CAIP-2 identifier for X-Layer Testnet (chain ID 1952).

This will:
1. ✅ Deploy `SettlementRouter` (built-in TransferHook available)
2. ✅ Deploy `NFTMintHook` + `RandomNFT`
3. ✅ Deploy `RewardHook` + `RewardToken`

**Note:** RevenueSplitHook has been deprecated. Use TransferHook (built-in) for revenue splitting instead.

### 5. Save Deployed Addresses

Copy the output addresses to:

**Project root `.env`** (for future deployments):
```bash
X_LAYER_TESTNET_SETTLEMENT_ROUTER_ADDRESS=0x...
```

**Showcase server `.env`** (`examples/showcase/server/.env`):
```bash
# Copy from env.example first: cp env.example .env
# Environment variables use CAIP-2 format for network identification
X_LAYER_TESTNET_SETTLEMENT_ROUTER_ADDRESS=0x...
X_LAYER_TESTNET_REVENUE_SPLIT_HOOK_ADDRESS=0x...
X_LAYER_TESTNET_NFT_MINT_HOOK_ADDRESS=0x...
X_LAYER_TESTNET_RANDOM_NFT_ADDRESS=0x...
X_LAYER_TESTNET_REWARD_HOOK_ADDRESS=0x...
X_LAYER_TESTNET_REWARD_TOKEN_ADDRESS=0x...
```

See `examples/showcase/server/ENVIRONMENT_VARIABLES.md` for details.

### 6. Verify Deployment (Optional)

If you have `OKLINK_API_KEY` set and used `--verify` flag:

```bash
# Contracts will be automatically verified on OKLink
# Visit: https://www.oklink.com/xlayer-test
```

## 📚 Advanced Usage

### Deploy Only SettlementRouter

```bash
./deploy-contract.sh eip155:1952 --settlement
```

After deployment, save the address:
```bash
# Add to .env
X_LAYER_TESTNET_SETTLEMENT_ROUTER_ADDRESS=0x...
```

### Deploy Built-in Hooks

Built-in Hooks are protocol-level Hooks deployed once per network for universal use.

Requires `[NETWORK]_SETTLEMENT_ROUTER_ADDRESS` to be set first:

```bash
# Deploy all built-in hooks to X-Layer Testnet (CAIP-2: eip155:1952)
./deploy-builtin-hooks.sh eip155:1952 --all

# Deploy specific hooks
./deploy-builtin-hooks.sh eip155:84532 --transfer  # TransferHook only (Base Sepolia)

# Deploy with verification
./deploy-builtin-hooks.sh eip155:1952 --all --verify
```

**Current Built-in Hooks:**
- **TransferHook**: Simple transfers with facilitator fee support (replaces direct ERC-3009 transfers)

**Note**: Built-in Hook addresses are typically used by Resource Servers and client applications, not for contract deployment configuration.

### Deploy Only Showcase Scenarios

Requires `SETTLEMENT_ROUTER_ADDRESS` to be set first:

```bash
# Make sure X_LAYER_TESTNET_SETTLEMENT_ROUTER_ADDRESS is set in .env
./deploy-contract.sh eip155:1952 --showcase
```

### Deploy with Verification

```bash
# Requires OKLINK_API_KEY in .env
./deploy-contract.sh eip155:1952 --all --verify
```

### Non-Interactive Deployment

Skip confirmation prompts:

```bash
./deploy-contract.sh eip155:1952 --all --yes
```

## 🔧 Legacy Deployment Scripts

### Old Scripts (Still Work)

```bash
# Deploy SettlementRouter only
./deploy.sh

# Deploy showcase scenarios only
./deploy-showcase.sh --all
```

**Limitations:**
- Only work with Base Sepolia (hardcoded RPC_URL)
- Require manual RPC URL configuration for other networks

### Migration Guide

**Before (Base Sepolia - legacy):**
```bash
export RPC_URL=https://sepolia.base.org
./deploy.sh
./deploy-showcase.sh --all
```

**After (Multi-Network with CAIP-2):**
```bash
# Just specify the network using CAIP-2 format!
./deploy-contract.sh eip155:84532 --all  # Base Sepolia
```

## 🌐 Deploy to Other Networks

### Base Mainnet

```bash
# Configure .env
BASE_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=your_api_key

# Deploy (using CAIP-2 format: eip155:8453)
./deploy-contract.sh eip155:8453 --all --verify
```

### X-Layer Mainnet

```bash
# Configure .env
X_LAYER_RPC_URL=https://rpc.xlayer.tech
OKLINK_API_KEY=your_api_key

# Deploy (using CAIP-2 format: eip155:196)
./deploy-contract.sh eip155:196 --all --verify
```

## 🛠️ Troubleshooting

### Chain ID Mismatch

**Error:**
```
Chain ID mismatch!
  Expected: 1952
  Actual:   84532
```

**Solution:** Check your RPC URL in `.env` matches the target network.

### Insufficient Funds

**Error:**
```
Error: insufficient funds for gas * price + value
```

**Solution:** Fund your deployer wallet with native tokens (OKB for X-Layer, ETH for Base).

### RPC URL Not Set

**Error:**
```
X_LAYER_TESTNET_RPC_URL is not set
```

**Solution:** Add to `.env`:
```bash
X_LAYER_TESTNET_RPC_URL=https://testrpc.xlayer.tech/terigon
```

### Settlement Router Not Found

**Error (when deploying showcase):**
```
Cannot deploy showcase: SETTLEMENT_ROUTER_ADDRESS not set
```

**Solution:** Either:
1. Deploy SettlementRouter first: `./deploy-contract.sh eip155:1952 --settlement`
2. Or use `--all` to deploy everything at once

## 📝 Deployment Checklist

- [ ] Foundry installed and updated (`foundryup`)
- [ ] `.env` configured with required variables
- [ ] Deployer wallet funded with native tokens
- [ ] RPC URL accessible and correct
- [ ] API key set (if using `--verify`)
- [ ] Git branch is clean (follow `.github/WORKFLOW.md`)
- [ ] Ready to save deployed addresses

## 🔐 Security Best Practices

### Private Key Management

1. **Never commit private keys to git**
   - `.env` is in `.gitignore`
   - Double-check before committing

2. **Use separate wallets for different environments**
   ```bash
   # Testnet wallet
   DEPLOYER_PRIVATE_KEY=0x...  # For testnet deployments
   
   # Mainnet wallet (keep extra secure!)
   MAINNET_DEPLOYER_PRIVATE_KEY=0x...  # For production
   ```

3. **Consider using hardware wallets for mainnet**
   ```bash
   # Deploy with Ledger (advanced)
   forge script ... --ledger --sender 0x...
   ```

### Verification

Always verify contracts on mainnet deployments:
```bash
./deploy-contract.sh xlayer --all --verify
```

## 📊 Gas Costs (Estimates)

### Core Contracts

| Contract | Estimated Gas (X-Layer) | Estimated Cost (OKB) |
|----------|-------------------------|----------------------|
| SettlementRouter | ~1.5M gas | ~0.001 OKB |

### Built-in Hooks

| Contract | Estimated Gas (X-Layer) | Estimated Cost (OKB) |
|----------|-------------------------|----------------------|
| TransferHook | ~600K gas | ~0.0004 OKB |

### Example Hooks (Showcase)

| Contract | Estimated Gas (X-Layer) | Estimated Cost (OKB) |
|----------|-------------------------|----------------------|
| NFTMintHook | ~1.2M gas | ~0.0008 OKB |
| RandomNFT | ~2M gas | ~0.001 OKB |
| RewardHook | ~800K gas | ~0.0005 OKB |
| RewardToken | ~1.5M gas | ~0.001 OKB |

### Total Costs

| Deployment Type | Total Gas | Estimated Cost (OKB) |
|----------------|-----------|---------------------|
| Core Only | ~1.5M | ~0.001 OKB |
| Core + Built-in Hooks | ~2.1M | ~0.0014 OKB |
| Core + All Showcase | ~7.8M | ~0.005 OKB |
| **Everything** | **~8.4M** | **~0.0054 OKB** |

*Costs vary based on network congestion and gas price*

## 🔄 Redeployment

### When to Redeploy

- Contract logic changes
- Bug fixes
- Network migration
- Testing new features

### How to Redeploy

```bash
# Redeploy everything (using CAIP-2 format)
./deploy-contract.sh eip155:1952 --all

```

**Remember:** Update all `.env` files with new addresses!

## 📞 Support

- **Issues:** https://github.com/nuwa-protocol/x402_settle/issues
- **Docs:** See `docs/` directory
- **X-Layer Docs:** https://docs.okx.com/xlayer/

## 🎓 Additional Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [X-Layer Documentation](https://docs.okx.com/xlayer/)
- [Base Documentation](https://docs.base.org/)
- [Hook Development Guide](../docs/hook_guide.md)
- [Security Guidelines](../docs/security.md)

---

**Last Updated:** 2025-11-04

