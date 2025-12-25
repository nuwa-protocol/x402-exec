/**
 * Type definitions for @x402x/facilitator_v2
 *
 * Re-exports types from @x402x/core_v2 for backward compatibility
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
} from "@x402x/core_v2";

export {
  SETTLEMENT_ROUTER_ABI,
  FacilitatorValidationError,
  SettlementRouterError,
} from "@x402x/core_v2";

// Re-export official types for convenience
export type { PaymentRequirements, PaymentPayload, SchemeNetworkFacilitator };

