# @x402x/hono

Hono middleware for x402x settlement framework - easily add 402 payment gates to your Hono routes with dynamic facilitator fee calculation.

## Installation

```bash
npm install @x402x/hono @x402x/core
```

## Features

- 🚀 Drop-in middleware for Hono routes
- 🔐 Automatic settlement mode support
- 💰 **Dynamic facilitator fee calculation** - automatically queries current gas prices
- 🎯 Zero configuration for basic usage with automatic fee
- 🔌 Works with builtin or custom hooks
- ⚡ Edge runtime compatible
- ⏱️ Built-in caching for fee calculations

## Quick Start

```typescript
import { Hono } from "hono";
import { paymentMiddleware } from "@x402x/hono";

const app = new Hono();

// Add payment gate with automatic fee calculation
app.use('/api/premium', paymentMiddleware(
  '0xRecipient...',  // Your recipient address
  {
    price: '$0.10',  // Business price (facilitator fee auto-calculated)
    network: 'base-sepolia',
  },
  { url: 'https://facilitator.x402x.dev' }  // Facilitator for verify/settle/fee
));

app.post('/api/premium', (c) => {
  return c.json({ content: 'Premium content!' });
});

export default app;
```

## Key Concepts

### Business Price vs Total Price

When using **dynamic fee calculation** (recommended):
- `price`: Your business/API price (what you charge for the service)
- **Facilitator fee**: Automatically calculated based on current gas prices
- **Total price**: `price + facilitator fee` (shown to users in 402 response)

Example:
```typescript
{
  price: '$0.10',  // Your API charges $0.10
  // facilitatorFee auto-calculated (e.g., $0.02 based on current gas)
  // Total shown to user: $0.12
}
```

### Static vs Dynamic Fees

**Dynamic (Recommended)**:
```typescript
{
  price: '$0.10',
  // facilitatorFee not configured → auto-calculated
}
```

**Static (Legacy/Special Cases)**:
```typescript
{
  price: '$0.10',
  facilitatorFee: '$0.02',  // Fixed fee
}
```

## API Reference

### `paymentMiddleware(payTo, routes, facilitator?)`

Creates a Hono middleware that returns 402 responses with payment requirements.

#### Parameters

**`payTo`** (required): Final recipient address for payments

**`routes`** (required): Route configuration object:
- **`price`**: Business price (e.g., `'$0.10'`, `'0.1'`)
- **`network`**: Network name or array (e.g., `'base-sepolia'`, `['base-sepolia', 'polygon']`)
- **`facilitatorFee`** (optional): 
  - Not set or `"auto"`: Dynamic calculation (recommended)
  - String/Money: Static fee (e.g., `'$0.01'`)
- **`hook`** (optional): Hook address (defaults to TransferHook)
- **`hookData`** (optional): Encoded hook data (defaults to `'0x'`)
- **`config`** (optional): Additional settings (description, timeout, etc.)

**`facilitator`** (optional but recommended): Facilitator configuration
- **`url`**: Facilitator service URL (e.g., `'https://facilitator.x402x.dev'`)
- **`createAuthHeaders`**: Optional auth header function

**Note**: Facilitator config is required for dynamic fee calculation and for verify/settle operations.

#### Returns

Hono middleware function compatible with Hono v4+

## Examples

### Basic with Auto Fee (Recommended)

```typescript
import { Hono } from "hono";
import { paymentMiddleware } from "@x402x/hono";

const app = new Hono();

app.use('/api/data', paymentMiddleware(
  '0xYourAddress...',
  {
    price: '$0.05',  // Your business price
    network: 'base-sepolia',
    // facilitatorFee auto-calculated
  },
  { url: 'https://facilitator.x402x.dev' }
));

app.get('/api/data', (c) => c.json({ data: 'Protected data' }));
```

### Multi-Route Configuration

```typescript
app.use(paymentMiddleware(
  '0xYourAddress...',
  {
    '/api/basic': {
      price: '$0.01',
      network: 'base-sepolia',
    },
    'POST /api/premium': {
      price: '$0.10',
      network: 'base-sepolia',
    },
  },
  { url: 'https://facilitator.x402x.dev' }
));
```

### Multi-Network Support

```typescript
app.use('/api/data', paymentMiddleware(
  '0xYourAddress...',
  {
    price: '$0.10',
    network: ['base-sepolia', 'polygon', 'arbitrum'],
    // Fee calculated for each network
  },
  { url: 'https://facilitator.x402x.dev' }
));
```

### Static Fee (Legacy Mode)

```typescript
// Use when you want fixed fee (not recommended)
app.use('/api/data', paymentMiddleware(
  '0xYourAddress...',
  {
    price: '$0.10',
    network: 'base-sepolia',
    facilitatorFee: '$0.02',  // Fixed fee
  },
  { url: 'https://facilitator.x402x.dev' }
));
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
