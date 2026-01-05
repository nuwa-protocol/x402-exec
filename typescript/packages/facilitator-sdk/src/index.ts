/**
 * @x402x/facilitator-sdk - SchemeNetworkFacilitator implementation with SettlementRouter support
 *
 * This package provides a complete implementation of the SchemeNetworkFacilitator interface
 * for atomic settlement using SettlementRouter contracts. It supports both router-settlement
 * mode and standard EIP-3009 transfers for backward compatibility.
 *
 * @example
 * ```typescript
 * import { RouterSettlementFacilitator, createRouterSettlementFacilitator } from '@x402x/facilitator-sdk';
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

// Error classes (re-exported from core_v2)
export { FacilitatorValidationError, SettlementRouterError } from "@x402x/extensions";

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
  executeSettlementWithWalletClient,
  InsufficientBalanceError,
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

// Type definitions (re-exported from core_v2 for convenience)
export type {
  FacilitatorConfig,
  SettlementRouterParams,
  VerifyResponse,
  Address,
  Network,
  NetworkConfig,
  SettlementExtraCore,
} from "@x402x/extensions";

// Re-export ABI
export { SETTLEMENT_ROUTER_ABI } from "@x402x/extensions";

// Re-export from @x402/core for convenience
export type { SchemeNetworkFacilitator, SettleResponse, PaymentRequirements, PaymentPayload } from "@x402/core/types";

// Re-export utilities from core_v2 for convenience
export { isSettlementMode, parseSettlementExtra, getNetworkConfig } from "@x402x/extensions";
