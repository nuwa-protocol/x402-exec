/**
 * Gas Estimation Strategy Interfaces
 *
 * Core interfaces for the gas estimation strategy pattern.
 * This provides a unified way to estimate gas for settlement transactions.
 */

import type { WalletClient, Address, Hex } from "viem";
import type { GasCostConfig } from "../../gas-cost.js";

/**
 * Gas estimation strategy interface
 * All strategies provide a unified way to estimate gas for settlement transactions
 */
export interface GasEstimationStrategy {
  /**
   * Estimate gas limit for a settlement transaction
   *
   * @param params - Settlement transaction parameters
   * @returns Gas estimation result with validation status
   */
  estimateGas(params: SettlementGasParams): Promise<GasEstimationResult>;

  /**
   * Strategy name for logging and metrics
   */
  readonly strategyName: string;
}

/**
 * Parameters for gas estimation
 */
export interface SettlementGasParams {
  // Network and contract info
  network: string;
  hook: string;
  hookData: string;
  settlementRouter: string;
  token: string;

  // Transaction details
  from: string;
  value: bigint;
  authorization: {
    validAfter: bigint;
    validBefore: bigint;
    nonce: string;
  };
  signature: string;
  salt: string;
  payTo: string;
  facilitatorFee: bigint;
  hookAmount: bigint;

  // Clients and config
  walletClient: WalletClient;
  gasCostConfig: GasCostConfig;
  gasEstimationConfig: GasEstimationConfig;
}

/**
 * Gas estimation result
 */
export interface GasEstimationResult {
  /** Estimated gas limit (safe value, ready to use) */
  gasLimit: number;

  /** Whether the transaction is valid */
  isValid: boolean;

  /** Error reason if invalid */
  errorReason?: string;

  /** Strategy used for this estimation */
  strategyUsed: "code_calculation" | "rpc_simulation";

  /** Additional metadata for logging */
  metadata?: {
    rawEstimate?: number;
    safetyMultiplier?: number;
    hookType?: string;
  };
}

/**
 * Gas estimation configuration
 */
export interface GasEstimationConfig {
  /** Enable pre-validation before submitting transactions */
  enabled: boolean;

  /**
   * Gas estimation strategy to use:
   * - 'code': Force code-based calculation (faster, built-in hooks only)
   * - 'simulation': Force RPC simulation (slower, all hooks, most accurate)
   * - 'smart': Auto-select based on hook type (recommended)
   */
  strategy: "code" | "simulation" | "smart";

  /**
   * Enable code-based validation for built-in hooks (only affects 'smart' strategy)
   * When false, 'smart' strategy behaves like 'simulation'
   */
  codeValidationEnabled: boolean;

  /** Safety multiplier applied to RPC estimates (e.g., 1.2 = 20% buffer) */
  safetyMultiplier: number;

  /** Timeout for RPC calls in milliseconds */
  timeoutMs: number;
}
