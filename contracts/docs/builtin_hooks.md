# Built-in Hooks

## Overview

Built-in Hooks are protocol-level Hook implementations that are deployed once per network and designed for universal use across all projects. They provide standard, battle-tested functionality for common payment scenarios.

## Why Built-in Hooks?

**Built-in vs Example Hooks:**

| Aspect | Built-in Hooks | Example Hooks |
|--------|----------------|---------------|
| **Purpose** | Protocol-level standard functionality | Educational templates & references |
| **Deployment** | Once per network, shared by all | Per-application deployment |
| **Location** | `contracts/src/hooks/` | `contracts/examples/` |
| **Usage** | Production-ready, optimized | Learning & customization |
| **Gas** | Minimal overhead | Varies by complexity |

## Available Built-in Hooks

### TransferHook

**Contract:** `contracts/src/hooks/TransferHook.sol`

#### Description

The most basic Hook that provides simple token transfers with facilitator fee support. This is the direct replacement for standard ERC-3009 `transferWithAuthorization` calls but with the added benefit of facilitator fee mechanism.

#### Use Cases

- Simple merchant payments
- Direct transfers with facilitator compensation
- Any scenario not requiring custom business logic
- Migrating from direct ERC-3009 transfers to SettlementRouter

#### Features

- ✅ Minimal gas overhead
- ✅ No hookData required
- ✅ Universal deployment (one instance for all projects)
- ✅ Fully compatible with SettlementRouter fee mechanism
- ✅ No fund holding (immediate transfer to recipient)

#### Parameters

The TransferHook uses standard `ISettlementHook` parameters:

```solidity
function execute(
    bytes32 contextKey,      // Settlement context ID
    address payer,           // Payer address
    address token,           // Token contract address
    uint256 amount,          // Amount (after facilitator fee deduction)
    bytes32 salt,            // Unique identifier
    address payTo,           // Final recipient address
    address facilitator,     // Facilitator address
    bytes calldata data      // Optional (not used, can be empty)
) external returns (bytes memory);
```

**Key Points:**
- `amount` is the net amount after facilitator fee has been deducted
- `payTo` specifies the final recipient
- `data` parameter is optional and not used by TransferHook

#### Usage Example

**PaymentRequirements Configuration:**

```json
{
  "scheme": "exact",
  "network": "eip155:84532",
  "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "maxAmountRequired": "1010000",
  "payTo": "0xSettlementRouter...",
  "resource": "https://api.example.com/resource",
  "description": "Premium content access",
  "mimeType": "application/json",
  "maxTimeoutSeconds": 60,
  "extra": {
    "settlementRouter": "0xSettlementRouter...",
    "salt": "0x1234...",
    "payTo": "0xMerchant...",
    "facilitatorFee": "10000",
    "hook": "0xTransferHook...",
    "hookData": "0x"
  }
}
```

**Flow:**

1. Client signs payment authorization for 1.01 USDC total
2. Facilitator calls `SettlementRouter.settleAndExecute`
3. Router transfers 1.01 USDC from client
4. Router accumulates 0.01 USDC as facilitator fee
5. TransferHook receives 1.00 USDC (net amount)
6. TransferHook transfers 1.00 USDC to merchant
7. Facilitator can claim accumulated fees later

#### Gas Cost

| Operation | Direct ERC-3009 | TransferHook | Overhead |
|-----------|-----------------|--------------|----------|
| Basic Transfer | ~50k gas | ~58k gas | ~8k gas (~16%) |

The additional ~8k gas provides:
- Facilitator fee mechanism
- Unified settlement architecture
- Event-based observability
- Future extensibility

#### Deployment Addresses

