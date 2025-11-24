/**
 * Gas Estimation Module
 *
 * Unified gas estimation for settlement transactions using strategy pattern.
 */

// Export types and interfaces
export type {
  GasEstimationStrategy,
  SettlementGasParams,
  GasEstimationResult,
  GasEstimationConfig,
} from "./strategies/base.js";

// Export strategies
export { CodeBasedGasEstimator } from "./strategies/code-based.js";
export { SimulationBasedGasEstimator } from "./strategies/simulation.js";
export { SmartGasEstimator } from "./strategies/smart.js";

// Export factory function
export { createGasEstimator } from "./factory.js";

// Export utilities
export { parseEstimateGasError } from "./utils.js";
