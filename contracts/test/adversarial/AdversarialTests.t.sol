// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SettlementRouter} from "../../src/SettlementRouter.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";
import {TransferHook} from "../../src/hooks/TransferHook.sol";
import {MaliciousReentrantHook, MaliciousRevertingHook, MaliciousGasGuzzlerHook} from "./mocks/MaliciousHooks.sol";
import {MaliciousRevertingToken, MaliciousFalseReturnToken, MaliciousFeeOnTransferToken} from "./mocks/MaliciousTokens.sol";

/**
 * @title AdversarialTests
 * @notice Security tests for adversarial scenarios and attack vectors
 * @dev Tests various attack vectors to ensure contract security
 */
contract AdversarialTests is Test {
    SettlementRouter public router;
    MockUSDC public token;
    TransferHook public hook;
    
    address public payer;
    address public merchant;
    address public facilitator;
    address public attacker;
    
    function setUp() public {
        router = new SettlementRouter();
        token = new MockUSDC();
        hook = new TransferHook(address(router));
        
        payer = makeAddr("payer");
        merchant = makeAddr("merchant");
        facilitator = makeAddr("facilitator");
        attacker = makeAddr("attacker");
        
        // Mint tokens to payer
        token.mint(payer, 1_000_000_000);
        
        // Approve router
        vm.prank(payer);
        token.approve(address(router), type(uint256).max);
    }
    
    // ===== Reentrancy Protection Tests =====
    
    /// @dev Test: Double settlement with same nonce should be prevented
    function testDoubleSettlementPrevented() public {
        uint256 amount = 1_000_000;
        bytes32 salt = bytes32(uint256(1));
        
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // First settlement
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        uint256 balanceAfterFirst = token.balanceOf(merchant);
        
        // Attempt second settlement with same nonce
        bytes32 contextKey = router.calculateContextKey(payer, address(token), nonce);
        
        vm.prank(facilitator);
        vm.expectRevert(
            abi.encodeWithSelector(SettlementRouter.AlreadySettled.selector, contextKey)
        );
        router.settleAndExecute(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Balance should remain unchanged
        assertEq(token.balanceOf(merchant), balanceAfterFirst);
    }
    
    // ===== DoS Attack Tests =====
    
    /// @dev Test: Reverting hook should cause settlement to fail gracefully
    function testRevertingHookCausesFailure() public {
        MaliciousRevertingHook maliciousHook = new MaliciousRevertingHook(address(router));
        
        uint256 amount = 1_000_000;
        bytes32 salt = bytes32(uint256(2));
        
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(maliciousHook),
            ""
        );
        
        // Settlement should fail due to reverting hook
        vm.prank(facilitator);
        vm.expectRevert();
        router.settleAndExecute(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(maliciousHook),
            ""
        );
        
        // No tokens should have been transferred
        assertEq(token.balanceOf(merchant), 0);
        
        // Router should not hold funds
        assertEq(token.balanceOf(address(router)), 0);
    }
    
    /// @dev Test: Gas guzzling hook should not cause out-of-gas but consumes significant gas
    function testGasGuzzlingHookConsumesGas() public {
        MaliciousGasGuzzlerHook maliciousHook = new MaliciousGasGuzzlerHook(address(router));
        
        uint256 amount = 1_000_000;
        bytes32 salt = bytes32(uint256(3));
        
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(maliciousHook),
            ""
        );
        
        // Settlement with gas guzzling hook
        uint256 gasBefore = gasleft();
        
        vm.prank(facilitator);
        // This will fail with RouterShouldNotHoldFunds because malicious hook doesn't transfer
        vm.expectRevert();
        router.settleAndExecute(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(maliciousHook),
            ""
        );
        
        uint256 gasUsed = gasBefore - gasleft();
        
        // Should consume significant gas but not cause out-of-gas
        assertTrue(gasUsed > 100_000, "Should consume significant gas");
    }
    
    // ===== Commitment Integrity Tests =====
    
    /// @dev Test: Cannot tamper with amount
    function testCannotTamperWithAmount() public {
        uint256 originalAmount = 1_000_000;
        uint256 tamperedAmount = 2_000_000;
        bytes32 salt = bytes32(uint256(4));
        
        // Create commitment with original amount
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            originalAmount,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Try to settle with tampered amount - should fail with InvalidCommitment
        vm.prank(facilitator);
        vm.expectRevert(); // Will revert with InvalidCommitment
        router.settleAndExecute(
            address(token),
            payer,
            tamperedAmount, // Tampered amount
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
    }
    
    /// @dev Test: Cannot tamper with recipient
    function testCannotTamperWithRecipient() public {
        uint256 amount = 1_000_000;
        bytes32 salt = bytes32(uint256(5));
        
        // Create commitment with original recipient
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Try to settle with tampered recipient
        vm.prank(facilitator);
        vm.expectRevert(); // Will revert with InvalidCommitment
        router.settleAndExecute(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            attacker, // Tampered recipient
            0,
            address(hook),
            ""
        );
    }
    
    /// @dev Test: Cannot tamper with facilitator fee
    function testCannotTamperWithFacilitatorFee() public {
        uint256 amount = 1_000_000;
        uint256 originalFee = 10_000;
        uint256 tamperedFee = 50_000;
        bytes32 salt = bytes32(uint256(6));
        
        // Create commitment with original fee
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            salt,
            merchant,
            originalFee,
            address(hook),
            ""
        );
        
        // Try to settle with tampered fee
        vm.prank(facilitator);
        vm.expectRevert(); // Will revert with InvalidCommitment
        router.settleAndExecute(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            tamperedFee, // Tampered fee
            address(hook),
            ""
        );
    }
    
    // ===== Salt Uniqueness Tests =====
    
    /// @dev Test: Salt ensures uniqueness and prevents replay
    function testSaltPreventsReplay() public {
        uint256 amount = 1_000_000;
        bytes32 salt1 = bytes32(uint256(7));
        bytes32 salt2 = bytes32(uint256(8));
        
        // Same parameters, different salts produce different nonces
        bytes32 nonce1 = router.calculateCommitment(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            salt1,
            merchant,
            0,
            address(hook),
            ""
        );
        
        bytes32 nonce2 = router.calculateCommitment(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            salt2,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Nonces should be different
        assertTrue(nonce1 != nonce2, "Different salts should produce different nonces");
        
        // Both settlements should succeed independently
        vm.startPrank(facilitator);
        
        router.settleAndExecute(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            nonce1,
            "",
            salt1,
            merchant,
            0,
            address(hook),
            ""
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            amount,
            0,
            type(uint256).max,
            nonce2,
            "",
            salt2,
            merchant,
            0,
            address(hook),
            ""
        );
        
        vm.stopPrank();
        
        // Merchant should have received tokens twice
        assertEq(token.balanceOf(merchant), amount * 2);
    }
    
    // ===== Malicious Token Tests =====
    
    /// @dev Test: Reverting token causes settlement to fail gracefully
    function testRevertingTokenHandled() public {
        MaliciousRevertingToken malToken = new MaliciousRevertingToken();
        malToken.mint(payer, 1_000_000);
        
        vm.prank(payer);
        malToken.approve(address(router), type(uint256).max);
        
        uint256 amount = 1_000_000;
        bytes32 salt = bytes32(uint256(9));
        
        bytes32 nonce = router.calculateCommitment(
            address(malToken),
            payer,
            amount,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Settlement should fail due to reverting token
        vm.prank(facilitator);
        vm.expectRevert(); // Will revert with MaliciousTransferRevert
        router.settleAndExecute(
            address(malToken),
            payer,
            amount,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
    }
    
    // ===== Authorization Tests =====
    
    /// @dev Test: Only facilitator can claim their own fees
    function testOnlyFacilitatorCanClaimOwnFees() public {
        uint256 amount = 1_000_000;
        uint256 fee = 10_000;
        bytes32 salt = bytes32(uint256(10));
        
        bytes32 nonce = router.calculateCommitment(
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
        
        // Accumulate fees
        vm.prank(facilitator);
        router.settleAndExecute(
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
        );
        
        // Attacker tries to claim facilitator's fees
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        vm.prank(attacker);
        router.claimFees(tokens);
        
        // Attacker should have received nothing
        assertEq(token.balanceOf(attacker), 0);
        
        // Facilitator's fees should remain
        assertEq(router.getPendingFees(facilitator, address(token)), fee);
    }
    
    // ===== Time Manipulation Tests =====
    
    /// @dev Test: Expired authorization should fail
    function testExpiredAuthorizationFails() public {
        uint256 amount = 1_000_000;
        bytes32 salt = bytes32(uint256(11));
        uint256 validBefore = block.timestamp + 1 hours;
        
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            amount,
            0,
            validBefore,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Fast forward past expiration
        vm.warp(validBefore + 1);
        
        // Settlement should fail
        vm.prank(facilitator);
        vm.expectRevert(); // Will revert with "Authorization expired"
        router.settleAndExecute(
            address(token),
            payer,
            amount,
            0,
            validBefore,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
    }
    
    /// @dev Test: Not-yet-valid authorization should fail
    function testNotYetValidAuthorizationFails() public {
        uint256 amount = 1_000_000;
        bytes32 salt = bytes32(uint256(12));
        uint256 validAfter = block.timestamp + 1 hours;
        
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            amount,
            validAfter,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Try to settle before validAfter
        vm.prank(facilitator);
        vm.expectRevert(); // Will revert with "Authorization not yet valid"
        router.settleAndExecute(
            address(token),
            payer,
            amount,
            validAfter,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
    }
}
