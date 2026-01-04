# Facilitator Developer Guide

## Overview

This guide explains how to extend any x402 Facilitator implementation to support the x402 settlement extension framework. The guide provides language-agnostic concepts and examples in multiple programming languages.

## What is a Facilitator?

A Facilitator is a service that processes x402 payment requests by:
1. Validating payment requirements
2. Executing blockchain transactions
3. Returning settlement results

## Settlement Extension Framework

The x402 settlement extension allows Facilitators to support advanced payment flows through:
- **SettlementRouter**: A smart contract that coordinates payments and executes hooks
- **Hooks**: Custom logic executed after payment settlement
- **Extended Parameters**: Additional configuration in the `extra` field

## Core Implementation Concepts

### 1. Detection Logic

Your Facilitator needs to detect when a payment request requires settlement extension by checking the `extra` field in `PaymentRequirements`:

**Required Fields in `extra`:**
```json
{
  "settlementRouter": "0x...",  // SettlementRouter contract address
  "salt": "0x...",           // Unique identifier (32 bytes, for idempotency)
  "payTo": "0x...",          // Final recipient address
  "facilitatorFee": "10000", // Facilitator fee amount (e.g., 0.01 USDC = 10000 in 6 decimals)
  "hook": "0x...",           // Hook contract address  
  "hookData": "0x..."        // Encoded hook parameters
}
```

**Detection Logic:**

```pseudocode
function isSettlementMode(paymentRequirements):
    return paymentRequirements.extra.settlementRouter exists
```

### 2. Settlement Flow Routing

Modify your main settlement method to route between standard and extended modes:

**Flow Diagram:**
```
Payment Request
       ↓
   Check extra.settlementRouter
       ↓
   ┌─────────────────┐
   │ settlementRouter?  │
   └─────────────────┘
       ↓         ↓
    Yes │       │ No
       ↓         ↓
Settlement    Standard
   Hub         Transfer
```

**Implementation Logic:**

```pseudocode
function settle(request):
    if isSettlementMode(request.paymentRequirements):
        return settleWithHub(request)
    else:
        return settleStandard(request)
```

### 3. SettlementRouter Integration

When settlement mode is detected, call `SettlementRouter.settleAndExecute` instead of direct token transfer:

**Standard vs Settlement Mode:**

| Mode | Target Contract | Method | Parameters |
|------|----------------|--------|------------|
| Standard | ERC-3009 Token | `transferWithAuthorization` | token, from, to, value, validAfter, validBefore, nonce, signature |
| Settlement | SettlementRouter | `settleAndExecute` | **same as above** + salt, payTo, facilitatorFee, hook, hookData |

**Key Insight:** Settlement mode uses the same authorization parameters but adds settlement-specific parameters!

### 4. Parameter Extraction

Parse the `extra` field to extract settlement parameters:

**Data Structure:**
```json
{
  "extra": {
    "settlementRouter": "0x1234...",
    "salt": "0x5abc...",
    "payTo": "0x9def...",
    "facilitatorFee": "10000",
    "hook": "0x5678...", 
    "hookData": "0xabcd..."
  }
}
```

**Parsing Logic:**

```pseudocode
function parseSettlementExtra(extra):
    validate extra.settlementRouter exists
    validate extra.salt exists
    validate extra.payTo exists
    validate extra.facilitatorFee exists
    validate extra.hook exists  
    validate extra.hookData exists
    
    return {
        settlementRouter: extra.settlementRouter,
        salt: extra.salt,
        payTo: extra.payTo,
        facilitatorFee: extra.facilitatorFee,
        hook: extra.hook,
        hookData: extra.hookData
    }
```

### 5. Smart Contract Interaction

Call the SettlementRouter contract with the extracted parameters:

**Contract ABI:**
```solidity
function settleAndExecute(
    address token,         // ERC-3009 token address
    address from,          // Payer address
    uint256 value,         // Payment amount
    uint256 validAfter,    // Authorization valid after
    uint256 validBefore,   // Authorization valid before  
    bytes32 nonce,         // Authorization nonce (must equal commitment hash)
    bytes signature,       // Authorization signature
    bytes32 salt,          // Unique identifier (for idempotency)
    address payTo,         // Final recipient address
    uint256 facilitatorFee,// Facilitator fee amount
    address hook,          // Hook contract address
    bytes hookData         // Hook execution data
) external;
```

**Settlement Logic:**

