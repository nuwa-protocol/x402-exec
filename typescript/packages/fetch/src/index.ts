/**
 * Fetch wrapper for x402x settlement
 * 
 * Provides a fetch wrapper that automatically handles 402 responses with
 * settlement mode support (commitment-based nonce).
 */

import type { Hex } from 'viem';
import { getAddress } from 'viem';
import type { PaymentRequirements, Signer } from '@x402x/core';
import { calculateCommitment, getNetworkConfig } from '@x402x/core';

/**
 * 402 Response type
 */
interface Payment402Response {
  x402Version?: number;
  accepts?: PaymentRequirements[];
}

/**
 * EIP-3009 authorization types for EIP-712 signature
 */
const authorizationTypes = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

/**
 * Check if payment requirements need settlement mode
 */
function isSettlementMode(requirements: PaymentRequirements): boolean {
  return !!requirements.extra?.settlementRouter;
}

/**
 * Create payment header for settlement mode
 */
async function createSettlementPaymentHeader(
  walletClient: any,
  x402Version: number,
  requirements: PaymentRequirements,
): Promise<string> {
  const config = getNetworkConfig(requirements.network);
  const from = walletClient.account?.address || walletClient.address;
  
  if (!from) {
    throw new Error('No account address available');
  }

  const validAfter = BigInt(
    Math.floor(Date.now() / 1000) - 600 // 10 minutes before
  ).toString();
  const validBefore = BigInt(
    Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds
  ).toString();

  // Calculate commitment as nonce
  const nonce = calculateCommitment({
    chainId: config.chainId,
    hub: requirements.extra!.settlementRouter!,
    token: requirements.asset,
    from,
    value: requirements.maxAmountRequired,
    validAfter,
    validBefore,
    salt: requirements.extra!.salt!,
    payTo: requirements.extra!.payTo!,
    facilitatorFee: requirements.extra!.facilitatorFee || '0',
    hook: requirements.extra!.hook!,
    hookData: requirements.extra!.hookData!,
  });

  // Sign EIP-712 authorization
  const signature = await walletClient.signTypedData({
    types: authorizationTypes,
    domain: {
      name: requirements.extra!.name || 'USD Coin',
      version: requirements.extra!.version || '2',
      chainId: config.chainId,
      verifyingContract: getAddress(requirements.asset),
    },
    primaryType: 'TransferWithAuthorization' as const,
    message: {
      from: getAddress(from),
      to: getAddress(requirements.payTo),
      value: requirements.maxAmountRequired,
      validAfter,
      validBefore,
      nonce: nonce as Hex,
    },
  });

  // Encode payment payload
  const paymentPayload = {
    x402Version,
    scheme: requirements.scheme,
    network: requirements.network,
    payload: {
      signature,
      authorization: {
        from,
        to: requirements.payTo,
        value: requirements.maxAmountRequired,
        validAfter,
        validBefore,
        nonce,
      },
    },
  };

  // Base64url encode
  const paymentJson = JSON.stringify(paymentPayload);
  const paymentBase64 = btoa(paymentJson)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return paymentBase64;
}

/**
 * Create payment header for standard mode (fallback to x402)
 */
async function createStandardPaymentHeader(
  walletClient: any,
  x402Version: number,
  requirements: PaymentRequirements,
): Promise<string> {
  // Import dynamically to avoid circular dependency
  const { createPaymentHeader } = await import('x402/client');
  return createPaymentHeader(walletClient, x402Version, requirements);
}

/**
 * Wrap fetch with x402x payment support
 * 
 * This wrapper automatically handles 402 Payment Required responses by:
 * 1. Detecting settlement mode (checking extra.settlementRouter)
 * 2. Using commitment-based nonce for settlement mode
 * 3. Falling back to standard x402 for non-settlement payments
 * 4. Creating payment header and retrying the request
 * 
 * @param fetch - The fetch function to wrap (typically globalThis.fetch)
 * @param walletClient - The wallet client used to sign payments
 * @param maxValue - Maximum allowed payment amount (defaults to 0.1 USDC)
 * @returns Wrapped fetch function
 * 
 * @example
 * ```typescript
 * import { x402xFetch } from '@x402x/fetch';
 * import { useWalletClient } from 'wagmi';
 * 
 * const { data: walletClient } = useWalletClient();
 * const fetchWithPay = x402xFetch(fetch, walletClient);
 * 
 * const response = await fetchWithPay('/api/protected-resource');
 * ```
 */
export function x402xFetch(
  fetch: typeof globalThis.fetch,
  walletClient: Signer,
  maxValue: bigint = BigInt(0.1 * 10 ** 6), // 0.1 USDC
) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    // Make initial request
    const response = await fetch(input, init);

    // If not 402, return as is
    if (response.status !== 402) {
      return response;
    }

    // Parse 402 response
    const { x402Version = 1, accepts } = await response.json() as Payment402Response;
    
    if (!accepts || accepts.length === 0) {
      throw new Error('No payment requirements provided in 402 response');
    }

    // Select first payment requirement (can be enhanced with selector logic)
    const requirements = accepts[0] as PaymentRequirements;

    // Validate payment amount
    if (BigInt(requirements.maxAmountRequired) > maxValue) {
      throw new Error(
        `Payment amount ${requirements.maxAmountRequired} exceeds maximum allowed ${maxValue}`
      );
    }

    // Create payment header based on mode
    let paymentHeader: string;
    
    if (isSettlementMode(requirements)) {
      console.log('[x402x] Using settlement mode with commitment-based nonce');
      paymentHeader = await createSettlementPaymentHeader(
        walletClient,
        x402Version,
        requirements
      );
    } else {
      console.log('[x402x] Using standard x402 mode');
      paymentHeader = await createStandardPaymentHeader(
        walletClient,
        x402Version,
        requirements
      );
    }

    // Check for retry loop
    if ((init as any)?.__is402Retry) {
      throw new Error('Payment already attempted, preventing retry loop');
    }

    // Retry request with payment header
    const newInit = {
      ...init,
      headers: {
        ...(init?.headers || {}),
        'X-PAYMENT': paymentHeader,
        'Access-Control-Expose-Headers': 'X-PAYMENT-RESPONSE',
      },
      __is402Retry: true,
    };

    const secondResponse = await fetch(input, newInit);
    return secondResponse;
  };
}

