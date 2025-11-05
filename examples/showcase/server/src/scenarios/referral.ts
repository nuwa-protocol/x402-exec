/**
 * Scenario 1: Referral Split
 * Generates payment requirements for 3-way split (merchant + referrer + platform)
 * 
 * Simplified using @x402x/core utilities
 */

import { appConfig, getNetworkConfig } from '../config.js';
import { encodeRevenueSplitData, isValidAddress } from '../utils/hookData.js';
import { PaymentRequirements } from 'x402/types';
import { addSettlementExtra } from '@x402x/core';

export interface ReferralSplitParams {
  referrer?: string;
  merchantAddress?: string;
  platformAddress?: string;
  resource?: string;
  network?: string;
}

/**
 * Generates payment requirements for referral split scenario
 * @param params Parameters including referrer, merchant, and platform addresses
 * @returns Payment requirements object
 */
export function generateReferralPayment(params: ReferralSplitParams = {}): PaymentRequirements {
  const { referrer, merchantAddress, platformAddress, resource, network = appConfig.defaultNetwork } = params;
  const networkConfig = getNetworkConfig(network);
  
  // Use provided addresses or fallback to defaults
  const merchant = merchantAddress || '0x1111111111111111111111111111111111111111';
  const platform = platformAddress || '0x2222222222222222222222222222222222222222';
  const actualReferrer = referrer || '0x1111111111111111111111111111111111111111';
  
  // Validate addresses
  if (!isValidAddress(merchant)) {
    throw new Error('Invalid merchant address');
  }
  if (!isValidAddress(platform)) {
    throw new Error('Invalid platform address');
  }
  if (!isValidAddress(actualReferrer)) {
    throw new Error('Invalid referrer address');
  }
  
  // Define splits: 70% merchant, 20% referrer, 10% platform
  const splits = [
    { recipient: merchant, bips: 7000 }, // 70%
    { recipient: actualReferrer, bips: 2000 }, // 20%
    { recipient: platform, bips: 1000 }, // 10%
  ];
  
  // Encode hook data
  const hookData = encodeRevenueSplitData(splits);
  
  // Facilitator fee (0.01 USDC = 10000 in 6 decimals)
  const facilitatorFee = '10000';
  
  // Build base PaymentRequirements (standard x402 format)
  const baseRequirements: PaymentRequirements = {
    scheme: 'exact',
    network: network as any,
    maxAmountRequired: '100000', // 0.1 USDC (6 decimals)
    asset: networkConfig.usdcAddress,
    payTo: networkConfig.settlementRouterAddress,
    resource: resource || '/api/scenario-1/payment',
    description: `Referral Split: Pay $0.1 and split among merchant, referrer, and platform on ${network}`,
    mimeType: 'application/json',
    maxTimeoutSeconds: 3600, // 1 hour validity window
  };
  
  // Add settlement extension using SDK helper
  // This automatically adds: settlementRouter, salt, name, version
  return addSettlementExtra(baseRequirements, {
    hook: networkConfig.revenueSplitHookAddress,
    hookData,
    facilitatorFee,
    payTo: appConfig.resourceServerAddress,
  });
}

/**
 * Get scenario information
 */
export function getScenarioInfo() {
  return {
    id: 1,
    name: 'Referral Split',
    description: 'Multi-party revenue split with referrer rewards',
    price: '$0.1 USDC',
    splits: [
      { party: 'Merchant', percentage: '70%' },
      { party: 'Referrer', percentage: '20%' },
      { party: 'Platform', percentage: '10%' },
    ],
  };
}
