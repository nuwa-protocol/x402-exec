/**
 * Gas Cost Calculation Module
 *
 * Calculates minimum facilitator fees based on gas costs, with Hook whitelist validation
 * and gas limit protection to prevent malicious Hook attacks.
 */

import { getLogger } from "./telemetry.js";
import { getNetworkConfig } from "@x402x/core";
import { getGasPrice, type DynamicGasPriceConfig } from "./dynamic-gas-price.js";
import { getTokenPrice, type TokenPriceConfig } from "./token-price.js";

const logger = getLogger();

/**
 * Gas cost configuration
 *
 * Simplified configuration for gas cost calculation and validation.
 * Dynamic gas limit is enabled by default for profitability protection.
 */
export interface GasCostConfig {
  // Gas Limit Configuration
  minGasLimit: number; // Minimum gas limit to ensure transaction can execute (default: 150000)
  maxGasLimit: number; // Absolute upper limit for gas to defend against malicious hooks (default: 5000000)
  dynamicGasLimitMargin: number; // Profit margin reserved when calculating dynamic limit (0-1, default: 0.2 = 20%)

  // Gas Overhead Configuration
  hookGasOverhead: Record<string, number>; // Additional gas required by different hook types
  safetyMultiplier: number; // Safety multiplier for gas estimation (default: 1.5)

  // Fee Validation
  validationTolerance: number; // Tolerance for fee validation to handle price fluctuations (0-1, default: 0.1 = 10%)

  // Hook Security
  hookWhitelistEnabled: boolean; // Enable hook whitelist validation (default: false)
  allowedHooks: Record<string, string[]>; // Whitelist of allowed hook addresses per network

  // Fallback Prices (used when dynamic pricing is unavailable)
  networkGasPrice: Record<string, string>; // Static gas prices per network (Wei)
  nativeTokenPrice: Record<string, number>; // Static native token prices per network (USD)
}

/**
 * Fee calculation result
 */
export interface FeeCalculationResult {
  minFacilitatorFee: string; // Token smallest unit
  minFacilitatorFeeUSD: string; // USD amount
  gasLimit: number;
  maxGasLimit: number;
  gasPrice: string;
  gasCostNative: string;
  gasCostUSD: string;
  safetyMultiplier: number;
  finalCostUSD: string;
  hookAllowed: boolean;
  hookType?: string;
}

/**
 * Check if a hook is in the whitelist
 *
 * @param network - Network name
 * @param hook - Hook address
 * @param config - Gas cost configuration
 * @returns True if hook is allowed
 */
export function isHookAllowed(network: string, hook: string, config: GasCostConfig): boolean {
  // If whitelist is disabled, all hooks are allowed
  if (!config.hookWhitelistEnabled) {
    return true;
  }

  // Get allowed hooks for the network
  const allowedHooks = config.allowedHooks[network] || [];

  // Check if hook is in whitelist (case-insensitive)
  const hookLower = hook.toLowerCase();
  return allowedHooks.some((allowed) => allowed.toLowerCase() === hookLower);
}

/**
 * Determine hook type from address
 *
 * @param network - Network name
 * @param hook - Hook address
 * @returns Hook type identifier
 */
function getHookType(network: string, hook: string): string {
  try {
    const networkConfig = getNetworkConfig(network);
    const hookLower = hook.toLowerCase();

    // Check if it's a known hook
    if (networkConfig.hooks.transfer.toLowerCase() === hookLower) {
      return "transfer";
    }

    // Default to custom for unknown hooks
    return "custom";
  } catch {
    return "custom";
  }
}

/**
 * Get gas limit for a hook
 *
 * @param network - Network name
 * @param hook - Hook address
 * @param config - Gas cost configuration
 * @returns Gas limit
 * @throws Error if hook is not allowed or gas limit exceeds maximum
 */
