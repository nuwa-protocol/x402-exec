/**
 * Facilitator API client utilities for x402x
 *
 * Provides client-side functions to interact with facilitator HTTP APIs.
 * This includes fee calculation and caching utilities, as well as
 * helper functions for settlement mode detection and validation.
 */

import type { PaymentRequirements } from "./types.js";
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
export function parseSettlementExtra(extra: unknown): {
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
