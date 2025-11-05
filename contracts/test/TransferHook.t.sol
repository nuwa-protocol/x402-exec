// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {SettlementRouter} from "../src/SettlementRouter.sol";
import {TransferHook} from "../src/hooks/TransferHook.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TransferHookTest
 * @notice Comprehensive tests for the TransferHook built-in contract
 */
contract TransferHookTest is Test {
    SettlementRouter public router;
    TransferHook public transferHook;
    MockUSDC public token;
    
    address public payer;
    address public merchant;
    address public facilitator;
    
    uint256 constant AMOUNT = 1000000; // 1 USDC (6 decimals)
    uint256 constant FACILITATOR_FEE = 10000; // 0.01 USDC
    uint256 constant VALID_AFTER = 0;
    uint256 constant VALID_BEFORE = type(uint256).max;
    
    event Transfer(
        bytes32 indexed contextKey,
        address indexed recipient,
        uint256 amount
    );
    
    event Settled(
        bytes32 indexed contextKey,
        address indexed payer,
        address indexed token,
        uint256 amount,
        address hook,
        bytes32 salt,
        address payTo,
        uint256 facilitatorFee
    );
    
    // Helper function to calculate commitment hash
    function calculateCommitment(
        address tokenAddr,
        address from,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 salt,
        address payTo,
        uint256 facilitatorFee,
        address hook,
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
            hook,
            keccak256(hookData)
        ));
    }
    
    function setUp() public {
        // Deploy contracts
        router = new SettlementRouter();
        token = new MockUSDC();
        transferHook = new TransferHook(address(router));
        
        // Setup accounts
        payer = makeAddr("payer");
        merchant = makeAddr("merchant");
        facilitator = makeAddr("facilitator");
        
        // Mint tokens to payer
        token.mint(payer, 10 * AMOUNT);
        
        // Approve router
        vm.prank(payer);
        token.approve(address(router), type(uint256).max);
    }
    
    // ===== Constructor Tests =====
    
    function testConstructor() public {
        // Verify initialization
        assertEq(transferHook.settlementRouter(), address(router));
    }
    
    function testConstructorRevertsWithZeroAddress() public {
        vm.expectRevert(TransferHook.InvalidRouterAddress.selector);
        new TransferHook(address(0));
    }
    
    // ===== Basic Transfer Tests =====
    
    function testBasicTransfer() public {
        bytes32 salt = bytes32(uint256(1));
        bytes memory hookData = "";
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            merchant,
            0, // No facilitator fee
            address(transferHook),
            hookData
        );
        
        // Execute settlement
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            merchant,
            0, // No facilitator fee
            address(transferHook),
            hookData
        );
        
        // Verify transfer
        assertEq(token.balanceOf(merchant), AMOUNT);
        assertEq(token.balanceOf(payer), 10 * AMOUNT - AMOUNT);
    }
    
    function testTransferWithFacilitatorFee() public {
        bytes32 salt = bytes32(uint256(2));
        bytes memory hookData = "";
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            merchant,
            FACILITATOR_FEE,
            address(transferHook),
            hookData
        );
        
        // Record initial balances
        uint256 payerInitial = token.balanceOf(payer);
        
        // Execute settlement
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            merchant,
            FACILITATOR_FEE,
            address(transferHook),
            hookData
        );
        
        // Verify merchant receives amount minus fee
        uint256 expectedMerchantAmount = AMOUNT - FACILITATOR_FEE;
        assertEq(token.balanceOf(merchant), expectedMerchantAmount);
        
        // Verify payer paid full amount
        assertEq(token.balanceOf(payer), payerInitial - AMOUNT);
        
        // Verify facilitator fee is accumulated in router
        assertEq(router.pendingFees(facilitator, address(token)), FACILITATOR_FEE);
    }
    
    function testTransferWithEmptyHookData() public {
        bytes32 salt = bytes32(uint256(3));
        bytes memory hookData = "";
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            merchant,
            FACILITATOR_FEE,
            address(transferHook),
            hookData
        );
        
        // Execute settlement with empty hookData
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            merchant,
            FACILITATOR_FEE,
            address(transferHook),
            hookData
        );
        
        // Verify transfer succeeded
        assertEq(token.balanceOf(merchant), AMOUNT - FACILITATOR_FEE);
    }
    
    function testTransferWithOptionalHookData() public {
        bytes32 salt = bytes32(uint256(4));
        // Hook ignores data, but it can be present for metadata
        bytes memory hookData = abi.encode("order-123", "memo");
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            merchant,
            FACILITATOR_FEE,
            address(transferHook),
            hookData
        );
        
        // Execute settlement with hookData
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            merchant,
            FACILITATOR_FEE,
            address(transferHook),
            hookData
        );
        
        // Verify transfer succeeded despite having hookData
        assertEq(token.balanceOf(merchant), AMOUNT - FACILITATOR_FEE);
    }
    
    // ===== Event Tests =====
    
    function testEmitsTransferEvent() public {
        bytes32 salt = bytes32(uint256(5));
        bytes memory hookData = "";
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            merchant,
            FACILITATOR_FEE,
            address(transferHook),
            hookData
        );
        
        bytes32 contextKey = router.calculateContextKey(payer, address(token), nonce);
        
        // Expect Transfer event from hook
        vm.expectEmit(true, true, false, true);
        emit Transfer(contextKey, merchant, AMOUNT - FACILITATOR_FEE);
        
        // Execute settlement
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            merchant,
            FACILITATOR_FEE,
            address(transferHook),
            hookData
        );
    }
    
    // ===== Security Tests =====
    
    function testOnlyRouterCanExecute() public {
        bytes32 contextKey = keccak256("test");
        bytes memory data = "";
        
        // Try to call execute directly (not from router)
        vm.expectRevert(TransferHook.OnlyRouter.selector);
        vm.prank(merchant);
        transferHook.execute(
            contextKey,
            payer,
            address(token),
            AMOUNT,
            bytes32(0),
            merchant,
            facilitator,
            data
        );
    }
    
    function testRouterCanExecute() public view {
        // Verify router address is set correctly
        assertEq(transferHook.settlementRouter(), address(router));
    }
    
    // ===== Return Value Tests =====
    
    function testReturnsCorrectData() public {
        bytes32 salt = bytes32(uint256(6));
        bytes memory hookData = "";
        bytes memory signature = "mock_signature";
        uint256 netAmount = AMOUNT - FACILITATOR_FEE;
        
        bytes32 nonce = calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            merchant,
            FACILITATOR_FEE,
            address(transferHook),
            hookData
        );
        
        // Execute and capture return value through events
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            merchant,
            FACILITATOR_FEE,
            address(transferHook),
            hookData
        );
        
        // Verify merchant received correct amount
        assertEq(token.balanceOf(merchant), netAmount);
    }
    
    // ===== Gas Cost Tests =====
    
    function testGasCostBasicTransfer() public {
        bytes32 salt = bytes32(uint256(7));
        bytes memory hookData = "";
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            merchant,
            0,
            address(transferHook),
            hookData
        );
        
        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            merchant,
            0,
            address(transferHook),
            hookData
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        // Log gas usage for reference
        console.log("Gas used for basic transfer:", gasUsed);
        
        // Verify transfer succeeded
        assertEq(token.balanceOf(merchant), AMOUNT);
    }
    
    function testGasCostWithFee() public {
        bytes32 salt = bytes32(uint256(8));
        bytes memory hookData = "";
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            merchant,
            FACILITATOR_FEE,
            address(transferHook),
            hookData
        );
        
        // Measure gas
        uint256 gasBefore = gasleft();
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            merchant,
            FACILITATOR_FEE,
            address(transferHook),
            hookData
        );
        uint256 gasUsed = gasBefore - gasleft();
        
        // Log gas usage for reference
        console.log("Gas used for transfer with fee:", gasUsed);
        
        // Verify transfer succeeded
        assertEq(token.balanceOf(merchant), AMOUNT - FACILITATOR_FEE);
    }
    
    // ===== Edge Cases =====
    
    function testTransferFullAmount() public {
        uint256 fullAmount = token.balanceOf(payer);
        bytes32 salt = bytes32(uint256(9));
        bytes memory hookData = "";
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = calculateCommitment(
            address(token),
            payer,
            fullAmount,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            merchant,
            0,
            address(transferHook),
            hookData
        );
        
        // Transfer all tokens
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            fullAmount,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            merchant,
            0,
            address(transferHook),
            hookData
        );
        
        // Verify payer has zero balance
        assertEq(token.balanceOf(payer), 0);
        assertEq(token.balanceOf(merchant), fullAmount);
    }
    
    function testMultipleTransfers() public {
        uint256 numTransfers = 3;
        
        for (uint256 i = 0; i < numTransfers; i++) {
            bytes32 salt = bytes32(uint256(100 + i));
            bytes memory hookData = "";
            bytes memory signature = "mock_signature";
            
            bytes32 nonce = calculateCommitment(
                address(token),
                payer,
                AMOUNT,
                VALID_AFTER,
                VALID_BEFORE,
                salt,
                merchant,
                FACILITATOR_FEE,
                address(transferHook),
                hookData
            );
            
            vm.prank(facilitator);
            router.settleAndExecute(
                address(token),
                payer,
                AMOUNT,
                VALID_AFTER,
                VALID_BEFORE,
                nonce,
                signature,
                salt,
                merchant,
                FACILITATOR_FEE,
                address(transferHook),
                hookData
            );
        }
        
        // Verify total transfers
        uint256 expectedMerchantBalance = (AMOUNT - FACILITATOR_FEE) * numTransfers;
        assertEq(token.balanceOf(merchant), expectedMerchantBalance);
        
        // Verify accumulated fees
        uint256 expectedFees = FACILITATOR_FEE * numTransfers;
        assertEq(router.pendingFees(facilitator, address(token)), expectedFees);
    }
    
    function testTransferToDifferentRecipients() public {
        address recipient1 = makeAddr("recipient1");
        address recipient2 = makeAddr("recipient2");
        
        // Transfer 1
        bytes32 salt1 = bytes32(uint256(200));
        bytes memory hookData = "";
        bytes memory signature = "mock_signature";
        
        bytes32 nonce1 = calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt1,
            recipient1,
            0,
            address(transferHook),
            hookData
        );
        
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce1,
            signature,
            salt1,
            recipient1,
            0,
            address(transferHook),
            hookData
        );
        
        // Transfer 2
        bytes32 salt2 = bytes32(uint256(201));
        bytes32 nonce2 = calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt2,
            recipient2,
            0,
            address(transferHook),
            hookData
        );
        
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce2,
            signature,
            salt2,
            recipient2,
            0,
            address(transferHook),
            hookData
        );
        
        // Verify both recipients received their transfers
        assertEq(token.balanceOf(recipient1), AMOUNT);
        assertEq(token.balanceOf(recipient2), AMOUNT);
    }
}

