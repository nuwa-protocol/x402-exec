# Gas Metrics Monitoring Implementation

## Overview

This document describes the gas metrics monitoring system implemented for x402x facilitator to track and analyze the relationship between estimated facilitator fees and actual gas costs.

**Important**: Gas metrics are **internal monitoring data only** and are **NOT exposed to settle API clients**. They are used exclusively for:

- Internal logging
- Prometheus metrics
- Operational monitoring
- Performance analysis

## Architecture

### 1. Type Definitions (`typescript/packages/core/src/types.ts`)

**GasMetrics Interface**:

```typescript
interface GasMetrics {
  gasUsed: string; // Actual gas used by the transaction
  effectiveGasPrice: string; // Effective gas price (in Wei)
  actualGasCostNative: string; // Actual gas cost in native token
  actualGasCostUSD: string; // Actual gas cost in USD
  facilitatorFee: string; // Facilitator fee charged (atomic units)
  facilitatorFeeUSD: string; // Facilitator fee in USD
  profitUSD: string; // Profit/loss (fee - cost) in USD
  profitMarginPercent: string; // Profit margin as percentage
  profitable: boolean; // Whether settlement was profitable
  hook: string; // Hook address
  nativeTokenPriceUSD: string; // Native token price used
}
```

**SettleResponseWithMetrics Interface**:
Extends standard `SettleResponse` with optional `gasMetrics` field.

### 2. Core Implementation (`typescript/packages/core/src/facilitator.ts`)

**calculateGasMetrics() Function**:

- Extracts gas information from transaction receipt
- Calculates actual gas cost in native token and USD
- Computes profit/loss metrics
- Returns comprehensive gas metrics

**Modified settleWithRouter() Function**:

- Now returns `SettleResponseWithMetrics`
- Calls `calculateGasMetrics()` after successful settlement
- Includes gas metrics in response for monitoring

### 3. Facilitator Layer (`facilitator/src/settlement.ts`)

**Enhanced settleWithRouter() Function**:

- Accepts optional `nativeTokenPrices` parameter
- Enhances gas metrics with actual token prices
- Logs detailed gas metrics for successful settlements
- **Warns** when settlements are unprofitable

**Logging Output**:

**Success Log** (INFO level):

```json
{
  "transaction": "0x...",
  "payer": "0x...",
  "network": "base-sepolia",
  "hook": "0x...",
  "gasMetrics": {
    "gasUsed": "85234",
    "effectiveGasPrice": "1000000000",
    "actualGasCostNative": "0.000085234",
    "actualGasCostUSD": "0.003209",
    "facilitatorFee": "5000",
    "facilitatorFeeUSD": "0.005000",
    "profitUSD": "0.001791",
    "profitMarginPercent": "35.82",
    "profitable": true
  }
}
```

**Unprofitable Warning** (WARN level):

```json
{
  "transaction": "0x...",
  "network": "base-sepolia",
  "hook": "0x...",
  "facilitatorFeeUSD": "0.003000",
  "actualGasCostUSD": "0.004500",
  "lossUSD": "-0.001500",
  "lossPercent": "50%",
  "message": "⚠️ UNPROFITABLE SETTLEMENT: Facilitator fee did not cover gas costs"
}
```

### 4. Metrics Recording (`facilitator/src/routes/settle.ts`)

**Important**: Gas metrics are extracted and recorded internally, but **NOT returned to API clients**.

The settle endpoint:

1. Receives `SettleResponseWithMetrics` from the settlement layer
2. Extracts and records gas metrics for monitoring
3. Returns only the standard `SettleResponse` to the client

```typescript
// Extract gas metrics for internal monitoring
if (response.success && response.gasMetrics) {
  const metrics = response.gasMetrics;

  // Record Prometheus metrics
  recordHistogram("facilitator.settlement.gas_used", parseInt(metrics.gasUsed), {...});
  recordHistogram("facilitator.settlement.gas_cost_usd", parseFloat(metrics.actualGasCostUSD), {...});
  // ... more metrics
}

// Return ONLY standard fields to client (no gas metrics)
return {
  success: response.success,
  transaction: response.transaction,
  network: response.network,
  payer: response.payer,
  errorReason: response.errorReason,
  // gasMetrics is intentionally NOT included
};
```

