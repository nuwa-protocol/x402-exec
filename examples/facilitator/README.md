# x402-exec Facilitator Example

This is a **production-grade** implementation of an x402 facilitator service with **SettlementRouter support** for the x402-exec settlement framework. It demonstrates how to build a facilitator that supports both standard x402 payments and extended settlement flows with Hook-based business logic.

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
      image: your-registry/x402-facilitator:latest
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
