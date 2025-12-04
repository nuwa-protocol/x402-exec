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

    /**
     * @notice Receive a transfer with a signed authorization from the payer
     * @dev This has an additional check to ensure that the payee's address matches
     * the caller of this function to prevent front-running attacks. (See security
     * considerations)
     * @param from          Payer's address (Authorizer)
     * @param to            Payee's address
     * @param value         Amount to be transferred
     * @param validAfter    The time after which this is valid (unix time)
     * @param validBefore   The time before which this is valid (unix time)
     * @param nonce         Unique nonce
     * @param v             v of the signature
     * @param r             r of the signature
     * @param s             s of the signature
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
    ) external;
}

