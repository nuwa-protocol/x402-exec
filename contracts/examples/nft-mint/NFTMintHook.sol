// SPDX-License-Identifier: Apache-2.0
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
    
    /// @notice SettlementRouter contract address
    address public immutable settlementRouter;
    
    // ===== Data Structures =====
    
    /**
     * @notice NFT mint configuration
     * @param nftContract NFT contract address (must implement mint(address) function)
     */
    struct MintConfig {
        address nftContract;
    }
    
    // ===== Events =====
    
    /**
     * @notice NFT mint completed event
     * @param contextKey Settlement context ID
     * @param nftContract NFT contract address
     * @param recipient Recipient address
     */
    event NFTMinted(
        bytes32 indexed contextKey,
        address indexed nftContract,
        address indexed recipient
    );
    
    /**
     * @notice Payment transferred event
     * @param contextKey Settlement context ID
     * @param payTo Recipient address
     * @param amount Amount
     */
    event PaymentTransferred(
        bytes32 indexed contextKey,
        address indexed payTo,
        uint256 amount
    );
    
    // ===== Error Definitions =====
    
    error OnlyRouter();
    error InvalidAddress();
    
    // ===== Modifiers =====
    
    modifier onlyRouter() {
        if (msg.sender != settlementRouter) {
            revert OnlyRouter();
        }
        _;
    }
    
    // ===== Constructor =====
    
    constructor(address _settlementRouter) {
        require(_settlementRouter != address(0), "Invalid router address");
        settlementRouter = _settlementRouter;
    }
    
    // ===== Core Functions =====
    
    /**
     * @inheritdoc ISettlementHook
     * @dev hookData format: abi.encode(MintConfig)
     * 
     * Execution order follows CEI (Checks-Effects-Interactions) pattern:
     * 1. Checks: Validate addresses
     * 2. Interactions: Transfer payment first (revert on failure)
     * 3. Interactions: Mint NFT (revert if fails, payment already secured)
     * 
     * This order prevents reentrancy attacks where a malicious NFT contract
     * could drain funds during the mint callback.
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
    ) external onlyRouter returns (bytes memory) {
        // Decode configuration
        MintConfig memory config = abi.decode(data, (MintConfig));
        
        // Validate addresses
        if (config.nftContract == address(0)) {
            revert InvalidAddress();
        }
        if (payTo == address(0)) {
            revert InvalidAddress();
        }
        
        // 1. Transfer payment to payTo (merchant) first - secures funds before external call
        IERC20(token).safeTransferFrom(
            settlementRouter,
            payTo,
            amount
        );
        emit PaymentTransferred(contextKey, payTo, amount);
        
        // 2. Mint NFT to payer - after funds are secured
        _safeMint(config.nftContract, payer);
        emit NFTMinted(contextKey, config.nftContract, payer);
        
        // Note: salt and facilitator parameters are available for advanced use cases
        // Advanced hooks could use facilitator for referral rewards or other incentive mechanisms
        
        // Return NFT contract address for tracking
        return abi.encode(config.nftContract);
    }
    
    // ===== Internal Methods =====
    
    /**
     * @notice Safely mint NFT
     * @dev Use low-level call to be compatible with different NFT contracts
     *      Calls mint(address) function on the NFT contract
     *      The NFT contract is responsible for managing tokenId generation
     * @param nftContract Address of the NFT contract
     * @param to Address to receive the minted NFT
     */
    function _safeMint(address nftContract, address to) internal {
        // Call mint(address to)
        (bool success, bytes memory returnData) = nftContract.call(
            abi.encodeWithSignature("mint(address)", to)
        );
        
        // Verify call succeeded
        if (!success) {
            // If there's return data, it might be a revert reason
            if (returnData.length > 0) {
                // Bubble up the revert reason
                assembly {
                    let returnDataSize := mload(returnData)
                    revert(add(32, returnData), returnDataSize)
                }
            } else {
                revert("NFT mint failed");
            }
        }
    }
}

