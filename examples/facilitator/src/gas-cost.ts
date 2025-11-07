/**
 * Gas Cost Calculation Module
 *
 * Calculates minimum facilitator fees based on gas costs, with Hook whitelist validation
 * and gas limit protection to prevent malicious Hook attacks.
 */

import { getLogger } from "./telemetry.js";
import { getNetworkConfig } from "@x402x/core";
import { getGasPrice, type DynamicGasPriceConfig } from "./dynamic-gas-price.js";

const logger = getLogger();

/**
 * Gas cost configuration
 */
export interface GasCostConfig {
  enabled: boolean;
  baseGasLimit: number;
  hookGasOverhead: Record<string, number>;
  safetyMultiplier: number;
  networkGasPrice: Record<string, string>;
  nativeTokenPrice: Record<string, number>;
  maxGasLimit: number;
  hookWhitelistEnabled: boolean;
  allowedHooks: Record<string, string[]>;
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
  const gasLimit = config.baseGasLimit + overhead;

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
      baseGasLimit: config.baseGasLimit,
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
 * @returns USD amount as string
 */
export function convertNativeToUsd(
  nativeAmount: string,
  network: string,
  config: GasCostConfig,
): string {
  const nativePrice = config.nativeTokenPrice[network];
  if (!nativePrice) {
    throw new Error(`No native token price configured for network ${network}`);
  }

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
 * Calculate minimum facilitator fee
 *
 * @param network - Network name
 * @param hook - Hook address
 * @param tokenDecimals - Token decimals (e.g., 6 for USDC)
 * @param config - Gas cost configuration
 * @param dynamicConfig - Optional dynamic gas price configuration
 * @returns Fee calculation result
 * @throws Error if hook is not allowed or calculation fails
 */
export async function calculateMinFacilitatorFee(
  network: string,
  hook: string,
  tokenDecimals: number,
  config: GasCostConfig,
  dynamicConfig?: DynamicGasPriceConfig,
): Promise<FeeCalculationResult> {
  // Check if validation is enabled
  if (!config.enabled) {
    return {
      minFacilitatorFee: "0",
      minFacilitatorFeeUSD: "0.00",
      gasLimit: 0,
      maxGasLimit: config.maxGasLimit,
      gasPrice: "0",
      gasCostNative: "0",
      gasCostUSD: "0.00",
      safetyMultiplier: config.safetyMultiplier,
      finalCostUSD: "0.00",
      hookAllowed: true,
    };
  }

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

  // Convert to USD
  const gasCostUSD = convertNativeToUsd(gasCostNative, network, config);

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
  const gasCostNativeFormatted = parseFloat(gasCostNative).toFixed(18).replace(/\.?0+$/, "");

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
