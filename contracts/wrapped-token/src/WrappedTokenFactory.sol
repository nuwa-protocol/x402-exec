// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {WrappedToken} from "./WrappedToken.sol";

/**
 * @title WrappedTokenFactory
 * @notice Factory contract for creating WrappedToken instances for any ERC20 token
 * @dev This factory allows users to easily create wrapped versions of any ERC20 token
 *      that supports ERC3009 functionality. Each underlying token gets its own wrapped token instance.
 * 
 * Features:
 * - Create wrapped token for any ERC20 token
 * - Automatic naming: "Wrapped {tokenName}" and "W{tokenSymbol}"
 * - Prevents duplicate wrapped tokens for the same underlying token
 * - Tracks all created wrapped tokens
 * 
 * Usage:
 * ```solidity
 * // Create wrapped USDC
 * WrappedToken wUSDC = factory.createWrappedToken(usdcAddress, "Wrapped USDC", "WUSDC");
 * 
 * // Or use automatic naming
 * WrappedToken wUSDC = factory.createWrappedToken(usdcAddress);
 * ```
 */
contract WrappedTokenFactory {
    // ===== State Variables =====
    
    /// @notice Mapping from underlying token address to wrapped token address
    mapping(address => address) public wrappedTokens;
    
    /// @notice Array of all created wrapped token addresses
    address[] public allWrappedTokens;
    
    // ===== Events =====
    
    /// @notice Emitted when a new wrapped token is created
    event WrappedTokenCreated(
        address indexed underlyingToken,
        address indexed wrappedToken,
        string name,
        string symbol
    );
    
    // ===== Errors =====
    
    error TokenAlreadyWrapped(address underlyingToken, address existingWrappedToken);
    error InvalidTokenAddress();
    
    // ===== Functions =====
    
    /**
     * @notice Create a wrapped token for the given underlying token
     * @param underlyingToken Address of the ERC20 token to wrap
     * @param name Name for the wrapped token (e.g., "Wrapped USDC")
     * @param symbol Symbol for the wrapped token (e.g., "WUSDC")
     * @return wrappedToken Address of the newly created wrapped token
     */
    function createWrappedToken(
        address underlyingToken,
        string memory name,
        string memory symbol
    ) external returns (address wrappedToken) {
        if (underlyingToken == address(0)) revert InvalidTokenAddress();
        
        // Check if already wrapped
        address existing = wrappedTokens[underlyingToken];
        if (existing != address(0)) {
            revert TokenAlreadyWrapped(underlyingToken, existing);
        }
        
        // Deploy new wrapped token
        WrappedToken newWrappedToken = new WrappedToken(
            underlyingToken,
            name,
            symbol
        );
        
        wrappedToken = address(newWrappedToken);
        
        // Record the mapping
        wrappedTokens[underlyingToken] = wrappedToken;
        allWrappedTokens.push(wrappedToken);
        
        emit WrappedTokenCreated(underlyingToken, wrappedToken, name, symbol);
    }
    
    /**
     * @notice Get the wrapped token address for a given underlying token
     * @param underlyingToken Address of the underlying ERC20 token
     * @return wrappedToken Address of the wrapped token, or address(0) if not created
     */
    function getWrappedToken(address underlyingToken) external view returns (address wrappedToken) {
        return wrappedTokens[underlyingToken];
    }
    
    /**
     * @notice Get the total number of wrapped tokens created
     * @return count Number of wrapped tokens
     */
    function wrappedTokenCount() external view returns (uint256 count) {
        return allWrappedTokens.length;
    }
    
    /**
     * @notice Get all wrapped token addresses
     * @return tokens Array of all wrapped token addresses
     */
    function getAllWrappedTokens() external view returns (address[] memory tokens) {
        return allWrappedTokens;
    }
}

