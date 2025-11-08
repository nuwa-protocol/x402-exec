# Security Analysis

This document explains the security model, known risks, and security considerations for developers of the X402 Settlement protocol.

## Core Security Model

### Trust Assumptions

The X402 Settlement protocol involves three main roles:

```
Client (User)          →  Trusts Resource Server for payment parameters
     ↓                    ↓
EIP-3009 Signature        Payment parameters (hook, hookData, salt, payTo, facilitatorFee)
     ↓                    ↓
Facilitator            →  Calls SettlementRouter with all parameters
     ↓
SettlementRouter          →  Verifies commitment hash and signature
     ↓
Hook Contract          →  Executes business logic
```

### Commitment-Based Security Model

**New Security Architecture**:

The protocol now uses a **commitment hash** mechanism to bind all business parameters to the Client's EIP-3009 signature:

1. **Resource Server** generates all payment parameters including:
   - `salt`: Unique identifier (32 bytes, prevents replay)
   - `payTo`: Final recipient address (transparency)
   - `facilitatorFee`: Facilitator fee amount
   - `hook`: Hook contract address
   - `hookData`: Hook parameters

2. **Resource Server** calculates commitment hash:
   ```solidity
   commitment = keccak256(abi.encodePacked(
       "X402/settle/v1",
       chainId,
       hub,
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
   ))
   ```
   
   **Note**: The `to` parameter (always Hub address) is not included to avoid redundancy with `hub`.

3. **Client** uses commitment hash as EIP-3009 `nonce` and signs

4. **SettlementRouter** recalculates commitment from submitted parameters and verifies it equals `nonce`

### Signature Coverage

**Client's EIP-3009 Signature Now Covers** (via commitment hash):
- ✅ `from` (Payer)
- ✅ `to` (SettlementRouter address)
- ✅ `value` (Amount)
- ✅ `validAfter`, `validBefore` (Validity period)
- ✅ `nonce` (= commitment hash)
- ✅ **`salt`** (Uniqueness identifier)
- ✅ **`payTo`** (Final recipient)
- ✅ **`facilitatorFee`** (Facilitator fee)
- ✅ **`hook`** (Hook contract address)
- ✅ **`hookData`** (Hook parameters, via hash)
- ✅ **`chainId`** (Chain identifier, prevents cross-chain replay)
- ✅ **`hub`** (Hub address, prevents cross-hub replay)

**Result**: Any tampering with these parameters will cause commitment verification to fail, making the transaction invalid.

## Security Guarantees

### ✅ Fully Protected Against

| Attack Type | Defense Mechanism | Status |
|-------------|-------------------|--------|
| Replace hook address | Commitment hash verification | ✅ Protected |
| Tamper with hookData | Commitment hash verification | ✅ Protected |
| Tamper with payTo | Commitment hash verification | ✅ Protected |
| Tamper with facilitatorFee | Commitment hash verification | ✅ Protected |
| Tamper with payment amount | Commitment hash verification | ✅ Protected |
| Replay same transaction | salt ensures uniqueness | ✅ Protected |
| Cross-chain replay | chainId in commitment | ✅ Protected |
| Cross-hub replay | hub address in commitment | ✅ Protected |
| Steal Client funds | EIP-3009 signature protects `to` address | ✅ Protected |
| Facilitator front-running | facilitatorFee is fixed, front-runner gains nothing | ✅ Protected |

### ⚠️ Remaining Risks

| Risk Type | Description | Mitigation |
|-----------|-------------|------------|
| **Pre-signature phishing** | Malicious website tricks user into signing a fake commitment | Client UI should clearly display: Resource Server identity, `payTo` address, amount, facilitatorFee |
| **Resource Server compromise** | Resource Server's private system is hacked, generates malicious parameters | Out of scope for smart contract layer. Requires operational security measures. |
| **Client wallet compromise** | User's private key is stolen | Out of scope. Standard wallet security applies. |

## Direct Transfer Attack Prevention

### Attack Vector

A malicious facilitator could bypass the normal settlement flow by directly calling the ERC-3009 token's `transferWithAuthorization` method:

```solidity
USDC.transferWithAuthorization(
    from,           // User
    routerAddress,  // Router
    value,
    validAfter,
    validBefore,
    nonce,          // Any value
    signature       // User's signature
)
```

This attack would:
1. Transfer user funds into the Router contract
2. Mark the nonce as used in the token contract
3. **Not execute any business logic** (no Hook call)
4. Lock funds in Router without completing the user's intended transaction

