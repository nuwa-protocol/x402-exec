// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

/**
 * @title IERC3009
 * @notice EIP-3009: Transfer With Authorization Interface
 * @dev Tokens like USDC implement this interface, supporting meta-transaction transfers
 */
interface IERC3009 {
    /**
     * @notice Transfer using authorization
     * @dev Authorization via EIP-712 signature, msg.sender doesn't need to be from address
     * 
     * @param from Payer address
     * @param to Recipient address
     * @param value Amount
     * @param validAfter Valid after timestamp (0 means immediately)
     * @param validBefore Expiration timestamp
     * @param nonce Unique nonce (32 bytes, prevents replay)
     * @param signature EIP-712 signature
     */
    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external;
    
    /**
     * @notice Cancel authorization
     * @param authorizer Authorizer address
     * @param nonce Unique nonce
     * @param signature EIP-712 signature
     */
    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        bytes calldata signature
    ) external;
    
    /**
     * @notice Check authorization state
     * @param authorizer Authorizer address
     * @param nonce Nonce
     * @return Whether it has been used
     */
    function authorizationState(
        address authorizer,
        bytes32 nonce
    ) external view returns (bool);
}

