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
import { parseDefaultAssetAmount } from "@x402x/extensions";

const atomicAmount = parseDefaultAssetAmount("1", network); // '1000000'
const client = new x402xClient({ wallet, network, facilitatorUrl });
const result = await client.execute({
  hook: TransferHook.address,
  amount: atomicAmount, // Must be atomic units
  payTo: "0x...",
});
```

**98% less code. 100% type-safe. Production-ready.**

---

## Quick Start

### Installation

```bash
npm install @x402x/client @x402x/extensions
# or
pnpm add @x402x/client @x402x/extensions
# or
yarn add @x402x/client @x402x/extensions
```

### Basic Usage (React + wagmi)

```typescript
import { x402xClient } from '@x402x/client';
import { TransferHook, parseDefaultAssetAmount } from '@x402x/extensions';
import { useWalletClient } from 'wagmi';
import { publicActions } from 'viem';

function PayButton() {
  const { data: wallet } = useWalletClient();

  const handlePay = async () => {
    // Extend wallet with public actions (required for transaction confirmation)
    const extendedWallet = wallet.extend(publicActions);

    // Uses default facilitator at https://facilitator.x402x.dev/
    // CAIP-2 network identifiers: https://chainlist.org/?testnets=true
    const client = new x402xClient({
      wallet: extendedWallet,
      network: 'eip155:84532' // Base Sepolia testnet
    });

    // Convert USD amount to atomic units
    const atomicAmount = parseDefaultAssetAmount('1', 'eip155:84532'); // '1000000'

    const result = await client.execute({
      hook: TransferHook.getAddress('eip155:84532'),
      hookData: TransferHook.encode(),
      amount: atomicAmount, // Must be atomic units
      payTo: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
    });

    console.log('Transaction:', result.txHash);
  };

  return <button onClick={handlePay}>Pay 1 USDC</button>;
}
```

> **Note**: The wallet client must be extended with `publicActions` from viem to support transaction confirmation via `waitForTransactionReceipt`. If you're using the React hooks (`useX402xClient`), this is done automatically.

---

## Amount Handling

The `amount` parameter in `client.execute()` and `prepareSettlement()` **must be in atomic units** (the smallest unit of the token). This follows the same pattern as viem's `parseEther()` and ethers' `parseEther()`.

### Converting USD Amounts to Atomic Units

Use `parseDefaultAssetAmount()` from `@x402x/extensions` to convert USD amounts:

```typescript
import { parseDefaultAssetAmount, formatDefaultAssetAmount } from "@x402x/extensions";

// Convert USD to atomic units
// CAIP-2 format: eip155:<chainId> (e.g., eip155:84532 = Base Sepolia)
const atomicAmount = parseDefaultAssetAmount("1", "eip155:84532"); // '1000000' (1 USDC)
const largeAmount = parseDefaultAssetAmount("100", "eip155:84532"); // '100000000' (100 USDC)

// Convert atomic units back to USD (for display)
const displayAmount = formatDefaultAssetAmount("1000000", "eip155:84532"); // '1'
```

### Why Atomic Units?

- **Consistency**: Matches viem/ethers standard practice
- **Precision**: Avoids floating-point precision issues
- **Clarity**: No ambiguity about what unit is expected
- **Safety**: Prevents double conversion bugs

### Example

```typescript
import { x402xClient } from "@x402x/client";
import { parseDefaultAssetAmount } from "@x402x/extensions";

// CAIP-2 network identifier for Base Sepolia testnet
const client = new x402xClient({ wallet, network: "eip155:84532" });

// ✅ Correct: Convert first, then pass atomic units
const atomicAmount = parseDefaultAssetAmount("5", "eip155:84532");
await client.execute({ amount: atomicAmount, payTo: "0x..." });

// ❌ Wrong: Don't pass USD amounts directly
await client.execute({ amount: "5", payTo: "0x..." }); // Will fail validation
```

---

## API Reference

### High-Level API (Recommended)

#### x402xClient

The main client class that handles the entire settlement flow.

```typescript
class x402xClient {
  constructor(config: x402xClientConfig);
  execute(params: ExecuteParams): Promise<ExecuteResult>;
  calculateFee(hook: Address, hookData?: Hex): Promise<FeeCalculationResult>;
  waitForTransaction(txHash: Hex): Promise<TransactionReceipt>;
}
```

**Example:**

```typescript
import { x402xClient } from "@x402x/client";

// Uses default facilitator at https://facilitator.x402x.dev/
// CAIP-2 network identifier: eip155:84532 (Base Sepolia testnet)
const client = new x402xClient({
  wallet: walletClient,
  network: "eip155:84532",
});

