/**
 * Utility functions for encoding hook data
 * All hook data must be ABI-encoded according to the hook's expectations
 */

import { ethers } from "ethers";

/**
 * NFT mint configuration
 */
export interface MintConfig {
  nftContract: string;
  tokenId: number;
  merchant: string;
}

/**
 * Reward configuration
 */
export interface RewardConfig {
  rewardToken: string;
  merchant: string;
}

/**
 * Encodes NFT mint configuration for NFTMintHook
 * @param config Mint configuration
 * @returns Hex-encoded hook data
 */
export function encodeNFTMintData(config: MintConfig): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ["tuple(address nftContract, uint256 tokenId, address merchant)"],
    [[config.nftContract, config.tokenId, config.merchant]],
  );
  return encoded;
}

/**
 * Encodes reward configuration for RewardHook
 * @param config Reward configuration
 * @returns Hex-encoded hook data
 */
export function encodeRewardData(config: RewardConfig): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ["tuple(address rewardToken, address merchant)"],
    [[config.rewardToken, config.merchant]],
  );
  return encoded;
}

/**
 * Decodes NFT mint configuration from hookData
 * @param hookData Hex-encoded hook data
 * @returns Decoded mint configuration
 */
export function decodeNFTMintData(hookData: string): MintConfig {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const [decoded] = abiCoder.decode(
    ["tuple(address nftContract, uint256 tokenId, address merchant)"],
    hookData,
  );
  return {
    nftContract: decoded[0],
    tokenId: Number(decoded[1]),
    merchant: decoded[2],
  };
}

/**
 * Validates Ethereum address format
 * @param address Address to validate
 * @returns true if valid
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}
