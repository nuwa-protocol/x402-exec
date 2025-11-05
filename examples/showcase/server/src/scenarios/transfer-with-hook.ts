/**
 * Transfer with Hook Scenario
 * Basic x402x settlement using TransferHook with facilitator fee support
 * This is the entry-level scenario for understanding x402x settlement
 */

import { appConfig, getNetworkConfig, getUsdcDomainForNetwork } from '../config.js';
import { PaymentRequirements } from 'x402/types';
import { generateSalt } from '../utils/commitment.js';

export interface TransferWithHookParams {
  resource?: string;
  network?: string;
}

/**
 * Generates payment requirements for transfer with hook scenario
 * @param params Parameters including resource URL and network
 * @returns Payment requirements object
 */
export function generateTransferWithHook(params: TransferWithHookParams = {}): PaymentRequirements {
  const { resource, network = appConfig.defaultNetwork } = params;
  const networkConfig = getNetworkConfig(network);
  
  // Validate TransferHook address is configured
  if (!networkConfig.transferHookAddress) {
    throw new Error(`TransferHook address not configured for network: ${network}`);
  }
  
  // Get correct USDC domain info for the network
  const usdcDomain = getUsdcDomainForNetwork(network);
  
  // Generate unique salt for this settlement
  const salt = generateSalt();
  
  // Facilitator fee (0.01 USDC = 10000 in 6 decimals)
  const facilitatorFee = '10000';
  
  // Total amount including facilitator fee (0.1 + 0.01 = 0.11 USDC)
  const totalAmount = '110000';
  
  // Return standard x402 PaymentRequirements format with settlement extension
  return {
    scheme: 'exact',
    network: network as any,
    maxAmountRequired: totalAmount,
    asset: networkConfig.usdcAddress,
    payTo: networkConfig.settlementRouterAddress, // Payment goes to SettlementRouter
    resource: resource || '/api/transfer-with-hook/payment',
    description: `Transfer with Hook: Pay $0.1 to merchant with $0.01 facilitator fee on ${network}`,
    mimeType: 'application/json',
    maxTimeoutSeconds: 3600, // 1 hour validity window
    extra: {
      // Required for EIP-712 signature (USDC contract domain)
      name: usdcDomain.name,
      version: usdcDomain.version,
      // Settlement-specific data for SettlementRouter
      settlementRouter: networkConfig.settlementRouterAddress,
      salt,
      payTo: appConfig.resourceServerAddress, // Final recipient (merchant)
      facilitatorFee,
      hook: networkConfig.transferHookAddress, // Use built-in TransferHook
      hookData: '0x', // TransferHook doesn't need hookData
    },
  };
}

/**
 * Get scenario information
 */
export function getScenarioInfo() {
  return {
    id: 'transfer-with-hook',
    name: 'Transfer with Hook',
    description: 'Basic transfer using TransferHook with facilitator fee',
    price: '$0.1 USDC',
    facilitatorFee: '$0.01 USDC',
    recipient: appConfig.resourceServerAddress,
    note: 'Entry-level x402x scenario demonstrating Hook architecture and facilitator incentives',
  };
}

