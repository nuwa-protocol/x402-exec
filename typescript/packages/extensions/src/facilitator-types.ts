/**
 * Type definitions for facilitator services
 *
 * These types define the interfaces and configurations used by facilitator
 * implementations that handle payment verification and settlement.
 */

import type { Network } from "@x402/core/types";

/**
 * Ethereum address type
 */
export type Address = `0x${string}`;

/**
 * Response from facilitator verification
 */
export interface VerifyResponse {
  /** Whether the payment payload is valid */
  isValid: boolean;
  /** Reason for invalidity if isValid is false */
  invalidReason?: string;
  /** Payer address extracted from the payload */
  payer?: string;
}

/**
 * Response from facilitator settlement
 */
export interface SettleResponse {
  /** Whether the settlement was successful */
  success: boolean;
  /** Transaction hash of the settlement */
  transaction: string;
  /** Network the settlement was executed on (CAIP-2 format) */
  network: Network;
  /** Payer address */
  payer?: string;
  /** Error reason if settlement failed */
  errorReason?: string;
}

/**
 * Configuration for RouterSettlementFacilitator
 */
export interface FacilitatorConfig {
  /** Signer address for facilitating settlements (optional, will be derived from privateKey if not provided) */
  signer?: Address;
  /** Private key for local signing (enables sending transactions on standard RPC providers) */
  privateKey?: string;
  /** Allowed SettlementRouter addresses per network */
  allowedRouters?: Record<string, string[]>;
  /** Optional RPC URLs per network */
  rpcUrls?: Record<string, string>;
  /** Gas configuration */
  gasConfig?: {
    maxGasLimit: bigint;
    gasMultiplier: number;
  };
  /** Fee configuration */
  feeConfig?: {
    minFee: string;
    maxFee: string;
  };
  /** Timeouts in milliseconds */
  timeouts?: {
    verify: number;
    settle: number;
  };
}

/**
 * Parameters for SettlementRouter.settleAndExecute
 */
export interface SettlementRouterParams {
  token: Address;
  from: Address;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
  signature: string;
  salt: string;
  payTo: Address;
  facilitatorFee: string;
  hook: Address;
  hookData: string;
  settlementRouter: Address;
}

/**
 * Error types for facilitator operations
 */
export class FacilitatorValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FacilitatorValidationError";
  }
}

export class SettlementRouterError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SettlementRouterError";
  }
}
