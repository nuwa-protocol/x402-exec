// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC3009} from "../../src/interfaces/IERC3009.sol";

/**
 * @title RewardToken
 * @notice A reward points token with fixed supply, controlled distribution, and EIP-3009 support
 * @dev Used in Scenario 3: Points Reward showcase
 * 
 * Architecture:
 * - RewardHook is deployed first as reusable infrastructure
 * - RewardToken is deployed with hook address in constructor (secure by design)
 * - No front-running risk as hook is immutably set at deployment
 * 
 * Features:
 * - Fixed supply of 1,000,000 tokens
 * - All tokens initially held by contract
 * - Only designated hook can distribute tokens
 * - Hook address is immutable (set in constructor)
 * - EIP-3009 support for meta-transactions
 * - Uses OpenZeppelin's EIP712 for typed structured data hashing
 */
contract RewardToken is ERC20, EIP712, IERC3009 {
    // ===== Constants =====
    
    /// @notice Maximum supply of reward tokens (100M with 18 decimals)
    /// @dev Designed to support 100,000 transactions at 1000 tokens per transaction
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10**18;
    
    /// @notice EIP-3009 TransferWithAuthorization typehash
    bytes32 private constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH =
        keccak256("TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)");
    
    /// @notice EIP-3009 CancelAuthorization typehash  
    bytes32 private constant CANCEL_AUTHORIZATION_TYPEHASH =
        keccak256("CancelAuthorization(address authorizer,bytes32 nonce)");
    
    // ===== State Variables =====
    
    /// @notice Address authorized to distribute rewards (RewardHook)
    address public immutable rewardHook;
    
    /// @notice Mapping of nonce states for EIP-3009
    mapping(address => mapping(bytes32 => bool)) private _authorizationStates;
    
    // ===== Events =====
    
    /// @notice Emitted when rewards are distributed
    event RewardsDistributed(address indexed to, uint256 amount);
    
    /// @notice Emitted when an authorization is used
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    
    /// @notice Emitted when an authorization is canceled
    event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);
    
    // ===== Errors =====
    
    error OnlyRewardHook();
    error InsufficientRewards();
    error AuthorizationNotYetValid();
    error AuthorizationExpired();
    error AuthorizationAlreadyUsed();
    error InvalidSignature();
    
    // ===== Constructor =====
    
    /**
     * @notice Initializes the reward token with hook address
     * @param _hook Address authorized to distribute rewards (should be RewardHook)
     */
    constructor(address _hook) 
        ERC20("X402 Reward Points", "X402RP")
        EIP712("X402 Reward Points", "1")
    {
        require(_hook != address(0), "Invalid hook address");
        rewardHook = _hook;
        
        // Mint all tokens to this contract
        _mint(address(this), MAX_SUPPLY);
    }
    
    // ===== External Functions =====
    
    /**
     * @notice Distributes reward tokens to a recipient
     * @dev Can only be called by the authorized reward hook
     * @param to Address to receive the reward tokens
     * @param amount Amount of tokens to distribute
     */
    function distribute(address to, uint256 amount) external {
        if (msg.sender != rewardHook) revert OnlyRewardHook();
        if (balanceOf(address(this)) < amount) revert InsufficientRewards();
        
        _transfer(address(this), to, amount);
        emit RewardsDistributed(to, amount);
    }
    
    /**
     * @notice Returns the remaining tokens available for distribution
     * @return Amount of tokens still held by the contract
     */
    function remainingRewards() external view returns (uint256) {
        return balanceOf(address(this));
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
        // Verify timing
        if (block.timestamp <= validAfter) revert AuthorizationNotYetValid();
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

