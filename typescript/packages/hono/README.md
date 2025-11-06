# @x402x/hono

Hono middleware for x402x settlement framework - easily add 402 payment gates to your Hono routes.

## Installation

```bash
npm install @x402x/hono @x402x/core
```

## Features

- 🚀 Drop-in middleware for Hono routes
- 🔐 Automatic settlement mode support
- 💰 Configurable facilitator fees
- 🎯 Zero configuration for basic usage
- 🔌 Works with builtin or custom hooks
- ⚡ Edge runtime compatible

## Quick Start

```typescript
import { Hono } from "hono";
import { x402Middleware } from "@x402x/hono";

const app = new Hono();

// Add payment gate to a route
app.post(
  "/api/premium-content",
  x402Middleware({
    network: "base-sepolia",
    amount: "100000", // 0.1 USDC
    resource: "/api/premium-content",
    facilitatorFee: "10000", // 0.01 USDC
  }),
  (c) => {
    // This handler only runs after successful payment
    return c.json({
      content: "Here is your premium content!",
      timestamp: Date.now(),
    });
  },
);

export default app;
```

## API Reference

### `x402Middleware(options)`

Creates a Hono middleware that returns 402 responses with payment requirements.

#### Parameters

**`options`**: Configuration object with the following properties:

- **`network`** (required): Network name (e.g., `'base-sepolia'`, `'x-layer-testnet'`)
- **`amount`** (required): Payment amount in token's smallest unit (e.g., `'100000'` = 0.1 USDC)
- **`resource`** (required): Resource path (e.g., `'/api/payment'`)
- **`token`** (optional): Token address (defaults to USDC for the network)
- **`hook`** (optional): Hook address (defaults to TransferHook)
- **`hookData`** (optional): Encoded hook data (defaults to `'0x'`)
- **`facilitatorFee`** (optional): Facilitator fee amount (defaults to `'0'`)
- **`payTo`** (optional): Final recipient address
- **`description`** (optional): Payment description
- **`maxTimeoutSeconds`** (optional): Maximum timeout (defaults to 3600)

#### Returns

Hono middleware function compatible with Hono v4+

## Examples

### Basic Payment Gate

```typescript
import { Hono } from "hono";
import { x402Middleware } from "@x402x/hono";

const app = new Hono();

app.get(
  "/api/data",
  x402Middleware({
    network: "base-sepolia",
    amount: "50000", // 0.05 USDC
    resource: "/api/data",
  }),
  (c) => c.json({ data: "Secret data" }),
);
```

### With Custom Description

```typescript
app.post(
  "/api/generate-report",
  x402Middleware({
    network: "base-sepolia",
    amount: "200000", // 0.2 USDC
    resource: "/api/generate-report",
    description: "Generate custom analytics report",
    facilitatorFee: "20000", // 0.02 USDC
  }),
  async (c) => {
    const body = await c.req.json();
    const report = await generateReport(body);
    return c.json({ report });
  },
);
```

### Multiple Payment Tiers

```typescript
import { Hono } from "hono";
import { x402Middleware } from "@x402x/hono";

const app = new Hono();

// Basic tier - 0.01 USDC
app.get(
  "/api/basic",
  x402Middleware({
    network: "base-sepolia",
    amount: "10000",
    resource: "/api/basic",
  }),
  (c) => c.json({ tier: "basic", content: "..." }),
);

// Premium tier - 0.1 USDC
app.get(
  "/api/premium",
  x402Middleware({
    network: "base-sepolia",
    amount: "100000",
    resource: "/api/premium",
  }),
  (c) => c.json({ tier: "premium", content: "..." }),
);
```

### Edge Runtime (Cloudflare Workers)

```typescript
import { Hono } from "hono";
import { x402Middleware } from "@x402x/hono";

const app = new Hono();

app.post(
  "/api/ai-query",
  x402Middleware({
    network: "base-sepolia",
    amount: "50000",
    resource: "/api/ai-query",
  }),
  async (c) => {
    const { query } = await c.req.json();
    const response = await processAIQuery(query);
    return c.json({ response });
  },
);

export default app;
```

### Custom Recipient

```typescript
const MERCHANT_ADDRESS = "0x1234...";

app.post(
  "/api/purchase",
  x402Middleware({
    network: "base-sepolia",
    amount: "1000000", // 1 USDC
    resource: "/api/purchase",
    payTo: MERCHANT_ADDRESS, // Send funds to merchant
    facilitatorFee: "50000", // 0.05 USDC facilitator fee
  }),
  (c) => c.json({ success: true, orderId: "123" }),
);
```

### With Error Handling

```typescript
import { Hono } from "hono";
import { x402Middleware } from "@x402x/hono";

const app = new Hono();

app.post(
  "/api/protected",
  x402Middleware({
    network: "base-sepolia",
    amount: "100000",
    resource: "/api/protected",
  }),
  async (c) => {
    try {
      const data = await fetchProtectedData();
      return c.json({ data });
    } catch (error) {
      return c.json({ error: "Internal server error" }, 500);
    }
  },
);

// Global error handler
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Something went wrong" }, 500);
});
```

### Conditional Payment

```typescript
app.get("/api/content/:id", async (c, next) => {
  const content = await getContent(c.req.param("id"));

  // Only require payment for premium content
  if (content.isPremium) {
    return x402Middleware({
      network: "base-sepolia",
      amount: content.price,
      resource: `/api/content/${c.req.param("id")}`,
    })(c, next);
  }

  // Free content
  return c.json({ content });
});
```

### With CORS

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { x402Middleware } from "@x402x/hono";

const app = new Hono();

app.use("/*", cors());

app.post(
  "/api/data",
  x402Middleware({
    network: "base-sepolia",
    amount: "100000",
    resource: "/api/data",
  }),
  (c) => c.json({ data: "Protected" }),
);
```

## How It Works

1. **No Payment Header**: When a request arrives without `X-PAYMENT` header:
   - Returns 402 status
   - Includes payment requirements in response body
2. **With Payment Header**: When a request arrives with `X-PAYMENT` header:
   - Calls `next()` to proceed to your handler
   - Your handler executes normally

## Integration with x402x Client

The middleware works seamlessly with x402x client libraries:

```typescript
// Server (Hono)
import { Hono } from 'hono';
import { x402Middleware } from '@x402x/hono';

const app = new Hono();

app.get('/api/data',
  x402Middleware({
    network: 'base-sepolia',
    amount: '100000',
    resource: '/api/data',
  }),
  (c) => c.json({ data: 'Protected data' })
);

// Client (React)
import { useX402Payment } from '@x402x/react';

function DataFetcher() {
  const { pay } = useX402Payment();

  const fetchData = async () => {
    const result = await pay('/api/data');
    console.log(result.data);
  };

  return <button onClick={fetchData}>Fetch Data</button>;
}
```

## TypeScript Support

Full TypeScript support with type definitions included.

```typescript
import type { X402MiddlewareOptions } from "@x402x/hono";

const options: X402MiddlewareOptions = {
  network: "base-sepolia",
  amount: "100000",
  resource: "/api/endpoint",
};
```

## Related Packages

- [`@x402x/core`](../core): Core utilities and types
- [`@x402x/express`](../express): Express middleware
- [`@x402x/fetch`](../fetch): Fetch wrapper for clients
- [`@x402x/react`](../react): React hooks

## License

Apache-2.0
