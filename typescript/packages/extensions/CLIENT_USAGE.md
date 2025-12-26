# x402x Client Extension - Usage Guide

This document demonstrates how to use the x402x client extension with the official x402 SDK.

## Overview

The x402x extension provides router settlement support for the x402 protocol, enabling atomic fee distribution and hook-based business logic execution.

Two layers of API are provided:
- **High-level API** (recommended): `registerX402xScheme()` - one-line setup
- **Low-level API** (advanced): `injectX402xExtensionHandler()` + manual scheme registration

## Quick Start

### 1. Install Dependencies

```bash
pnpm add @x402x/extensions @x402/core @x402/fetch viem
```

### 2. Simple Integration (Recommended)

Use the high-level API for the simplest integration:

```typescript
import { x402Client } from '@x402/core/client';
import { wrapFetchWithPayment } from '@x402/fetch';
import { registerX402xScheme } from '@x402x/extensions';
import { useWalletClient } from 'wagmi';

// Get wallet client from wagmi
const { data: walletClient } = useWalletClient();

// Create signer
const signer = {
  address: walletClient.account.address,
  signTypedData: walletClient.signTypedData,
};

// One-line setup for x402x! 🎉
const client = new x402Client();
registerX402xScheme(client, 'eip155:84532', signer);

// Wrap fetch with automatic payment handling
const fetchWithPay = wrapFetchWithPayment(fetch, client);

// Make requests - x402x payments work automatically!
const response = await fetchWithPay('https://api.example.com/premium', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contentId: 'whitepaper' })
});

const data = await response.json();
console.log('Content received:', data);
```

### 3. Multiple Networks

Register x402x for multiple networks:

```typescript
const client = new x402Client();
registerX402xScheme(client, 'eip155:84532', signer); // Base Sepolia
registerX402xScheme(client, 'eip155:8453', signer);  // Base Mainnet
```

## API Comparison

| API | Code Lines | Use Case |
|-----|-----------|----------|
| `registerX402xScheme()` | 2 lines | Recommended for most users |
| Low-level API | 3-5 lines | Advanced use cases, custom configuration |

## Advanced Usage (Low-Level API)

For advanced users who need more control:

```typescript
import { 
  injectX402xExtensionHandler, 
  ExactEvmSchemeWithRouterSettlement 
} from '@x402x/extensions';
import { x402Client } from '@x402/core/client';

const client = new x402Client();

// Step 1: Inject extension handler
injectX402xExtensionHandler(client);

// Step 2: Manually register scheme
client.register('eip155:84532', new ExactEvmSchemeWithRouterSettlement(signer));

// Now ready for x402x payments
```

This gives you full control over scheme instantiation and configuration.

## React Hook Example

```typescript
import { useState } from 'react';
import { useWalletClient } from 'wagmi';
import { x402Client } from '@x402/core/client';
import { wrapFetchWithPayment } from '@x402/fetch';
import { registerX402xScheme } from '@x402x/extensions';

export function usePaidApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: walletClient } = useWalletClient();

  const callPaidEndpoint = async (url: string, body: any) => {
    if (!walletClient) {
      throw new Error('Wallet not connected');
    }

    setLoading(true);
    setError(null);

    try {
      const signer = {
        address: walletClient.account.address,
        signTypedData: walletClient.signTypedData,
      };

      // Setup x402x client
      const client = new x402Client();
      registerX402xScheme(
        client, 
        `eip155:${walletClient.chain.id}`,
        signer
      );

      // Wrap fetch with automatic payment handling
      const fetchWithPay = wrapFetchWithPayment(fetch, client);

      // Make the request
      const response = await fetchWithPay(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      return await response.json();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { callPaidEndpoint, loading, error };
}
```

## How It Works

### Commitment-Based Security

The x402x extension uses a commitment hash as the EIP-3009 nonce to cryptographically bind all settlement parameters:

