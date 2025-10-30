// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/**
 * @title RandomNFT
 * @notice A simple NFT contract with sequential token ID generation and supply cap
 * @dev Used in Scenario 2: Random NFT Mint showcase
 * 
 * Features:
 * - Maximum supply of 1000 NFTs
 * - Sequential token IDs (0-999)
 * - Only designated minter can mint (NFTMintHook)
 * - One-time minter setup for security
 */
contract RandomNFT is ERC721 {
    // ===== Constants =====
    
    /// @notice Maximum number of NFTs that can be minted
    uint256 public constant MAX_SUPPLY = 1000;
    
    // ===== State Variables =====
    
    /// @notice Address authorized to mint NFTs (NFTMintHook)
    address public minter;
    
    /// @notice Counter for the next token ID to be minted
    uint256 private _nextTokenId;
    
    // ===== Events =====
    
    /// @notice Emitted when minter address is set
    event MinterSet(address indexed minter);
    
    // ===== Errors =====
    
    error OnlyMinter();
    error MaxSupplyReached();
    
    // ===== Constructor =====
    
    /**
     * @notice Initializes the NFT contract with minter address
     * @param _minter Address authorized to mint NFTs (should be NFTMintHook)
     */
    constructor(address _minter) ERC721("Random NFT", "RNFT") {
        require(_minter != address(0), "Invalid minter address");
        minter = _minter;
        emit MinterSet(_minter);
    }
    
    // ===== External Functions =====
    
    /**
     * @notice Mints a new NFT to the specified address
     * @dev Can only be called by the authorized minter
     * @dev Token ID is automatically assigned sequentially
     * @param to Address to receive the NFT
     */
    function mint(address to, uint256 /* tokenId */) external {
        if (msg.sender != minter) revert OnlyMinter();
        if (_nextTokenId >= MAX_SUPPLY) revert MaxSupplyReached();
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
    }
    
    /**
     * @notice Returns the current supply of minted NFTs
     * @return Current number of NFTs minted
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }
    
    /**
     * @notice Returns the remaining number of NFTs that can be minted
     * @return Number of NFTs still available
     */
    function remainingSupply() external view returns (uint256) {
        return MAX_SUPPLY - _nextTokenId;
    }
}

