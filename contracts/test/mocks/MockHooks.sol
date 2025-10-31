// SPDX-License-Identifier: Apache-2.0
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
    
    address public immutable settlementRouter;
    bool public shouldFail;
    
    constructor(address _settlementHub) {
        settlementRouter = _settlementHub;
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
        require(msg.sender == settlementRouter, "Only settlement hub");
        
        if (shouldFail) {
            revert("Mock hook failure");
        }
        
        // Success case: transfer funds back to payer
        IERC20(token).safeTransferFrom(settlementRouter, payer, amount);
        
        return abi.encode("success");
    }
}

/**
 * @title MockSimpleHook
 * @notice Simple test Hook that transfers funds to specified recipient
 * @dev Also stores last call parameters for verification in tests
 */
contract MockSimpleHook is ISettlementHook {
    using SafeERC20 for IERC20;
    
    address public immutable settlementRouter;
    
    // Store last call parameters for test verification
    bytes32 public lastContextKey;
    address public lastPayer;
    address public lastToken;
    uint256 public lastAmount;
    bytes32 public lastSalt;
    address public lastPayTo;
    address public lastFacilitator;
    bytes public lastData;
    
    constructor(address _settlementHub) {
        settlementRouter = _settlementHub;
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
        require(msg.sender == settlementRouter, "Only settlement hub");
        
        // Store parameters for test verification
        lastContextKey = contextKey;
        lastPayer = payer;
        lastToken = token;
        lastAmount = amount;
        lastSalt = salt;
        lastPayTo = payTo;
        lastFacilitator = facilitator;
        lastData = data;
        
        // Decode recipient address
        address recipient = abi.decode(data, (address));
        
        // Transfer to recipient
        IERC20(token).safeTransferFrom(settlementRouter, recipient, amount);
        
        return abi.encode(recipient, amount);
    }
}