```pseudocode
function settleWithHub(request):
    // 1. Parse parameters
    extra = parseSettlementExtra(request.paymentRequirements.extra)
    payload = request.paymentPayload
    
    // 2. Create contract instance
    settlementRouter = createContract(extra.settlementRouter, SETTLEMENT_ROUTER_ABI)
    
    // 3. Call settleAndExecute with all parameters
    transaction = settlementRouter.settleAndExecute(
        request.paymentRequirements.asset,    // token
        payload.authorization.from,           // from
        payload.authorization.value,          // value
        payload.authorization.validAfter,     // validAfter
        payload.authorization.validBefore,    // validBefore
        payload.authorization.nonce,          // nonce (commitment hash)
        payload.signature,                    // signature
        extra.salt,                          // salt
        extra.payTo,                         // payTo
        extra.facilitatorFee,                // facilitatorFee
        extra.hook,                          // hook
        extra.hookData                       // hookData
    )
    
    // 4. Wait for confirmation and return result
    receipt = waitForTransaction(transaction)
    return createSuccessResponse(receipt)
```

## SettlementRouter Contract Interface

### Core Functions

```solidity
interface ISettlementHub {
    /// @notice Settle payment and execute hook
    function settleAndExecute(
        address token,
        address from, 
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes signature,
        bytes32 salt,
        address payTo,
        uint256 facilitatorFee,
        address hook,
        bytes hookData
    ) external;
    
    /// @notice Check if payment is settled
    function isSettled(bytes32 contextKey) external view returns (bool);
    
    /// @notice Claim accumulated facilitator fees
    function claimFees(address[] tokens) external;
}
```

### Events

```solidity
event Settled(
    bytes32 indexed contextKey,
    address indexed payer,
    address indexed token,
    uint256 amount,
    address hook,
    bytes32 salt,
    address payTo,
    uint256 facilitatorFee
);

event HookExecuted(
    bytes32 indexed contextKey,
    address indexed hook,
    bytes returnData
);

event FeeAccumulated(
    address indexed facilitator,
    address indexed token,
    uint256 amount
);

event FeesClaimed(
    address indexed facilitator,
    address indexed token,
    uint256 amount
);
```

### ABI JSON

```json
[
  {
    "type": "function",
    "name": "settleAndExecute",
    "inputs": [
      {"name": "token", "type": "address"},
      {"name": "from", "type": "address"},
      {"name": "value", "type": "uint256"},
      {"name": "validAfter", "type": "uint256"},
      {"name": "validBefore", "type": "uint256"},
      {"name": "nonce", "type": "bytes32"},
      {"name": "signature", "type": "bytes"},
      {"name": "salt", "type": "bytes32"},
      {"name": "payTo", "type": "address"},
      {"name": "facilitatorFee", "type": "uint256"},
      {"name": "hook", "type": "address"},
      {"name": "hookData", "type": "bytes"}
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "isSettled",
    "inputs": [{"name": "contextKey", "type": "bytes32"}],
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "claimFees",
    "inputs": [{"name": "tokens", "type": "address[]"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Settled",
    "inputs": [
      {"name": "contextKey", "type": "bytes32", "indexed": true},
      {"name": "payer", "type": "address", "indexed": true},
      {"name": "token", "type": "address", "indexed": true},
      {"name": "amount", "type": "uint256", "indexed": false},
      {"name": "hook", "type": "address", "indexed": false},
      {"name": "salt", "type": "bytes32", "indexed": false},
      {"name": "payTo", "type": "address", "indexed": false},
      {"name": "facilitatorFee", "type": "uint256", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "HookExecuted",
    "inputs": [
      {"name": "contextKey", "type": "bytes32", "indexed": true},
      {"name": "hook", "type": "address", "indexed": true},
      {"name": "returnData", "type": "bytes", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "FeeAccumulated",
    "inputs": [
      {"name": "facilitator", "type": "address", "indexed": true},
      {"name": "token", "type": "address", "indexed": true},
      {"name": "amount", "type": "uint256", "indexed": false}
    ]
  },
  {
    "type": "event",
    "name": "FeesClaimed",
    "inputs": [
      {"name": "facilitator", "type": "address", "indexed": true},
      {"name": "token", "type": "address", "indexed": true},
      {"name": "amount", "type": "uint256", "indexed": false}
    ]
  }
]
```

## Testing Strategy

### Commitment Verification (Critical Security Feature)

**⚠️ Important:** The `nonce` parameter in the EIP-3009 authorization MUST equal the commitment hash calculated from all settlement parameters. This prevents parameter tampering attacks.

**Commitment Calculation:**

