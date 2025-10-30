// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ISettlementHook} from "../../src/interfaces/ISettlementHook.sol";

/**
 * @notice Interface for reward token distribution
 */
interface IRewardToken {
    function distribute(address to, uint256 amount) external;
}

/**
 * @title RewardHook
 * @notice Settlement hook that transfers payment to merchant and distributes reward tokens
 * @dev Used in Scenario 3: Points Reward showcase
 * 
 * Architecture:
 * - Hook is deployed first as reusable infrastructure
 * - Multiple RewardToken contracts can use the same hook
 * - RewardToken address is passed via hookData at runtime
 * 
 * Flow:
 * 1. Receive payment authorization from SettlementHub
 * 2. Transfer USDC to merchant
 * 3. Calculate reward points based on payment amount
 * 4. Distribute reward points to payer
 * 
 * Reward Rate:
 * - 1000 points per $0.1 USDC (0.1 USDC = 100,000 in 6 decimals)
 * - Example: Pay $0.1 → Get 1000 points
 */
contract RewardHook is ISettlementHook {
    using SafeERC20 for IERC20;
    
    
    // ===== Constants & Immutables =====
    
    /// @notice Address of the SettlementHub contract
    address public immutable settlementHub;
    
    /// @notice Reward rate: points per $0.1 USDC
    /// @dev For 0.1 USDC (100,000 in 6 decimals), user gets 1000 points (1000 * 10^18)
    uint256 public constant REWARD_RATE = 1000;
    
    // ===== Data Structures =====
    
    /**
     * @notice Reward configuration
     * @param rewardToken Address of the reward token contract
     * @param merchant Merchant address (recipient of funds)
     */
    struct RewardConfig {
        address rewardToken;
        address merchant;
    }
    
    // ===== Events =====
    
    /// @notice Emitted when payment is processed and rewards are distributed
    event RewardDistributed(
        bytes32 indexed contextKey,
        address indexed payer,
        address indexed merchant,
        address rewardToken,
        uint256 paymentAmount,
        uint256 rewardPoints
    );
    
    // ===== Errors =====
    
    error OnlyHub();
    error InvalidAddress();
    
    // ===== Modifiers =====
    
    modifier onlyHub() {
        if (msg.sender != settlementHub) revert OnlyHub();
        _;
    }
    
    // ===== Constructor =====
    
    /**
     * @notice Initializes the reward hook
     * @param _settlementHub Address of the SettlementHub contract
     */
    constructor(address _settlementHub) {
        require(_settlementHub != address(0), "Invalid hub address");
        settlementHub = _settlementHub;
    }
    
    // ===== External Functions =====
    
    /**
     * @notice Executes the reward distribution logic
     * @dev Called by SettlementHub during settleAndExecute
     * @param contextKey Unique identifier for this settlement
     * @param payer Address of the payment sender
     * @param token Address of the payment token (USDC)
     * @param amount Payment amount in token's decimals (6 for USDC)
     * @param data ABI-encoded RewardConfig struct
     * @return Encoded reward points amount
     */
    function execute(
        bytes32 contextKey,
        address payer,
        address token,
        uint256 amount,
        bytes calldata data
    ) external onlyHub returns (bytes memory) {
        // Decode configuration
        RewardConfig memory config = abi.decode(data, (RewardConfig));
        
        // Validate addresses
        if (config.rewardToken == address(0) || config.merchant == address(0)) {
            revert InvalidAddress();
        }
        
        // 1. Transfer payment to merchant
        IERC20(token).safeTransferFrom(settlementHub, config.merchant, amount);
        
        // 2. Calculate reward points
        // amount is in 6 decimals (USDC), reward is in 18 decimals (ERC20)
        // For 0.1 USDC (100,000), user gets 1000 points (1000 * 10^18)
        uint256 rewardPoints = (amount * REWARD_RATE * 10**18) / 100_000;
        
        // 3. Distribute reward points to payer
        IRewardToken(config.rewardToken).distribute(payer, rewardPoints);
        
        emit RewardDistributed(contextKey, payer, config.merchant, config.rewardToken, amount, rewardPoints);
        
        // Return reward points for off-chain tracking
        return abi.encode(rewardPoints);
    }
}

