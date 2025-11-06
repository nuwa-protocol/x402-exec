# @x402x/express

Express middleware for the x402x settlement framework. Provides full x402 payment protocol support with x402x settlement extensions.

## Features

- ✅ **Full x402 Payment Flow**: Automatic payment verification and settlement
- ✅ **X402Context Extension**: Access payment details in route handlers
- ✅ **Multi-Network Support**: Accept payments on multiple networks
- ✅ **Custom Settlement Hooks**: Configure hook contracts for programmable settlement
- ✅ **Dollar-Denominated Pricing**: Simple USD-based price configuration
- ✅ **Facilitator Integration**: Built-in facilitator support for payment processing

## Installation

```bash
npm install @x402x/express
# or
pnpm add @x402x/express
# or
yarn add @x402x/express
```

## Quick Start

```typescript
import express from 'express';
import { paymentMiddleware } from '@x402x/express';

const app = express();

// Single route with payment requirement
app.post('/api/premium',
  paymentMiddleware(
    "0xYourRecipientAddress", // Final payment recipient
    {
      price: "$0.10",              // 0.10 USD in USDC
      network: "base-sepolia",     // Payment network
      facilitatorFee: "$0.01",     // 0.01 USD facilitator fee
      config: {
        description: "Access to premium content",
      }
    },
    {
      url: "https://your-facilitator.com", // Optional facilitator config
    }
  ),
  (req, res) => {
    // Access verified payment context (x402x extension)
    const { payer, amount, network } = req.x402!;
    
    console.log(`Received payment from ${payer}: ${amount} on ${network}`);
    
    res.json({ 
      success: true,
      message: "Payment received and settled",
    });
  }
);

app.listen(3000);
```

## Multi-Network Support

```typescript
// Accept payments on multiple networks
app.post('/api/multi-network',
  paymentMiddleware(
    "0xYourAddress",
    {
      price: "$1.00",
      network: ["base-sepolia", "base"], // Multiple networks
      facilitatorFee: "$0.01",
    }
  ),
  (req, res) => {
    const { network } = req.x402!;
    res.json({ message: `Paid on ${network}` });
  }
);
```

## Multiple Routes Configuration

```typescript
// Protect multiple routes with different prices
app.use(paymentMiddleware(
  "0xYourAddress",
  {
    "/api/basic": {
      price: "$0.01",
      network: "base-sepolia",
    },
    "/api/premium": {
      price: "$1.00",
      network: ["base-sepolia", "base"],
    },
    "/api/enterprise": {
      price: "$10.00",
      network: "base",
      facilitatorFee: "$0.50",
    }
  },
  facilitatorConfig
));

// Route handlers can access req.x402
app.get("/api/basic", (req, res) => {
  const { payer } = req.x402!;
  res.json({ message: "Basic access", payer });
});
```

## Custom Settlement Hooks

```typescript
// Use custom hook for revenue split
app.post('/api/referral',
  paymentMiddleware(
    "0xMerchantAddress",
    {
      price: "$0.10",
      network: "base-sepolia",
      hook: "0xRevenueSplitHookAddress",
      hookData: encodeRevenueSplitData({
        merchant: "0xMerchantAddress",
        referrer: "0xReferrerAddress",
        platform: "0xPlatformAddress",
      }),
    }
  ),
  (req, res) => {
    res.json({ message: "Revenue split executed" });
  }
);

// Dynamic hook configuration
app.post('/api/nft-mint',
  paymentMiddleware(
    "0xMerchantAddress",
    {
      price: "$1.00",
      network: "base-sepolia",
      hook: (network) => getNFTMintHookAddress(network),
      hookData: (network) => encodeNFTMintData({
        nftContract: getNFTContract(network),
        tokenId: generateTokenId(),
        merchant: "0xMerchantAddress",
      }),
    }
  ),
  (req, res) => {
    const { payer } = req.x402!;
    res.json({ 
      message: "NFT minted",
      recipient: payer,
    });
  }
);
```

