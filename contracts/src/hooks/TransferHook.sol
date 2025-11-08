// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ISettlementHook} from "../interfaces/ISettlementHook.sol";

/**
 * @title TransferHook
 * @notice Built-in Hook for simple and distributed token transfers with facilitator fee support
 * @dev This is the protocol's default Hook that replaces direct ERC-3009 transfers
 *      while enabling facilitator fee mechanism through SettlementRouter.
 * 
 * Features:
 *   - Simple single transfer (when data is empty)
 *   - Distributed transfer to multiple recipients by percentage (when data is provided)
 *   - No hookData required for simple transfers
 *   - Universal deployment (one instance for all projects)
 *   - Minimal gas overhead compared to direct transfers
 * 
 * Use cases:
 *   - Simple payments with facilitator fee support
 *   - Distributed payments (payroll, revenue splits, batch rewards)
 *   - Replacing direct ERC-3009 transferWithAuthorization calls
 *   - Any scenario not requiring custom business logic
 * 
 * @custom:security-contact security@x402settlement.org
 */
contract TransferHook is ISettlementHook {
    using SafeERC20 for IERC20;
    
    // ===== Data Structures =====
    
    /**
     * @notice Split configuration for distributed transfer mode
     * @param recipient Recipient address
     * @param bips Basis points (1-10000, 1 bip = 0.01%, 10000 = 100%)
     */
    struct Split {
        address recipient;
        uint16 bips;
    }
    
    // ===== State Variables =====
    
    /// @notice SettlementRouter contract address
    address public immutable settlementRouter;
    
    // ===== Events =====
    
    /**
     * @notice Emitted when a transfer is executed
     * @param contextKey Settlement context ID
     * @param recipient Final recipient address
     * @param amount Amount transferred
     */
    event Transfer(
        bytes32 indexed contextKey,
        address indexed recipient,
        uint256 amount
    );
    
    /**
     * @notice Emitted when distributed transfer is completed
     * @param contextKey Settlement context ID
     * @param totalAmount Total amount distributed
     * @param recipientCount Number of recipients (including payTo)
     */
    event DistributedTransfer(
        bytes32 indexed contextKey,
        uint256 totalAmount,
        uint256 recipientCount
    );
    
    // ===== Error Definitions =====
    
    error OnlyRouter();
    error InvalidRouterAddress();
    error EmptySplits();
    error InvalidTotalBips(uint256 totalBips);
    error InvalidRecipient(address recipient);
    error InvalidBips(uint16 bips);
    
    // ===== Modifiers =====
    
    modifier onlyRouter() {
        if (msg.sender != settlementRouter) {
            revert OnlyRouter();
        }
        _;
    }
    
    // ===== Constructor =====
    
    /**
     * @notice Initializes the TransferHook with SettlementRouter address
     * @param _settlementRouter Address of the SettlementRouter contract
     */
    constructor(address _settlementRouter) {
        if (_settlementRouter == address(0)) {
            revert InvalidRouterAddress();
        }
        settlementRouter = _settlementRouter;
    }
    
    // ===== Core Functions =====
    
    /**
     * @inheritdoc ISettlementHook
     * @dev Executes simple or distributed transfer based on data parameter
     * 
     * Mode 1 - Simple Transfer (data is empty):
     *   - Transfers entire amount to payTo address
     *   - No data encoding required
     *   - Most gas efficient
     *   - Returns: abi.encode(recipient, amount)
     * 
     * Mode 2 - Distributed Transfer (data is provided):
     *   - data format: abi.encode(Split[])
     *   - Transfers to multiple recipients as specified in data by percentage
     *   - payTo receives remaining percentage (if totalBips < 10000)
     *   - If totalBips = 10000, payTo receives 0
     *   - Returns: abi.encode(recipientCount, totalAmount)
     * 
     * Validation:
     *   - Total bips must be <= 10000 (100%)
     *   - Each recipient must be non-zero address
     *   - Each bips must be > 0
     *   - Splits array must not be empty
     * 
     * Parameters:
     *   - contextKey: Unique settlement identifier
     *   - payer: Address that signed the payment authorization
     *   - token: Token contract address
     *   - amount: Amount to transfer (already deducted facilitator fee)
     *   - salt: Unique identifier from Resource Server
     *   - payTo: Primary recipient address (gets 100% in simple mode, remainder in distributed mode)
     *   - facilitator: Address of the facilitator
     *   - data: Optional Split[] for distributed mode, empty for simple mode
     */
    function execute(
        bytes32 contextKey,
        address /* payer */,
        address token,
        uint256 amount,
        bytes32 /* salt */,
        address payTo,
        address /* facilitator */,
        bytes calldata data
    ) external onlyRouter returns (bytes memory) {
        // Mode 1: Simple Transfer (backward compatible)
        if (data.length == 0) {
            return _executeSimpleTransfer(contextKey, token, amount, payTo);
        }
        
        // Mode 2: Distributed Transfer
        return _executeDistributedTransfer(contextKey, token, amount, payTo, data);
    }
    
    // ===== Internal Functions =====
    
    /**
     * @dev Executes simple transfer to single recipient
     * @param contextKey Settlement context ID
     * @param token Token contract address
     * @param amount Amount to transfer
     * @param recipient Recipient address
     * @return Encoded tuple of (recipient, amount)
     */
    function _executeSimpleTransfer(
        bytes32 contextKey,
        address token,
        uint256 amount,
        address recipient
    ) private returns (bytes memory) {
        // Transfer entire amount to recipient
        IERC20(token).safeTransferFrom(settlementRouter, recipient, amount);
        
        // Emit transfer event
        emit Transfer(contextKey, recipient, amount);
        
        // Return transfer details
        return abi.encode(recipient, amount);
    }
    
    /**
     * @dev Executes distributed transfer to multiple recipients by percentage
     * @param contextKey Settlement context ID
     * @param token Token contract address
     * @param amount Total amount to distribute
     * @param payTo Primary recipient (receives remainder)
     * @param data Encoded Split[] array
     * @return Encoded tuple of (recipientCount, totalAmount)
     */
    function _executeDistributedTransfer(
        bytes32 contextKey,
        address token,
        uint256 amount,
        address payTo,
        bytes calldata data
    ) private returns (bytes memory) {
        // Decode split data
        Split[] memory splits = abi.decode(data, (Split[]));
        
        // Validate splits array not empty
        if (splits.length == 0) {
            revert EmptySplits();
        }
        
        // Validate total bips and recipients
        uint256 totalBips = 0;
        for (uint256 i = 0; i < splits.length; i++) {
            if (splits[i].recipient == address(0)) {
                revert InvalidRecipient(address(0));
            }
            if (splits[i].bips == 0) {
                revert InvalidBips(0);
            }
            totalBips += splits[i].bips;
        }
        
        // Total bips must not exceed 10000 (100%)
        if (totalBips > 10000) {
            revert InvalidTotalBips(totalBips);
        }
        
        // Execute splits and track remaining amount
        uint256 remaining = amount;
        for (uint256 i = 0; i < splits.length; i++) {
            uint256 splitAmount = (amount * splits[i].bips) / 10000;
            
            // Transfer to split recipient
            IERC20(token).safeTransferFrom(
                settlementRouter,
                splits[i].recipient,
                splitAmount
            );
            
            remaining -= splitAmount;
            
            // Emit individual transfer event
            emit Transfer(contextKey, splits[i].recipient, splitAmount);
        }
        
        // Transfer remaining to payTo (if any)
        uint256 recipientCount = splits.length;
        if (remaining > 0) {
            IERC20(token).safeTransferFrom(
                settlementRouter,
                payTo,
                remaining
            );
            
            // Emit transfer event for payTo
            emit Transfer(contextKey, payTo, remaining);
            
            recipientCount += 1;
        }
        
        // Emit distributed transfer summary event
        emit DistributedTransfer(contextKey, amount, recipientCount);
        
        // Return distributed transfer details
        return abi.encode(recipientCount, amount);
    }
}

