/**
 * Smart gas estimation strategy
 *
 * Automatically selects the best strategy based on hook type:
 * - Built-in hooks → CodeBasedGasEstimator (fast path)
 * - Custom hooks → SimulationBasedGasEstimator (accurate path)
 *
 * Falls back to simulation if code estimation fails.
 */

import type {
  GasEstimationStrategy,
  SettlementGasParams,
  GasEstimationResult,
  GasEstimationConfig,
} from "./base.js";
import { CodeBasedGasEstimator } from "./code-based.js";
import { SimulationBasedGasEstimator } from "./simulation.js";
import { getHookTypeInfo } from "../../hook-validators/index.js";
import type { Logger } from "pino";

export class SmartGasEstimator implements GasEstimationStrategy {
  readonly strategyName = "smart";

  constructor(
    private codeEstimator: CodeBasedGasEstimator,
    private simulationEstimator: SimulationBasedGasEstimator,
    private config: GasEstimationConfig,
    private logger: Logger,
  ) {}

  async estimateGas(params: SettlementGasParams): Promise<GasEstimationResult> {
    const hookInfo = getHookTypeInfo(params.network, params.hook);

    // Try code-based estimation for built-in hooks (if enabled)
    if (this.config.codeValidationEnabled && hookInfo.isBuiltIn && hookInfo.validator) {
      try {
        this.logger.debug(
          { network: params.network, hook: params.hook, hookType: hookInfo.hookType },
          "Using code-based gas estimation (fast path)",
        );

        return await this.codeEstimator.estimateGas(params);
      } catch (error) {
        this.logger.warn(
          { error, network: params.network, hook: params.hook },
          "Code-based estimation failed, falling back to simulation",
        );
        // Fall through to simulation
      }
    }

    // Use simulation for custom hooks or as fallback
    this.logger.debug(
      {
        network: params.network,
        hook: params.hook,
        hookType: hookInfo.hookType,
        isBuiltIn: hookInfo.isBuiltIn,
        reason: hookInfo.isBuiltIn ? "code_validation_disabled" : "custom_hook",
      },
      "Using simulation-based gas estimation",
    );

    return await this.simulationEstimator.estimateGas(params);
  }
}
