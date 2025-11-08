# Gas Cost Configuration Design Analysis

## Current Structure Issues

### Global Parameters (but should be network-specific)

1. **`baseGasLimit`**: Base gas for settlement operations

   - Currently: Single value for all networks
   - Problem: Different networks have different costs
   - Example: Ethereum L1 vs L2 rollups

2. **`safetyMultiplier`**: Buffer for gas price volatility

   - Currently: Single multiplier (1.5x)
   - Problem: Different networks have different volatility
   - Example: Mainnet (1.5x) vs Testnet (1.2x)

3. **`hookGasOverhead`**: Extra gas for hook execution
   - Currently: By hook type only
   - Problem: Same hook type costs differently on different networks

## Proposed Improved Structure

### Option A: Nested Network Configuration (Recommended)

```typescript
export interface NetworkGasCostConfig {
  baseGasLimit: number;
  hookGasOverhead: Record<string, number>;
  safetyMultiplier: number;
  gasPrice: string;
  nativeTokenPrice: number;
  allowedHooks: string[];
}

export interface GasCostConfig {
  // Global settings
  enabled: boolean;
  maxGasLimit: number;
  hookWhitelistEnabled: boolean;

  // Network-specific settings
  networks: Record<string, NetworkGasCostConfig>;

  // Fallback defaults
  defaults: {
    baseGasLimit: number;
    hookGasOverhead: Record<string, number>;
    safetyMultiplier: number;
  };
}
```

**Usage:**

```typescript
const networkConfig = config.networks[network] || {
  ...config.defaults,
  gasPrice: "1000000000",
  nativeTokenPrice: 100,
  allowedHooks: [],
};
```

### Option B: Keep Current + Add Overrides (Simpler Migration)

```typescript
export interface GasCostConfig {
  // Global defaults
  enabled: boolean;
  baseGasLimit: number;
  hookGasOverhead: Record<string, number>;
  safetyMultiplier: number;
  maxGasLimit: number;
  hookWhitelistEnabled: boolean;

  // Network-specific (current)
  networkGasPrice: Record<string, string>;
  nativeTokenPrice: Record<string, number>;
  allowedHooks: Record<string, string[]>;

  // Network-specific overrides (NEW)
  networkBaseGasLimit?: Record<string, number>;
  networkSafetyMultiplier?: Record<string, number>;
  networkHookGasOverhead?: Record<string, Record<string, number>>;
}
```

**Usage:**

```typescript
const baseGasLimit = config.networkBaseGasLimit?.[network] || config.baseGasLimit;
const safetyMultiplier = config.networkSafetyMultiplier?.[network] || config.safetyMultiplier;
```

## Environment Variables

### Option A Structure:

```env
# Global defaults
GAS_COST_BASE_LIMIT=150000
GAS_COST_SAFETY_MULTIPLIER=1.5
GAS_COST_HOOK_TRANSFER_OVERHEAD=50000

# Network-specific overrides
BASE_SEPOLIA_BASE_GAS_LIMIT=150000
BASE_SEPOLIA_SAFETY_MULTIPLIER=1.5
BASE_SEPOLIA_TARGET_GAS_PRICE=1000000000
BASE_SEPOLIA_ETH_PRICE=3000
BASE_SEPOLIA_HOOK_TRANSFER_OVERHEAD=50000

X_LAYER_TESTNET_BASE_GAS_LIMIT=120000
X_LAYER_TESTNET_SAFETY_MULTIPLIER=1.2
X_LAYER_TESTNET_TARGET_GAS_PRICE=100000000
X_LAYER_TESTNET_ETH_PRICE=50
X_LAYER_TESTNET_HOOK_TRANSFER_OVERHEAD=40000
```

### Option B Structure (Current + Overrides):

```env
# Global defaults
GAS_COST_BASE_LIMIT=150000
GAS_COST_SAFETY_MULTIPLIER=1.5
GAS_COST_HOOK_TRANSFER_OVERHEAD=50000
GAS_COST_MAX_GAS_LIMIT=500000

# Network-specific (current)
BASE_SEPOLIA_TARGET_GAS_PRICE=1000000000
BASE_SEPOLIA_ETH_PRICE=3000

# Optional network-specific overrides (NEW)
# BASE_SEPOLIA_BASE_GAS_LIMIT=150000
# BASE_SEPOLIA_SAFETY_MULTIPLIER=1.5
# BASE_SEPOLIA_HOOK_TRANSFER_OVERHEAD=50000
```

