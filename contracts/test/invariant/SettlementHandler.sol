// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SettlementRouter} from "../../src/SettlementRouter.sol";
import {TransferHook} from "../../src/hooks/TransferHook.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SettlementHandler
 * @notice Handler contract for invariant testing
 * @dev Generates random but valid sequences of settlement operations
 */
contract SettlementHandler is Test {
    SettlementRouter public router;
    TransferHook public hook;
    MockUSDC public token;
    
    // Actors
    address[] public payers;
    address[] public merchants;
    address[] public facilitators;
    
    // Track state
    uint256 public settlementCount;
    uint256 public feeClaimCount;
    uint256 public operatorSetCount;
    
    // Ghost variables for invariant checking
    uint256 public ghost_totalFeesAccumulated;
    uint256 public ghost_totalFeesClaimed;
    uint256 public ghost_totalTokensSettled;
    uint256 public ghost_totalTokensMinted; // Track tokens minted to payers
    mapping(address => uint256) public ghost_payerBalanceDecrease;
    mapping(address => uint256) public ghost_merchantBalanceIncrease;
    
    constructor(
        SettlementRouter _router,
        TransferHook _hook,
        MockUSDC _token,
        address[] memory _payers,
        address[] memory _merchants,
        address[] memory _facilitators
    ) {
        router = _router;
        hook = _hook;
        token = _token;
        payers = _payers;
        merchants = _merchants;
        facilitators = _facilitators;
    }
    
    // ===== Settlement Actions =====
    
    /// @notice Perform a settlement with random parameters
    function settleWithFee(uint256 payerSeed, uint256 merchantSeed, uint256 facilitatorSeed, uint256 amount, uint256 feeSeed) public {
        // Bound inputs
        amount = bound(amount, 1000, 10_000_000);
        address payer = payers[payerSeed % payers.length];
        address merchant = merchants[merchantSeed % merchants.length];
        address facilitator = facilitators[facilitatorSeed % facilitators.length];
        uint256 fee = bound(feeSeed, 0, amount / 10); // Max 10% fee
        
        // Ensure payer has tokens
        uint256 payerBalance = token.balanceOf(payer);
        if (payerBalance < amount) {
            uint256 mintAmount = amount - payerBalance + 1_000_000;
            vm.prank(address(this));
            token.mint(payer, mintAmount);
            ghost_totalTokensMinted += mintAmount; // Track minted tokens
        }
        
        // Ensure payer has approved router
        vm.prank(payer);
        if (token.allowance(payer, address(router)) < amount) {
            token.approve(address(router), type(uint256).max);
        }
        
        // Generate unique nonce
        bytes32 salt = keccak256(abi.encodePacked(settlementCount++, block.timestamp));
        bytes32 nonce = _calculateCommitment(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            salt,
            merchant,
            fee,
            address(hook),
            ""
        );
        
        // Record balances before
        uint256 payerBalanceBefore = token.balanceOf(payer);
        uint256 merchantBalanceBefore = token.balanceOf(merchant);
        
        // Perform settlement
        vm.prank(facilitator);
        try router.settleAndExecute(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            fee,
            address(hook),
            ""
        ) {
            // Update ghost variables
            ghost_totalFeesAccumulated += fee;
            ghost_totalTokensSettled += amount;
            ghost_payerBalanceDecrease[payer] += (payerBalanceBefore - token.balanceOf(payer));
            ghost_merchantBalanceIncrease[merchant] += (token.balanceOf(merchant) - merchantBalanceBefore);
        } catch {
            // Settlement failed, this is OK
        }
    }
    
    /// @notice Settle without fee
    function settleWithoutFee(uint256 payerSeed, uint256 merchantSeed, uint256 facilitatorSeed, uint256 amount) public {
        settleWithFee(payerSeed, merchantSeed, facilitatorSeed, amount, 0);
    }
    
    // ===== Fee Operations =====
    
    /// @notice Claim fees for a facilitator
    function claimFees(uint256 facilitatorSeed) public {
        address facilitator = facilitators[facilitatorSeed % facilitators.length];
        
        uint256 pendingFees = router.getPendingFees(facilitator, address(token));
        if (pendingFees == 0) return;
        
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        vm.prank(facilitator);
        try router.claimFees(tokens) {
            ghost_totalFeesClaimed += pendingFees;
            feeClaimCount++;
        } catch {
            // Claim failed, this is OK
        }
    }
    
    /// @notice Set fee operator
    function setFeeOperator(uint256 facilitatorSeed, uint256 operatorSeed, bool approved) public {
        address facilitator = facilitators[facilitatorSeed % facilitators.length];
        address operator = facilitators[operatorSeed % facilitators.length];
        
        // Avoid self-authorization for more interesting tests
        if (facilitator == operator) return;
        
        vm.prank(facilitator);
        try router.setFeeOperator(operator, approved) {
            operatorSetCount++;
        } catch {
            // Failed, this is OK
        }
    }
    
    /// @notice Claim fees via operator
    function claimFeesViaOperator(uint256 facilitatorSeed, uint256 operatorSeed) public {
        address facilitator = facilitators[facilitatorSeed % facilitators.length];
        address operator = facilitators[operatorSeed % facilitators.length];
        
        if (!router.isFeeOperator(facilitator, operator)) return;
        
        uint256 pendingFees = router.getPendingFees(facilitator, address(token));
        if (pendingFees == 0) return;
        
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        vm.prank(operator);
        try router.claimFeesFor(facilitator, tokens, address(0)) {
            ghost_totalFeesClaimed += pendingFees;
            feeClaimCount++;
        } catch {
            // Failed, this is OK
        }
    }
    
    // ===== Helper Functions =====
    
    function _calculateCommitment(
        address tokenAddr,
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 salt,
        address payTo,
        uint256 facilitatorFee,
        address hookAddr,
        bytes memory hookData
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(
            "X402/settle/v1",
            block.chainid,
            address(router),
            tokenAddr,
            from,
            value,
            validAfter,
            validBefore,
            salt,
            payTo,
            facilitatorFee,
            hookAddr,
            keccak256(hookData)
        ));
    }
    
    // ===== View Functions for Testing =====
    
    function getTotalPendingFees() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < facilitators.length; i++) {
            total += router.getPendingFees(facilitators[i], address(token));
        }
        return total;
    }
    
    function getRouterTokenBalance() public view returns (uint256) {
        return token.balanceOf(address(router));
    }
}

