/**
 * Fetch wrapper for x402x settlement
 *
 * Provides a fetch wrapper that automatically handles 402 responses with
 * settlement mode support (commitment-based nonce).
 *
 * This package is compatible with x402-fetch API while adding x402x settlement support.
 */

import type { Hex } from "viem";
import { getAddress } from "viem";
import type { PaymentRequirements, Signer } from "@x402x/core_v2";
import { calculateCommitment, getNetworkConfig } from "@x402x/core_v2";
import type {
  MultiNetworkSigner,
  X402Config,
  Network,
  PaymentRequirementsSelector,
} from "@x402x/core_v2";
import {
  ChainIdToNetwork,
  isMultiNetworkSigner,
  isSvmSignerWallet,
  evm,
  createPaymentHeader,
  selectPaymentRequirements,
} from "@x402x/core_v2";

/**
 * 402 Response type
 */
interface Payment402Response {
  x402Version?: number;
  accepts?: unknown[];
}

/**
 * EIP-3009 authorization types for EIP-712 signature
 */
const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
};

/**
 * Check if payment requirements need settlement mode (x402x extension)
 */
function isSettlementMode(requirements: PaymentRequirements): boolean {
  return !!(requirements.extra as any)?.settlementRouter;
}

/**
 * Create payment header for settlement mode (x402x extension)
 */
