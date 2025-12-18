/**
 * Type definitions for @x402x/facilitator_v2
 *
 * Implements SchemeNetworkFacilitator interface for SettlementRouter integration
 */

import type { PaymentRequirements, PaymentPayload, SchemeNetworkFacilitator } from "@x402/core/types";
import type { SettlementExtraCore, Network, Address } from "@x402x/core_v2";

// Re-export core types for convenience
export type { PaymentRequirements, PaymentPayload, Network, Address };

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
  /** Network the settlement was executed on */
  network: string;
  /** Payer address */
  payer?: string;
  /** Error reason if settlement failed */
  errorReason?: string;
}

/**
 * Configuration for RouterSettlementFacilitator
 */
export interface FacilitatorConfig {
  /** Signer address for facilitating settlements */
  signer: Address;
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
 * SettlementRouter contract ABI
 * Minimal ABI for the settleAndExecute function
 */
export const SETTLEMENT_ROUTER_ABI = [
  {
    type: "function",
    name: "settleAndExecute",
    inputs: [
      { name: "token", type: "address" },
      { name: "from", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
      { name: "salt", type: "bytes32" },
      { name: "payTo", type: "address" },
      { name: "facilitatorFee", type: "uint256" },
      { name: "hook", type: "address" },
      { name: "hookData", type: "bytes" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "calculateCommitment",
    inputs: [
      { name: "token", type: "address" },
      { name: "from", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "salt", type: "bytes32" },
      { name: "payTo", type: "address" },
      { name: "facilitatorFee", type: "uint256" },
      { name: "hook", type: "address" },
      { name: "hookData", type: "bytes" }
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "calculateContextKey",
    inputs: [
      { name: "from", type: "address" },
      { name: "token", type: "address" },
      { name: "nonce", type: "bytes32" }
    ],
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "pure"
  },
  {
    type: "function",
    name: "isSettled",
    inputs: [{ name: "contextKey", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view"
  }
] as const;

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
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "SettlementRouterError";
  }
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