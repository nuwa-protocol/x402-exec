/**
 * Scenario 3: Points Reward
 * Generates payment requirements for reward point distribution
 */

import { appConfig, getNetworkConfig, getUsdcDomainForNetwork } from '../config.js';
import { encodeRewardData } from '../utils/hookData.js';
import { generateSalt } from '../utils/commitment.js';
import { ethers } from 'ethers';

/**
 * Gets remaining reward points from contract
 * @param network Network to query
 * @returns Remaining points available
 */
async function getRemainingRewards(network: string = appConfig.defaultNetwork): Promise<string> {
  try {
    const networkConfig = getNetworkConfig(network);
    const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl);
    const abi = ['function remainingRewards() view returns (uint256)'];
    const contract = new ethers.Contract(networkConfig.rewardTokenAddress, abi, provider);
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
  network?: string;
}

/**
 * Generates payment requirements for reward points
 * @param params Parameters including merchant address
 * @returns Payment requirements object
 */
export async function generateRewardPayment(params: RewardParams = {}) {
  const { merchantAddress, resource, network = appConfig.defaultNetwork } = params;
  const networkConfig = getNetworkConfig(network);
  
  const remaining = await getRemainingRewards(network);
  
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
    rewardToken: networkConfig.rewardTokenAddress,
    merchant
  });
  
  // Generate unique salt for this settlement
  const salt = generateSalt();
  
  // Get correct USDC domain info for the network
  const usdcDomain = getUsdcDomainForNetwork(network);
  
  // Facilitator fee (0.01 USDC = 10000 in 6 decimals)
  const facilitatorFee = '10000';
  
  return {
    scheme: 'exact' as const,
    network: network as any, // Cast to any to resolve type incompatibility
    maxAmountRequired: '100000', // 0.1 USDC
    asset: networkConfig.usdcAddress,
    payTo: networkConfig.settlementRouterAddress,
    resource: resource || '/api/scenario-3/payment', // Use provided resource or fallback
    description: `Points Reward: Pay $0.1 and receive 1000 reward points on ${network}`,
    mimeType: 'application/json',
    maxTimeoutSeconds: 3600, // 1 hour validity window (total 70 min with validAfter offset)
    extra: {
      // Required for EIP-712 signature (USDC contract domain)
      name: usdcDomain.name,
      version: usdcDomain.version,
      // Settlement-specific data
      settlementRouter: networkConfig.settlementRouterAddress,
      salt,
      payTo: appConfig.resourceServerAddress, // Resource server's address as the final recipient
      facilitatorFee,
      hook: networkConfig.rewardHookAddress,
      hookData,
      rewardAmount: '1000', // Points earned
    },
  };
}

/**
 * Get scenario information for all supported networks
 */
export async function getScenarioInfo() {
  const supportedNetworks = Object.keys(appConfig.networks);
  const networkInfo: Record<string, any> = {};
  
  // Get reward info for each network
  for (const network of supportedNetworks) {
    try {
      const remaining = await getRemainingRewards(network);
      
      networkInfo[network] = {
        reward: {
          token: 'Reward Points',
          symbol: 'POINTS',
          amountPerPayment: '1000',
          totalSupply: '1000000',
          remaining,
        },
      };
    } catch (error) {
      console.warn(`Failed to get reward info for network ${network}:`, error);
      // Fallback info for networks that might not have contracts deployed
      networkInfo[network] = {
        reward: {
          token: 'Reward Points',
          symbol: 'POINTS',
          amountPerPayment: '1000',
          totalSupply: '1000000',
          remaining: '1000000',
        },
      };
    }
  }
  
  return {
    id: 3,
    name: 'Points Reward',
    description: 'Earn reward points on payment',
    price: '$0.1 USDC',
    networks: networkInfo,
    // Keep legacy format for backward compatibility
    reward: networkInfo[appConfig.defaultNetwork]?.reward || {
      token: 'Reward Points',
      symbol: 'POINTS',
      amountPerPayment: '1000',
      totalSupply: '1000000',
      remaining: '1000000',
    },
  };
}

