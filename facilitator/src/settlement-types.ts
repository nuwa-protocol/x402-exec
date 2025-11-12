/**
 * Settlement Types for Facilitator
 *
 * Extends core types with facilitator-specific monitoring and metrics
 */

import type { SettleResponse } from "@x402x/core";
import type { GasMetrics } from "./gas-metrics.js";

/**
 * Extended SettleResponse with gas metrics for facilitator monitoring
 */
export interface SettleResponseWithMetrics extends SettleResponse {
  /** Gas metrics for monitoring (only present on successful settlements) */
  gasMetrics?: GasMetrics;
}

/**
 * Settlement extra parameters (re-exported for convenience)
 */
export interface SettlementExtra {
  settlementRouter: string;
  salt: string;
  payTo: string;
  facilitatorFee: string;
  hook: string;
  hookData: string;
}

/**
 * Settlement configuration
 */
export interface SettlementConfig {
  allowedRouters: Record<string, string[]>;
}

/**
 * Error thrown when settlement extra parameters are invalid
 *
 * Re-exported from @x402x/core for convenience
 */
export { SettlementExtraError } from "@x402x/core";
