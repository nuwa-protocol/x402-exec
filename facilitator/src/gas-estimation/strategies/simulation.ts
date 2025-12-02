/**
 * Simulation-based gas estimation strategy
 *
 * Uses RPC estimateGas to simulate transaction execution and detect reverts.
 * Works for all hooks (built-in and custom).
 *
 * Advantages:
 * - Most accurate
 * - Works for any hook
 * - Detects all failure cases
 *
 * Disadvantages:
 * - Slower (~100-200ms per call)
 * - RPC cost (may be rate-limited)
 */

import type { GasEstimationStrategy, SettlementGasParams, GasEstimationResult } from "./base.js";
import { parseEstimateGasError } from "../utils.js";
import { encodeFunctionData } from "viem";
import { getHookTypeInfo } from "../../hook-validators/index.js";
import { SETTLEMENT_ROUTER_ABI } from "@x402x/core";

export class SimulationBasedGasEstimator implements GasEstimationStrategy {
  readonly strategyName = 'rpc_simulation';

  async estimateGas(params: SettlementGasParams): Promise<GasEstimationResult> {
    const startTime = Date.now();

    try {
      // Prepare transaction data
      const txData = encodeFunctionData({
        abi: SETTLEMENT_ROUTER_ABI,
        functionName: 'settleAndExecute',
        args: [
          params.token as `0x${string}`,
          params.from as `0x${string}`,
          params.value,
          params.authorization.validAfter,
          params.authorization.validBefore,
          params.authorization.nonce as `0x${string}`,
          params.signature as `0x${string}`,
          params.salt as `0x${string}`,
          params.payTo as `0x${string}`,
          params.facilitatorFee,
          params.hook as `0x${string}`,
          params.hookData as `0x${string}`,
        ],
      });

      // Call estimateGas with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Gas estimation timeout')),
          params.gasEstimationConfig.timeoutMs
        );
      });

      const estimatePromise = (params.walletClient as any).estimateGas({
        account: (params.walletClient as any).account?.address,
        to: params.settlementRouter as `0x${string}`,
        data: txData,
        value: 0n,
      });

      const estimatedGas = await Promise.race([estimatePromise, timeoutPromise]);

      // Apply safety multiplier
      const safeGas = Math.floor(
        Number(estimatedGas) * params.gasEstimationConfig.safetyMultiplier
      );

      // Apply max limit constraint
      const constrainedGas = Math.min(safeGas, params.gasCostConfig.maxGasLimit);

      const duration = Date.now() - startTime;

      return {
        gasLimit: constrainedGas,
        isValid: true,
        strategyUsed: 'rpc_simulation',
        metadata: {
          rawEstimate: Number(estimatedGas),
          safetyMultiplier: params.gasEstimationConfig.safetyMultiplier,
          hookType: getHookTypeInfo(params.network, params.hook).hookType,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorReason = parseEstimateGasError(error);

      return {
        gasLimit: 0,
        isValid: false,
        errorReason,
        strategyUsed: 'rpc_simulation',
        metadata: {
          hookType: getHookTypeInfo(params.network, params.hook).hookType,
        },
      };
    }
  }
}
