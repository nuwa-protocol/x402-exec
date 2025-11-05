// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ISettlementHook} from "../interfaces/ISettlementHook.sol";

/**
 * @title TransferHook
 * @notice Built-in Hook for simple token transfers with facilitator fee support
 * @dev This is the protocol's default Hook that replaces direct ERC-3009 transfers
 *      while enabling facilitator fee mechanism through SettlementRouter.
 * 
 * Features:
 *   - Simplest possible transfer logic
 *   - No hookData required (payTo address is passed as parameter)
 *   - Universal deployment (one instance for all projects)
 *   - Minimal gas overhead compared to direct transfers
 * 
 * Use cases:
 *   - Simple payments with facilitator fee support
 *   - Replacing direct ERC-3009 transferWithAuthorization calls
 *   - Any scenario not requiring custom business logic
 * 
 * @custom:security-contact security@x402settlement.org
 */
contract TransferHook is ISettlementHook {
    using SafeERC20 for IERC20;
    
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
    
    // ===== Error Definitions =====
    
    error OnlyRouter();
    error InvalidRouterAddress();
    
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
     * @dev Executes a simple transfer to the payTo address
     * 
     * Parameters:
     *   - contextKey: Unique settlement identifier
     *   - payer: Address that signed the payment authorization
     *   - token: Token contract address
     *   - amount: Amount to transfer (already deducted facilitator fee)
     *   - salt: Unique identifier from Resource Server
     *   - payTo: Final recipient address
     *   - facilitator: Address of the facilitator
     *   - data: Optional data (not used, can be empty)
     * 
     * The function simply transfers the entire amount to payTo address.
     * No hookData is required since payTo is already a parameter.
     * 
     * @return Encoded tuple of (recipient, amount)
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
        // Note: data parameter is intentionally unused
        // All necessary information is in the function parameters
        // This allows for optional metadata without affecting core logic
        
        // Transfer entire amount to payTo address
        IERC20(token).safeTransferFrom(settlementRouter, payTo, amount);
        
        // Emit transfer event for transparency
        emit Transfer(contextKey, payTo, amount);
        
        // Return transfer details
        return abi.encode(payTo, amount);
    }
}

