// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {SettlementRouter} from "../src/SettlementRouter.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockSimpleHook} from "./mocks/MockHooks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title FeeOperatorTest
 * @notice Test fee operator authorization functionality
 */
contract FeeOperatorTest is Test {
    SettlementRouter public router;
    MockUSDC public token;
    MockUSDC public token2;
    MockSimpleHook public simpleHook;
    
    address public payer;
    address public merchant;
    address public facilitator1;
    address public facilitator2;
    address public operator;
    address public recipient;
    
    uint256 constant AMOUNT = 1000000; // 1 USDC (6 decimals)
    uint256 constant FEE = 10000; // 0.01 USDC
    uint256 constant VALID_AFTER = 0;
    uint256 constant VALID_BEFORE = type(uint256).max;
    
    event FeeOperatorSet(
        address indexed facilitator,
        address indexed operator,
        bool approved
    );
    
    event FeesClaimed(
        address indexed facilitator,
        address indexed token,
        uint256 amount
    );
    
    // Helper to accumulate fees for a facilitator
    function accumulateFees(address tokenAddr, address fac, uint256 fee, uint256 saltNum) internal {
        bytes32 salt = bytes32(saltNum);
        bytes memory signature = "mock_signature";
        bytes memory hookData = abi.encode(merchant);
        
        bytes32 nonce = router.calculateCommitment(
            tokenAddr,
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            merchant,
            fee,
            address(simpleHook),
            hookData
        );
        
        vm.prank(fac);
        router.settleAndExecute(
            tokenAddr,
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            merchant,
            fee,
            address(simpleHook),
            hookData
        );
    }
    
    function setUp() public {
        // Deploy contracts
        router = new SettlementRouter();
        token = new MockUSDC();
        token2 = new MockUSDC();
        simpleHook = new MockSimpleHook(address(router));
        
        // Setup accounts
        payer = makeAddr("payer");
        merchant = makeAddr("merchant");
        facilitator1 = makeAddr("facilitator1");
        facilitator2 = makeAddr("facilitator2");
        operator = makeAddr("operator");
        recipient = makeAddr("recipient");
        
        // Mint tokens to payer
        token.mint(payer, 100 * AMOUNT);
        token2.mint(payer, 100 * AMOUNT);
    }
    
    // ===== Authorization Tests =====
    
    function testSetFeeOperator() public {
        // Facilitator sets operator
        vm.expectEmit(true, true, false, true);
        emit FeeOperatorSet(facilitator1, operator, true);
        
        vm.prank(facilitator1);
        router.setFeeOperator(operator, true);
        
        // Verify operator is approved
        assertTrue(router.isFeeOperator(facilitator1, operator));
    }
    
    function testRevokeFeeOperator() public {
        // First approve
        vm.prank(facilitator1);
        router.setFeeOperator(operator, true);
        assertTrue(router.isFeeOperator(facilitator1, operator));
        
        // Then revoke
        vm.expectEmit(true, true, false, true);
        emit FeeOperatorSet(facilitator1, operator, false);
        
        vm.prank(facilitator1);
        router.setFeeOperator(operator, false);
        
        // Verify operator is no longer approved
        assertFalse(router.isFeeOperator(facilitator1, operator));
    }
    
    function testSetFeeOperatorRevertsZeroAddress() public {
        vm.prank(facilitator1);
        vm.expectRevert(abi.encodeWithSelector(SettlementRouter.InvalidOperator.selector));
        router.setFeeOperator(address(0), true);
    }
    
    function testMultipleOperators() public {
        address operator2 = makeAddr("operator2");
        address operator3 = makeAddr("operator3");
        
        // Approve multiple operators
        vm.startPrank(facilitator1);
        router.setFeeOperator(operator, true);
        router.setFeeOperator(operator2, true);
        router.setFeeOperator(operator3, true);
        vm.stopPrank();
        
        // Verify all are approved
        assertTrue(router.isFeeOperator(facilitator1, operator));
        assertTrue(router.isFeeOperator(facilitator1, operator2));
        assertTrue(router.isFeeOperator(facilitator1, operator3));
    }
    
    function testOperatorIsIndependentPerFacilitator() public {
        // facilitator1 approves operator
        vm.prank(facilitator1);
        router.setFeeOperator(operator, true);
        
        // operator is approved for facilitator1 but not facilitator2
        assertTrue(router.isFeeOperator(facilitator1, operator));
        assertFalse(router.isFeeOperator(facilitator2, operator));
    }
    
    // ===== ClaimFeesFor Tests =====
    
    function testFacilitatorCanClaimOwnFees() public {
        // Accumulate fees
        accumulateFees(address(token), facilitator1, FEE, 1);
        assertEq(router.getPendingFees(facilitator1, address(token)), FEE);
        
        // Facilitator claims own fees (no operator needed)
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        uint256 balanceBefore = token.balanceOf(facilitator1);
        
        vm.expectEmit(true, true, false, true);
        emit FeesClaimed(facilitator1, address(token), FEE);
        
        vm.prank(facilitator1);
        router.claimFeesFor(facilitator1, tokens, address(0)); // recipient = 0 means send to facilitator
        
        // Verify fees claimed
        assertEq(token.balanceOf(facilitator1), balanceBefore + FEE);
        assertEq(router.getPendingFees(facilitator1, address(token)), 0);
    }
    
    function testOperatorCanClaimFees() public {
        // Accumulate fees
        accumulateFees(address(token), facilitator1, FEE, 2);
        assertEq(router.getPendingFees(facilitator1, address(token)), FEE);
        
        // Approve operator
        vm.prank(facilitator1);
        router.setFeeOperator(operator, true);
        
        // Operator claims fees to facilitator
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        uint256 balanceBefore = token.balanceOf(facilitator1);
        
        vm.prank(operator);
        router.claimFeesFor(facilitator1, tokens, address(0));
        
        // Verify fees claimed to facilitator
        assertEq(token.balanceOf(facilitator1), balanceBefore + FEE);
        assertEq(router.getPendingFees(facilitator1, address(token)), 0);
    }
    
    function testOperatorCanClaimToCustomRecipient() public {
        // Accumulate fees
        accumulateFees(address(token), facilitator1, FEE, 3);
        
        // Approve operator
        vm.prank(facilitator1);
        router.setFeeOperator(operator, true);
        
        // Operator claims fees to custom recipient
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        uint256 balanceBefore = token.balanceOf(recipient);
        
        vm.prank(operator);
        router.claimFeesFor(facilitator1, tokens, recipient);
        
        // Verify fees claimed to recipient
        assertEq(token.balanceOf(recipient), balanceBefore + FEE);
        assertEq(router.getPendingFees(facilitator1, address(token)), 0);
    }
    
    function testUnauthorizedOperatorCannotClaim() public {
        // Accumulate fees
        accumulateFees(address(token), facilitator1, FEE, 4);
        
        // operator is NOT approved
        assertFalse(router.isFeeOperator(facilitator1, operator));
        
        // Operator tries to claim fees
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SettlementRouter.Unauthorized.selector));
        router.claimFeesFor(facilitator1, tokens, address(0));
    }
    
    function testRevokedOperatorCannotClaim() public {
        // Accumulate fees
        accumulateFees(address(token), facilitator1, FEE, 5);
        
        // Approve then revoke operator
        vm.startPrank(facilitator1);
        router.setFeeOperator(operator, true);
        router.setFeeOperator(operator, false); // revoke
        vm.stopPrank();
        
        // Operator tries to claim fees
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(SettlementRouter.Unauthorized.selector));
        router.claimFeesFor(facilitator1, tokens, address(0));
    }
    
    function testClaimFeesForMultipleTokens() public {
        // Accumulate fees for multiple tokens
        accumulateFees(address(token), facilitator1, FEE, 6);
        accumulateFees(address(token2), facilitator1, FEE, 7);
        
        // Approve operator
        vm.prank(facilitator1);
        router.setFeeOperator(operator, true);
        
        // Operator claims fees for both tokens
        address[] memory tokens = new address[](2);
        tokens[0] = address(token);
        tokens[1] = address(token2);
        
        uint256 balance1Before = token.balanceOf(recipient);
        uint256 balance2Before = token2.balanceOf(recipient);
        
        vm.prank(operator);
        router.claimFeesFor(facilitator1, tokens, recipient);
        
        // Verify both fees claimed
        assertEq(token.balanceOf(recipient), balance1Before + FEE);
        assertEq(token2.balanceOf(recipient), balance2Before + FEE);
        assertEq(router.getPendingFees(facilitator1, address(token)), 0);
        assertEq(router.getPendingFees(facilitator1, address(token2)), 0);
    }
    
    // ===== Batch Collection Scenario =====
    
    function testBatchCollectionToMainAddress() public {
        // Simulate facilitator with multiple addresses
        // Each accumulated fees independently
        accumulateFees(address(token), facilitator1, FEE, 10);
        accumulateFees(address(token), facilitator2, FEE, 11);
        
        address mainAddress = makeAddr("mainAddress");
        
        // Both facilitators approve mainAddress as operator
        vm.prank(facilitator1);
        router.setFeeOperator(mainAddress, true);
        
        vm.prank(facilitator2);
        router.setFeeOperator(mainAddress, true);
        
        // mainAddress collects fees from both
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        uint256 balanceBefore = token.balanceOf(mainAddress);
        
        vm.startPrank(mainAddress);
        router.claimFeesFor(facilitator1, tokens, mainAddress);
        router.claimFeesFor(facilitator2, tokens, mainAddress);
        vm.stopPrank();
        
        // Verify collected to mainAddress
        assertEq(token.balanceOf(mainAddress), balanceBefore + FEE * 2);
        assertEq(router.getPendingFees(facilitator1, address(token)), 0);
        assertEq(router.getPendingFees(facilitator2, address(token)), 0);
    }
    
    // ===== Governance Contract Scenario =====
    
    function testGovernanceContractCanManageFees() public {
        // Simulate a simple governance contract
        address governance = makeAddr("governance");
        address treasury = makeAddr("treasury");
        
        // Accumulate fees
        accumulateFees(address(token), facilitator1, FEE * 10, 20);
        
        // Facilitator delegates fee management to governance
        vm.prank(facilitator1);
        router.setFeeOperator(governance, true);
        
        // Governance can claim fees to treasury
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        uint256 balanceBefore = token.balanceOf(treasury);
        
        vm.prank(governance);
        router.claimFeesFor(facilitator1, tokens, treasury);
        
        // Verify fees sent to treasury
        assertEq(token.balanceOf(treasury), balanceBefore + FEE * 10);
    }
    
    // ===== Edge Cases =====
    
    function testClaimFeesForWithZeroRecipient() public {
        // When recipient is address(0), fees go to facilitator
        accumulateFees(address(token), facilitator1, FEE, 30);
        
        vm.prank(facilitator1);
        router.setFeeOperator(operator, true);
        
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        uint256 balanceBefore = token.balanceOf(facilitator1);
        
        // Operator claims with recipient = address(0)
        vm.prank(operator);
        router.claimFeesFor(facilitator1, tokens, address(0));
        
        // Fees go to facilitator
        assertEq(token.balanceOf(facilitator1), balanceBefore + FEE);
    }
    
    function testClaimFeesForWithNoFees() public {
        // No fees accumulated
        assertEq(router.getPendingFees(facilitator1, address(token)), 0);
        
        vm.prank(facilitator1);
        router.setFeeOperator(operator, true);
        
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        // Should not revert, just no transfer
        vm.prank(operator);
        router.claimFeesFor(facilitator1, tokens, recipient);
        
        // No change in balances
        assertEq(token.balanceOf(recipient), 0);
    }
    
    function testSelfOperatorApproval() public {
        // Facilitator can approve themselves as operator (redundant but valid)
        vm.prank(facilitator1);
        router.setFeeOperator(facilitator1, true);
        
        assertTrue(router.isFeeOperator(facilitator1, facilitator1));
        
        // Can claim via claimFeesFor even though it's redundant
        accumulateFees(address(token), facilitator1, FEE, 40);
        
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        vm.prank(facilitator1);
        router.claimFeesFor(facilitator1, tokens, address(0));
        
        assertEq(router.getPendingFees(facilitator1, address(token)), 0);
    }
    
    // ===== Backwards Compatibility =====
    
    function testOriginalClaimFeesStillWorks() public {
        // Original claimFees function should still work
        accumulateFees(address(token), facilitator1, FEE, 50);
        
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        uint256 balanceBefore = token.balanceOf(facilitator1);
        
        // Use original claimFees function
        vm.prank(facilitator1);
        router.claimFees(tokens);
        
        // Verify it works
        assertEq(token.balanceOf(facilitator1), balanceBefore + FEE);
        assertEq(router.getPendingFees(facilitator1, address(token)), 0);
    }
    
    function testMixedUsageOfClaimFunctions() public {
        // Can use both claimFees and claimFeesFor interchangeably
        accumulateFees(address(token), facilitator1, FEE, 51);
        accumulateFees(address(token2), facilitator1, FEE, 52);
        
        address[] memory tokens1 = new address[](1);
        tokens1[0] = address(token);
        
        address[] memory tokens2 = new address[](1);
        tokens2[0] = address(token2);
        
        // Use claimFees for token1
        vm.prank(facilitator1);
        router.claimFees(tokens1);
        
        // Use claimFeesFor for token2
        vm.prank(facilitator1);
        router.claimFeesFor(facilitator1, tokens2, address(0));
        
        // Both work
        assertEq(router.getPendingFees(facilitator1, address(token)), 0);
        assertEq(router.getPendingFees(facilitator1, address(token2)), 0);
    }
}

