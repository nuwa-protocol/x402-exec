// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {SettlementRouter} from "../src/SettlementRouter.sol";
import {TransferHook} from "../src/hooks/TransferHook.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {MockFailingHook, MockSimpleHook} from "./mocks/MockHooks.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SettlementRouterTest
 * @notice Test SettlementRouter core functionality
 */
contract SettlementRouterTest is Test {
    SettlementRouter public router;
    TransferHook public transferHook;
    MockUSDC public token;
    MockFailingHook public failingHook;
    MockSimpleHook public simpleHook;
    
    address public payer;
    address public merchant;
    address public platform;
    
    uint256 constant AMOUNT = 1000000; // 1 USDC (6 decimals)
    uint256 constant VALID_AFTER = 0;
    uint256 constant VALID_BEFORE = type(uint256).max;
    
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
    
    event HookExecuted(
        bytes32 indexed contextKey,
        address indexed hook,
        bytes returnData
    );
    
    event FeeAccumulated(
        address indexed facilitator,
        address indexed token,
        uint256 amount
    );
    
    event FeesClaimed(
        address indexed facilitator,
        address indexed token,
        uint256 amount
    );
    
    function setUp() public {
        // Deploy contracts
        router = new SettlementRouter();
        token = new MockUSDC();
        transferHook = new TransferHook(address(router));
        failingHook = new MockFailingHook(address(router));
        simpleHook = new MockSimpleHook(address(router));
        
        // Setup accounts
        payer = makeAddr("payer");
        merchant = makeAddr("merchant");
        platform = makeAddr("platform");
        
        // Mint tokens to payer
        token.mint(payer, 10 * AMOUNT);
    }
    
    function testCalculateContextKey() public {
        address from = address(0x1);
        address tokenAddr = address(0x2);
        bytes32 nonce = bytes32(uint256(1));
        
        bytes32 contextKey = router.calculateContextKey(from, tokenAddr, nonce);
        bytes32 expected = keccak256(abi.encodePacked(from, tokenAddr, nonce));
        
        assertEq(contextKey, expected);
    }
    
    function testIsSettled() public {
        bytes32 contextKey = keccak256("test");
        
        // Initial state: not settled
        assertFalse(router.isSettled(contextKey));
        
        // We cannot directly set settled state here as it is private
        // Need to test through actual settleAndExecute calls
    }
    
    function testSettleAndExecuteWithSimpleHook() public {
        bytes32 salt = bytes32(uint256(1));
        address payTo = merchant;
        uint256 facilitatorFee = 0;
        bytes memory signature = "mock_signature";
        bytes memory hookData = abi.encode(merchant);
        
        // Calculate commitment (which becomes the nonce)
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Calculate contextKey
        bytes32 contextKey = router.calculateContextKey(payer, address(token), nonce);
        
        // Expected events - note the order of event emission
        vm.expectEmit(true, true, false, true);
        emit HookExecuted(contextKey, address(simpleHook), abi.encode(merchant, AMOUNT));
        
        vm.expectEmit(true, true, true, true);
        emit Settled(contextKey, payer, address(token), AMOUNT, address(simpleHook), salt, payTo, facilitatorFee);
        
        // Execute settlement
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Verify state
        assertTrue(router.isSettled(contextKey));
        
        // Verify balances
        assertEq(token.balanceOf(address(router)), 0); // Hub holds no funds
        assertEq(token.balanceOf(merchant), AMOUNT); // Merchant received funds
        assertEq(token.balanceOf(payer), 9 * AMOUNT); // Payer balance decreased
        
        // Verify nonce is used
        assertTrue(token.authorizationState(payer, nonce));
    }
    
    function testIdempotency() public {
        bytes32 salt = bytes32(uint256(2));
        address payTo = merchant;
        uint256 facilitatorFee = 0;
        bytes memory signature = "mock_signature";
        bytes memory hookData = abi.encode(merchant);
        
        // Calculate commitment nonce
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // First call: success
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        bytes32 contextKey = router.calculateContextKey(payer, address(token), nonce);
        assertTrue(router.isSettled(contextKey));
        
        // Second call: should fail (idempotency)
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.AlreadySettled.selector,
                contextKey
            )
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
    }
    
    function testHookFailure() public {
        bytes32 salt = bytes32(uint256(3));
        address payTo = payer;
        uint256 facilitatorFee = 0;
        bytes memory signature = "mock_signature";
        bytes memory hookData = "";
        
        // Calculate commitment nonce
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(failingHook),
            hookData
        );
        
        // Set Hook to failure mode
        failingHook.setShouldFail(true);
        
        // Call should fail
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.HookExecutionFailed.selector,
                address(failingHook),
                abi.encodeWithSignature("Error(string)", "Mock hook failure")
            )
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(failingHook),
            hookData
        );
        
        // Verify state: transaction failed, contextKey should not be marked as settled
        bytes32 contextKey = router.calculateContextKey(payer, address(token), nonce);
        assertFalse(router.isSettled(contextKey));
        
        // Verify balances: payer balance should not change
        assertEq(token.balanceOf(payer), 10 * AMOUNT);
        assertEq(token.balanceOf(address(router)), 0);
    }
    
    function testSettleWithoutHook() public {
        bytes32 salt = bytes32(uint256(4));
        address payTo = payer;
        uint256 facilitatorFee = 0;
        bytes memory signature = "mock_signature";
        bytes memory hookData = "";
        
        // Calculate commitment nonce
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(0),
            hookData
        );
        
        // No Hook (hook = address(0))
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.RouterShouldNotHoldFunds.selector,
                address(token),
                AMOUNT
            )
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(0), // No Hook
            hookData
        );
    }
    
    function testTransferHookDistributedMode() public {
        bytes32 salt = bytes32(uint256(5));
        address payTo = merchant; // Merchant is primary recipient
        uint256 facilitatorFee = 0;
        bytes memory signature = "mock_signature";
        
        // Setup split configuration: 70% to merchant, 30% to platform
        // Note: TransferHook splits data is directly encoded into hookData
        TransferHook.Split[] memory splits = new TransferHook.Split[](2);
        splits[0] = TransferHook.Split({
            recipient: merchant,
            bips: 7000
        });
        splits[1] = TransferHook.Split({
            recipient: platform,
            bips: 3000
        });
        
        bytes memory hookData = abi.encode(splits);
        
        // Calculate commitment nonce
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(transferHook),
            hookData
        );
        
        // Execute settlement
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(transferHook),
            hookData
        );
        
        // Verify split results
        assertEq(token.balanceOf(merchant), 700000); // 70%
        assertEq(token.balanceOf(platform), 300000); // 30%
        assertEq(token.balanceOf(address(router)), 0); // Hub holds no funds
        assertEq(token.balanceOf(payer), 9 * AMOUNT); // Payer balance decreased
    }
    
    function testInvalidTransferSplit() public {
        bytes32 salt = bytes32(uint256(7));
        address payTo = merchant;
        uint256 facilitatorFee = 0;
        bytes memory signature = "mock_signature";
        
        // Setup invalid split configuration: total > 100%
        TransferHook.Split[] memory splits = new TransferHook.Split[](2);
        splits[0] = TransferHook.Split({
            recipient: merchant,
            bips: 6000 // 60%
        });
        splits[1] = TransferHook.Split({
            recipient: platform,
            bips: 5000 // 50%, total 110% (invalid)
        });
        
        bytes memory hookData = abi.encode(splits);
        
        // Calculate commitment nonce
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(transferHook),
            hookData
        );
        
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.HookExecutionFailed.selector,
                address(transferHook),
                abi.encodeWithSelector(TransferHook.InvalidTotalBips.selector, 11000)
            )
        );
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(transferHook),
            hookData
        );
    }
    
    function testTransferFailed() public {
        bytes32 salt = bytes32(uint256(6));
        address payTo = merchant;
        uint256 facilitatorFee = 0;
        bytes memory signature = "mock_signature";
        bytes memory hookData = abi.encode(merchant);
        
        // Payer doesn't have sufficient balance
        address poorPayer = makeAddr("poorPayer");
        token.mint(poorPayer, AMOUNT / 2); // Only half the amount
        
        // Calculate commitment nonce
        bytes32 nonce = router.calculateCommitment(
            address(token),
            poorPayer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        vm.expectRevert(); // transferWithAuthorization will fail
        
        router.settleAndExecute(
            address(token),
            poorPayer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
    }
    
    // ===== New Commitment Tests =====
    
    function testCommitmentCalculation() public {
        bytes32 salt = bytes32(uint256(100));
        address payTo = merchant;
        uint256 facilitatorFee = 10000; // 0.01 USDC
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        // Calculate commitment
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // This should succeed (commitment matches)
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        bytes32 contextKey = router.calculateContextKey(payer, address(token), nonce);
        assertTrue(router.isSettled(contextKey));
    }
    
    function testInvalidCommitmentRejected() public {
        bytes32 salt = bytes32(uint256(101));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        // Calculate correct commitment
        bytes32 correctNonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Use a different nonce (invalid commitment)
        bytes32 wrongNonce = bytes32(uint256(999));
        
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.InvalidCommitment.selector,
                correctNonce,
                wrongNonce
            )
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            wrongNonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
    }
    
    function testCommitmentPreventsTamperingValue() public {
        bytes32 salt = bytes32(uint256(102));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        // Calculate commitment with original value
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Try to use different value (tampered)
        uint256 tamperedValue = AMOUNT * 2;
        
        bytes32 expectedCommitment = router.calculateCommitment(
            address(token),
            payer,
            tamperedValue,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.InvalidCommitment.selector,
                expectedCommitment,
                nonce
            )
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            tamperedValue,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
    }
    
    function testCommitmentPreventsTamperingHook() public {
        bytes32 salt = bytes32(uint256(103));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        // Calculate commitment with simpleHook
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Try to use different hook (tampered)
        bytes32 expectedCommitment = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(failingHook),
            hookData
        );
        
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.InvalidCommitment.selector,
                expectedCommitment,
                nonce
            )
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(failingHook),
            hookData
        );
    }
    
    function testCommitmentPreventsTamperingHookData() public {
        bytes32 salt = bytes32(uint256(104));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        // Calculate commitment with original hookData
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Try to use different hookData (tampered)
        bytes memory tamperedHookData = abi.encode(platform);
        
        bytes32 expectedCommitment = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            tamperedHookData
        );
        
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.InvalidCommitment.selector,
                expectedCommitment,
                nonce
            )
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            tamperedHookData
        );
    }
    
    function testCommitmentPreventsTamperingFacilitatorFee() public {
        bytes32 salt = bytes32(uint256(105));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        // Calculate commitment with original fee
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Try to use different fee (tampered)
        uint256 tamperedFee = 50000;
        
        bytes32 expectedCommitment = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            tamperedFee,
            address(simpleHook),
            hookData
        );
        
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.InvalidCommitment.selector,
                expectedCommitment,
                nonce
            )
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            tamperedFee,
            address(simpleHook),
            hookData
        );
    }
    
    function testCommitmentPreventsTamperingPayTo() public {
        bytes32 salt = bytes32(uint256(106));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        // Calculate commitment with original payTo
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Try to use different payTo (tampered)
        address tamperedPayTo = platform;
        
        bytes32 expectedCommitment = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            tamperedPayTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.InvalidCommitment.selector,
                expectedCommitment,
                nonce
            )
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            tamperedPayTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
    }
    
    function testCommitmentPreventsTamperingSalt() public {
        bytes32 salt = bytes32(uint256(107));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        // Calculate commitment with original salt
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Try to use different salt (tampered)
        bytes32 tamperedSalt = bytes32(uint256(999));
        
        bytes32 expectedCommitment = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            tamperedSalt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.InvalidCommitment.selector,
                expectedCommitment,
                nonce
            )
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            tamperedSalt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
    }
    
    // ===== Facilitator Fee Tests =====
    
    function testFacilitatorFeeAccumulation() public {
        bytes32 salt = bytes32(uint256(200));
        address payTo = merchant;
        uint256 facilitatorFee = 10000; // 0.01 USDC
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        address facilitator = address(this);
        
        // Calculate commitment
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Check initial pending fees
        assertEq(router.getPendingFees(facilitator, address(token)), 0);
        
        // Execute settlement
        vm.expectEmit(true, true, false, true);
        emit FeeAccumulated(facilitator, address(token), facilitatorFee);
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Check pending fees after settlement
        assertEq(router.getPendingFees(facilitator, address(token)), facilitatorFee);
        
        // Verify merchant received amount minus fee
        assertEq(token.balanceOf(merchant), AMOUNT - facilitatorFee);
    }
    
    function testClaimFeesMultipleTokens() public {
        // Setup: Accumulate fees for two different tokens
        MockUSDC token2 = new MockUSDC();
        token2.mint(payer, 10 * AMOUNT);
        
        bytes32 salt1 = bytes32(uint256(201));
        bytes32 salt2 = bytes32(uint256(202));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        address facilitator = address(this);
        
        // First settlement with token1
        bytes32 nonce1 = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt1,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce1,
            signature,
            salt1,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Second settlement with token2
        bytes32 nonce2 = router.calculateCommitment(
            address(token2),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt2,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        router.settleAndExecute(
            address(token2),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce2,
            signature,
            salt2,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Verify pending fees
        assertEq(router.getPendingFees(facilitator, address(token)), facilitatorFee);
        assertEq(router.getPendingFees(facilitator, address(token2)), facilitatorFee);
        
        // Claim fees for both tokens
        address[] memory tokens = new address[](2);
        tokens[0] = address(token);
        tokens[1] = address(token2);
        
        uint256 balanceBefore = token.balanceOf(facilitator);
        uint256 balanceBefore2 = token2.balanceOf(facilitator);
        
        vm.expectEmit(true, true, false, true);
        emit FeesClaimed(facilitator, address(token), facilitatorFee);
        vm.expectEmit(true, true, false, true);
        emit FeesClaimed(facilitator, address(token2), facilitatorFee);
        
        router.claimFees(tokens);
        
        // Verify balances
        assertEq(token.balanceOf(facilitator), balanceBefore + facilitatorFee);
        assertEq(token2.balanceOf(facilitator), balanceBefore2 + facilitatorFee);
        
        // Verify pending fees are cleared
        assertEq(router.getPendingFees(facilitator, address(token)), 0);
        assertEq(router.getPendingFees(facilitator, address(token2)), 0);
    }
    
    function testClaimFeesWithZeroBalance() public {
        address facilitator = address(this);
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        // No fees accumulated
        assertEq(router.getPendingFees(facilitator, address(token)), 0);
        
        // Claiming should not revert, just not emit event
        router.claimFees(tokens);
        
        // Balance unchanged
        assertEq(router.getPendingFees(facilitator, address(token)), 0);
    }
    
    function testZeroFacilitatorFee() public {
        bytes32 salt = bytes32(uint256(203));
        address payTo = merchant;
        uint256 facilitatorFee = 0; // No fee
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        address facilitator = address(this);
        
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Execute settlement with zero fee
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // No fees accumulated
        assertEq(router.getPendingFees(facilitator, address(token)), 0);
        
        // Merchant received full amount
        assertEq(token.balanceOf(merchant), AMOUNT);
    }
    
    function testFacilitatorFeeDeduction() public {
        bytes32 salt = bytes32(uint256(204));
        address payTo = merchant;
        uint256 facilitatorFee = 100000; // 0.1 USDC
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Hook should receive amount minus fee
        uint256 expectedAmount = AMOUNT - facilitatorFee;
        assertEq(token.balanceOf(merchant), expectedAmount);
        
        // Verify Hook received correct amount through storage
        assertEq(simpleHook.lastAmount(), expectedAmount);
    }
    
    // ===== Hook Parameter Tests =====
    
    function testHookReceivesCorrectAmount() public {
        bytes32 salt = bytes32(uint256(300));
        address payTo = merchant;
        uint256 facilitatorFee = 50000; // 0.05 USDC
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Verify Hook received correct parameters
        uint256 expectedAmount = AMOUNT - facilitatorFee;
        assertEq(simpleHook.lastAmount(), expectedAmount);
        assertEq(simpleHook.lastPayer(), payer);
        assertEq(simpleHook.lastToken(), address(token));
    }
    
    function testHookReceivesAllParameters() public {
        bytes32 salt = bytes32(uint256(301));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        bytes32 expectedContextKey = router.calculateContextKey(payer, address(token), nonce);
        
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Verify all parameters
        assertEq(simpleHook.lastContextKey(), expectedContextKey);
        assertEq(simpleHook.lastPayer(), payer);
        assertEq(simpleHook.lastToken(), address(token));
        assertEq(simpleHook.lastAmount(), AMOUNT - facilitatorFee);
        assertEq(simpleHook.lastSalt(), salt);
        assertEq(simpleHook.lastPayTo(), payTo);
        assertEq(simpleHook.lastFacilitator(), address(this)); // msg.sender
        assertEq(simpleHook.lastData(), hookData);
    }
    
    function testFacilitatorIsMsgSender() public {
        bytes32 salt = bytes32(uint256(302));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Call from this contract
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Verify facilitator is msg.sender (this contract)
        assertEq(simpleHook.lastFacilitator(), address(this));
    }
    
    // ===== Edge Case Tests =====
    
    function testSaltUniquenessEnsuresIdempotency() public {
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        // Same parameters, different salt - should succeed both times
        bytes32 salt1 = bytes32(uint256(400));
        bytes32 salt2 = bytes32(uint256(401));
        
        bytes32 nonce1 = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt1,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        bytes32 nonce2 = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt2,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // First settlement
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce1,
            signature,
            salt1,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        bytes32 contextKey1 = router.calculateContextKey(payer, address(token), nonce1);
        assertTrue(router.isSettled(contextKey1));
        
        // Mint more tokens for second payment
        token.mint(payer, AMOUNT);
        
        // Second settlement with different salt - should succeed
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce2,
            signature,
            salt2,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        bytes32 contextKey2 = router.calculateContextKey(payer, address(token), nonce2);
        assertTrue(router.isSettled(contextKey2));
        
        // Both settlements succeeded
        assertEq(token.balanceOf(merchant), 2 * (AMOUNT - facilitatorFee));
    }
    
    function testRepeatedClaimFeesDoesNotFail() public {
        bytes32 salt = bytes32(uint256(402));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        address facilitator = address(this);
        
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Accumulate some fees
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        address[] memory tokens = new address[](1);
        tokens[0] = address(token);
        
        // First claim
        router.claimFees(tokens);
        assertEq(router.getPendingFees(facilitator, address(token)), 0);
        
        // Second claim (nothing to claim) - should not revert
        router.claimFees(tokens);
        assertEq(router.getPendingFees(facilitator, address(token)), 0);
        
        // Third claim - still should not revert
        router.claimFees(tokens);
        assertEq(router.getPendingFees(facilitator, address(token)), 0);
    }
    
    // ===== Recovery Mode Tests =====
    
    function testRecoveryAfterDirectTransfer() public {
        // Scenario: Malicious facilitator directly calls transferWithAuthorization
        // Then good facilitator or user calls settleAndExecute to complete business logic
        
        bytes32 salt = bytes32(uint256(500));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        // Calculate commitment
        bytes32 nonce = router.calculateCommitment(
            address(token), payer, AMOUNT,
            VALID_AFTER, VALID_BEFORE,
            salt, payTo, facilitatorFee,
            address(simpleHook), hookData
        );
        
        // 1. Malicious facilitator directly calls transferWithAuthorization
        token.transferWithAuthorization(
            payer, address(router), AMOUNT,
            VALID_AFTER, VALID_BEFORE,
            nonce, signature
        );
        
        // Verify: Funds in Router but no business logic executed
        assertEq(token.balanceOf(address(router)), AMOUNT);
        assertEq(token.balanceOf(merchant), 0);
        
        // Verify: nonce is used
        assertTrue(token.authorizationState(payer, nonce));
        
        // Verify: contextKey not settled
        bytes32 contextKey = router.calculateContextKey(payer, address(token), nonce);
        assertFalse(router.isSettled(contextKey));
        
        // 2. Good facilitator calls settleAndExecute (recovery flow)
        router.settleAndExecute(
            address(token), payer, AMOUNT,
            VALID_AFTER, VALID_BEFORE,
            nonce, signature,
            salt, payTo, facilitatorFee,
            address(simpleHook), hookData
        );
        
        // Verify: Business logic executed
        assertEq(token.balanceOf(merchant), AMOUNT - facilitatorFee);
        assertEq(token.balanceOf(address(router)), facilitatorFee); // Only holds fee
        assertTrue(router.isSettled(contextKey));
        
        // Verify: Facilitator received fee
        assertEq(router.getPendingFees(address(this), address(token)), facilitatorFee);
    }
    
    function testRecoveryModeStillValidatesCommitment() public {
        bytes32 salt = bytes32(uint256(501));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        // Calculate correct commitment
        bytes32 correctNonce = router.calculateCommitment(
            address(token), payer, AMOUNT,
            VALID_AFTER, VALID_BEFORE,
            salt, payTo, facilitatorFee,
            address(simpleHook), hookData
        );
        
        // Malicious facilitator uses wrong nonce for direct transfer
        bytes32 wrongNonce = bytes32(uint256(999));
        token.transferWithAuthorization(
            payer, address(router), AMOUNT,
            VALID_AFTER, VALID_BEFORE,
            wrongNonce, signature
        );
        
        // Try to recover with correct parameters but wrong nonce - should fail
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.InvalidCommitment.selector,
                correctNonce,
                wrongNonce
            )
        );
        
        router.settleAndExecute(
            address(token), payer, AMOUNT,
            VALID_AFTER, VALID_BEFORE,
            wrongNonce, signature,
            salt, payTo, facilitatorFee,
            address(simpleHook), hookData
        );
    }
    
    function testRecoveryFailsWithInsufficientBalance() public {
        bytes32 salt = bytes32(uint256(502));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = router.calculateCommitment(
            address(token), payer, AMOUNT,
            VALID_AFTER, VALID_BEFORE,
            salt, payTo, facilitatorFee,
            address(simpleHook), hookData
        );
        
        // Direct transfer but only half the amount
        token.transferWithAuthorization(
            payer, address(router), AMOUNT / 2,
            VALID_AFTER, VALID_BEFORE,
            nonce, signature
        );
        
        // Try to recover full amount - should fail
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.InsufficientBalanceForRecovery.selector,
                address(token),
                AMOUNT,
                AMOUNT / 2
            )
        );
        
        router.settleAndExecute(
            address(token), payer, AMOUNT,
            VALID_AFTER, VALID_BEFORE,
            nonce, signature,
            salt, payTo, facilitatorFee,
            address(simpleHook), hookData
        );
    }
    
    function testCannotCallTwiceAfterRecovery() public {
        bytes32 salt = bytes32(uint256(503));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory hookData = abi.encode(merchant);
        bytes memory signature = "mock_signature";
        
        bytes32 nonce = router.calculateCommitment(
            address(token), payer, AMOUNT,
            VALID_AFTER, VALID_BEFORE,
            salt, payTo, facilitatorFee,
            address(simpleHook), hookData
        );
        
        // Direct transfer
        token.transferWithAuthorization(
            payer, address(router), AMOUNT,
            VALID_AFTER, VALID_BEFORE,
            nonce, signature
        );
        
        bytes32 contextKey = router.calculateContextKey(payer, address(token), nonce);
        
        // First recovery call
        router.settleAndExecute(
            address(token), payer, AMOUNT,
            VALID_AFTER, VALID_BEFORE,
            nonce, signature,
            salt, payTo, facilitatorFee,
            address(simpleHook), hookData
        );
        
        assertTrue(router.isSettled(contextKey));
        
        // Mint more tokens for second attempt
        token.mint(payer, AMOUNT);
        
        // Second call should fail due to AlreadySettled
        vm.expectRevert(
            abi.encodeWithSelector(
                SettlementRouter.AlreadySettled.selector,
                contextKey
            )
        );
        
        router.settleAndExecute(
            address(token), payer, AMOUNT,
            VALID_AFTER, VALID_BEFORE,
            nonce, signature,
            salt, payTo, facilitatorFee,
            address(simpleHook), hookData
        );
    }
    
    function testNormalFlowUnaffectedByRecoveryLogic() public {
        // Verify normal flow still works after adding recovery logic
        // This is essentially the same as testSettleAndExecuteWithSimpleHook
        bytes32 salt = bytes32(uint256(504));
        address payTo = merchant;
        uint256 facilitatorFee = 10000;
        bytes memory signature = "mock_signature";
        bytes memory hookData = abi.encode(merchant);
        
        bytes32 nonce = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        bytes32 contextKey = router.calculateContextKey(payer, address(token), nonce);
        
        // Verify nonce is NOT used before calling settleAndExecute
        assertFalse(token.authorizationState(payer, nonce));
        
        // Execute settlement (normal flow, not recovery)
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            VALID_AFTER,
            VALID_BEFORE,
            nonce,
            signature,
            salt,
            payTo,
            facilitatorFee,
            address(simpleHook),
            hookData
        );
        
        // Verify state
        assertTrue(router.isSettled(contextKey));
        
        // Verify balances
        assertEq(token.balanceOf(address(router)), facilitatorFee); // Hub holds only fee
        assertEq(token.balanceOf(merchant), AMOUNT - facilitatorFee); // Merchant received funds
        assertEq(token.balanceOf(payer), 9 * AMOUNT); // Payer balance decreased
        
        // Verify nonce is now used
        assertTrue(token.authorizationState(payer, nonce));
        
        // Verify facilitator fee
        assertEq(router.getPendingFees(address(this), address(token)), facilitatorFee);
    }
}