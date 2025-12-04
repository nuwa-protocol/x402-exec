// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC3009} from "contracts/src/interfaces/IERC3009.sol";

/**
 * @title X402X
 * @notice A simple ERC20 token with a fixed supply of 1 billion tokens and EIP-3009 support
 * @dev All tokens are minted to the deployer upon contract creation
 * Supports meta-transactions via EIP-3009 (Transfer With Authorization)
 */
contract X402X is ERC20, EIP712, IERC3009 {
    // ===== Constants =====
    
    /// @notice Total supply of tokens (1 billion with 18 decimals)
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;
    
    /// @notice EIP-3009 TransferWithAuthorization typehash
    bytes32 private constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");
    
    /// @notice EIP-3009 CancelAuthorization typehash
    bytes32 private constant CANCEL_AUTHORIZATION_TYPEHASH =
        keccak256("CancelAuthorization(address authorizer,bytes32 nonce)");
    
    // ===== State Variables =====
    
    /// @notice Mapping of nonce states for EIP-3009
    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;
    
    // ===== Events =====
    
    /// @notice Emitted when an authorization is used
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    
    /// @notice Emitted when an authorization is canceled
    event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);
    
    // ===== Errors =====
    
    error AuthorizationNotYetValid();
    error AuthorizationExpired();
    error AuthorizationAlreadyUsed();
    error InvalidSignature();
    error InvalidRecipient();
    
    // ===== Constructor =====
    
    /**
     * @notice Initializes the X402X token
     * @dev Mints the total supply to the deployer address
     */
    constructor() ERC20("X402X", "X402X") EIP712("X402X", "1") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
    
    // ===== EIP-3009 Functions =====
    
    /**
     * @inheritdoc IERC3009
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external override {
        // Verify recipient is not zero address (prevent accidental burns)
        if (to == address(0)) revert InvalidRecipient();
        
        // Verify timing (EIP-3009 standard: [validAfter, validBefore) - left-closed, right-open)
        if (block.timestamp < validAfter) revert AuthorizationNotYetValid();
        if (block.timestamp >= validBefore) revert AuthorizationExpired();
        
        // Verify nonce not used
        if (_authorizationStates[from][nonce]) revert AuthorizationAlreadyUsed();
        
        // Build and verify signature
        bytes32 structHash = keccak256(abi.encode(
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, signature);
        
        if (signer != from) revert InvalidSignature();
        
        // Mark nonce as used
        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        
        // Execute transfer
        _transfer(from, to, value);
    }
    
    /**
     * @inheritdoc IERC3009
     */
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        bytes calldata signature
    ) external override {
        // Verify nonce not used
        if (_authorizationStates[authorizer][nonce]) revert AuthorizationAlreadyUsed();
        
        // Build and verify signature
        bytes32 structHash = keccak256(abi.encode(
            CANCEL_AUTHORIZATION_TYPEHASH,
            authorizer,
            nonce
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(hash, signature);
        
        if (signer != authorizer) revert InvalidSignature();
        
        // Mark nonce as used
        _authorizationStates[authorizer][nonce] = true;
        emit AuthorizationCanceled(authorizer, nonce);
    }
    
    /**
     * @inheritdoc IERC3009
     */
    function authorizationState(
        address authorizer,
        bytes32 nonce
    ) external view override returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }
}


