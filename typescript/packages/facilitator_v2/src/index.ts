/**
 * @x402x/facilitator_v2 - SchemeNetworkFacilitator implementation with SettlementRouter support
 *
 * This package provides a complete implementation of the SchemeNetworkFacilitator interface
 * for atomic settlement using SettlementRouter contracts. It supports both router-settlement
 * mode and standard EIP-3009 transfers for backward compatibility.
 *
 * @example
 * ```typescript
 * import { RouterSettlementFacilitator, createRouterSettlementFacilitator } from '@x402x/facilitator_v2';
 *
 * const facilitator = createRouterSettlementFacilitator({
 *   signer: '0x1234567890123456789012345678901234567890',
 *   allowedRouters: {
 *     'eip155:84532': ['0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'],
 *   },
 * });
 *
 * const verification = await facilitator.verify(paymentPayload, paymentRequirements);
 * if (verification.isValid) {
 *   const settlement = await facilitator.settle(paymentPayload, paymentRequirements);
 *   console.log('Settlement successful:', settlement.transaction);
 * }
 * ```
 */

// Core facilitator implementation
export { RouterSettlementFacilitator, createRouterSettlementFacilitator } from "./facilitator.js";

// Error classes
export { FacilitatorValidationError, SettlementRouterError } from "./facilitator.js";

// SettlementRouter integration utilities
export {
  createPublicClientForNetwork,
  createWalletClientForNetwork,
  calculateGasLimit,
  checkIfSettled,
  executeSettlementWithRouter,
  waitForSettlementReceipt,
  parseSettlementRouterParams,
  settleWithSettlementRouter,
} from "./settlement.js";

// Validation utilities
export {
  isValidEthereumAddress,
  isValidHex,
  isValid32ByteHex,
  isValid256BitHex,
  validateSettlementRouter,
  validateSettlementExtra,
  validateNetwork,
  validateFacilitatorConfig,
  validateGasLimit,
  validateGasMultiplier,
  validateFeeAmount,
} from "./validation.js";

// Type definitions
export type {
  VerifyResponse,
  SettleResponse,
  FacilitatorConfig,
  SettlementRouterParams,
  SETTLEMENT_ROUTER_ABI,
} from "./types.js";

// Re-export from core_v2 for convenience
export type {
  PaymentRequirements,
  PaymentPayload,
  Network,
  Address,
  SettlementExtraCore,
  NetworkConfig,
} from "@x402x/core_v2";

// Re-export from @x402/core for convenience
export type { SchemeNetworkFacilitator } from "@x402/core/types";

// Re-export utilities from core_v2 for convenience
export { isSettlementMode, parseSettlementExtra, getNetworkConfig } from "@x402x/core_v2";