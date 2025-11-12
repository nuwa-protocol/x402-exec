# NFT Mint Scenario

This scenario demonstrates automatic NFT minting after payment.

## Contracts

### `NFTMintHook.sol`
**Purpose**: Automatically mint NFT to customer after receiving payment

**Architecture**:
- Hook is deployed once as reusable infrastructure
- Can be used with any NFT contract that implements `mint(address)` function
- NFT contract address is passed via hookData at runtime (flexible)

**Design Improvements** (Post-Refactor):
- ✅ **Simplified Configuration**: Only requires NFT contract address in hookData
- ✅ **Removed Redundancy**: Uses `payTo` parameter instead of separate `merchant` field
- ✅ **Enhanced Security**: Follows CEI pattern (transfer payment first, then mint NFT)
- ✅ **Better Error Handling**: Properly bubbles up revert reasons from NFT contracts
- ✅ **Reentrancy Protection**: Payment secured before external NFT mint call

**Flow**:
1. User makes payment
2. **Payment is transferred to merchant first** (CEI pattern for security)
3. NFT is minted to user
4. If either step fails, entire transaction reverts (atomic)

**Configuration**:
```solidity
constructor(address _settlementRouter) {
    settlementRouter = _settlementRouter;
}

// hookData format: abi.encode(MintConfig)
struct MintConfig {
    address nftContract;  // NFT contract address (must implement mint(address))
}

// Example hookData encoding
bytes memory hookData = abi.encode(MintConfig({
    nftContract: address(randomNFT)
}));
```

**Security Features**:
- Only callable by SettlementRouter
- Validates NFT contract address is non-zero
- Validates payTo address is non-zero
- Follows Checks-Effects-Interactions (CEI) pattern
- Properly handles NFT mint failures with detailed error messages
- Prevents reentrancy by securing funds before external calls

### `RandomNFT.sol`
**Purpose**: Example NFT contract with automatic sequential token ID generation

**Architecture**:
- Minter address set at deployment (immutable)
- Sequential token IDs (0, 1, 2, ..., 9,999)
- Maximum supply of 10,000 NFTs

**Interface** (Post-Refactor):
```solidity
// Simple mint function - contract manages tokenId internally
function mint(address to) external;

// View functions
function totalSupply() external view returns (uint256);
function remainingSupply() external view returns (uint256);
```

**Key Changes**:
- ✅ **Simplified Interface**: No longer requires tokenId parameter
- ✅ **Automatic ID Assignment**: Contract manages token ID sequence internally
- ✅ **Cleaner API**: Removes confusion about ignored parameters

## Deployment Example

```solidity
// 1. Deploy NFTMintHook (reusable for all projects)
NFTMintHook hook = new NFTMintHook(settlementRouter);

// 2. Deploy RandomNFT with hook as minter
RandomNFT nft = new RandomNFT(address(hook));

// 3. Configure hookData for each transaction
bytes memory hookData = abi.encode(NFTMintHook.MintConfig({
    nftContract: address(nft)
}));

// 4. Execute settlement with NFT mint
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

## Use Cases

### NFT Sales
- Digital art purchases
- Collectible card sales
- Limited edition items

### Membership NFTs
- Gym membership cards
- Club access passes
- Subscription proof tokens

### Event Tickets
- Concert tickets
- Conference passes
- Sports event tickets

### Digital Products
- Game items
- Virtual land
- In-game assets

## Gas Optimization

The refactored design is more gas-efficient:
- **Removed merchant field**: Saves 32 bytes in hookData (~512 gas)
- **CEI pattern**: No additional overhead, improves security
- **Better error handling**: Minimal gas cost for improved developer experience

## Integration Notes

### For NFT Contract Developers

Your NFT contract must implement:
```solidity
function mint(address to) external;
```

The function should:
- Check that `msg.sender` is the authorized minter
- Generate the next token ID internally
- Call `_safeMint(to, tokenId)` or `_mint(to, tokenId)`
- Revert with clear error message if minting fails

### For Frontend Developers

```typescript
// Simple hookData encoding - only NFT address needed
const hookData = ethers.AbiCoder.defaultAbiCoder().encode(
    ['tuple(address nftContract)'],
    [{
        nftContract: nftAddress
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
```

## Security Considerations

### ✅ Protected Against
- **Reentrancy**: CEI pattern ensures funds are secured before external calls
- **Invalid addresses**: Validates both NFT contract and payTo addresses
- **Failed mints**: Entire transaction reverts if NFT mint fails
- **Malicious NFT contracts**: Error messages are properly bubbled up

### ⚠️ Considerations
- NFT contract must be trusted (can execute arbitrary code during mint)
- Minter role in NFT contract should be set correctly at deployment
- Max supply should be checked by the NFT contract to prevent over-minting

## Testing

Comprehensive tests are provided in:
- `contracts/test/Scenarios.t.sol` - Basic functionality tests
- `contracts/test/adversarial/ShowcaseSecurityTests.t.sol` - Security tests including:
  - Malicious NFT reentrancy attempts
  - NFT mint failures
  - Address validation
  - Max supply enforcement

Run tests with:
```bash
forge test --match-contract ShowcaseSecurityTests
```

## Changelog

### v2.0 (Post-Refactor)
- ✅ Removed `tokenId` parameter (NFT contracts manage IDs internally)
- ✅ Removed `merchant` field from MintConfig (use `payTo` instead)
- ✅ Enhanced security with CEI pattern (payment first, then mint)
- ✅ Improved error handling (bubble up revert reasons)
- ✅ Added comprehensive security tests
- ✅ Reduced gas costs by simplifying configuration

### v1.0 (Original)
- Initial implementation with merchant and tokenId parameters
