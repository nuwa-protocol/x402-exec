# Commitment-Based Payment Integration Guide

## Overview

This document explains how the Settlement Showcase integrates the commitment-based security model into the x402 payment flow.

## Architecture

### The Problem

The standard x402 library generates a **random nonce** for EIP-3009 authorization:

```typescript
// Standard x402 behavior
const nonce = randomBytes(32); // Random value
```

However, the X402 Settlement Hub requires the **nonce to equal a commitment hash** that binds all settlement parameters:

```solidity
// SettlementHub.sol
bytes32 commitment = keccak256(abi.encodePacked(
    "X402/settle/v1",
    block.chainid,
    address(this),  // hub
    token,
    from,
    value,
    validAfter,
    validBefore,
    salt,
    payTo,
    facilitatorFee,
    hook,
    keccak256(hookData)
));

require(nonce == commitment, "InvalidCommitment");
```

### The Solution

We implement a custom payment flow that:
1. Calculates the commitment hash from settlement parameters
2. Uses this commitment as the EIP-3009 nonce
3. Manually constructs and signs the payment payload

## Payment Flow

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │
       │ 1. POST /api/scenario-X/payment
       ↓
┌─────────────────┐
│ Resource Server │
│   (Node.js)     │
└────────┬────────┘
         │
         │ 2. 402 Payment Required
         │    + salt (UUID)
         │    + payTo
         │    + facilitatorFee
         │    + hook
         │    + hookData
         ↓
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 3. Calculate Commitment
       │    nonce = keccak256(abi.encodePacked(...))
       │
       │ 4. Sign EIP-3009 with commitment as nonce
       │    signature = signTypedData({...nonce})
       │
       │ 5. POST with X-PAYMENT header
       ↓
┌─────────────────┐
│ Resource Server │
└────────┬────────┘
         │
         │ 6. Forward to Facilitator
         ↓
┌─────────────────┐
│   Facilitator   │
└────────┬────────┘
         │
         │ 7. Call SettlementHub.settleAndExecute()
         ↓
┌─────────────────┐
│ SettlementHub   │
│   (On-chain)    │
└────────┬────────┘
         │
         │ 8. Recalculate commitment
         │    Calculate from on-chain parameters
         │
         │ 9. Verify nonce == commitment ✓
         │
         │ 10. Execute settlement
         └─→ Success!
