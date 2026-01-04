# Showcase Components Guide

This document explains the reusable components created during the showcase refactoring, making it easier for developers to understand and use them.

## 📦 Reusable Components

All reusable components are located in `src/components/`.

### UnifiedDebugPanel

A unified debugging panel that combines wallet connection status and configuration info in a tabbed interface.

**Props:**

- `visible?`: `boolean` - Whether the panel is visible (default: false)

**Features:**

- **Wallet Tab**: Shows detailed wallet connection status
  - useAccount hook data
  - useWalletClient status
  - useConnectorClient status
  - Manual fallback client status
  - Available connectors list
  - Overall connection status
- **Config Tab**: Shows facilitator and server configuration
  - Facilitator URL
  - Server URL
  - Local development warnings
  - Configuration tips

**Example:**

```tsx
import { UnifiedDebugPanel } from "../components/UnifiedDebugPanel";

function App() {
  const [showDebug, setShowDebug] = useState(false);

  return (
    <>
      <button onClick={() => setShowDebug(!showDebug)}>
        {showDebug ? "Hide" : "Show"} Debug Info
      </button>
      <UnifiedDebugPanel visible={showDebug} />
    </>
  );
}
```

**Visual:**

- Fixed position at bottom-right corner
- Tabbed interface with two tabs
- Max height 80vh with scrollable content
- Auto-highlights issues (red for errors, yellow for local dev)

---

### StatusMessage

A unified component for displaying status messages with different types.

**Props:**

- `type`: `'success' | 'error' | 'warning' | 'info'` - Message type
- `title`: `string` - Message title
- `children?`: `ReactNode` - Optional message content
- `className?`: `string` - Optional CSS class

**Example:**

```tsx
import { StatusMessage } from '../components/StatusMessage';

<StatusMessage type="success" title="Payment Complete">
  <p>Your payment was processed successfully!</p>
</StatusMessage>

<StatusMessage type="error" title="Payment Failed">
  <p>{errorMessage}</p>
</StatusMessage>
```

**Visual:**

- ✅ Success: Green background with #155724 title color
- ❌ Error: Red background with #c00 title color
- ⚠️ Warning: Yellow background with #856404 title color
- ℹ️ Info: Blue background with #0c5460 title color

---

### TransactionResult

Displays transaction details including hash, network info, and explorer link.

**Props:**

- `txHash`: `string` - Transaction hash
- `network`: `Network` - Network identifier
- `details?`: `DetailItem[]` - Optional additional details
  - `DetailItem`: `{ label: string; value: string | JSX.Element }`
- `onNewTransaction?`: `() => void` - Optional callback for "new transaction" button
- `newTransactionLabel?`: `string` - Optional label for new transaction button (default: "Make Another Payment")

**Example:**

```tsx
import { TransactionResult } from "../components/TransactionResult";

<TransactionResult
  txHash={result.txHash}
  network={result.network}
  details={[
    { label: "Amount", value: <strong>$0.1 USDC</strong> },
    { label: "Hook", value: <code>TransferHook</code> },
    { label: "Mode", value: <strong>Serverless ⚡</strong> },
  ]}
  onNewTransaction={() => {
    reset();
    setShowDialog(true);
  }}
  newTransactionLabel="Make Another Payment"
/>;
```

---

### ScenarioCard

A container component for scenario pages providing consistent layout.

**Props:**

- `title`: `string` - Scenario title
- `badge?`: `string` - Optional badge text (e.g., "Serverless Mode")
- `description`: `ReactNode` - Scenario description (supports rich content)
- `children`: `ReactNode` - Scenario form/action content
- `className?`: `string` - Optional CSS class

**Example:**

```tsx
import { ScenarioCard } from "../components/ScenarioCard";

<ScenarioCard
  title="⚡ Serverless Transfer"
  badge="Serverless Mode"
  description={
    <>
      <p>
        Pay <strong>$0.1 USDC</strong> with automatic fee calculation.
      </p>
      {/* More description content */}
    </>
  }
>
  {/* Payment buttons and status */}
  <PaymentButton onClick={handlePay} isCompleted={isCompleted} />
  {/* Other content */}
</ScenarioCard>;
```

---

### PaymentButton

A standardized payment button with state support.

**Props:**

