/**
 * RewardHook Utilities for Showcase
 * 
 * This is an example implementation showing how to work with the RewardHook contract.
 * It demonstrates:
 * - How to encode hookData for loyalty rewards scenarios
 * - How to manage network-specific contract addresses
 * - How to integrate reward distribution with payments
 * 
 * ⚠️ This is a showcase example, not part of the core SDK. 
 * When building your own app, you can use this as a reference.
 * 
 * @see contracts/examples/reward-points/RewardHook.sol for contract implementation
 * @example
 * ```typescript
 * // Encode hookData for reward distribution
 * const hookData = RewardHook.encode({
 *   rewardToken: '0x...',
 *   merchant: '0x...',
 * });
 * ```
 */

import { encodeAbiParameters } from "viem";
import type { Address } from "viem";

/**
 * Reward Hook Configuration
 * 
 * Defines the parameters needed to distribute rewards during payment settlement.
 */
export interface RewardConfig {
  /** Address of the ERC20 reward token contract */
  rewardToken: Address;
  /** Address that receives the payment (merchant) */
  merchant: Address;
}

/**
 * RewardHook contract addresses by network
 * 
 * Reads contract addresses from environment variables.
 * Environment variable format: VITE_{NETWORK}_{HOOK}_ADDRESS
 */
function getRewardHookAddresses(): Record<string, Address> {
  return {
    "base-sepolia": (import.meta.env.VITE_BASE_SEPOLIA_REWARD_HOOK_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
    "xlayer-testnet": (import.meta.env.VITE_X_LAYER_TESTNET_REWARD_HOOK_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  };
}

/**
 * Reward token addresses by network
 * 
 * Reads ERC20 reward token addresses from environment variables.
 * Environment variable format: VITE_{NETWORK}_REWARD_TOKEN_ADDRESS
 */
function getRewardTokenAddresses(): Record<string, Address> {
  return {
    "base-sepolia": (import.meta.env.VITE_BASE_SEPOLIA_REWARD_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
    "xlayer-testnet": (import.meta.env.VITE_X_LAYER_TESTNET_REWARD_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  };
}

/**
 * RewardHook utility class for showcase examples
 * 
 * Provides helper methods to work with RewardHook contracts.
 */
export class RewardHook {
  /**
   * Get RewardHook contract address for a specific network
   * 
   * @param network - Network identifier (e.g., 'base-sepolia', 'xlayer-testnet')
   * @returns The contract address for the specified network
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
   * Get the reward token (ERC20) address for a specific network
   * 
   * This is the address of the ERC20 contract that will be distributed as rewards.
   * 
   * @param network - Network identifier (e.g., 'base-sepolia', 'xlayer-testnet')
   * @returns The reward token contract address for the specified network
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
   * Encode RewardConfig into hookData for RewardHook
   * 
   * The RewardHook contract expects a specific ABI-encoded struct format.
   * This method handles the encoding for you.
   * 
   * @param config - The reward configuration
   * @returns ABI-encoded hookData ready to use with x402x execute
   * 
   * @example
   * ```typescript
   * const hookData = RewardHook.encode({
   *   rewardToken: '0x123...',
   *   merchant: '0xabc...'
   * });
   * 
   * // Use with x402x client
   * await client.execute({
   *   hook: RewardHook.getAddress('base-sepolia'),
   *   hookData,
   *   amount: '100000',
   *   recipient: merchantAddress
   * });
   * // Payer automatically receives reward tokens!
   * ```
   */
  static encode(config: RewardConfig): `0x${string}` {
    // Encode as tuple matching the Solidity struct:
    // struct RewardConfig {
    //   address rewardToken;
    //   address merchant;
    // }
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