| Network | CAIP-2 Identifier | Address | Status |
|---------|------------------|---------|--------|
| Base Sepolia (Testnet) | `eip155:84532` | [`0x6b486aF5A08D27153d0374BE56A1cB1676c460a8`](https://sepolia.basescan.org/address/0x6b486aF5A08D27153d0374BE56A1cB1676c460a8) | ✅ Active |
| X-Layer Testnet | `eip155:1952` | [`0x3D07D4E03a2aDa2EC49D6937ab1B40a83F3946AB`](https://www.oklink.com/xlayer-test/address/0x3D07D4E03a2aDa2EC49D6937ab1B40a83F3946AB) | ✅ Active |
| Base Mainnet | `eip155:8453` | TBD | 🚧 Pending Audit |
| Ethereum Mainnet | `eip155:1` | TBD | 🚧 Pending Audit |

## Integration Guide

### For Resource Server Developers

#### Decision Flow

```
Does your payment need custom business logic?
│
├─ No → Use TransferHook (built-in)
│        ✅ Simple transfers
│        ✅ Facilitator fee support
│        ✅ Minimal gas cost
│
└─ Yes → Use appropriate Example Hook or create custom Hook
         - Revenue split → TransferHook (built-in)
         - NFT minting → NFTMintHook
         - Loyalty points → RewardHook
         - Custom logic → Implement ISettlementHook
```

#### Configuration Steps

1. **Detect scenario:**
   - Need facilitator fee? → Use TransferHook
   - Need custom logic? → Use or create specialized Hook

2. **Configure PaymentRequirements:**
   ```typescript
   const paymentRequirements = {
     // ... standard fields ...
     payTo: SETTLEMENT_ROUTER_ADDRESS,  // Router, not merchant
     extra: {
       settlementRouter: SETTLEMENT_ROUTER_ADDRESS,
       hook: TRANSFER_HOOK_ADDRESS,     // Built-in TransferHook
       hookData: "0x",                  // Empty for TransferHook
       payTo: MERCHANT_ADDRESS,         // Actual recipient
       facilitatorFee: "10000",         // Fee amount
       salt: generateSalt()             // Unique identifier
     }
   };
   ```

3. **Calculate commitment:**
   ```typescript
   const commitment = calculateSettlementCommitment({
     chainId,
     router: SETTLEMENT_ROUTER_ADDRESS,
     token: TOKEN_ADDRESS,
     from: PAYER_ADDRESS,
     value: TOTAL_AMOUNT,
     validAfter,
     validBefore,
     salt,
     payTo: MERCHANT_ADDRESS,
     facilitatorFee,
     hook: TRANSFER_HOOK_ADDRESS,
     hookData: "0x"
   });
   ```

### For Facilitator Developers

Built-in Hooks work the same as any other Hook from the facilitator's perspective. Follow the standard [Facilitator Developer Guide](./facilitator_guide.md).

**Key points:**
- Detect `extra.settlementRouter` presence
- Call `SettlementRouter.settleAndExecute` with all parameters
- Accumulated fees are claimed via `claimFees()`

## Migration Guide

### From Direct ERC-3009 to TransferHook

**Before (Direct Transfer):**

```typescript
// Resource Server
const paymentRequirements = {
  asset: TOKEN_ADDRESS,
  maxAmountRequired: "1000000",
  payTo: MERCHANT_ADDRESS,
  // ... other fields ...
};

// Facilitator
await token.transferWithAuthorization(
  from, to, value, validAfter, validBefore, nonce, signature
);
```

**After (TransferHook):**

```typescript
// Resource Server
const paymentRequirements = {
  asset: TOKEN_ADDRESS,
  maxAmountRequired: "1010000",  // Include facilitator fee
  payTo: SETTLEMENT_ROUTER_ADDRESS,
  extra: {
    settlementRouter: SETTLEMENT_ROUTER_ADDRESS,
    hook: TRANSFER_HOOK_ADDRESS,
    hookData: "0x",
    payTo: MERCHANT_ADDRESS,
    facilitatorFee: "10000",
    salt: generateSalt()
  }
};

// Facilitator
await settlementRouter.settleAndExecute(
  token, from, value, validAfter, validBefore, nonce, signature,
  salt, payTo, facilitatorFee, hook, hookData
);
```

**Benefits:**
- ✅ Facilitator gets compensated automatically
- ✅ Unified architecture for all payments
- ✅ Better observability through events
- ✅ Easy to extend to custom Hooks later

## Security Considerations

### Deployment Security

Built-in Hooks are:
- ✅ Immutable after deployment
- ✅ Audited by security professionals
- ✅ Deployed with verified constructor parameters
- ✅ Open source and publicly verifiable

### Usage Security

- **No hookData tampering:** All parameters are cryptographically committed in the nonce
- **No fund holding:** TransferHook transfers immediately, holds no balance
- **Reentrancy protected:** Inherits protection from SettlementRouter
- **Access controlled:** Only SettlementRouter can call execute()

## Best Practices

### When to Use Built-in Hooks

✅ **DO use built-in Hooks when:**
- You need standard functionality
- You want minimal gas costs
- You value battle-tested code
- You need universal addresses

❌ **DON'T use built-in Hooks when:**
- You need custom business logic
- You need to hold or distribute funds differently
- You need Hook-specific state or parameters

### Development Workflow

1. **Start with built-in Hooks** for MVP or simple use cases
2. **Profile gas costs** in your specific scenario
3. **Consider custom Hooks** when you need:
   - Revenue splitting
   - NFT minting
   - Token distribution
   - Escrow or delayed payments
   - Any custom business logic

## Testing

### Running Tests

```bash
cd contracts
forge test --match-contract TransferHookTest -vv
```

### Gas Profiling

```bash
forge test --match-contract TransferHookTest --gas-report
```

## Additional Resources

- **[Hook Development Guide](./hook_guide.md)** - Creating custom Hooks
- **[Facilitator Guide](./facilitator_guide.md)** - Integrating with facilitators
- **[API Documentation](./api.md)** - Contract interfaces
- **[Security Guide](./security.md)** - Security best practices

## Future Built-in Hooks

The protocol may add more built-in Hooks in the future based on community needs:

- **BatchTransferHook** - Multiple recipients in one transaction
- **StreamingHook** - Time-based payment streaming
- **ConditionalTransferHook** - Transfers with conditions

Have a suggestion? [Open an issue](https://github.com/nuwa-protocol/x402-exec/issues) on GitHub!

