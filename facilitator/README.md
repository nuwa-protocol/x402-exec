# X402 Facilitator

**Production-ready** implementation of an x402 facilitator service with **SettlementRouter support** for the x402-exec settlement framework. The facilitator supports both standard x402 payments and extended settlement flows with Hook-based business logic.

## Installation

### As a Package

Install via npm:

```bash
npm install @x402x/facilitator
```

Or via pnpm:

```bash
pnpm add @x402x/facilitator
```

### As a Service

Run using Docker:

```bash
docker pull nuwa-protocol/facilitator:latest
docker run -p 3000:3000 --env-file .env nuwa-protocol/facilitator:latest
```

Or clone and run from source (see [Development](#development) section below).

## Features

### 🔄 Dual-Mode Settlement Support

- **Standard Mode**: Direct ERC-3009 token transfers
- **SettlementRouter Mode**: Extended settlement with Hook execution
  - Atomic payment verification + business logic
  - Built-in facilitator fee mechanism
  - Support for revenue splitting, NFT minting, reward distribution, etc.

### 🔒 Security Features

- **Rate Limiting**: Protection against DoS/DDoS attacks
  - Per-endpoint rate limits (configurable via environment variables)
  - `/verify`: 100 req/min per IP (default)
  - `/settle`: 20 req/min per IP (default)
  - Health/monitoring endpoints unlimited
  - Returns HTTP 429 with `Retry-After` header when exceeded
- **Input Validation**: Deep validation beyond TypeScript types
  - Request body size limits (default: 1MB)
  - Zod schema validation for all inputs
  - Sanitized error messages (no internal detail leaks)
- **Hook Whitelist Security** 🆕: Protection against malicious Hook gas attacks
  - Only pre-approved Hooks are accepted
  - Network-specific Hook whitelists
  - Prevents unknown/malicious contracts from draining facilitator funds
- **Gas Limit Protection** 🆕: Maximum gas limit enforcement
  - Configurable gas limit cap per transaction (default: 500k)
  - Prevents excessive gas consumption even from whitelisted Hooks
  - Additional safety layer against gas attacks
- **Facilitator Fee Validation** 🆕: Ensures profitability
  - Automatic minimum fee calculation based on gas costs
  - Validates fees cover transaction costs before execution
  - Prevents facilitator from accepting unprofitable settlements
- **SettlementRouter Whitelist**: Only pre-configured, trusted SettlementRouter contracts are accepted
- **Network-Specific Validation**: Each network has its own whitelist of allowed router addresses
- **Case-Insensitive Matching**: Address validation works regardless of case
- **Comprehensive Error Messages**: Clear feedback when addresses are rejected
- **Structured Error Handling**: Type-safe error classification and recovery

### 📊 Production-Ready Observability

- **Structured Logging**: Using Pino for high-performance JSON logging
- **OpenTelemetry Integration**: Full distributed tracing and metrics
  - HTTP request tracing with automatic instrumentation
  - Settlement operation spans with detailed attributes
  - Business metrics (success rate, latency, gas usage)
  - Compatible with Honeycomb, Jaeger, and other OTLP backends
- **Comprehensive Metrics**:
  - `facilitator.verify.total` - Verification request count
  - `facilitator.verify.duration_ms` - Verification latency histogram
  - `facilitator.settle.total` - Settlement request count by mode
  - `facilitator.settle.duration_ms` - Settlement latency histogram
  - `facilitator.verify.errors` - Verification error count
  - `facilitator.settle.errors` - Settlement error count

### 🛡️ Reliability & Resilience

- **Graceful Shutdown**: Proper SIGTERM/SIGINT handling
  - Rejects new requests during shutdown
  - Waits for in-flight requests to complete (configurable timeout)
  - Cleans up resources properly
- **Smart Retry Mechanism**: Exponential backoff with jitter
  - RPC call retries for transient failures
  - Transaction confirmation retries
  - Configurable retry policies
- **Health Checks**: Kubernetes-compatible endpoints
  - `/health` - Liveness probe (process is alive)
  - `/ready` - Readiness probe (service is ready for traffic)

### 🎯 Auto-Detection

The facilitator automatically detects the settlement mode based on the presence of `extra.settlementRouter` in PaymentRequirements. No manual configuration needed!

### 🌐 Multi-Network Support

- **EVM Networks**:
  - Base Sepolia (testnet), Base (mainnet)
  - X-Layer Mainnet (Chain ID: 196)
  - X-Layer Testnet (Chain ID: 1952)
- **Solana**: Devnet support (standard mode only)

**Mainnet Note**: Mainnet networks are automatically supported through the SDK configuration. The facilitator will:
- Auto-load SettlementRouter addresses from `@x402x/core`
- Auto-load RPC URLs from viem chain definitions (or use environment variables if provided)
- Apply mainnet security policies (only SettlementRouter mode allowed)

## Quick Start

### Prerequisites

- Node.js v20+ ([install via nvm](https://github.com/nvm-sh/nvm))
- pnpm v10 ([install via pnpm.io/installation](https://pnpm.io/installation))
- A valid Ethereum private key
- Base Sepolia testnet ETH for transaction fees

### Development Setup

Clone the repository and install dependencies:

```bash
git clone https://github.com/nuwa-protocol/x402-exec.git
cd x402-exec
pnpm install
cd facilitator
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

# Rate Limiting (生产环境推荐启用)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_VERIFY_MAX=100  # verify 端点每分钟最大请求数
RATE_LIMIT_SETTLE_MAX=20   # settle 端点每分钟最大请求数
RATE_LIMIT_WINDOW_MS=60000 # 时间窗口（毫秒）

# Input Validation
REQUEST_BODY_LIMIT=1mb     # 请求体大小限制

# Logging level (default: info)
LOG_LEVEL=info

# OpenTelemetry configuration (optional)
# OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io:443
# OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=YOUR_API_KEY
# OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
# OTEL_SERVICE_NAME=x402-facilitator
# OTEL_SERVICE_VERSION=1.0.0
# OTEL_SERVICE_DEPLOYMENT=production
```

### Running the Facilitator

#### Development Mode

```bash
pnpm dev
```

#### Production Mode

```bash
pnpm build
pnpm start
```

The server will start on http://localhost:3000 (or the port specified in your `.env` file)

## Security Configuration

### Hook Whitelist & Gas Attack Protection 🆕

The facilitator implements multi-layer security against malicious Hook gas attacks:

#### Security Threat

Malicious Resource Servers could specify Hooks that consume excessive gas, causing:

1. **Financial Loss**: Facilitator pays gas costs but `facilitatorFee` is insufficient
2. **Resource Drain**: Signed authorizations wasted on unprofitable transactions
3. **Service Degradation**: Facilitator funds depleted

#### Multi-Layer Defense

**Layer 1: Hook Whitelist** (Primary Defense)

- Only pre-approved, audited Hooks are accepted
- Configured per network via environment variables
- Default: Automatically includes official TransferHook

**Layer 2: Gas Limit Cap** (Secondary Defense)

- Maximum gas limit enforced per transaction (default: 500k)
- Protects even against whitelisted Hook issues
- Configurable via `GAS_COST_MAX_GAS_LIMIT`

**Layer 3: Fee Validation** (Financial Protection)

- Calculates minimum required `facilitatorFee` based on gas costs
- Rejects transactions with insufficient fees
- Considers: gas limit, gas price (dynamic or static), native token price, safety multiplier
- Supports three gas price strategies: static, dynamic, and hybrid

#### Gas Price Strategies

The facilitator supports three strategies for obtaining gas prices:

**1. Static** (Manual Configuration)

- Uses fixed gas price values from environment variables
- Best for: Testing, stable networks, or when you want predictable fees
- Configuration: Set `*_TARGET_GAS_PRICE` for each network
- Pros: Fast (<1ms), reliable, predictable
- Cons: Requires manual updates, may not reflect market changes

**2. Dynamic** (Real-time Query)

- Queries gas price from RPC on every calculation
- Best for: Maximum accuracy when performance is not critical
- Configuration: Set `GAS_PRICE_STRATEGY=dynamic` + RPC URLs
- Pros: Real-time accuracy
- Cons: Slower (100-200ms per request), depends on RPC availability

**3. Hybrid** (Recommended, Default)

- Background thread updates cached gas prices periodically
- Falls back to static config if RPC fails
- Best for: Production use - combines speed and accuracy
- Configuration: Automatically enabled if no `*_TARGET_GAS_PRICE` is set
- Pros: Fast (<1ms), accurate, reliable fallback
- Cons: Slightly more complex setup

**Default Behavior:**

- If any `*_TARGET_GAS_PRICE` is set → Uses **static** strategy
- Otherwise → Uses **hybrid** strategy (fetches from chain)

#### Configuration

**For Production (Hybrid Strategy - Recommended):**

```env
# Gas price strategy (hybrid is default)
# GAS_PRICE_STRATEGY=hybrid

# RPC URLs for dynamic gas price fetching

# BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
# X_LAYER_TESTNET_RPC_URL=https://testrpc.xlayer.tech

# Cache configuration
GAS_PRICE_CACHE_TTL=300          # 5 minutes
GAS_PRICE_UPDATE_INTERVAL=60     # 1 minute

# Enable Hook whitelist (default: false, enable for production)
HOOK_WHITELIST_ENABLED=true

# Enable fee validation (default: true)
GAS_COST_VALIDATION_ENABLED=true

# Maximum gas limit per transaction
GAS_COST_MAX_GAS_LIMIT=500000

# Add trusted Hooks to whitelist
BASE_SEPOLIA_ALLOWED_HOOKS=0x6b486aF5A08D27153d0374BE56A1cB1676c460a8
X_LAYER_TESTNET_ALLOWED_HOOKS=0x3D07D4E03a2aDa2EC49D6937ab1B40a83F3946AB

# Native token prices (update periodically)
# ETH: https://www.coingecko.com/en/coins/ethereum
# OKB: https://www.coingecko.com/en/coins/okb
BASE_SEPOLIA_ETH_PRICE=3000
X_LAYER_TESTNET_ETH_PRICE=50

# Dynamic token pricing (enabled by default)
TOKEN_PRICE_ENABLED=true
TOKEN_PRICE_CACHE_TTL=3600
TOKEN_PRICE_UPDATE_INTERVAL=600
# COINGECKO_API_KEY=your_api_key_here  # Optional, for higher rate limits
```

**For Testing with Static Prices:**

```env
# Manually set gas prices (forces static strategy)
BASE_SEPOLIA_TARGET_GAS_PRICE=1000000000   # 1 gwei
X_LAYER_TESTNET_TARGET_GAS_PRICE=100000000 # 0.1 gwei

# ⚠️ Warning: Only for development/testing
HOOK_WHITELIST_ENABLED=false
GAS_COST_VALIDATION_ENABLED=false
```

**For Maximum Accuracy (Dynamic Strategy):**

```env
# Force dynamic strategy (queries RPC every time)
GAS_PRICE_STRATEGY=dynamic

# RPC URLs (auto from viem chains default value, optional override)
# BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
# X_LAYER_TESTNET_RPC_URL=https://testrpc.xlayer.tech
```

#### Fee Calculation Formula

```
1. Total Gas = BASE_LIMIT (150k) + HOOK_OVERHEAD (50k-100k)
2. Gas Price = From chain (hybrid/dynamic) OR config (static)
3. Gas Cost (Native Token) = Total Gas × Gas Price
4. Gas Cost (USD) = Native Token Amount × Token Price
5. Fee Required (USD) = Gas Cost × Safety Multiplier (1.5x)
6. Fee (USDC) = USD Amount × 10^6
```

**Example (Hybrid Strategy on Base Sepolia):**

```
- Gas Price: 1.5 gwei (fetched from chain)
- Gas: 200,000 × 1.5 gwei = 0.0003 ETH
- USD: 0.0003 ETH × $3,000 = $0.900
- With safety (1.5x): $0.900 × 1.5 = $1.350
- USDC: 1,350,000 (1.35 USDC with 6 decimals)
```

**Example (Static Strategy on X-Layer Testnet):**

```
- Gas Price: 0.1 gwei (from config)
- Gas: 200,000 × 0.1 gwei = 0.00002 OKB
- USD: 0.00002 OKB × $50 = $0.001
- With safety (1.5x): $0.001 × 1.5 = $0.0015
- USDC: 1,500 (0.0015 USDC with 6 decimals)
```

#### Native Token Price Management

The facilitator supports both **static** and **dynamic** token pricing strategies:

**Current Implementation**: Dynamic pricing enabled by default with CoinGecko API integration.

##### Configuration Options:

**1. Dynamic Pricing (Recommended, Default)**

Automatically fetch real-time token prices from CoinGecko API:

```env
# Enable dynamic pricing (default: true)
TOKEN_PRICE_ENABLED=true

# Cache TTL (default: 3600 seconds = 1 hour)
TOKEN_PRICE_CACHE_TTL=3600

# Background update interval (default: 600 seconds = 10 minutes)
TOKEN_PRICE_UPDATE_INTERVAL=600

# Optional: CoinGecko Pro API key for higher rate limits
# Free tier: 50 calls/minute
# Pro tier: 500 calls/minute ($129/month)
COINGECKO_API_KEY=your_api_key_here
```

**2. Static Pricing (Fallback)**

Use fixed prices configured via environment variables:

```env
# Disable dynamic pricing
TOKEN_PRICE_ENABLED=false

# Set static prices (updated manually)
BASE_SEPOLIA_ETH_PRICE=3000  # $3000/ETH
X_LAYER_TESTNET_ETH_PRICE=50 # $50/OKB
```

##### Price Sources:

- **CoinGecko**: https://www.coingecko.com/ (default for dynamic pricing)
  - ETH: https://www.coingecko.com/en/coins/ethereum
  - OKB: https://www.coingecko.com/en/coins/okb
- **CoinMarketCap**: https://coinmarketcap.com/ (alternative)
- **DEX Aggregators**: On-chain price feeds

##### Advantages of Dynamic Pricing:

✅ **Auto-updated** - No manual intervention required  
✅ **Real-time** - Reflects market prices (with 10-minute updates)  
✅ **Cached** - Minimal API calls, excellent performance  
✅ **Fallback** - Uses static prices if API fails  
✅ **Free** - Works with CoinGecko free tier

##### Impact of Outdated Prices (Static Mode):

- **If price is too LOW**: Facilitator charges insufficient fees (loses money on gas)
- **If price is too HIGH**: Facilitator charges excessive fees (poor UX, users go elsewhere)
- **Recommendation**: Use dynamic pricing or update static prices weekly with 1.5x safety multiplier

##### Custom Coin IDs:

If needed, override default CoinGecko coin IDs:

```env
# Defaults (usually no need to change):
# BASE_SEPOLIA_COIN_ID=ethereum
# X_LAYER_TESTNET_COIN_ID=okb
```

#### Adding New Hooks to Whitelist

1. **Audit the Hook contract** thoroughly
2. Test on testnet extensively
3. Add address to environment variable:
   ```env
   BASE_SEPOLIA_ALLOWED_HOOKS=0xHook1,0xHook2,0xHook3
   ```
4. Restart facilitator to load new configuration
5. Verify with `/min-facilitator-fee?network=base-sepolia&hook=0xHook1`

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

### GET /health

Health check endpoint for liveness probes (e.g., Kubernetes).

**Response Example:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 12345.67
}
```

### GET /ready

Readiness check endpoint for readiness probes. Validates that:

- Private keys are configured
- SettlementRouter whitelist is configured
- Service is not shutting down

**Response Example (Ready):**

```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "privateKeys": { "status": "ok" },
    "settlementRouterWhitelist": { "status": "ok" },
    "shutdown": { "status": "ok" },
    "activeRequests": { "status": "ok", "message": "0 active request(s)" }
  }
}
```

**Response Example (Not Ready):**

```json
{
  "status": "not_ready",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "privateKeys": { "status": "error", "message": "No private keys configured" },
    "settlementRouterWhitelist": { "status": "ok" },
    "shutdown": { "status": "error", "message": "Shutdown in progress" },
    "activeRequests": { "status": "ok", "message": "2 active request(s)" }
  }
}
```

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

**Security Validations:**

- Hook whitelist check (if SettlementRouter mode)
- Gas limit validation (max: 500k)
- Facilitator fee minimum requirement check

### GET /min-facilitator-fee 🆕

Query minimum facilitator fee for a specific network and hook. Resource Servers should call this endpoint to determine appropriate `facilitatorFee` values.

**Query Parameters:**

- `network` (required): Network name (e.g., `base-sepolia`)
- `hook` (required): Hook contract address

**Response Example (Hook allowed):**

```json
{
  "network": "base-sepolia",
  "hook": "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
  "hookAllowed": true,
  "minFacilitatorFee": "45000000",
  "minFacilitatorFeeUSD": "45.00",
  "breakdown": {
    "gasLimit": 200000,
    "maxGasLimit": 500000,
    "gasPrice": "50000000000",
    "gasCostNative": "0.01",
    "gasCostUSD": "30.00",
    "safetyMultiplier": 1.5,
    "finalCostUSD": "45.00"
  },
  "token": {
    "address": "0x036CbD...",
    "symbol": "USDC",
    "decimals": 6
  },
  "prices": {
    "nativeToken": "3000.00",
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

**Response Example (Hook not allowed):**

```json
{
  "network": "base-sepolia",
  "hook": "0xmalicious...",
  "hookAllowed": false,
  "error": "Hook not in whitelist"
}
```

**Integration Guide for Resource Servers:**

1. Before generating PaymentRequirements, query this endpoint
2. Use returned `minFacilitatorFee` as `facilitatorFee` in the PaymentRequirements
3. Cache the result for 5-10 minutes to reduce API calls
4. Handle `hookAllowed: false` responses appropriately

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

| Field              | Type    | Description                                      |
| ------------------ | ------- | ------------------------------------------------ |
| `settlementRouter` | address | SettlementRouter contract address                |
| `salt`             | bytes32 | Unique identifier for idempotency (32 bytes hex) |
| `payTo`            | address | Final recipient address (for transparency)       |
| `facilitatorFee`   | uint256 | Facilitator fee amount in token's smallest unit  |
| `hook`             | address | Hook contract address (address(0) = no hook)     |
| `hookData`         | bytes   | Encoded hook parameters                          |

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

3. **Monitoring**:
   - Track settlement success rates (target: >99%)
   - Monitor P99 latency (target: <30s)
   - Alert on high error rates
   - Monitor active request counts
   - Track RPC endpoint health
   - Log all transactions for reconciliation and auditing

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Facilitator Server                 │
│  ┌──────────────────────────────────────────┐  │
│  │         Observability Layer              │  │
│  │  - Structured Logging (Pino)             │  │
│  │  - OpenTelemetry Tracing                 │  │
│  │  - Metrics Collection                    │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │         Reliability Layer                │  │
│  │  - Graceful Shutdown                     │  │
│  │  - Health Checks                         │  │
│  │  - Retry Mechanism                       │  │
│  │  - Error Classification                  │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │         Business Logic                   │  │
│  │  POST /settle                            │  │
│  │       ↓                                  │  │
│  │  isSettlementMode()?                     │  │
│  │       ↓                ↓                 │  │
│  │     Yes              No                  │  │
│  │       ↓                ↓                 │  │
│  │  settleWithRouter  settle (standard)     │  │
│  │       ↓                                  │  │
│  │  SettlementRouter.settleAndExecute()     │  │
│  │       ↓                                  │  │
│  │  Hook.execute()                          │  │
│  │       ↓                                  │  │
│  │  Business Logic                          │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Error Handling

The facilitator handles various error scenarios:

| Error                          | Cause                                                                      | Response                       |
| ------------------------------ | -------------------------------------------------------------------------- | ------------------------------ |
| `invalid_payment_requirements` | Missing/invalid extra parameters or **untrusted SettlementRouter address** | 400 with error details         |
| `invalid_network`              | Unsupported network                                                        | 400 with error details         |
| `invalid_transaction_state`    | Transaction reverted                                                       | Settlement response with error |
| `unexpected_settle_error`      | Unexpected error during settlement                                         | Settlement response with error |

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

### Security Hardening

The facilitator includes production-grade security features enabled by default:

#### Rate Limiting

Protects against DoS/DDoS attacks and API abuse:

**Configuration:**

```env
# Enable/disable rate limiting (default: true)
RATE_LIMIT_ENABLED=true

# Limits per IP address per time window
RATE_LIMIT_VERIFY_MAX=100  # /verify endpoint
RATE_LIMIT_SETTLE_MAX=20   # /settle endpoint
RATE_LIMIT_WINDOW_MS=60000 # Time window (1 minute)
```

**Behavior:**

- Returns HTTP 429 when limit exceeded
- Includes `RateLimit-*` headers in responses
- Includes `Retry-After` header when rate limited
- Monitoring endpoints (`/health`, `/ready`, `/supported`) are unlimited

**Development vs Production:**

- Development: Can disable with `RATE_LIMIT_ENABLED=false`
- Production: **Keep enabled** to prevent abuse

#### Input Validation

Multiple layers of protection:

**Request Body Size Limits:**

```env
REQUEST_BODY_LIMIT=1mb  # Prevents memory exhaustion attacks
```

**Schema Validation:**

- All inputs validated with Zod schemas
- Type checking beyond TypeScript
- Automatic rejection of malformed requests

**Error Sanitization:**

- No internal error details leaked to clients
- Stack traces never exposed in responses
- Clear, actionable error messages for legitimate issues

#### Secret Management (Roadmap)

Current implementation uses environment variables for private keys. For production:

**Recommended for Production:**

- AWS KMS for AWS deployments
- HashiCorp Vault for multi-cloud
- Kubernetes Secrets for K8s environments

**Current (Development/Testing):**

- Environment variables (`.env` file)
- **Never commit `.env` to version control**
- Use separate keys for dev/staging/prod

### Observability

#### Structured Logging

The facilitator uses Pino for structured JSON logging with the following features:

- **Development**: Pretty-printed colored logs for readability
- **Production**: JSON logs optimized for log aggregation systems
- **Log Levels**: `trace`, `debug`, `info`, `warn`, `error`, `fatal`
- **Context**: All logs include service name, version, and environment

Configure logging:

```env
LOG_LEVEL=info  # or debug, warn, error
NODE_ENV=production  # disables pretty printing
```

#### OpenTelemetry Integration

Enable distributed tracing and metrics by setting OTLP environment variables:

**Honeycomb Example:**

```env
OTEL_EXPORTER_OTLP_ENDPOINT=https://api.honeycomb.io:443
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=YOUR_API_KEY
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_SERVICE_NAME=x402-facilitator
OTEL_SERVICE_VERSION=1.0.0
OTEL_SERVICE_DEPLOYMENT=production
```

**Jaeger Example:**

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
```

**Available Metrics:**

- Request counts by endpoint and status
- Settlement success/failure rates by network and mode
- Latency histograms (P50, P95, P99)
- Error rates by type
- Active request counts

**Available Traces:**

- HTTP request spans with method, URL, status
- Settlement operation spans with network, mode, transaction hash
- Verification spans with validation details

### Kubernetes Deployment

The facilitator includes health check endpoints compatible with Kubernetes:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: x402-facilitator
spec:
  containers:
    - name: facilitator
      image: nuwa-protocol/facilitator:latest
      ports:
        - containerPort: 3000
      env:
        - name: EVM_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: facilitator-secrets
              key: evm-private-key
      livenessProbe:
        httpGet:
          path: /health
          port: 3000
        initialDelaySeconds: 10
        periodSeconds: 30
      readinessProbe:
        httpGet:
          path: /ready
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 10
      lifecycle:
        preStop:
          exec:
            command: ["/bin/sh", "-c", "sleep 15"]
```

### Graceful Shutdown

The facilitator handles SIGTERM and SIGINT signals gracefully:

1. **Signal received**: Logs shutdown initiation
2. **Stop accepting new requests**: Returns 503 for new requests
3. **Wait for in-flight requests**: Up to 30 seconds (configurable)
4. **Run cleanup handlers**: Close connections, flush telemetry
5. **Exit cleanly**: Process exits with code 0

This ensures zero request drops during rolling updates or scaling operations.

### Error Handling & Retry

The facilitator includes production-grade error handling:

**Error Classification:**

- `ConfigurationError` - Missing/invalid config (not recoverable)
- `ValidationError` - Invalid payment data (not recoverable)
- `SettlementError` - Transaction/RPC errors (may be recoverable)
- `RpcError` - Network issues (recoverable with retry)
- `NonceError` - Nonce conflicts (recoverable with retry)

**Retry Policies:**

- **RPC Calls**: 5 attempts, exponential backoff (500ms - 10s)
- **Transaction Confirmation**: 60 attempts, slow growth (2s - 5s), 2min timeout
- **Jitter**: Random ±25% to prevent thundering herd

### Security Best Practices

For production use, consider:

1. **Security Configuration**:

   - **Enable rate limiting** (default: enabled)
   - Set appropriate request body limits (default: 1MB)
   - Review and adjust rate limits based on expected traffic
   - Monitor rate limit metrics to detect attacks

2. **Secret Management**:

   - Use production-grade secret management (KMS/Vault)
   - Never store private keys in environment variables for production
   - Rotate keys regularly
   - Use different keys for different environments

3. **Network Security**:

   - Use HTTPS/TLS for all connections
   - Configure proper CORS policies
   - Deploy behind a WAF (Web Application Firewall)
   - Use private networks for internal communication

4. **Monitoring**:
   - Track settlement success rates (target: >99%)
   - Monitor P99 latency (target: <30s)
   - Alert on high error rates
   - Monitor rate limit hits (may indicate attacks)
   - Track request sizes to detect anomalies
   - Log all transactions for reconciliation and auditing

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
