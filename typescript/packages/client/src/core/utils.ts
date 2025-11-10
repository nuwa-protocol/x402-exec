/**
 * Utility functions for x402x client
 */

import type { Hex } from "viem";
import type { Network } from "x402/types";
import { processPriceToAtomicAmount } from "x402/shared";
import { ValidationError } from "../errors.js";

/**
 * Generate a random 32-byte salt for settlement idempotency
 *
 * @returns Random 32-byte hex string
 *
 * @example
 * ```typescript
 * const salt = generateSalt();
 * console.log(salt); // "0x1234..."
 * ```
 */
export function generateSalt(): Hex {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as Hex;
}

/**
 * Validate Ethereum address format
 *
 * @param address - Address to validate
 * @param name - Parameter name for error messages
 * @throws ValidationError if address is invalid
 */
export function validateAddress(address: string, name: string): void {
  if (!address || typeof address !== "string") {
    throw new ValidationError(`${name} is required`);
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new ValidationError(`${name} must be a valid Ethereum address`);
  }
}

/**
 * Validate hex string format
 *
 * @param hex - Hex string to validate
 * @param name - Parameter name for error messages
 * @param expectedLength - Optional expected length (in bytes, not characters)
 * @throws ValidationError if hex is invalid
 */
export function validateHex(hex: string, name: string, expectedLength?: number): void {
  if (!hex || typeof hex !== "string") {
    throw new ValidationError(`${name} is required`);
  }
  if (!hex.startsWith("0x")) {
    throw new ValidationError(`${name} must start with 0x`);
  }
  if (!/^0x[0-9a-fA-F]*$/.test(hex)) {
    throw new ValidationError(`${name} must be a valid hex string`);
  }
  if (expectedLength !== undefined) {
    const actualLength = (hex.length - 2) / 2;
    if (actualLength !== expectedLength) {
      throw new ValidationError(
        `${name} must be ${expectedLength} bytes, got ${actualLength} bytes`,
      );
    }
  }
}

/**
 * Parse amount from various formats to atomic units
 *
 * Supports multiple input formats:
 * - Dollar format: '$1.2' or '$1.20' → '1200000' (1.2 USDC)
 * - Decimal string: '1.2' or '1.20' → '1200000'
 * - Number: 1.2 → '1200000'
 * - Atomic units: '1200000' → '1200000' (pass-through for large integers >= 100)
 *
 * Uses x402's processPriceToAtomicAmount for parsing.
 *
 * @param amount - Amount in various formats
 * @param network - Network name (default: 'base-sepolia') - used to determine token decimals
 * @returns Amount in atomic units as string
 * @throws ValidationError if amount format is invalid
 *
 * @example
 * ```typescript
 * parseAmount('$1.2')      // '1200000'
 * parseAmount('1.2')       // '1200000'
 * parseAmount(1.2)         // '1200000'
 * parseAmount('1200000')   // '1200000'
 * ```
 */
export function parseAmount(amount: string | number, network: Network = "base-sepolia"): string {
  // Handle empty/invalid input
  if (amount === null || amount === undefined || amount === "") {
    throw new ValidationError("Amount is required");
  }

  // If it's a string integer >= 100, treat as atomic units (pass-through)
  if (typeof amount === "string") {
    const trimmed = amount.trim();
    if (/^\d+$/.test(trimmed)) {
      const numValue = BigInt(trimmed);
      if (numValue <= 0n) {
        throw new ValidationError("Amount must be greater than 0");
      }
      // If >= 100, assume it's atomic units (e.g., 1000000 for 1 USDC)
      // If < 100, fall through to decimal parsing (e.g., "1" means 1 dollar)
      if (numValue >= 100n) {
        return trimmed;
      }
    }
  }

  // Use x402's processPriceToAtomicAmount for parsing
  const result = processPriceToAtomicAmount(amount, network);

  if ("error" in result) {
    throw new ValidationError(`Invalid amount format: ${result.error}`);
  }

  return result.maxAmountRequired;
}

/**
 * Format atomic units to human-readable decimal string
 *
 * @param amount - Amount in atomic units
 * @param decimals - Token decimals (default: 6 for USDC)
 * @returns Human-readable decimal string
 *
 * @example
 * ```typescript
 * formatAmount('1200000')  // '1.2'
 * formatAmount('1000000')  // '1'
 * formatAmount('1')        // '0.000001'
 * ```
 */
export function formatAmount(amount: string, decimals: number = 6): string {
  const atomicAmount = BigInt(amount);
  if (atomicAmount < 0n) {
    throw new ValidationError("Amount cannot be negative");
  }

  const amountStr = atomicAmount.toString().padStart(decimals + 1, "0");
  const integerPart = amountStr.slice(0, -decimals) || "0";
  const decimalPart = amountStr.slice(-decimals);

  // Remove trailing zeros from decimal part
  const trimmedDecimal = decimalPart.replace(/0+$/, "");

  if (trimmedDecimal) {
    return `${integerPart}.${trimmedDecimal}`;
  }
  return integerPart;
}

/**
 * Validate amount format (legacy function, now supports multiple formats)
 *
 * @param amount - Amount to validate
 * @param name - Parameter name for error messages
 * @throws ValidationError if amount is invalid
 */
export function validateAmount(amount: string | number, name: string): void {
  try {
    parseAmount(amount);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError(`${name}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Format facilitator URL (ensure it doesn't end with slash)
 *
 * @param url - Facilitator URL
 * @returns Formatted URL
 */
export function formatFacilitatorUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Calculate default time window for authorization
 *
 * @param maxTimeoutSeconds - Maximum timeout in seconds
 * @returns Object with validAfter and validBefore timestamps
 */
export function calculateTimeWindow(maxTimeoutSeconds: number = 300): {
  validAfter: string;
  validBefore: string;
} {
  const now = Math.floor(Date.now() / 1000);
  return {
    validAfter: (now - 600).toString(), // 10 minutes before
    validBefore: (now + maxTimeoutSeconds).toString(),
  };
}