**Client Response (Standard SettleResponse)**:

```json
{
  "success": true,
  "transaction": "0xabc...123",
  "network": "base-sepolia",
  "payer": "0x1234...5678"
}
```

**Internal Logs Include Full Metrics**:

```json
{
  "level": "info",
  "message": "SettlementRouter transaction confirmed with gas metrics",
  "transaction": "0xabc...123",
  "network": "base-sepolia",
  "hook": "0xdef...456",
  "gasMetrics": {
    "gasUsed": "85234",
    "actualGasCostUSD": "0.003209",
    "facilitatorFeeUSD": "0.005000",
    "profitUSD": "0.001791",
    "profitMarginPercent": "35.82",
    "profitable": true
  }
}
```

**Prometheus Metrics**:

1. **facilitator.settlement.gas_used** (histogram)

   - Gas used by settlement transaction
   - Labels: `network`, `hook`

2. **facilitator.settlement.gas_cost_usd** (histogram)

   - Actual gas cost in USD
   - Labels: `network`, `hook`

3. **facilitator.settlement.facilitator_fee_usd** (histogram)

   - Facilitator fee charged in USD
   - Labels: `network`, `hook`

4. **facilitator.settlement.profit_usd** (histogram)

   - Profit/loss per settlement in USD
   - Labels: `network`, `hook`

5. **facilitator.settlement.profitable** (counter)
   - Binary indicator of profitability (1 = profitable, 0 = unprofitable)
   - Labels: `network`, `hook`

## Data Privacy and Security

### Why Gas Metrics Are Internal-Only

1. **Business Confidentiality**:

   - Facilitator's cost structure and profit margins are sensitive business information
   - Exposing this data could be exploited by competitors

2. **Separation of Concerns**:

   - Clients only need to know if their payment succeeded
   - Internal operational metrics shouldn't leak to external APIs

3. **API Simplicity**:

   - Standard x402 SettleResponse format is maintained
   - No breaking changes to existing clients

4. **Security**:
   - Prevents potential information disclosure vulnerabilities
   - Reduces attack surface

### Where Gas Metrics Are Available

✅ **Internal Use** (Facilitator Operators Only):

- Server logs (structured JSON)
- Prometheus metrics endpoint (if exposed, should be protected)
- Internal monitoring dashboards
- Log aggregation systems (e.g., ELK, Grafana)

❌ **NOT Available**:

- Public settle API responses
- Client-facing endpoints
- Third-party integrations

## Usage

### For Facilitator Operators

1. **Monitor Logs**:

   ```bash
   # Watch for unprofitable settlements
   tail -f facilitator.log | grep "UNPROFITABLE"

   # Extract gas metrics
   tail -f facilitator.log | jq 'select(.gasMetrics)'
   ```

2. **Query Metrics** (if Prometheus is enabled):

   ```promql
   # Average profit per network
   avg by (network) (facilitator_settlement_profit_usd)

   # Unprofitable settlement rate
   rate(facilitator_settlement_profitable{profitable="0"}[1h])

   # Gas usage by hook
   histogram_quantile(0.95, facilitator_settlement_gas_used{hook="0x..."})
   ```

3. **Adjust Safety Multiplier**:
   Based on metrics, adjust `GAS_COST_SAFETY_MULTIPLIER` in `.env`:
   ```
   # If seeing many unprofitable settlements
   GAS_COST_SAFETY_MULTIPLIER=1.5  # Increase from default 1.2
   ```

### For Developers

**Important**: Gas metrics are internal only and not exposed via the settle API.

**Accessing Gas Metrics Internally** (facilitator code):

