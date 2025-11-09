// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {SettlementRouter} from "../../src/SettlementRouter.sol";
import {TransferHook} from "../../src/hooks/TransferHook.sol";
import {MockUSDCWithSignatureValidation} from "../mocks/MockUSDCWithSignatureValidation.sol";

/**
 * @title EIP3009Integration
 * @notice Integration tests for EIP-3009 transferWithAuthorization with real signatures
 * @dev Tests the full flow with ECDSA signatures and proper validation
 */
contract EIP3009Integration is Test {
    SettlementRouter public router;
    TransferHook public hook;
    MockUSDCWithSignatureValidation public token;
    
    // Test account with known private key
    uint256 constant PAYER_PRIVATE_KEY = 0xA11CE;
    address public payer;
    
    address public merchant;
    address public facilitator;
    
    uint256 constant AMOUNT = 1_000_000;
    uint256 constant FEE = 10_000;
    
    function setUp() public {
        router = new SettlementRouter();
        hook = new TransferHook(address(router));
        token = new MockUSDCWithSignatureValidation();
        
        // Derive payer address from private key
        payer = vm.addr(PAYER_PRIVATE_KEY);
        merchant = makeAddr("merchant");
        facilitator = makeAddr("facilitator");
        
        // Mint tokens to payer
        token.mint(payer, 100_000_000);
    }
    
    /// @notice Generate EIP-3009 authorization signature
    function signTransferAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        // Get domain separator from token contract
        bytes32 domainSeparator = token.DOMAIN_SEPARATOR();
        
        // EIP-3009 struct hash
        bytes32 structHash = keccak256(abi.encode(
            keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"),
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce
        ));
        
        // Final digest
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            domainSeparator,
            structHash
        ));
        
        // Sign with private key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        
        return abi.encodePacked(r, s, v);
    }
    
    // ===== Basic EIP-3009 Integration Tests =====
    
    /// @notice Test: Settlement with real EIP-3009 signature
    function testIntegration_RealSignature() public {
        bytes32 salt = bytes32(uint256(1));
        
        // Calculate commitment (this will also be the EIP-3009 nonce!)
        bytes32 commitment = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Generate real signature for EIP-3009 transferWithAuthorization
        // IMPORTANT: Use commitment as the EIP-3009 nonce!
        bytes memory signature = signTransferAuthorization(
            payer,
            address(router),
            AMOUNT,
            0,
            type(uint256).max,
            commitment, // Use commitment as nonce!
            PAYER_PRIVATE_KEY
        );
        
        // Execute settlement with signature
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            commitment,
            signature,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Verify transfer happened
        assertEq(token.balanceOf(merchant), AMOUNT);
        assertEq(token.balanceOf(payer), 100_000_000 - AMOUNT);
    }
    
    /// @notice Test: Settlement with fee and real signature
    function testIntegration_SignatureWithFee() public {
        bytes32 salt = bytes32(uint256(2));
        
        bytes32 commitment = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            merchant,
            FEE,
            address(hook),
            ""
        );
        
        bytes memory signature = signTransferAuthorization(
            payer,
            address(router),
            AMOUNT,
            0,
            type(uint256).max,
            commitment, // Use commitment as nonce
            PAYER_PRIVATE_KEY
        );
        
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            commitment,
            signature,
            salt,
            merchant,
            FEE,
            address(hook),
            ""
        );
        
        // Verify balances
        assertEq(token.balanceOf(merchant), AMOUNT - FEE);
        assertEq(router.getPendingFees(facilitator, address(token)), FEE);
    }
    
    /// @notice Test: Invalid signature should fail (now with real validation!)
    function testIntegration_InvalidSignatureFails() public {
        bytes32 salt = bytes32(uint256(3));
        
        bytes32 commitment = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Sign with WRONG amount
        bytes memory badSignature = signTransferAuthorization(
            payer,
            address(router),
            AMOUNT + 1, // Wrong amount
            0,
            type(uint256).max,
            commitment,
            PAYER_PRIVATE_KEY
        );
        
        // Should fail because signature doesn't match the amount being transferred
        vm.prank(facilitator);
        vm.expectRevert("Invalid signature");
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT, // Correct amount
            0,
            type(uint256).max,
            commitment,
            badSignature, // But signature is for AMOUNT+1
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
    }
    
    /// @notice Test: Wrong signer should fail
    function testIntegration_WrongSignerFails() public {
        bytes32 salt = bytes32(uint256(13));
        
        bytes32 commitment = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Sign with WRONG private key
        uint256 wrongPrivateKey = 0xBAD;
        bytes memory badSignature = signTransferAuthorization(
            payer,
            address(router),
            AMOUNT,
            0,
            type(uint256).max,
            commitment,
            wrongPrivateKey // Wrong signer!
        );
        
        // Should fail
        vm.prank(facilitator);
        vm.expectRevert("Invalid signature");
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            commitment,
            badSignature,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
    }
    
    /// @notice Test: Expired signature should fail
    function testIntegration_ExpiredSignatureFails() public {
        bytes32 salt = bytes32(uint256(4));
        uint256 validBefore = block.timestamp + 1 hours;
        
        bytes32 commitment = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            0,
            validBefore,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        bytes memory signature = signTransferAuthorization(
            payer,
            address(router),
            AMOUNT,
            0,
            validBefore,
            commitment,
            PAYER_PRIVATE_KEY
        );
        
        // Fast forward past expiration
        vm.warp(validBefore + 1);
        
        // Should fail
        vm.prank(facilitator);
        vm.expectRevert();
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            validBefore,
            commitment,
            signature,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
    }
    
    /// @notice Test: Reused nonce should fail  
    function testIntegration_ReusedNonceFails() public {
        bytes32 salt = bytes32(uint256(5));
        
        bytes32 commitment = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        bytes memory signature = signTransferAuthorization(
            payer,
            address(router),
            AMOUNT,
            0,
            type(uint256).max,
            commitment,
            PAYER_PRIVATE_KEY
        );
        
        // First settlement
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            commitment,
            signature,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
        
        // Try to reuse same signature/nonce - should fail with AlreadySettled
        vm.prank(facilitator);
        vm.expectRevert();
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            commitment,
            signature,
            salt,
            merchant,
            0,
            address(hook),
            ""
        );
    }
    
    // ===== Distributed Transfer with Real Signature =====
    
    /// @notice Test: Distributed transfer with real signature
    function testIntegration_DistributedTransferWithSignature() public {
        // Set up splits
        TransferHook.Split[] memory splits = new TransferHook.Split[](2);
        splits[0] = TransferHook.Split({recipient: makeAddr("alice"), bips: 3000}); // 30%
        splits[1] = TransferHook.Split({recipient: makeAddr("bob"), bips: 2000}); // 20%
        // Merchant gets remaining 50%
        
        bytes memory hookData = abi.encode(splits);
        bytes32 salt = bytes32(uint256(6));
        
        bytes32 commitment = router.calculateCommitment(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            salt,
            merchant,
            0,
            address(hook),
            hookData
        );
        
        bytes memory signature = signTransferAuthorization(
            payer,
            address(router),
            AMOUNT,
            0,
            type(uint256).max,
            commitment,
            PAYER_PRIVATE_KEY
        );
        
        vm.prank(facilitator);
        router.settleAndExecute(
            address(token),
            payer,
            AMOUNT,
            0,
            type(uint256).max,
            commitment,
            signature,
            salt,
            merchant,
            0,
            address(hook),
            hookData
        );
        
        // Verify splits
        assertEq(token.balanceOf(makeAddr("alice")), 300_000); // 30%
        assertEq(token.balanceOf(makeAddr("bob")), 200_000); // 20%
        assertEq(token.balanceOf(merchant), 500_000); // 50%
    }
    
    // ===== Summary =====
    
    function testIntegration_Summary() public view {
        console.log("=== EIP-3009 Integration Test Summary ===");
        console.log("1. Real ECDSA signatures with FULL validation");
        console.log("2. Invalid signature detection");
        console.log("3. Wrong signer detection");
        console.log("4. Expiration handling");
        console.log("5. Nonce replay protection");
        console.log("6. Distributed transfers");
        console.log("All integration scenarios with real signature validation!");
    }
}
