# Third-Party Developer Integration Guide

This guide explains how third-party developers can use x402-exec in their own projects.

## Background

x402-exec enhances the [x402 protocol](https://github.com/coinbase/x402) by adding `paymentRequirements` field support to `PaymentPayload`. This improvement has been submitted to the official x402 repository ([PR #578](https://github.com/coinbase/x402/pull/578)), but has been deferred to v2.

To enable developers to use these enhancements immediately, we've released a modified version of the x402 package: `@x402x/x402`.

## Installation

### Method 1: Using npm alias (Recommended) ✨

This is the simplest approach, using npm's alias feature to automatically replace the `x402` package:

```json
{
  "dependencies": {
    "x402": "npm:@x402x/x402@0.6.6-patch.3"
  }
}
```

**Advantages:**
- ✅ No need to modify `import` statements in your code
- ✅ Automatically compatible with other x402 adapter packages (like `x402-fetch`, `x402-hono`)
- ✅ Upgrade to official x402 v2 requires only one line change

**Using npm:**
```bash
npm install x402@npm:@x402x/x402@0.6.6-patch.3
```

**Using pnpm:**
```bash
pnpm add x402@npm:@x402x/x402@0.6.6-patch.3
```

**Using yarn:**
```bash
yarn add x402@npm:@x402x/x402@0.6.6-patch.3
```

### Method 2: Direct Installation

If your project doesn't use other x402-related packages, you can also install directly:

```bash
npm install @x402x/x402
```

Then in your code:
```typescript
import { PaymentPayload } from '@x402x/x402/types';
```

## Code Examples

### Client - Creating Payment with PaymentRequirements

```typescript
import { createPaymentHeader } from 'x402/client';
import type { PaymentRequirements } from 'x402/types';

const paymentRequirements: PaymentRequirements = {
  // ... standard fields
  extra: {
    // Custom extension parameters
    settlementRouter: '0x...',
    hookAddress: '0x...',
    hookData: '0x...'
  }
};

// Include paymentRequirements when creating payment
const paymentPayload = await createPaymentHeader({
  // ... other parameters
  paymentRequirements, // Now you can pass paymentRequirements
});
```

### Facilitator - Accessing PaymentRequirements

```typescript
import { verify } from 'x402/facilitator';
import type { PaymentPayload } from 'x402/types';

async function handlePayment(paymentPayload: PaymentPayload) {
  // Verify payment
  const verified = await verify(paymentPayload);
  
  // Now you can access the original paymentRequirements
  if (paymentPayload.paymentRequirements) {
    const { extra } = paymentPayload.paymentRequirements;
    
    // Execute on-chain settlement using extension parameters
    if (extra?.settlementRouter) {
      await executeSettlement({
        router: extra.settlementRouter,
        hook: extra.hookAddress,
        data: extra.hookData,
        // ...
      });
    }
  }
  
  return verified;
}
```

## Compatibility

### Compatibility with Other x402 Packages

`@x402x/x402` is fully compatible with official x402 adapter packages:

```json
{
  "dependencies": {
    "x402": "npm:@x402x/x402@0.6.6-patch.3",
    "x402-fetch": "^0.6.6",     // Use official version
    "x402-hono": "^0.6.5",       // Use official version
    "x402-express": "^0.6.6"     // Use official version
  }
}
```

When you install official packages like `x402-fetch`, they will automatically use your aliased `@x402x/x402` without additional configuration.

### Upgrading to Official x402 v2

When the official x402 v2 is released, upgrading is simple:

1. Modify `package.json`:
```json
{
  "dependencies": {
    "x402": "^2.0.0"  // Remove npm: alias
  }
}
```

2. Reinstall dependencies:
```bash
npm install
```

3. Update code according to x402 v2 breaking changes (if necessary)

## Version Information

- **Base Version**: x402 `0.6.6`
- **Patch Version**: `@x402x/x402@0.6.6-patch.1`
- **Key Changes**: Added optional `paymentRequirements` field to `PaymentPayload`

## Related Resources

- **Official x402 Repository**: https://github.com/coinbase/x402
- **Enhancement PR**: https://github.com/coinbase/x402/pull/578
- **x402-exec Documentation**: https://github.com/nuwa-protocol/x402-exec
- **npm Package**: https://www.npmjs.com/package/@x402x/x402

## FAQ

### Q: Why not use the official x402 directly?

A: The official x402 currently doesn't support passing `paymentRequirements` in `PaymentPayload`, preventing facilitators from accessing critical extension parameters (like the `extra` field). Our changes have been submitted to the official repository but were deferred to v2. `@x402x/x402` gives you access to this functionality now.

### Q: Is this a fork?

A: Yes, but the changes are minimal (only adding an optional field). We will continue tracking official version updates and migrate back to the official version when v2 is released.

### Q: Is it backward compatible?

A: Fully compatible! `paymentRequirements` is an optional field, so existing code that doesn't use it remains unaffected.

### Q: How can I verify I'm using the correct package?

Check in your code:
```typescript
import { PaymentPayloadSchema } from 'x402/types';

// If the schema contains paymentRequirements field, you're using @x402x/x402
console.log(PaymentPayloadSchema.shape.paymentRequirements !== undefined);
```

## Support

For questions or suggestions:
- Submit an Issue: https://github.com/nuwa-protocol/x402-exec/issues
- View Examples: https://demo.x402x.dev/
- Read Documentation: https://github.com/nuwa-protocol/x402-exec/tree/main/docs

