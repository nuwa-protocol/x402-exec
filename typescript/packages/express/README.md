# @x402x/express

Express middleware for x402x settlement framework - easily add 402 payment gates to your Express routes.

## Installation

```bash
npm install @x402x/express @x402x/core
```

## Features

- 🚀 Drop-in middleware for Express routes
- 🔐 Automatic settlement mode support
- 💰 Configurable facilitator fees
- 🎯 Zero configuration for basic usage
- 🔌 Works with builtin or custom hooks

## Quick Start

```typescript
import express from 'express';
import { x402Middleware } from '@x402x/express';

const app = express();

// Add payment gate to a route
app.post('/api/premium-content',
  x402Middleware({
    network: 'base-sepolia',
    amount: '100000', // 0.1 USDC
    resource: '/api/premium-content',
    facilitatorFee: '10000', // 0.01 USDC
  }),
  (req, res) => {
    // This handler only runs after successful payment
    res.json({
      content: 'Here is your premium content!',
      timestamp: Date.now(),
    });
  }
);

app.listen(3000);
```

## API Reference

### `x402Middleware(options)`

Creates an Express middleware that returns 402 responses with payment requirements.

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

Express middleware function `(req, res, next) => void`

## Examples

### Basic Payment Gate

```typescript
import express from 'express';
import { x402Middleware } from '@x402x/express';

const app = express();

app.get('/api/data',
  x402Middleware({
    network: 'base-sepolia',
    amount: '50000', // 0.05 USDC
    resource: '/api/data',
  }),
  (req, res) => {
    res.json({ data: 'Secret data' });
  }
);
```

### With Custom Description

```typescript
app.post('/api/generate-report',
  x402Middleware({
    network: 'base-sepolia',
    amount: '200000', // 0.2 USDC
    resource: '/api/generate-report',
    description: 'Generate custom analytics report',
    facilitatorFee: '20000', // 0.02 USDC
  }),
  async (req, res) => {
    const report = await generateReport(req.body);
    res.json({ report });
  }
);
```

### Multiple Payment Tiers

```typescript
import { x402Middleware } from '@x402x/express';

const app = express();

// Basic tier - 0.01 USDC
app.get('/api/basic',
  x402Middleware({
    network: 'base-sepolia',
    amount: '10000',
    resource: '/api/basic',
  }),
  (req, res) => {
    res.json({ tier: 'basic', content: '...' });
  }
);

// Premium tier - 0.1 USDC
app.get('/api/premium',
  x402Middleware({
    network: 'base-sepolia',
    amount: '100000',
    resource: '/api/premium',
  }),
  (req, res) => {
    res.json({ tier: 'premium', content: '...' });
  }
);
```

### With Request Body

```typescript
app.post('/api/ai-query',
  express.json(), // Parse JSON body first
  x402Middleware({
    network: 'base-sepolia',
    amount: '50000',
    resource: '/api/ai-query',
  }),
  async (req, res) => {
    const { query } = req.body;
    const response = await processAIQuery(query);
    res.json({ response });
  }
);
```

### Custom Recipient

```typescript
const MERCHANT_ADDRESS = '0x1234...';

app.post('/api/purchase',
  x402Middleware({
    network: 'base-sepolia',
    amount: '1000000', // 1 USDC
    resource: '/api/purchase',
    payTo: MERCHANT_ADDRESS, // Send funds to merchant
    facilitatorFee: '50000', // 0.05 USDC facilitator fee
  }),
  (req, res) => {
    res.json({ success: true, orderId: '123' });
  }
);
```

### With Error Handling

```typescript
import { x402Middleware } from '@x402x/express';

app.post('/api/protected',
  x402Middleware({
    network: 'base-sepolia',
    amount: '100000',
    resource: '/api/protected',
  }),
  async (req, res, next) => {
    try {
      const data = await fetchProtectedData();
      res.json({ data });
    } catch (error) {
      next(error); // Pass to error handler
    }
  }
);

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
```

### Conditional Payment

```typescript
app.get('/api/content/:id',
  async (req, res, next) => {
    const content = await getContent(req.params.id);
    
    // Only require payment for premium content
    if (content.isPremium) {
      return x402Middleware({
        network: 'base-sepolia',
        amount: content.price,
        resource: `/api/content/${req.params.id}`,
      })(req, res, next);
    }
    
    // Free content
    res.json({ content });
  }
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
// Server (Express)
import { x402Middleware } from '@x402x/express';

app.get('/api/data',
  x402Middleware({
    network: 'base-sepolia',
    amount: '100000',
    resource: '/api/data',
  }),
  (req, res) => {
    res.json({ data: 'Protected data' });
  }
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
import type { X402MiddlewareOptions } from '@x402x/express';

const options: X402MiddlewareOptions = {
  network: 'base-sepolia',
  amount: '100000',
  resource: '/api/endpoint',
};
```

## Related Packages

- [`@x402x/core`](../core): Core utilities and types
- [`@x402x/hono`](../hono): Hono middleware
- [`@x402x/fetch`](../fetch): Fetch wrapper for clients
- [`@x402x/react`](../react): React hooks

## License

Apache-2.0

