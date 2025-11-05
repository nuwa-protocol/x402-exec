/**
 * Transfer with Hook Scenario
 * Basic x402x settlement using TransferHook with facilitator fee support
 * This is the entry-level scenario for understanding x402x settlement
 * 
 * Simplified using @x402x/core utilities
 */

import { appConfig, getNetworkConfig } from '../config.js';
import { PaymentRequirements } from 'x402/types';
import { addSettlementExtra, TransferHook } from '@x402x/core';

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
  
  // Facilitator fee (0.01 USDC = 10000 in 6 decimals)
  const facilitatorFee = '10000';
  
  // Total amount including facilitator fee (0.1 + 0.01 = 0.11 USDC)
  const totalAmount = '110000';
  
  // Build base PaymentRequirements (standard x402 format)
  const baseRequirements: PaymentRequirements = {
    scheme: 'exact',
    network: network as any,
    maxAmountRequired: totalAmount,
    asset: networkConfig.usdcAddress,
    payTo: networkConfig.settlementRouterAddress, // Will be set by addSettlementExtra
    resource: resource || '/api/transfer-with-hook/payment',
    description: `Transfer with Hook: Pay $0.1 to merchant with $0.01 facilitator fee on ${network}`,
    mimeType: 'application/json',
    maxTimeoutSeconds: 3600, // 1 hour validity window
  };
  
  // Add settlement extension using SDK helper
  // TransferHook doesn't need hookData, just use empty bytes
  return addSettlementExtra(baseRequirements, {
    hook: TransferHook.getAddress(network), // Use SDK's TransferHook helper
    hookData: TransferHook.encode(), // Empty hookData
    facilitatorFee,
    payTo: appConfig.resourceServerAddress, // Final recipient (merchant)
  });
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
