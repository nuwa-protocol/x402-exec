// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ISettlementHook} from "../../src/interfaces/ISettlementHook.sol";

/**
 * @title NFTMintHook
 * @notice NFT Mint Hook - Automatically mint NFT after payment
 * @dev Transfer all received funds to merchant, while minting NFT to payer
 * 
 * Use cases:
 *   - NFT sales (auto-fulfillment)
 *   - Membership card NFT purchase
 *   - Event ticket NFT
 */
contract NFTMintHook is ISettlementHook {
    using SafeERC20 for IERC20;
    
    // ===== State Variables =====
    
    /// @notice SettlementHub contract address
    address public immutable settlementHub;
    
    // ===== Data Structures =====
    
    /**
     * @notice NFT mint configuration
     * @param nftContract NFT contract address
     * @param tokenId Token ID
     * @param recipient Recipient address (usually the payer)
     * @param merchant Merchant address (recipient of funds)
     */
    struct MintConfig {
        address nftContract;
        uint256 tokenId;
        address recipient;
        address merchant;
    }
    
    // ===== Events =====
    
    /**
     * @notice NFT mint completed event
     * @param contextKey Settlement context ID
     * @param nftContract NFT contract address
     * @param tokenId Token ID
     * @param recipient Recipient address
     */
    event NFTMinted(
        bytes32 indexed contextKey,
        address indexed nftContract,
        uint256 indexed tokenId,
        address recipient
    );
    
    /**
     * @notice Merchant payment received event
     * @param contextKey Settlement context ID
     * @param merchant Merchant address
     * @param amount Amount
     */
    event MerchantPaid(
        bytes32 indexed contextKey,
        address indexed merchant,
        uint256 amount
    );
    
    // ===== Error Definitions =====
    
    error OnlyHub();
    error InvalidAddress();
    
    // ===== Modifiers =====
    
    modifier onlyHub() {
        if (msg.sender != settlementHub) {
            revert OnlyHub();
        }
        _;
    }
    
    // ===== Constructor =====
    
    constructor(address _settlementHub) {
        require(_settlementHub != address(0), "Invalid hub address");
        settlementHub = _settlementHub;
    }
    
    // ===== Core Functions =====
    
    /**
     * @inheritdoc ISettlementHook
     * @dev hookData format: abi.encode(MintConfig)
     */
    function execute(
        bytes32 contextKey,
        address payer,
        address token,
        uint256 amount,
        bytes32 salt,
        address payTo,
        address facilitator,
        bytes calldata data
    ) external onlyHub returns (bytes memory) {
        // Decode configuration
        MintConfig memory config = abi.decode(data, (MintConfig));
        
        // Validate addresses
        if (config.nftContract == address(0) || 
            config.recipient == address(0) || 
            config.merchant == address(0)) {
            revert InvalidAddress();
        }
        
        // 1. Mint NFT to recipient
        _safeMint(config.nftContract, config.recipient, config.tokenId);
        emit NFTMinted(contextKey, config.nftContract, config.tokenId, config.recipient);
        
        // 2. Transfer to merchant
        IERC20(token).safeTransferFrom(
            settlementHub,
            config.merchant,
            amount
        );
        emit MerchantPaid(contextKey, config.merchant, amount);
        
        // Note: salt, payTo, and facilitator parameters are available but not used in this simple hook
        // Advanced hooks could use facilitator for referral rewards or other incentive mechanisms
        
        // Return tokenId
        return abi.encode(config.tokenId);
    }
    
    // ===== Internal Methods =====
    
    /**
     * @notice Safely mint NFT
     * @dev Use low-level call to be compatible with different NFT contracts
     */
    function _safeMint(address nftContract, address to, uint256 tokenId) internal {
        // Call mint(address to, uint256 tokenId)
        (bool success, ) = nftContract.call(
            abi.encodeWithSignature("mint(address,uint256)", to, tokenId)
        );
        require(success, "NFT mint failed");
    }
}

