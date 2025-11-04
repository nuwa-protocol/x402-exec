# x402X

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/solidity-^0.8.20-green.svg)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/foundry-latest-red.svg)](https://getfoundry.sh/)

English | [简体中文](./README_CN.md)

x402X (short for x402-exec) is a programmable settlement framework for [x402 protocol](https://github.com/coinbase/x402), combining payment verification, Hook-based business logic, and facilitator incentives in atomic transactions.

## ✨ Features

### 💎 What Makes x402X Special

**Programmable Settlement with Real Atomicity** - Not just payment routing, but a complete settlement execution framework that combines payment verification, business logic execution, and facilitator incentives in a single atomic transaction.

### 🎯 Core Capabilities

**🔌 Infinite Extensibility through Hooks**
- Revenue splitting for multi-party payments
- NFT minting with atomic payment
- Reward points distribution
- Any custom business logic you can imagine

**💰 Native Facilitator Fee Support**
- Built-in facilitator fee mechanism enables truly permissionless facilitators
- Solves the key missing piece in the x402 protocol
- Accumulated fees claimable at any time
- Transparent fee tracking through events

**⚡ Minimal Integration Overhead**
- Only 3 extra fields required in PaymentRequirements
- Single transaction completes everything - no Multicall3 complexity
- Minimal client-side changes (only nonce calculation adjustment)
- Backward compatible with existing x402 infrastructure

**🔄 Native Idempotency & Observability**
- Built-in replay protection through EIP-3009 nonce
- Complete event logs for reconciliation and monitoring
- Context-based settlement tracking

### 💡 Built-in Examples

✅ **Revenue Splitting** - Automatic multi-party payment distribution  
✅ **NFT Commerce** - Atomic mint-on-payment with revenue split  
✅ **Loyalty Programs** - Real-time reward points distribution

### 🔐 Security Design

**Multi-Layer Protection**
- Cryptographic commitment verification prevents parameter tampering
- No-fund-holding principle - Router balance always zero
- OpenZeppelin-based reentrancy protection
- CEI (Checks-Effects-Interactions) pattern enforcement
- 35+ test cases covering edge cases

## 🏗️ Architecture

```
Client (EIP-3009 Signature)
         ↓
    Facilitator
         ↓
   SettlementRouter ──→ Hook ──→ Recipients
         │                      (Split/Fulfill)
         └→ Events (Observability)
```

### Core Components

1. **SettlementRouter**: Core settlement contract
   - Consumes EIP-3009 authorization
   - Calls Hooks to execute business logic
   - Ensures atomicity and idempotency

2. **ISettlementHook**: Hook interface
   - All business logic implemented through Hooks
   - Fully extensible, supports arbitrary scenarios

## 📦 Project Structure

```
x402-exec/
├── contracts/              # Solidity smart contracts
│   ├── src/
│   │   ├── SettlementRouter.sol    # Core settlement contract
│   │   └── interfaces/             # Contract interfaces
│   ├── examples/                   # Hook examples
│   ├── script/                     # Deployment scripts
│   ├── test/                       # Contract tests
│   └── docs/                       # Contract documentation
├── examples/
│   ├── facilitator/                # SettlementRouter-enabled facilitator
│   └── showcase/                   # Full-stack demo application
└── docs/                           # Project documentation
```

## 🚀 Quick Start

### Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Clone project
git clone https://github.com/nuwa-protocol/x402-exec.git
cd x402-exec
```

### Build and Test

```bash
cd contracts
forge build
forge test
```

### Deploy Contracts

```bash
cd contracts
./deploy.sh  # Configure .env first
```

## 💡 Usage Examples

### Facilitator Integration

The facilitator automatically supports both:
- **Standard x402 payments**: Direct ERC-3009 transfers
- **SettlementRouter payments**: Extended settlement with Hook execution

See the [Facilitator README](./examples/facilitator/README.md) for complete setup guide and running instructions, or the [Facilitator Developer Guide](./contracts/docs/facilitator_guide.md) for extending your own facilitator.

### Live Demo

Check out the full-stack showcase application:
- **Location**: [`examples/showcase/`](./examples/showcase/)
- **Scenarios**: Revenue splitting, NFT minting, reward points
- **Tech Stack**: React + TypeScript + Viem

### Hook Examples

All Hook implementations are available in [`contracts/examples/`](./contracts/examples/):

- **RevenueSplitHook**: Multi-party payment distribution ([source](./contracts/examples/revenue-split/))
- **NFTMintHook**: Atomic NFT minting with payment ([source](./contracts/examples/nft-mint/))
- **RewardHook**: Loyalty points distribution ([source](./contracts/examples/reward-points/))

## 🌐 Deployments

> ⚠️ **Development Status**: Under active development and not yet audited. For demonstration and testing purposes only.

### SettlementRouter Contract

| Network | SettlementRouter | Status |
|---------|------------------|--------|
| Base Sepolia (Testnet) | [`0x32431D4511e061F1133520461B07eC42afF157D6`](https://sepolia.basescan.org/address/0x32431D4511e061F1133520461B07eC42afF157D6) | ✅ Active |
| X-Layer Testnet | [`0x1ae0e196dc18355af3a19985faf67354213f833d`](https://www.oklink.com/xlayer-test/address/0x1ae0e196dc18355af3a19985faf67354213f833d) | ✅ Active |
| Base Mainnet | - | 🚧 Pending Audit |
| Ethereum Mainnet | - | 🚧 Pending Audit |

### Live Examples

Example deployments for testing and reference:

- **Showcase Demo**: [https://demo.x402x.dev/](https://demo.x402x.dev/)  
  Interactive demo with 3 payment scenarios (referral split, NFT mint, loyalty rewards)

- **Example Facilitator**: [https://facilitator.x402x.dev](https://facilitator.x402x.dev)  
  Reference facilitator implementation (see [Facilitator Guide](./examples/facilitator/README.md))

> 💡 **Note**: These are example deployments. For production use, deploy your own facilitator and configure it according to your needs.

## 📖 Documentation

### For Developers

- **[Facilitator Example & Setup](./examples/facilitator/README.md)** - Complete TypeScript implementation with setup guide
- **[Facilitator Developer Guide](./contracts/docs/facilitator_guide.md)** - Language-agnostic integration guide for extending your facilitator
- **[Hook Development Guide](./contracts/docs/hook_guide.md)** - Build custom Hooks for business logic
- **[Contract API Documentation](./contracts/docs/api.md)** - SettlementRouter contract interface

## 🗺️ Roadmap

- [x] SettlementRouter core contract
- [x] Hook interface and examples
- [x] Documentation and guides
- [ ] Complete test coverage
- [ ] Gas optimization
- [ ] Security audit
- [ ] Mainnet deployment

## 🤝 Contributing

Contributions are welcome! Please check the [Contributing Guide](./CONTRIBUTING.md).

**For AI Agents**: Before making any code changes, **you MUST read** the [Development Workflow Rules](./.github/WORKFLOW.md) which define mandatory Git workflow practices.

## 📄 License

Apache-2.0 License - see [LICENSE](./LICENSE) for details

## 🔗 Related Links

- [x402 Protocol](https://github.com/coinbase/x402)
- [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [Foundry Documentation](https://book.getfoundry.sh/)