### Defense Mechanism

The Router automatically detects and recovers from this attack by checking the nonce state before attempting the transfer:

**Detection Flow**:
1. Before calling `transferWithAuthorization`, query `token.authorizationState(from, nonce)`
2. If `false`: Normal flow - call `transferWithAuthorization` then execute business logic
3. If `true`: Recovery flow - skip transfer (funds already in Router), directly execute business logic

**Recovery Flow**:
```
Normal: settleAndExecute → transferWithAuthorization → Hook → Complete
Attack: Direct transfer → (funds locked)
Recover: settleAndExecute → (detect nonce used) → Hook → Complete
```

**Key Protection**: Even in recovery mode, the Router still validates:
- ✅ Commitment hash matches nonce (prevents parameter tampering)
- ✅ Sufficient balance available in Router
- ✅ All business logic executes correctly
- ✅ Facilitator receives their fee

### Security Properties

| Property | Status | Details |
|----------|--------|---------|
| User intent fulfilled | ✅ | Payment and business logic always execute together |
| Funds cannot be locked | ✅ | Recovery flow completes the transaction |
| Commitment protection | ✅ | Even in recovery, parameters must match signed commitment |
| Facilitator incentive | ✅ | Facilitator still receives fee for completing transaction |
| No benefit to attacker | ✅ | Attack provides no financial gain |
| Gas overhead | ✅ | ~2.6k gas per transaction (one view call) |

### Example Scenarios

**Scenario 1: Attack Detected and Recovered**
```
1. User signs commitment for 100 USDC payment
2. Attacker calls transferWithAuthorization directly
   → 100 USDC enters Router, nonce marked as used
3. Good facilitator calls settleAndExecute
   → Detects nonce already used
   → Verifies commitment (prevents wrong parameters)
   → Executes Hook with 99 USDC (after 1 USDC fee)
   → Facilitator receives 1 USDC fee
   → User's business intent fulfilled ✅
```

**Scenario 2: Normal Flow Unaffected**
```
1. User signs commitment
2. Facilitator calls settleAndExecute first
   → Detects nonce not used
   → Normal flow: transferWithAuthorization + Hook
   → Complete ✅
```

### Gas Cost Analysis

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| Nonce check | ~2.6k | One external view call to token contract |
| Normal flow | Same | No change to existing operations |
| Recovery flow | -21k | Saves `transferWithAuthorization` gas |

**Net Impact**: 
- Normal transactions: +2.6k gas (~1-2% increase)
- Recovery transactions: -18k gas (cheaper than normal)

### Implementation Details

The recovery logic is integrated directly into `settleAndExecute`:

```solidity
// Check nonce state
bool nonceAlreadyUsed = IERC3009(token).authorizationState(from, nonce);

if (!nonceAlreadyUsed) {
    // Normal flow: transfer then execute
    IERC3009(token).transferWithAuthorization(...);
    // Verify transfer succeeded
} else {
    // Recovery flow: verify funds available, then execute
    require(balanceBefore >= value);
    // Continue to Hook execution
}

// Both flows converge here: deduct fee, call Hook, verify balances
```

### Design Rationale

**Why not a separate rescue function?**
- Integrated solution provides seamless user experience
- Facilitators don't need to handle special cases
- Automatic retry works: if first call fails, second call recovers
- Single API is simpler for SDK developers

**Why check nonce every time?**
- Cost is minimal (~2.6k gas)
- Provides complete protection
- No additional user action required
- Makes attack completely ineffective

## Facilitator Fee Mechanism

### Design

The protocol includes a standard facilitator fee mechanism:

- **Fee Source**: Deducted from Client's payment before Hook execution
- **Fee Storage**: Accumulated in `pendingFees[facilitator][token]` mapping
- **Fee Claim**: Facilitator calls `claimFees(tokens[])` to batch claim multiple tokens
- **Gas Efficiency**: Batch claiming saves ~70% gas cost compared to immediate transfers

### Security Properties

1. **Fixed Fee**: `facilitatorFee` is bound in commitment hash, cannot be changed
2. **Transparent**: Client sees exact fee amount before signing
3. **No Front-running Value**: Facilitator who submits transaction gets the fee, but fee amount is fixed
4. **Accumulated Safety**: CEI pattern used in `claimFees`, reentrancy protected

### Example Flow

```
Client authorizes: 1.01 USDC total
├─ 0.01 USDC → pendingFees[facilitator][USDC] (accumulated)
└─ 1.00 USDC → Hook (for business logic)

Later, facilitator claims accumulated fees:
claimFees([USDC, DAI]) → transfers all pending fees
```

