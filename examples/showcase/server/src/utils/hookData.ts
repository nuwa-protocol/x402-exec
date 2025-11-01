/**
 * Utility functions for encoding hook data
 * All hook data must be ABI-encoded according to the hook's expectations
 */

import { ethers } from 'ethers';

/**
 * Split configuration for revenue splitting
 */
export interface Split {
  recipient: string;
  bips: number; // Basis points (1-10000)
}

/**
 * NFT mint configuration
 */
export interface MintConfig {
  nftContract: string;
  tokenId: number;
  recipient: string;
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
 * Encodes split array for RevenueSplitHook
 * @param splits Array of split configurations
 * @returns Hex-encoded hook data
 */
export function encodeRevenueSplitData(splits: Split[]): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ['tuple(address recipient, uint16 bips)[]'],
    [splits]
  );
  return encoded;
}

/**
 * Encodes NFT mint configuration for NFTMintHook
 * @param config Mint configuration
 * @returns Hex-encoded hook data
 */
export function encodeNFTMintData(config: MintConfig): string {
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(
    ['tuple(address nftContract, uint256 tokenId, address recipient, address merchant)'],
    [[config.nftContract, config.tokenId, config.recipient, config.merchant]]
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
    ['tuple(address rewardToken, address merchant)'],
    [[config.rewardToken, config.merchant]]
  );
  return encoded;
}

/**
 * Validates Ethereum address format
 * @param address Address to validate
 * @returns true if valid
 */
export function isValidAddress(address: string): boolean {
  return ethers.isAddress(address);
}

