/**
 * Facilitator utilities for x402x settlement
 *
 * Provides helper functions for facilitators to handle settlement mode payments.
 */

import { parseErc6492Signature, type Address, type Hex } from "viem";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  Signer,
  FacilitatorConfig,
} from "./types.js";
import { SettlementExtraError } from "./types.js";
import { SETTLEMENT_ROUTER_ABI } from "./abi.js";

/**
 * Result of facilitator fee calculation
 *
 * This interface represents the response from facilitator's /calculate-fee endpoint.
 * Only essential information is included - internal cost breakdown is not exposed.
 */
export interface FeeCalculationResult {
  network: string;
  hook: string;
  hookData?: string;
  hookAllowed: boolean;

  // Main result - recommended facilitator fee
  facilitatorFee: string; // Atomic units (e.g., USDC with 6 decimals)
  facilitatorFeeUSD: string; // USD value for display

  // Metadata
  calculatedAt: string; // ISO 8601 timestamp
  validitySeconds: number; // How long this fee is valid (typically 60 seconds)

  token: {
    address: string;
    symbol: string;
    decimals: number;
  };
}

/**
 * Simple in-memory cache for fee calculations
 */
class FeeCache {
  private cache: Map<string, { result: FeeCalculationResult; expiresAt: number }> = new Map();
  private ttlMs: number;

  constructor(ttlSeconds: number = 60) {
    this.ttlMs = ttlSeconds * 1000;
  }

  private getCacheKey(network: string, hook: string, hookData?: string): string {
    return `${network}:${hook}:${hookData || ""}`;
  }

  get(network: string, hook: string, hookData?: string): FeeCalculationResult | null {
    const key = this.getCacheKey(network, hook, hookData);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  set(result: FeeCalculationResult): void {
    const key = this.getCacheKey(result.network, result.hook, result.hookData);
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Global cache instance
const feeCache = new FeeCache(60);

/**
 * Calculate recommended facilitator fee by querying the facilitator service
 *
 * @param facilitatorUrl - Facilitator service base URL
 * @param network - Network name
 * @param hook - Hook contract address
 * @param hookData - Optional encoded hook parameters
 * @param useCache - Whether to use caching (default: true)
 * @returns Fee calculation result with sufficient safety margin
 *
 * @example
 * ```typescript
 * const feeResult = await calculateFacilitatorFee(
 *   'https://facilitator.x402x.dev',
 *   'base-sepolia',
 *   '0x1234...',
 *   '0x'
 * );
 * console.log(`Recommended fee: ${feeResult.facilitatorFee} (${feeResult.facilitatorFeeUSD} USD)`);
 * ```
 */
export async function calculateFacilitatorFee(
  facilitatorUrl: string,
  network: string,
  hook: string,
  hookData?: string,
  useCache: boolean = true,
): Promise<FeeCalculationResult> {
  // Check cache first
  if (useCache) {
    const cached = feeCache.get(network, hook, hookData);
    if (cached) {
      return cached;
    }
  }

  // Remove trailing slash from URL
  const baseUrl = facilitatorUrl.endsWith("/") ? facilitatorUrl.slice(0, -1) : facilitatorUrl;

  // Build query parameters
  const params = new URLSearchParams({
    network,
    hook,
  });

  if (hookData) {
    params.append("hookData", hookData);
  }

  // Query facilitator service
  const url = `${baseUrl}/calculate-fee?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Add timeout
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Facilitator fee calculation failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result: FeeCalculationResult = await response.json();

    // Validate response
    if (!result.facilitatorFee || !result.network || !result.hook) {
      throw new Error("Invalid response from facilitator service");
    }

    // Cache the result
    if (useCache) {
      feeCache.set(result);
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to calculate facilitator fee: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Clear the fee calculation cache
 *
 * Useful for testing or forcing fresh calculations
 */
export function clearFeeCache(): void {
  feeCache.clear();
}

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
  allowedRouters: Record<string, string[]>,
): void {
  const allowedForNetwork = allowedRouters[network];

  if (!allowedForNetwork || allowedForNetwork.length === 0) {
    throw new SettlementExtraError(
      `No allowed settlement routers configured for network: ${network}`,
    );
  }

  const normalizedRouter = routerAddress.toLowerCase();
  const isAllowed = allowedForNetwork.some((allowed) => allowed.toLowerCase() === normalizedRouter);

  if (!isAllowed) {
    throw new SettlementExtraError(
      `Settlement router ${routerAddress} is not in whitelist for network ${network}. ` +
        `Allowed: ${allowedForNetwork.join(", ")}`,
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
  if (!extra || typeof extra !== "object") {
    throw new SettlementExtraError("Missing or invalid extra field");
  }

  const e = extra as Record<string, unknown>;

  // Validate required fields
  if (!e.settlementRouter || typeof e.settlementRouter !== "string") {
    throw new SettlementExtraError("Missing or invalid settlementRouter");
  }
  if (!e.salt || typeof e.salt !== "string") {
    throw new SettlementExtraError("Missing or invalid salt");
  }
  if (!e.payTo || typeof e.payTo !== "string") {
    throw new SettlementExtraError("Missing or invalid payTo");
  }
  if (!e.facilitatorFee || typeof e.facilitatorFee !== "string") {
    throw new SettlementExtraError("Missing or invalid facilitatorFee");
  }
  if (!e.hook || typeof e.hook !== "string") {
    throw new SettlementExtraError("Missing or invalid hook");
  }
  if (!e.hookData || typeof e.hookData !== "string") {
    throw new SettlementExtraError("Missing or invalid hookData");
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
  config: FacilitatorConfig,
): Promise<SettleResponse> {
  try {
    // 1. Parse settlement extra parameters
    const extra = parseSettlementExtra(paymentRequirements.extra);

    // 2. Validate SettlementRouter address against whitelist
    validateSettlementRouter(
      paymentRequirements.network,
      extra.settlementRouter,
      config.allowedRouters,
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
      throw new Error(
        "Signer must be an EVM wallet client with writeContract and waitForTransactionReceipt methods",
      );
    }

    // 6. Call SettlementRouter.settleAndExecute
    // Prioritize gasLimit over maxGasLimit (gasLimit is dynamically calculated)
    const gasLimit = config.gasLimit ?? config.maxGasLimit;
    const tx = await walletClient.writeContract({
      address: extra.settlementRouter as Address,
      abi: SETTLEMENT_ROUTER_ABI,
      functionName: "settleAndExecute",
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
      // Add gas limit if configured (for security against malicious hooks)
      ...(gasLimit ? { gas: BigInt(gasLimit) } : {}),
    });

    // 7. Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    if (receipt.status !== "success") {
      return {
        success: false,
        errorReason: "invalid_transaction_state",
        transaction: tx,
        network: paymentPayload.network,
        payer: authorization.from,
      };
    }

    // 8. Return successful settlement response
    return {
      success: true,
      transaction: tx,
      network: paymentPayload.network,
      payer: authorization.from,
    };
  } catch (error) {
    console.error("Error in settleWithRouter:", error);

    // Extract payer from payload if available
    let payer = "";
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
          ? "invalid_payment_requirements"
          : "unexpected_settle_error",
      transaction: "",
      network: paymentPayload.network,
      payer,
    };
  }
}
