/**
 * Express middleware for x402x
 * 
 * Provides convenient middleware for Express-based resource servers
 * to generate settlement-enabled PaymentRequirements.
 */

import type { Request, Response, NextFunction } from 'express';
import type { PaymentRequirements } from '@x402x/core';
import { addSettlementExtra, getNetworkConfig, TransferHook } from '@x402x/core';

/**
 * Middleware options
 */
export interface X402MiddlewareOptions {
  /**
   * Network name (e.g., 'base-sepolia')
   */
  network: string;
  
  /**
   * Payment amount in token's smallest unit
   */
  amount: string;
  
  /**
   * Token address (e.g., USDC address)
   * If not provided, uses default USDC for the network
   */
  token?: string;
  
  /**
   * Hook address
   * Defaults to TransferHook for the network
   */
  hook?: string;
  
  /**
   * Encoded hook data
   * Defaults to empty data for TransferHook
   */
  hookData?: string;
  
  /**
   * Facilitator fee amount
   * Defaults to '0'
   */
  facilitatorFee?: string;
  
  /**
   * Final recipient address
   * If not provided, uses the payTo from base requirements
   */
  payTo?: string;
  
  /**
   * Resource path (e.g., '/api/payment')
   */
  resource: string;
  
  /**
   * Description for the payment
   */
  description?: string;
  
  /**
   * Maximum timeout in seconds
   * Defaults to 3600 (1 hour)
   */
  maxTimeoutSeconds?: number;
}

/**
 * Create Express middleware for x402x settlement
 * 
 * This middleware returns 402 responses with settlement-enabled PaymentRequirements.
 * It can be used as a drop-in replacement for standard x402 middleware.
 * 
 * @param options - Middleware configuration
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * import express from 'express';
 * import { x402Middleware } from '@x402x/express';
 * 
 * const app = express();
 * 
 * app.post('/api/payment',
 *   x402Middleware({
 *     network: 'base-sepolia',
 *     amount: '100000', // 0.1 USDC
 *     resource: '/api/payment',
 *     description: 'Payment for premium features',
 *     facilitatorFee: '10000', // 0.01 USDC
 *   }),
 *   (req, res) => {
 *     // This handler only runs after successful payment
 *     res.json({ success: true, message: 'Payment received' });
 *   }
 * );
 * ```
 */
export function x402Middleware(options: X402MiddlewareOptions) {
  return function middleware(req: Request, res: Response, next: NextFunction) {
    // Check if X-PAYMENT header is present
    // If yes, payment has been made, proceed to next handler
    if (req.headers['x-payment']) {
      return next();
    }
    
    // No payment header, return 402 with PaymentRequirements
    const { network } = options;
    const config = getNetworkConfig(network);
    
    // Build base PaymentRequirements
    const baseRequirements: PaymentRequirements = {
      scheme: 'exact',
      network: network as any,
      maxAmountRequired: options.amount,
      asset: options.token || config.usdc.address,
      payTo: options.payTo || config.settlementRouter,
      resource: options.resource,
      description: options.description || `Payment of ${options.amount} on ${network}`,
      mimeType: 'application/json',
      maxTimeoutSeconds: options.maxTimeoutSeconds || 3600,
    };
    
    // Add settlement extension
    const requirements = addSettlementExtra(baseRequirements, {
      hook: options.hook || TransferHook.getAddress(network),
      hookData: options.hookData || TransferHook.encode(),
      facilitatorFee: options.facilitatorFee || '0',
      payTo: options.payTo,
    });
    
    // Return 402 Payment Required
    res.status(402).json({
      accepts: [requirements],
      x402Version: 1,
    });
  };
}