The SettlementRouter contract calculates the commitment hash as follows:

```solidity
bytes32 commitment = keccak256(abi.encodePacked(
    "X402/settle/v1",    // Domain separator
    chainId,             // Chain ID (anti-replay)
    hub,                 // Hub address (cross-hub protection)
    token,               // Token address
    from,                // Payer address
    value,               // Payment amount
    validAfter,          // Valid after timestamp
    validBefore,         // Valid before timestamp
    salt,                // Unique identifier
    payTo,               // Final recipient
    facilitatorFee,      // Facilitator fee amount
    hook,                // Hook address
    keccak256(hookData)  // Hash of hook data
));
```

**Security Properties:**

1. **Parameter Binding**: All settlement parameters are cryptographically bound to the user's signature
2. **Tamper Prevention**: Any modification of parameters will cause commitment verification to fail
3. **Cross-chain Protection**: Chain ID prevents cross-chain replay attacks
4. **Cross-hub Protection**: Hub address prevents replay across different hub instances

**Facilitator Responsibilities:**

- ✅ Pass parameters exactly as received from Resource Server in `extra` field
- ✅ Do NOT modify any settlement parameters (`salt`, `payTo`, `facilitatorFee`, `hook`, `hookData`)
- ✅ The SettlementRouter contract will automatically verify the commitment matches the nonce
- ❌ Do NOT attempt to recalculate or verify the commitment yourself - the Hub handles this

**Flow:**

```
1. Resource Server → generates salt, calculates commitment
2. Resource Server → returns commitment as part of 402 response
3. Client → uses commitment as EIP-3009 nonce, signs authorization
4. Client → sends payment with signature to Facilitator
5. Facilitator → extracts parameters from extra, calls settleAndExecute
6. SettlementRouter → verifies nonce == commitment, proceeds if valid
```

## Facilitator Fee Mechanism

The SettlementRouter contract includes a built-in fee accumulation and claiming mechanism for facilitators.

**How It Works:**

1. **Fee Deduction**: When `settleAndExecute` is called with a non-zero `facilitatorFee`:
   - The full `value` is transferred from the payer to the Hub
   - The `facilitatorFee` is accumulated in the Hub for the facilitator (msg.sender)
   - The Hook receives `value - facilitatorFee` (net amount)

2. **Fee Storage**: Fees are stored per facilitator per token:
   ```solidity
   mapping(address => mapping(address => uint256)) public pendingFees;
   ```

3. **Fee Claiming**: Facilitators can batch-claim accumulated fees:
   ```solidity
   function claimFees(address[] calldata tokens) external;
   ```

**Example Flow:**

```
Payment: 1.00 USDC
Facilitator Fee: 0.01 USDC
Net to Hook: 0.99 USDC

1. Hub receives 1.00 USDC from payer
2. Hub accumulates 0.01 USDC for facilitator
3. Hook receives approval for 0.99 USDC
4. Hook executes business logic with 0.99 USDC
5. Later: Facilitator calls claimFees([USDC]) → receives 0.01 USDC
```

**Facilitator Fee Configuration:**

The `facilitatorFee` is determined by the Resource Server and included in the `extra` field. As a facilitator:

- ✅ You receive the fee specified in `extra.facilitatorFee`
- ✅ Fees accumulate automatically during settlement
- ✅ You can claim fees at any time by calling `claimFees()`
- ✅ You can batch-claim fees for multiple tokens
- ⚠️ The fee amount is part of the commitment and cannot be modified

**Events:**

```solidity
// Emitted when fee is accumulated during settlement
event FeeAccumulated(
    address indexed facilitator,
    address indexed token,
    uint256 amount
);

// Emitted when facilitator claims fees
event FeesClaimed(
    address indexed facilitator,
    address indexed token,
    uint256 amount
);
```

## Testing Strategy

### Unit Tests

Test the detection and parsing logic:

```pseudocode
test "detects settlement mode":
    requirements = { extra: { settlementRouter: "0x1234..." } }
    assert isSettlementMode(requirements) == true

test "detects standard mode":
    requirements = { extra: null }
    assert isSettlementMode(requirements) == false
```

### Integration Tests

Test end-to-end settlement flow:

```pseudocode
test "settles with hub successfully":
    request = createSettlementRequest(
        settlementRouter: SETTLEMENT_ROUTER_ADDRESS,
        hook: HOOK_ADDRESS,
        hookData: "0x..."
    )
    
    response = facilitator.settle(request)
    
    assert response.success == true
    assert response.transaction exists
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `MissingExtra` | No `extra` field | Check request format |
| `MissingSettlementHub` | No `settlementRouter` in extra | Verify client configuration |
| `InvalidAddress` | Malformed address | Validate address format |
| `TransactionFailed` | On-chain execution failed | Check hook implementation |
| `InsufficientFunds` | Insufficient token balance | Verify payer balance |

### Error Handling Logic

```pseudocode
function handleSettlement(request):
    try:
        response = settleWithHub(request)
        return response
    catch MissingSettlementHub:
        return { success: false, error: "Invalid settlement configuration" }
    catch TransactionFailed:
        return { success: false, error: "Hook execution failed" }
    catch other:
        throw other  // Re-throw unexpected errors
```

## Configuration

### Environment Variables

```bash
# Standard Facilitator configuration (using CAIP-2 format for network identifiers)
# CAIP-2 format: eip155:<chainId>
RPC_URL_EIP155_84532=https://sepolia.base.org  # Base Sepolia (chain ID 84532)
RPC_URL_EIP155_8453=https://mainnet.base.org    # Base Mainnet (chain ID 8453)
PRIVATE_KEY=0x...

# SettlementRouter addresses (per network, using CAIP-2 format)
SETTLEMENT_ROUTER_EIP155_84532=0x...  # Base Sepolia
SETTLEMENT_ROUTER_EIP155_8453=0x...   # Base Mainnet
SETTLEMENT_ROUTER_EIP155_1=0x...      # Ethereum Mainnet (chain ID 1)
```

### Network Configuration

```json
{
  "networks": {
    "eip155:8453": {
      "rpcUrl": "https://mainnet.base.org",
      "settlementRouter": "0x...",
      "chainId": 8453,
      "name": "Base Mainnet"
    },
    "eip155:84532": {
      "rpcUrl": "https://sepolia.base.org",
      "settlementRouter": "0x...",
      "chainId": 84532,
      "name": "Base Sepolia"
    },
    "eip155:196": {
      "rpcUrl": "https://rpc.xlayer.tech",
      "settlementRouter": "0x...",
      "chainId": 196,
      "name": "X-Layer Mainnet"
    },
    "eip155:1952": {
      "rpcUrl": "https://testrpc.xlayer.tech",
      "settlementRouter": "0x...",
      "chainId": 1952,
      "name": "X-Layer Testnet"
    }
  }
}
```

## Monitoring and Observability

### Key Metrics to Track
- Settlement success rate
- Average settlement time  
- Hook execution success rate
- Gas usage per settlement

### Event Monitoring
Listen for SettlementRouter events:
- `Settled`: Payment completed successfully
- `HookExecuted`: Hook logic executed

## Performance Optimization

### Best Practices
1. **Connection Pooling**: Reuse blockchain connections and contract instances
2. **Batch Processing**: Process multiple settlements concurrently when possible
3. **Gas Optimization**: Estimate gas usage and add appropriate buffer (10-20%)

## Security Considerations

### Critical Security Checks
1. **Input Validation**: Validate all addresses, amounts, and parameters
2. **Signature Verification**: Verify ERC-3009 authorization signatures
3. **Rate Limiting**: Implement request rate limiting to prevent abuse
4. **Address Validation**: Ensure all contract addresses are valid
5. **Amount Validation**: Check for reasonable payment amounts

## Migration Guide

### From Standard to Settlement Mode

1. **Add Detection Logic**: Implement `isSettlementMode()` function
2. **Add Routing**: Modify main `settle()` method to route between modes
3. **Add SettlementRouter Integration**: Implement `settleWithHub()` method
4. **Update Configuration**: Add SettlementRouter addresses
5. **Update Tests**: Add settlement mode test cases

### Backward Compatibility

The settlement extension is fully backward compatible:
- Existing standard payments continue to work unchanged
- Only requests with `extra.settlementRouter` use the new flow
- No breaking changes to existing APIs

## Summary

Extending a Facilitator for x402 settlement requires minimal changes:

1. **Detection**: Check for `extra.settlementRouter` field
2. **Routing**: Route to appropriate settlement method
3. **Integration**: Call `SettlementRouter.settleAndExecute` with hook parameters
4. **Same Parameters**: Use existing authorization data + hook info

**Key Benefits:**
- ✅ Minimal code changes required
- ✅ Backward compatible with existing flows  
- ✅ Enables powerful hook-based extensions
- ✅ Maintains security and reliability

**The extension adds maximum functionality with minimal complexity!**