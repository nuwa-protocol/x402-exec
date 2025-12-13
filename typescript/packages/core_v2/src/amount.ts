/**
 * Amount parsing and formatting utilities for x402x default asset (USDC)
 */

import type { Network } from "@x402/core/types";
import { processPriceToAtomicAmount, getDefaultAsset } from "./network-utils.js";

/**
 * Error class for amount-related validation errors
 */
export class AmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AmountError";
  }
}

/**
 * Parse amount from various formats to atomic units for the default asset (USDC)
 *
 * Supports multiple input formats:
 * - Dollar format: '$1.2' or '$1.20' → '1200000' (1.2 USDC)
 * - Decimal string: '1.2' or '1.20' → '1200000'
 * - Number: 1.2 → '1200000'
 *
 * Uses x402's processPriceToAtomicAmount for parsing. All string/number inputs
 * are treated as USD amounts, not atomic units.
 *
 * @param amount - Amount in various formats (USD, not atomic units)
 * @param network - Network name (required) - used to determine token decimals
 * @returns Amount in atomic units as string
 * @throws AmountError if amount format is invalid
 *
 * @example
 * ```typescript
 * parseDefaultAssetAmount('$1.2', 'base-sepolia')      // '1200000'
 * parseDefaultAssetAmount('1.2', 'base-sepolia')        // '1200000'
 * parseDefaultAssetAmount(1.2, 'base-sepolia')          // '1200000'
 * parseDefaultAssetAmount('100', 'base-sepolia')       // '100000000' (100 USDC, not 100 atomic units)
 * ```
 */
export function parseDefaultAssetAmount(amount: string | number, network: Network): string {
  // Handle empty/invalid input
  if (amount === null || amount === undefined || amount === "") {
    throw new AmountError("Amount is required");
  }

  // Use x402's processPriceToAtomicAmount for parsing
  // This handles all string/number inputs as USD amounts
  const result = processPriceToAtomicAmount(amount, network);

  if ("error" in result) {
    throw new AmountError(`Invalid amount format: ${result.error}`);
  }

  return result.maxAmountRequired;
}

/**
 * Format atomic units to human-readable decimal string for the default asset (USDC)
 *
 * Automatically determines decimals from the network's default asset configuration.
 *
 * @param amount - Amount in atomic units
 * @param network - Network name (required) - used to determine token decimals
 * @returns Human-readable decimal string
 * @throws AmountError if amount is invalid
 *
 * @example
 * ```typescript
 * formatDefaultAssetAmount('1200000', 'base-sepolia')  // '1.2'
 * formatDefaultAssetAmount('1000000', 'base-sepolia')  // '1'
 * formatDefaultAssetAmount('1', 'base-sepolia')        // '0.000001'
 * ```
 */
export function formatDefaultAssetAmount(amount: string, network: Network): string {
  const atomicAmount = BigInt(amount);
  if (atomicAmount < 0n) {
    throw new AmountError("Amount cannot be negative");
  }

  // Get decimals from network's default asset
  const asset = getDefaultAsset(network);
  const decimals = asset.decimals;

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
