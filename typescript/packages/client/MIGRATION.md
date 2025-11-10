# Migration Guide: Using @x402x/client

This guide shows how to migrate from the manual usePayment implementation to the new `@x402x/client` SDK.

## Before (Manual Implementation - 448 lines)

The original `usePayment.ts` hook was 448 lines of complex manual implementation handling:

- 402 response parsing
- Commitment calculation
- EIP-3009 signing
- Payment payload encoding
- Network switching
- Error handling

```typescript
// examples/showcase/client/src/hooks/usePayment.ts
const { pay, status, error } = usePayment();

await pay("/api/transfer", "base-sepolia", {
  amount: "1000000",
  recipient: "0x...",
});
```

## After (Using @x402x/client - 15 lines)

### Option 1: Using React Hooks (Recommended)

```typescript
import { useExecute } from '@x402x/client';
import { TransferHook } from '@x402x/core';

function PaymentComponent() {
  const { execute, status, error, result } = useExecute({
    facilitatorUrl: 'https://facilitator.x402.io'
  });

  const handlePay = async () => {
    try {
      const result = await execute({
        hook: TransferHook.getAddress('base-sepolia'),
        hookData: TransferHook.encode(),
        amount: '1000000',
        recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
      });

      console.log('Success:', result.txHash);
    } catch (err) {
      console.error('Failed:', err);
    }
  };

  return (
    <div>
      <button onClick={handlePay} disabled={status !== 'idle'}>
        {status === 'idle' ? 'Pay 1 USDC' : 'Processing...'}
      </button>
      {status === 'success' && <div>✅ TX: {result.txHash}</div>}
      {status === 'error' && <div>❌ {error.message}</div>}
    </div>
  );
}
```

### Option 2: Using X402Client Directly

```typescript
import { X402Client } from '@x402x/client';
import { TransferHook } from '@x402x/core';
import { useWalletClient } from 'wagmi';

function PaymentComponent() {
  const { data: wallet } = useWalletClient();

  const handlePay = async () => {
    const client = new X402Client({
      wallet,
      network: 'base-sepolia',
      facilitatorUrl: 'https://facilitator.x402.io'
    });

    const result = await client.execute({
      hook: TransferHook.getAddress('base-sepolia'),
      hookData: TransferHook.encode(),
      amount: '1000000',
      recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1'
    });

    console.log('Transaction:', result.txHash);
  };

  return <button onClick={handlePay}>Pay 1 USDC</button>;
}
```

## Key Benefits

1. **98% Less Code**: From 448 lines to ~15 lines
2. **Type Safety**: Full TypeScript support with intelligent autocompletion
3. **Error Handling**: Proper error types (SigningError, FacilitatorError, etc.)
4. **No Manual Commitment Calculation**: Handled automatically
5. **No Manual Signing**: Handled automatically
6. **No Manual Network Switching**: Detected automatically
7. **Production Ready**: Tested and optimized

## Installation

```bash
pnpm add @x402x/client @x402x/core
```

## Environment Setup

No need for complex facilitator configuration in the client. Just provide the URL:

```typescript
const { execute } = useExecute({
  facilitatorUrl: process.env.VITE_FACILITATOR_URL,
});
```

## Error Handling

```typescript
import { SigningError, FacilitatorError, TransactionError } from "@x402x/client";

try {
  await execute(params);
} catch (error) {
  if (error instanceof SigningError) {
    console.log("User rejected signing");
  } else if (error instanceof FacilitatorError) {
    console.error("Facilitator error:", error.statusCode);
  } else if (error instanceof TransactionError) {
    console.error("Transaction failed:", error.txHash);
  }
}
```

## More Examples

See the [README](../README.md) for complete API documentation and more examples including:

- NFT Minting
- Revenue Splitting
- Custom Hooks
- Vue 3 Integration
- Low-level API usage
