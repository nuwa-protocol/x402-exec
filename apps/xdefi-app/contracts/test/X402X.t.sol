// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {X402X} from "../src/X402X.sol";
import {IERC3009} from "contracts/src/interfaces/IERC3009.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title X402XTest
 * @notice Integration tests for X402X token with EIP-3009 support
 * @dev Tests transferWithAuthorization and receiveWithAuthorization with real signatures
 */
contract X402XTest is Test {
    X402X public token;
    
    // Test accounts with known private keys
    uint256 constant PAYER_PRIVATE_KEY = 0xA11CE;
    uint256 constant RECIPIENT_PRIVATE_KEY = 0xB0B;
    address public payer;
    address public recipient;
    address public deployer;
    
    uint256 constant AMOUNT = 1000 * 10**18; // 1000 tokens
    
    function setUp() public {
        deployer = address(this);
        token = new X402X();
        
        // Derive addresses from private keys
        payer = vm.addr(PAYER_PRIVATE_KEY);
        recipient = vm.addr(RECIPIENT_PRIVATE_KEY);
        
        // Transfer some tokens to payer for testing
        token.transfer(payer, 10_000 * 10**18);
    }
    
    // ===== Helper Functions =====
    
    /// @notice Generate EIP-3009 authorization signature (bytes format)
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
    
    /// @notice Generate EIP-3009 authorization signature (v, r, s format)
    function signTransferAuthorizationVRS(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint256 privateKey
    ) internal view returns (uint8 v, bytes32 r, bytes32 s) {
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
        (v, r, s) = vm.sign(privateKey, digest);
    }
    
    /// @notice Generate cancel authorization signature
    function signCancelAuthorization(
        address authorizer,
        bytes32 nonce,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 domainSeparator = token.DOMAIN_SEPARATOR();
        
        bytes32 structHash = keccak256(abi.encode(
            keccak256("CancelAuthorization(address authorizer,bytes32 nonce)"),
            authorizer,
            nonce
        ));
        
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            domainSeparator,
            structHash
        ));
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }
    
    // ===== Basic Transfer Tests =====
    
    function test_BasicTransfer() public {
        uint256 balanceBefore = token.balanceOf(recipient);
        token.transfer(recipient, AMOUNT);
        assertEq(token.balanceOf(recipient), balanceBefore + AMOUNT);
    }
    
    // ===== transferWithAuthorization Tests =====
    
    function test_TransferWithAuthorization_Success() public {
        bytes32 nonce = keccak256("test-nonce-1");
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;
        
        bytes memory signature = signTransferAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        uint256 payerBalanceBefore = token.balanceOf(payer);
        uint256 recipientBalanceBefore = token.balanceOf(recipient);
        
        token.transferWithAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            signature
        );
        
        assertEq(token.balanceOf(payer), payerBalanceBefore - AMOUNT);
        assertEq(token.balanceOf(recipient), recipientBalanceBefore + AMOUNT);
        assertTrue(token.authorizationState(payer, nonce));
    }
    
    function test_TransferWithAuthorization_InvalidSignature() public {
        bytes32 nonce = keccak256("test-nonce-2");
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;
        
        // Sign with wrong amount
        bytes memory badSignature = signTransferAuthorization(
            payer,
            recipient,
            AMOUNT + 1, // Wrong amount
            validAfter,
            validBefore,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        vm.expectRevert(X402X.InvalidSignature.selector);
        token.transferWithAuthorization(
            payer,
            recipient,
            AMOUNT, // Correct amount
            validAfter,
            validBefore,
            nonce,
            badSignature
        );
    }
    
    function test_TransferWithAuthorization_Expired() public {
        bytes32 nonce = keccak256("test-nonce-3");
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;
        
        bytes memory signature = signTransferAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        // Fast forward past expiration
        vm.warp(validBefore + 1);
        
        vm.expectRevert(X402X.AuthorizationExpired.selector);
        token.transferWithAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            signature
        );
    }
    
    function test_TransferWithAuthorization_NotYetValid() public {
        bytes32 nonce = keccak256("test-nonce-4");
        uint256 validAfter = block.timestamp + 1 hours;
        uint256 validBefore = block.timestamp + 2 hours;
        
        bytes memory signature = signTransferAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        vm.expectRevert(X402X.AuthorizationNotYetValid.selector);
        token.transferWithAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            signature
        );
    }
    
    function test_TransferWithAuthorization_ReusedNonce() public {
        bytes32 nonce = keccak256("test-nonce-5");
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;
        
        bytes memory signature = signTransferAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        // First transfer
        token.transferWithAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            signature
        );
        
        // Try to reuse same nonce
        vm.expectRevert(X402X.AuthorizationAlreadyUsed.selector);
        token.transferWithAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            signature
        );
    }
    
    function test_TransferWithAuthorization_ZeroAddress() public {
        bytes32 nonce = keccak256("test-nonce-6");
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;
        
        bytes memory signature = signTransferAuthorization(
            payer,
            address(0),
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        vm.expectRevert(X402X.InvalidRecipient.selector);
        token.transferWithAuthorization(
            payer,
            address(0),
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            signature
        );
    }
    
    // ===== receiveWithAuthorization Tests =====
    
    function test_ReceiveWithAuthorization_Success() public {
        bytes32 nonce = keccak256("test-nonce-7");
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;
        
        (uint8 v, bytes32 r, bytes32 s) = signTransferAuthorizationVRS(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        uint256 payerBalanceBefore = token.balanceOf(payer);
        uint256 recipientBalanceBefore = token.balanceOf(recipient);
        
        // Recipient calls the function
        vm.prank(recipient);
        token.receiveWithAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
        
        assertEq(token.balanceOf(payer), payerBalanceBefore - AMOUNT);
        assertEq(token.balanceOf(recipient), recipientBalanceBefore + AMOUNT);
        assertTrue(token.authorizationState(payer, nonce));
    }
    
    function test_ReceiveWithAuthorization_WrongCaller() public {
        bytes32 nonce = keccak256("test-nonce-8");
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;
        
        (uint8 v, bytes32 r, bytes32 s) = signTransferAuthorizationVRS(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        // Wrong caller (not the recipient)
        vm.prank(deployer);
        vm.expectRevert(X402X.InvalidRecipient.selector);
        token.receiveWithAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
    }
    
    function test_ReceiveWithAuthorization_InvalidSignature() public {
        bytes32 nonce = keccak256("test-nonce-9");
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;
        
        // Sign with wrong recipient
        (uint8 v, bytes32 r, bytes32 s) = signTransferAuthorizationVRS(
            payer,
            deployer, // Wrong recipient
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        vm.prank(recipient);
        vm.expectRevert(X402X.InvalidSignature.selector);
        token.receiveWithAuthorization(
            payer,
            recipient, // But trying to receive as recipient
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            v,
            r,
            s
        );
    }
    
    // ===== cancelAuthorization Tests =====
    
    function test_CancelAuthorization_Success() public {
        bytes32 nonce = keccak256("test-nonce-10");
        
        bytes memory signature = signCancelAuthorization(
            payer,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        assertFalse(token.authorizationState(payer, nonce));
        
        token.cancelAuthorization(payer, nonce, signature);
        
        assertTrue(token.authorizationState(payer, nonce));
        
        // Now transferWithAuthorization should fail
        bytes memory transferSig = signTransferAuthorization(
            payer,
            recipient,
            AMOUNT,
            block.timestamp,
            block.timestamp + 1 hours,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        vm.expectRevert(X402X.AuthorizationAlreadyUsed.selector);
        token.transferWithAuthorization(
            payer,
            recipient,
            AMOUNT,
            block.timestamp,
            block.timestamp + 1 hours,
            nonce,
            transferSig
        );
    }
    
    function test_CancelAuthorization_InvalidSignature() public {
        bytes32 nonce = keccak256("test-nonce-11");
        
        // Sign with wrong private key
        bytes memory badSignature = signCancelAuthorization(
            payer,
            nonce,
            RECIPIENT_PRIVATE_KEY // Wrong signer
        );
        
        vm.expectRevert(X402X.InvalidSignature.selector);
        token.cancelAuthorization(payer, nonce, badSignature);
    }
    
    function test_CancelAuthorization_AlreadyUsed() public {
        bytes32 nonce = keccak256("test-nonce-12");
        
        bytes memory signature = signCancelAuthorization(
            payer,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        // First cancellation
        token.cancelAuthorization(payer, nonce, signature);
        
        // Try to cancel again
        vm.expectRevert(X402X.AuthorizationAlreadyUsed.selector);
        token.cancelAuthorization(payer, nonce, signature);
    }
    
    // ===== authorizationState Tests =====
    
    function test_AuthorizationState_Unused() public view {
        bytes32 nonce = keccak256("test-nonce-13");
        assertFalse(token.authorizationState(payer, nonce));
    }
    
    function test_AuthorizationState_Used() public {
        bytes32 nonce = keccak256("test-nonce-14");
        uint256 validAfter = block.timestamp;
        uint256 validBefore = block.timestamp + 1 hours;
        
        bytes memory signature = signTransferAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        assertFalse(token.authorizationState(payer, nonce));
        
        token.transferWithAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            signature
        );
        
        assertTrue(token.authorizationState(payer, nonce));
    }
    
    // ===== Edge Cases =====
    
    function test_TransferWithAuthorization_ImmediateValidAfter() public {
        bytes32 nonce = keccak256("test-nonce-15");
        uint256 validAfter = 0; // Immediately valid
        uint256 validBefore = block.timestamp + 1 hours;
        
        bytes memory signature = signTransferAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        uint256 recipientBalanceBefore = token.balanceOf(recipient);
        
        token.transferWithAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            signature
        );
        
        assertEq(token.balanceOf(recipient), recipientBalanceBefore + AMOUNT);
    }
    
    function test_TransferWithAuthorization_MaxValidBefore() public {
        bytes32 nonce = keccak256("test-nonce-16");
        uint256 validAfter = block.timestamp;
        uint256 validBefore = type(uint256).max;
        
        bytes memory signature = signTransferAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            PAYER_PRIVATE_KEY
        );
        
        uint256 recipientBalanceBefore = token.balanceOf(recipient);
        
        token.transferWithAuthorization(
            payer,
            recipient,
            AMOUNT,
            validAfter,
            validBefore,
            nonce,
            signature
        );
        
        assertEq(token.balanceOf(recipient), recipientBalanceBefore + AMOUNT);
    }
}

