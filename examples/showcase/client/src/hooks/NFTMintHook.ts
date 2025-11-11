/**
 * NFTMintHook utilities for showcase
 * 
 * Helper functions for encoding hookData for NFTMintHook contract.
 * This is a showcase example, not part of the core SDK.
 * 
 * @see contracts/examples/nft-mint/NFTMintHook.sol
 */

import { encodeAbiParameters } from "viem";
import type { Address } from "viem";

/**
 * NFT Mint configuration
 */
export interface MintConfig {
  nftContract: Address;
  tokenId: bigint;
  merchant: Address;
}

/**
 * NFTMintHook contract addresses by network (from environment variables)
 * Environment variable format: VITE_{NETWORK}_{HOOK}_ADDRESS
 */
function getNFTMintHookAddresses(): Record<string, Address> {
  return {
    "base-sepolia": (import.meta.env.VITE_BASE_SEPOLIA_NFT_MINT_HOOK_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
    "xlayer-testnet": (import.meta.env.VITE_X_LAYER_TESTNET_NFT_MINT_HOOK_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  };
}

/**
 * Random NFT contract addresses by network (from environment variables)
 * Environment variable format: VITE_{NETWORK}_RANDOM_NFT_ADDRESS
 */
function getRandomNFTAddresses(): Record<string, Address> {
  return {
    "base-sepolia": (import.meta.env.VITE_BASE_SEPOLIA_RANDOM_NFT_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
    "xlayer-testnet": (import.meta.env.VITE_X_LAYER_TESTNET_RANDOM_NFT_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  };
}

/**
 * NFTMintHook utility class for showcase
 */
export class NFTMintHook {
  /**
   * Get NFTMintHook contract address for a network
   * @throws Error if address not configured for the network
   */
  static getAddress(network: string): Address {
    const addresses = getNFTMintHookAddresses();
    const address = addresses[network];
    
    if (!address || address === "0x0000000000000000000000000000000000000000") {
      const envVarName = network === 'base-sepolia' 
        ? 'VITE_BASE_SEPOLIA_NFT_MINT_HOOK_ADDRESS'
        : 'VITE_X_LAYER_TESTNET_NFT_MINT_HOOK_ADDRESS';
      throw new Error(
        `NFTMintHook address not configured for network "${network}". ` +
        `Please set ${envVarName} in .env file.`
      );
    }
    
    return address;
  }

  /**
   * Get Random NFT contract address for a network
   * @throws Error if address not configured for the network
   */
  static getNFTContractAddress(network: string): Address {
    const addresses = getRandomNFTAddresses();
    const address = addresses[network];
    
    if (!address || address === "0x0000000000000000000000000000000000000000") {
      const envVarName = network === 'base-sepolia' 
        ? 'VITE_BASE_SEPOLIA_RANDOM_NFT_ADDRESS'
        : 'VITE_X_LAYER_TESTNET_RANDOM_NFT_ADDRESS';
      throw new Error(
        `Random NFT contract address not configured for network "${network}". ` +
        `Please set ${envVarName} in .env file.`
      );
    }
    
    return address;
  }

  /**
   * Encode MintConfig for hookData
   * 
   * The NFTMintHook expects ABI-encoded MintConfig struct:
   * ```solidity
   * struct MintConfig {
   *   address nftContract;
   *   uint256 tokenId;
   *   address merchant;
   * }
   * ```
   */
  static encode(config: MintConfig): `0x${string}` {
    return encodeAbiParameters(
      [
        {
          type: "tuple",
          components: [
            { name: "nftContract", type: "address" },
            { name: "tokenId", type: "uint256" },
            { name: "merchant", type: "address" },
          ],
        },
      ],
      [
        {
          nftContract: config.nftContract,
          tokenId: config.tokenId,
          merchant: config.merchant,
        },
      ],
    );
  }
}

