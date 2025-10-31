# NFT Mint Scenario

This scenario demonstrates automatic NFT minting upon payment completion.

## Contracts

### `NFTMintHook.sol`
**Purpose**: Automatically mint NFT to payer after payment is processed

**Flow**:
1. User pays for NFT
2. Payment is transferred to merchant
3. NFT is automatically minted to user's address

**Configuration**:
```solidity
struct MintConfig {
    address nftContract;  // NFT contract address
    uint256 tokenId;      // Token ID to mint
    address recipient;    // Usually the payer
    address merchant;     // Merchant receiving payment
}
```

### `RandomNFT.sol`
**Purpose**: Example NFT contract with sequential token ID generation

**Features**:
- Maximum supply of 1000 NFTs
- Sequential token IDs (0-999)
- Only designated minter can mint
- One-time minter setup for security

## Deployment Example

```solidity
// 1. Deploy Hook first
NFTMintHook hook = new NFTMintHook(settlementRouter);

// 2. Deploy NFT contract with Hook as minter (secure by design)
RandomNFT nft = new RandomNFT(address(hook));

// 3. Configure hookData for each sale
bytes memory hookData = abi.encode(MintConfig({
    nftContract: address(nft),
    tokenId: nextTokenId,
    recipient: payer,
    merchant: merchantAddress
}));
```

**Security Note**: The minter address is set in the constructor to prevent front-running attacks. The deployment order matters: Hook must be deployed before the NFT contract.

## Use Cases

- **NFT Marketplaces**: Automatic fulfillment of NFT purchases
- **Digital Collectibles**: Mint-on-demand collectibles
- **Event Tickets**: NFT-based event tickets
- **Membership Cards**: NFT membership tokens
- **Gaming Assets**: In-game item NFTs

## Integration Notes

- Each application should deploy its own NFT contract and Hook instance
- The NFT contract must authorize the Hook as a minter
- Token IDs can be pre-determined or generated dynamically
- Consider gas costs for complex NFT minting logic
