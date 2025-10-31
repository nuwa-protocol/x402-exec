# Hook Development Guide

## What are Hooks?

Hooks are the core extension mechanism of the x402 settlement system. By implementing the `ISettlementHook` interface, you can execute arbitrary business logic after payment completion, such as:
- 💰 Revenue splitting
- 🎨 NFT minting  
- 🎁 Reward points
- 📦 Automatic fulfillment

## Core Interface

```solidity
interface ISettlementHook {
    function execute(
        bytes32 contextKey,  // Settlement context ID
        address payer,       // Payer address
        address token,       // Token contract address
        uint256 amount,      // Amount
        bytes calldata data  // Business data
    ) external returns (bytes memory);
}
```

## Quick Start

### 1. Choose a Scenario Template

We provide complete implementations for three common scenarios. Choose the one that best fits your needs:

| Scenario | Description | Example Directory |
|----------|-------------|-------------------|
| 💰 **Revenue Split** | Automatically distribute revenue among multiple parties | [`examples/revenue-split/`](../examples/revenue-split/) |
| 🎨 **NFT Minting** | Automatically mint NFT to user after payment | [`examples/nft-mint/`](../examples/nft-mint/) |
| 🎁 **Reward Points** | Pay merchant while distributing reward points to user | [`examples/reward-points/`](../examples/reward-points/) |

### 2. Basic Template

```solidity
contract MyHook is ISettlementHook {
    using SafeERC20 for IERC20;
    
    address public immutable settlementHub;
    
    modifier onlyHub() {
        require(msg.sender == settlementHub, "Only hub");
        _;
    }
    
    constructor(address _settlementHub) {
        settlementHub = _settlementHub;
    }
    
    function execute(
        bytes32 contextKey,
        address payer,
        address token,
        uint256 amount,
        bytes calldata data
    ) external onlyHub returns (bytes memory) {
        // 1. Parse business data
        address recipient = abi.decode(data, (address));
        
        // 2. Execute business logic
        // TODO: Your business logic here
        
        // 3. Transfer funds (must consume all amount)
        IERC20(token).safeTransferFrom(settlementHub, recipient, amount);
        
        return abi.encode(recipient);
    }
}
```

## 🔒 Security Requirements

### ✅ Must Follow Rules

1. **Only Hub can call** - Use `onlyHub` modifier to prevent unauthorized access
2. **Consume all funds from Hub** - Must transfer out the entire `amount` from SettlementHub

```solidity
// ✅ Correct: Consume all amount from Hub
IERC20(token).safeTransferFrom(settlementHub, recipient, amount);

// ✅ Also correct: Hook can hold funds if needed for business logic
IERC20(token).safeTransferFrom(settlementHub, address(this), amount);
// ... later business logic to distribute funds

// ❌ Wrong: Leaving funds in Hub
IERC20(token).safeTransferFrom(settlementHub, recipient, amount / 2);
// This will cause "HubShouldNotHoldFunds" error
```

### 💡 Design Flexibility

- **Hooks CAN hold funds** - Useful for escrow, batching, or delayed payments
- **Hub CANNOT hold funds** - This is enforced by the SettlementHub contract
- **Business logic is flexible** - Design your Hook according to your use case

## 📚 Complete Examples

Each example includes complete contract code, deployment scripts, and test cases:

### 💰 Revenue Split - [`examples/revenue-split/`](../examples/revenue-split/)
**Scenario**: E-commerce platform with automatic commission
- Merchant receives 95% of payment
- Platform automatically collects 5% commission  
- Supports any number of split parties

### 🎨 NFT Minting - [`examples/nft-mint/`](../examples/nft-mint/)
**Scenario**: Digital artwork purchase
- User automatically receives NFT after payment
- Supports NFT minting + revenue split combination
- Includes complete NFT contract example

### 🎁 Reward Points - [`examples/reward-points/`](../examples/reward-points/)
**Scenario**: Member loyalty system
- Merchant receives full payment
- User gets reward points (1000 points per $0.1)
- Includes ERC20 reward token contract

## 🚀 Next Steps

1. **Explore Examples**: Browse the [`examples/`](../examples/) directory for complete implementations
2. **Run Tests**: Execute `forge test` to see all examples in action
3. **Deploy**: Use the deployment scripts in each example directory
4. **Customize**: Modify the examples to fit your specific use case

## 📖 Additional Resources

- **[API Documentation](./API.md)** - Complete API reference
- **[Security Guide](./SECURITY.md)** - Security best practices
- **[Facilitator Guide](./FACILITATOR_GUIDE.md)** - Integration guide for facilitators

## 💡 Best Practices

- Always use `SafeERC20` for token transfers
- Add event logging for important actions
- Validate all input parameters
- Consider gas optimization for complex logic
- Test thoroughly with edge cases

## ❓ Common Issues

**Q: Hook execution fails with "balance not zero"**  
A: Ensure your Hook consumes the entire `amount` parameter

**Q: "Only hub" error when testing**  
A: Make sure to call from the SettlementHub address in tests

**Q: Gas limit exceeded**  
A: Optimize your Hook logic or split complex operations