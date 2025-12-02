// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISettlementHook} from "contracts/src/interfaces/ISettlementHook.sol";

/**
 * @title MockSettlementRouter
 * @notice Mock router for testing hooks directly
 * @dev Simplifies testing by allowing direct hook execution
 */
contract MockSettlementRouter {
    using SafeERC20 for IERC20;
    
    function executeHook(
        address hook,
        address token,
        address payer,
        uint256 amount,
        address payTo,
        bytes calldata hookData
    ) external {
        // Transfer tokens from caller to this contract (router)
        // The hook expects to transfer tokens FROM the router address
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // The hook will call safeTransferFrom(settlementRouter, payTo, amount)
        // So we need to approve the hook to transfer from this contract (router)
        // But actually, the hook uses safeTransferFrom which requires approval
        // However, since we're the router and we're calling the hook,
        // we need to ensure the hook can transfer from us
        
        // Actually, looking at the hook code, it does:
        // IERC20(token).safeTransferFrom(settlementRouter, payTo, amount)
        // This means the hook needs approval from router (this contract) to payTo
        // But wait, safeTransferFrom(from, to, amount) transfers FROM 'from' TO 'to'
        // So we need to approve hook to transfer from this contract
        
        // Approve hook to transfer tokens from this contract (router) to payTo
        IERC20(token).approve(hook, amount);
        
        // Execute hook
        // Hook will: safeTransferFrom(address(this), payTo, amount)
        bytes32 contextKey = keccak256("test-context");
        ISettlementHook(hook).execute(
            contextKey,
            payer,
            token,
            amount,
            keccak256("salt"),
            payTo,
            msg.sender,
            hookData
        );
        
        // Clean up any remaining allowance
        IERC20(token).approve(hook, 0);
    }
}

