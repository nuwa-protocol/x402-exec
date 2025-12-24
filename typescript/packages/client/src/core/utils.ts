/**
 * Utility functions for x402x client
 */

import type { Address, Hex } from "viem";
import { getAddress, isAddress } from "viem";
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
  // @ts-ignore - crypto is available in all runtime environments
  const cryptoObj = typeof globalThis !== 'undefined' && globalThis.crypto 
    // @ts-ignore
    ? globalThis.crypto 
    // @ts-ignore
    : (typeof crypto !== 'undefined' ? crypto : undefined);
  
  if (!cryptoObj || !cryptoObj.getRandomValues) {
    throw new Error('crypto.getRandomValues is not available');
  }
  
  const randomBytes = cryptoObj.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(randomBytes)
    .map((b) => (b as number).toString(16).padStart(2, "0"))
    .join("")}` as Hex;
}

/**
 * Normalize Ethereum address to EIP-55 checksum format
 *
 * Automatically converts any valid Ethereum address (lowercase, uppercase, or mixed)
 * to the proper checksummed format. This provides a better developer experience
 * by accepting addresses in any case format.
 *
 * @param address - Address to normalize (can be any case)
 * @param name - Parameter name for error messages (optional)
 * @returns Checksummed address in EIP-55 format
 * @throws ValidationError if address is invalid
 *
 * @example
 * ```typescript
 * normalizeAddress('0xabc123...') // Returns '0xAbC123...' (checksummed)
 * normalizeAddress('0xABC123...') // Returns '0xAbC123...' (checksummed)
 * normalizeAddress('0xAbC123...') // Returns '0xAbC123...' (already checksummed)
 * ```
 */
export function normalizeAddress(address: string, name: string = "address"): Address {
  if (!address || typeof address !== "string") {
    throw new ValidationError(`${name} is required`);
  }

  // Convert to EIP-55 checksum format
  // getAddress() will throw if the address is invalid
  try {
    return getAddress(address);
  } catch (error) {
    throw new ValidationError(
      `${name} is not a valid Ethereum address: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Validate Ethereum address format (legacy, prefer normalizeAddress)
 *
 * @deprecated Use normalizeAddress() instead for better developer experience
 * @param address - Address to validate
 * @param name - Parameter name for error messages
 * @throws ValidationError if address is invalid
 */
export function validateAddress(address: string, name: string): void {
  if (!address || typeof address !== "string") {
    throw new ValidationError(`${name} is required`);
  }
  if (!isAddress(address)) {
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
 * Validate amount format - must be atomic units (positive integer string)
 *
 * This function validates that the amount is a valid atomic unit string.
 * For converting USD amounts to atomic units, use parseDefaultAssetAmount from @x402x/core.
 *
 * @param amount - Amount in atomic units (must be a positive integer string)
 * @param name - Parameter name for error messages
 * @throws ValidationError if amount is invalid
 *
 * @example
 * ```typescript
 * validateAmount('1000000', 'amount'); // Valid: atomic units
 * validateAmount('0.1', 'amount');     // Invalid: not atomic units
 * validateAmount('-1', 'amount');       // Invalid: negative
 * ```
 */
export function validateAmount(amount: string | number, name: string): void {
  if (amount === null || amount === undefined || amount === "") {
    throw new ValidationError(`${name} is required`);
  }

  // Convert to string if number
  const amountStr = typeof amount === "number" ? amount.toString() : amount;

  // Must be a non-empty string
  if (typeof amountStr !== "string" || amountStr.trim() === "") {
    throw new ValidationError(`${name} must be a non-empty string`);
  }

  // Must be a valid positive integer (atomic units)
  // Allow leading zeros but must be numeric
  if (!/^\d+$/.test(amountStr)) {
    throw new ValidationError(
      `${name} must be a positive integer string (atomic units). ` +
        `Use parseDefaultAssetAmount() from @x402x/core to convert USD amounts.`,
    );
  }

  // Validate it can be converted to BigInt (no overflow)
  try {
    const atomicAmount = BigInt(amountStr);
    if (atomicAmount < 0n) {
      throw new ValidationError(`${name} cannot be negative`);
    }
    if (atomicAmount === 0n) {
      throw new ValidationError(`${name} cannot be zero`);
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      `${name} is not a valid amount: ${error instanceof Error ? error.message : "Invalid format"}`,
    );
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
