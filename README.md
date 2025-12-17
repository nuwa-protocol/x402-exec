# x402x

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Solidity](https://img.shields.io/badge/solidity-^0.8.20-green.svg)](https://soliditylang.org/)
[![Foundry](https://img.shields.io/badge/foundry-latest-red.svg)](https://getfoundry.sh/)

English | [简体中文](./README_CN.md)

x402x (short for x402-exec) is a programmable settlement framework for [x402 protocol](https://github.com/coinbase/x402), combining payment verification, Hook-based business logic, and facilitator incentives in atomic transactions.

## ✨ Features

### 💎 What Makes x402x Special

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

2. **TransferHook** (Built-in): Default transfer Hook
   - Simple transfers with facilitator fee support
   - Replaces direct ERC-3009 transfers
   - Minimal gas overhead (~8k gas)
   - Universal deployment (one instance per network)

3. **ISettlementHook**: Hook interface
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
├── facilitator/                    # Production-ready facilitator service
├── examples/
│   └── showcase/                   # Full-stack demo application
└── docs/                           # Project documentation
```

## 🚀 Quick Start

### Third-Party Integration

If you want to use x402-exec in your own project, we provide an enhanced version of the x402 package. See the [Third-Party Integration Guide](./docs/third-party-integration.md) for details.

**Quick Install:**

```bash
# Using npm alias (recommended)
npm install x402@npm:@x402x/x402@0.6.6-patch.7

# Or using pnpm
pnpm add x402@npm:@x402x/x402@0.6.6-patch.7
```

In `package.json`:
```json
{
  "dependencies": {
    "x402": "npm:@x402x/x402@0.6.6-patch.7"
  }
}
```

> 💡 **Why the modified version?** We've added `paymentRequirements` field support to x402 ([PR #578](https://github.com/coinbase/x402/pull/578)), but the improvement was deferred to v2. `@x402x/x402` gives you access to these features now, with full backward compatibility.

### Developer Quick Start

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
./deploy-contract.sh [NETWORK] [OPTIONS]  # Configure .env first

# Examples:
./deploy-contract.sh base-sepolia --all --verify    # Deploy everything on testnet
./deploy-contract.sh base --settlement --verify     # Deploy SettlementRouter on mainnet
./deploy-contract.sh xlayer --hooks --verify        # Deploy built-in hooks
```

## 💡 Usage Examples

### Facilitator Integration

The facilitator is a production-ready service that automatically supports both:
- **Standard x402 payments**: Direct ERC-3009 transfers
- **SettlementRouter payments**: Extended settlement with Hook execution

See the [Facilitator README](./facilitator/README.md) for installation, deployment, and configuration guide, or the [Facilitator Developer Guide](./contracts/docs/facilitator_guide.md) for extending your own facilitator.

### Live Demo

Check out the full-stack showcase application:
- **Location**: [`examples/showcase/`](./examples/showcase/)
- **Scenarios**: Revenue splitting, NFT minting, reward points
- **Tech Stack**: React + TypeScript + Viem

### Hook Examples

#### Built-in Hooks

Protocol-level Hooks deployed once per network for universal use:

- **TransferHook**: Simple transfers with facilitator fee support ([docs](./contracts/docs/builtin_hooks.md))
  - Direct replacement for ERC-3009 transfers
  - Minimal gas overhead
  - No hookData required

#### Example Hooks

Educational templates and reference implementations in [`contracts/examples/`](./contracts/examples/):

- **TransferHook**: Simple transfers and revenue splitting (built-in, no separate contract needed)
- **NFTMintHook**: Atomic NFT minting with payment ([source](./contracts/examples/nft-mint/))
- **RewardHook**: Loyalty points distribution ([source](./contracts/examples/reward-points/))



### SettlementRouter Contract

| Network                | SettlementRouter                                                                                                                      | Status    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Base Sepolia (Testnet) | [`0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb`](https://sepolia.basescan.org/address/0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb)       | ✅ Active  |
| X-Layer Testnet        | [`0xba9980fb08771e2fd10c17450f52d39bcb9ed576`](https://www.oklink.com/xlayer-test/address/0xba9980fb08771e2fd10c17450f52d39bcb9ed576) | ✅ Active  |
| SKALE Base Sepolia     | [`0x1Ae0E196dC18355aF3a19985faf67354213F833D`](https://base-sepolia-testnet-explorer.skalenodes.com/address/0x1Ae0E196dC18355aF3a19985faf67354213F833D) | ✅ Active  |
| BSC Testnet            | [`0x1Ae0E196dC18355aF3a19985faf67354213F833D`](https://testnet.bscscan.com/address/0x1Ae0E196dC18355aF3a19985faf67354213F833D)        | ✅ Active  |
| Base Mainnet           | [`0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B`](https://basescan.org/address/0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B)               | 🎉 Live    |
| X-Layer Mainnet        | [`0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B`](https://www.oklink.com/xlayer/address/0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B)      | 🎉 Live    |
| BSC Mainnet            | [`0x1Ae0E196dC18355aF3a19985faf67354213F833D`](https://bscscan.com/address/0x1Ae0E196dC18355aF3a19985faf67354213F833D)                | 🎉 Live    |
| Ethereum Mainnet       | -                                                                                                                                     | 🚧 Planned |

### TransferHook (Built-in)

| Network                | TransferHook                                                                                                                          | Status    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Base Sepolia (Testnet) | [`0x4DE234059C6CcC94B8fE1eb1BD24804794083569`](https://sepolia.basescan.org/address/0x4DE234059C6CcC94B8fE1eb1BD24804794083569)       | ✅ Active  |
| X-Layer Testnet        | [`0xD4b98dd614c1Ea472fC4547a5d2B93f3D3637BEE`](https://www.oklink.com/xlayer-test/address/0xD4b98dd614c1Ea472fC4547a5d2B93f3D3637BEE) | ✅ Active  |
| SKALE Base Sepolia     | [`0x2f05fe5674aE756E25C26855258B4877E9e021Fd`](https://base-sepolia-testnet-explorer.skalenodes.com/address/0x2f05fe5674aE756E25C26855258B4877E9e021Fd) | ✅ Active  |
| BSC Testnet            | [`0x2f05fe5674aE756E25C26855258B4877E9e021Fd`](https://testnet.bscscan.com/address/0x2f05fe5674aE756E25C26855258B4877E9e021Fd)        | ✅ Active  |
| Base Mainnet           | [`0x081258287F692D61575387ee2a4075f34dd7Aef7`](https://basescan.org/address/0x081258287F692D61575387ee2a4075f34dd7Aef7)               | 🎉 Live    |
| X-Layer Mainnet        | [`0x081258287F692D61575387ee2a4075f34dd7Aef7`](https://www.oklink.com/xlayer/address/0x081258287F692D61575387ee2a4075f34dd7Aef7)      | 🎉 Live    |
| BSC Mainnet            | [`0x2f05fe5674aE756E25C26855258B4877E9e021Fd`](https://bscscan.com/address/0x2f05fe5674aE756E25C26855258B4877E9e021Fd)                | 🎉 Live    |
| Ethereum Mainnet       | -                                                                                                                                     | 🚧 Planned |

### Live Examples

Example deployments for testing and reference:

- **Showcase Demo**: [https://demo.x402x.dev/](https://demo.x402x.dev/)  
  Interactive demo with 3 payment scenarios (referral split, NFT mint, loyalty rewards)

- **Example Facilitator**: [https://facilitator.x402x.dev](https://facilitator.x402x.dev)  
  Reference facilitator implementation (see [Facilitator Guide](./facilitator/README.md))

> 💡 **Note**: These are example deployments. For production use, deploy your own facilitator using the [Facilitator package](./facilitator/) and configure it according to your needs.

## 📖 Documentation

### For Developers

- **[Built-in Hooks Guide](./contracts/docs/builtin_hooks.md)** - Using TransferHook and other built-in Hooks
- **[Facilitator Setup & Deployment](./facilitator/README.md)** - Complete setup guide for production deployment
- **[Facilitator Developer Guide](./contracts/docs/facilitator_guide.md)** - Language-agnostic integration guide for extending your facilitator
- **[Hook Development Guide](./contracts/docs/hook_guide.md)** - Build custom Hooks for business logic
- **[Contract API Documentation](./contracts/docs/api.md)** - SettlementRouter contract interface

## 🗺️ Roadmap

- [x] SettlementRouter core contract
- [x] Hook interface and examples
- [x] TransferHook built-in implementation
- [x] Documentation and guides
- [x] Complete test coverage
- [x] Gas optimization
- [x] Security audit
- [x] Mainnet deployment

## 🤝 Contributing

Contributions are welcome! Please check the [Contributing Guide](./CONTRIBUTING.md).

**For AI Agents**: Before making any code changes, **you MUST read** the [Development Workflow Rules](./.github/WORKFLOW.md) which define mandatory Git workflow practices.

## 📄 License

Apache-2.0 License - see [LICENSE](./LICENSE) for details

## 🔗 Related Links

- [x402 Protocol](https://github.com/coinbase/x402)
- [EIP-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)
- [Foundry Documentation](https://book.getfoundry.sh/)
