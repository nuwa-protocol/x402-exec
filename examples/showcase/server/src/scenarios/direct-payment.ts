/**
 * Simple Direct Payment Scenario
 * Uses original x402 protocol without SettlementRouter
 * Pays directly to resource server for debugging and comparison
 */

import { appConfig } from '../config.js';
import { PaymentRequirements } from 'x402/types';

export interface DirectPaymentParams {
  resource?: string;
}

/**
 * Generates payment requirements for simple direct payment scenario
 * @param params Parameters including resource URL
 * @returns Payment requirements object
 */
export function generateDirectPayment(params: DirectPaymentParams = {}): PaymentRequirements {
  const { resource } = params;
  
  // Return standard x402 PaymentRequirements format (simple version)
  return {
    scheme: 'exact',
    network: appConfig.network as any,
    maxAmountRequired: '100000', // 0.1 USDC (6 decimals)
    asset: appConfig.usdcAddress,
    payTo: appConfig.resourceServerAddress, // Direct payment to resource server
    resource: resource || '/api/direct-payment/payment',
    description: 'Simple Direct Payment: $0.1 USDC to resource server (no router/hook)',
    mimeType: 'application/json',
    maxTimeoutSeconds: 3600, // 1 hour validity window
    extra: {
      // Required for EIP-712 signature (USDC contract domain)
      name: 'USDC',
      version: '2',
      // NO settlementRouter, salt, hook, hookData - this is a simple direct payment
    },
  };
}

/**
 * Get scenario information
 */
export function getScenarioInfo() {
  return {
    id: 'direct-payment',
    name: 'Simple Direct Payment',
    description: 'Direct payment to resource server using original x402 protocol (no router/hook)',
    price: '$0.1 USDC',
    recipient: appConfig.resourceServerAddress,
    note: 'For debugging and comparison with SettlementRouter-based scenarios',
  };
}

