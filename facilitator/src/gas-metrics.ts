/**
 * Gas Metrics Calculation Module
 *
 * Provides utilities for calculating and tracking gas costs and profitability
 * of settlement transactions. This is facilitator-specific monitoring logic.
 */

/**
 * Gas metrics for settlement transaction monitoring
 */
export interface GasMetrics {
  /** Actual gas used by the transaction */
  gasUsed: string;
  /** Effective gas price (in Wei) */
  effectiveGasPrice: string;
  /** Actual gas cost in native token (ETH/BNB/etc.) */
  actualGasCostNative: string;
  /** Actual gas cost in USD */
  actualGasCostUSD: string;
  /** Facilitator fee that was charged (in token's smallest unit) */
  facilitatorFee: string;
  /** Facilitator fee in USD */
  facilitatorFeeUSD: string;
  /** Profit/loss amount (facilitatorFee - actualGasCost, in USD) */
  profitUSD: string;
  /** Profit margin as percentage */
  profitMarginPercent: string;
  /** Whether this settlement was profitable */
  profitable: boolean;
  /** Hook address for this settlement */
  hook: string;
  /** Network native token price in USD */
  nativeTokenPriceUSD: string;
}

/**
 * Calculate gas metrics from transaction receipt
 *
 * @param receipt - Transaction receipt from the blockchain
 * @param receipt.gasUsed - Amount of gas used by the transaction
 * @param receipt.effectiveGasPrice - Effective gas price in Wei
 * @param facilitatorFee - Facilitator fee in token's smallest unit
 * @param hook - Hook contract address
 * @param network - Network name
 * @param nativeTokenPriceUSD - Native token price in USD (optional, defaults to 0)
 * @param tokenDecimals - Token decimals (e.g., 6 for USDC, defaults to 6)
 * @returns Gas metrics for monitoring
 *
 * Note: This function is currently only used for EVM chains where native tokens
 * (ETH, BNB, AVAX, OKB, etc.) all use 18 decimals. If supporting non-EVM chains
 * in the future, a nativeTokenDecimals parameter should be added.
 */
export function calculateGasMetrics(
  receipt: { gasUsed: bigint; effectiveGasPrice: bigint },
  facilitatorFee: string,
  hook: string,
  network: string,
  nativeTokenPriceUSD = "0",
  tokenDecimals = 6, // Default to USDC decimals
): GasMetrics {
  // Extract gas information from receipt
  const gasUsed = receipt.gasUsed.toString();
  const effectiveGasPrice = receipt.effectiveGasPrice.toString();

  // Calculate actual gas cost in native token (Wei → ETH/BNB/etc.)
  const gasUsedBigInt = BigInt(gasUsed);
  const effectiveGasPriceBigInt = BigInt(effectiveGasPrice);
  const actualGasCostWei = gasUsedBigInt * effectiveGasPriceBigInt;

  // Convert from Wei to native token using BigInt arithmetic to maintain precision
  // All EVM chains use 18 decimals for native tokens (1 ETH = 10^18 Wei)
  const nativeTokenDecimals = BigInt(10 ** 18);

  // Format to string with proper decimal places
  const integerPart = actualGasCostWei / nativeTokenDecimals;
  const fractionalPart = actualGasCostWei % nativeTokenDecimals;
  const actualGasCostNative = `${integerPart}.${fractionalPart.toString().padStart(18, "0")}`;

  // Remove trailing zeros for cleaner display
  const actualGasCostNativeFormatted = actualGasCostNative.replace(/\.?0+$/, "") || "0";

  // Calculate actual gas cost in USD
  const nativePrice = parseFloat(nativeTokenPriceUSD) || 0;
  const actualGasCostUSD = (parseFloat(actualGasCostNative) * nativePrice).toFixed(6);

  // Calculate facilitator fee in USD using provided token decimals
  const facilitatorFeeUSD = (parseFloat(facilitatorFee) / Math.pow(10, tokenDecimals)).toFixed(6);

  // Calculate profit/loss
  const profitUSD = (parseFloat(facilitatorFeeUSD) - parseFloat(actualGasCostUSD)).toFixed(6);

  // Calculate profit margin percentage
  const profitMarginPercent =
    parseFloat(facilitatorFeeUSD) > 0
      ? ((parseFloat(profitUSD) / parseFloat(facilitatorFeeUSD)) * 100).toFixed(2)
      : "0.00";

  const profitable = parseFloat(profitUSD) >= 0;

  return {
    gasUsed,
    effectiveGasPrice,
    actualGasCostNative: actualGasCostNativeFormatted,
    actualGasCostUSD,
    facilitatorFee,
    facilitatorFeeUSD,
    profitUSD,
    profitMarginPercent,
    profitable,
    hook,
    nativeTokenPriceUSD: nativePrice.toFixed(2),
  };
}
