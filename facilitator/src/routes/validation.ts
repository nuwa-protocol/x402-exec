/**
 * Validation Helpers for Routes
 *
 * Provides basic structure validation for payment payloads and requirements.
 * v1 is deprecated - only x402Version=2 is supported.
 */

import type { PaymentRequirements, PaymentPayload } from "@x402/core/types";

/**
 * Basic structure validation to ensure required fields exist
 * Detailed validation is handled by RouterSettlementService
 *
 * @param data - The data to validate
 * @param fieldName - The field name for error messages
 * @returns The data cast to the expected type
 * @throws {Error} If data is missing, not an object, or is an array
 */
export function validateBasicStructure<T>(data: unknown, fieldName: string): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    const error = new Error(`${fieldName} is required and must be an object`);
    error.name = "ValidationError";
    throw error;
  }

  return data as T;
}

/**
 * Validate x402Version (v2-only - must be exactly 2)
 *
 * v1 has been deprecated. All requests must include x402Version=2.
 *
 * @param version - The x402 version to validate (should be number)
 * @throws {Error} If version is missing, not a number, or not 2
 */
export function validateX402Version(version?: unknown): void {
  // Require x402Version to be present (v2 requirement)
  if (version === undefined || version === null) {
    const error = new Error(
      "x402Version is required. v1 is deprecated - please use x402Version=2. " +
        "See https://github.com/nuwa-protocol/x402-exec for migration guide.",
    );
    error.name = "ValidationError";
    throw error;
  }

  // Type check: ensure version is a number
  if (typeof version !== "number") {
    const error = new Error(
      `Invalid x402Version: expected number, got ${typeof version}. ` +
        "v1 is deprecated - please use x402Version=2. " +
        "See https://github.com/nuwa-protocol/x402-exec for migration guide.",
    );
    error.name = "ValidationError";
    throw error;
  }

  // Value check: ensure version is exactly 2 (v1 is deprecated)
  if (version !== 2) {
    const error = new Error(
      `Version not supported: x402Version ${version} is deprecated. ` +
        "Please use x402Version=2. " +
        "See https://github.com/nuwa-protocol/x402-exec for migration guide.",
    );
    error.name = "ValidationError";
    throw error;
  }
}
