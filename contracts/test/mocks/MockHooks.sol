// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ISettlementHook} from "../../src/interfaces/ISettlementHook.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title MockFailingHook
 * @notice Mock contract for testing Hook failure scenarios
 */
contract MockFailingHook is ISettlementHook {
    using SafeERC20 for IERC20;
    
    address public immutable settlementHub;
    bool public shouldFail;
    
    constructor(address _settlementHub) {
        settlementHub = _settlementHub;
        shouldFail = true;
    }
    
    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }
    
    function execute(
        bytes32 contextKey,
        address payer,
        address token,
        uint256 amount,
        bytes32 salt,
        address payTo,
        address facilitator,
        bytes calldata data
    ) external override returns (bytes memory) {
        require(msg.sender == settlementHub, "Only settlement hub");
        
        if (shouldFail) {
            revert("Mock hook failure");
        }
        
        // Success case: transfer funds back to payer
        IERC20(token).safeTransferFrom(settlementHub, payer, amount);
        
        return abi.encode("success");
    }
}

/**
 * @title MockSimpleHook
 * @notice Simple test Hook that transfers funds to specified recipient
 */
contract MockSimpleHook is ISettlementHook {
    using SafeERC20 for IERC20;
    
    address public immutable settlementHub;
    
    constructor(address _settlementHub) {
        settlementHub = _settlementHub;
    }
    
    function execute(
        bytes32 contextKey,
        address payer,
        address token,
        uint256 amount,
        bytes32 salt,
        address payTo,
        address facilitator,
        bytes calldata data
    ) external override returns (bytes memory) {
        require(msg.sender == settlementHub, "Only settlement hub");
        
        // Decode recipient address
        address recipient = abi.decode(data, (address));
        
        // Transfer to recipient
        IERC20(token).safeTransferFrom(settlementHub, recipient, amount);
        
        return abi.encode(recipient, amount);
    }
}
