# @x402x/facilitator_v2

SchemeNetworkFacilitator implementation for x402x settlement framework - v2 with official x402 and SettlementRouter support.

## Overview

This package provides a complete implementation of the `SchemeNetworkFacilitator` interface that enables atomic settlement using SettlementRouter contracts. It supports:

- **Atomic Settlement**: Single transaction completes verification, transfer, and hook execution
- **Multi-Party Support**: Facilitator fees and merchant payments in one atomic operation
- **Hook Integration**: Extensible business logic execution during settlement
- **v2 Compatibility**: Uses official `@x402/*` v2 packages only
- **Type Safety**: Full TypeScript support with comprehensive validation

## Features

- ✅ Implements `SchemeNetworkFacilitator` interface from `@x402/core`
- ✅ SettlementRouter contract integration with viem
- ✅ Comprehensive parameter validation and security checks
- ✅ Support for both SettlementRouter and standard modes
- ✅ Gas optimization and configurable limits
- ✅ Multi-network support with dynamic RPC URLs
- ✅ Full error handling and mapping
- ✅ Workspace-only package (private, not published to npm)

## Installation

This is a workspace-only package. Install within the x402-exec monorepo:

```bash
pnpm install
```

## Quick Start

```typescript
import { createRouterSettlementFacilitator } from "@x402x/facilitator_v2";

// Create facilitator instance
const facilitator = createRouterSettlementFacilitator({
  signer: "0x1234567890123456789012345678901234567890",
  allowedRouters: {
    "eip155:84532": ["0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"], // Base Sepolia
    "eip155:8453": ["0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"], // Base
  },
  rpcUrls: {
    "eip155:84532": "https://sepolia.base.org",
    "eip155:8453": "https://mainnet.base.org",
  },
});

// Verify payment without executing
const verification = await facilitator.verify(paymentPayload, paymentRequirements);
if (!verification.isValid) {
  console.error("Payment verification failed:", verification.invalidReason);
  return;
}

// Execute settlement atomically
const settlement = await facilitator.settle(paymentPayload, paymentRequirements);
if (settlement.success) {
  console.log("Settlement successful:", {
    transaction: settlement.transaction,
    network: settlement.network,
    payer: settlement.payer,
  });
} else {
  console.error("Settlement failed:", settlement.errorReason);
}
```

## Configuration

### FacilitatorConfig

```typescript
interface FacilitatorConfig {
  // Required
  signer: Address; // Facilitator signer address

  // Optional security
  allowedRouters?: Record<string, string[]>; // Whitelisted routers per network
  rpcUrls?: Record<string, string>; // Custom RPC URLs per network

  // Optional gas settings
  gasConfig?: {
    maxGasLimit: bigint; // Maximum gas limit (default: 5M)
    gasMultiplier: number; // Gas multiplier for safety (default: 1.2)
  };

  // Optional fee settings
  feeConfig?: {
    minFee: string; // Minimum facilitator fee
    maxFee: string; // Maximum facilitator fee
  };

  // Optional timeouts
  timeouts?: {
    verify: number; // Verification timeout in ms (default: 5000)
    settle: number; // Settlement timeout in ms (default: 30000)
  };
}
```

## API Reference

### RouterSettlementFacilitator

Implements `SchemeNetworkFacilitator` interface:

#### Properties

- `scheme`: "exact" - Payment scheme identifier
- `caipFamily`: "eip155:\*" - Supported network families

#### Methods

##### `getExtra(network: string): Record<string, unknown> | undefined`

Returns scheme-specific metadata for the given network.

##### `getSigners(network: string): string[]`

Returns list of signer addresses for the given network.

##### `verify(payload, requirements): Promise<VerifyResponse>`

Validates payment without executing settlement.

**Returns:**

```typescript
interface VerifyResponse {
  isValid: boolean;
  invalidReason?: string;
  payer?: string;
}
```

