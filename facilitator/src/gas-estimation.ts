/**
 * Gas Estimation and Validation Module
 *
 * Provides pre-validation for settlement transactions using code validation for built-in hooks
 * and estimateGas for custom hooks. Also provides dynamic gas limit calculation.
 */

import { encodeFunctionData, type Hex } from "viem";
import { SETTLEMENT_ROUTER_ABI } from "@x402x/core";
import { getLogger, recordMetric, recordHistogram } from "./telemetry.js";
import { getHookTypeInfo, validateHookData, getHookGasOverhead } from "./hook-validators/index.js";
import type { GasEstimationResult } from "./hook-validators/types.js";
import type { GasCostConfig } from "./gas-cost.js";

const logger = getLogger();

/**
 * Gas estimation configuration
 */
export interface GasEstimationConfig {
  /** Whether to enable code validation for built-in hooks */
  codeValidationEnabled: boolean;
  /** Gas estimation safety multiplier (default: 1.2 = 20% buffer) */
  safetyMultiplier: number;
  /** Gas estimation timeout in milliseconds */
  timeoutMs: number;
}

/**
 * Settlement parameters for gas estimation
 */
export interface SettlementEstimationParams {
  /** Network name */
  network: string;
  /** Hook address */
  hook: string;
  /** Hook data (ABI encoded) */
  hookData: string;
  /** Settlement router address */
  settlementRouter: string;
  /** Token address */
  token: string;
  /** Payer address */
  from: string;
  /** Payment value */
  value: bigint;
  /** Authorization details */
  authorization: {
    validAfter: number;
    validBefore: number;
    nonce: string;
  };
  /** Signature */
  signature: string;
  /** Salt for idempotency */
  salt: string;
  /** Pay-to address */
  payTo: string;
  /** Facilitator fee */
  facilitatorFee: bigint;
  /** Hook amount (value - facilitatorFee) */
  hookAmount: bigint;
  /** Wallet client for gas estimation */
  walletClient: any; // EVM wallet client with estimateGas method
  /** Gas cost configuration */
  gasCostConfig: GasCostConfig;
}

/**
 * Parse estimateGas error and extract meaningful error reason
 *
 * @param error - Error from estimateGas call
 * @returns Parsed error reason
 */
export function parseEstimateGasError(error: any): string {
  try {
    // Check if it's a revert error with data
    if (error?.data) {
      const revertData = error.data as string;

      // Try to decode common error signatures
      if (revertData.startsWith('0x08c379a0')) { // Error(string)
        // This is a standard Error(string) revert
        // The data after the selector contains the error message
        // For simplicity, return a generic message since full decoding would require more complex logic
        return 'Hook execution failed - invalid parameters or logic error';
      }

      if (revertData.startsWith('0x4e487b71')) { // Panic(uint256)
        return 'Hook execution panicked - potential gas limit or arithmetic error';
      }

      // Check for specific SettlementRouter errors
      if (revertData.includes('HookExecutionFailed')) {
        return 'Hook execution failed - check hook parameters and contract logic';
      }

      if (revertData.includes('TransferFailed')) {
        return 'Token transfer failed - insufficient balance or allowance';
      }

      if (revertData.includes('InvalidCommitment')) {
        return 'Invalid commitment - nonce or authorization mismatch';
      }

      if (revertData.includes('AlreadySettled')) {
        return 'Transaction already settled - duplicate attempt';
      }

      // Generic revert with data
      return `Transaction reverted with data: ${revertData}`;
    }

    // Check error message
    const message = error?.message || '';
    if (message.includes('execution reverted')) {
      return 'Transaction execution reverted - check all parameters';
    }

    if (message.includes('gas required exceeds allowance')) {
      return 'Gas limit exceeded - transaction too complex';
    }

    if (message.includes('insufficient funds')) {
      return 'Insufficient funds for gas - check wallet balance';
    }

    if (message.includes('nonce too low')) {
      return 'Nonce error - transaction ordering issue';
    }

    // Generic error
    return `Gas estimation failed: ${message || 'Unknown error'}`;

  } catch (parseError) {
    // If parsing fails, return a safe fallback
    return 'Gas estimation failed - unable to determine cause';
  }
}

/**
 * Calculate safe gas limit with constraints
 *
 * @param estimatedGas - Raw gas estimate from estimateGas
 * @param config - Gas estimation configuration
 * @param gasCostConfig - Gas cost configuration for limits
 * @returns Safe gas limit to use
 */
export function calculateSafeGasLimit(
  estimatedGas: bigint,
  config: GasEstimationConfig,
  gasCostConfig: GasCostConfig,
): number {
  // Apply safety multiplier
  const safeGas = Number(estimatedGas) * config.safetyMultiplier;

  // Apply constraints
  const constrainedGas = Math.max(
    gasCostConfig.minGasLimit,
    Math.min(safeGas, gasCostConfig.maxGasLimit),
  );

  return Math.ceil(constrainedGas);
}

/**
 * Estimate gas for settlement transaction using estimateGas
 *
 * @param params - Settlement parameters
 * @param config - Gas estimation configuration
 * @returns Gas estimation result
 */
