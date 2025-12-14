# @x402x/fetch_v2

> **Private workspace package** - Wraps official @x402/fetch with router-settlement exact-EVM client scheme

This package provides a fetch wrapper that integrates with the official x402 payment protocol v2 while adding support for x402x router settlement (commitment-based nonce + EIP-712).

## Features

- ✅ Wraps official `@x402/fetch` for standard x402 v2 compliance
- ✅ Custom `ExactEvmSchemeWithRouterSettlement` client
- ✅ Automatic settlement mode detection via `requirements.extra.settlementRouter`
- ✅ Commitment-based nonce for router settlement
- ✅ EIP-712 signing with typed data
- ✅ Extensions echo support
- ✅ Delegates to official behavior for non-settlement requests

## Installation

This is a workspace-only package (marked as `private: true`). It is not published to npm.

```bash
pnpm install
pnpm --filter @x402x/fetch_v2 build
```

## Usage

### Basic Example

```typescript
import { wrapFetchWithPayment } from "@x402x/fetch_v2";
import { createWalletClient, custom } from "viem";
import { baseSepolia } from "viem/chains";

// Create wallet client
const walletClient = createWalletClient({
  chain: baseSepolia,
  transport: custom(window.ethereum),
});

// Wrap fetch with payment support
const fetchWithPay = wrapFetchWithPayment(
  fetch,
  walletClient,
  "eip155:84532", // CAIP-2 network format
);

// Make requests - automatically handles 402 responses
const response = await fetchWithPay("/api/protected-resource");
```

### With Payment Policy

```typescript
import { wrapFetchWithPayment, type PaymentPolicy } from "@x402x/fetch_v2";

const policy: PaymentPolicy = {
  maxAmount: { value: "100000", decimals: 6 }, // Max 0.1 USDC
  autoApprove: true,
};

const fetchWithPay = wrapFetchWithPayment(fetch, walletClient, "eip155:84532", policy);
```

## How It Works

### Settlement Mode Detection

The scheme automatically detects settlement mode by checking for `requirements.extra.settlementRouter`:

```typescript
// Server sends PaymentRequirements with settlementRouter
{
  "scheme": "exact",
  "network": "eip155:84532",
  "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "payTo": "0x...",
  "amount": "100000",
  "maxTimeoutSeconds": 3600,
  "extra": {
    "settlementRouter": "0x...",  // ← Triggers settlement mode
    "salt": "0x...",
    "payTo": "0x...",
    "facilitatorFee": "10000",
    "hook": "0x...",
    "hookData": "0x",
    "name": "USD Coin",
    "version": "2"
  }
}
```

### Settlement Mode (Router Settlement)

When `settlementRouter` is present:

1. **Commitment-based nonce**: Calculates commitment hash from all settlement parameters
2. **EIP-712 signing**: Signs `TransferWithAuthorization` with commitment as nonce
3. **Binds parameters**: Prevents tampering by binding all params to signature

```typescript
// Commitment calculation
const nonce = calculateCommitment({
  chainId,
  hub: settlementRouter,
  asset,
  from,
  value,
  validAfter,
  validBefore,
  salt,
  payTo,
  facilitatorFee,
  hook,
  hookData,
});
```

### Standard Mode (Non-Settlement)

When `settlementRouter` is absent:

1. **Random nonce**: Uses crypto.getRandomValues for standard EIP-3009
2. **Official behavior**: Delegates to official `ExactEvmScheme` from `@x402/evm`

## Testing

```bash
# Run tests
pnpm --filter @x402x/fetch_v2 test

# Watch mode
pnpm --filter @x402x/fetch_v2 test:watch

# Coverage
pnpm --filter @x402x/fetch_v2 test:coverage
```

## Test Coverage

Tests validate:

- ✅ Settlement vs non-settlement selection
- ✅ Commitment-based nonce generation
- ✅ Random nonce for standard mode
- ✅ EIP-712 domain parameters
- ✅ Typed data signing inputs
- ✅ Authorization structure
- ✅ Timestamp ranges
- ✅ Error handling

## Architecture

```
@x402x/fetch_v2
├── ExactEvmSchemeWithRouterSettlement
│   ├── Implements SchemeNetworkClient
│   ├── Wraps official ExactEvmScheme
│   └── Adds settlement mode support
│
└── wrapFetchWithPayment
    ├── Creates x402Client
    ├── Registers custom scheme
    └── Uses official wrapFetchWithPayment
```

## Dependencies

- `@x402/core`: Official x402 v2 core types
- `@x402/evm`: Official x402 v2 EVM scheme
- `@x402/fetch`: Official x402 v2 fetch wrapper
- `@x402x/core_v2`: x402x settlement utilities
- `viem`: Ethereum library

## License

Apache-2.0
