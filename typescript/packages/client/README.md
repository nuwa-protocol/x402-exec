# @x402x/client

> **Client SDK for x402x Serverless Mode** - Execute on-chain contracts directly via facilitator without needing a resource server.

[![npm version](https://img.shields.io/npm/v/@x402x/client.svg)](https://www.npmjs.com/package/@x402x/client)
[![License](https://img.shields.io/npm/l/@x402x/client.svg)](https://github.com/nuwa-protocol/x402-exec/blob/main/LICENSE)

## What is x402x Serverless Mode?

x402x extends the [x402 protocol](https://github.com/coinbase/x402) with two integration modes:

### 🏢 Server Mode (Traditional x402)

```
Client → Resource Server → Facilitator → Blockchain
```

- Requires deploying and maintaining a backend server
- Suitable for complex business logic (dynamic pricing, inventory management)

### ⚡ Serverless Mode (x402x - This SDK)

```
Client → Facilitator → Smart Contract (Hook)
```

- **Zero servers** - No backend needed
- **Zero runtime** - Business logic in smart contracts (Hooks)
- **Zero complexity** - 3 lines of code to integrate
- **Permissionless** - Facilitators are completely trustless

## Why Use This SDK?

### Before (Manual Implementation)

200+ lines of boilerplate code to:

- Handle 402 responses
- Calculate commitment hashes
- Sign EIP-3009 authorizations
- Encode payment payloads
- Call facilitator APIs

### After (@x402x/client)

```typescript
const client = new X402Client({ wallet, network, facilitatorUrl });
const result = await client.execute({
  hook: TransferHook.address,
  amount: "1000000",
  recipient: "0x...",
});
```

**98% less code. 100% type-safe. Production-ready.**

---

## Quick Start

### Installation

```bash
npm install @x402x/client @x402x/core
# or
pnpm add @x402x/client @x402x/core
# or
yarn add @x402x/client @x402x/core
```

### Basic Usage (React + wagmi)

```typescript
import { X402Client } from '@x402x/client';
import { TransferHook } from '@x402x/core';
import { useWalletClient } from 'wagmi';
import { publicActions } from 'viem';

function PayButton() {
  const { data: wallet } = useWalletClient();

  const handlePay = async () => {
    // Extend wallet with public actions (required for transaction confirmation)
    const extendedWallet = wallet.extend(publicActions);

    // Uses default facilitator at https://facilitator.x402x.dev/
    const client = new X402Client({
      wallet: extendedWallet,
      network: 'base-sepolia'
    });

    const result = await client.execute({
      hook: TransferHook.getAddress('base-sepolia'),
      hookData: TransferHook.encode(),
      amount: '1000000', // 1 USDC
      recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
    });

    console.log('Transaction:', result.txHash);
  };

  return <button onClick={handlePay}>Pay 1 USDC</button>;
}
```

> **Note**: The wallet client must be extended with `publicActions` from viem to support transaction confirmation via `waitForTransactionReceipt`. If you're using the React hooks (`useX402Client`), this is done automatically.

---

## API Reference

### High-Level API (Recommended)

#### X402Client

The main client class that handles the entire settlement flow.

```typescript
class X402Client {
  constructor(config: X402ClientConfig);
  execute(params: ExecuteParams): Promise<ExecuteResult>;
  calculateFee(hook: Address, hookData?: Hex): Promise<FeeCalculationResult>;
  waitForTransaction(txHash: Hex): Promise<TransactionReceipt>;
}
```

**Example:**

```typescript
import { X402Client } from "@x402x/client";

// Uses default facilitator at https://facilitator.x402x.dev/
const client = new X402Client({
  wallet: walletClient,
  network: "base-sepolia",
});

// Or specify custom facilitator
const client = new X402Client({
  wallet: walletClient,
  network: "base-sepolia",
  facilitatorUrl: "https://custom-facilitator.example.com",
  timeout: 30000, // optional
  confirmationTimeout: 60000, // optional
});

const result = await client.execute({
  hook: "0x...",
  hookData: "0x...",
  amount: "1000000",
  recipient: "0x...",
  facilitatorFee: "10000", // optional, will query if not provided
  customSalt: "0x...", // optional, will generate if not provided
});
```

#### React Hooks

##### useX402Client

Automatically creates an X402Client using wagmi's wallet connection.

```typescript
import { useX402Client } from '@x402x/client';

function MyComponent() {
  // Uses default facilitator at https://facilitator.x402x.dev/
  const client = useX402Client();

  // Or specify custom facilitator
  const client = useX402Client({
    facilitatorUrl: 'https://custom-facilitator.example.com'
  });

  if (!client) {
    return <div>Please connect your wallet</div>;
  }

  // Use client...
}
```

##### useExecute

Provides automatic state management for settlements.

```typescript
import { useExecute } from '@x402x/client';

function PayButton() {
  // Uses default facilitator at https://facilitator.x402x.dev/
  const { execute, status, error, result } = useExecute();

  // Or specify custom facilitator
  const { execute, status, error, result } = useExecute({
    facilitatorUrl: 'https://custom-facilitator.example.com'
  });

  const handlePay = async () => {
    await execute({
      hook: '0x...',
      amount: '1000000',
      recipient: '0x...'
    });
  };

  return (
    <div>
      <button onClick={handlePay} disabled={status !== 'idle'}>
        {status === 'idle' ? 'Pay' : 'Processing...'}
      </button>
      {status === 'success' && <div>✅ TX: {result.txHash}</div>}
      {status === 'error' && <div>❌ {error.message}</div>}
    </div>
  );
}
```

---

## Terminology

Understanding the x402 protocol terminology used in this SDK:

### verify

**Verify** (from x402 protocol) - Validate a payment payload without executing it on-chain. This is useful for pre-validation before actual settlement.

- In x402 protocol: `POST /verify` endpoint
- In @x402x/core: `verify()` function
- Use case: Check if payment is valid before committing resources

### settle

**Settle** (from x402 protocol) - Execute a payment on-chain by submitting it to the blockchain. This is the actual payment execution step.

- In x402 protocol: `POST /settle` endpoint
- In @x402x/core: `settle()` function
- In @x402x/client: `settle()` function (convenience wrapper)
- Use case: Submit signed payment for blockchain execution

### execute

**Execute** (high-level API) - Complete end-to-end payment flow including preparation, signing, settlement, and confirmation.

- In @x402x/client: `X402Client.execute()` method
- Flow: `prepare → sign → settle → wait for confirmation`
- Use case: One-line payment execution for most developers

### API Hierarchy

```
High-Level (Recommended for most developers):
  └─ execute() - Complete flow

Low-Level (Advanced use cases):
  ├─ prepareSettlement() - Prepare data
  ├─ signAuthorization() - Sign with wallet
  └─ settle() - Submit to facilitator

Core Protocol (x402 standard):
  ├─ verify() - Validate payment
  └─ settle() - Execute payment
```

---

### Low-Level API (Advanced)

For users who need full control over the settlement flow.

#### prepareSettlement

Prepares settlement data for signing.

```typescript
import { prepareSettlement } from "@x402x/client";

const settlement = await prepareSettlement({
  wallet: walletClient,
  network: "base-sepolia",
  hook: "0x...",
  hookData: "0x...",
  amount: "1000000",
  recipient: "0x...",
  facilitatorUrl: "https://facilitator.x402x.dev", // Optional: uses default if not provided
});
```

#### signAuthorization

Signs EIP-3009 authorization.

```typescript
import { signAuthorization } from "@x402x/client";

const signed = await signAuthorization(walletClient, settlement);
```

#### settle

Submits signed authorization to facilitator.

```typescript
import { settle } from "@x402x/client";

const result = await settle("https://facilitator.x402x.dev", signed);
```

---

## Examples

### Example 1: Simple Payment

```typescript
import { X402Client } from "@x402x/client";
import { TransferHook } from "@x402x/core";

// Uses default facilitator at https://facilitator.x402x.dev/
const client = new X402Client({
  wallet: walletClient,
  network: "base-sepolia",
});

const result = await client.execute({
  hook: TransferHook.getAddress("base-sepolia"),
  hookData: TransferHook.encode(), // Simple transfer mode
  amount: "1000000", // 1 USDC
  recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
});

console.log("Transaction:", result.txHash);
```

### Example 2: Distributed Transfer (Payroll, Revenue Split)

TransferHook supports distributing funds to multiple recipients by percentage:

```typescript
import { X402Client } from "@x402x/client";
import { TransferHook, type Split } from "@x402x/core";

const client = new X402Client({
  wallet: walletClient,
  network: "base-sepolia",
});

// Payroll example: Pay 3 employees with different shares
const result = await client.execute({
  hook: TransferHook.getAddress("base-sepolia"),
  hookData: TransferHook.encode([
    { recipient: "0xEmployee1...", bips: 3000 }, // 30%
    { recipient: "0xEmployee2...", bips: 4000 }, // 40%
    { recipient: "0xEmployee3...", bips: 3000 }, // 30%
  ]),
  amount: "10000000", // 10000 USDC total
  recipient: "0xCompany...", // Receives remainder (0% in this case)
});

// Revenue split example: Platform takes 30%, creator gets 70%
const result2 = await client.execute({
  hook: TransferHook.getAddress("base-sepolia"),
  hookData: TransferHook.encode([
    { recipient: "0xPlatform...", bips: 3000 }, // 30%
  ]),
  amount: "100000000", // 100 USDC
  recipient: "0xCreator...", // Gets remaining 70% automatically
});

console.log("Distributed transfer:", result.txHash);
```

**Split Rules:**

- `bips` = basis points (1-10000, where 10000 = 100%)
- Total bips must be ≤ 10000
- If total < 10000, remainder goes to `recipient` parameter
- If total = 10000, `recipient` gets 0

### Example 3: NFT Minting (React)

```typescript
import { useExecute } from '@x402x/client';
import { NFTMintHook } from '@x402x/core';

function MintNFT() {
  // Uses default facilitator
  const { execute, status, error } = useExecute();

  const handleMint = async () => {
    const result = await execute({
      hook: NFTMintHook.getAddress('base-sepolia'),
      hookData: NFTMintHook.encode({
        collection: '0x...',
        tokenId: 1
      }),
      amount: '5000000', // 5 USDC
      recipient: '0x...'
    });

    alert(`NFT Minted! TX: ${result.txHash}`);
  };

  return (
    <button onClick={handleMint} disabled={status !== 'idle'}>
      {status === 'idle' ? 'Mint NFT for 5 USDC' : 'Processing...'}
    </button>
  );
}
```

### Example 4: Revenue Split (Low-Level API)

```typescript
import { prepareSettlement, signAuthorization, settle } from "@x402x/client";
import { calculateFacilitatorFee, TransferHook } from "@x402x/core";

// 1. Query minimum fee
const hookData = TransferHook.encode([
  { recipient: "0xAlice...", bips: 6000 }, // 60% to Alice
  { recipient: "0xBob...", bips: 4000 },   // 40% to Bob
]);

const feeEstimate = await calculateFacilitatorFee(
  "https://facilitator.x402x.dev",
  "base-sepolia",
  TransferHook.getAddress("base-sepolia"),
  hookData,
);

// 2. Prepare settlement
const settlement = await prepareSettlement({
  wallet: walletClient,
  network: "base-sepolia",
  hook: TransferHook.getAddress("base-sepolia"),
  hookData,
  amount: "10000000", // 10 USDC
  payTo: "0xCharity...", // Receives 0% (full split)
  facilitatorFee: feeEstimate.facilitatorFee,
});

// 3. Sign authorization
const signed = await signAuthorization(walletClient, settlement);

// 4. Submit to facilitator
const result = await settle("https://facilitator.x402x.dev", signed);

console.log("Transaction:", result.transaction);
```

### Example 5: Vue 3 Integration

```typescript
import { ref } from "vue";
import { X402Client } from "@x402x/client";
import { TransferHook } from "@x402x/core";

export function usePayment() {
  const status = ref("idle");
  const error = ref(null);

  const pay = async (walletClient, amount, recipient) => {
    status.value = "processing";
    error.value = null;

    try {
      const client = new X402Client({
        wallet: walletClient,
        network: "base-sepolia",
        facilitatorUrl: import.meta.env.VITE_FACILITATOR_URL,
      });

      const result = await client.execute({
        hook: TransferHook.getAddress("base-sepolia"),
        hookData: TransferHook.encode(),
        amount,
        recipient,
      });

      status.value = "success";
      return result;
    } catch (err) {
      error.value = err;
      status.value = "error";
      throw err;
    }
  };

  return { status, error, pay };
}
```

---

## Error Handling

The SDK provides typed error classes for better error handling:

```typescript
import {
  X402ClientError,
  NetworkError,
  SigningError,
  FacilitatorError,
  TransactionError,
  ValidationError,
} from "@x402x/client";

try {
  await client.execute(params);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error("Invalid parameters:", error.message);
  } else if (error instanceof SigningError) {
    if (error.code === "USER_REJECTED") {
      console.log("User rejected signing");
    }
  } else if (error instanceof FacilitatorError) {
    console.error("Facilitator error:", error.statusCode, error.response);
  } else if (error instanceof TransactionError) {
    console.error("Transaction failed:", error.txHash);
  }
}
```

---

## TypeScript Support

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  X402ClientConfig,
  ExecuteParams,
  ExecuteResult,
  SettlementData,
  SignedAuthorization,
  FeeCalculationResult,
  ExecuteStatus,
} from "@x402x/client";
```

---

## Supported Networks

- Base Sepolia (testnet): `base-sepolia`
- Base (mainnet): `base`
- X-Layer (mainnet): `x-layer`
- X-Layer Testnet: `x-layer-testnet`

---

## Requirements

- Node.js 18+
- React 18+ (for hooks)
- wagmi 2+ (for wallet connection)
- viem 2+ (for Ethereum interactions)

---

## Migration from Manual Implementation

### Before

```typescript
// 200+ lines of manual implementation
import { usePayment } from "./hooks/usePayment";

function Component() {
  const { pay, status, error } = usePayment();

  const handlePay = () => {
    pay("/api/transfer", "base-sepolia", { amount: "1000000" });
  };
}
```

### After

```typescript
// 10 lines with @x402x/client (no facilitatorUrl needed!)
import { useExecute } from "@x402x/client";
import { TransferHook } from "@x402x/core";

function Component() {
  // Uses default facilitator automatically
  const { execute, status, error } = useExecute();

  const handlePay = async () => {
    await execute({
      hook: TransferHook.address,
      amount: "1000000",
      recipient: "0x...",
    });
  };
}
```

---

## Related Packages

- [@x402x/core](../core) - Core utilities and commitment calculation
- [@x402x/facilitator](../../facilitator) - Facilitator server implementation
- [x402](https://github.com/coinbase/x402) - Base x402 protocol

---

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup and contribution guidelines.

---

## License

Apache-2.0 - see [LICENSE](../../LICENSE) for details.

---

## Support

- [Documentation](https://x402x.dev/)
- [GitHub Issues](https://github.com/nuwa-protocol/x402-exec/issues)
- [Discord Community](https://discord.gg/nuwa-protocol)

---

**Built with ❤️ by [Nuwa Protocol](https://github.com/nuwa-protocol)**