export function getGasLimit(network: string, hook: string, config: GasCostConfig): number {
  // Check if hook is allowed
  if (!isHookAllowed(network, hook, config)) {
    throw new Error(
      `Hook ${hook} is not in whitelist for network ${network}. ` +
        `This hook is not supported for security reasons.`,
    );
  }

  // Determine hook type
  const hookType = getHookType(network, hook);

  // Calculate gas limit
  const overhead = config.hookGasOverhead[hookType] || config.hookGasOverhead.custom || 100000;
  const gasLimit = config.minGasLimit + overhead;

  // Validate against maximum
  if (gasLimit > config.maxGasLimit) {
    throw new Error(
      `Calculated gas limit ${gasLimit} exceeds maximum ${config.maxGasLimit} for hook ${hook}`,
    );
  }

  logger.debug(
    {
      network,
      hook,
      hookType,
      minGasLimit: config.minGasLimit,
      overhead,
      gasLimit,
    },
    "Calculated gas limit",
  );

  return gasLimit;
}

/**
 * Validate gas limit doesn't exceed maximum
 *
 * @param gasLimit - Gas limit to validate
 * @param config - Gas cost configuration
 * @throws Error if gas limit exceeds maximum
 */
export function validateGasLimit(gasLimit: number, config: GasCostConfig): void {
  if (gasLimit > config.maxGasLimit) {
    throw new Error(`Gas limit ${gasLimit} exceeds maximum ${config.maxGasLimit}`);
  }
}

/**
 * Convert native token amount to USD
 *
 * @param nativeAmount - Amount in native token (e.g., ETH)
 * @param network - Network name
 * @param config - Gas cost configuration
 * @param tokenPriceConfig - Optional token price configuration for dynamic pricing
 * @returns USD amount as string
 */
export async function convertNativeToUsd(
  nativeAmount: string,
  network: string,
  config: GasCostConfig,
  tokenPriceConfig?: TokenPriceConfig,
): Promise<string> {
  const staticPrice = config.nativeTokenPrice[network];
  if (!staticPrice) {
    throw new Error(`No native token price configured for network ${network}`);
  }

  // Get price (dynamic or static)
  const nativePrice = await getTokenPrice(network, staticPrice, tokenPriceConfig);

  const usdAmount = parseFloat(nativeAmount) * nativePrice;
  // Use higher precision (6 decimals) to avoid rounding small amounts to zero
  return usdAmount.toFixed(6);
}

/**
 * Convert USD amount to token smallest unit
 *
 * @param usdAmount - USD amount as string
 * @param decimals - Token decimals
 * @returns Token amount in smallest unit as string
 */
export function convertUsdToToken(usdAmount: string, decimals: number): string {
  const amount = parseFloat(usdAmount) * Math.pow(10, decimals);
  return Math.ceil(amount).toString();
}

/**
 * Calculate effective gas limit with triple constraints
 *
 * This function implements dynamic gas limit calculation based on the facilitator fee,
 * while maintaining absolute safety bounds:
 * 1. Minimum limit: Ensures transaction can execute (basic settlement operations)
 * 2. Maximum limit: Absolute cap to defend against malicious hooks
 * 3. Dynamic limit: Based on facilitator fee to prevent unprofitable settlements
 *
 * Dynamic gas limit is always enabled. To use static limit only, set
 * dynamicGasLimitMargin to 0, which makes all fees available for gas.
 *
 * @param facilitatorFee - Facilitator fee in token's smallest unit (e.g., USDC with 6 decimals)
 * @param gasPrice - Current gas price in Wei
 * @param nativeTokenPrice - Native token price in USD (e.g., ETH price)
 * @param config - Gas cost configuration
 * @returns Effective gas limit to use for the transaction
 *
 * @example
 * ```typescript
 * // Fee = 1 USDC, Gas = 10 gwei, ETH = $3000, Margin = 20%
 * // Available for gas = $1.00 * 0.8 = $0.80
 * // Max affordable gas = $0.80 / $3000 * 1e18 / 10e9 = 26,666 gas
 * // Result = max(150000, min(26666, 500000)) = 150000 (use minimum)
 *
 * // Fee = 10 USDC
 * // Available = $8.00
 * // Max affordable = 266,666 gas
 * // Result = max(150000, min(266666, 500000)) = 266,666 (use dynamic)
 *
 * // Fee = 100 USDC
 * // Max affordable = 2,666,666 gas
 * // Result = max(150000, min(2666666, 500000)) = 500,000 (use maximum)
 * ```
 */
