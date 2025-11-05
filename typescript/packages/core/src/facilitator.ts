/**
 * Facilitator utilities for x402x settlement
 * 
 * Provides helper functions for facilitators to handle settlement mode payments.
 */

import { parseErc6492Signature, type Address, type Hex } from 'viem';
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  Signer,
  FacilitatorConfig,
} from './types.js';
import { SettlementExtraError } from './types.js';
import { getNetworkConfig } from './networks.js';
import { SETTLEMENT_ROUTER_ABI } from './abi.js';

/**
 * Check if a payment request requires SettlementRouter mode
 * 
 * @param paymentRequirements - Payment requirements from 402 response
 * @returns True if settlement mode is required
 * 
 * @example
 * ```typescript
 * if (isSettlementMode(paymentRequirements)) {
 *   await settleWithRouter(...);
 * } else {
 *   await settle(...);  // Standard x402
 * }
 * ```
 */
export function isSettlementMode(paymentRequirements: PaymentRequirements): boolean {
  return !!paymentRequirements.extra?.settlementRouter;
}

/**
 * Validate SettlementRouter address against whitelist
 * 
 * @param network - Network name
 * @param routerAddress - SettlementRouter address to validate
 * @param allowedRouters - Whitelist of allowed router addresses per network
 * @throws SettlementExtraError if router is not in whitelist
 */
export function validateSettlementRouter(
  network: string,
  routerAddress: string,
  allowedRouters: Record<string, string[]>
): void {
  const allowedForNetwork = allowedRouters[network];
  
  if (!allowedForNetwork || allowedForNetwork.length === 0) {
    throw new SettlementExtraError(
      `No allowed settlement routers configured for network: ${network}`
    );
  }
  
  const normalizedRouter = routerAddress.toLowerCase();
  const isAllowed = allowedForNetwork.some(
    allowed => allowed.toLowerCase() === normalizedRouter
  );
  
  if (!isAllowed) {
    throw new SettlementExtraError(
      `Settlement router ${routerAddress} is not in whitelist for network ${network}. ` +
      `Allowed: ${allowedForNetwork.join(', ')}`
    );
  }
}

/**
 * Parse and validate settlement extra parameters
 * 
 * @param extra - Extra field from PaymentRequirements
 * @returns Parsed settlement extra parameters
 * @throws SettlementExtraError if parameters are invalid
 */
function parseSettlementExtra(extra: unknown): {
  settlementRouter: string;
  salt: string;
  payTo: string;
  facilitatorFee: string;
  hook: string;
  hookData: string;
} {
  if (!extra || typeof extra !== 'object') {
    throw new SettlementExtraError('Missing or invalid extra field');
  }

  const e = extra as Record<string, unknown>;

  // Validate required fields
  if (!e.settlementRouter || typeof e.settlementRouter !== 'string') {
    throw new SettlementExtraError('Missing or invalid settlementRouter');
  }
  if (!e.salt || typeof e.salt !== 'string') {
    throw new SettlementExtraError('Missing or invalid salt');
  }
  if (!e.payTo || typeof e.payTo !== 'string') {
    throw new SettlementExtraError('Missing or invalid payTo');
  }
  if (!e.facilitatorFee || typeof e.facilitatorFee !== 'string') {
    throw new SettlementExtraError('Missing or invalid facilitatorFee');
  }
  if (!e.hook || typeof e.hook !== 'string') {
    throw new SettlementExtraError('Missing or invalid hook');
  }
  if (!e.hookData || typeof e.hookData !== 'string') {
    throw new SettlementExtraError('Missing or invalid hookData');
  }

  return {
    settlementRouter: e.settlementRouter,
    salt: e.salt,
    payTo: e.payTo,
    facilitatorFee: e.facilitatorFee,
    hook: e.hook,
    hookData: e.hookData,
  };
}

/**
 * Settle payment using SettlementRouter
 * 
 * This function calls SettlementRouter.settleAndExecute which:
 * 1. Verifies the EIP-3009 authorization
 * 2. Transfers tokens from payer to Router
 * 3. Deducts facilitator fee
 * 4. Executes the Hook with remaining amount
 * 5. Ensures Router doesn't hold funds
 * 
 * @param signer - Facilitator's wallet signer (must be EVM)
 * @param paymentPayload - Payment payload with authorization and signature
 * @param paymentRequirements - Payment requirements with settlement extra
 * @param config - Facilitator configuration (whitelist)
 * @returns Settlement response
 * 
 * @example
 * ```typescript
 * import { settleWithRouter, getNetworkConfig } from '@x402x/core';
 * 
 * const config = getNetworkConfig(paymentRequirements.network);
 * const result = await settleWithRouter(
 *   signer,
 *   paymentPayload,
 *   paymentRequirements,
 *   {
 *     allowedRouters: {
 *       'base-sepolia': [config.settlementRouter],
 *     },
 *   }
 * );
 * ```
 */
export async function settleWithRouter(
  signer: Signer,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  config: FacilitatorConfig
): Promise<SettleResponse> {
  try {
    // 1. Parse settlement extra parameters
    const extra = parseSettlementExtra(paymentRequirements.extra);

    // 2. Validate SettlementRouter address against whitelist
    validateSettlementRouter(
      paymentRequirements.network,
      extra.settlementRouter,
      config.allowedRouters
    );

    // 3. Extract authorization data from payload
    const payload = paymentPayload.payload as {
      authorization: {
        from: string;
        to: string;
        value: string;
        validAfter: string;
        validBefore: string;
        nonce: string;
      };
      signature: string;
    };

    const { authorization } = payload;

    // 4. Parse ERC-6492 signature if needed
    const { signature } = parseErc6492Signature(payload.signature as Hex);

    // 5. Ensure signer is EVM signer with required methods
    const walletClient = signer as any;
    const publicClient = signer as any;

    if (!walletClient.writeContract || !publicClient.waitForTransactionReceipt) {
      throw new Error('Signer must be an EVM wallet client with writeContract and waitForTransactionReceipt methods');
    }

    // 6. Call SettlementRouter.settleAndExecute
    const tx = await walletClient.writeContract({
      address: extra.settlementRouter as Address,
      abi: SETTLEMENT_ROUTER_ABI,
      functionName: 'settleAndExecute',
      args: [
        paymentRequirements.asset as Address,
        authorization.from as Address,
        BigInt(authorization.value),
        BigInt(authorization.validAfter),
        BigInt(authorization.validBefore),
        authorization.nonce as Hex,
        signature,
        extra.salt as Hex,
        extra.payTo as Address,
        BigInt(extra.facilitatorFee),
        extra.hook as Address,
        extra.hookData as Hex,
      ],
    });

    // 7. Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    if (receipt.status !== 'success') {
      return {
        success: false,
        errorReason: 'invalid_transaction_state',
        transaction: tx,
        network: paymentPayload.network,
        payer: authorization.from,
      };
    }

    return {
      success: true,
      transaction: tx,
      network: paymentPayload.network,
      payer: authorization.from,
    };
  } catch (error) {
    console.error('Error in settleWithRouter:', error);

    // Extract payer from payload if available
    let payer = '';
    try {
      const payload = paymentPayload.payload as {
        authorization: { from: string };
      };
      payer = payload.authorization.from;
    } catch {
      // Ignore extraction errors
    }

    return {
      success: false,
      errorReason:
        error instanceof SettlementExtraError
          ? 'invalid_payment_requirements'
          : 'unexpected_settle_error',
      transaction: '',
      network: paymentPayload.network,
      payer,
    };
  }
}

