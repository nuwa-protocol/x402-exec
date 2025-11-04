# x402-exec Facilitator Example

This is an example implementation of an x402 facilitator service with **SettlementRouter support** for the x402-exec settlement framework. It demonstrates how to build a facilitator that supports both standard x402 payments and extended settlement flows with Hook-based business logic.

## Features

### 🔄 Dual-Mode Settlement Support

- **Standard Mode**: Direct ERC-3009 token transfers
- **SettlementRouter Mode**: Extended settlement with Hook execution
  - Atomic payment verification + business logic
  - Built-in facilitator fee mechanism
  - Support for revenue splitting, NFT minting, reward distribution, etc.

### 🔒 Security Features

- **SettlementRouter Whitelist**: Only pre-configured, trusted SettlementRouter contracts are accepted
- **Network-Specific Validation**: Each network has its own whitelist of allowed router addresses
- **Case-Insensitive Matching**: Address validation works regardless of case
- **Comprehensive Error Messages**: Clear feedback when addresses are rejected

### 🎯 Auto-Detection

The facilitator automatically detects the settlement mode based on the presence of `extra.settlementRouter` in PaymentRequirements. No manual configuration needed!

### 🌐 Multi-Network Support

- **EVM Networks**: 
  - Base Sepolia (testnet), Base (mainnet)
  - X-Layer Mainnet (Chain ID: 196)
  - X-Layer Testnet (Chain ID: 1952)
- **Solana**: Devnet support (standard mode only)

## Quick Start

### Prerequisites