## Development Security Guide

### For Resource Server Developers

1. **Generate Unique Salt**
   - Use UUIDs or business-specific identifiers
   - Ensures each transaction is unique
   - Enables idempotent retry logic

2. **Calculate Commitment Correctly**
   - Include all parameters in correct order
   - Use provided SDK/library functions
   - Test commitment calculation thoroughly

3. **Set Appropriate Facilitator Fee**
   - Consider current gas costs
   - Balance between attracting facilitators and user experience
   - Typical range: 0.01-0.05 USDC per transaction

4. **Monitor On-chain Events**
   - Verify all settlement parameters
   - Detect anomalies promptly
   - Track `Settled`, `FeeAccumulated` events

5. **Display Payment Details Clearly**
   - Show `payTo` address to users
   - Display `facilitatorFee` separately
   - Show total amount (resource price + fee)

### For Hook Developers

1. **Verify Caller**
   - Use `onlyHub` modifier
   - Ensure only callable by SettlementRouter

2. **Parameter Validation**
   - Validate all input parameters
   - Prevent overflow and boundary conditions

3. **Use New Parameters**
   - `amount`: Already deducted facilitatorFee, use directly
   - `salt`: Available for idempotency checks or logging
   - `payTo`: Use for transparency or validation
   - `facilitator`: Optional, for advanced incentive mechanisms

4. **Access Control**
   - Sensitive operations require permission checks
   - Properly use namespace isolation

5. **Event Logging**
   - Record all critical operations
   - Facilitate auditing and monitoring

### For Facilitator Operators

1. **Secure Private Keys**
   - Accumulated fees are valuable
   - Use hardware wallets or secure key management

2. **Monitor Pending Fees**
   - Track `pendingFees` for each token
   - Set threshold for claiming (e.g., >$100)

3. **Batch Claim Efficiently**
   - Claim multiple tokens in one transaction
   - Save gas costs
   - Example: `claimFees([USDC, DAI, USDT])`

4. **Handle Edge Cases**
   - Zero-fee transactions (fee may be 0)
   - Token transfer failures
   - Hub balance checks

## Gas Cost Considerations

### Per-Settlement Cost Increase

| Component | Additional Gas | Notes |
|-----------|---------------|-------|
| Commitment calculation | ~800 gas | One-time per settlement |
| Fee accumulation (first time) | ~20k gas | Cold storage write |
| Fee accumulation (subsequent) | ~5k gas | Hot storage update |
| Extra parameters | ~200 gas | Calldata cost |
| **Total (first)** | ~21k gas | ~7-16% increase |
| **Total (subsequent)** | ~6k gas | ~2-5% increase |

### Facilitator Fee Claiming

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| Single token claim | ~50k gas | One token |
| Batch claim (3 tokens) | ~120k gas | Multiple tokens |
| **Savings (10 settlements)** | ~215k gas | vs immediate transfers |

## Future Security Enhancements

### Planned Improvements

1. **Resource Server Signature** (optional upgrade)
   - Resource Server signs commitment
   - Hub verifies Resource signature
   - Defends against pre-signature phishing
   - Cost: +3k gas per settlement

2. **EIP-712 Structured Data**
   - Use EIP-712 for commitment signing
   - Better wallet UI display
   - Improved user experience

3. **Facilitator Reputation System** (off-chain)
   - Track facilitator reliability
   - Publish performance metrics
   - Help Resource Servers choose facilitators

## Audit Status

- [ ] Internal security review
- [ ] Third-party audit
- [ ] Bug bounty program

## Reporting Security Issues

If you discover a security vulnerability, please disclose responsibly through:

1. GitHub security advisory

**Please do not** open public issues for security vulnerabilities.

## Summary

The X402 Settlement protocol's security model:

✅ **Strong Protections**:
- Commitment hash binds all business parameters
- No facilitator can tamper with signed transactions
- Standard facilitator fee mechanism
- Cross-chain and cross-hub replay protection
- Efficient gas cost (~2-5% overhead after first use)

⚠️ **User Responsibility**:
- Verify Resource Server identity before signing
- Check displayed payment details (payTo, amount, fee)
- Use trusted wallets with good UI

🔮 **Future Enhancements**:
- Optional Resource Server signatures
- Improved UI standards
- Facilitator reputation systems

The protocol provides strong on-chain security guarantees while maintaining gas efficiency and user experience.
