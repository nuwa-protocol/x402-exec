/**
 * Scenario 1: Referral Split
 * Generates payment requirements for 3-way split (merchant + referrer + platform)
 */

import { appConfig } from '../config.js';
import { encodeRevenueSplitData, isValidAddress } from '../utils/hookData.js';
import { generateSalt } from '../utils/commitment.js';
import { PaymentRequirements } from 'x402/types';

export interface ReferralSplitParams {
  referrer?: string;
  merchantAddress?: string;
  platformAddress?: string;
  resource?: string;
}

/**
 * Generates payment requirements for referral split scenario
 * @param params Parameters including referrer, merchant, and platform addresses
 * @returns Payment requirements object
 */
export function generateReferralPayment(params: ReferralSplitParams = {}): PaymentRequirements {
  const { referrer, merchantAddress, platformAddress, resource } = params;
  
  // Use provided addresses or fallback to defaults
  const merchant = merchantAddress || '0x1111111111111111111111111111111111111111';
  const platform = platformAddress || '0x2222222222222222222222222222222222222222'; // Use all 2s instead of all 0s
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
  
  // Generate unique salt for this settlement
  const salt = generateSalt();
  
  // Facilitator fee (0.01 USDC = 10000 in 6 decimals)
  const facilitatorFee = '10000';
  
  // Return standard x402 PaymentRequirements format
  return {
    scheme: 'exact',
    network: appConfig.network as any,
    maxAmountRequired: '100000', // 0.1 USDC (6 decimals)
    asset: appConfig.usdcAddress,
    payTo: appConfig.settlementHubAddress,
    resource: resource || '/api/scenario-1/payment', // Use provided resource or fallback
    description: 'Referral Split: Pay $0.1 and split among merchant, referrer, and platform',
    mimeType: 'application/json',
    maxTimeoutSeconds: 600, // 10 minutes validity window (total 20 min with validAfter offset)
    extra: {
      // Required for EIP-712 signature (USDC contract domain)
      name: 'USDC',
      version: '2',
      // Settlement-specific data for SettlementHub
      settlementHub: appConfig.settlementHubAddress,
      salt,
      payTo: merchant, // Primary recipient for this scenario
      facilitatorFee,
      hook: appConfig.revenueSplitHookAddress,
      hookData,
    },
  };
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

