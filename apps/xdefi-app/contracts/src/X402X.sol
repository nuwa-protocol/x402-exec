// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title X402X
 * @notice A simple ERC20 token with a fixed supply of 1 billion tokens
 * @dev All tokens are minted to the deployer upon contract creation
 */
contract X402X is ERC20 {
    /// @notice Total supply of tokens (1 billion with 18 decimals)
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18;

    /**
     * @notice Initializes the X402X token
     * @dev Mints the total supply to the deployer address
     */
    constructor() ERC20("X402X", "X402X") {
        _mint(msg.sender, TOTAL_SUPPLY);
    }
}


