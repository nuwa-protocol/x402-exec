/**
 * Validation Helpers for Routes
 *
 * Provides basic structure validation for payment payloads and requirements.
 * Detailed validation is handled by the VersionDispatcher.
 */

import type { PaymentRequirements, PaymentPayload } from "x402/types";

/**
 * Basic structure validation to ensure required fields exist
 * Detailed validation is handled by VersionDispatcher
 *
 * @param data - The data to validate
 * @param fieldName - The field name for error messages
 * @returns The data cast to the expected type
 * @throws {Error} If data is missing, not an object, or is an array
 */
export function validateBasicStructure<T>(
  data: unknown,
  fieldName: string
): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const error = new Error(`${fieldName} is required and must be an object`);
    error.name = "ValidationError";
    throw error;
  }

  return data as T;
}

/**
 * Validate x402Version if present (1 or 2)
 *
 * @param version - The x402 version to validate
 * @throws {Error} If version is not 1 or 2
 */
export function validateX402Version(version?: number): void {
  if (version !== undefined && version !== 1 && version !== 2) {
    const error = new Error(`Invalid x402Version: ${version}. Only versions 1 and 2 are supported.`);
    error.name = "ValidationError";
    throw error;
  }
}
