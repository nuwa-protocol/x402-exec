# Third-Party Developer Integration Guide

This guide explains how third-party developers can use x402-exec in their own projects using the standard x402 v2 SDK and x402x extensions.

## Overview

x402-exec is now implemented as a standard extension to the [x402 protocol](https://github.com/coinbase/x402) v2. Instead of using a modified/patched version of the SDK, you simply install the official SDK packages along with `@x402x/extensions`.

## Installation

Install the official x402 packages and the x402x extension package:

### For Server (Resource Server)

```bash
# npm
npm install @x402/hono @x402/evm @x402x/extensions

# pnpm
pnpm add @x402/hono @x402/evm @x402x/extensions
```

### For Client (Browser/Node)

```bash
# npm
npm install @x402/client @x402x/extensions

# pnpm
pnpm add @x402/client @x402x/extensions
```

## Integration Patterns

### 1. Server-Side (Resource Server)

Use `registerRouterSettlement` to add the x402x extension to your resource server.

```typescript
import { Hono } from "hono";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { registerRouterSettlement } from "@x402x/extensions";

const app = new Hono();

// Create resource server with facilitator support
const server = new x402ResourceServer(facilitatorClient);

// 1. Register official EVM scheme
registerExactEvmScheme(server, { accounts: [...] });

// 2. Register x402x router settlement extension
// This injects the necessary settlement parameters (router address, hooks, etc.)
registerRouterSettlement(server);

// 3. Initialize
await server.initialize();

// 4. Use middleware as usual
app.use("/api/premium", paymentMiddleware(routes, server));
```

### 2. Client-Side

Use the `ExactEvmSchemeWithRouterSettlement` (or equivalent pattern) provided by extensions to handle payment signing with EIP-3009 and commitment calculation.

*(Note: Detailed client library usage is documented in the `@x402x/client` package documentation or showcase examples).*

## Migration from v1 (Patch)

If you were using the old patch method (`npm:@x402x/x402@...`):

1. **Remove the patch dependency**:
   ```bash
   npm uninstall x402
   ```

2. **Install official packages**:
   ```bash
   npm install @x402/hono @x402/evm @x402x/extensions
   ```

3. **Update imports**:
   - Change `import ... from 'x402/server'` to `import ... from '@x402/hono'` (or appropriate package).
   - Import x402x specific functions from `@x402x/extensions`.

4. **Register Extension**:
   - Add `registerRouterSettlement(server)` to your initialization code.

## Support

For issues or questions, please open an issue in the [x402-exec repository](https://github.com/nuwa-protocol/x402-exec).
