# Revenue Split Scenario

This scenario demonstrates automatic revenue distribution among multiple parties.

## Contracts

### `RevenueSplitHook.sol`
**Purpose**: Distribute payment proportionally among multiple recipients

**Flow**:
1. User makes payment
2. Payment is automatically split according to predefined ratios
3. Each recipient receives their share directly

**Configuration**:
```solidity
struct Split {
    address recipient;  // Recipient address
    uint16 bips;       // Basis points (1-10000, 1 bip = 0.01%)
}
```

**Validation**:
- Total basis points must equal 10000 (100%)
- All recipient addresses must be valid
- Last recipient gets remainder to handle precision errors


## Deployment Example
```solidity
// 1. Deploy Hook
RevenueSplitHook hook = new RevenueSplitHook(settlementRouter);

// 2. Configure split for each transaction
Split[] memory splits = new Split[](2);
splits[0] = Split({
    recipient: merchantAddress,
    bips: 9500  // 95% to merchant
});
splits[1] = Split({
    recipient: platformAddress,
    bips: 500   // 5% to platform
});

bytes memory hookData = abi.encode(splits);
```


## Use Cases

- **Marketplace Commissions**: Automatic platform fee collection
- **Affiliate Programs**: Revenue sharing with referrers
- **Royalty Distribution**: Creator royalties on secondary sales
- **Partnership Revenue**: Revenue sharing between business partners
- **Multi-vendor Platforms**: Split payments among multiple sellers

## Integration Notes

- Each application should deploy its own Hook instance
- Consider gas costs for complex split configurations
- Use basis points (1-10000) for precise percentage calculations
- Last recipient gets remainder to handle rounding errors