- Node.js v20+ ([install via nvm](https://github.com/nvm-sh/nvm))
- pnpm v10 ([install via pnpm.io/installation](https://pnpm.io/installation))
- A valid Ethereum private key
- Base Sepolia testnet ETH for transaction fees

### Installation

From the project root:

```bash
cd examples/facilitator
pnpm install
```

### Configuration

1. Copy the example environment file:

```bash
cp env.example .env
```

2. Edit `.env` and add your private key:

```env
# Required: Your facilitator wallet private key
EVM_PRIVATE_KEY=0xYourPrivateKeyHere

# Optional: Solana support
# SVM_PRIVATE_KEY=your_solana_private_key_base58
# SVM_RPC_URL=https://api.devnet.solana.com

# SettlementRouter addresses (following project naming convention)
BASE_SEPOLIA_SETTLEMENT_ROUTER_ADDRESS=0x32431d4511e061f1133520461b07ec42aff157d6

# X-Layer SettlementRouter addresses (deploy contracts and update these)
X_LAYER_SETTLEMENT_ROUTER_ADDRESS=0x...  # X-Layer Mainnet SettlementRouter address
X_LAYER_TESTNET_SETTLEMENT_ROUTER_ADDRESS=0x...  # X-Layer Testnet SettlementRouter address

# Server port (default: 3000)
PORT=3000
```

### Running the Facilitator

```bash
pnpm dev
```

The server will start on http://localhost:3000

## Security Configuration

### SettlementRouter Whitelist

For security, the facilitator only accepts SettlementRouter addresses that are explicitly configured in environment variables. This prevents malicious resource servers from specifying arbitrary contract addresses.

**Startup Log Example:**
```
x402-exec Facilitator listening at http://localhost:3000
  - Standard x402 settlement: ✓
  - SettlementRouter support: ✓
  - Security whitelist: ✓

SettlementRouter Whitelist:
  base-sepolia: 0x32431D4511e061F1133520461B07eC42afF157D6
  x-layer-testnet: 0x1ae0e196dc18355af3a19985faf67354213f833d
  base: (not configured)
  x-layer: (not configured)
```

**Security Benefits:**
- 🛡️ **Prevents malicious contracts**: Only trusted SettlementRouter addresses are accepted
- 🔍 **Network isolation**: Each network has its own whitelist
- 📝 **Audit trail**: All validation attempts are logged
- ❌ **Clear rejections**: Detailed error messages for invalid addresses

**Adding New Networks:**
1. Deploy SettlementRouter contract on the new network
2. Add the address to your `.env` file using the correct naming convention
3. Restart the facilitator to load the new configuration

## API Endpoints

### GET /supported

Returns the payment kinds that the facilitator supports.

**Response Example:**
```json
{
  "kinds": [
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "base-sepolia"
    },
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "x-layer"
    },
    {
      "x402Version": 1,
      "scheme": "exact",
      "network": "x-layer-testnet"
    }
  ]
}
```

### POST /verify

Verifies an x402 payment payload without executing it.

**Request Body:**
```typescript
{
  "paymentPayload": PaymentPayload,
  "paymentRequirements": PaymentRequirements
}
```

**Response:**
```typescript
{
  "isValid": boolean,
  "invalidReason"?: string
}
```

### POST /settle

Settles an x402 payment. Automatically detects and routes between standard and SettlementRouter modes.

**Request Body:**
```typescript
{
  "paymentPayload": PaymentPayload,
  "paymentRequirements": PaymentRequirements
}
```

**Response:**
```typescript
{
  "success": boolean,
  "transaction": string,    // Transaction hash
  "network": string,
  "payer": string,
  "errorReason"?: string
}
```

## SettlementRouter Integration

### What is SettlementRouter?

SettlementRouter is an extended settlement framework that enables:
- **Atomic Operations**: Payment verification + business logic in one transaction
- **Hook Execution**: Custom on-chain logic executed after payment
- **Facilitator Fees**: Built-in fee mechanism for permissionless facilitators
- **Idempotency**: Guaranteed once-only settlement

### How It Works

The facilitator detects SettlementRouter mode by checking for `extra.settlementRouter` in the PaymentRequirements:

```json
{
  "scheme": "exact",
  "network": "base-sepolia",
  "asset": "0x...",
  "maxAmountRequired": "1000000",
  "payTo": "0x...",
  "extra": {
    "settlementRouter": "0x32431d4511e061f1133520461b07ec42aff157d6",
    "salt": "0x1234...",
    "payTo": "0xabc...",
    "facilitatorFee": "10000",
    "hook": "0xdef...",
    "hookData": "0x..."
  }
}
```

When detected, the facilitator calls `SettlementRouter.settleAndExecute()` instead of the standard `transferWithAuthorization()`.

### Settlement Extra Parameters

| Field | Type | Description |
|-------|------|-------------|
| `settlementRouter` | address | SettlementRouter contract address |
| `salt` | bytes32 | Unique identifier for idempotency (32 bytes hex) |
| `payTo` | address | Final recipient address (for transparency) |
| `facilitatorFee` | uint256 | Facilitator fee amount in token's smallest unit |
| `hook` | address | Hook contract address (address(0) = no hook) |
| `hookData` | bytes | Encoded hook parameters |

### Example Flow

1. **Client** receives 402 response with SettlementRouter parameters
2. **Client** signs EIP-3009 authorization with commitment as nonce
3. **Client** sends payment to facilitator
4. **Facilitator** detects SettlementRouter mode (auto)
5. **Facilitator** calls `SettlementRouter.settleAndExecute()`
6. **SettlementRouter** verifies commitment and executes Hook
7. **Hook** performs business logic (e.g., mint NFT, split revenue)

### Supported Hooks

The facilitator works with any Hook that implements the `ISettlementHook` interface:

- **RevenueSplitHook**: Multi-party payment distribution
- **NFTMintHook**: Atomic NFT minting with payment
- **RewardHook**: Loyalty points distribution
- **Custom Hooks**: Any business logic you can imagine!

See [contracts/examples/](../../contracts/examples/) for Hook implementations.

## Testing

### Test with curl

Standard payment:
```bash
curl -X POST http://localhost:3000/settle \
  -H "Content-Type: application/json" \
  -d '{
    "paymentPayload": {...},
    "paymentRequirements": {...}
  }'
```

SettlementRouter payment:
```bash
curl -X POST http://localhost:3000/settle \
  -H "Content-Type: application/json" \
  -d '{
    "paymentPayload": {...},
    "paymentRequirements": {
      "extra": {
        "settlementRouter": "0x32431d4511e061f1133520461b07ec42aff157d6",
        ...
      }
    }
  }'
```

### Integration Testing

Use the [showcase](../showcase/) application for end-to-end testing with real Hook examples.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Facilitator Server                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  POST /settle                                   │
│       ↓                                         │
│  isSettlementMode()?                            │
│       ↓                ↓                        │
│     Yes              No                         │
│       ↓                ↓                        │
│  settleWithRouter  settle (x402 standard)       │
│       ↓                                         │
│  SettlementRouter.settleAndExecute()            │
│       ↓                                         │
│  Hook.execute()                                 │
│       ↓                                         │
│  Business Logic                                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Error Handling

The facilitator handles various error scenarios:

| Error | Cause | Response |
|-------|-------|----------|
| `invalid_payment_requirements` | Missing/invalid extra parameters or **untrusted SettlementRouter address** | 400 with error details |
| `invalid_network` | Unsupported network | 400 with error details |
| `invalid_transaction_state` | Transaction reverted | Settlement response with error |
| `unexpected_settle_error` | Unexpected error during settlement | Settlement response with error |

### Security Error Examples

**Untrusted SettlementRouter:**
```json
{
  "error": "Invalid request: Settlement router 0x1234... is not in whitelist for network base-sepolia. Allowed addresses: 0x32431D4511e061F1133520461B07eC42afF157D6"
}
```

**Unconfigured Network:**
```json
{
  "error": "Invalid request: No allowed settlement routers configured for network: base. Please configure environment variables for this network."
}
```

## Production Deployment

For production use, consider:

1. **Use Production Facilitators**:
   - Testnet: https://x402.org/facilitator
   - Production: https://api.cdp.coinbase.com/platform/v2/x402

2. **Security Considerations**:
   - Secure private key storage (e.g., AWS KMS, HashiCorp Vault)
   - Rate limiting to prevent abuse
   - Request validation and sanitization
   - HTTPS/TLS for all connections

3. **Monitoring**:
   - Track settlement success rates
   - Monitor gas usage
   - Alert on failed settlements
   - Log all transactions for reconciliation

## Further Reading

### Documentation

- **[Facilitator Developer Guide](../../contracts/docs/facilitator_guide.md)** - Complete language-agnostic integration guide with detailed examples in pseudocode
- **[SettlementRouter API](../../contracts/docs/api.md)** - Contract interface documentation with all functions and events
- **[Hook Development Guide](../../contracts/docs/hook_guide.md)** - Build custom Hooks for your business logic
- **[x402 Protocol](https://github.com/coinbase/x402)** - Official x402 specification

### Integration Guides

If you're extending an existing facilitator in another language:
- See the [Facilitator Developer Guide](../../contracts/docs/facilitator_guide.md) for step-by-step integration instructions
- This TypeScript implementation serves as a reference for any language

## License

Apache-2.0 - see [LICENSE](../../LICENSE) for details

