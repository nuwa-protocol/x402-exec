// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {WrappedToken} from "../src/WrappedToken.sol";
import {ERC3009Token} from "../src/ERC3009Token.sol";
import {MockUSDC} from "./mocks/MockUSDC.sol";
import {SettlementRouter} from "contracts/src/SettlementRouter.sol";
import {TransferHook} from "contracts/src/hooks/TransferHook.sol";
import {IERC3009} from "contracts/src/interfaces/IERC3009.sol";

/**
 * @title WrappedTokenTest
 * @notice Comprehensive tests for WrappedToken wrap/unwrap and ERC3009 functionality
 */
contract WrappedTokenTest is Test {
    WrappedToken public wrappedToken;
    MockUSDC public underlyingToken;
    SettlementRouter public router;
    TransferHook public hook;
    
    address public user;
    address public facilitator;
    address public recipient;
    
    uint256 constant INITIAL_BALANCE = 1_000_000_000; // 1000 USDC (6 decimals)
    uint256 constant WRAP_AMOUNT = 100_000_000; // 100 USDC
    uint256 constant TRANSFER_AMOUNT = 50_000_000; // 50 USDC
    
    function setUp() public {
        // Deploy contracts
        underlyingToken = new MockUSDC();
        router = new SettlementRouter();
        hook = new TransferHook(address(router));
        wrappedToken = new WrappedToken(
            address(underlyingToken),
            "Wrapped USDC",
            "WUSDC"
        );
        
        // Setup accounts
        user = makeAddr("user");
        facilitator = makeAddr("facilitator");
        recipient = makeAddr("recipient");
        
        // Mint underlying tokens to user
        underlyingToken.mint(user, INITIAL_BALANCE);
    }
    
    // ===== Wrap/Unwrap Tests =====
    
    function test_Wrap() public {
        vm.startPrank(user);
        
        // Approve wrapped token contract to spend underlying tokens
        underlyingToken.approve(address(wrappedToken), WRAP_AMOUNT);
        
        // Wrap tokens
        wrappedToken.wrap(WRAP_AMOUNT);
        
        // Verify balances
        assertEq(wrappedToken.balanceOf(user), WRAP_AMOUNT, "User should have wrapped tokens");
        assertEq(underlyingToken.balanceOf(user), INITIAL_BALANCE - WRAP_AMOUNT, "User should have less underlying tokens");
        assertEq(underlyingToken.balanceOf(address(wrappedToken)), WRAP_AMOUNT, "WrappedToken should hold underlying tokens");
        
        vm.stopPrank();
    }
    
    function test_Unwrap() public {
        // First wrap some tokens
        vm.startPrank(user);
        underlyingToken.approve(address(wrappedToken), WRAP_AMOUNT);
        wrappedToken.wrap(WRAP_AMOUNT);
        
        // Then unwrap
        wrappedToken.unwrap(WRAP_AMOUNT);
        
        // Verify balances
        assertEq(wrappedToken.balanceOf(user), 0, "User should have no wrapped tokens");
        assertEq(underlyingToken.balanceOf(user), INITIAL_BALANCE, "User should have all underlying tokens back");
        assertEq(underlyingToken.balanceOf(address(wrappedToken)), 0, "WrappedToken should have no underlying tokens");
        
        vm.stopPrank();
    }
    
    function test_WrapUnwrap_RoundTrip() public {
        vm.startPrank(user);
        
        // Wrap
        underlyingToken.approve(address(wrappedToken), WRAP_AMOUNT);
        wrappedToken.wrap(WRAP_AMOUNT);
        
        // Unwrap
        wrappedToken.unwrap(WRAP_AMOUNT);
        
        // Verify original balance restored
        assertEq(underlyingToken.balanceOf(user), INITIAL_BALANCE, "Balance should be restored");
        
        vm.stopPrank();
    }
    
    function test_Wrap_ZeroAmount() public {
        vm.startPrank(user);
        underlyingToken.approve(address(wrappedToken), type(uint256).max);
        
        vm.expectRevert(WrappedToken.ZeroAmount.selector);
        wrappedToken.wrap(0);
        
        vm.stopPrank();
    }
    
    function test_Unwrap_ZeroAmount() public {
        vm.startPrank(user);
        
        vm.expectRevert(WrappedToken.ZeroAmount.selector);
        wrappedToken.unwrap(0);
        
        vm.stopPrank();
    }
    
    function test_Unwrap_InsufficientBalance() public {
        vm.startPrank(user);
        
        vm.expectRevert();
        wrappedToken.unwrap(WRAP_AMOUNT);
        
        vm.stopPrank();
    }
    
    function test_Decimals() public view {
        // MockUSDC uses 6 decimals
        assertEq(wrappedToken.decimals(), 6, "Decimals should match underlying token");
    }
    
    function test_Underlying() public view {
        assertEq(wrappedToken.underlying(), address(underlyingToken), "Should return underlying token address");
    }
    
    // ===== ERC3009 Tests =====
    
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
        // Get domain separator from wrapped token contract
        bytes32 domainSeparator = wrappedToken.DOMAIN_SEPARATOR();
        
        // EIP-3009 struct hash
        bytes32 structHash = keccak256(abi.encode(
            wrappedToken.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
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
    
    function test_TransferWithAuthorization() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        // Setup: mint underlying tokens to signer and wrap them
        underlyingToken.mint(signer, WRAP_AMOUNT);
        vm.startPrank(signer);
        underlyingToken.approve(address(wrappedToken), WRAP_AMOUNT);
        wrappedToken.wrap(WRAP_AMOUNT);
        vm.stopPrank();
        
        // Generate signature
        bytes32 nonce = bytes32(uint256(1));
        bytes memory signature = signTransferAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0, // validAfter
            type(uint256).max, // validBefore
            nonce,
            privateKey
        );
        
        // Execute transfer via facilitator
        vm.prank(facilitator);
        wrappedToken.transferWithAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            nonce,
            signature
        );
        
        // Verify balances
        assertEq(wrappedToken.balanceOf(signer), WRAP_AMOUNT - TRANSFER_AMOUNT, "Signer should have less tokens");
        assertEq(wrappedToken.balanceOf(recipient), TRANSFER_AMOUNT, "Recipient should receive tokens");
        
        // Verify nonce is used
        assertTrue(wrappedToken.authorizationState(signer, nonce), "Nonce should be marked as used");
    }
    
    function test_TransferWithAuthorization_InvalidSignature() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        // Setup
        underlyingToken.mint(signer, WRAP_AMOUNT);
        vm.startPrank(signer);
        underlyingToken.approve(address(wrappedToken), WRAP_AMOUNT);
        wrappedToken.wrap(WRAP_AMOUNT);
        vm.stopPrank();
        
        // Generate signature with wrong private key
        uint256 wrongPrivateKey = 0xBAD;
        bytes32 nonce = bytes32(uint256(1));
        bytes memory signature = signTransferAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            nonce,
            wrongPrivateKey
        );
        
        // Should revert with invalid signature
        vm.prank(facilitator);
        vm.expectRevert(ERC3009Token.InvalidSignature.selector);
        wrappedToken.transferWithAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            nonce,
            signature
        );
    }
    
    function test_TransferWithAuthorization_Expired() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        // Setup
        underlyingToken.mint(signer, WRAP_AMOUNT);
        vm.startPrank(signer);
        underlyingToken.approve(address(wrappedToken), WRAP_AMOUNT);
        wrappedToken.wrap(WRAP_AMOUNT);
        vm.stopPrank();
        
        // Generate signature with expired timestamp
        bytes32 nonce = bytes32(uint256(1));
        bytes memory signature = signTransferAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            block.timestamp - 1, // Already expired
            nonce,
            privateKey
        );
        
        // Should revert with expired error
        vm.prank(facilitator);
        vm.expectRevert(ERC3009Token.AuthorizationExpired.selector);
        wrappedToken.transferWithAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            block.timestamp - 1,
            nonce,
            signature
        );
    }
    
    function test_TransferWithAuthorization_NotYetValid() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        // Setup
        underlyingToken.mint(signer, WRAP_AMOUNT);
        vm.startPrank(signer);
        underlyingToken.approve(address(wrappedToken), WRAP_AMOUNT);
        wrappedToken.wrap(WRAP_AMOUNT);
        vm.stopPrank();
        
        // Generate signature with future validAfter
        bytes32 nonce = bytes32(uint256(1));
        bytes memory signature = signTransferAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            block.timestamp + 100, // Not yet valid
            type(uint256).max,
            nonce,
            privateKey
        );
        
        // Should revert with not yet valid error
        vm.prank(facilitator);
        vm.expectRevert(ERC3009Token.AuthorizationNotYetValid.selector);
        wrappedToken.transferWithAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            block.timestamp + 100,
            type(uint256).max,
            nonce,
            signature
        );
    }
    
    function test_TransferWithAuthorization_ReplayAttack() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        // Setup
        underlyingToken.mint(signer, WRAP_AMOUNT);
        vm.startPrank(signer);
        underlyingToken.approve(address(wrappedToken), WRAP_AMOUNT);
        wrappedToken.wrap(WRAP_AMOUNT);
        vm.stopPrank();
        
        bytes32 nonce = bytes32(uint256(1));
        bytes memory signature = signTransferAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            nonce,
            privateKey
        );
        
        // First transfer should succeed
        vm.prank(facilitator);
        wrappedToken.transferWithAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            nonce,
            signature
        );
        
        // Second transfer with same nonce should fail
        vm.prank(facilitator);
        vm.expectRevert(ERC3009Token.AuthorizationAlreadyUsed.selector);
        wrappedToken.transferWithAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            nonce,
            signature
        );
    }
    
    function test_CancelAuthorization() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        // Setup
        underlyingToken.mint(signer, WRAP_AMOUNT);
        vm.startPrank(signer);
        underlyingToken.approve(address(wrappedToken), WRAP_AMOUNT);
        wrappedToken.wrap(WRAP_AMOUNT);
        vm.stopPrank();
        
        bytes32 nonce = bytes32(uint256(1));
        
        // Generate cancellation signature
        bytes32 domainSeparator = wrappedToken.DOMAIN_SEPARATOR();
        bytes32 structHash = keccak256(abi.encode(
            wrappedToken.CANCEL_AUTHORIZATION_TYPEHASH(),
            signer,
            nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        // Cancel authorization
        vm.prank(signer);
        wrappedToken.cancelAuthorization(signer, nonce, signature);
        
        // Verify nonce is marked as used
        assertTrue(wrappedToken.authorizationState(signer, nonce), "Nonce should be marked as used");
        
        // Try to use the canceled authorization - should fail
        bytes memory transferSignature = signTransferAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            nonce,
            privateKey
        );
        
        vm.prank(facilitator);
        vm.expectRevert(ERC3009Token.AuthorizationAlreadyUsed.selector);
        wrappedToken.transferWithAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            nonce,
            transferSignature
        );
    }
    
    function test_ReceiveWithAuthorization() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        // Setup
        underlyingToken.mint(signer, WRAP_AMOUNT);
        vm.startPrank(signer);
        underlyingToken.approve(address(wrappedToken), WRAP_AMOUNT);
        wrappedToken.wrap(WRAP_AMOUNT);
        vm.stopPrank();
        
        bytes32 nonce = bytes32(uint256(1));
        
        // Generate signature
        bytes32 domainSeparator = wrappedToken.DOMAIN_SEPARATOR();
        bytes32 structHash = keccak256(abi.encode(
            wrappedToken.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        
        // Recipient calls receiveWithAuthorization
        vm.prank(recipient);
        wrappedToken.receiveWithAuthorization(
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            nonce,
            v,
            r,
            s
        );
        
        // Verify balances
        assertEq(wrappedToken.balanceOf(signer), WRAP_AMOUNT - TRANSFER_AMOUNT, "Signer should have less tokens");
        assertEq(wrappedToken.balanceOf(recipient), TRANSFER_AMOUNT, "Recipient should receive tokens");
    }
    
    function test_ReceiveWithAuthorization_WrongRecipient() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        address wrongRecipient = makeAddr("wrong");
        
        // Setup
        underlyingToken.mint(signer, WRAP_AMOUNT);
        vm.startPrank(signer);
        underlyingToken.approve(address(wrappedToken), WRAP_AMOUNT);
        wrappedToken.wrap(WRAP_AMOUNT);
        vm.stopPrank();
        
        bytes32 nonce = bytes32(uint256(1));
        
        // Generate signature for recipient
        bytes32 domainSeparator = wrappedToken.DOMAIN_SEPARATOR();
        bytes32 structHash = keccak256(abi.encode(
            wrappedToken.TRANSFER_WITH_AUTHORIZATION_TYPEHASH(),
            signer,
            recipient,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            nonce
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        
        // Wrong recipient tries to call - should fail
        vm.prank(wrongRecipient);
        vm.expectRevert(ERC3009Token.InvalidRecipient.selector);
        wrappedToken.receiveWithAuthorization(
            signer,
            recipient, // Authorization is for recipient, but wrongRecipient is calling
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            nonce,
            v,
            r,
            s
        );
    }
    
    // ===== Integration with SettlementRouter =====
    
    function test_Integration_WithSettlementRouter() public {
        uint256 privateKey = 0xA11CE;
        address signer = vm.addr(privateKey);
        
        // Setup: wrap tokens
        underlyingToken.mint(signer, WRAP_AMOUNT);
        vm.startPrank(signer);
        underlyingToken.approve(address(wrappedToken), WRAP_AMOUNT);
        wrappedToken.wrap(WRAP_AMOUNT);
        vm.stopPrank();
        
        // Calculate commitment (this will be the EIP-3009 nonce)
        bytes32 salt = bytes32(uint256(1));
        bytes32 commitment = router.calculateCommitment(
            address(wrappedToken),
            signer,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            salt,
            recipient,
            0,
            address(hook),
            ""
        );
        
        // Generate signature for transferWithAuthorization
        bytes memory signature = signTransferAuthorization(
            signer,
            address(router),
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            commitment, // Use commitment as nonce
            privateKey
        );
        
        // Facilitator calls SettlementRouter
        vm.prank(facilitator);
        router.settleAndExecute(
            address(wrappedToken),
            signer,
            TRANSFER_AMOUNT,
            0,
            type(uint256).max,
            commitment,
            signature,
            salt,
            recipient,
            0,
            address(hook),
            ""
        );
        
        // Verify wrapped tokens are transferred to recipient via hook
        assertEq(wrappedToken.balanceOf(recipient), TRANSFER_AMOUNT, "Recipient should receive wrapped tokens");
        assertEq(wrappedToken.balanceOf(address(router)), 0, "Router should not hold wrapped tokens");
    }
}

