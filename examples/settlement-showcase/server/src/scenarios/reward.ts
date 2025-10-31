/**
 * Scenario 3: Points Reward
 * Generates payment requirements for reward point distribution
 */

import { appConfig } from '../config.js';
import { encodeRewardData } from '../utils/hookData.js';
import { generateSalt } from '../utils/commitment.js';
import { ethers } from 'ethers';

/**
 * Gets remaining reward points from contract
 * @returns Remaining points available
 */
async function getRemainingRewards(): Promise<string> {
  try {
    const provider = new ethers.JsonRpcProvider(appConfig.rpcUrl);
    const abi = ['function remainingRewards() view returns (uint256)'];
    const contract = new ethers.Contract(appConfig.rewardTokenAddress, abi, provider);
    const remaining = await contract.remainingRewards();
    return ethers.formatEther(remaining);
  } catch (error) {
    console.error('Error fetching remaining rewards:', error);
    return '1000000'; // Fallback to max supply
  }
}

export interface RewardParams {
  merchantAddress?: string;
  resource?: string;
}

/**
 * Generates payment requirements for reward points
 * @param params Parameters including merchant address
 * @returns Payment requirements object
 */
export async function generateRewardPayment(params: RewardParams = {}) {
  const { merchantAddress, resource } = params;
  
  const remaining = await getRemainingRewards();
  
  // Check if rewards are depleted
  if (parseFloat(remaining) < 1000) {
    throw new Error('Insufficient reward points remaining');
  }
  
  // Use provided merchant address or fallback to default
  const merchant = merchantAddress || '0x1111111111111111111111111111111111111111';
  
  if (!ethers.isAddress(merchant)) {
    throw new Error('Invalid merchant address');
  }
  
  // Encode hook data (reward config with token and merchant addresses)
  const hookData = encodeRewardData({
    rewardToken: appConfig.rewardTokenAddress,
    merchant
  });
  
  // Generate unique salt for this settlement
  const salt = generateSalt();
  
  // Facilitator fee (0.01 USDC = 10000 in 6 decimals)
  const facilitatorFee = '10000';
  
  return {
    scheme: 'exact' as const,
    network: appConfig.network as any, // Cast to any to resolve type incompatibility
    maxAmountRequired: '100000', // 0.1 USDC
    asset: appConfig.usdcAddress,
    payTo: appConfig.settlementRouterAddress,
    resource: resource || '/api/scenario-3/payment', // Use provided resource or fallback
    description: 'Points Reward: Pay $0.1 and receive 1000 reward points',
    mimeType: 'application/json',
    maxTimeoutSeconds: 600, // 10 minutes validity window (total 20 min with validAfter offset)
    extra: {
      // Required for EIP-712 signature (USDC contract domain)
      name: 'USDC',
      version: '2',
      // Settlement-specific data
      settlementRouter: appConfig.settlementRouterAddress,
      salt,
      payTo: appConfig.resourceServerAddress, // Resource server's address as the final recipient
      facilitatorFee,
      hook: appConfig.rewardHookAddress,
      hookData,
      rewardAmount: '1000', // Points earned
    },
  };
}

/**
 * Get scenario information
 */
export async function getScenarioInfo() {
  const remaining = await getRemainingRewards();
  
  return {
    id: 3,
    name: 'Points Reward',
    description: 'Earn reward points on payment',
    price: '$0.1 USDC',
    reward: {
      token: 'Reward Points',
      symbol: 'POINTS',
      amountPerPayment: '1000',
      totalSupply: '1000000',
      remaining,
    },
  };
}

