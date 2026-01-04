# @x402x TypeScript SDK

TypeScript SDK for the x402x settlement framework - a programmable payment settlement extension for the x402 protocol.

## Packages

This repository contains the following packages:

- **[@x402x/core](./packages/core)**: Core utilities, types, and helper functions
- **[@x402x/fetch](./packages/fetch)**: Fetch wrapper for automatic 402 handling with settlement support
- **[@x402x/express](./packages/express)**: Express middleware for creating 402 payment gates
- **[@x402x/hono](./packages/hono)**: Hono middleware for creating 402 payment gates
- **[@x402x/react](./packages/react)**: React hooks for payment integration

## Quick Start

### For Resource Servers

#### With Express

```bash
npm install @x402x/express @x402x/core
```

```typescript
import express from 'express';
import { x402Middleware } from '@x402x/express';

const app = express();

app.post('/api/premium',
  x402Middleware({
    network: 'eip155:84532', // Base Sepolia (CAIP-2 format)
    amount: '100000', // 0.1 USDC
    resource: '/api/premium',
    facilitatorFee: '10000',
  }),
  (req, res) => {
    res.json({ content: 'Premium content!' });
  }
);

app.listen(3000);
```

#### With Hono

```bash
npm install @x402x/hono @x402x/core
```

```typescript
import { Hono } from 'hono';
import { x402Middleware } from '@x402x/hono';

const app = new Hono();

app.post('/api/premium',
  x402Middleware({
    network: 'eip155:84532', // Base Sepolia (CAIP-2 format)
    amount: '100000',
    resource: '/api/premium',
  }),
  (c) => c.json({ content: 'Premium content!' })
);

export default app;
```

### For Client Applications

#### With React Hooks

```bash
npm install @x402x/react
```

```typescript
import { useX402Payment } from '@x402x/react';

function PaymentButton() {
  const { pay, status, error } = useX402Payment();
  
  const handlePay = async () => {
    try {
      const data = await pay('/api/premium');
      console.log('Success:', data);
    } catch (err) {
      console.error('Failed:', err);
    }
  };
  
  return (
    <button onClick={handlePay} disabled={status === 'paying'}>
      {status === 'paying' ? 'Processing...' : 'Pay & Fetch'}
    </button>
  );
}
```

#### With Fetch Wrapper

```bash
npm install @x402x/fetch @x402x/core
```

```typescript
import { x402xFetch } from '@x402x/fetch';
import { createWalletClient } from 'viem';

const walletClient = createWalletClient({...});
const fetchWithPay = x402xFetch(fetch, walletClient);

// Automatically handles 402 responses
const response = await fetchWithPay('/api/premium');
const data = await response.json();
```

### For Facilitators

```bash
npm install @x402x/core
```

```typescript
import { isSettlementMode, settleWithRouter } from '@x402x/core';

// Detect settlement mode
if (isSettlementMode(paymentRequirements)) {
  // Execute settlement via SettlementRouter
  const result = await settleWithRouter(client, paymentPayload);
  console.log('Settlement hash:', result.hash);
}
```

## Features

### ✨ Core Features (@x402x/core)

- 🔐 **Commitment Calculation**: Cryptographically bind settlement parameters
- 🌐 **Network Support**: Pre-configured for multiple networks using CAIP-2 format
  - Base Sepolia: `eip155:84532`
  - Base Mainnet: `eip155:8453`
  - X-Layer Testnet: `eip155:1952`
  - X-Layer Mainnet: `eip155:196`
- 🪝 **Built-in Hooks**: TransferHook for basic payment splits
- 🛠️ **Utility Functions**: Helper functions for common tasks
- 📝 **Full TypeScript**: Complete type definitions

### 🔄 Fetch Wrapper (@x402x/fetch)

- 🔄 **Automatic 402 Handling**: Transparent payment injection
- 🎯 **Settlement Mode Detection**: Uses commitment-based nonce when needed
- 🔙 **Fallback Support**: Works with standard x402 for non-settlement payments
- 💰 **Configurable Limits**: Set maximum payment amounts
- 🚀 **Zero Configuration**: Works out of the box

### 🌐 Server Middleware (@x402x/express, @x402x/hono)

- 🚀 **Drop-in Middleware**: Easy integration with existing apps
- 💰 **Facilitator Fees**: Built-in support for facilitator incentives
- 🔌 **Hook Support**: Works with builtin or custom hooks
- 🎯 **Zero Configuration**: Sensible defaults for common use cases
- ⚡ **Edge Runtime**: @x402x/hono supports edge deployments

### ⚛️ React Integration (@x402x/react)

- 🪝 **React Hooks**: `useX402Payment` for easy integration
- 🔄 **State Management**: Automatic status and error tracking
- 🎯 **Wagmi Integration**: Works seamlessly with Wagmi
- 💡 **TypeScript**: Full type safety
- 🚀 **Simple API**: Clean and intuitive interface

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ @x402x/react │  │ @x402x/fetch │  │   Native     │      │
│  │    Hooks     │─▶│    Wrapper   │─▶│    Fetch     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                           │                                  │
│                           │ Uses                             │
│                           ▼                                  │
│                    ┌──────────────┐                          │
│                    │ @x402x/core  │                          │
│                    │  Utilities   │                          │
│                    └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                             │ X-PAYMENT header
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Resource Server                           │
│  ┌────────────────────┐         ┌────────────────────┐      │
│  │  @x402x/express    │   OR    │   @x402x/hono      │      │
│  │    Middleware      │         │    Middleware      │      │
│  └────────────────────┘         └────────────────────┘      │
│           │                              │                   │
│           │ Uses                         │ Uses              │
│           ▼                              ▼                   │
│                    ┌──────────────┐                          │
│                    │ @x402x/core  │                          │
│                    │  Utilities   │                          │
│                    └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
                             │ Payment request
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                       Facilitator                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              @x402x/core Utilities                   │   │
│  │  • isSettlementMode                                  │   │
│  │  • settleWithRouter                                  │   │
│  │  • validateSettlementRouter                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │  Blockchain  │
                      │ (Contracts)  │
                      └──────────────┘
```

## Package Split Rationale

Following the official x402 library design, we split functionality into separate packages:

1. **Separation of Concerns**: Server middleware, client fetch, and React hooks have different dependencies
2. **Bundle Size**: Users only install what they need (e.g., React apps don't need Express)
3. **Peer Dependencies**: Express and Hono are optional peer dependencies
4. **Flexible Deployment**: Edge runtimes can use @x402x/hono without Node.js dependencies
5. **Maintainability**: Clear boundaries make the codebase easier to maintain

## Development

### Install Dependencies

From the **project root**:

```bash
pnpm install
```

### Build All Packages

From the **project root**:

```bash
# Build all packages (including x402 and SDK)
pnpm run build

# Or build SDK only
pnpm run build:sdk
```

### Build Individual Package

```bash
# From project root
pnpm --filter @x402x/core run build
pnpm --filter @x402x/fetch run build

# Or from package directory
cd typescript/packages/core
pnpm run build
```

## Documentation

- **Core**: [packages/core/README.md](./packages/core/README.md)
- **Fetch**: [packages/fetch/README.md](./packages/fetch/README.md)
- **Express**: [packages/express/README.md](./packages/express/README.md)
- **Hono**: [packages/hono/README.md](./packages/hono/README.md)
- **React**: [packages/react/README.md](./packages/react/README.md)

## Examples

See the main repository examples:
- **Facilitator**: `../../examples/facilitator/`
- **Showcase**: `../../examples/showcase/`

## Contributing

Please read [CONTRIBUTING.md](../../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

Apache-2.0
