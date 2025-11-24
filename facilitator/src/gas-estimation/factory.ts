/**
 * Gas Estimation Strategy Factory
 *
 * Creates gas estimation strategies based on configuration.
 */

import type { GasEstimationStrategy, GasEstimationConfig } from "./strategies/base.js";
import { CodeBasedGasEstimator } from "./strategies/code-based.js";
import { SimulationBasedGasEstimator } from "./strategies/simulation.js";
import { SmartGasEstimator } from "./strategies/smart.js";
import type { Logger } from "pino";

/**
 * Create gas estimation strategy based on configuration
 */
export function createGasEstimator(
  config: GasEstimationConfig,
  logger: Logger,
): GasEstimationStrategy {
  const codeEstimator = new CodeBasedGasEstimator();
  const simulationEstimator = new SimulationBasedGasEstimator();

  switch (config.strategy) {
    case 'code':
      logger.info('Using code-based gas estimation strategy (forced)');
      return codeEstimator;

    case 'simulation':
      logger.info('Using simulation-based gas estimation strategy (forced)');
      return simulationEstimator;

    case 'smart':
    default:
      logger.info(
        { codeValidationEnabled: config.codeValidationEnabled },
        'Using smart gas estimation strategy (auto-select)'
      );
      return new SmartGasEstimator(
        codeEstimator,
        simulationEstimator,
        config,
        logger,
      );
  }
}