async function createSettlementPaymentHeader(
  walletClient: any,
  x402Version: number,
  requirements: PaymentRequirements,
  config?: X402Config,
): Promise<string> {
  const extra = requirements.extra as any;
  const networkConfig = getNetworkConfig(requirements.network);
  const from = walletClient.account?.address || walletClient.address;

  if (!from) {
    throw new Error("No account address available");
  }

  const validAfter = BigInt(
    Math.floor(Date.now() / 1000) - 600, // 10 minutes before
  ).toString();
  const validBefore = BigInt(
    Math.floor(Date.now() / 1000) + requirements.maxTimeoutSeconds,
  ).toString();

  // Calculate commitment as nonce (x402x specific)
  const nonce = calculateCommitment({
    chainId: networkConfig.chainId,
    hub: extra.settlementRouter,
    asset: requirements.asset,
    from,
    value: requirements.maxAmountRequired,
    validAfter,
    validBefore,
    salt: extra.salt,
    payTo: extra.payTo,
    facilitatorFee: extra.facilitatorFee || "0",
    hook: extra.hook,
    hookData: extra.hookData,
  });

  // Sign EIP-712 authorization
  const signature = await walletClient.signTypedData({
    types: authorizationTypes,
    domain: {
      name: extra.name || "USD Coin",
      version: extra.version || "2",
      chainId: networkConfig.chainId,
      verifyingContract: getAddress(requirements.asset),
    },
    primaryType: "TransferWithAuthorization" as const,
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
    // Include paymentRequirements for server-side verification
    paymentRequirements: requirements,
  };

  // Base64url encode
  const paymentJson = JSON.stringify(paymentPayload);
  const paymentBase64 = btoa(paymentJson).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return paymentBase64;
}

/**
 * Create payment header for standard mode (fallback to x402)
 */
async function createStandardPaymentHeader(
  walletClient: Signer | MultiNetworkSigner,
  x402Version: number,
  requirements: PaymentRequirements,
  config?: X402Config,
): Promise<string> {
  return createPaymentHeader(walletClient, x402Version, requirements, config);
}

/**
 * Enables the payment of APIs using the x402 payment protocol with x402x settlement support.
 *
 * This function wraps the native fetch API to automatically handle 402 Payment Required responses
 * by creating and sending a payment header. It extends the standard x402 behavior with settlement
 * mode support (commitment-based nonce).
 *
 * @param fetch - The fetch function to wrap (typically globalThis.fetch)
 * @param walletClient - The wallet client used to sign payment messages (supports multi-network)
 * @param maxValue - The maximum allowed payment amount in base units (defaults to 0.1 USDC)
 * @param paymentRequirementsSelector - A function that selects the payment requirements from the response
 * @param config - Optional configuration for X402 operations (e.g., custom RPC URLs)
 * @returns A wrapped fetch function that handles 402 responses automatically
 *
 * @example
 * ```typescript
 * import { wrapFetchWithPayment } from '@x402x/fetch';
 * import { useWalletClient } from 'wagmi';
 *
 * const { data: walletClient } = useWalletClient();
 * const fetchWithPay = wrapFetchWithPayment(fetch, walletClient);
 *
 * // With custom configuration
 * const fetchWithPay = wrapFetchWithPayment(fetch, walletClient, undefined, undefined, {
 *   svmConfig: { rpcUrl: "http://localhost:8899" }
 * });
 *
 * const response = await fetchWithPay('/api/protected-resource');
 * ```
 *
 * @throws {Error} If the payment amount exceeds the maximum allowed value
 * @throws {Error} If the request configuration is missing
 * @throws {Error} If a payment has already been attempted for this request
 * @throws {Error} If there's an error creating the payment header
 */
export function wrapFetchWithPayment(
  fetch: typeof globalThis.fetch,
  walletClient: Signer | MultiNetworkSigner,
  maxValue: bigint = BigInt(0.1 * 10 ** 6), // Default to 0.10 USDC
  paymentRequirementsSelector: PaymentRequirementsSelector = selectPaymentRequirements,
  config?: X402Config,
) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    // Make initial request
    const response = await fetch(input, init);

    // If not 402, return as is
    if (response.status !== 402) {
      return response;
    }

    // Parse 402 response
    const { x402Version = 1, accepts } = (await response.json()) as Payment402Response;

    if (!accepts || accepts.length === 0) {
      throw new Error("No payment requirements provided in 402 response");
    }

    // Determine network from wallet client (for selector)
    const network = isMultiNetworkSigner(walletClient)
      ? undefined
      : evm.isSignerWallet(walletClient as typeof evm.EvmSigner)
        ? ChainIdToNetwork[(walletClient as typeof evm.EvmSigner).chain?.id]
        : isSvmSignerWallet(walletClient)
          ? (["solana", "solana-devnet"] as Network[])
          : undefined;

    // Select payment requirement using provided selector
    const requirements = paymentRequirementsSelector(
      accepts as PaymentRequirements[],
      network,
      "exact",
    );

    // Validate payment amount
    if (BigInt(requirements.maxAmountRequired) > maxValue) {
      throw new Error("Payment amount exceeds maximum allowed");
    }

    // Create payment header based on mode
    let paymentHeader: string;

    if (isSettlementMode(requirements)) {
      // x402x settlement mode: use commitment-based nonce
      console.log("[x402x] Using settlement mode with commitment-based nonce");
      paymentHeader = await createSettlementPaymentHeader(
        walletClient,
        x402Version,
        requirements,
        config,
      );
    } else {
      // Standard x402 mode
      console.log("[x402x] Using standard x402 mode");
      paymentHeader = await createStandardPaymentHeader(
        walletClient,
        x402Version,
        requirements,
        config,
      );
    }

    if (!init) {
      throw new Error("Missing fetch request configuration");
    }

    // Check for retry loop
    if ((init as any)?.__is402Retry) {
      throw new Error("Payment already attempted");
    }

    // Retry request with payment header
    const newInit = {
      ...init,
      headers: {
        ...(init?.headers || {}),
        "X-PAYMENT": paymentHeader,
        "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
      },
      __is402Retry: true,
    };

    const secondResponse = await fetch(input, newInit);
    return secondResponse;
  };
}

/**
 * Simplified alias for wrapFetchWithPayment (x402x style)
 *
 * @deprecated Use wrapFetchWithPayment for full compatibility with x402
 */
export function x402xFetch(
  fetch: typeof globalThis.fetch,
  walletClient: Signer | MultiNetworkSigner,
  maxValue: bigint = BigInt(0.1 * 10 ** 6),
) {
  return wrapFetchWithPayment(fetch, walletClient, maxValue);
}

// Re-export utilities from @x402x/core_v2 for compatibility
export { decodeXPaymentResponse, createSigner } from "@x402x/core_v2";
export type { Signer, MultiNetworkSigner, X402Config, PaymentRequirementsSelector } from "@x402x/core_v2";
export type { Hex } from "viem";