// Or specify custom facilitator
const client = new x402xClient({
  wallet: walletClient,
  network: "eip155:84532",
  facilitatorUrl: "https://custom-facilitator.example.com",
  timeout: 30000, // optional
  confirmationTimeout: 60000, // optional
});

// Convert USD amount to atomic units
import { parseDefaultAssetAmount } from "@x402x/extensions";
const atomicAmount = parseDefaultAssetAmount("1", "eip155:84532"); // '1000000'

const result = await client.execute({
  hook: "0x...",
  hookData: "0x...",
  amount: atomicAmount, // Must be atomic units
  payTo: "0x...",
  facilitatorFee: "10000", // optional, will query if not provided (also atomic units)
  customSalt: "0x...", // optional, will generate if not provided
});
```

#### React Hooks

##### useX402xClient

Automatically creates an x402xClient using wagmi's wallet connection.

```typescript
import { useX402xClient } from '@x402x/client';

function MyComponent() {
  // Uses default facilitator at https://facilitator.x402x.dev/
  const client = useX402xClient();

  // Or specify custom facilitator
  const client = useX402xClient({
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
import { parseDefaultAssetAmount } from '@x402x/extensions';

function PayButton() {
  // Uses default facilitator at https://facilitator.x402x.dev/
  const { execute, status, error, result } = useExecute();

  // Or specify custom facilitator
  const { execute, status, error, result } = useExecute({
    facilitatorUrl: 'https://custom-facilitator.example.com'
  });

  const handlePay = async () => {
    // Convert USD amount to atomic units
    // CAIP-2 format: eip155:84532 (Base Sepolia testnet)
    const atomicAmount = parseDefaultAssetAmount('1', 'eip155:84532'); // '1000000'

    await execute({
      hook: '0x...',
      amount: atomicAmount, // Must be atomic units
      payTo: '0x...'
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
- In @x402x/extensions: `verify()` function
- Use case: Check if payment is valid before committing resources

### settle

**Settle** (from x402 protocol) - Execute a payment on-chain by submitting it to the blockchain. This is the actual payment execution step.

- In x402 protocol: `POST /settle` endpoint
- In @x402x/extensions: `settle()` function
- In @x402x/client: `settle()` function (convenience wrapper)
- Use case: Submit signed payment for blockchain execution

### execute

**Execute** (high-level API) - Complete end-to-end payment flow including preparation, signing, settlement, and confirmation.

- In @x402x/client: `x402xClient.execute()` method
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
import { parseDefaultAssetAmount } from "@x402x/extensions";

// Convert USD amount to atomic units
// CAIP-2 network identifier: eip155:84532 (Base Sepolia testnet)
const atomicAmount = parseDefaultAssetAmount("1", "eip155:84532"); // '1000000'

const settlement = await prepareSettlement({
  wallet: walletClient,
  network: "eip155:84532",
  hook: "0x...",
  hookData: "0x...",
  amount: atomicAmount, // Must be atomic units
  payTo: "0x...",
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
import { x402xClient } from "@x402x/client";
import { TransferHook, parseDefaultAssetAmount } from "@x402x/extensions";

// Uses default facilitator at https://facilitator.x402x.dev/
// CAIP-2 network identifier: eip155:84532 (Base Sepolia testnet)
const client = new x402xClient({
  wallet: walletClient,
  network: "eip155:84532",
});

// Convert USD amount to atomic units
const atomicAmount = parseDefaultAssetAmount("1", "eip155:84532"); // '1000000'

const result = await client.execute({
  hook: TransferHook.getAddress("eip155:84532"),
  hookData: TransferHook.encode(), // Simple transfer mode
  amount: atomicAmount, // Must be atomic units
  payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
});

console.log("Transaction:", result.txHash);
```

### Example 2: Distributed Transfer (Payroll, Revenue Split)

TransferHook supports distributing funds to multiple recipients by percentage:

```typescript
import { x402xClient } from "@x402x/client";
import { TransferHook, parseDefaultAssetAmount, type Split } from "@x402x/extensions";

// CAIP-2 network identifier: eip155:84532 (Base Sepolia testnet)
const client = new x402xClient({
  wallet: walletClient,
  network: "eip155:84532",
});

// Payroll example: Pay 3 employees with different shares
const payrollAmount = parseDefaultAssetAmount("10", "eip155:84532"); // '10000000' (10 USDC)
const result = await client.execute({
  hook: TransferHook.getAddress("eip155:84532"),
  hookData: TransferHook.encode([
    { recipient: "0xEmployee1...", bips: 3000 }, // 30%
    { recipient: "0xEmployee2...", bips: 4000 }, // 40%
    { recipient: "0xEmployee3...", bips: 3000 }, // 30%
  ]),
  amount: payrollAmount, // Must be atomic units
  payTo: "0xCompany...", // Receives remainder (0% in this case)
});

// Revenue split example: Platform takes 30%, creator gets 70%
const revenueAmount = parseDefaultAssetAmount("100", "eip155:84532"); // '100000000' (100 USDC)
const result2 = await client.execute({
  hook: TransferHook.getAddress("eip155:84532"),
  hookData: TransferHook.encode([
    { recipient: "0xPlatform...", bips: 3000 }, // 30%
  ]),
  amount: revenueAmount, // Must be atomic units
  payTo: "0xCreator...", // Gets remaining 70% automatically
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
import { NFTMintHook, parseDefaultAssetAmount } from '@x402x/extensions';

function MintNFT() {
  // Uses default facilitator
  const { execute, status, error } = useExecute();

  const handleMint = async () => {
    // Convert USD amount to atomic units
    // CAIP-2 format: eip155:84532 (Base Sepolia testnet)
    const atomicAmount = parseDefaultAssetAmount('5', 'eip155:84532'); // '5000000'

    const result = await execute({
      hook: NFTMintHook.getAddress('eip155:84532'),
      hookData: NFTMintHook.encode({
        collection: '0x...',
        tokenId: 1
      }),
      amount: atomicAmount, // Must be atomic units
      payTo: '0x...'
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
import { calculateFacilitatorFee, TransferHook, parseDefaultAssetAmount } from "@x402x/extensions";

// 1. Query minimum fee
const hookData = TransferHook.encode([
  { recipient: "0xAlice...", bips: 6000 }, // 60% to Alice
  { recipient: "0xBob...", bips: 4000 }, // 40% to Bob
]);

// CAIP-2 network identifier: eip155:84532 (Base Sepolia testnet)
const feeEstimate = await calculateFacilitatorFee(
  "https://facilitator.x402x.dev",
  "eip155:84532",
  TransferHook.getAddress("eip155:84532"),
  hookData,
);

// 2. Convert USD amount to atomic units
const atomicAmount = parseDefaultAssetAmount("10", "eip155:84532"); // '10000000'

// 3. Prepare settlement
const settlement = await prepareSettlement({
  wallet: walletClient,
  network: "eip155:84532",
  hook: TransferHook.getAddress("eip155:84532"),
  hookData,
  amount: atomicAmount, // Must be atomic units
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
import { x402xClient } from "@x402x/client";
import { TransferHook, parseDefaultAssetAmount } from "@x402x/extensions";

export function usePayment() {
  const status = ref("idle");
  const error = ref(null);

  // Default to Base Sepolia testnet (CAIP-2 format)
  const pay = async (walletClient, usdAmount, recipient, network = "eip155:84532") => {
    status.value = "processing";
    error.value = null;

    try {
      const client = new x402xClient({
        wallet: walletClient,
        network,
        facilitatorUrl: import.meta.env.VITE_FACILITATOR_URL,
      });

      // Convert USD amount to atomic units
      const atomicAmount = parseDefaultAssetAmount(usdAmount, network);

      const result = await client.execute({
        hook: TransferHook.getAddress(network),
        hookData: TransferHook.encode(),
        amount: atomicAmount, // Must be atomic units
        payTo: recipient,
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
  x402xClientError,
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
  x402xClientConfig,
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

x402x uses CAIP-2 network identifiers (format: `eip155:<chainId>`):

### Mainnet
- **Base**: `eip155:8453`
- **X-Layer**: `eip155:196`
- **BSC**: `eip155:56`

### Testnet
- **Base Sepolia**: `eip155:84532`
- **X-Layer Testnet**: `eip155:1952`
- **BSC Testnet**: `eip155:97`

**Reference**: See [CAIP-2](https://chainlist.org/?testnets=true) for a complete list of chain IDs.

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
    // Old v1 format - deprecated
    pay("/api/transfer", "base-sepolia", { amount: "1000000" });
  };
}
```

### After

```typescript
// 10 lines with @x402x/client (no facilitatorUrl needed!)
import { useExecute } from "@x402x/client";
import { TransferHook, parseDefaultAssetAmount } from "@x402x/extensions";

function Component() {
  // Uses default facilitator automatically
  const { execute, status, error } = useExecute();

  const handlePay = async () => {
    // Convert USD amount to atomic units
    // CAIP-2 format: eip155:84532 (Base Sepolia testnet)
    const atomicAmount = parseDefaultAssetAmount("1", "eip155:84532"); // '1000000'

    await execute({
      hook: TransferHook.address,
      amount: atomicAmount, // Must be atomic units
      payTo: "0x...",
    });
  };
}
```

---

## Related Packages

- [@x402x/extensions](../extensions) - Core utilities and network configuration
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
