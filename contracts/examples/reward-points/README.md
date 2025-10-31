# Reward Points Scenario

This scenario demonstrates customer loyalty and reward point systems.

## Contracts

### `RewardHook.sol`
**Purpose**: Transfer payment to merchant and distribute reward points to customer

**Architecture**:
- Hook is deployed first as **reusable infrastructure**
- Multiple RewardToken contracts can share the same hook
- RewardToken address is passed via hookData at runtime (flexible)

**Flow**:
1. User makes payment
2. Payment is transferred to merchant
3. Reward points are calculated and distributed to user

**Reward Calculation**:
- Rate: 1000 points per $0.1 USDC
- Formula: `(amount * REWARD_RATE * 10^18) / 100_000`
- Example: Pay $0.1 USDC → Get 1000 points

**Configuration**:
```solidity
constructor(address _settlementHub) {
    settlementRouter = _settlementHub;
}

// hookData format: abi.encode(RewardConfig)
struct RewardConfig {
    address rewardToken;  // Reward token address
    address merchant;     // Merchant receiving payment
}
```

### `RewardToken.sol`
**Purpose**: ERC20 reward points token with controlled distribution

**Architecture**:
- Depends on RewardHook (deployed first)
- Hook address is immutably set in constructor (secure by design)
- No front-running risk

**Features**:
- Fixed supply of 1,000,000 tokens
- All tokens initially held by contract
- Only designated hook can distribute tokens
- Hook address is immutable

**Key Functions**:
```solidity
constructor(address _hook); // Set hook address at deployment
function distribute(address to, uint256 amount) external; // Only callable by hook
function remainingRewards() external view returns (uint256);
```

## Deployment Example

```solidity
// 1. Deploy RewardHook (reusable infrastructure)
RewardHook hook = new RewardHook(settlementRouter);

// 2. Deploy RewardToken with hook address (secure by design)
RewardToken rewardToken = new RewardToken(address(hook));

// 3. Configure hookData for each transaction
bytes memory hookData = abi.encode(RewardConfig({
    rewardToken: address(rewardToken),
    merchant: merchantAddress
}));
```

**Architecture Benefits**:
- ✅ Hook deployed first → Can be reused by multiple tokens
- ✅ Hook address set in constructor → No front-running risk
- ✅ Token address passed at runtime → Flexibility for multi-token scenarios
- ✅ Clean separation: Infrastructure (hook) vs Application (token)

## Reward Calculation Examples

| Payment Amount (USDC) | Amount in Wei | Reward Points |
|----------------------|---------------|---------------|
| $0.1                 | 100,000       | 1,000         |
| $1.0                 | 1,000,000     | 10,000        |
| $10.0                | 10,000,000    | 100,000       |

## Use Cases

- **Customer Loyalty Programs**: Points for purchases
- **Cashback Systems**: Token-based cashback rewards
- **Gamification**: Points for user engagement
- **Membership Tiers**: Points-based membership levels
- **Referral Programs**: Reward points for referrals

## Customization Options

### Modify Reward Rate
```solidity
// Change REWARD_RATE constant
uint256 public constant REWARD_RATE = 2000; // 2000 points per $0.1
```

### Dynamic Reward Rates
```solidity
// Add rate configuration to hookData
struct RewardConfig {
    address merchant;
    uint256 rewardRate;  // Custom rate for this transaction
}

bytes memory hookData = abi.encode(RewardConfig({
    merchant: merchantAddress,
    rewardRate: customRate
}));
```

### Multiple Reward Tiers
```solidity
// Implement tier-based rewards
function calculateReward(uint256 amount, address user) internal view returns (uint256) {
    uint256 userTier = getUserTier(user);
    uint256 multiplier = getTierMultiplier(userTier);
    return (amount * REWARD_RATE * multiplier * 10**18) / 100_000;
}
```

## Integration Notes

- Each application should deploy its own RewardToken and RewardHook
- Consider token economics and total supply requirements
- Monitor remaining reward token balance
- Implement additional features like token burning, staking, or redemption
- Consider gas costs for reward distribution
- Add access controls for administrative functions
