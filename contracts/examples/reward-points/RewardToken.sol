// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title RewardToken
 * @notice A reward points token with fixed supply and controlled distribution
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
 */
contract RewardToken is ERC20 {
    // ===== Constants =====
    
    /// @notice Maximum supply of reward tokens (1M with 18 decimals)
    uint256 public constant MAX_SUPPLY = 1_000_000 * 10**18;
    
    // ===== State Variables =====
    
    /// @notice Address authorized to distribute rewards (RewardHook)
    address public immutable rewardHook;
    
    // ===== Events =====
    
    /// @notice Emitted when rewards are distributed
    event RewardsDistributed(address indexed to, uint256 amount);
    
    // ===== Errors =====
    
    error OnlyRewardHook();
    error InsufficientRewards();
    
    // ===== Constructor =====
    
    /**
     * @notice Initializes the reward token with hook address
     * @param _hook Address authorized to distribute rewards (should be RewardHook)
     */
    constructor(address _hook) ERC20("Reward Points", "POINTS") {
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
}

