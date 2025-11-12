# Reward Points Scenario

This scenario demonstrates customer loyalty and reward point systems.

## Contracts

### `RewardHook.sol`
**Purpose**: Transfer payment to merchant and distribute reward tokens to customer

**Architecture**:
- Hook is deployed first as **reusable infrastructure**
- Multiple RewardToken contracts can use the same hook
- RewardToken address is passed via hookData at runtime (flexible)

**Design Improvements** (Post-Refactor):
- ✅ **Simplified Configuration**: Only requires reward token address in hookData
- ✅ **Removed Redundancy**: Uses `payTo` parameter instead of separate `merchant` field
- ✅ **Enhanced Error Handling**: Uses try-catch for reward distribution with atomic rollback
- ✅ **Overflow Protection**: Documents safe arithmetic for reward calculation
- ✅ **Better Events**: Updated event to use `payTo` for clarity

**Flow**:
1. User makes payment
2. Payment is transferred to payTo (merchant)
3. Reward points are calculated based on payment amount
4. Reward points are distributed to payer
5. **If reward distribution fails, entire transaction reverts** (atomic)

**Reward Calculation**:
- Rate: 1000 points per $0.1 USDC
- **Cap**: Maximum $0.1 USDC per transaction (prevents reward farming)
- Formula: `(rewardableAmount * REWARD_RATE * 10^18) / 100_000`
  - Where `rewardableAmount = min(amount, MAX_REWARD_AMOUNT)`
  - `MAX_REWARD_AMOUNT = 100_000` (0.1 USDC in 6 decimals)
- Examples:
  - Pay $0.05 USDC → Get 500 points
  - Pay $0.1 USDC → Get 1000 points (max)
  - Pay $1 USDC → Still get 1000 points (capped)
  - Pay $100 USDC → Still get 1000 points (capped)
- Uses `unchecked` block for gas optimization (overflow mathematically impossible)
- **Anti-farming Protection**: Large payments don't drain reward pool

**Configuration**:
```solidity
constructor(address _settlementRouter) {
    settlementRouter = _settlementRouter;
}

// hookData format: abi.encode(RewardConfig)
struct RewardConfig {
    address rewardToken;  // Reward token address
}

// Example hookData encoding
bytes memory hookData = abi.encode(RewardConfig({
    rewardToken: address(rewardToken)
}));
```

**Security Features**:
- Only callable by SettlementRouter
- Validates reward token address is non-zero
- Validates payTo address is non-zero
- **Atomic execution**: If reward distribution fails, payment is also reverted
- Overflow protection with documented safety proof
- Try-catch for graceful error handling

### `RewardToken.sol`
**Purpose**: ERC20 reward points token with controlled distribution and **EIP-3009 support**

**Architecture**:
- Depends on RewardHook (deployed first)
- Hook address is immutably set in constructor (secure by design)
- No front-running risk

**New Features** (Post-Refactor):
- ✅ **EIP-3009 Support**: Implements `transferWithAuthorization` for gasless transfers
- ✅ **Meta-Transactions**: Users can transfer rewards without holding ETH for gas
- ✅ **EIP-712 Signatures**: Secure, human-readable signature format
- ✅ **Cancel Authorization**: Users can cancel unused signatures
- ✅ **Nonce Management**: Prevents replay attacks
- ✅ **Reward Cap Protection**: Prevents reward pool drainage by large transactions
- ✅ **Increased Supply**: 100M tokens to support 100,000 max-reward transactions

**Features**:
- Fixed supply of **100,000,000 tokens** (100M, 18 decimals)
- Designed to support **100,000 transactions** at max reward rate
- All tokens initially held by contract
- Only designated hook can distribute tokens
- Hook address is immutable
- **EIP-3009 standard for meta-transactions**
- **Cap protection prevents reward pool drainage**