export function calculateEffectiveGasLimit(
  facilitatorFee: string,
  gasPrice: string,
  nativeTokenPrice: number,
  config: GasCostConfig,
): number {
  // Convert facilitator fee to USD (assuming 6 decimals for USDC)
  const feeUSD = parseFloat(facilitatorFee) / 1e6;

  // Calculate available amount for gas (after reserving profit margin)
  const availableForGasUSD = feeUSD * (1 - config.dynamicGasLimitMargin);

  // Protect against invalid token price (zero or negative)
  // If price is invalid, return minimum gas limit as safety fallback
  if (nativeTokenPrice <= 0 || !Number.isFinite(nativeTokenPrice)) {
    return config.minGasLimit;
  }

  // Calculate how much gas we can afford
  // Formula: (availableUSD / tokenPrice) * 1e18 Wei / gasPrice Wei
  const gasPriceBigInt = BigInt(gasPrice);

  // Convert available USD to Wei that can be spent on gas
  const availableWei = (availableForGasUSD / nativeTokenPrice) * 1e18;

  // Calculate maximum affordable gas
  const maxAffordableGas = Math.floor(availableWei / Number(gasPriceBigInt));

  // Apply triple constraints:
  // 1. Not less than minimum (ensure transaction can execute)
  // 2. Not more than maximum (absolute safety cap)
  // 3. Not more than affordable (profit protection)
  const effectiveGasLimit = Math.max(
    config.minGasLimit,
    Math.min(maxAffordableGas, config.maxGasLimit),
  );

  return effectiveGasLimit;
}

/**
 * Calculate minimum facilitator fee
 *
 * @param network - Network name
 * @param hook - Hook address
 * @param tokenDecimals - Token decimals (e.g., 6 for USDC)
 * @param config - Gas cost configuration
 * @param dynamicConfig - Optional dynamic gas price configuration
 * @param tokenPriceConfig - Optional token price configuration
 * @returns Fee calculation result
 * @throws Error if hook is not allowed or calculation fails
 */
export async function calculateMinFacilitatorFee(
  network: string,
  hook: string,
  tokenDecimals: number,
  config: GasCostConfig,
  dynamicConfig?: DynamicGasPriceConfig,
  tokenPriceConfig?: TokenPriceConfig,
): Promise<FeeCalculationResult> {
  // Check if hook is allowed
  const hookAllowed = isHookAllowed(network, hook, config);
  if (!hookAllowed) {
    throw new Error(
      `Hook ${hook} is not in whitelist for network ${network}. ` +
        `Allowed hooks: ${(config.allowedHooks[network] || []).join(", ")}`,
    );
  }

  // Get gas limit
  const gasLimit = getGasLimit(network, hook, config);
  const hookType = getHookType(network, hook);

  // Get gas price (dynamic or static)
  const gasPrice = await getGasPrice(network, config, dynamicConfig);

  // Calculate gas cost in Wei
  const gasCostWei = BigInt(gasLimit) * BigInt(gasPrice);

  // Convert to native token (divide by 10^18)
  // Use higher precision (18 decimals) to preserve small values
  const gasCostNative = (Number(gasCostWei) / Math.pow(10, 18)).toString();

  // Convert to USD (with dynamic or static token price)
  const gasCostUSD = await convertNativeToUsd(gasCostNative, network, config, tokenPriceConfig);

  // Apply safety multiplier
  const finalCostUSD = (parseFloat(gasCostUSD) * config.safetyMultiplier).toFixed(6);

  // Convert to token smallest unit
  const minFacilitatorFee = convertUsdToToken(finalCostUSD, tokenDecimals);

  logger.debug(
    {
      network,
      hook,
      hookType,
      gasLimit,
      gasPrice,
      gasCostNative,
      gasCostUSD,
      finalCostUSD,
      minFacilitatorFee,
    },
    "Calculated minimum facilitator fee",
  );

  // Format gasCostNative for display (up to 18 decimals, remove trailing zeros)
  const gasCostNativeFormatted = parseFloat(gasCostNative)
    .toFixed(18)
    .replace(/\.?0+$/, "");

  return {
    minFacilitatorFee,
    minFacilitatorFeeUSD: finalCostUSD,
    gasLimit,
    maxGasLimit: config.maxGasLimit,
    gasPrice,
    gasCostNative: gasCostNativeFormatted,
    gasCostUSD,
    safetyMultiplier: config.safetyMultiplier,
    finalCostUSD,
    hookAllowed,
    hookType,
  };
}
