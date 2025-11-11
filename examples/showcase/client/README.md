# X402 Showcase Client

A React-based showcase application demonstrating the x402 payment protocol with various payment scenarios.

## Features

- 💳 **Simple Direct Payment** - Basic x402 payment flow
- 🔀 **Referral Split** - Payment splitting between multiple recipients
- 🎨 **NFT Mint** - Purchase and mint NFTs with payment
- 🎁 **Points Reward** - Earn rewards with payments

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 10.7.0+
- A MetaMask or compatible Web3 wallet
- Base Sepolia testnet USDC (for testing)

### Development

```bash
# From repository root
pnpm install
git submodule update --init --recursive
pnpm run build:x402

# Start development server
cd examples/showcase/client
pnpm run dev
```

Visit `http://localhost:5173` in your browser.

### Configuration

The client connects to a showcase server for payment processing. Configuration is done via environment variables:

**Development** (default):
- Uses Vite proxy to connect to `localhost:3001`
- No configuration needed

**Production**:
- Set `VITE_SERVER_URL` environment variable to your server URL
- Example: `VITE_SERVER_URL=https://showcase-server.railway.app`

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── WalletConnect.tsx    # Wallet connection UI
│   ├── PaymentStatus.tsx    # Payment status display
│   └── DebugPanel.tsx       # Debug information panel
├── hooks/           # React hooks
│   ├── usePayment.ts        # Payment flow logic
│   └── useWallet.ts         # Wallet interaction
├── scenarios/       # Payment scenario demos
│   ├── DirectPayment.tsx    # Simple payment
│   ├── ReferralSplit.tsx    # Payment splitting
│   ├── RandomNFT.tsx        # NFT purchase
│   └── PointsReward.tsx     # Reward distribution
├── utils/           # Utility functions
│   └── commitment.ts        # Commitment hash calculation
├── config.ts        # Configuration management
├── wagmi.config.ts  # Wagmi/Web3 configuration
└── App.tsx          # Main application component
```

## Key Technologies

- **React 18** - UI framework
- **Viem** - Ethereum library
- **Wagmi** - React hooks for Ethereum
- **Vite** - Build tool and dev server
- **x402-fetch** - x402 protocol client library

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_SERVER_URL` | Backend server URL | No | Empty (uses relative paths/proxy) |

## Building for Production

```bash
# Build optimized bundle
pnpm run build

# Preview production build locally
pnpm run preview
```

The build output will be in the `dist/` directory.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Cloudflare Pages deployment
- Vercel deployment
- Netlify deployment
- Same-origin deployment
- CORS configuration
- Troubleshooting

## Development Tips

### Testing with Different Networks

The client is configured for Base Sepolia testnet by default. To use a different network:

1. Update `wagmi.config.ts` with your desired chain
2. Ensure the showcase server supports the same network
3. Get testnet tokens from the appropriate faucet

### Debugging Payments

The client includes comprehensive console logging:
- Open browser DevTools console
- Look for logs prefixed with `[Payment]`
- Check the Debug Panel in the UI for detailed information

### CORS Issues

During development, if you see CORS errors:
1. Ensure the server has CORS properly configured
2. Verify the proxy configuration in `vite.config.ts`
3. Check that `VITE_SERVER_URL` matches the server URL

## License

MIT

## Related Documentation

- [Server Deployment Guide](../server/DEPLOYMENT.md)
- [Facilitator Documentation](../../facilitator/README.md)
- [x402 Protocol Specification](https://github.com/x402-protocol/x402-spec)


## 🔧 Development Configuration

### Facilitator URL Configuration

The showcase client supports configuring the facilitator URL for local development and debugging.

#### Quick Start

1. **Copy the environment template:**
   ```bash
   cp .env.example .env.local
   ```

2. **For local facilitator development:**
   ```bash
   # .env.local
   VITE_FACILITATOR_URL=http://localhost:3001
   ```

3. **Restart the dev server:**
   ```bash
   pnpm dev
   ```

#### Environment Variables

- `VITE_FACILITATOR_URL` - Facilitator service URL
  - Default: `https://facilitator.x402x.dev`
  - Local: `http://localhost:3001`
  
- `VITE_SERVER_URL` - Server URL (for Server Mode examples)
  - Default: Empty (uses relative paths/Vite proxy)
  - Local: `http://localhost:3000`

#### Debug Panel

The app includes a **Facilitator Debug Panel** in the bottom-right corner that shows:
- Current facilitator URL
- ⚠️ Warning when using local facilitator
- Instructions for changing configuration

#### Examples

**Production (default):**
```env
VITE_FACILITATOR_URL=https://facilitator.x402x.dev
```

**Local development:**
```env
VITE_FACILITATOR_URL=http://localhost:3001
```

**Custom facilitator:**
```env
VITE_FACILITATOR_URL=https://my-facilitator.example.com
```

#### Testing Local Facilitator

1. Start local facilitator:
   ```bash
   cd facilitator
   pnpm dev
   ```

2. Configure showcase client:
   ```bash
   cd examples/showcase/client
   echo "VITE_FACILITATOR_URL=http://localhost:3001" > .env.local
   pnpm dev
   ```

3. Check the debug panel - it should show a yellow warning indicating local mode.

