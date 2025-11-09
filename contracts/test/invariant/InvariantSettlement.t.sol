// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {SettlementRouter} from "../../src/SettlementRouter.sol";
import {TransferHook} from "../../src/hooks/TransferHook.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {SettlementHandler} from "./SettlementHandler.sol";

/**
 * @title InvariantSettlementTest
 * @notice Invariant tests for SettlementRouter
 * @dev Tests properties that must always hold true
 */
contract InvariantSettlementTest is StdInvariant, Test {
    SettlementRouter public router;
    TransferHook public hook;
    MockUSDC public token;
    SettlementHandler public handler;
    
    address[] public payers;
    address[] public merchants;
    address[] public facilitators;
    
    uint256 constant INITIAL_BALANCE = 100_000_000;
    
    function setUp() public {
        // Deploy contracts
        router = new SettlementRouter();
        hook = new TransferHook(address(router));
        token = new MockUSDC();
        
        // Create actors
        for (uint256 i = 0; i < 3; i++) {
            address payer = makeAddr(string(abi.encodePacked("payer", i)));
            address merchant = makeAddr(string(abi.encodePacked("merchant", i)));
            address facilitator = makeAddr(string(abi.encodePacked("facilitator", i)));
            
            payers.push(payer);
            merchants.push(merchant);
            facilitators.push(facilitator);
            
            // Mint initial tokens to payers
            token.mint(payer, INITIAL_BALANCE);
            
            // Approve router
            vm.prank(payer);
            token.approve(address(router), type(uint256).max);
        }
        
        // Deploy handler
        handler = new SettlementHandler(
            router,
            hook,
            token,
            payers,
            merchants,
            facilitators
        );
        
        // Give handler minting rights for topping up balances
        // (In real scenario, this simulates external token sources)
        
        // Set handler as target for invariant testing
        targetContract(address(handler));
        
        // Select specific functions to call
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = SettlementHandler.settleWithFee.selector;
        selectors[1] = SettlementHandler.settleWithoutFee.selector;
        selectors[2] = SettlementHandler.claimFees.selector;
        selectors[3] = SettlementHandler.setFeeOperator.selector;
        selectors[4] = SettlementHandler.claimFeesViaOperator.selector;
        
        targetSelector(FuzzSelector({
            addr: address(handler),
            selectors: selectors
        }));
    }
    
    // ===== Core Invariants =====
    
    /// @notice Invariant 1: Router should only hold pending fees
    /// @dev Router balance = sum of all pending fees
    function invariant_RouterOnlyHoldsPendingFees() public view {
        uint256 routerBalance = token.balanceOf(address(router));
        uint256 totalPendingFees = handler.getTotalPendingFees();
        
        assertEq(
            routerBalance,
            totalPendingFees,
            "Router should only hold pending fees"
        );
    }
    
    /// @notice Invariant 2: Total fees accumulated = Total fees claimed + Pending fees
    /// @dev Conservation of fees
    function invariant_FeeConservation() public view {
        uint256 totalAccumulated = handler.ghost_totalFeesAccumulated();
        uint256 totalClaimed = handler.ghost_totalFeesClaimed();
        uint256 totalPending = handler.getTotalPendingFees();
        
        assertEq(
            totalAccumulated,
            totalClaimed + totalPending,
            "Fees must be conserved"
        );
    }
    
    /// @notice Invariant 3: Token conservation
    /// @dev Total tokens settled = sum of merchant increases + all fees
    function invariant_TokenConservation() public view {
        uint256 totalSettled = handler.ghost_totalTokensSettled();
        
        // Calculate total merchant increases
        uint256 totalMerchantIncrease = 0;
        for (uint256 i = 0; i < merchants.length; i++) {
            totalMerchantIncrease += handler.ghost_merchantBalanceIncrease(merchants[i]);
        }
        
        uint256 totalPendingFees = handler.getTotalPendingFees();
        uint256 totalFeesClaimed = handler.ghost_totalFeesClaimed();
        
        // Total settled = merchant increases + all fees
        assertApproxEqAbs(
            totalSettled,
            totalMerchantIncrease + totalPendingFees + totalFeesClaimed,
            100, // Allow small rounding
            "Tokens must be conserved"
        );
    }
    
    /// @notice Invariant 4: Each facilitator's pending fees matches router state
    /// @dev Verify consistency between router's pendingFees mapping and actual state
    function invariant_PendingFeesConsistency() public view {
        // Check that pending fees are consistent with what we expect
        for (uint256 i = 0; i < facilitators.length; i++) {
            uint256 pendingFees = router.getPendingFees(facilitators[i], address(token));
            
            // Pending fees should never exceed the router's total balance
            assertLe(
                pendingFees,
                token.balanceOf(address(router)),
                "Individual pending fees cannot exceed router balance"
            );
        }
    }
    
    /// @notice Invariant 5: Total supply conservation across the system
    /// @dev Sum of all balances should equal initial supply + minted tokens
    function invariant_TotalSupplyConservation() public view {
        uint256 totalInitialSupply = INITIAL_BALANCE * payers.length;
        
        // Sum all payer balances
        uint256 totalPayerBalance = 0;
        for (uint256 i = 0; i < payers.length; i++) {
            totalPayerBalance += token.balanceOf(payers[i]);
        }
        
        // Sum all merchant balances
        uint256 totalMerchantBalance = 0;
        for (uint256 i = 0; i < merchants.length; i++) {
            totalMerchantBalance += token.balanceOf(merchants[i]);
        }
        
        // Sum all facilitator balances (from claimed fees)
        uint256 totalFacilitatorBalance = 0;
        for (uint256 i = 0; i < facilitators.length; i++) {
            totalFacilitatorBalance += token.balanceOf(facilitators[i]);
        }
        
        // Router balance (pending fees)
        uint256 routerBalance = token.balanceOf(address(router));
        
        // Total should equal initial supply + minted tokens
        uint256 totalBalance = totalPayerBalance + totalMerchantBalance + 
                              totalFacilitatorBalance + routerBalance;
        uint256 expectedBalance = totalInitialSupply + handler.ghost_totalTokensMinted();
        
        assertEq(
            totalBalance,
            expectedBalance,
            "Total supply must be conserved (initial + minted)"
        );
    }
    
    // ===== Test Configuration =====
    
    /// @notice Configure invariant test runs
    function invariant_callSummary() public view {
        console.log("=== Invariant Test Summary ===");
        console.log("Settlement count:", handler.settlementCount());
        console.log("Fee claim count:", handler.feeClaimCount());
        console.log("Operator set count:", handler.operatorSetCount());
        console.log("Total fees accumulated:", handler.ghost_totalFeesAccumulated());
        console.log("Total fees claimed:", handler.ghost_totalFeesClaimed());
        console.log("Total tokens settled:", handler.ghost_totalTokensSettled());
        console.log("Router balance:", token.balanceOf(address(router)));
        console.log("Total pending fees:", handler.getTotalPendingFees());
    }
}

