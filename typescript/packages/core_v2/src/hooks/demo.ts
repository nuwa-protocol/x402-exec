/**
 * Demo hooks utilities for showcase examples
 *
 * Provides encoding/decoding and address lookup for demo hooks used in showcase examples.
 * These hooks are optional and may not be deployed on all networks.
 */

import { encodeAbiParameters } from "viem";
import type { Address } from "viem";
import { getNetworkConfig } from "../networks.js";

/**
 * NFT Mint Configuration
 */
export interface MintConfig {
  /** Address of the NFT contract to mint from */
  nftContract: Address;
}

/**
 * Reward Hook Configuration
 */
export interface RewardConfig {
  /** Address of the ERC20 reward token contract */
  rewardToken: Address;
}

/**
 * NFTMintHook utilities for showcase examples
 */
export namespace NFTMintHook {
  /**
   * Get NFTMintHook contract address for a specific network
   *
   * @param network - Network identifier (e.g., 'base-sepolia', 'skale-base-sepolia')
   * @returns The contract address for the specified network
   * @throws Error if demo hooks are not configured for the network
   */
  export function getAddress(network: string): `0x${string}` {
    const config = getNetworkConfig(network);
    if (!config.demoHooks?.nftMint) {
      throw new Error(
        `NFTMintHook not configured for network "${network}". Demo hooks are optional and may not be deployed on all networks.`,
      );
    }
    return config.demoHooks.nftMint as `0x${string}`;
  }

  /**
   * Get the NFT contract address for a specific network
   *
   * This is the address of the ERC721 contract that will be minted from.
   *
   * @param network - Network identifier (e.g., 'base-sepolia', 'skale-base-sepolia')
   * @returns The NFT contract address for the specified network
   * @throws Error if demo hooks are not configured for the network
   */
  export function getNFTContractAddress(network: string): `0x${string}` {
    const config = getNetworkConfig(network);
    if (!config.demoHooks?.randomNFT) {
      throw new Error(
        `RandomNFT contract not configured for network "${network}". Demo hooks are optional and may not be deployed on all networks.`,
      );
    }
    return config.demoHooks.randomNFT as `0x${string}`;
  }

  /**
   * Encode MintConfig into hookData for NFTMintHook
   *
   * The NFTMintHook contract expects a specific ABI-encoded struct format.
   * This method handles the encoding for you.
   *
   * @param config - The mint configuration
   * @returns ABI-encoded hookData ready to use with x402x execute
   */
  export function encode(config: MintConfig): `0x${string}` {
    // Encode as tuple matching the Solidity struct:
    // struct MintConfig {
    //   address nftContract;
    // }
    return encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [{ name: "nftContract", type: "address" }],
        },
      ],
      [
        {
          nftContract: config.nftContract,
        },
      ],
    );
  }
}

/**
 * RewardHook utilities for showcase examples
 */
export namespace RewardHook {
  /**
   * Get RewardHook contract address for a specific network
   *
   * @param network - Network identifier (e.g., 'base-sepolia', 'skale-base-sepolia')
   * @returns The contract address for the specified network
   * @throws Error if demo hooks are not configured for the network
   */
  export function getAddress(network: string): `0x${string}` {
    const config = getNetworkConfig(network);
    if (!config.demoHooks?.reward) {
      throw new Error(
        `RewardHook not configured for network "${network}". Demo hooks are optional and may not be deployed on all networks.`,
      );
    }
    return config.demoHooks.reward as `0x${string}`;
  }

  /**
   * Get the reward token (ERC20) address for a specific network
   *
   * This is the address of the ERC20 contract that will be distributed as rewards.
   *
   * @param network - Network identifier (e.g., 'base-sepolia', 'skale-base-sepolia')
   * @returns The reward token contract address for the specified network
   * @throws Error if demo hooks are not configured for the network
   */
  export function getTokenAddress(network: string): `0x${string}` {
    const config = getNetworkConfig(network);
    if (!config.demoHooks?.rewardToken) {
      throw new Error(
        `Reward token not configured for network "${network}". Demo hooks are optional and may not be deployed on all networks.`,
      );
    }
    return config.demoHooks.rewardToken as `0x${string}`;
  }

  /**
   * Encode RewardConfig into hookData for RewardHook
   *
   * The RewardHook contract expects a specific ABI-encoded struct format.
   * This method handles the encoding for you.
   *
   * @param config - The reward configuration
   * @returns ABI-encoded hookData ready to use with x402x execute
   */
  export function encode(config: RewardConfig): `0x${string}` {
    // Encode as tuple matching the Solidity struct:
    // struct RewardConfig {
    //   address rewardToken;
    // }
    return encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [{ name: "rewardToken", type: "address" }],
        },
      ],
      [
        {
          rewardToken: config.rewardToken,
        },
      ],
    );
  }
}
