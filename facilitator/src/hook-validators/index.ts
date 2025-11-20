/**
 * Hook Validators
 *
 * Provides validation for built-in hooks and identification of hook types.
 * Routes validation requests to appropriate validators based on hook type.
 */

import { getNetworkConfig } from "@x402x/core";
import { TransferHookValidator } from "./transfer-hook.js";
import type { HookValidator, HookTypeInfo, HookValidationResult } from "./types.js";
import { BuiltInHookType } from "./types.js";

/**
 * Global instances of built-in validators
 */
const validators = {
  [BuiltInHookType.TRANSFER]: new TransferHookValidator(),
};

/**
 * Check if a hook address corresponds to a built-in hook
 *
 * @param network - Network name
 * @param hookAddress - Hook contract address
 * @returns Hook type information
 */
export function getHookTypeInfo(network: string, hookAddress: string): HookTypeInfo {
  try {
    const networkConfig = getNetworkConfig(network);
    const hookLower = hookAddress.toLowerCase();

    // Check if it's the transfer hook
    if (networkConfig.hooks?.transfer?.toLowerCase() === hookLower) {
      return {
        isBuiltIn: true,
        hookType: BuiltInHookType.TRANSFER,
        validator: validators[BuiltInHookType.TRANSFER],
      };
    }

    // TODO: Add more built-in hooks here as they are implemented
    // if (networkConfig.hooks?.nftMint?.toLowerCase() === hookLower) {
    //   return {
    //     isBuiltIn: true,
    //     hookType: BuiltInHookType.NFT_MINT,
    //     validator: validators[BuiltInHookType.NFT_MINT],
    //   };
    // }

    // Not a built-in hook
    return {
      isBuiltIn: false,
    };

  } catch (error) {
    // If network config fails, assume it's not built-in
    return {
      isBuiltIn: false,
    };
  }
}

/**
 * Check if a hook is a built-in hook (convenience function)
 *
 * @param network - Network name
 * @param hookAddress - Hook contract address
 * @returns True if this is a built-in hook
 */
export function isBuiltInHook(network: string, hookAddress: string): boolean {
  return getHookTypeInfo(network, hookAddress).isBuiltIn;
}

/**
 * Validate hook data using appropriate validator
 *
 * For built-in hooks, uses code validation.
 * For custom hooks, returns success (validation deferred to gas estimation).
 *
 * @param network - Network name
 * @param hookAddress - Hook contract address
 * @param hookData - Encoded hook parameters
 * @param hookAmount - Amount available for hook execution
 * @returns Validation result
 */
export function validateHookData(
  network: string,
  hookAddress: string,
  hookData: string,
  hookAmount: bigint,
): HookValidationResult {
  const hookInfo = getHookTypeInfo(network, hookAddress);

  // For built-in hooks, use code validation
  if (hookInfo.isBuiltIn && hookInfo.validator) {
    return hookInfo.validator.validate(network, hookAddress, hookData, hookAmount);
  }

  // For custom hooks, defer validation to gas estimation
  // This allows custom hooks to work while still being validated via estimateGas
  return {
    isValid: true,
    validationMethod: 'gas_estimation', // Will be validated by estimateGas
  };
}

/**
 * Get gas overhead for a hook
 *
 * @param network - Network name
 * @param hookAddress - Hook contract address
 * @param hookData - Optional hook data for dynamic overhead calculation
 * @returns Gas overhead in addition to base transaction cost
 */
export function getHookGasOverhead(network: string, hookAddress: string, hookData?: string): number {
  const hookInfo = getHookTypeInfo(network, hookAddress);

  // For built-in hooks, use validator's gas calculation
  if (hookInfo.isBuiltIn && hookInfo.validator) {
    return hookInfo.validator.getGasOverhead(network, hookAddress, hookData);
  }

  // For custom hooks, return a conservative default
  // This will be overridden by dynamic gas estimation in most cases
  return 100000; // Conservative estimate for unknown hooks
}

/**
 * Get validator for a built-in hook (for advanced usage)
 *
 * @param hookType - Built-in hook type
 * @returns Validator instance or null if not found
 */
export function getValidator(hookType: BuiltInHookType): HookValidator | null {
  return validators[hookType] || null;
}
