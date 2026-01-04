# @x402x TypeScript SDK

TypeScript SDK for the x402x settlement framework - a programmable payment settlement extension for the x402 protocol.

## Packages

This repository contains the following packages:

- **[@x402x/extensions](./packages/extensions)**: Protocol extensions for settlement (commitment calculation, networks, middleware)
- **[@x402x/client](./packages/client)**: Client SDK (React/wagmi hooks for browser wallets)
- **[@x402x/facilitator-sdk](./packages/facilitator-sdk)**: Utilities for facilitator implementations

## Quick Start

### For Resource Servers

Resource servers typically use the official `x402` packages for payment gates. See the [x402 documentation](https://github.com/x402/x402) for details.

### For Client Applications

#### Using @x402x/client (React + Wagmi)

```bash
npm install @x402x/client @x402x/extensions
```

```typescript
import { usePayment } from '@x402x/client';

function PaymentButton() {
  const { pay, status, error } = usePayment();

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

### For Facilitators

Facilitators use the facilitator-sdk for settlement utilities:

```bash
npm install @x402x/facilitator-sdk @x402x/extensions
```

```typescript
import { isSettlementMode, parseSettlementExtra } from '@x402x/extensions';
import { createRouterSettlementFacilitator } from '@x402x/facilitator-sdk';

// Create facilitator instance
const facilitator = createRouterSettlementFacilitator({
  allowedRouters: {
    'eip155:84532': ['0x...'], // Base Sepolia
  },
  rpcUrls: {
    'eip155:84532': 'https://sepolia.base.org',
  },
});

// Detect and execute settlement
if (isSettlementMode(paymentRequirements)) {
  const params = parseSettlementExtra(paymentRequirements.extra);
  const result = await facilitator.settle(paymentPayload, paymentRequirements);
  console.log('Settlement hash:', result.transaction);
}
```

## Features

### ✨ Core Extensions (@x402x/extensions)

- 🔐 **Commitment Calculation**: Cryptographically bind settlement parameters
- 🌐 **Network Support**: Pre-configured for multiple networks using CAIP-2 format
  - Base Sepolia: `eip155:84532`
  - Base Mainnet: `eip155:8453`
  - X-Layer Testnet: `eip155:1952`
  - X-Layer Mainnet: `eip155:196`
- 🛠️ **Utility Functions**: Helper functions for settlement mode detection and parameter parsing
- 📝 **Full TypeScript**: Complete type definitions

### 🔄 Facilitator SDK (@x402x/facilitator-sdk)

- 🏦 **Settlement Execution**: Router settlement facilitation with wallet client
- ✅ **Verification**: Payment verification for settlement mode
- 🌐 **Network Configuration**: Multi-network support with CAIP-2 identifiers
- 📝 **TypeScript**: Full type safety

### ⚛️ Client SDK (@x402x/client)

- 🪝 **React Hooks**: `usePayment` for easy integration
- 🔄 **State Management**: Automatic status and error tracking
- 🎯 **Wagmi Integration**: Works seamlessly with Wagmi
- 💡 **TypeScript**: Full type safety
- 🚀 **Commitment-based Security**: Automatic commitment calculation for settlement mode

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client                               │
│  ┌──────────────┐                                          │
│  │ @x402x/client│  React Hooks + Wallet Integration         │
│  │              │──────────────┐                            │
│  └──────────────┘              │                            │
│                                 │ Uses                       │
│                                 ▼                            │
│                    ┌──────────────────────┐                 │
│                    │ @x402x/extensions    │                 │
│                    │  • calculateCommitment                 │
│                    │  • isSettlementMode   │                 │
│                    │  • parseSettlementExtra                │
│                    └──────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
                             │ X-PAYMENT header
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Resource Server                           │
│                                                             │
│  Uses official x402 packages for payment gates              │
│  (See https://github.com/x402/x402)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                             │ Payment request
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                       Facilitator                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          @x402x/facilitator-sdk                      │   │
│  │  • createRouterSettlementFacilitator                 │   │
│  │  • executeSettlementWithWalletClient                 │   │
│  │  • parseSettlementRouterParams                       │   │
│  └──────────────────────────────────────────────────────┘   │
│           │                                                  │
│           │ Uses                                             │
│           ▼                                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          @x402x/extensions                            │   │
│  │  • isSettlementMode                                   │   │
│  │  • parseSettlementExtra                               │   │
│  │  • getNetworkConfig                                   │   │
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

1. **Separation of Concerns**: Client, facilitator, and extensions have different use cases
2. **Bundle Size**: Users only install what they need
3. **Peer Dependencies**: Clear dependency management
4. **Flexible Deployment**: Different environments can use only what they need
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
# Build all packages
pnpm run build:sdk
```

### Build Individual Package

```bash
# From project root
pnpm --filter @x402x/extensions run build
pnpm --filter @x402x/client run build
pnpm --filter @x402x/facilitator-sdk run build

# Or from package directory
cd typescript/packages/extensions
pnpm run build
```

## Documentation

- **Extensions**: [packages/extensions/README.md](./packages/extensions/README.md)
- **Client**: [packages/client/README.md](./packages/client/README.md)
- **Facilitator SDK**: [packages/facilitator-sdk/README.md](./packages/facilitator-sdk/README.md)

## Examples

See the main repository examples:
- **Facilitator**: `../../facilitator/`
- **Showcase**: `../../examples/showcase/`

## Contributing

Please read [CONTRIBUTING.md](../../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

Apache-2.0
