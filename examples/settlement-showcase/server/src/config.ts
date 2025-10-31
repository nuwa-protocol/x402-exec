/**
 * Configuration loader for Settlement Showcase server
 * Loads and validates environment variables
 */

import { config } from 'dotenv';
config();

export interface Config {
  port: number;
  network: string;
  rpcUrl: string;
  facilitatorUrl: string;
  
  // Contract addresses
  settlementRouterAddress: string;
  revenueSplitHookAddress: string;
  nftMintHookAddress: string;
  randomNFTAddress: string;
  rewardTokenAddress: string;
  rewardHookAddress: string;
  usdcAddress: string;
  
  // Resource server configuration
  resourceServerAddress: string;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const appConfig: Config = {
  port: parseInt(process.env.PORT || '3001'),
  network: getRequiredEnv('NETWORK'),
  rpcUrl: getRequiredEnv('RPC_URL'),
  facilitatorUrl: getRequiredEnv('FACILITATOR_URL'),
  
  // Contract addresses
  settlementRouterAddress: getRequiredEnv('SETTLEMENT_ROUTER_ADDRESS'),
  revenueSplitHookAddress: getRequiredEnv('REVENUE_SPLIT_HOOK_ADDRESS'),
  nftMintHookAddress: getRequiredEnv('NFT_MINT_HOOK_ADDRESS'),
  randomNFTAddress: getRequiredEnv('RANDOM_NFT_ADDRESS'),
  rewardTokenAddress: getRequiredEnv('REWARD_TOKEN_ADDRESS'),
  rewardHookAddress: getRequiredEnv('REWARD_HOOK_ADDRESS'),
  usdcAddress: getRequiredEnv('USDC_ADDRESS'),
  
  // Resource server configuration
  resourceServerAddress: getRequiredEnv('RESOURCE_SERVER_ADDRESS'),
};

