// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ISettlementRouter} from "./interfaces/ISettlementRouter.sol";
import {ISettlementHook} from "./interfaces/ISettlementHook.sol";
import {IERC3009} from "./interfaces/IERC3009.sol";

/**
 * @title SettlementRouter
 * @notice x402 Extended Settlement Router - Implements atomic payment verification and business execution
 * @dev Core design:
 *   1. Single contract call completes all operations (no Multicall3 needed)
 *   2. Minimal protocol layer (only 3 extra fields)
 *   3. All business logic extended through Hooks
 *   4. No fund holding (instant transfer)
 * 
 * @custom:security-contact security@x402settlement.org
 */
contract SettlementRouter is ISettlementRouter, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // ===== State Variables =====
    
    /// @notice Settlement marker (idempotency guarantee)
    /// @dev contextKey => whether settled
    mapping(bytes32 => bool) public settled;
    
    /// @notice Pending facilitator fees
    /// @dev facilitator => token => amount
    mapping(address => mapping(address => uint256)) public pendingFees;
    
    /// @notice Operator approval for fee claims
    /// @dev facilitator => operator => approved
    mapping(address => mapping(address => bool)) public feeOperators;
    
    // ===== Error Definitions =====
    
    error AlreadySettled(bytes32 contextKey);
    error InvalidCommitment(bytes32 expected, bytes32 actual);
    error TransferFailed(address token, uint256 expected, uint256 actual);
    error RouterShouldNotHoldFunds(address token, uint256 balance);
    error HookExecutionFailed(address hook, bytes reason);
    error InvalidOperator();
    error Unauthorized();
    error InsufficientBalanceForRecovery(address token, uint256 required, uint256 available);
    
    // ===== Core Functions =====
    
    /**
     * @inheritdoc ISettlementRouter
     * @dev Execution flow:
     *   1. Calculate commitment hash from all parameters
     *   2. Verify nonce equals commitment (prevents parameter tampering)
     *   3. Calculate contextKey (idempotency identifier)
     *   4. Check idempotency (prevent duplicate settlement)
     *   5. Mark as settled (CEI pattern)
     *   6. Record balance before transfer
     *   7. Call token.transferWithAuthorization (funds enter Router)
     *   8. Verify balance increment (ensure transfer success)
     *   9. Accumulate facilitator fee
     *  10. Approve and call Hook (execute business logic with net amount)
     *  11. Verify balance returns to pre-transfer level (ensure no fund holding)
     *  12. Emit events
     */
    function settleAndExecute(
        address token,
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature,
        bytes32 salt,
        address payTo,
        uint256 facilitatorFee,
        address hook,
        bytes calldata hookData
    ) external nonReentrant {
        // 1. Calculate commitment hash from all parameters
        bytes32 commitment = keccak256(abi.encodePacked(
            "X402/settle/v1",
            block.chainid,
            address(this),  // Router address (cross-router replay protection)
            token,
            from,
            value,
            validAfter,
            validBefore,
            salt,
            payTo,
            facilitatorFee,
            hook,
            keccak256(hookData)
        ));
        
        // 2. Verify nonce equals commitment (prevents parameter tampering)
        if (nonce != commitment) {
            revert InvalidCommitment(commitment, nonce);
        }
        
        // 3. Calculate contextKey (idempotency identifier)
        bytes32 contextKey = calculateContextKey(from, token, nonce);
        
        // 4. Idempotency check (prevent duplicate settlement)
        if (settled[contextKey]) {
            revert AlreadySettled(contextKey);
        }
        
        // 5. Mark as settled (CEI pattern: modify state first)
        settled[contextKey] = true;
        
        // 6. Record balance before transfer (to handle direct transfers to Router)
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        
        // 7. Check if nonce is already used in token contract (recovery detection)
        bool nonceAlreadyUsed = IERC3009(token).authorizationState(from, nonce);
        
        if (!nonceAlreadyUsed) {
            // 7a. Normal flow: Call token.transferWithAuthorization
            // Note: signature verification and nonce check are done by token contract
            IERC3009(token).transferWithAuthorization(
                from,
                address(this),  // Funds enter Router first
                value,
                validAfter,
                validBefore,
                nonce,
                signature
            );
            
            // 8. Verify balance increment (ensure transfer success)
            uint256 balanceAfter = IERC20(token).balanceOf(address(this));
            uint256 received = balanceAfter - balanceBefore;
            if (received < value) {
                revert TransferFailed(token, value, received);
            }
        } else {
            // 7b. Recovery flow: nonce already used, funds should be in Router
            // Verify Router has sufficient balance to process this transaction
            // Note: balanceBefore may include these funds plus other funds
            if (balanceBefore < value) {
                revert InsufficientBalanceForRecovery(token, value, balanceBefore);
            }
            // Note: Don't update balanceAfter, funds are already here
        }
        
        // 9. Accumulate facilitator fee
        if (facilitatorFee > 0) {
            pendingFees[msg.sender][token] += facilitatorFee;
            emit FeeAccumulated(msg.sender, token, facilitatorFee);
        }
        
        // 10. Call Hook (if any) with net amount after fee deduction
        uint256 hookAmount = value - facilitatorFee;
        address facilitator = msg.sender;  // Facilitator is the transaction sender
        if (hook != address(0)) {
            // Approve Hook to use funds (net amount after fee)
            IERC20(token).forceApprove(hook, hookAmount);
            
            // Execute Hook with all parameters including facilitator
            bytes memory result;
            try ISettlementHook(hook).execute(
                contextKey,
                from,
                token,
                hookAmount,
                salt,
                payTo,
                facilitator,
                hookData
            ) returns (bytes memory _result) {
                result = _result;
                emit HookExecuted(contextKey, hook, result);
            } catch (bytes memory reason) {
                revert HookExecutionFailed(hook, reason);
            }
        }
        
        // 11. Ensure Router only holds accumulated fees (balance should be pre-transfer + fees)
        // This allows the Router to work even if someone directly transfers tokens to it
        uint256 balanceFinal = IERC20(token).balanceOf(address(this));
        uint256 expectedBalance;
        if (!nonceAlreadyUsed) {
            // Normal mode: balanceFinal = balanceBefore + facilitatorFee
            expectedBalance = balanceBefore + facilitatorFee;
        } else {
            // Recovery mode (no incoming transfer): balanceFinal = balanceBefore - hookAmount
            //                                                     = balanceBefore - (value - facilitatorFee)
            //                                                     = balanceBefore - value + facilitatorFee
            expectedBalance = balanceBefore - value + facilitatorFee;
        }
        
        if (balanceFinal != expectedBalance) {
            revert RouterShouldNotHoldFunds(token, balanceFinal > expectedBalance ? balanceFinal - expectedBalance : expectedBalance - balanceFinal);
        }
        
        // 12. Emit events
        emit Settled(contextKey, from, token, value, hook, salt, payTo, facilitatorFee);
    }
    
    // ===== Query Methods =====
    
    /**
     * @inheritdoc ISettlementRouter
     */
    function isSettled(bytes32 contextKey) external view returns (bool) {
        return settled[contextKey];
    }
    
    /**
     * @inheritdoc ISettlementRouter
     */
    function calculateContextKey(
        address from,
        address token,
        bytes32 nonce
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(from, token, nonce));
    }
    
    // ===== Facilitator Fee Methods =====
    
    /**
     * @inheritdoc ISettlementRouter
     */
    function getPendingFees(address facilitator, address token) external view returns (uint256) {
        return pendingFees[facilitator][token];
    }
    
    /**
     * @inheritdoc ISettlementRouter
     */
    function claimFees(address[] calldata tokens) external nonReentrant {
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 amount = pendingFees[msg.sender][token];
            if (amount > 0) {
                // Clear pending fees first (CEI pattern)
                pendingFees[msg.sender][token] = 0;
                
                // Transfer fees to facilitator
                IERC20(token).safeTransfer(msg.sender, amount);
                
                // Emit event
                emit FeesClaimed(msg.sender, token, amount);
            }
        }
    }
    
    // ===== Fee Operator Methods =====
    
    /**
     * @inheritdoc ISettlementRouter
     */
    function setFeeOperator(address operator, bool approved) external {
        if (operator == address(0)) {
            revert InvalidOperator();
        }
        feeOperators[msg.sender][operator] = approved;
        emit FeeOperatorSet(msg.sender, operator, approved);
    }
    
    /**
     * @inheritdoc ISettlementRouter
     */
    function isFeeOperator(address facilitator, address operator) external view returns (bool) {
        return feeOperators[facilitator][operator];
    }
    
    /**
     * @inheritdoc ISettlementRouter
     */
    function claimFeesFor(
        address facilitator,
        address[] calldata tokens,
        address recipient
    ) external nonReentrant {
        // Check authorization: must be facilitator or approved operator
        if (msg.sender != facilitator && !feeOperators[facilitator][msg.sender]) {
            revert Unauthorized();
        }
        
        // Default recipient is facilitator
        address to = recipient == address(0) ? facilitator : recipient;
        
        // Claim logic (same as before)
        for (uint256 i = 0; i < tokens.length; i++) {
            address token = tokens[i];
            uint256 amount = pendingFees[facilitator][token];
            if (amount > 0) {
                // Clear pending fees first (CEI pattern)
                pendingFees[facilitator][token] = 0;
                
                // Transfer fees to recipient
                IERC20(token).safeTransfer(to, amount);
                
                // Emit event
                emit FeesClaimed(facilitator, token, amount);
            }
        }
    }
}

