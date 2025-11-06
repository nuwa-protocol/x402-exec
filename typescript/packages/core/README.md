# @x402x/core

Core utilities for the x402x settlement framework - a lightweight library that extends x402 with programmable settlement capabilities.

## Features

- 🔐 **Commitment Calculation**: Cryptographically bind settlement parameters to user signatures
- 🌐 **Network Configuration**: Pre-configured settings for all supported networks
- 🔌 **Builtin Hooks**: Easy integration with TransferHook and other builtin hooks
- 🚀 **Middleware**: Drop-in Express and Hono middleware for resource servers
- 🛡️ **Type-Safe**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
npm install @x402x/core
# or
pnpm add @x402x/core
# or
yarn add @x402x/core
```

## Quick Start

### Resource Server (Generating PaymentRequirements)

```typescript
import { addSettlementExtra, TransferHook, getNetworkConfig } from "@x402x/core";

// Base PaymentRequirements (standard x402)
const baseRequirements = {
  scheme: "exact",
  network: "base-sepolia",
  maxAmountRequired: "100000", // 0.1 USDC
  asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  payTo: merchantAddress,
  resource: "/api/payment",
};

// Add settlement extension
const requirements = addSettlementExtra(baseRequirements, {
  hook: TransferHook.getAddress("base-sepolia"),
  hookData: TransferHook.encode(),
  facilitatorFee: "10000", // 0.01 USDC
  payTo: merchantAddress,
});

// Return 402 response
res.status(402).json({
  accepts: [requirements],
  x402Version: 1,
});
```

### Using Express Middleware

```typescript
import express from "express";
import { x402Middleware } from "@x402x/core/middleware/express";

const app = express();

app.post(
  "/api/payment",
  x402Middleware({
    network: "base-sepolia",
    amount: "100000",
    resource: "/api/payment",
    facilitatorFee: "10000",
  }),
  (req, res) => {
    // Only runs after successful payment
    res.json({ success: true });
  },
);
```

### Facilitator Integration

```typescript
import { settle } from "x402/facilitator";
import { isSettlementMode, settleWithRouter, getNetworkConfig } from "@x402x/core/facilitator";

// Detect settlement mode
if (isSettlementMode(paymentRequirements)) {
  // x402x settlement
  const config = getNetworkConfig(paymentRequirements.network);
  const result = await settleWithRouter(signer, paymentPayload, paymentRequirements, {
    allowedRouters: {
      [paymentRequirements.network]: [config.settlementRouter],
    },
  });
} else {
  // Standard x402
  const result = await settle(signer, paymentPayload, paymentRequirements);
}
```

## API Reference

### Core Functions

#### `calculateCommitment(params: CommitmentParams): string`

Calculate commitment hash that binds all settlement parameters.

```typescript
const commitment = calculateCommitment({
  chainId: 84532,
  hub: "0x...",
  token: "0x...",
  from: "0x...",
  value: "100000",
  validAfter: "0",
  validBefore: "1234567890",
  salt: "0x...",
  payTo: "0x...",
  facilitatorFee: "10000",
  hook: "0x...",
  hookData: "0x",
});
```

#### `generateSalt(): string`

Generate a random 32-byte salt for settlement uniqueness.

```typescript
const salt = generateSalt();
// => '0x1234567890abcdef...'
```

#### `addSettlementExtra(requirements, params): PaymentRequirements`

Add settlement extension to PaymentRequirements.

### Network Functions

#### `getNetworkConfig(network: string): NetworkConfig`

Get configuration for a specific network.

```typescript
const config = getNetworkConfig("base-sepolia");
// => { chainId: 84532, settlementRouter: '0x...', ... }
```

#### `getSupportedNetworks(): string[]`

Get list of all supported networks.

```typescript
const networks = getSupportedNetworks();
// => ['base-sepolia', 'x-layer-testnet']
```

### Builtin Hooks

#### `TransferHook.encode(): string`

Encode hookData for TransferHook (always returns '0x').

#### `TransferHook.getAddress(network: string): string`

Get TransferHook address for a specific network.

### Facilitator Functions

See `@x402x/core/facilitator` for detailed facilitator utilities.

## Supported Networks

- **base-sepolia** (Testnet): Base Sepolia testnet
- **x-layer-testnet** (Testnet): X-Layer testnet

Mainnet support coming after security audit.

## License

Apache-2.0

## Links

- [GitHub Repository](https://github.com/nuwa-protocol/x402-exec)
- [Documentation](https://github.com/nuwa-protocol/x402-exec/tree/main/docs)
- [Examples](https://github.com/nuwa-protocol/x402-exec/tree/main/examples)