```typescript
const result = await settleWithRouter(
  signer,
  paymentPayload,
  paymentRequirements,
  allowedRouters,
  nativeTokenPrices,
);

// Gas metrics are available internally
if (result.success && result.gasMetrics) {
  // Log for monitoring
  logger.info({ gasMetrics: result.gasMetrics }, "Settlement metrics");

  // Record for Prometheus
  recordHistogram("gas_used", parseInt(result.gasMetrics.gasUsed));

  // DO NOT return to client
  // return result; // ❌ Wrong - includes gasMetrics

  // Return only standard fields
  return {
    success: result.success,
    transaction: result.transaction,
    network: result.network,
    payer: result.payer,
  }; // ✅ Correct - no gasMetrics
}
```

**Client-Side** (what clients receive):

```typescript
// Clients only receive standard SettleResponse
const response = await fetch("/settle", {
  method: "POST",
  body: JSON.stringify({ paymentPayload, paymentRequirements }),
});

const result = await response.json();
// result = {
//   success: true,
//   transaction: "0x...",
//   network: "base-sepolia",
//   payer: "0x..."
// }
// No gasMetrics field
```

## Key Metrics to Monitor

### 1. Profit Margin

- **Target**: > 20%
- **Warning**: < 10%
- **Critical**: < 0% (unprofitable)

### 2. Gas Usage Accuracy

- Compare `gasUsed` with estimated `gasLimit`
- Significant variance indicates need for gas limit adjustments

### 3. Unprofitable Rate

- **Target**: < 1%
- **Warning**: > 5%
- **Action Required**: > 10%

### 4. Hook-Specific Performance

- Different hooks have different gas costs
- Monitor each hook independently
- Adjust per-hook gas limits if needed

## Troubleshooting

### High Unprofitable Rate

**Possible Causes**:

1. Safety multiplier too low
2. Gas price volatility
3. Token price inaccurate
4. Hook gas usage higher than estimated

**Solutions**:

1. Increase `GAS_COST_SAFETY_MULTIPLIER`
2. Enable dynamic gas price fetching
3. Verify token price sources
4. Update hook gas limits in whitelist

### Gas Metrics Not Appearing

**Checklist**:

1. Ensure `gasCost` config is passed to settle routes
2. Verify `nativeTokenPrice` is configured for the network
3. Check that settlement was successful (`response.success === true`)
4. Confirm using SettlementRouter mode (not direct settlement)

## Future Enhancements

### Short-term (Already Discussed)

- [ ] Data persistence (database storage)
- [ ] Analytics API endpoints
- [ ] Dashboard visualization
- [ ] Alert system for unprofitable settlements

### Long-term

- [ ] Dynamic safety multiplier adjustment
- [ ] Machine learning gas prediction
- [ ] Competitive pricing analysis
- [ ] Hook-specific optimization

## Configuration

### Environment Variables

```bash
# Gas Cost Configuration
GAS_COST_ENABLED=true
GAS_COST_SAFETY_MULTIPLIER=1.2

# Native Token Prices (USD)
NATIVE_TOKEN_PRICE_BASE_SEPOLIA=3000
NATIVE_TOKEN_PRICE_X_LAYER_TESTNET=50

# Dynamic Gas Price (Optional)
DYNAMIC_GAS_PRICE_ENABLED=true
DYNAMIC_GAS_PRICE_RPC_BASE_SEPOLIA=https://...
```

## Example Analysis Queries

### Using Structured Logs (jq)

```bash
# Calculate average profit margin
cat facilitator.log | jq -s '
  [.[] | select(.gasMetrics) | .gasMetrics.profitMarginPercent | tonumber]
  | add / length
'

# Count unprofitable settlements
cat facilitator.log | jq -s '
  [.[] | select(.gasMetrics and .gasMetrics.profitable == false)] | length
'

# Group by hook and calculate stats
cat facilitator.log | jq -s '
  group_by(.gasMetrics.hook) |
  map({
    hook: .[0].gasMetrics.hook,
    count: length,
    avg_profit: ([.[].gasMetrics.profitUSD | tonumber] | add / length),
    unprofitable_count: ([.[] | select(.gasMetrics.profitable == false)] | length)
  })
'
```

## References

- [Gas Cost Estimation](../facilitator/README.md#gas-cost-estimation)
- [Dynamic Fee Calculation](../facilitator/README.md#dynamic-facilitator-fee-calculation)
- [Prometheus Metrics](../facilitator/docs/metrics.md)