**Key Functions**:
```solidity
constructor(address _hook); // Set hook address at deployment

// Distribution (only callable by hook)
function distribute(address to, uint256 amount) external;
function remainingRewards() external view returns (uint256);

// EIP-3009 Functions (public, with signature verification)
function transferWithAuthorization(
    address from,
    address to,
    uint256 value,
    uint256 validAfter,
    uint256 validBefore,
    bytes32 nonce,
    bytes calldata signature
) external;

function cancelAuthorization(
    address authorizer,
    bytes32 nonce,
    bytes calldata signature
) external;

function authorizationState(
    address authorizer,
    bytes32 nonce
) external view returns (bool);
```

## Deployment Example

```solidity
// 1. Deploy RewardHook (reusable infrastructure)
RewardHook hook = new RewardHook(settlementRouter);

// 2. Deploy RewardToken with hook address (secure by design)
RewardToken rewardToken = new RewardToken(address(hook));

// 3. Configure hookData for each transaction (simplified - no merchant field)
bytes memory hookData = abi.encode(RewardHook.RewardConfig({
    rewardToken: address(rewardToken)
}));

// 4. Execute settlement with rewards
router.settleAndExecute(
    token,
    payer,
    amount,
    validAfter,
    validBefore,
    nonce,
    signature,
    salt,
    merchant,      // payTo - receives payment
    facilitatorFee,
    address(hook),
    hookData
);
```

## EIP-3009 Usage

### Gasless Reward Transfers

Users can transfer their reward tokens without paying gas:

```javascript
// 1. Generate EIP-712 signature (off-chain)
const domain = {
    name: "X402 Reward Points",
    version: "1",
    chainId: await ethers.provider.getNetwork().then(n => n.chainId),
    verifyingContract: rewardTokenAddress
};

const types = {
    TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" }
    ]
};

const value = {
    from: userAddress,
    to: recipientAddress,
    value: amount,
    validAfter: 0,
    validBefore: Math.floor(Date.now() / 1000) + 3600, // 1 hour validity
    nonce: ethers.randomBytes(32)
};

const signature = await signer._signTypedData(domain, types, value);

// 2. Facilitator submits the signed transfer (pays gas)
await rewardToken.transferWithAuthorization(
    value.from,
    value.to,
    value.value,
    value.validAfter,
    value.validBefore,
    value.nonce,
    signature
);
```

### Cancel Unused Signatures

```javascript
// Cancel a signature before it's used
const cancelTypes = {
    CancelAuthorization: [
        { name: "authorizer", type: "address" },
        { name: "nonce", type: "bytes32" }
    ]
};

const cancelValue = {
    authorizer: userAddress,
    nonce: nonceToCancel
};

const cancelSig = await signer._signTypedData(domain, cancelTypes, cancelValue);

await rewardToken.cancelAuthorization(
    cancelValue.authorizer,
    cancelValue.nonce,
    cancelSig
);
```

## Use Cases

### Customer Loyalty Programs
- Earn points for purchases
- Redeem points for discounts
- Tier-based reward systems

### Cashback Systems
- Percentage back on transactions
- Bonus point multipliers
- Referral rewards

### Gamification
- Achievement-based rewards
- Daily login bonuses
- Challenge completion rewards

### DeFi Incentives
- Liquidity provider rewards
- Trading volume rewards
- Protocol participation rewards

## Gas Optimization

The refactored design is more gas-efficient:
- **Removed merchant field**: Saves 32 bytes in hookData (~512 gas)
- **Try-catch overhead**: Minimal (~200 gas) for improved safety
- **Unchecked arithmetic**: Saves ~200 gas per reward calculation

## Integration Notes

### For Frontend Developers

```typescript
// Simplified hookData encoding - only reward token address needed
const hookData = ethers.AbiCoder.defaultAbiCoder().encode(
    ['tuple(address rewardToken)'],
    [{
        rewardToken: rewardTokenAddress
    }]
);

// payTo is the merchant who receives payment
const payTo = merchantAddress;

// Call settleAndExecute with the hook
await router.settleAndExecute(
    token,
    payer,
    amount,
    validAfter,
    validBefore,
    nonce,
    signature,
    salt,
    payTo,           // Merchant receives payment here
    facilitatorFee,
    hookAddress,
    hookData
);

// Check payer's reward balance
const rewards = await rewardToken.balanceOf(payer);
console.log(`Earned ${ethers.formatEther(rewards)} reward points`);
```