##### `settle(payload, requirements): Promise<SettleResponse>`

Executes payment settlement on-chain.

**Returns:**

```typescript
interface SettleResponse {
  success: boolean;
  transaction: string;
  network: string;
  payer?: string;
  errorReason?: string;
}
```

### SettlementRouter Integration

#### `createPublicClientForNetwork(network, rpcUrls?): PublicClient`

Creates a viem public client for the specified network.

#### `createWalletClientForNetwork(network, signer, rpcUrls?): WalletClient`

Creates a viem wallet client for the specified network.

#### `settleWithSettlementRouter(requirements, payload, config, options?): Promise<SettleResponse>`

Direct SettlementRouter settlement execution.

### Validation Utilities

#### `validateSettlementExtra(extra): SettlementExtraCore`

Validates and parses settlement extra parameters.

#### `validateSettlementRouter(network, router, allowedRouters?, networkConfig?): Address`

Validates SettlementRouter address against whitelist and network config.

#### `validateNetwork(network): Network`

Validates network string format.

#### `isValidEthereumAddress(address): boolean`

Checks if string is a valid Ethereum address.

## Error Handling

The package provides custom error types:

- `FacilitatorValidationError`: Parameter validation failures
- `SettlementRouterError`: Contract interaction failures

All errors include descriptive messages for debugging.

## Settlement Mode Detection

The package automatically detects SettlementRouter mode using:

```typescript
import { isSettlementMode } from "@x402x/facilitator_v2";

if (isSettlementMode(paymentRequirements)) {
  // Use SettlementRouter flow
} else {
  // Use standard EIP-3009 flow
}
```

## Examples

### Basic SettlementRouter Usage

```typescript
import { createRouterSettlementFacilitator } from "@x402x/facilitator_v2";

const facilitator = createRouterSettlementFacilitator({
  signer: "0xYourFacilitatorAddress",
});

// Payment requirements with SettlementRouter extra
const requirements = {
  scheme: "exact",
  network: "eip155:84532",
  maxAmountRequired: "1000000", // 1 USDC (6 decimals)
  asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  payTo: "0xSettlementRouterAddress",
  extra: {
    settlementRouter: "0xSettlementRouterAddress",
    salt: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    payTo: "0xMerchantAddress",
    facilitatorFee: "100000", // 0.1 USDC
    hook: "0xTransferHookAddress",
    hookData: "0x",
    name: "USD Coin",
    version: "3",
  },
};

const settlement = await facilitator.settle(paymentPayload, requirements);
```

### Multi-Network Configuration

```typescript
const facilitator = createRouterSettlementFacilitator({
  signer: "0xYourFacilitatorAddress",
  allowedRouters: {
    "eip155:84532": ["0xBaseSepoliaRouter"],
    "eip155:8453": ["0xBaseRouter"],
    "eip155:137": ["0xPolygonRouter"],
  },
  rpcUrls: {
    "eip155:84532": "https://sepolia.base.org",
    "eip155:8453": "https://mainnet.base.org",
    "eip155:137": "https://polygon-rpc.com",
  },
  gasConfig: {
    maxGasLimit: 3_000_000n,
    gasMultiplier: 1.1,
  },
});
```

## Development

```bash
# Install dependencies
pnpm install

# Build package
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage

# Lint code
pnpm lint

# Format code
pnpm format
```

## Dependencies

- `@x402/core`: Official x402 v2 core types
- `@x402/evm`: Official x402 v2 EVM utilities
- `@x402x/core_v2`: x402x core utilities (workspace)
- `viem`: Ethereum TypeScript library

## License

Apache-2.0 - see LICENSE file for details.

## Related Packages

- `@x402x/core_v2`: Core utilities and types
- `@x402x/express_v2`: Express middleware wrapper
- `@x402x/hono_v2`: Hono middleware wrapper
- `@x402x/fetch_v2`: Fetch client wrapper
