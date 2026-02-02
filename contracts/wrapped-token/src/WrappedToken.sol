// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ERC3009Token} from "./ERC3009Token.sol";

/**
 * @title WrappedToken
 * @notice Wraps any ERC20 token into an ERC3009-compatible token for facilitator usage
 * @dev Users can wrap their ERC20 tokens to get wrapped tokens that support EIP-3009
 *      transferWithAuthorization, enabling facilitator to execute payments on their behalf.
 * 
 * Features:
 * - Wrap: Deposit underlying ERC20 tokens to receive wrapped tokens (1:1 ratio)
 * - Unwrap: Redeem wrapped tokens to get back underlying tokens (1:1 ratio)
 * - ERC3009: Full EIP-3009 support inherited from ERC3009Token base contract
 * 
 * Architecture:
 * - Inherits ERC3009Token for all EIP-3009 functionality
 * - Adds wrap/unwrap functionality on top
 * - Maintains 1:1 ratio between underlying and wrapped tokens
 */
contract WrappedToken is ERC3009Token {
    using SafeERC20 for IERC20;
    
    // ===== State Variables =====
    
    /// @notice The underlying ERC20 token that is wrapped
    IERC20 public immutable underlyingToken;
    
    // ===== Events =====
    
    /// @notice Emitted when tokens are wrapped
    event Wrapped(address indexed account, uint256 amount);
    
    /// @notice Emitted when tokens are unwrapped
    event Unwrapped(address indexed account, uint256 amount);
    
    // ===== Errors =====
    
    error ZeroAmount();
    
    // ===== Constructor =====
    
    /**
     * @notice Initializes the wrapped token contract
     * @param _underlyingToken Address of the underlying ERC20 token to wrap
     * @param name Name of the wrapped token (e.g., "Wrapped USDC")
     * @param symbol Symbol of the wrapped token (e.g., "WUSDC")
     */
    constructor(
        address _underlyingToken,
        string memory name,
        string memory symbol
    ) ERC3009Token(name, symbol, "1") {
        require(_underlyingToken != address(0), "Invalid underlying token");
        underlyingToken = IERC20(_underlyingToken);
    }
    
    // ===== Wrap/Unwrap Functions =====
    
    /**
     * @notice Wrap underlying tokens to receive wrapped tokens
     * @dev Transfers underlying tokens from caller and mints wrapped tokens 1:1
     * @param amount Amount of underlying tokens to wrap
     */
    function wrap(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        
        // Transfer underlying tokens from caller to this contract
        underlyingToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Mint wrapped tokens to caller (1:1 ratio)
        _mint(msg.sender, amount);
        
        emit Wrapped(msg.sender, amount);
    }
    
    /**
     * @notice Unwrap wrapped tokens to receive underlying tokens
     * @dev Burns wrapped tokens and transfers underlying tokens 1:1
     * @param amount Amount of wrapped tokens to unwrap
     */
    function unwrap(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        
        // Burn wrapped tokens from caller
        _burn(msg.sender, amount);
        
        // Transfer underlying tokens to caller (1:1 ratio)
        underlyingToken.safeTransfer(msg.sender, amount);
        
        emit Unwrapped(msg.sender, amount);
    }
    
    /**
     * @notice Get the underlying token address
     * @return Address of the underlying ERC20 token
     */
    function underlying() external view returns (address) {
        return address(underlyingToken);
    }
    
    /**
     * @notice Get the decimals of the wrapped token (matches underlying)
     * @return Number of decimals
     */
    function decimals() public view override returns (uint8) {
        try ERC20(address(underlyingToken)).decimals() returns (uint8 underlyingDecimals) {
            return underlyingDecimals;
        } catch {
            // Default to 18 if underlying token doesn't implement decimals()
            return 18;
        }
    }
}

