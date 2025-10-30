// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ISettlementHook} from "../../src/interfaces/ISettlementHook.sol";

/**
 * @title RevenueSplitHook
 * @notice Revenue Split Hook - Distribute revenue proportionally
 * @dev Allocate received funds to multiple recipients according to predetermined ratios
 * 
 * Use cases:
 *   - Merchant and platform split
 *   - Multi-party collaborative revenue distribution
 *   - Royalty distribution
 */
contract RevenueSplitHook is ISettlementHook {
    using SafeERC20 for IERC20;
    
    // ===== State Variables =====
    
    /// @notice SettlementHub contract address
    address public immutable settlementHub;
    
    // ===== Data Structures =====
    
    /**
     * @notice Revenue split configuration
     * @param recipient Recipient address
     * @param bips Basis points (1-10000, 1 bip = 0.01%)
     */
    struct Split {
        address recipient;
        uint16 bips;
    }
    
    // ===== Events =====
    
    /**
     * @notice Revenue split completed event
     * @param contextKey Settlement context ID
     * @param recipient Recipient address
     * @param amount Split amount
     */
    event RevenueSplit(
        bytes32 indexed contextKey,
        address indexed recipient,
        uint256 amount
    );
    
    // ===== Error Definitions =====
    
    error OnlyHub();
    error InvalidTotalBips(uint256 totalBips);
    error InvalidRecipient(address recipient);
    
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
     * @dev hookData format: abi.encode(Split[])
     * 
     * Validation:
     *   - Total ratio must be 10000 (100%)
     *   - Recipient address cannot be 0
     *   - Precision error handling (last recipient gets remainder)
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
        // Decode split data
        Split[] memory splits = abi.decode(data, (Split[]));
        
        // Validate total is 100%
        uint256 totalBips = 0;
        for (uint i = 0; i < splits.length; i++) {
            if (splits[i].recipient == address(0)) {
                revert InvalidRecipient(address(0));
            }
            totalBips += splits[i].bips;
        }
        
        if (totalBips != 10000) {
            revert InvalidTotalBips(totalBips);
        }
        
        // Execute split
        uint256 remaining = amount;
        for (uint i = 0; i < splits.length; i++) {
            uint256 splitAmount;
            
            // Last recipient gets remaining amount (handles precision errors)
            if (i == splits.length - 1) {
                splitAmount = remaining;
            } else {
                splitAmount = (amount * splits[i].bips) / 10000;
                remaining -= splitAmount;
            }
            
            // Transfer from Hub to recipient
            IERC20(token).safeTransferFrom(
                settlementHub,
                splits[i].recipient,
                splitAmount
            );
            
            emit RevenueSplit(contextKey, splits[i].recipient, splitAmount);
        }
        
        // Note: salt, payTo, and facilitator parameters are available for advanced use cases
        // For example, facilitator could receive additional rewards based on performance
        
        // Return number of splits
        return abi.encode(splits.length);
    }
}

