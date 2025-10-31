// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC3009} from "../../src/interfaces/IERC3009.sol";

/**
 * @title MockUSDC
 * @notice Mock USDC token, supports EIP-3009
 * @dev For testing only, simplified signature verification logic
 */
contract MockUSDC is ERC20, IERC3009 {
    // EIP-712 domain separator
    bytes32 private immutable DOMAIN_SEPARATOR;
    
    // EIP-3009 type hash
    bytes32 private constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");
    
    // Used nonces
    mapping(address => mapping(bytes32 => bool)) private _usedNonces;
    
    constructor() ERC20("Mock USD Coin", "USDC") {
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256(bytes("USD Coin")),
            keccak256(bytes("2")),
            block.chainid,
            address(this)
        ));
    }
    
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
    
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external override {
        require(block.timestamp > validAfter, "Authorization not yet valid");
        require(block.timestamp < validBefore, "Authorization expired");
        require(!_usedNonces[from][nonce], "Authorization already used");
        
        // Build message hash
        bytes32 structHash = keccak256(abi.encode(
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce
        ));
        
        bytes32 hash = keccak256(abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            structHash
        ));
        
        // Simplified signature verification: skip actual ECDSA verification in tests
        // In production environment, signature verification is needed here
        
        // Mark nonce as used
        _usedNonces[from][nonce] = true;
        
        // Execute transfer
        _transfer(from, to, value);
    }
    
    function cancelAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external override {
        require(!_usedNonces[from][nonce], "Authorization already used");
        _usedNonces[from][nonce] = true;
    }
    
    function authorizationState(
        address authorizer,
        bytes32 nonce
    ) external view override returns (bool) {
        return _usedNonces[authorizer][nonce];
    }
}
