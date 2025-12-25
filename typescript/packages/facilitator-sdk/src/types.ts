/**
 * Type definitions for @x402x/facilitator-sdk
 *
 * Re-exports types from @x402x/extensions for backward compatibility
 */

import type {
  PaymentRequirements,
  PaymentPayload,
  SchemeNetworkFacilitator,
} from "@x402/core/types";

// Re-export from core_v2
export type {
  FacilitatorConfig,
  VerifyResponse,
  SettleResponse,
  SettlementRouterParams,
  Network,
  Address,
  SettlementExtraCore,
  NetworkConfig,
} from "@x402x/extensions";

export {
  SETTLEMENT_ROUTER_ABI,
  FacilitatorValidationError,
  SettlementRouterError,
} from "@x402x/extensions";

// Re-export official types for convenience
export type { PaymentRequirements, PaymentPayload, SchemeNetworkFacilitator };

