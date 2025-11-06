# @x402x/fetch

Fetch wrapper for x402x settlement framework - automatically handles 402 Payment Required responses with settlement mode support.

## Installation

```bash
npm install @x402x/fetch @x402x/core
```

## Features

- 🔄 Automatic 402 response handling
- 🔐 Commitment-based nonce for settlement mode
- 🎯 Falls back to standard x402 for non-settlement payments
- 💰 Configurable maximum payment amount
- 🚀 Zero configuration for basic usage

## Quick Start

```typescript
import { x402xFetch } from "@x402x/fetch";
import { createWalletClient, custom } from "viem";

// Create wallet client (using wagmi, viem, etc.)
const walletClient = createWalletClient({
  account,
  transport: custom(window.ethereum),
});

// Wrap fetch with payment support
const fetchWithPay = x402xFetch(fetch, walletClient);

// Make requests - 402 responses are handled automatically
const response = await fetchWithPay("/api/premium-content");
const data = await response.json();
```

## API Reference

### `x402xFetch(fetch, walletClient, maxValue?)`

Wraps the native fetch API to automatically handle 402 Payment Required responses.

#### Parameters

- **`fetch`**: The fetch function to wrap (typically `globalThis.fetch`)
- **`walletClient`**: The wallet client used to sign payments (viem WalletClient or similar)
- **`maxValue`** (optional): Maximum allowed payment amount in base units (default: `0.1 USDC = 10^5`)

#### Returns

A wrapped fetch function with the same signature as the native `fetch`.

#### Example

```typescript
// Basic usage
const fetchWithPay = x402xFetch(fetch, walletClient);

// With custom max value (1 USDC)
const fetchWithPay = x402xFetch(fetch, walletClient, BigInt(1 * 10 ** 6));
```

## How It Works

1. **Initial Request**: Makes the original fetch request
2. **402 Detection**: If response is 402, extracts payment requirements
3. **Mode Detection**: Checks if settlement mode is needed (`extra.settlementRouter`)
4. **Payment Creation**:
   - Settlement mode: Uses commitment-based nonce
   - Standard mode: Falls back to standard x402
5. **Retry**: Adds `X-PAYMENT` header and retries the request

## Examples

### With Wagmi

```typescript
import { x402xFetch } from '@x402x/fetch';
import { useWalletClient } from 'wagmi';

function MyComponent() {
  const { data: walletClient } = useWalletClient();

  const fetchData = async () => {
    if (!walletClient) return;

    const fetchWithPay = x402xFetch(fetch, walletClient);
    const response = await fetchWithPay('/api/protected-data');
    const data = await response.json();
    console.log(data);
  };

  return <button onClick={fetchData}>Fetch Paid Content</button>;
}
```

### With Error Handling

```typescript
import { x402xFetch } from "@x402x/fetch";

async function fetchPaidContent(walletClient) {
  const fetchWithPay = x402xFetch(fetch, walletClient);

  try {
    const response = await fetchWithPay("/api/content");

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.message.includes("exceeds maximum allowed")) {
      console.error("Payment amount too high");
    } else if (error.message.includes("Payment already attempted")) {
      console.error("Retry loop detected");
    } else {
      console.error("Payment failed:", error);
    }
    throw error;
  }
}
```

### Multiple Requests

```typescript
import { x402xFetch } from "@x402x/fetch";

async function fetchMultipleResources(walletClient) {
  const fetchWithPay = x402xFetch(fetch, walletClient);

  // Each request is handled independently
  const [profile, posts, comments] = await Promise.all([
    fetchWithPay("/api/profile").then((r) => r.json()),
    fetchWithPay("/api/posts").then((r) => r.json()),
    fetchWithPay("/api/comments").then((r) => r.json()),
  ]);

  return { profile, posts, comments };
}
```

### With Custom Headers

```typescript
import { x402xFetch } from "@x402x/fetch";

async function fetchWithAuth(walletClient, authToken) {
  const fetchWithPay = x402xFetch(fetch, walletClient);

  const response = await fetchWithPay("/api/data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ query: "some data" }),
  });

  return response.json();
}
```

## Settlement Mode vs Standard Mode

The wrapper automatically detects which mode to use:

**Settlement Mode** (used when `extra.settlementRouter` exists):

- Uses commitment hash as nonce
- Binds all settlement parameters to signature
- Supports Hooks and facilitator fees

**Standard Mode** (used otherwise):

- Uses random nonce
- Standard x402 flow
- Direct EIP-3009 transfer

## Error Handling

The wrapper may throw the following errors:

- **`"No payment requirements provided in 402 response"`**: Server returned 402 but didn't include payment requirements
- **`"Payment amount {amount} exceeds maximum allowed {maxValue}"`**: Payment exceeds configured maximum
- **`"Payment already attempted, preventing retry loop"`**: Detected infinite retry loop
- **`"No account address available"`**: Wallet client doesn't have an account

## TypeScript Support

Full TypeScript support with type definitions included.

```typescript
import { x402xFetch } from "@x402x/fetch";
import type { Signer } from "@x402x/core";

const fetchWithPay: (input: RequestInfo, init?: RequestInit) => Promise<Response> = x402xFetch(
  fetch,
  walletClient,
);
```

## Related Packages

- [`@x402x/core`](../core): Core utilities and types
- [`@x402x/react`](../react): React hooks for payments
- [`x402-fetch`](https://npmjs.com/package/x402-fetch): Standard x402 fetch wrapper

## License

Apache-2.0