- `onClick`: `() => void` - Click handler
- `isCompleted?`: `boolean` - Whether payment is completed (default: false)
- `idleLabel?`: `string` - Button label when idle (default: "💳 Pay Now")
- `completedLabel?`: `string` - Button label when completed (default: "✅ Payment Complete")
- `disabled?`: `boolean` - Whether button is disabled (default: false)
- `className?`: `string` - Optional CSS class

**Example:**

```tsx
import { PaymentButton } from "../components/PaymentButton";

<PaymentButton
  onClick={() => setShowDialog(true)}
  isCompleted={!!paymentResult}
  idleLabel="💳 Pay $0.1 USDC"
  completedLabel="✅ Payment Complete"
/>;
```

**Behavior:**

- Automatically disabled when `isCompleted` is true
- Shows different labels based on completion state
- Applies opacity and cursor styles based on disabled state

---

## 🎣 Custom Hooks

### usePaymentFlow

A custom hook for managing payment flow state consistently across scenarios.

**Returns:**

```typescript
interface PaymentFlowState {
  paymentResult: PaymentResult | null; // Current payment result
  error: string | null; // Current error message
  handleSuccess: (result: PaymentResult) => void; // Success handler
  handleError: (err: string) => void; // Error handler
  reset: () => void; // Reset state
  isCompleted: boolean; // Whether payment is completed
}

interface PaymentResult {
  txHash: string;
  network: Network;
}
```

**Example:**

```tsx
import { usePaymentFlow } from "../hooks/usePaymentFlow";

function MyScenario() {
  const [showDialog, setShowDialog] = useState(false);
  const { paymentResult, error, handleSuccess, handleError, reset, isCompleted } = usePaymentFlow();

  return (
    <ScenarioCard {...cardProps}>
      <ServerlessPaymentDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        amount="100000"
        recipient="0x..."
        onSuccess={handleSuccess}
        onError={handleError}
      />

      <PaymentButton onClick={() => setShowDialog(true)} isCompleted={isCompleted} />

      {isCompleted && (
        <button
          onClick={() => {
            reset();
            setShowDialog(true);
          }}
        >
          Make Another Payment
        </button>
      )}

      {error && (
        <StatusMessage type="error" title="Payment Failed">
          <p>{error}</p>
        </StatusMessage>
      )}

      {paymentResult && (
        <TransactionResult txHash={paymentResult.txHash} network={paymentResult.network} />
      )}
    </ScenarioCard>
  );
}
```

**Benefits:**

- Eliminates duplicate state management code
- Consistent payment flow across all scenarios
- Automatic logging for debugging
- Type-safe result handling

---

## 🎨 Example Hooks (Showcase Specific)

### NFTMintHook

Helper utilities for working with NFTMintHook contract.

**Location:** `src/hooks/NFTMintHook.ts`

**Usage:**

```typescript
import { NFTMintHook } from "../hooks/NFTMintHook";

// Get contract addresses (using CAIP-2 format)
const hookAddress = NFTMintHook.getAddress("eip155:84532"); // Base Sepolia
const nftContract = NFTMintHook.getNFTContractAddress("eip155:84532");

// Encode hook data
const hookData = NFTMintHook.encode({
  nftContract,
  tokenId: 0n, // 0 for random mint
  merchant: merchantAddress,
});

// Use with x402x client
await client.execute({
  hook: hookAddress,
  hookData,
  amount: "100000",
  recipient: merchantAddress,
});
```

**Note:** This is a showcase example. For your own app, create similar utilities for your custom hooks.

---

### RewardHook

Helper utilities for working with RewardHook contract.

**Location:** `src/hooks/RewardHook.ts`

**Usage:**

```typescript
import { RewardHook } from "../hooks/RewardHook";

// Get contract addresses (using CAIP-2 format)
const hookAddress = RewardHook.getAddress("eip155:84532"); // Base Sepolia
const rewardToken = RewardHook.getTokenAddress("eip155:84532");

// Encode hook data
const hookData = RewardHook.encode({
  rewardToken,
  merchant: merchantAddress,
});

// Use with x402x client
await client.execute({
  hook: hookAddress,
  hookData,
  amount: "100000",
  recipient: merchantAddress,
});
// Payer automatically receives reward tokens!
```

**Note:** This is a showcase example. For your own app, create similar utilities for your custom hooks.

---

## 📝 Code Reduction

The refactoring achieved significant code reduction:

**Before:**

