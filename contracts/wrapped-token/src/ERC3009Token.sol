// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC3009} from "contracts/src/interfaces/IERC3009.sol";

/**
 * @title ERC3009Token
 * @notice Base contract implementing EIP-3009 (Transfer With Authorization) for ERC20 tokens
 * @dev This is a reusable base contract that can be inherited by any ERC20 token
 *      to add EIP-3009 meta-transaction support. It handles all signature verification
 *      and nonce management for authorized transfers.
 * 
 * Features:
 * - Full EIP-3009 implementation (transferWithAuthorization, cancelAuthorization, etc.)
 * - EIP-712 typed structured data hashing
 * - Replay attack protection via nonce tracking
 * - Expiration and validity window checks
 * - Front-running protection via receiveWithAuthorization
 * 
 * Usage:
 * ```solidity
 * contract MyToken is ERC3009Token {
 *     constructor() 
 *         ERC20("MyToken", "MTK") 
 *         ERC3009Token("MyToken", "MTK", "1") 
 *     {}
 * }
 * ```
 */
abstract contract ERC3009Token is ERC20, EIP712, IERC3009 {
    using ECDSA for bytes32;
    
    // ===== Constants =====
    
    /// @notice EIP-3009 TransferWithAuthorization typehash
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );
    
    /// @notice EIP-3009 CancelAuthorization typehash
    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH = keccak256(
        "CancelAuthorization(address authorizer,bytes32 nonce)"
    );
    
    // ===== State Variables =====
    
    /// @notice Mapping of nonce states for EIP-3009 (authorizer => nonce => used)
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
     * @notice Initializes the ERC3009Token with ERC20 and EIP-712 domain
     * @param name Token name (used for both ERC20 and EIP-712 domain)
     * @param symbol Token symbol (used for ERC20)
     * @param version Version string for EIP-712 domain (typically "1")
     */
    constructor(
        string memory name,
        string memory symbol,
        string memory version
    ) ERC20(name, symbol) EIP712(name, version) {}
    
    // ===== EIP-3009 Functions =====
    
    /**
     * @inheritdoc IERC3009
     * @notice Transfer tokens using EIP-712 authorization signature
     * @dev Allows any address (typically a facilitator) to execute transfers on behalf of users
     *      Signature verification ensures only the authorized user can create valid authorizations
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
        if (to == address(0)) revert InvalidRecipient();
        if (block.timestamp < validAfter) revert AuthorizationNotYetValid();
        if (block.timestamp >= validBefore) revert AuthorizationExpired();
        if (_authorizationStates[from][nonce]) revert AuthorizationAlreadyUsed();
        
        // Construct the EIP-712 digest
        bytes32 structHash = keccak256(abi.encode(
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce
        ));
        
        bytes32 digest = _hashTypedDataV4(structHash);
        
        // Verify signature
        address signer = digest.recover(signature);
        if (signer != from) revert InvalidSignature();
        
        // Mark authorization as used
        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        
        // Execute transfer
        _transfer(from, to, value);
    }
    
    /**
     * @inheritdoc IERC3009
     * @notice Cancel a previously issued authorization
     * @dev Prevents a signed authorization from being used in the future
     *      The authorizer must sign the cancellation to prove ownership
     */
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        bytes calldata signature
    ) external override {
        if (_authorizationStates[authorizer][nonce]) revert AuthorizationAlreadyUsed();
        
        // Construct the EIP-712 digest for cancellation
        bytes32 structHash = keccak256(abi.encode(
            CANCEL_AUTHORIZATION_TYPEHASH,
            authorizer,
            nonce
        ));
        
        bytes32 digest = _hashTypedDataV4(structHash);
        
        // Verify signature
        address signer = digest.recover(signature);
        if (signer != authorizer) revert InvalidSignature();
        
        // Mark as used so it can't be used in the future
        _authorizationStates[authorizer][nonce] = true;
        emit AuthorizationCanceled(authorizer, nonce);
    }
    
    /**
     * @inheritdoc IERC3009
     * @notice Receive a transfer with authorization (prevents front-running)
     * @dev Recipient must call this function themselves, preventing front-running attacks
     *      where a malicious actor could intercept and claim the transfer
     */
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        // Verify recipient matches caller (prevents front-running attacks)
        if (to != msg.sender) revert InvalidRecipient();
        if (to == address(0)) revert InvalidRecipient();
        if (block.timestamp < validAfter) revert AuthorizationNotYetValid();
        if (block.timestamp >= validBefore) revert AuthorizationExpired();
        if (_authorizationStates[from][nonce]) revert AuthorizationAlreadyUsed();
        
        // Construct the EIP-712 digest
        bytes32 structHash = keccak256(abi.encode(
            TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
            from,
            to,
            value,
            validAfter,
            validBefore,
            nonce
        ));
        
        bytes32 digest = _hashTypedDataV4(structHash);
        
        // Verify signature
        address signer = digest.recover(v, r, s);
        if (signer != from) revert InvalidSignature();
        
        // Mark authorization as used
        _authorizationStates[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        
        // Execute transfer
        _transfer(from, to, value);
    }
    
    /**
     * @inheritdoc IERC3009
     * @notice Check if an authorization nonce has been used
     * @param authorizer Address that issued the authorization
     * @param nonce Nonce to check
     * @return Whether the nonce has been used
     */
    function authorizationState(
        address authorizer,
        bytes32 nonce
    ) external view override returns (bool) {
        return _authorizationStates[authorizer][nonce];
    }
    
    // ===== Helper Functions =====
    
    /**
     * @notice Get the EIP-712 domain separator
     * @return Domain separator for signature verification
     */
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}