```

## Implementation Details

### 1. Server Side (`server/src/scenarios/*.ts`)

Each scenario generates unique settlement parameters in the 402 response:

```typescript
import { generateSalt } from '../utils/commitment.js';

export async function generateRewardPayment(params: RewardParams = {}) {
  const salt = generateSalt(); // Random UUID as bytes32
  const facilitatorFee = '10000'; // 0.01 USDC
  const hookData = encodeRewardData({ ... });
  
  return {
    scheme: 'exact',
    network: 'base-sepolia',
    maxAmountRequired: '100000',
    asset: USDC_ADDRESS,
    payTo: SETTLEMENT_HUB_ADDRESS,
    extra: {
      // EIP-712 domain
      name: 'USDC',
      version: '2',
      
      // Settlement parameters (NEW!)
      settlementHub: SETTLEMENT_HUB_ADDRESS,
      salt,
      payTo: merchant,
      facilitatorFee,
      hook: REWARD_HOOK_ADDRESS,
      hookData,
    },
  };
}
```

### 2. Client Side (`client/src/hooks/usePayment.ts`)

The client manually constructs the payment flow:

```typescript
import { calculateCommitment } from '../utils/commitment';

async function pay(endpoint: string) {
  // Step 1: Get 402 response
  const response = await fetch(endpoint);
  const { accepts } = await response.json();
  const { extra } = accepts[0];
  
  // Step 2: Calculate commitment (becomes nonce)
  const nonce = calculateCommitment({
    chainId: await walletClient.getChainId(),
    hub: extra.settlementHub,
    token: accepts[0].asset,
    from: walletClient.account.address,
    value: accepts[0].maxAmountRequired,
    validAfter: (now - 600).toString(),
    validBefore: (now + timeout).toString(),
    salt: extra.salt,
    payTo: extra.payTo,
    facilitatorFee: extra.facilitatorFee,
    hook: extra.hook,
    hookData: extra.hookData,
  });
  
  // Step 3: Sign EIP-3009 with commitment as nonce
  const signature = await walletClient.signTypedData({
    domain: { name: 'USDC', version: '2', chainId, verifyingContract: token },
    types: { TransferWithAuthorization: [...] },
    message: { from, to: hub, value, validAfter, validBefore, nonce },
  });
  
  // Step 4: Send payment
  await fetch(endpoint, {
    headers: { 'X-PAYMENT': encodePayment({ signature, authorization: {...} }) }
  });
}
```

### 3. Commitment Calculation (`client/src/utils/commitment.ts`)

The commitment calculation **must match** the Solidity implementation exactly:

```typescript
export function calculateCommitment(params: CommitmentParams): string {
  return ethers.keccak256(
    ethers.solidityPacked(
      [
        "string",    // Protocol version
        "uint256",   // Chain ID
        "address",   // Hub address
        "address",   // Token address
        "address",   // From (payer)
        "uint256",   // Value
        "uint256",   // Valid after
        "uint256",   // Valid before
        "bytes32",   // Salt
        "address",   // Pay to
        "uint256",   // Facilitator fee
        "address",   // Hook
        "bytes32"    // keccak256(hookData)
      ],
      [
        "X402/settle/v1",
        params.chainId,
        params.hub,
        params.token,
        params.from,
        params.value,
        params.validAfter,
        params.validBefore,
        params.salt,
        params.payTo,
        params.facilitatorFee,
        params.hook,
        ethers.keccak256(params.hookData)
      ]
    )
  );
}
```

## Security Properties

### What the Commitment Protects

By using commitment as the nonce, the client's signature now covers:

| Parameter | Protected | How |
|-----------|-----------|-----|
| `chainId` | ✅ | In commitment hash |
| `hub` | ✅ | In commitment hash |
| `token` | ✅ | In EIP-712 domain |
| `from` | ✅ | In EIP-712 message |
| `to` (hub) | ✅ | In EIP-712 message |
| `value` | ✅ | In EIP-712 message & commitment |
| `validAfter` | ✅ | In EIP-712 message & commitment |
| `validBefore` | ✅ | In EIP-712 message & commitment |
| `salt` | ✅ | In commitment hash |
| `payTo` | ✅ | In commitment hash |
| `facilitatorFee` | ✅ | In commitment hash |
| `hook` | ✅ | In commitment hash |
| `hookData` | ✅ | In commitment hash (as hash) |

### Attack Scenarios Prevented

1. **Parameter Tampering**: ❌ Blocked
   - Attacker cannot change hook, hookData, or any other parameter
   - Changing any parameter invalidates the commitment
   
2. **Cross-Chain Replay**: ❌ Blocked
   - `chainId` is in commitment
   
3. **Cross-Hub Replay**: ❌ Blocked
   - Hub address is in commitment
   
4. **Fee Manipulation**: ❌ Blocked
   - `facilitatorFee` is fixed in commitment
   
5. **Recipient Redirection**: ❌ Blocked
   - `payTo` is bound in commitment

## Testing

### Unit Tests (Contracts)

All commitment scenarios are tested in `contracts/test/SettlementHub.t.sol`:

```bash
cd contracts
forge test -vv

# Commitment tests
✅ testCommitmentCalculation
✅ testInvalidCommitmentRejected
✅ testCommitmentPreventsTamperingValue
✅ testCommitmentPreventsTamperingHook
✅ testCommitmentPreventsTamperingHookData
✅ testCommitmentPreventsTamperingFacilitatorFee
✅ testCommitmentPreventsTamperingPayTo
✅ testCommitmentPreventsTamperingSalt
```

### Integration Tests (Showcase)

To test the full payment flow:

```bash
# Terminal 1: Start server
cd examples/settlement-showcase/server
npm run dev

# Terminal 2: Start client
cd examples/settlement-showcase/client
npm run dev

# Open browser to http://localhost:5173
# Connect wallet and try each scenario
```

## Future Work: PR to x402 Library

Once this implementation is stable, we plan to contribute back to the x402 library:

### Proposed Changes

1. **Add `customNonce` parameter** to `preparePaymentHeader`:
   ```typescript
   export function preparePaymentHeader(
     from: Address,
     x402Version: number,
     paymentRequirements: PaymentRequirements,
     customNonce?: Hex  // NEW: Allow custom nonce
   ): UnsignedPaymentPayload {
     const nonce = customNonce || createNonce();
     // ...
   }
   ```

2. **Add commitment helper** to x402 utils:
   ```typescript
   export function calculateSettlementCommitment(
     params: SettlementCommitmentParams
   ): Hex {
     // Implementation matching SettlementHub.sol
   }
   ```

3. **Update documentation** to explain commitment-based flows

### Benefits

- Other projects can use commitment-based security
- Maintains backward compatibility (customNonce is optional)
- Standardizes the commitment calculation pattern

## Debugging

Enable detailed logging in the browser console:

```typescript
// Client side logs
[Payment] Step 1: Initial request to http://localhost:3001/api/scenario-1/payment
[Payment] Step 2: Received 402 response
[Payment] Step 3: Settlement parameters { settlementHub, salt, ... }
[Payment] Step 4: Authorization parameters { chainId, from, value, ... }
[Payment] Step 5: Calculated commitment/nonce 0x...
[Payment] Step 6: Signing EIP-712 message
[Payment] Signature obtained 0x...
[Payment] Step 8: Encoded payment header
[Payment] Step 9: Final response status 200
[Payment] Payment successful
```

## Summary

This implementation demonstrates:
- ✅ Commitment-based security in a real application
- ✅ Full compatibility with x402 protocol
- ✅ Client-side commitment calculation
- ✅ End-to-end payment flow with parameter binding
- ✅ Ready to contribute back to x402 library

The commitment approach provides cryptographic guarantees that all settlement parameters are authenticated by the user's signature, preventing any tampering by facilitators or man-in-the-middle attackers.

