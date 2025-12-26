# x402x Client Extension Example

This example demonstrates using the official x402 SDK with x402x router settlement extension.

## What's New

We've created a client-side scheme (`ExactEvmSchemeWithRouterSettlement`) that works with the official `x402Client` to support x402x router settlement.

## Key Components

### 1. ExactEvmSchemeWithRouterSettlement

Located in `typescript/packages/extensions/src/client/exact-evm-scheme.ts`

This scheme implements the `SchemeNetworkClient` interface and:
- Extracts settlement parameters from PaymentRequired.extensions
- Calculates a commitment hash as the EIP-3009 nonce
- Signs with settlementRouter as the recipient
- Ensures all settlement parameters are cryptographically bound

### 2. usePaymentV2 Hook

Located in `examples/showcase/client/src/hooks/usePaymentV2.ts`

A simplified payment hook that:
- Parses both v2 header (`PAYMENT-REQUIRED`) and v1 body formats
- Uses the new scheme for payment signing
- Handles the complete payment flow

### 3. PaymentDialogV2 Component

Located in `examples/showcase/client/src/components/PaymentDialogV2.tsx`

A cleaner payment dialog using the new hook.

## Usage in PremiumDownload Scenario

The Premium Download scenario (`examples/showcase/client/src/scenarios/PremiumDownload.tsx`) now uses `PaymentDialogV2`:

```typescript
import { PaymentDialogV2 } from "../components/PaymentDialogV2";

<PaymentDialogV2
  isOpen={showPaymentDialog}
  onClose={() => setShowPaymentDialog(false)}
  amount="$0.10"
  currency="USDC"
  endpoint="/api/purchase-download"
  getRequestBody={(userAddress) => ({
    walletAddress: userAddress,
    contentId: "x402-whitepaper",
  })}
  onSuccess={handlePaymentSuccess}
  onError={handlePaymentError}
/>
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Client (Browser)                                       │
│                                                          │
│  ┌────────────────────────────────────────────┐        │
│  │  usePaymentV2 Hook                         │        │
│  │  - Parse 402 response                      │        │
│  │  - Extract extensions                      │        │
│  │  - Call scheme.createPaymentPayload()      │        │
│  └────────────────┬───────────────────────────┘        │
│                   │                                      │
│  ┌────────────────▼───────────────────────────┐        │
│  │  ExactEvmSchemeWithRouterSettlement        │        │
│  │  - Calculate commitment hash               │        │
│  │  - Sign EIP-3009 with commitment as nonce  │        │
│  └────────────────┬───────────────────────────┘        │
│                   │                                      │
└───────────────────┼──────────────────────────────────────┘
                    │
                    │ HTTP POST with PAYMENT-SIGNATURE
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Resource Server                                        │
│                                                          │
│  ┌────────────────────────────────────────────┐        │
│  │  @x402/hono paymentMiddleware              │        │
│  │  + x402x extension                         │        │
│  │  - Verify payment signature                │        │
│  │  - Settle via facilitator                  │        │
│  └────────────────┬───────────────────────────┘        │
│                   │                                      │
└───────────────────┼──────────────────────────────────────┘
                    │
                    │ Settle transaction
                    ▼
┌─────────────────────────────────────────────────────────┐
│  Facilitator                                            │
│  - Verify commitment                                    │
│  - Submit to SettlementRouter                           │
└─────────────────────────────────────────────────────────┘
```

## Testing

Run the tests:

```bash
cd typescript/packages/extensions
pnpm test src/client/exact-evm-scheme.test.ts
```

## Comparison with Previous Implementation

### Before (Manual Implementation)

- ~500 lines in `usePayment.ts`
- Manual 402 response parsing
- Manual commitment calculation
- Manual EIP-712 signing
- Complex state management

### After (Using Official SDK + Extension)

- ~200 lines in `usePaymentV2.ts`
- Delegates to `ExactEvmSchemeWithRouterSettlement`
- Reusable scheme implementation
- Cleaner separation of concerns
- Compatible with official x402 ecosystem

## Benefits

1. **Standards Compliance**: Uses official x402 v2 SDK interfaces
2. **Reusability**: Scheme can be used with any x402-compatible resource server
3. **Maintainability**: Centralized scheme logic in extensions package
4. **Testability**: Comprehensive unit tests for the scheme
5. **Extensibility**: Easy to add support for other schemes (e.g., Solana)

## Next Steps

1. Update other scenarios to use `PaymentDialogV2`
2. Consider creating a `@x402/react` package with hooks
3. Add more examples (e.g., using with `@x402/fetch`)
4. Document migration guide from v1 to v2

