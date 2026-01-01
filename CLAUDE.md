# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

x402x (x402-exec) is a programmable settlement framework for the x402 protocol. It extends x402 payments with Hook-based business logic execution, facilitator incentives, and atomic transactions. The core innovation is a "commitment-as-nonce" scheme where a cryptographic hash of all settlement parameters becomes the EIP-3009 nonce, binding business logic to user signatures and preventing parameter tampering.

## Repository Structure

This is a **pnpm workspace monorepo** with the following components:

```
x402-exec/
├── contracts/              # Foundry Solidity project
│   ├── src/
│   │   ├── SettlementRouter.sol    # Core settlement contract
│   │   └── interfaces/             # ISettlementRouter, ISettlementHook, IERC3009
│   ├── examples/                   # Hook example contracts (nft-mint, reward-points)
│   ├── script/                     # Deployment scripts
│   └── test/                       # Foundry tests (*.t.sol)
├── typescript/packages/
│   ├── core/           # Core utilities: commitment calculation, network configs, middleware
│   ├── extensions/     # x402 v2 protocol extensions for settlement
│   ├── client/         # Client SDK (React/wagmi hooks for browser wallets)
│   └── facilitator-sdk/   # Utilities for facilitator implementations
├── facilitator/        # Production facilitator service (Node/Express)
├── examples/showcase/
│   ├── server/         # Resource server (Express backend demo)
│   └── client/         # Payment client (React + Vite frontend demo)
├── web/
│   ├── frontend/       # Explorer/scanner web UI
│   └── backend/        # Web backend service
└── docs/               # Architecture and integration docs
```

## Development Commands

### Setup (First Time)

```bash
# Install all workspace dependencies
pnpm install

# Copy environment template and configure
cp env.template .env
# Edit .env with RPC URLs, API keys, etc.
```

### Build Commands

```bash
pnpm build              # Build SDK packages + examples + facilitator
pnpm build:sdk          # Build only TypeScript packages (typescript/packages/*)
pnpm build:facilitator  # Build facilitator service
pnpm build:showcase     # Build showcase demo
```

### Testing

```bash
# Solidity contracts (Foundry)
cd contracts
forge build
forge test                         # Run all tests
forge test --gas-report            # With gas reporting
forge coverage                     # Coverage report

# TypeScript packages (Vitest)
pnpm --filter './typescript/packages/**' test       # All SDK tests
pnpm --filter @x402x/core test                     # Specific package
pnpm --filter @x402x/extensions test:coverage

# Facilitator
pnpm -C facilitator test
pnpm -C facilitator test:unit
pnpm -C facilitator test:e2e
```

### Development Servers

```bash
pnpm dev                    # Showcase app (client + server)
pnpm dev:server             # Showcase server only (port 3000)
pnpm dev:client             # Showcase client only (port 5173)
pnpm dev:facilitator        # Facilitator service
pnpm -C web/frontend dev    # Web UI
pnpm -C web/backend dev     # Web backend
```

### Code Quality

```bash
pnpm format                 # Format TypeScript (Prettier, 2-space, ~100 cols)
pnpm format:check
pnpm -C web/frontend check  # Web frontend uses Biome
```

### Contract Deployment

```bash
cd contracts
./deploy-contract.sh [NETWORK] [OPTIONS]

# Examples:
./deploy-contract.sh base-sepolia --all --verify    # Deploy all contracts
./deploy-contract.sh base --settlement --verify     # SettlementRouter only
./deploy-contract.sh xlayer --hooks --verify        # Built-in hooks
```

## Key Architecture Concepts

### Commitment-as-Nonce Scheme

The cryptographic foundation of x402x. The client computes a commitment hash from **all** settlement parameters and uses it as the EIP-3009 nonce:

```typescript
nonce = keccak256(
  "X402/settle/v1",
  chainId,
  hub,              // SettlementRouter address
  token, from, value,
  validAfter, validBefore,
  salt,
  payTo,            // Final recipient (for transparency)
  facilitatorFee,
  hook,             // Hook contract address
  keccak256(hookData)
);
```

This binds business parameters to the signature, prevents parameter tampering, and enables stateless facilitator processing.

### Settlement Flow

1. **Client** receives `PaymentRequirements` with `extra.settlementRouter` from resource server
2. **Client** computes commitment, signs EIP-3009 `TransferWithAuthorization` (with nonce=commitment, to=router)
3. **Facilitator** receives `X-PAYMENT` header, detects settlement mode, calls `SettlementRouter.settleAndExecute()`
4. **SettlementRouter** verifies commitment, executes EIP-3009 transfer, deducts fee, calls Hook
5. **Hook** executes business logic (split, mint NFT, distribute points, etc.)
6. **SettlementRouter** verifies zero balance (no fund holding), emits events

### Hook Interface

```solidity
interface ISettlementHook {
    function execute(
        address token,
        address from,
        uint256 value,
        bytes32 salt,
        address payTo,
        bytes calldata hookData
    ) external;
}
```

Hooks receive **net value** (after facilitator fee) and implement arbitrary business logic. Built-in `TransferHook` performs simple transfers.

### Dual-Stack Protocol Support

The codebase supports both x402 v1 (human-readable network names like `base-sepolia`) and v2 (CAIP-2 identifiers like `eip155:84532`). Detection is automatic based on request format. Enable v2 with `FACILITATOR_ENABLE_V2=true`.

## Important Development Rules

### Git Workflow (CRITICAL)

**Read `.github/WORKFLOW.md` before making any commits.** Key rules:

- **On `main`?** Create a feature branch first
- **On non-main branch?** Can commit, but NEVER push without explicit user approval
- **NEVER push directly to `main`** - always use PR process

### Code Style

- **TypeScript**: Prettier with 2-space indent, ~100 char line limit
- **Solidity**: `pragma solidity ^0.8.20`, NatSpec on public/external APIs, CEI pattern, reentrancy guards
- **Web frontend**: Uses Biome (not Prettier)
- Tests: Prefer `*.test.ts` suffix for TypeScript tests, `*.t.sol` for Foundry tests

### Submodule Management

- `contracts/lib/` and `lib/` contain git submodules - **do not edit directly**

### x402 Dependency

The workspace uses the official `@x402/*` v2 packages from npm. The `@x402x/extensions` package provides x402x-specific extensions and utilities built on top of `@x402/core`.

## Package Relationships

```
@x402x/core        → Foundation: commitment calc, networks, middleware
@x402x/extensions  → x402 v2 protocol extensions (uses @x402/core)
@x402x/client      → Browser SDK (uses extensions, wagmi/React optional peers)
@x402x/facilitator-sdk → Utilities for facilitator devs
facilitator/       → Production service (uses core + facilitator-sdk)
```

## Testing Priorities

- **Contract changes**: Run `forge test --gas-report` to check gas impact
- **SDK changes**: Run `pnpm --filter './typescript/packages/**' test`
- **Facilitator changes**: Run both unit and e2e tests
- Always include revert/edge case tests for new contract functions

## Reference Documents

- **Architecture**: `docs/x402-exec.md` - Detailed system design and protocol
- **Git Workflow**: `.github/WORKFLOW.md` - Mandatory commit/push rules
- **Contributing**: `CONTRIBUTING.md` - Contribution guidelines
- **Development**: `docs/development.md` - Local dev setup
- **Contract Docs**: `contracts/docs/api.md`, `contracts/docs/hook_guide.md`, `contracts/docs/facilitator_guide.md`
