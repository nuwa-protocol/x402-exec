# Settlement Hook Examples

This directory contains various examples of Settlement Hooks organized by business scenarios. Each scenario includes all necessary contracts for a complete implementation.

## Directory Structure

### 🎨 `nft-mint/`
**Scenario: NFT Sales & Minting**

Complete NFT minting solutions for digital asset sales:
- **`NFTMintHook.sol`** - Automatically mint NFT after payment
- **`RandomNFT.sol`** - Example NFT contract with sequential token ID generation

*Use cases: NFT marketplaces, digital collectibles, event tickets*

### 🎁 `reward-points/`
**Scenario: Loyalty & Rewards**

Customer loyalty and reward point systems:
- **`RewardHook.sol`** - Transfer payment to merchant and distribute reward tokens
- **`RewardToken.sol`** - ERC20 reward points token with controlled distribution

*Use cases: Customer loyalty programs, cashback systems, gamification*

## Current Design Philosophy

### Scenario-Specific Hooks

Each Hook is designed for a specific business scenario and is deployed per application:

- **Application-Specific**: Each app deploys its own Hook instance with specific parameters
- **Scenario-Focused**: Hooks are optimized for particular use cases rather than generic flexibility
- **Trust Model**: Resource Server controls Hook configuration; Facilitator only handles gas costs

### Known Limitations

1. **hookData is not cryptographically protected**
   - Facilitator could theoretically modify hookData
   - Mitigation: Resource Server can run its own Facilitator or use trusted Facilitators

2. **Hook instances are application-specific**
   - Each application needs to deploy its own Hook
   - Mitigation: Use standard Hook implementations from examples

### When to Use

This design is appropriate when:
- Resource Server can run or trust the Facilitator
- Application-specific Hook logic is acceptable
- Focus is on core functionality rather than maximum decentralization

## Integration

All Hook examples implement the `ISettlementHook` interface and can be used with the SettlementRouter contract. Each scenario includes:

1. **Hook Contract** - Business logic implementation
2. **Supporting Contracts** - Tokens, NFTs, or other required contracts
3. **Deployment Examples** - How to deploy and configure the scenario
4. **Test Cases** - Comprehensive testing examples

## Getting Started

1. Choose the scenario that matches your use case
2. Deploy the required contracts from that scenario
3. Configure the Hook with your specific parameters
4. Integrate with your Resource Server

Run `forge test` from the contracts root to execute all tests.