```typescript
// Standard EVM scheme (random nonce)
const nonce = createNonce(); // Random value

// x402x scheme (commitment hash)
const nonce = calculateCommitment({
  chainId, hub, asset, from, value,
  validAfter, validBefore, salt,
  payTo, facilitatorFee, hook, hookData
}); // Hash of all parameters
```

This ensures that:
- Settlement parameters cannot be tampered with
- Each payment authorization is unique
- The facilitator can verify parameter integrity

### Extension Data Flow

```
1. Server declares x402x support in PaymentRequired.extensions (root level)
2. Client automatically copies extensions to PaymentRequirements.extra
   (handled by registerX402xScheme or injectX402xExtensionHandler)
3. Scheme reads from PaymentRequirements.extra to create payment payload
4. Client echoes extensions in PaymentPayload (root level)
5. Facilitator processes extension for settlement
```

### Extension Info Structure

The x402x extension adds settlement information to the PaymentRequired response:

```json
{
  "x402Version": 2,
  "resource": { "url": "...", "description": "...", "mimeType": "..." },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:84532",
    "asset": "0x...",
    "amount": "100000",
    "payTo": "0x...",
    "maxTimeoutSeconds": 300,
    "extra": {
      "name": "USD Coin",
      "version": "2"
    }
  }],
  "extensions": {
    "x402x-router-settlement": {
      "info": {
        "schemaVersion": 1,
        "salt": "0x...",
        "settlementRouter": "0x...",
        "hook": "0x...",
        "hookData": "0x",
        "finalPayTo": "0x...",
        "facilitatorFee": "1000"
      }
    }
  }
}
```

The scheme extracts these parameters and uses them to:
1. Calculate the commitment hash
2. Sign with `settlementRouter` as the `to` address
3. Include all parameters in the payment authorization

## Server Setup

To use this client, your resource server must register the x402x extension:

```typescript
import { Hono } from 'hono';
import { paymentMiddleware, x402ResourceServer } from '@x402/hono';
import { registerExactEvmScheme } from '@x402/evm/exact/server';
import { registerRouterSettlement, createSettlementRouteConfig } from '@x402x/extensions';

const server = new x402ResourceServer(facilitatorClient);
registerExactEvmScheme(server, {});
registerRouterSettlement(server); // Register x402x extension

const routes = {
  'POST /api/premium': createSettlementRouteConfig(
    {
      accepts: {
        scheme: 'exact',
        network: 'eip155:84532',
        payTo: merchantAddress,
        price: '$0.10'
      }
    },
    {
      hook: TransferHook.getAddress('base-sepolia'),
      hookData: TransferHook.encode(),
      finalPayTo: merchantAddress,
      facilitatorFee: '0'
    }
  )
};

app.use('/api/premium', paymentMiddleware(routes, server));
```

## CORS Configuration (Important!)

Make sure your server exposes x402 headers for CORS requests:

```typescript
import { cors } from 'hono/cors';

app.use('/*', cors({
  origin: '*',
  credentials: false,
  exposeHeaders: [
    'PAYMENT-REQUIRED',   // v2: Payment requirements
    'PAYMENT-RESPONSE',   // v2: Settlement confirmation
  ],
}));
```

## Key Points

✅ **Use `registerX402xScheme()` for simplest integration** - one line of code  
✅ **Automatic extension handling** - no manual hook implementation needed  
✅ **Works with official x402 SDK** - fully compatible with `@x402/fetch`  
✅ **Type-safe** - full TypeScript support  
✅ **Server CORS** - remember to expose `PAYMENT-REQUIRED` header  

## See Also

- [Extension Handler API](../src/client/extension-handler.ts)
- [ExactEvmSchemeWithRouterSettlement Implementation](../src/client/exact-evm-scheme.ts)
- [usePaymentV2 Hook Example](../../examples/showcase/client/src/hooks/usePaymentV2.ts)
- [Server Setup Example](../../examples/showcase/server/src/index.ts)