- ~320 lines per scenario component
- Duplicate status messages, transaction displays
- Repeated state management logic
- Inline styles scattered throughout

**After:**

- ~150-180 lines per scenario component
- **40-45% code reduction** through component reuse
- Consistent UI/UX across all scenarios
- Centralized style management
- Easy to add new scenarios

---

## 🔄 Migration Guide

### From Old to New Components

**Old Pattern (before refactoring):**

```tsx
function OldScenario() {
  const [paymentResult, setPaymentResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSuccess = (result) => {
    setPaymentResult(result);
    setError(null);
  };

  const handleError = (err) => {
    setError(err);
  };

  return (
    <div className="scenario-card">
      <div className="scenario-header">
        <h2>My Scenario</h2>
      </div>
      {/* Lots of inline styled divs for success/error messages */}
      {/* Duplicate transaction display code */}
    </div>
  );
}
```

**New Pattern (after refactoring):**

```tsx
import { ScenarioCard } from "../components/ScenarioCard";
import { PaymentButton } from "../components/PaymentButton";
import { StatusMessage } from "../components/StatusMessage";
import { TransactionResult } from "../components/TransactionResult";
import { usePaymentFlow } from "../hooks/usePaymentFlow";

function NewScenario() {
  const [showDialog, setShowDialog] = useState(false);
  const { paymentResult, error, handleSuccess, handleError, reset, isCompleted } = usePaymentFlow();

  return (
    <ScenarioCard title="My Scenario" description={<p>Description</p>}>
      <PaymentButton onClick={() => setShowDialog(true)} isCompleted={isCompleted} />
      {error && (
        <StatusMessage type="error" title="Error">
          {error}
        </StatusMessage>
      )}
      {paymentResult && <TransactionResult {...paymentResult} />}
    </ScenarioCard>
  );
}
```

**Benefits:**

- Less code to write and maintain
- Consistent styling automatically
- Built-in best practices
- Easier to test

---

## 🚀 Adding New Scenarios

To add a new scenario using these components:

1. **Create scenario file:** `src/scenarios/MyNewScenario.tsx`

2. **Use the component template:**

```tsx
import { useState } from "react";
import { ScenarioCard } from "../components/ScenarioCard";
import { PaymentButton } from "../components/PaymentButton";
import { StatusMessage } from "../components/StatusMessage";
import { TransactionResult } from "../components/TransactionResult";
import { ServerlessPaymentDialog } from "../components/ServerlessPaymentDialog";
import { usePaymentFlow } from "../hooks/usePaymentFlow";

const AMOUNT = "100000"; // 0.1 USDC
const RECIPIENT = "0x...";

export function MyNewScenario() {
  const [showDialog, setShowDialog] = useState(false);
  const { paymentResult, error, handleSuccess, handleError, reset, isCompleted } = usePaymentFlow();

  return (
    <ScenarioCard title="My New Scenario" badge="New!" description={<p>Scenario description</p>}>
      <ServerlessPaymentDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        amount={AMOUNT}
        recipient={RECIPIENT}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      <PaymentButton
        onClick={() => setShowDialog(true)}
        isCompleted={isCompleted}
        idleLabel="Pay Now"
      />

      {isCompleted && (
        <button
          onClick={() => {
            reset();
            setShowDialog(true);
          }}
        >
          Pay Again
        </button>
      )}

      {error && (
        <StatusMessage type="error" title="Failed">
          {error}
        </StatusMessage>
      )}
      {paymentResult && <TransactionResult {...paymentResult} />}
    </ScenarioCard>
  );
}
```

3. **Register in App.tsx:** Add tab and route

That's it! You have a fully functional scenario with:

- Consistent UI
- State management
- Error handling
- Transaction display
- Network support

---

## 💡 Best Practices

1. **Always use `usePaymentFlow`** for payment state management
2. **Use `ScenarioCard`** as the container for all scenarios
3. **Use `StatusMessage`** for all error/success messages
4. **Use `TransactionResult`** for displaying transaction details
5. **Keep scenario-specific logic in the scenario component**, not in shared components
6. **Use the provided hooks** (NFTMintHook, RewardHook) as templates for your own hooks

---

## 📚 See Also

- [Showcase README](../README.md) - Overview and setup instructions
- [x402x Core SDK](../../../typescript/packages/core/) - Core utilities
- [x402x Client SDK](../../../typescript/packages/client/) - React client
