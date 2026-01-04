/**
 * Facilitator API client utilities for x402x
 *
 * Provides client-side functions to interact with facilitator HTTP APIs.
 * This includes fee calculation and caching utilities, as well as
 * helper functions for settlement mode detection and validation.
 */

import type { PaymentRequirements, PaymentPayload, SettlementExtraCore } from "./types.js";
import { SettlementExtraError } from "./types.js";

/**
 * Check if a payment request requires SettlementRouter mode
 *
 * This is a client-side utility to determine which settlement flow to use.
 *
 * @param paymentRequirements - Payment requirements from 402 response
 * @returns True if settlement mode is required
 *
 * @example
 * ```typescript
 * if (isSettlementMode(paymentRequirements)) {
 *   // Use Settlement Router mode
 *   await submitToFacilitator(...);
 * } else {
 *   // Use standard x402 mode
 *   await settle(...);
 * }
 * ```
 */
export function isSettlementMode(paymentRequirements: PaymentRequirements): boolean {
  return !!paymentRequirements.extra?.settlementRouter;
}

/**
 * Parse and validate settlement extra parameters
 *
 * This is useful for clients to validate payment requirements before submission.
 *
 * @param extra - Extra field from PaymentRequirements
 * @returns Parsed settlement extra parameters
 * @throws SettlementExtraError if parameters are invalid
 *
 * @example
 * ```typescript
 * try {
 *   const extra = parseSettlementExtra(paymentRequirements.extra);
 *   console.log('Hook:', extra.hook);
 *   console.log('Facilitator Fee:', extra.facilitatorFee);
 * } catch (error) {
 *   console.error('Invalid settlement parameters:', error);
 * }
 * ```
 */
export function parseSettlementExtra(extra: unknown): SettlementExtraCore {
  if (!extra || typeof extra !== "object") {
    throw new SettlementExtraError("Missing or invalid extra field");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = extra as Record<string, any>;

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
      // Add timeout (10 seconds for remote facilitators with potential network latency)
      signal: AbortSignal.timeout(10000),
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
 * Response from facilitator verify endpoint
 *
 * Indicates whether a payment payload is valid without executing it.
 */
export interface VerifyResponse {
  /** Whether the payment payload is valid */
  isValid: boolean;
  /** Reason for invalidity if isValid is false */
  invalidReason?: string;
  /** Payer address extracted from the payload */
  payer: string;
}

/**
 * Response from facilitator settle endpoint
 *
 * Contains the result of settlement execution on-chain.
 */
export interface SettleResponse {
  /** Whether the settlement was successful */
  success: boolean;
  /** Transaction hash of the settlement */
  transaction: string;
  /** Network the settlement was executed on */
  network: string;
  /** Payer address */
  payer: string;
  /** Error reason if settlement failed */
  errorReason?: string;
}

/**
 * Verify a payment payload with the facilitator
 *
 * Calls the facilitator's `/verify` endpoint to validate a payment without executing it.
 * This is useful for pre-validation before actual settlement.
 *
 * @param facilitatorUrl - Facilitator service base URL
 * @param paymentPayload - Payment payload from client (x402 standard)
 * @param paymentRequirements - Payment requirements (x402 standard)
 * @returns Verification response indicating validity
 *
 * @throws Error if network request fails or response is invalid
 *
 * @example
 * ```typescript
 * import { verify } from '@x402x/core';
 *
 * const result = await verify(
 *   'https://facilitator.x402x.dev',
 *   paymentPayload,
 *   paymentRequirements
 * );
 *
 * if (result.isValid) {
 *   console.log('Payment is valid, payer:', result.payer);
 * } else {
 *   console.error('Invalid payment:', result.invalidReason);
 * }
 * ```
 */
export async function verify(
  facilitatorUrl: string,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): Promise<VerifyResponse> {
  // Remove trailing slash from URL
  const baseUrl = facilitatorUrl.endsWith("/") ? facilitatorUrl.slice(0, -1) : facilitatorUrl;
  const url = `${baseUrl}/verify`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentPayload,
        paymentRequirements,
        x402Version: paymentPayload.x402Version, // Include x402Version at top level
      }),
      // Add timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Facilitator verify failed: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result: VerifyResponse = await response.json();

    // Validate response structure
    if (typeof result.isValid !== "boolean") {
      throw new Error("Invalid response from facilitator: missing isValid field");
    }

    if (typeof result.payer !== "string") {
      throw new Error("Invalid response from facilitator: missing payer field");
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to verify with facilitator: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Settle a payment with the facilitator
 *
 * Calls the facilitator's `/settle` endpoint to execute the payment on-chain.
 * This is the core function that submits a signed payment for blockchain execution.
 *
 * @param facilitatorUrl - Facilitator service base URL
 * @param paymentPayload - Payment payload from client (x402 standard)
 * @param paymentRequirements - Payment requirements (x402 standard)
 * @param timeout - Optional timeout in milliseconds (default: 30000)
 * @returns Settlement response with transaction details
 *
 * @throws Error if network request fails, response is invalid, or settlement fails
 *
 * @example
 * ```typescript
 * import { settle } from '@x402x/core';
 *
 * const result = await settle(
 *   'https://facilitator.x402x.dev',
 *   paymentPayload,
 *   paymentRequirements,
 *   30000 // 30 second timeout
 * );
 *
 * if (result.success) {
 *   console.log('Settlement successful!');
 *   console.log('Transaction:', result.transaction);
 *   console.log('Network:', result.network);
 * } else {
 *   console.error('Settlement failed:', result.errorReason);
 * }
 * ```
 */
export async function settle(
  facilitatorUrl: string,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  timeout: number = 30000,
): Promise<SettleResponse> {
  // Remove trailing slash from URL
  const baseUrl = facilitatorUrl.endsWith("/") ? facilitatorUrl.slice(0, -1) : facilitatorUrl;
  const url = `${baseUrl}/settle`;

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        paymentPayload,
        paymentRequirements,
        x402Version: paymentPayload.x402Version, // Include x402Version at top level
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Parse response
    const result: any = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || result.message || `Facilitator settle failed: ${response.status}`,
      );
    }

    // Validate result structure
    if (typeof result.success !== "boolean") {
      throw new Error("Invalid response from facilitator: missing success field");
    }

    if (!result.success) {
      throw new Error(result.errorReason || "Settlement failed");
    }

    if (!result.transaction) {
      throw new Error("Invalid response from facilitator: missing transaction hash");
    }

    return {
      success: result.success,
      transaction: result.transaction,
      network: result.network || paymentRequirements.network,
      payer: result.payer || "",
      errorReason: result.errorReason,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(`Facilitator settle timed out after ${timeout}ms`);
      }
      throw new Error(`Failed to settle with facilitator: ${error.message}`);
    }
    throw error;
  }
}