### For Backend Developers

```typescript
// Calculate expected rewards (with cap)
function calculateRewards(amountUSDC: number): bigint {
    const REWARD_RATE = 1000n;
    const MAX_REWARD_AMOUNT = 100_000n; // 0.1 USDC cap
    const USDC_DECIMALS = 6n;
    const POINTS_DECIMALS = 18n;
    
    // Convert USDC amount to 6 decimals
    const amount = BigInt(Math.floor(amountUSDC * (10 ** 6)));
    
    // Apply cap
    const rewardableAmount = amount > MAX_REWARD_AMOUNT ? MAX_REWARD_AMOUNT : amount;
    
    // Calculate reward points
    // (rewardableAmount * 1000 * 10^18) / 100_000
    return (rewardableAmount * REWARD_RATE * (10n ** POINTS_DECIMALS)) / 100_000n;
}

// Examples with cap
const rewards1 = calculateRewards(0.05);  // 500 points (no cap)
const rewards2 = calculateRewards(0.1);   // 1000 points (at cap)
const rewards3 = calculateRewards(1.0);   // 1000 points (capped!)
const rewards4 = calculateRewards(100.0); // 1000 points (capped!)
```

## Security Considerations

### ✅ Protected Against
- **Atomic Execution**: Payment and rewards both succeed or both fail
- **Overflow**: Mathematically impossible with USDC amounts
- **Invalid Addresses**: Validates both reward token and payTo addresses
- **Failed Distribution**: Try-catch ensures proper error handling
- **Replay Attacks**: EIP-3009 nonce prevents signature reuse
- **Signature Forgery**: EIP-712 provides cryptographic security
- **Reward Farming**: Cap prevents large transactions from draining reward pool
- **Supply Exhaustion**: 100M supply supports 100,000 max-reward transactions

### ⚠️ Considerations
- Reward token supply must be sufficient for ongoing distributions
  - Current supply (100M) supports 100,000 max-reward transactions
  - Monitor remaining supply via `remainingRewards()`
- Hook address in RewardToken is immutable (set carefully at deployment)
- EIP-3009 signatures should have reasonable expiry times
- Users should keep track of used/unused nonces
- **Large payments are capped**: Users paying >$0.1 receive same rewards as $0.1
  - This is intentional to prevent reward farming
  - Consider informing users about the cap for transparency

## Testing

Comprehensive tests are provided in:
- `contracts/test/Scenarios.t.sol` - Basic functionality tests
- `contracts/test/adversarial/ShowcaseSecurityTests.t.sol` - Security tests including:
  - Reward distribution failures
  - Insufficient reward token balance
  - Address validation
  - Large amount calculations
  - EIP-3009 signature tests (in RewardToken tests)

Run tests with:
```bash
forge test --match-contract Scenarios
forge test --match-contract ShowcaseSecurityTests
```

## Changelog

### v2.0 (Post-Refactor)
- ✅ Removed `merchant` field from RewardConfig (use `payTo` instead)
- ✅ Enhanced error handling with try-catch and atomic rollback
- ✅ Added overflow protection documentation
- ✅ **Added complete EIP-3009 support to RewardToken**
- ✅ Implemented meta-transaction capability
- ✅ Added signature cancellation
- ✅ **Added reward cap protection (0.1 USDC per transaction)**
- ✅ **Increased token supply to 100M** (supports 100,000 transactions)
- ✅ Improved events for better transparency
- ✅ Added comprehensive security tests
- ✅ Reduced gas costs by simplifying configuration

### v1.0 (Original)
- Initial implementation with merchant field
- Basic reward distribution
- Standard ERC20 functionality only
