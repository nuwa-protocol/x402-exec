# @x402x/react

React hooks for the x402x settlement framework.

## Features

- 🎣 **React Hooks**: Easy-to-use hooks for payment flows
- 🔄 **Automatic Mode Detection**: Seamlessly handles settlement vs standard mode
- 💰 **Wagmi Integration**: Built on top of wagmi for wallet management
- 🎯 **TypeScript**: Full type safety
- ⚡ **Lightweight**: Minimal dependencies

## Installation

```bash
npm install @x402x/react @x402x/core
# Also install peer dependencies if not already installed
npm install react wagmi viem
```

## Quick Start

```typescript
import { useX402Payment } from '@x402x/react';
import { WagmiProvider } from 'wagmi';

function PaymentButton() {
  const { pay, status, error, result } = useX402Payment();

  const handlePay = async () => {
    try {
      const data = await pay('/api/protected-resource');
      console.log('Payment successful:', data);
    } catch (err) {
      console.error('Payment failed:', err);
    }
  };

  return (
    <div>
      <button
        onClick={handlePay}
        disabled={status === 'paying'}
      >
        {status === 'paying' ? 'Processing...' : 'Pay'}
      </button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && <p>Success! {JSON.stringify(result)}</p>}
    </div>
  );
}

function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <PaymentButton />
    </WagmiProvider>
  );
}
```

## API Reference

### `useX402Payment(options?)`

Main hook for handling x402x payments.

#### Parameters

- `options.maxValue` (optional): Maximum allowed payment amount in base units (default: 0.1 USDC)

#### Returns

```typescript
{
  status: 'idle' | 'paying' | 'success' | 'error',
  error: string | null,
  result: any,
  pay: (url: string, init?: RequestInit) => Promise<any>,
  reset: () => void,
  isConnected: boolean,
  address: string | undefined,
}
```

#### Properties

- **`status`**: Current payment status

  - `'idle'`: No payment in progress
  - `'paying'`: Payment is being processed
  - `'success'`: Payment completed successfully
  - `'error'`: Payment failed

- **`error`**: Error message if payment failed

- **`result`**: Payment result data if successful

- **`pay(url, init?)`**: Function to make a payment

  - Returns a Promise that resolves to the response data
  - Automatically handles 402 responses
  - Uses commitment-based nonce for settlement mode

- **`reset()`**: Reset payment state to idle

- **`isConnected`**: Whether wallet is connected (from wagmi)

- **`address`**: User's wallet address (from wagmi)

## Examples

### Basic Payment

```typescript
function BasicPayment() {
  const { pay, status } = useX402Payment();

  return (
    <button onClick={() => pay('/api/content')}>
      {status === 'paying' ? 'Processing...' : 'Pay'}
    </button>
  );
}
```

### With Error Handling

```typescript
function PaymentWithError() {
  const { pay, status, error } = useX402Payment();

  const handlePay = async () => {
    try {
      await pay('/api/content');
      alert('Payment successful!');
    } catch (err) {
      // Error is already captured in the error state
      console.error('Payment failed:', err);
    }
  };

  return (
    <div>
      <button onClick={handlePay} disabled={status === 'paying'}>
        Pay
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

### With Custom Max Value

```typescript
function CustomMaxPayment() {
  const { pay } = useX402Payment({
    maxValue: BigInt(1 * 10 ** 6), // 1 USDC max
  });

  return (
    <button onClick={() => pay('/api/premium-content')}>
      Pay (max 1 USDC)
    </button>
  );
}
```

### With Result Display

```typescript
function PaymentWithResult() {
  const { pay, status, result } = useX402Payment();

  return (
    <div>
      <button onClick={() => pay('/api/content')}>
        Pay
      </button>

      {status === 'success' && result && (
        <div>
          <h3>Content Unlocked!</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
```

### Full Example with Wagmi

```typescript
import { useX402Payment } from '@x402x/react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { WagmiProvider, createConfig } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

const config = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
});

function PaymentApp() {
  const { pay, status, error, isConnected, address } = useX402Payment();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (!isConnected) {
    return (
      <div>
        <h2>Connect Your Wallet</h2>
        {connectors.map((connector) => (
          <button key={connector.id} onClick={() => connect({ connector })}>
            Connect {connector.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div>
      <p>Connected: {address}</p>
      <button onClick={() => disconnect()}>Disconnect</button>

      <hr />

      <button
        onClick={() => pay('/api/premium-content')}
        disabled={status === 'paying'}
      >
        {status === 'paying' ? 'Processing Payment...' : 'Pay for Content'}
      </button>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <PaymentApp />
    </WagmiProvider>
  );
}
```

## How It Works

1. **Wallet Connection**: Uses wagmi's `useAccount` and `useWalletClient` hooks
2. **Mode Detection**: Automatically detects settlement mode by checking `extra.settlementRouter`
3. **Nonce Generation**:
   - Settlement mode: Uses commitment hash (binds all parameters)
   - Standard mode: Uses random nonce (standard x402)
4. **Payment Execution**: Signs EIP-712 authorization and retries request with payment header
5. **State Management**: Tracks payment status, errors, and results

## Requirements

- React 18+
- Wagmi 2+
- A configured Wagmi provider wrapping your app

## Related Packages

- [`@x402x/core`](../core): Core utilities and types
- [`x402`](https://github.com/coinbase/x402): Base x402 protocol

## License

Apache-2.0
