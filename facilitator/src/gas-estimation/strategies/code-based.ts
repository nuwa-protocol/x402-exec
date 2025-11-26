/**
 * Code-based gas estimation strategy
 *
 * Fast path for built-in hooks - validates parameters and calculates gas
 * using code logic without RPC calls.
 *
 * Advantages:
 * - Very fast (<1ms)
 * - No RPC cost
 * - Can be dynamic (e.g., based on transfer count)
 *
 * Limitations:
 * - Only works for known built-in hooks
 * - Requires manual implementation for each hook type
 *
 * NOTE: This class is responsible for both validation AND gas calculation.
 * It uses HookValidator for validation, but calculates gas overhead itself.
 */

import type { GasEstimationStrategy, SettlementGasParams, GasEstimationResult } from "./base.js";
import { getHookTypeInfo } from "../../hook-validators/index.js";

export class CodeBasedGasEstimator implements GasEstimationStrategy {
  readonly strategyName = 'code_calculation';

  async estimateGas(params: SettlementGasParams): Promise<GasEstimationResult> {
    const hookInfo = getHookTypeInfo(params.network, params.hook);

    // This strategy only supports built-in hooks
    if (!hookInfo.isBuiltIn || !hookInfo.validator) {
      throw new Error(
        `CodeBasedGasEstimator does not support hook: ${params.hook}. ` +
        `Use SimulationBasedGasEstimator or SmartGasEstimator instead.`
      );
    }

    // Step 1: Validate hook parameters using HookValidator
    const validation = hookInfo.validator.validate(
      params.network,
      params.hook,
      params.hookData,
      params.hookAmount,
    );

    if (!validation.isValid) {
      return {
        gasLimit: 0,
        isValid: false,
        errorReason: validation.errorReason,
        strategyUsed: 'code_calculation',
        metadata: { hookType: hookInfo.hookType },
      };
    }

    // Step 2: Calculate gas overhead (Estimator's responsibility)
    const hookOverhead = this.calculateHookOverhead(
      hookInfo.hookType as string || "custom",
      params.hookData,
    );
    const totalGas = params.gasCostConfig.minGasLimit + hookOverhead;

    // Step 3: Apply max limit constraint
    const constrainedGas = Math.min(totalGas, params.gasCostConfig.maxGasLimit);

    return {
      gasLimit: constrainedGas,
      isValid: true,
      strategyUsed: 'code_calculation',
      metadata: {
        rawEstimate: totalGas,
        hookType: hookInfo.hookType,
      },
    };
  }

  /**
   * Calculate gas overhead for a hook
   *
   * This is the Estimator's internal logic, not delegated to HookValidator.
   * Different hook types have different gas characteristics.
   *
   * @param hookType - Type of the hook
   * @param hookData - Encoded hook parameters
   * @returns Gas overhead (excluding base transaction cost)
   */
  private calculateHookOverhead(hookType: string, hookData: string): number {
    switch (hookType) {
      case 'transfer':
        return this.calculateTransferHookOverhead(hookData);

      // Future built-in hooks can be added here
      // case 'swap':
      //   return this.calculateSwapHookOverhead(hookData);

      default:
        // Conservative estimate for unknown hook types
        return 100000;
    }
  }

  /**
   * Calculate gas overhead for TransferHook
   *
   * TransferHook gas cost scales with the number of recipients:
   * - Empty hookData: payTo-only transfer (minimal overhead)
   * - With recipients: base overhead + per-transfer cost
   *
   * @param hookData - Encoded transfer parameters
   * @returns Gas overhead
   */
  private calculateTransferHookOverhead(hookData: string): number {
    // Empty hookData means payTo-only transfer
    if (!hookData || hookData === '0x' || hookData === '') {
      return 15000; // Minimal overhead for simple transfer
    }

    try {
      // Decode hookData to determine transfer count
      const decoded = decodeAbiParameters(
        [{ type: 'address[]' }, { type: 'uint256[]' }],
        hookData as `0x${string}`,
      );

      const recipientCount = decoded[0].length;

      // Base overhead + per-transfer overhead
      const baseOverhead = 25000;
      const perTransferOverhead = 30000;
      return baseOverhead + (perTransferOverhead * recipientCount);

    } catch (error) {
      // If decoding fails, use conservative estimate
      const baseOverhead = 25000;
      const perTransferOverhead = 30000;
      const averageRecipients = 3;
      return baseOverhead + (perTransferOverhead * averageRecipients);
    }
  }
}

// Import here to avoid circular dependency
import { decodeAbiParameters } from "viem";
