/**
 * Validation helpers for PaymentRequirements.extra (settlement parameters)
 */

import type { SettlementExtra } from "./types.js";
import { SettlementExtraError } from "./types.js";

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Validate Ethereum address format (0x followed by 40 hex characters)
 * 
 * @param address - Address to validate
 * @returns true if valid Ethereum address
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate hex string format (0x followed by even number of hex characters)
 * 
 * @param hex - Hex string to validate
 * @returns true if valid hex string
 */
export function isValidHex(hex: string): boolean {
  return /^0x[a-fA-F0-9]*$/.test(hex) && hex.length % 2 === 0;
}

/**
 * Validate 32-byte hex string (0x followed by 64 hex characters)
 * 
 * @param hex - Hex string to validate
 * @returns true if valid 32-byte hex string
 */
export function isValid32ByteHex(hex: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hex);
}

/**
 * Validate numeric string (non-negative integer)
 * 
 * @param value - Value to validate
 * @returns true if valid numeric string
 */
export function isValidNumericString(value: string): boolean {
  return /^\d+$/.test(value) && BigInt(value) >= 0n;
}

/**
 * Validate settlement extra parameters
 * 
 * This validates all required fields for settlement through SettlementRouter.
 * 
 * @param extra - Settlement extra parameters to validate
 * @returns Validation result with error message if invalid
 * 
 * @example
 * ```typescript
 * const result = validateSettlementExtra({
 *   settlementRouter: "0x1234...",
 *   payTo: "0x5678...",
 *   facilitatorFee: "10000",
 *   hook: "0xabcd...",
 *   hookData: "0x",
 *   name: "USDC",
 *   version: "2",
 *   salt: "0x1234..."
 * });
 * 
 * if (!result.valid) {
 *   throw new Error(result.error);
 * }
 * ```
 */
export function validateSettlementExtra(
  extra: Partial<SettlementExtra>
): ValidationResult {
  // Validate settlementRouter
  if (!extra.settlementRouter) {
    return { valid: false, error: "settlementRouter is required" };
  }
  if (!isValidAddress(extra.settlementRouter)) {
    return { valid: false, error: "settlementRouter must be a valid Ethereum address" };
  }

  // Validate payTo
  if (!extra.payTo) {
    return { valid: false, error: "payTo is required" };
  }
  if (!isValidAddress(extra.payTo)) {
    return { valid: false, error: "payTo must be a valid Ethereum address" };
  }

  // Validate facilitatorFee
  if (extra.facilitatorFee === undefined || extra.facilitatorFee === null) {
    return { valid: false, error: "facilitatorFee is required" };
  }
  if (!isValidNumericString(extra.facilitatorFee)) {
    return { valid: false, error: "facilitatorFee must be a non-negative numeric string" };
  }

  // Validate hook
  if (!extra.hook) {
    return { valid: false, error: "hook is required" };
  }
  if (!isValidAddress(extra.hook)) {
    return { valid: false, error: "hook must be a valid Ethereum address" };
  }

  // Validate hookData
  if (extra.hookData === undefined || extra.hookData === null) {
    return { valid: false, error: "hookData is required" };
  }
  if (!isValidHex(extra.hookData)) {
    return { valid: false, error: "hookData must be a valid hex string" };
  }

  // Validate name (EIP-712 domain)
  if (!extra.name) {
    return { valid: false, error: "name is required (EIP-712 domain name)" };
  }
  if (typeof extra.name !== "string" || extra.name.trim().length === 0) {
    return { valid: false, error: "name must be a non-empty string" };
  }

  // Validate version (EIP-712 domain)
  if (!extra.version) {
    return { valid: false, error: "version is required (EIP-712 domain version)" };
  }
  if (typeof extra.version !== "string" || extra.version.trim().length === 0) {
    return { valid: false, error: "version must be a non-empty string" };
  }

  // Validate salt
  if (!extra.salt) {
    return { valid: false, error: "salt is required" };
  }
  if (!isValid32ByteHex(extra.salt)) {
    return { valid: false, error: "salt must be a 32-byte hex string (0x followed by 64 hex characters)" };
  }

  return { valid: true };
}

/**
 * Assert that settlement extra parameters are valid
 * Throws SettlementExtraError if validation fails
 * 
 * @param extra - Settlement extra parameters to validate
 * @throws {SettlementExtraError} If validation fails
 * 
 * @example
 * ```typescript
 * try {
 *   assertValidSettlementExtra(extra);
 *   // Extra is valid, proceed with settlement
 * } catch (error) {
 *   console.error("Invalid settlement extra:", error.message);
 * }
 * ```
 */
export function assertValidSettlementExtra(
  extra: Partial<SettlementExtra>
): asserts extra is SettlementExtra {
  const result = validateSettlementExtra(extra);
  if (!result.valid) {
    throw new SettlementExtraError(result.error || "Invalid settlement extra");
  }
}
