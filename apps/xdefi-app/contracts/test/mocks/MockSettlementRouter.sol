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
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Approve the hook to transfer tokens from this contract, as the hook will call
        // safeTransferFrom(address(this), payTo, amount) to move tokens to the recipient.
        IERC20(token).approve(hook, amount);

        // Execute hook
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

