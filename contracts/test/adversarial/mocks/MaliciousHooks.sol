// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ISettlementHook} from "../../../src/interfaces/ISettlementHook.sol";
import {ISettlementRouter} from "../../../src/interfaces/ISettlementRouter.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MaliciousReentrantHook
 * @notice Malicious hook that attempts reentrancy attack
 */
contract MaliciousReentrantHook is ISettlementHook {
    address public immutable settlementRouter;
    address public targetToken;
    address public targetPayer;
    uint256 public targetAmount;
    bytes32 public targetNonce;
    bytes32 public targetSalt;
    address public targetPayTo;
    bool public attacking;
    
    constructor(address _settlementRouter) {
        settlementRouter = _settlementRouter;
    }
    
    function setAttackParams(
        address _token,
        address _payer,
        uint256 _amount,
        bytes32 _nonce,
        bytes32 _salt,
        address _payTo
    ) external {
        targetToken = _token;
        targetPayer = _payer;
        targetAmount = _amount;
        targetNonce = _nonce;
        targetSalt = _salt;
        targetPayTo = _payTo;
    }
    
    function execute(
        bytes32 /* contextKey */,
        address /* payer */,
        address /* token */,
        uint256 /* amount */,
        bytes32 /* salt */,
        address payTo,
        address /* facilitator */,
        bytes calldata /* data */
    ) external returns (bytes memory) {
        // Attempt reentrancy attack
        if (!attacking && targetToken != address(0)) {
            attacking = true;
            
            // Try to call settleAndExecute again
            try ISettlementRouter(settlementRouter).settleAndExecute(
                targetToken,
                targetPayer,
                targetAmount,
                0,
                type(uint256).max,
                targetNonce,
                "",
                targetSalt,
                targetPayTo,
                0,
                address(this),
                ""
            ) {
                // Reentrancy succeeded (should not happen)
            } catch {
                // Expected to fail
            }
            
            attacking = false;
        }
        
        return abi.encode(payTo, 0);
    }
}

/**
 * @title MaliciousRevertingHook
 * @notice Hook that always reverts to DoS the settlement
 */
contract MaliciousRevertingHook is ISettlementHook {
    address public immutable settlementRouter;
    
    error MaliciousRevert();
    
    constructor(address _settlementRouter) {
        settlementRouter = _settlementRouter;
    }
    
    function execute(
        bytes32 /* contextKey */,
        address /* payer */,
        address /* token */,
        uint256 /* amount */,
        bytes32 /* salt */,
        address /* payTo */,
        address /* facilitator */,
        bytes calldata /* data */
    ) external pure returns (bytes memory) {
        revert MaliciousRevert();
    }
}

/**
 * @title MaliciousGasGuzzlerHook
 * @notice Hook that consumes excessive gas
 */
contract MaliciousGasGuzzlerHook is ISettlementHook {
    address public immutable settlementRouter;
    uint256 public wastefulStorage;
    
    constructor(address _settlementRouter) {
        settlementRouter = _settlementRouter;
    }
    
    function execute(
        bytes32 /* contextKey */,
        address /* payer */,
        address /* token */,
        uint256 /* amount */,
        bytes32 /* salt */,
        address payTo,
        address /* facilitator */,
        bytes calldata /* data */
    ) external returns (bytes memory) {
        // Consume excessive gas with wasteful operations
        for (uint256 i = 0; i < 10000; i++) {
            wastefulStorage = i;
        }
        
        return abi.encode(payTo, 0);
    }
}

/**
 * @title MaliciousStealingHook
 * @notice Hook that attempts to steal tokens
 */
contract MaliciousStealingHook is ISettlementHook {
    address public immutable settlementRouter;
    address public thief;
    
    constructor(address _settlementRouter, address _thief) {
        settlementRouter = _settlementRouter;
        thief = _thief;
    }
    
    function execute(
        bytes32 /* contextKey */,
        address /* payer */,
        address token,
        uint256 amount,
        bytes32 /* salt */,
        address /* payTo */,
        address /* facilitator */,
        bytes calldata /* data */
    ) external returns (bytes memory) {
        // Try to steal tokens by transferring them to thief
        // This should fail because hook doesn't have approval
        try IERC20(token).transferFrom(settlementRouter, thief, amount) {
            // Theft succeeded (should not happen if router is secure)
        } catch {
            // Expected to fail
        }
        
        return abi.encode(thief, amount);
    }
}

/**
 * @title MaliciousReturnDataHook
 * @notice Hook that returns invalid data
 */
contract MaliciousReturnDataHook is ISettlementHook {
    address public immutable settlementRouter;
    
    constructor(address _settlementRouter) {
        settlementRouter = _settlementRouter;
    }
    
    function execute(
        bytes32 /* contextKey */,
        address /* payer */,
        address /* token */,
        uint256 /* amount */,
        bytes32 /* salt */,
        address /* payTo */,
        address /* facilitator */,
        bytes calldata /* data */
    ) external pure returns (bytes memory) {
        // Return malformed data (not abi.encode(address, uint256))
        return hex"deadbeef";
    }
}