## Recommendation

**Use Option B** for the following reasons:

1. **Backward Compatible**: Existing configs continue to work
2. **Simpler Migration**: No breaking changes
3. **Flexible**: Can override per-network when needed
4. **Practical**: Most networks can share defaults, only exceptions need overrides

### Implementation Priority

1. **Phase 1** (Current - Good enough): ✅

   - Global: baseGasLimit, safetyMultiplier, hookGasOverhead
   - Per-network: gasPrice, nativeTokenPrice, allowedHooks
   - Works well for most cases

2. **Phase 2** (Optional enhancement):
   - Add optional network-specific overrides
   - Only implement when there's real need
   - Examples: Different L1 vs L2, or specific network quirks

## Real-World Network Differences

### Base Sepolia (Ethereum L2 - Optimistic Rollup)

- Base Gas: ~150k (moderate)
- Safety Multiplier: 1.3-1.5x (stable L2)
- Gas Price: ~1 gwei (cheap L2)
- ETH Price: $3,000

### X-Layer Testnet (OKC-based)

- Base Gas: ~120k (efficient)
- Safety Multiplier: 1.2x (testnet, stable)
- Gas Price: ~0.1 gwei (very cheap testnet)
- OKB Price: $50

### Ethereum Mainnet (Hypothetical)

- Base Gas: ~150k
- Safety Multiplier: 2.0x (high volatility)
- Gas Price: ~50 gwei (expensive L1)
- ETH Price: $3,000

## Conclusion

**Current implementation is adequate** for most use cases. The global parameters work because:

- Most EVM networks have similar gas consumption patterns
- Network-specific gas prices and token prices are already configurable
- Safety multiplier can be adjusted globally for all networks

**Network-specific overrides only needed if:**

- Operating on very different network types (L1 vs L2 vs Sidechain)
- Some networks have significantly different gas costs
- Need fine-tuned control for mainnet vs testnet

For now, **no immediate changes needed**. The current design is pragmatic and sufficient.

---

# Gas Price Strategy Analysis

## Current Implementation: Static Configuration

### How It Works

```typescript
// From environment variables or defaults
const gasPrice = config.networkGasPrice[network]; // e.g., "1000000000" (1 gwei)
```

### Pros ✅

1. **Performance**: <1ms, pure computation, no RPC calls
2. **Reliability**: No external dependencies
3. **Predictability**: Stable fees, good user experience
4. **Simplicity**: Configure once and done

### Cons ❌

1. **Accuracy**: May not reflect real network conditions
2. **Manual Updates**: Requires configuration changes when market shifts
3. **Potential Waste**: Over-estimation leads to higher fees

## Alternative Approaches

### Option 1: Dynamic (Chain Query) 🔗

**Fetch gas price from RPC in real-time**

```typescript
const client = createPublicClient({ transport: http(rpcUrl) });
const gasPrice = await client.getGasPrice();
```

**Pros**:

- ✅ Real-time accuracy
- ✅ Auto-adapts to network conditions
- ✅ Fair pricing for both facilitator and users

**Cons**:

- ❌ Performance: +100-200ms per request
- ❌ RPC dependency: Service may fail
- ❌ Rate limits: Need to cache

### Option 2: Hybrid (Recommended) 🎯

**Background updater + cache + static fallback**

```typescript
// Cache updated every 1-5 minutes in background
const cached = gasPriceCache.get(network);
if (cached && !expired(cached)) {
  return cached.gasPrice; // Fast: <1ms
}

// Fallback to static config if cache miss or RPC fails
return config.networkGasPrice[network];
```

**Architecture**:

```
┌─────────────────────────────────────┐
│  Request: Calculate Min Fee         │
└────────────────┬────────────────────┘
                 │
                 ▼
         ┌───────────────┐
         │  Gas Price?   │
         └───────┬───────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
   [In Cache?]        [Static Config]
        │                 │
    Yes │ No              │ (Fallback)
        │  │              │
        ▼  │              │
   Return  │              │
   Cached  │              │
           ▼              │
      [Fetch RPC] ────────┘
           │     (on fail)
           ▼
      Update Cache
           │
           ▼
        Return

Background Thread:
  Every 1-5 min → Fetch RPC → Update Cache
```

**Implementation Strategy**:

```typescript
// Phase 1: Static (Current) ✅
// - Simple, reliable
// - Good enough for testnets and stable networks

// Phase 2: Hybrid (Optional Enhancement)
export interface DynamicGasPriceConfig {
  strategy: "static" | "dynamic" | "hybrid";
  cacheTTL: number; // 300 seconds (5 min)
  updateInterval: number; // 60 seconds (1 min)
  rpcUrls: Record<string, string>;
}
```

### Option 3: Oracle-based 📡

**Use price oracle services (CoinGecko, Chainlink, etc.)**

**Pros**:

- ✅ Aggregated data (more reliable)
- ✅ Historical data available
- ✅ Can get token prices too

**Cons**:

- ❌ External service dependency
- ❌ API rate limits / costs
- ❌ Latency
- ❌ Over-engineered for gas price

## Comparison Table

| Strategy             | Latency   | Accuracy  | Reliability | Complexity | Cost      |
| -------------------- | --------- | --------- | ----------- | ---------- | --------- |
| **Static** (current) | <1ms      | Medium    | Very High   | Very Low   | None      |
| **Dynamic**          | 100-200ms | Very High | Medium      | Medium     | RPC calls |
| **Hybrid** (cached)  | <1ms\*    | High      | High        | Medium     | RPC calls |
| **Oracle**           | 200-500ms | High      | Medium      | High       | API costs |

\*Most requests hit cache

## Recommendation

### For Current Implementation: Keep Static ✅

**Reasons**:

1. **Testnets are stable**: Gas prices don't fluctuate much
2. **Performance matters**: Fast response for good UX
3. **Simplicity**: Fewer moving parts, easier to maintain
4. **Safety multiplier compensates**: 1.5x buffer handles small variations

### For Future Enhancement: Hybrid

**When to implement**:

- ⚠️ Moving to mainnet (more volatility)
- ⚠️ Gas prices become unpredictable
- ⚠️ Users complain about fees being too high/low

**Implementation steps**:

1. Add `dynamic-gas-price.ts` module (already created)
2. Add RPC URL configuration
3. Start background updater on server start
4. Monitor cache hit rate and RPC failures
5. Keep static config as fallback

**Configuration**:

```env
# Gas price strategy (default: static)
GAS_PRICE_STRATEGY=hybrid

# Cache TTL (seconds, default: 300)
GAS_PRICE_CACHE_TTL=300

# Background update interval (seconds, default: 60)
GAS_PRICE_UPDATE_INTERVAL=60

# RPC URLs for gas price fetching
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
X_LAYER_TESTNET_RPC_URL=https://testrpc.xlayer.tech
```

## Code Example: Hybrid Implementation

```typescript
// In gas-cost.ts
import { getGasPrice } from "./dynamic-gas-price.js";

export async function calculateMinFacilitatorFee(
  network: string,
  hook: string,
  tokenDecimals: number,
  config: GasCostConfig,
  dynamicConfig?: DynamicGasPriceConfig,
): Promise<FeeCalculationResult> {
  // ... validation ...

  // Get gas price (supports static/dynamic/hybrid)
  const gasPrice = await getGasPrice(network, config, dynamicConfig);

  // ... rest of calculation ...
}
```

```typescript
// In index.ts
import { startGasPriceUpdater } from "./dynamic-gas-price.js";

async function main() {
  // Start background updater if using dynamic/hybrid strategy
  if (config.gasCost.strategy !== "static") {
    const cleanup = startGasPriceUpdater(
      config.network.evmNetworks,
      config.gasCost,
      config.dynamicGasPrice,
    );

    shutdownManager.onShutdown(() => cleanup());
  }

  // ... rest of server setup ...
}
```

## Native Token Price

Similar considerations apply to native token prices (ETH, OKB, etc.):

**Current**: Static configuration (from env vars)
**Alternative**: Query from price APIs (CoinGecko, CoinMarketCap)
**Recommendation**:

- Static is sufficient for now (prices change slowly)
- Can add periodic price updates in future (daily/hourly)
- Use conservative estimates (slightly higher) for safety

## Summary

**Current Approach (Static)**:

- ✅ Perfect for testnet development
- ✅ Simple and reliable
- ✅ Good enough for MVP

**Next Step (Hybrid)**:

- 🔮 Consider when moving to mainnet
- 🔮 Implement if fee complaints arise
- 🔮 Monitor RPC reliability before committing

**Do NOT implement**:

- ❌ Pure dynamic (too risky, performance cost)
- ❌ Oracle-based (over-engineered)
- ❌ Complex prediction models (unnecessary)

The static approach is **pragmatic and sufficient**. Only add complexity when real-world usage demands it.