export async function estimateGasForSettlement(
  params: SettlementEstimationParams,
  config: GasEstimationConfig,
): Promise<GasEstimationResult> {
  const startTime = Date.now();

  try {
    logger.debug({
      network: params.network,
      hook: params.hook,
      from: params.from,
    }, 'Starting gas estimation for settlement');

    // Prepare transaction data for estimateGas
    const txData = encodeFunctionData({
      abi: SETTLEMENT_ROUTER_ABI,
      functionName: 'settleAndExecute',
      args: [
        params.token as Hex,
        params.from as Hex,
        params.value,
        BigInt(params.authorization.validAfter),
        BigInt(params.authorization.validBefore),
        params.authorization.nonce as Hex,
        params.signature as Hex,
        params.salt as Hex,
        params.payTo as Hex,
        params.facilitatorFee,
        params.hook as Hex,
        params.hookData as Hex,
      ],
    });

    // Estimate gas with timeout
    const estimatePromise = params.walletClient.estimateGas({
      account: params.walletClient.account, // Use wallet client's account
      to: params.settlementRouter as Hex,
      data: txData,
      value: 0n, // No ETH value for settlement
    });

    // Apply timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Gas estimation timeout')), config.timeoutMs);
    });

    const estimatedGas = await Promise.race([estimatePromise, timeoutPromise]);

    // Calculate safe gas limit
    const safeGasLimit = calculateSafeGasLimit(estimatedGas, config, params.gasCostConfig);

    const duration = Date.now() - startTime;
    logger.debug({
      network: params.network,
      hook: params.hook,
      estimatedGas: Number(estimatedGas),
      safeGasLimit,
      duration,
    }, 'Gas estimation completed successfully');

    // Record metrics
    recordMetric("facilitator.settlement.gas_estimation.success", 1, {
      network: params.network,
      hook_type: getHookTypeInfo(params.network, params.hook).hookType || "custom" as string,
    });
    recordHistogram("facilitator.settlement.gas_estimation.duration_ms", duration, {
      network: params.network,
      hook_type: getHookTypeInfo(params.network, params.hook).hookType || "custom" as string,
      method: "gas_estimation",
    });

    return {
      isValid: true,
      gasLimit: safeGasLimit,
      validationMethod: 'gas_estimation',
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorReason = parseEstimateGasError(error);

    logger.warn({
      error,
      network: params.network,
      hook: params.hook,
      duration,
      errorReason,
    }, 'Gas estimation failed');

    // Record failure metrics
    recordMetric("facilitator.settlement.gas_estimation.failed", 1, {
      network: params.network,
      hook_type: getHookTypeInfo(params.network, params.hook).hookType || "custom" as string,
      error_type: errorReason.split(' ')[0], // First word of error for categorization
    });
    recordHistogram("facilitator.settlement.gas_estimation.duration_ms", duration, {
      network: params.network,
      hook_type: getHookTypeInfo(params.network, params.hook).hookType || "custom" as string,
      method: "gas_estimation",
      success: false,
    });

    return {
      isValid: false,
      errorReason,
      validationMethod: 'gas_estimation',
    };
  }
}

/**
 * Estimate and validate settlement transaction
 *
 * Main entry point that chooses between code validation (built-in hooks)
 * and gas estimation (custom hooks) based on hook type.
 *
 * @param params - Settlement parameters
 * @param config - Gas estimation configuration
 * @returns Validation and gas estimation result
 */
export async function estimateAndValidateSettlement(
  params: SettlementEstimationParams,
  config: GasEstimationConfig,
): Promise<GasEstimationResult> {
  const hookInfo = getHookTypeInfo(params.network, params.hook);

  // For built-in hooks, try code validation first (if enabled)
  if (hookInfo.isBuiltIn && config.codeValidationEnabled) {
    const codeValidation = validateHookData(
      params.network,
      params.hook,
      params.hookData,
      params.hookAmount,
    );

    if (!codeValidation.isValid) {
      logger.warn({
        network: params.network,
        hook: params.hook,
        errorReason: codeValidation.errorReason,
      }, 'Built-in hook code validation failed');

      // Record code validation failure metrics
      recordMetric("facilitator.settlement.validation.code.failed", 1, {
        network: params.network,
        hook_type: hookInfo.hookType || "custom",
        error_type: (codeValidation.errorReason || "unknown").split(' ')[0], // First word for categorization
      });

      return {
        isValid: false,
        errorReason: codeValidation.errorReason,
        validationMethod: 'code_validation',
      };
    }

    // Code validation passed, use static gas limit
    const gasOverhead = getHookGasOverhead(params.network, params.hook, params.hookData);
    const gasLimit = params.gasCostConfig.minGasLimit + gasOverhead;

    // Apply max limit constraint
    const constrainedGasLimit = Math.min(gasLimit, params.gasCostConfig.maxGasLimit);

    logger.debug({
      network: params.network,
      hook: params.hook,
      hookType: hookInfo.hookType,
      gasLimit: constrainedGasLimit,
      method: 'code_validation',
    }, 'Built-in hook validated with static gas limit');

    // Record code validation success metrics
    recordMetric("facilitator.settlement.validation.code.success", 1, {
      network: params.network,
      hook_type: hookInfo.hookType || "custom",
    });

    return {
      isValid: true,
      gasLimit: constrainedGasLimit,
      validationMethod: 'code_validation',
    };
  }

  // For custom hooks or when code validation is disabled, use gas estimation
  logger.debug({
    network: params.network,
    hook: params.hook,
    isBuiltIn: hookInfo.isBuiltIn,
    codeValidationEnabled: config.codeValidationEnabled,
  }, 'Using gas estimation for validation');

  return await estimateGasForSettlement(params, config);
}
