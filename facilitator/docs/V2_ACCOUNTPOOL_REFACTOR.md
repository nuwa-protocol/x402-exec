# V2 AccountPool Refactor - Implementation Summary

## Overview

Successfully refactored the x402 Facilitator V2 implementation to use the shared V1 AccountPool, enabling V2 to benefit from multi-account support, queue management, and duplicate payer detection.

## Motivation

**Before:**
- V1 used AccountPool with multi-account support (`EVM_PRIVATE_KEY_1`, `EVM_PRIVATE_KEY_2`, etc.)
- V2 only used a single `EVM_PRIVATE_KEY` 
- V2 had no queue management or duplicate payer detection
- V2 created its own wallet clients independently

**After:**
- Both V1 and V2 use the same shared AccountPool
- V2 benefits from all AccountPool features:
  - Multi-account parallel processing
  - Serial queue per account (to avoid nonce conflicts)
  - Round-robin account selection
  - Duplicate payer detection (to prevent double-spending)
  - Queue depth limits

## Architecture Changes

### Before
```
V1: Request → PoolManager → AccountPool → v1Settle
V2: Request → RouterSettlementFacilitator (single key) → v2Settle
```

### After
```
V1: Request → PoolManager → AccountPool → v1Settle
V2: Request → PoolManager → AccountPool → v2Settle (new)
```

## Implementation Details

### 1. Extended V2 Settlement API

**File:** `typescript/packages/facilitator_v2/src/settlement.ts`

Added `executeSettlementWithWalletClient()` function to accept external WalletClient:

```typescript
export async function executeSettlementWithWalletClient(
  walletClient: WalletClient,
  publicClient: PublicClient,
  paymentRequirements: any,
  paymentPayload: any,
  config: { ... }
): Promise<SettleResponse>
```

This allows V2 settlement to use signers provided by AccountPool.

### 2. Refactored VersionDispatcher

**File:** `facilitator/src/version-dispatcher.ts`

Modified `settleV2()` to execute through AccountPool:

```typescript
private async settleV2(...): Promise<SettleResponse> {
  // Get account pool (same as V1)
  const accountPool = this.deps.poolManager.getPool(network);
  
  // Execute in account pool with payer address for duplicate detection
  return accountPool.execute(async (signer) => {
    // Use signer from AccountPool to execute V2 settlement
    return executeSettlementWithWalletClient(signer, ...);
  }, paymentPayload.payer);
}
```

Key changes:
- Removed separate `v2Facilitator` instance
- V2 now uses AccountPool.execute() like V1
- Passes payer address for duplicate detection
- Uses dynamic imports for V2 modules

### 3. Simplified Configuration

**File:** `facilitator/src/config.ts`

Removed V2-specific private key configuration:

```typescript
export interface V2Config {
  enabled: boolean;
  // Removed: signer?: string;
  // Removed: privateKey?: string;
  allowedRouters?: Record<string, string[]>;
}
```

V2 now uses the shared `evmPrivateKeys` configuration.

### 4. Updated Application Initialization

**Files:**
- `facilitator/src/index.ts`
- `facilitator/src/routes/index.ts`
- `facilitator/src/routes/settle.ts`
- `facilitator/src/routes/verify.ts`

Removed passing of `v2Signer` and `v2PrivateKey` to routes and VersionDispatcher.

### 5. Added Comprehensive Tests

**File:** `facilitator/test/unit/version-dispatcher-v2-accountpool.test.ts`

Created 6 test cases to verify:
- ✅ V2 uses AccountPool.execute for settlement
- ✅ Multiple accounts work in parallel for V2
- ✅ Payer address passed for duplicate detection
- ✅ Errors from AccountPool handled gracefully
- ✅ V1 and V2 work together using same AccountPool
- ✅ V2 verification doesn't use AccountPool (read-only)

All tests pass! (352 tests total)

## Configuration Changes

### Before
```env
# V1 accounts
EVM_PRIVATE_KEY_1=0x...
EVM_PRIVATE_KEY_2=0x...

# V2 separate config (removed)
FACILITATOR_V2_SIGNER=0x...
EVM_PRIVATE_KEY=0x...  # Used only for V2
```

### After
```env
# Shared accounts for V1 and V2
EVM_PRIVATE_KEY_1=0x...
EVM_PRIVATE_KEY_2=0x...
EVM_PRIVATE_KEY_3=0x...

# V2 config (simplified)
FACILITATOR_ENABLE_V2=true
FACILITATOR_V2_ALLOWED_ROUTERS={"eip155:84532":["0x..."]}
```

## Benefits

1. **Code Reuse**: V2 benefits from all AccountPool features without duplication
2. **Multi-Account Support**: V2 can now use multiple accounts for parallel processing
3. **Queue Management**: Serial queue per account prevents nonce conflicts
4. **Duplicate Detection**: Prevents double-spend attempts across V1 and V2
5. **Simpler Configuration**: One set of private keys for both V1 and V2
6. **Better Scalability**: Round-robin account selection distributes load

## Testing Results

All 352 tests pass:
- 26 test files passed
- 352 tests passed
- New V2 AccountPool integration tests: 6/6 passed

## Files Modified

### Core Implementation
1. `typescript/packages/facilitator_v2/src/settlement.ts` - Added `executeSettlementWithWalletClient()`
2. `typescript/packages/facilitator_v2/src/index.ts` - Exported new function
3. `facilitator/src/version-dispatcher.ts` - Refactored V2 settlement to use AccountPool
4. `facilitator/src/config.ts` - Simplified V2Config

### Application Setup
5. `facilitator/src/index.ts` - Removed V2 separate config passing
6. `facilitator/src/routes/index.ts` - Updated VersionDispatcher creation
7. `facilitator/src/routes/settle.ts` - Updated SettleRouteDependencies
8. `facilitator/src/routes/verify.ts` - Updated VerifyRouteDependencies

### Tests
9. `facilitator/test/unit/version-dispatcher-v2-accountpool.test.ts` - New comprehensive test suite

## Migration Guide

No breaking changes for existing deployments:

1. V1 continues to work exactly as before
2. V2 now automatically uses the same account pool as V1
3. If you had separate V2 config, you can remove:
   - `FACILITATOR_V2_SIGNER` (no longer used)
   - Separate `EVM_PRIVATE_KEY` for V2 (uses numbered keys now)

## Conclusion

The refactor successfully unifies V1 and V2 account management, providing V2 with enterprise-grade features from AccountPool while maintaining backward compatibility and improving code maintainability.

