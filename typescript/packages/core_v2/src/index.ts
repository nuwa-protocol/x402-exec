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
  SettlementExtraCore,
  PaymentRequirements,
  PaymentPayload,
  Signer,
  DemoHooks,
  Network,
  Money,
  Resource,
} from "./types.js";

export { SettlementExtraError } from "./types.js";

// Export middleware utilities
export {
  computeRoutePatterns,
  findMatchingRoute,
  findMatchingPaymentRequirements,
  toJsonSafe,
} from "./middleware-utils.js";

export type { RouteConfig, RoutesConfig, RoutePattern } from "./middleware-utils.js";

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
export { TransferHook, NFTMintHook, RewardHook } from "./hooks/index.js";

// Export demo hooks configuration types
export type { MintConfig, RewardConfig } from "./hooks/demo.js";

// Export helper functions
export { addSettlementExtra } from "./utils.js";

// Export extension helpers
export {
  createRouterSettlementExtension,
  getRouterSettlementExtensionKey,
} from "./extensions.js";

export type {
  RouterSettlementExtension,
  RouterSettlementExtensionInfo,
} from "./extensions.js";

// Export server extension for x402 v2 resource servers
export {
  routerSettlementServerExtension,
  createExtensionDeclaration,
  ROUTER_SETTLEMENT_KEY,
} from "./server-extension.js";

// Export helper functions
export {
  registerRouterSettlement,
  createX402xFacilitator,
  withRouterSettlement,
  isRouterSettlement,
  type WithRouterSettlementOptions,
} from "./helpers.js";

// Export validation helpers
export {
  validateSettlementExtra,
  assertValidSettlementExtra,
  isValidAddress,
  isValidHex,
  isValid32ByteHex,
  isValidNumericString,
} from "./validation.js";

export type { ValidationResult } from "./validation.js";

// Export amount utilities
export { parseDefaultAssetAmount, formatDefaultAssetAmount, AmountError } from "./amount.js";

// Export facilitator API client utilities
export {
  calculateFacilitatorFee,
  clearFeeCache,
  isSettlementMode,
  parseSettlementExtra,
  verify,
  settle,
} from "./facilitator.js";

export type { FeeCalculationResult, VerifyResponse, SettleResponse } from "./facilitator.js";

// Export ABI
export { SETTLEMENT_ROUTER_ABI } from "./abi.js";

// Export facilitator types
export {
  type Address,
  type FacilitatorConfig,
  type VerifyResponse as FacilitatorVerifyResponse,
  type SettleResponse as FacilitatorSettleResponse,
  type SettlementRouterParams,
  FacilitatorValidationError,
  SettlementRouterError,
} from "./facilitator-types.js";

// Export legacy compatibility shims for v1-style middleware
export {
  SupportedEVMNetworks,
  moneySchema,
  settleResponseHeader,
  evm,
  exact,
  ChainIdToNetwork,
  isMultiNetworkSigner,
  isSvmSignerWallet,
  createPaymentHeader,
  selectPaymentRequirements,
  decodeXPaymentResponse,
  useFacilitator,
  createSigner,
} from "./legacy-compat.js";

export type {
  MultiNetworkSigner,
  X402Config,
  PaymentRequirementsSelector,
} from "./legacy-compat.js";

// Export network utilities (needed by middleware)
export {
  processPriceToAtomicAmount,
  getDefaultAsset,
  getNetworkId,
  getNetworkName,
  getSupportedNetworksV2,
  getNetworkAliasesV1ToV2,
  toCanonicalNetworkKey,
  NETWORK_ALIASES_V1_TO_V2
} from "./network-utils.js";

