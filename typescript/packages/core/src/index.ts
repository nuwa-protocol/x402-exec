/**
 * @x402x/core
 *
 * Core utilities for x402x settlement framework
 *
 * @example
 * ```typescript
 * import {
 *   calculateCommitment,
 *   generateSalt,
 *   getNetworkConfig,
 *   TransferHook,
 *   addSettlementExtra
 * } from '@x402x/core';
 *
 * // Generate payment requirements with settlement extension
 * const config = getNetworkConfig('base-sepolia');
 * const requirements = addSettlementExtra(baseRequirements, {
 *   hook: TransferHook.getAddress('base-sepolia'),
 *   hookData: TransferHook.encode(),
 *   facilitatorFee: '10000',
 *   payTo: merchantAddress,
 * });
 * ```
 */

// Export types
export type {
  CommitmentParams,
  NetworkConfig,
  SettlementExtra,
  FacilitatorConfig,
  PaymentRequirements,
  PaymentPayload,
  SettleResponse,
  Signer,
} from "./types.js";

export { SettlementExtraError } from "./types.js";

// Export commitment utilities
export { calculateCommitment, generateSalt, validateCommitmentParams } from "./commitment.js";

// Export network utilities
export {
  networks,
  getNetworkConfig,
  isNetworkSupported,
  getSupportedNetworks,
} from "./networks.js";

// Export builtin hooks
export { TransferHook } from "./hooks/index.js";

// Export helper functions
export { addSettlementExtra } from "./utils.js";

// Export facilitator utilities
export {
  isSettlementMode,
  settleWithRouter,
  validateSettlementRouter,
  calculateFacilitatorFee,
  clearFeeCache,
} from "./facilitator.js";

export type { FeeCalculationResult } from "./facilitator.js";

// Export ABI
export { SETTLEMENT_ROUTER_ABI } from "./abi.js";
