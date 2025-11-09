// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {MockUSDCWithSignatureValidation} from "../mocks/MockUSDCWithSignatureValidation.sol";

/**
 * @title SimpleSignatureTest
 * @notice Simple test to verify EIP-3009 signature validation works
 */
contract SimpleSignatureTest is Test {
    MockUSDCWithSignatureValidation public token;
    
    uint256 constant PRIVATE_KEY = 0xA11CE;
    address public signer;
    address public recipient;
    
    function setUp() public {
        token = new MockUSDCWithSignatureValidation();
        signer = vm.addr(PRIVATE_KEY);
        recipient = makeAddr("recipient");
        
        // Mint tokens to signer
        token.mint(signer, 1_000_000);
        
        console.log("Signer address:", signer);
        console.log("Recipient address:", recipient);
    }
    
    function testSimpleTransferWithAuthorization() public {
        uint256 amount = 100_000;
        bytes32 nonce = keccak256("test");
        
        // Get domain separator
        bytes32 domainSeparator = token.DOMAIN_SEPARATOR();
        
        // Build struct hash
        bytes32 structHash = keccak256(abi.encode(
            keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"),
            signer,
            recipient,
            amount,
            uint256(0),
            type(uint256).max,
            nonce
        ));
        
        // Build digest
        bytes32 digest = keccak256(abi.encodePacked(
            "\x19\x01",
            domainSeparator,
            structHash
        ));
        
        // Sign
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(PRIVATE_KEY, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        
        console.log("Attempting transfer...");
        
        // Execute transfer
        token.transferWithAuthorization(
            signer,
            recipient,
            amount,
            0,
            type(uint256).max,
            nonce,
            signature
        );
        
        // Verify
        assertEq(token.balanceOf(recipient), amount);
        assertEq(token.balanceOf(signer), 900_000);
        
        console.log("Transfer successful!");
    }
}

