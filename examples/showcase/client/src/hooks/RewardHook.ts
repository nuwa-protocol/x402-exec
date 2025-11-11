/**
 * RewardHook utilities for showcase
 * 
 * Helper functions for encoding hookData for RewardHook contract.
 * This is a showcase example, not part of the core SDK.
 * 
 * @see contracts/examples/reward-points/RewardHook.sol
 */

import { encodeAbiParameters } from "viem";
import type { Address } from "viem";

/**
 * Reward Hook configuration
 */
export interface RewardConfig {
  rewardToken: Address;
  merchant: Address;
}

/**
 * RewardHook contract addresses by network (from environment variables)
 * Environment variable format: VITE_{NETWORK}_{HOOK}_ADDRESS
 */
function getRewardHookAddresses(): Record<string, Address> {
  return {
    "base-sepolia": (import.meta.env.VITE_BASE_SEPOLIA_REWARD_HOOK_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
    "xlayer-testnet": (import.meta.env.VITE_X_LAYER_TESTNET_REWARD_HOOK_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  };
}

/**
 * Reward token addresses by network (from environment variables)
 * Environment variable format: VITE_{NETWORK}_REWARD_TOKEN_ADDRESS
 */
function getRewardTokenAddresses(): Record<string, Address> {
  return {
    "base-sepolia": (import.meta.env.VITE_BASE_SEPOLIA_REWARD_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
    "xlayer-testnet": (import.meta.env.VITE_X_LAYER_TESTNET_REWARD_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  };
}

/**
 * RewardHook utility class for showcase
 */
export class RewardHook {
  /**
   * Get RewardHook contract address for a network
   * @throws Error if address not configured for the network
   */
  static getAddress(network: string): Address {
    const addresses = getRewardHookAddresses();
    const address = addresses[network];
    
    if (!address || address === "0x0000000000000000000000000000000000000000") {
      const envVarName = network === 'base-sepolia' 
        ? 'VITE_BASE_SEPOLIA_REWARD_HOOK_ADDRESS'
        : 'VITE_X_LAYER_TESTNET_REWARD_HOOK_ADDRESS';
      throw new Error(
        `RewardHook address not configured for network "${network}". ` +
        `Please set ${envVarName} in .env file.`
      );
    }
    
    return address;
  }

  /**
   * Get reward token address for a network
   * @throws Error if address not configured for the network
   */
  static getTokenAddress(network: string): Address {
    const addresses = getRewardTokenAddresses();
    const address = addresses[network];
    
    if (!address || address === "0x0000000000000000000000000000000000000000") {
      const envVarName = network === 'base-sepolia' 
        ? 'VITE_BASE_SEPOLIA_REWARD_TOKEN_ADDRESS'
        : 'VITE_X_LAYER_TESTNET_REWARD_TOKEN_ADDRESS';
      throw new Error(
        `Reward token address not configured for network "${network}". ` +
        `Please set ${envVarName} in .env file.`
      );
    }
    
    return address;
  }

  /**
   * Encode RewardConfig for hookData
   * 
   * The RewardHook expects ABI-encoded RewardConfig struct:
   * ```solidity
   * struct RewardConfig {
   *   address rewardToken;
   *   address merchant;
   * }
   * ```
   */
  static encode(config: RewardConfig): `0x${string}` {
    return encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "rewardToken", type: "address" },
            { name: "merchant", type: "address" },
          ],
        },
      ],
      [
        {
          rewardToken: config.rewardToken,
          merchant: config.merchant,
        },
      ],
    );
  }
}

