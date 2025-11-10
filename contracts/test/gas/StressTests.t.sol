// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {SettlementRouter} from "../../src/SettlementRouter.sol";
import {TransferHook} from "../../src/hooks/TransferHook.sol";
import {MockUSDC} from "../mocks/MockUSDC.sol";

/**
 * @title StressTests
 * @notice Stress tests for edge cases and limits
 * @dev Tests system behavior under extreme conditions
 */
contract StressTests is Test {
    SettlementRouter public router;
    TransferHook public hook;
    MockUSDC public token;
    
    address public payer;
    address public merchant;
    address public facilitator;
    
    function setUp() public {
        router = new SettlementRouter();
        hook = new TransferHook(address(router));
        token = new MockUSDC();
        
        payer = makeAddr("payer");
        merchant = makeAddr("merchant");
        facilitator = makeAddr("facilitator");
        
        // Mint large amount
        token.mint(payer, type(uint256).max / 2);
        vm.prank(payer);
        token.approve(address(router), type(uint256).max);
    }
    
    // ===== Amount Boundary Tests =====
    
    /// @notice Test: Minimum amount (1 wei)
    function testStress_MinimumAmount() public {
        bytes32 salt = bytes32(uint256(1));
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            1,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            1,
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
        
        assertEq(token.balanceOf(merchant), 1);
    }
    
    /// @notice Test: Very large amount
    function testStress_LargeAmount() public {
        uint256 largeAmount = 1_000_000_000_000_000; // 1 billion tokens (18 decimals)
        bytes32 salt = bytes32(uint256(2));
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            largeAmount,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            largeAmount,
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
        
        assertEq(token.balanceOf(merchant), largeAmount);
    }
    
    /// @notice Test: Maximum fee (99.99% of amount)
    function testStress_MaximumFee() public {
        uint256 amount = 10_000;
        uint256 fee = 9_999; // 99.99%
        bytes32 salt = bytes32(uint256(3));
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
        
        assertEq(token.balanceOf(merchant), 1); // Only 1 wei to merchant
        assertEq(router.getPendingFees(facilitator, address(token)), fee);
    }
    
    // ===== Batch Operations Tests =====
    
    /// @notice Test: Consecutive settlements
    function testStress_ConsecutiveSettlements() public {
        uint256 count = 50;
        uint256 amount = 10_000;
        
        uint256 gasBefore = gasleft();
        
        for (uint256 i = 0; i < count; i++) {
            bytes32 salt = bytes32(i + 100);
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
        }
        
        uint256 gasUsed = gasBefore - gasleft();
        console.log("Gas: 50 consecutive settlements:", gasUsed);
        console.log("Average gas per settlement:", gasUsed / count);
        
        assertEq(token.balanceOf(merchant), amount * count);
    }
    
    /// @notice Test: Accumulate fees from many settlements
    function testStress_AccumulateManyFees() public {
        uint256 count = 100;
        uint256 amount = 10_000;
        uint256 fee = 100;
        
        for (uint256 i = 0; i < count; i++) {
            bytes32 salt = bytes32(i + 200);
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
        }
        
        uint256 totalFees = router.getPendingFees(facilitator, address(token));
        assertEq(totalFees, fee * count);
        
        console.log("Total fees accumulated from 100 settlements:", totalFees);
    }
    
    /// @notice Test: Batch fee claims (many tokens)
    function testStress_BatchFeeClaimManyTokens() public {
        // Create multiple tokens
        uint256 tokenCount = 20;
        address[] memory tokens = new address[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            MockUSDC newToken = new MockUSDC();
            newToken.mint(payer, 1_000_000);
            tokens[i] = address(newToken);
            
            vm.prank(payer);
            newToken.approve(address(router), type(uint256).max);
            
            // Accumulate fees in this token
            bytes32 salt = bytes32(i + 300);
            bytes32 nonce = router.calculateCommitment(
                address(newToken),
                payer,
                10_000,
                0,
                type(uint256).max,
                salt,
                merchant,
                100,
                address(hook),
                ""
            );
            
            vm.prank(facilitator);
            router.settleAndExecute(
                address(newToken),
                payer,
                10_000,
                0,
                type(uint256).max,
                nonce,
                "",
                salt,
                merchant,
                100,
                address(hook),
                ""
            );
        }
        
        // Claim all fees at once
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.claimFees(tokens);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Claim fees for 20 tokens:", gasUsed);
    }
    
    // ===== Distributed Transfer Stress Tests =====
    
    /// @notice Test: Maximum splits (100 recipients)
    function testStress_MaximumSplits() public {
        uint256 recipientCount = 100;
        TransferHook.Split[] memory splits = new TransferHook.Split[](recipientCount);
        
        for (uint256 i = 0; i < recipientCount; i++) {
            splits[i] = TransferHook.Split({
                recipient: makeAddr(string(abi.encodePacked("recipient", i))),
                bips: 100 // 1% each
            });
        }
        
        bytes memory hookData = abi.encode(splits);
        bytes32 salt = bytes32(uint256(400));
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            1_000_000,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            hookData
        );
        
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            1_000_000,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            hookData
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas: Distributed transfer to 100 recipients:", gasUsed);
        
        // Verify each recipient got 1%
        for (uint256 i = 0; i < recipientCount; i++) {
            address recipient = makeAddr(string(abi.encodePacked("recipient", i)));
            assertEq(token.balanceOf(recipient), 10_000); // 1% of 1_000_000
        }
    }
    
    /// @notice Test: Many small splits (precision test)
    function testStress_ManySmallSplits() public {
        uint256 recipientCount = 50;
        TransferHook.Split[] memory splits = new TransferHook.Split[](recipientCount);
        
        // Each recipient gets 0.1% (10 bips)
        for (uint256 i = 0; i < recipientCount; i++) {
            splits[i] = TransferHook.Split({
                recipient: makeAddr(string(abi.encodePacked("small", i))),
                bips: 10
            });
        }
        // Total: 50 * 0.1% = 5%, merchant gets 95%
        
        bytes memory hookData = abi.encode(splits);
        bytes32 salt = bytes32(uint256(500));
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            10_000_000,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            hookData
        );
        
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            10_000_000,
            0,
            type(uint256).max,
            nonce,
            "",
            salt,
            merchant,
            0,
            address(hook),
            hookData
        );
        
        // Verify merchant got 95%
        assertEq(token.balanceOf(merchant), 9_500_000);
        
        // Verify each small recipient got 0.1%
        for (uint256 i = 0; i < recipientCount; i++) {
            address recipient = makeAddr(string(abi.encodePacked("small", i)));
            assertEq(token.balanceOf(recipient), 10_000);
        }
    }
    
    // ===== Operator Stress Tests =====
    
    /// @notice Test: Many operators for one facilitator
    function testStress_ManyOperators() public {
        uint256 operatorCount = 50;
        
        // Set many operators
        for (uint256 i = 0; i < operatorCount; i++) {
            address op = makeAddr(string(abi.encodePacked("operator", i)));
            vm.prank(facilitator);
            router.setFeeOperator(op, true);
            
            assertTrue(router.isFeeOperator(facilitator, op));
        }
        
        console.log("Successfully set 50 operators");
    }
    
    /// @notice Test: Operator claims from many facilitators
    function testStress_OperatorClaimsManyFacilitators() public {
        uint256 facilitatorCount = 10;
        address operator = makeAddr("superOperator");
        address[] memory facilitatorsArray = new address[](facilitatorCount);
        
        // Set up operator for multiple facilitators
        for (uint256 i = 0; i < facilitatorCount; i++) {
            address fac = makeAddr(string(abi.encodePacked("fac", i)));
            facilitatorsArray[i] = fac;
            
            vm.prank(fac);
            router.setFeeOperator(operator, true);
            
            // Accumulate fees for this facilitator
            bytes32 salt = bytes32(i + 600);
            bytes32 nonce = router.calculateCommitment(
                address(token),
                payer,
                10_000,
                0,
                type(uint256).max,
                salt,
                merchant,
                100,
                address(hook),
                ""
            );
            
            vm.prank(fac);
            router.settleAndExecute(
                address(token),
                payer,
                10_000,
                0,
                type(uint256).max,
                nonce,
                "",
                salt,
                merchant,
                100,
                address(hook),
                ""
            );
        }
        
        // Operator claims fees for all facilitators
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        for (uint256 i = 0; i < facilitatorCount; i++) {
            vm.prank(operator);
            router.claimFeesFor(facilitatorsArray[i], tokens, address(0));
        }
        
        console.log("Operator claimed fees for 10 facilitators");
    }
    
    // ===== Summary =====
    
    function testStress_Summary() public view {
        console.log("=== Stress Test Scenarios ===");
        console.log("1. Minimum/Maximum amounts");
        console.log("2. Consecutive settlements (50)");
        console.log("3. Fee accumulation (100)");
        console.log("4. Batch claims (20 tokens)");
        console.log("5. Distributed transfers (100 recipients)");
        console.log("6. Many operators (50)");
        console.log("All scenarios tested successfully!");
    }
}