## X402Context Access

The middleware extends Express `Request` with an `x402` property containing payment details:

```typescript
import type { X402Request } from '@x402x/express';

app.post('/api/payment',
  paymentMiddleware(...),
  (req: X402Request, res) => {
    const x402 = req.x402!;
    
    // Access verified payment information
    console.log("Payer:", x402.payer);              // Address of payer
    console.log("Amount:", x402.amount);            // Amount in atomic units
    console.log("Network:", x402.network);          // Network used
    console.log("Payment:", x402.payment);          // Full payment payload
    console.log("Requirements:", x402.requirements); // Payment requirements
    
    // Settlement information (x402x specific)
    if (x402.settlement) {
      console.log("Router:", x402.settlement.router);
      console.log("Hook:", x402.settlement.hook);
      console.log("Hook Data:", x402.settlement.hookData);
      console.log("Facilitator Fee:", x402.settlement.facilitatorFee);
    }
    
    res.json({ success: true });
  }
);
```

## API Reference

### `paymentMiddleware(payTo, routes, facilitator?)`

Creates Express middleware for x402x payment processing.

**Parameters:**

- `payTo: string` - Final recipient address for payments
- `routes: X402xRoutesConfig` - Route configuration(s)
- `facilitator?: FacilitatorConfig` - Optional facilitator configuration

**Returns:** Express middleware function

### `X402xRouteConfig`

```typescript
interface X402xRouteConfig {
  price: string | Money;              // USD or Money object
  network: Network | Network[];       // Single or multiple networks
  hook?: string | ((network) => string);
  hookData?: string | ((network) => string);
  facilitatorFee?: string | Money | ((network) => string | Money);
  config?: {
    description?: string;
    mimeType?: string;
    maxTimeoutSeconds?: number;
    resource?: Resource;
    errorMessages?: {
      paymentRequired?: string;
      invalidPayment?: string;
      noMatchingRequirements?: string;
      verificationFailed?: string;
      settlementFailed?: string;
    };
  };
}
```

### `X402Context`

```typescript
interface X402Context {
  payer: Address | SolanaAddress;     // Verified payer address
  amount: string;                     // Payment amount (atomic units)
  network: Network;                   // Payment network
  payment: PaymentPayload;            // Decoded payment
  requirements: PaymentRequirements;  // Matched requirements
  settlement?: {                      // x402x settlement info
    router: Address;
    hook: Address;
    hookData: string;
    facilitatorFee: string;
  };
}
```

## Payment Flow

The middleware handles the complete payment lifecycle:

1. **402 Response**: Returns payment requirements when no payment is provided
2. **Payment Decode**: Decodes `X-PAYMENT` header from client
3. **Verification**: Verifies payment signature via facilitator
4. **Context Setup**: Attaches payment details to `req.x402`
5. **Handler Execution**: Runs your route handler (business logic)
6. **Settlement**: Settles payment via facilitator (if response status < 400)
7. **Response**: Returns `X-PAYMENT-RESPONSE` header to client

## Compatibility with x402

This middleware is fully compatible with the official x402 Express middleware API. To migrate from x402 to x402x:

```typescript
// Before (x402)
import { paymentMiddleware } from 'x402-express';

// After (x402x)
import { paymentMiddleware } from '@x402x/express';

// Same API! 🎉
```

The only difference is the addition of `req.x402` context and support for x402x settlement extensions.

## Examples

See the [showcase server](../../examples/showcase/server) for complete examples including:

- Revenue split (referral payments)
- NFT minting with payment
- Reward points distribution
- Multi-network support

## Related Packages

- [`@x402x/core`](../core) - Core utilities and types
- [`@x402x/hono`](../hono) - Hono middleware (alternative to Express)
- [`@x402x/fetch`](../fetch) - Client-side fetch wrapper
- [`@x402x/react`](../react) - React hooks for payments

## License

Apache-2.0
