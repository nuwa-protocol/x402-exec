# x402-exec Showcase

> Full-stack demo application showcasing x402-exec's atomic settlement capabilities

A complete example application demonstrating how to use x402-exec to implement **pay-and-execute** workflows. Features three real-world scenarios: referral revenue split, NFT minting, and loyalty rewards.

## 🎯 Overview

x402-exec Showcase is built on the [x402 protocol](https://x402.org) and [x402-exec](../../README.md), demonstrating key capabilities through multiple payment scenarios:

- **Atomic Operations**: Payment and on-chain execution in a single transaction
- **Automated Fulfillment**: Smart contracts handle business logic without manual intervention
- **Infinite Extensibility**: Hook pattern supports arbitrary scenarios

### Five Scenarios

0. **💳 Direct Payment**
   - Original x402 protocol without router/hook
   - Debugging baseline for isolating issues

1. **🎣 Transfer with Hook**
   - Pay $0.11 → Basic x402x settlement with $0.01 facilitator fee
   - Entry-level scenario demonstrating Hook architecture

2. **💰 Referral Revenue Split**
   - Pay $0.1 → Automatic 3-way split (70% merchant + 20% referrer + 10% platform)
   - Demonstrates multi-party distribution and dynamic parameters

3. **🎨 Random NFT Mint**
   - Pay $0.1 → Automatic NFT minting + merchant payment
   - Demonstrates on-chain minting with supply cap (1000 NFTs)

4. **🎁 Loyalty Points Reward**
   - Pay $0.1 → Automatic 1000 points distribution + merchant payment
   - Demonstrates ERC20 token distribution and reward mechanics

## 🏗️ Architecture

```
User (Wallet)
    ↓ EIP-3009 Signature
Facilitator
    ↓ settleAndExecute()
SettlementRouter
    ↓
Hook (RevenueSplitHook/NFTMintHook/RewardHook)
    ↓
Recipients (Merchant/Referrer/Platform) + NFT/Tokens
```

### Tech Stack

- **Contracts**: Solidity 0.8.20 + Foundry
- **Backend**: Hono + TypeScript + x402-hono
- **Frontend**: React + TypeScript + Vite + x402-fetch
- **Network**: Base Sepolia Testnet

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Foundry ([installation guide](https://book.getfoundry.sh/getting-started/installation))
- MetaMask or other Web3 wallet
- Base Sepolia testnet tokens (ETH and USDC)

### 1. Install Dependencies

```bash
# Navigate to showcase directory
cd examples/showcase

# Install all dependencies
npm run install:all
```

### 2. Configure Environment Variables

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with:
# - SETTLEMENT_ROUTER_ADDRESS: Deployed SettlementRouter address
# - REVENUE_SPLIT_HOOK_ADDRESS: Deployed RevenueSplitHook address
# - NFT_MINT_HOOK_ADDRESS: Deployed NFTMintHook address
# - MERCHANT_ADDRESS: Merchant address (receives payments)
# - PLATFORM_ADDRESS: Platform address (receives fees)
# - DEPLOYER_PRIVATE_KEY: Deployer private key (for contract deployment)
```

### 3. Deploy Showcase Contracts

```bash
cd contracts
./deploy.sh
```

After deployment, copy the output contract addresses and update `server/.env`:
- `RANDOM_NFT_ADDRESS`
- `REWARD_TOKEN_ADDRESS`
- `REWARD_HOOK_ADDRESS`

### 4. Start Services

```bash
# From project root
npm run dev
```

This starts both:
- Server: http://localhost:3001
- Frontend: http://localhost:5173

### 5. Try It Out

1. Open browser at http://localhost:5173
2. Connect MetaMask wallet (ensure Base Sepolia network)
3. Select a scenario to test
4. Sign and pay $0.1 USDC
5. Check your wallet for results (NFT or tokens)

## 📖 Scenario Details

### Scenario 0: Direct Payment (Debugging Baseline)

**Purpose**: Original x402 protocol implementation for debugging and comparison

**Workflow**:
```
1. User clicks payment button
2. Frontend calls /api/direct-payment/payment
3. Server generates standard PaymentRequirements (no router/hook)
4. User signs authorization for $0.1 USDC
5. Facilitator calls USDC.transferWithAuthorization()
6. USDC transferred directly to merchant
```

**Key Characteristics**:
- No SettlementRouter
- No Hook
- No commitment hash
- Simplest possible flow for debugging

---

### Scenario 1: Transfer with Hook

**Core Contract**: `TransferHook.sol` (built-in Hook)

**Workflow**:
```
1. User clicks payment button  
2. Frontend calls /api/transfer-with-hook/payment
3. Server generates PaymentRequirements (with TransferHook)
4. User signs authorization for $0.11 USDC ($0.1 + $0.01 fee)
5. Facilitator calls SettlementRouter.settleAndExecute()
6. Router deducts $0.01 facilitator fee
7. Router calls TransferHook.execute() with remaining $0.1
8. TransferHook transfers $0.1 → Merchant
9. Facilitator claims accumulated fees later
```

**hookData**: Empty (`0x`) - TransferHook doesn't need any data

**Key Features**:
- Entry-level x402x scenario
- Demonstrates facilitator fee mechanism
- Minimal gas overhead (~8k gas vs direct transfer)
- Production-ready pattern for simple merchant payments

---

### Scenario 2: Referral Revenue Split

**Core Contract**: `RevenueSplitHook.sol` (deployed in main project)

**Workflow**:
```
1. User enters referrer address (optional)
2. Frontend calls /api/scenario-1/payment
3. Server generates PaymentRequirements (with hookData)
4. User signs authorization for $0.1 USDC
5. SettlementRouter calls RevenueSplitHook
6. Hook automatically distributes:
   - 70% → Merchant
   - 20% → Referrer (or platform if none)
   - 10% → Platform
```

**hookData Encoding**:
```typescript
const splits = [
  { recipient: merchantAddress, bips: 7000 },
  { recipient: referrerAddress, bips: 2000 },
  { recipient: platformAddress, bips: 1000 }
];
const hookData = ethers.AbiCoder.encode(
  ['tuple(address recipient, uint16 bips)[]'],
  [splits]
);
```

### Scenario 3: Random NFT Mint

**Core Contracts**: 
- `RandomNFT.sol` (newly deployed) - ERC721 with 1000 supply cap
- `NFTMintHook.sol` (pre-deployed)

**Workflow**:
```
1. Server queries current supply
2. User clicks "Mint NFT"
3. Frontend calls /api/scenario-2/payment
4. Server generates PaymentRequirements (with hookData)
5. User signs authorization for $0.1 USDC
6. SettlementRouter calls NFTMintHook
7. Hook executes:
   - Mint NFT #{tokenId} → User
   - Transfer $0.1 USDC → Merchant
```

**hookData Encoding**:
```typescript
const config = {
  nftContract: randomNFTAddress,
  tokenId: nextTokenId,
  recipient: userAddress,
  merchant: merchantAddress
};
const hookData = ethers.AbiCoder.encode(
  ['tuple(address,uint256,address,address)'],
  [[config.nftContract, config.tokenId, config.recipient, config.merchant]]
);
```

### Scenario 4: Loyalty Points Reward

**Core Contracts**:
- `RewardToken.sol` (newly deployed) - ERC20 with 1M supply
- `RewardHook.sol` (newly deployed)

**Workflow**:
```
1. User clicks "Earn Points"
2. Frontend calls /api/scenario-3/payment
3. Server generates PaymentRequirements (with hookData)
4. User signs authorization for $0.1 USDC
5. SettlementRouter calls RewardHook
6. Hook executes:
   - Transfer $0.1 USDC → Merchant
   - Distribute 1000 Points → User
```

**Reward Calculation**:
```solidity
// 0.1 USDC = 100,000 (6 decimals)
// Reward rate = 1000 points per 0.1 USDC
uint256 rewardPoints = (amount * REWARD_RATE * 10**18) / 100_000;
// Result: 1000 * 10^18 (18 decimals)
```

## 📁 Project Structure

```
showcase/
├── contracts/              # Solidity smart contracts
│   ├── src/
│   │   ├── RandomNFT.sol
│   │   ├── RewardToken.sol
│   │   └── RewardHook.sol
│   ├── script/Deploy.s.sol
│   └── deploy.sh
│
├── server/                 # Hono backend service
│   ├── src/
│   │   ├── index.ts        # Main server
│   │   ├── config.ts       # Configuration loader
│   │   ├── scenarios/      # Scenario handlers
│   │   │   ├── referral.ts
│   │   │   ├── nft.ts
│   │   │   └── reward.ts
│   │   └── utils/
│   │       └── hookData.ts # hookData encoding utilities
│   └── package.json
│
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── hooks/
│   │   │   ├── useWallet.ts
│   │   │   └── usePayment.ts
│   │   ├── components/
│   │   │   ├── WalletConnect.tsx
│   │   │   └── PaymentStatus.tsx
│   │   └── scenarios/
│   │       ├── ReferralSplit.tsx
│   │       ├── RandomNFT.tsx
│   │       └── PointsReward.tsx
│   └── package.json
│
├── package.json            # Root configuration
└── README.md
```

## 🔧 Development Guide

### Adding New Scenarios

1. **Create Hook Contract** (contracts/src/YourHook.sol)
2. **Add Scenario Handler** (server/src/scenarios/your-scenario.ts)
3. **Add Frontend Component** (client/src/scenarios/YourScenario.tsx)
4. **Update Routes** (server/src/index.ts and client/src/App.tsx)

### Testing Contracts

```bash
cd contracts
forge test
```

### Local Development

```bash
# Start server only
npm run dev:server

# Start client only
npm run dev:client
```

## 📊 Gas Estimates

| Scenario | Gas Cost | Notes |
|----------|----------|-------|
| Direct Payment | ~50k | Original x402 - 1x transferWithAuthorization |
| Transfer Hook | ~58k | TransferHook - adds ~8k gas (~16%) for router+hook |
| Referral Split | ~120k | 1x settleAndExecute + 3x transfer |
| NFT Mint | ~180k | 1x settleAndExecute + 1x mint + 1x transfer |
| Points Reward | ~150k | 1x settleAndExecute + 1x ERC20 transfer + 1x transfer |

## 🧪 Testing Guide

### Get Testnet Tokens

1. **Base Sepolia ETH** (for gas)
   - [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

2. **Base Sepolia USDC** (for payments)
   - [Circle Faucet](https://faucet.circle.com/)
   - Contract: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

### Testing Steps

0. **Scenario 0**: Test direct payment (debugging baseline)
   - Pay $0.1 USDC
   - Verify direct transfer to merchant in block explorer
   - Use this to isolate router/hook issues

1. **Scenario 1**: Test transfer with hook
   - Pay $0.11 USDC ($0.1 + $0.01 fee)
   - Verify merchant received $0.1
   - Verify facilitator accumulated $0.01 fee

2. **Scenario 2**: Test referral revenue split
   - Enter referrer address or leave empty
   - Pay $0.1 USDC
   - Verify 3 transfers in block explorer

3. **Scenario 3**: Test NFT minting
   - Pay $0.1 USDC
   - Check NFT in wallet (#0-#999)
   - View NFT on OpenSea Testnet

4. **Scenario 4**: Test loyalty points
   - Pay $0.1 USDC
   - Check 1000 POINTS tokens in wallet
   - Import token address to MetaMask

## 🔐 Security Notes

### Production Checklist

- [ ] Audit all smart contracts
- [ ] Use multisig wallets for privileged addresses
- [ ] Implement Hook whitelist mechanism
- [ ] Add rate limiting
- [ ] Use environment variables for secrets
- [ ] Enable HTTPS
- [ ] Implement logging and monitoring

### Testnet Warning

- ⚠️ This project is for demonstration and testing only
- ⚠️ Do not use real private keys on testnet
- ⚠️ Contracts are not audited, not production-ready

## 📄 License

Apache-2.0 License - see [LICENSE](../../LICENSE)

## 🔗 Related Links

- [x402 Protocol](https://x402.org)
- [x402-exec Main Project](../../README.md)
- [Contract API Documentation](../../contracts/docs/api.md)
- [Hook Development Guide](../../contracts/docs/hook_guide.md)
- [Base Sepolia Explorer](https://sepolia.basescan.org/)

## 💬 Get Help

- Submit [GitHub Issues](https://github.com/nuwa-protocol/x402-exec/issues)
- Read [Documentation](../../README.md)

