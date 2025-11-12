/**
 * NFTMintHook Utilities for Showcase
 *
 * This is an example implementation showing how to work with the NFTMintHook contract.
 * It demonstrates:
 * - How to encode hookData for NFT minting scenarios
 * - How to manage network-specific contract addresses
 * - How to integrate with the x402x settlement flow
 *
 * ⚠️ This is a showcase example, not part of the core SDK.
 * When building your own app, you can use this as a reference.
 *
 * @see contracts/examples/nft-mint/NFTMintHook.sol for contract implementation
 * @example
 * ```typescript
 * // Encode hookData for NFT minting
 * const hookData = NFTMintHook.encode({
 *   nftContract: '0x...',
 * });
 *
 * // The merchant address is passed via the `recipient` parameter in execute()
 * // The hook will transfer payment to `recipient` (merchant) and mint NFT to payer
 * ```
 */

import { encodeAbiParameters } from "viem";
import type { Address } from "viem";

/**
 * NFT Mint Configuration
 *
 * Defines the parameters needed to mint an NFT during payment settlement.
 *
 * Note: After refactoring, the merchant address is passed via the `recipient`
 * parameter in the execute call, not in hookData. This simplifies the encoding
 * and makes it consistent with the SettlementRouter's `payTo` parameter.
 */
export interface MintConfig {
  /** Address of the NFT contract to mint from */
  nftContract: Address;
}

/**
 * NFTMintHook contract addresses by network
 *
 * Reads contract addresses from environment variables.
 * Environment variable format: VITE_{NETWORK}_{HOOK}_ADDRESS
 */
function getNFTMintHookAddresses(): Record<string, Address> {
  return {
    "base-sepolia": (import.meta.env.VITE_BASE_SEPOLIA_NFT_MINT_HOOK_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as Address,
    "x-layer-testnet": (import.meta.env.VITE_X_LAYER_TESTNET_NFT_MINT_HOOK_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as Address,
    base: (import.meta.env.VITE_BASE_NFT_MINT_HOOK_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as Address,
    "x-layer": (import.meta.env.VITE_X_LAYER_NFT_MINT_HOOK_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as Address,
  };
}

/**
 * Random NFT contract addresses by network
 *
 * Reads NFT contract addresses from environment variables.
 * Environment variable format: VITE_{NETWORK}_RANDOM_NFT_ADDRESS
 */
function getRandomNFTAddresses(): Record<string, Address> {
  return {
    "base-sepolia": (import.meta.env.VITE_BASE_SEPOLIA_RANDOM_NFT_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as Address,
    "x-layer-testnet": (import.meta.env.VITE_X_LAYER_TESTNET_RANDOM_NFT_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as Address,
    base: (import.meta.env.VITE_BASE_RANDOM_NFT_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as Address,
    "x-layer": (import.meta.env.VITE_X_LAYER_RANDOM_NFT_ADDRESS ||
      "0x0000000000000000000000000000000000000000") as Address,
  };
}

/**
 * NFTMintHook utility class for showcase examples
 *
 * Provides helper methods to work with NFTMintHook contracts.
 */
export class NFTMintHook {
  /**
   * Get NFTMintHook contract address for a specific network
   *
   * @param network - Network identifier (e.g., 'base-sepolia', 'x-layer-testnet')
   * @returns The contract address for the specified network
   * @throws Error if address not configured for the network
   */
  static getAddress(network: string): Address {
    const addresses = getNFTMintHookAddresses();
    const address = addresses[network];

    if (!address || address === "0x0000000000000000000000000000000000000000") {
      let envVarName: string;
      switch (network) {
        case "base-sepolia":
          envVarName = "VITE_BASE_SEPOLIA_NFT_MINT_HOOK_ADDRESS";
          break;
        case "x-layer-testnet":
          envVarName = "VITE_X_LAYER_TESTNET_NFT_MINT_HOOK_ADDRESS";
          break;
        case "base":
          envVarName = "VITE_BASE_NFT_MINT_HOOK_ADDRESS";
          break;
        case "x-layer":
          envVarName = "VITE_X_LAYER_NFT_MINT_HOOK_ADDRESS";
          break;
        default:
          envVarName = `VITE_${network.toUpperCase().replace(/-/g, "_")}_NFT_MINT_HOOK_ADDRESS`;
      }
      throw new Error(
        `NFTMintHook address not configured for network "${network}". ` +
          `Please set ${envVarName} in .env file.`,
      );
    }

    return address;
  }

  /**
   * Get the NFT contract address for a specific network
   *
   * This is the address of the ERC721 contract that will be minted from.
   *
   * @param network - Network identifier (e.g., 'base-sepolia', 'x-layer-testnet')
   * @returns The NFT contract address for the specified network
   * @throws Error if address not configured for the network
   */
  static getNFTContractAddress(network: string): Address {
    const addresses = getRandomNFTAddresses();
    const address = addresses[network];

    if (!address || address === "0x0000000000000000000000000000000000000000") {
      let envVarName: string;
      switch (network) {
        case "base-sepolia":
          envVarName = "VITE_BASE_SEPOLIA_RANDOM_NFT_ADDRESS";
          break;
        case "x-layer-testnet":
          envVarName = "VITE_X_LAYER_TESTNET_RANDOM_NFT_ADDRESS";
          break;
        case "base":
          envVarName = "VITE_BASE_RANDOM_NFT_ADDRESS";
          break;
        case "x-layer":
          envVarName = "VITE_X_LAYER_RANDOM_NFT_ADDRESS";
          break;
        default:
          envVarName = `VITE_${network.toUpperCase().replace(/-/g, "_")}_RANDOM_NFT_ADDRESS`;
      }
      throw new Error(
        `Random NFT contract address not configured for network "${network}". ` +
          `Please set ${envVarName} in .env file.`,
      );
    }

    return address;
  }

  /**
   * Encode MintConfig into hookData for NFTMintHook
   *
   * The NFTMintHook contract expects a specific ABI-encoded struct format.
   * This method handles the encoding for you.
   *
   * After refactoring, the config only contains the NFT contract address.
   * The merchant address is passed via the `recipient` parameter in execute().
   *
   * @param config - The mint configuration
   * @returns ABI-encoded hookData ready to use with x402x execute
   *
   * @example
   * ```typescript
   * const hookData = NFTMintHook.encode({
   *   nftContract: '0x123...'
   * });
   *
   * // Use with x402x client
   * await client.execute({
   *   hook: NFTMintHook.getAddress('base-sepolia'),
   *   hookData,
   *   amount: '100000',
   *   recipient: merchantAddress  // ← Merchant receives payment here
   * });
   * // NFT is minted to the payer, payment goes to merchant
   * ```
   */
  static encode(config: MintConfig): `0x${string}` {
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
