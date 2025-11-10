/**
 * Type definitions for @x402x/core
 */

import type { PaymentRequirements, PaymentPayload, SettleResponse, Signer } from "x402/types";

// Re-export x402 types for convenience
export type { PaymentRequirements, PaymentPayload, SettleResponse, Signer };

/**
 * Commitment calculation parameters
 * All parameters must match exactly with SettlementRouter.sol
 */
export interface CommitmentParams {
  /** Chain ID (e.g., 84532 for Base Sepolia) */
  chainId: number;
  /** SettlementRouter contract address */
  hub: string;
  /** Token contract address (e.g., USDC) */
  token: string;
  /** Payer address */
  from: string;
  /** Payment amount in token's smallest unit */
  value: string;
  /** Authorization valid after timestamp */
  validAfter: string;
  /** Authorization valid before timestamp */
  validBefore: string;
  /** Unique salt for idempotency (32 bytes) */
  salt: string;
  /** Final recipient address */
  payTo: string;
  /** Facilitator fee amount */
  facilitatorFee: string;
  /** Hook contract address */
  hook: string;
  /** Encoded hook parameters */
  hookData: string;
}

/**
 * Network configuration for x402x
 */
export interface NetworkConfig {
  /** Chain ID */
  chainId: number;
  /** SettlementRouter contract address */
  settlementRouter: string;
  /** USDC token configuration */
  usdc: {
    /** USDC contract address */
    address: string;
    /** USDC contract name (for EIP-712) */
    name: string;
    /** USDC contract version (for EIP-712) */
    version: string;
  };
  /** Builtin hook addresses */
  hooks: {
    /** TransferHook address */
    transfer: string;
  };
}

/**
 * Settlement extra parameters for PaymentRequirements
 */
export interface SettlementExtra {
  /** USDC contract name (for EIP-712) */
  name: string;
  /** USDC contract version (for EIP-712) */
  version: string;
  /** SettlementRouter contract address */
  settlementRouter: string;
  /** Unique salt for idempotency (32 bytes) */
  salt: string;
  /** Final recipient address */
  payTo: string;
  /** Facilitator fee amount */
  facilitatorFee: string;
  /** Hook contract address */
  hook: string;
  /** Encoded hook parameters */
  hookData: string;
}

/**
 * Facilitator configuration
 */
export interface FacilitatorConfig {
  /** Allowed SettlementRouter addresses per network */
  allowedRouters: Record<string, string[]>;
  /** Allowed Hook addresses per network (optional, for security) */
  allowedHooks?: Record<string, string[]>;
  /** Maximum gas limit for settlement transactions (optional, for security) */
  maxGasLimit?: number;
}

/**
 * Error thrown when settlement extra parameters are invalid
 */
export class SettlementExtraError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SettlementExtraError";
  }
}

/**
 * Gas metrics for settlement transaction monitoring
 */
export interface GasMetrics {
  /** Actual gas used by the transaction */
  gasUsed: string;
  /** Effective gas price (in Wei) */
  effectiveGasPrice: string;
  /** Actual gas cost in native token (ETH/BNB/etc.) */
  actualGasCostNative: string;
  /** Actual gas cost in USD */
  actualGasCostUSD: string;
  /** Facilitator fee that was charged (in token's smallest unit) */
  facilitatorFee: string;
  /** Facilitator fee in USD */
  facilitatorFeeUSD: string;
  /** Profit/loss amount (facilitatorFee - actualGasCost, in USD) */
  profitUSD: string;
  /** Profit margin as percentage */
  profitMarginPercent: string;
  /** Whether this settlement was profitable */
  profitable: boolean;
  /** Hook address for this settlement */
  hook: string;
  /** Network native token price in USD */
  nativeTokenPriceUSD: string;
}

/**
 * Extended SettleResponse with gas metrics
 */
export interface SettleResponseWithMetrics extends SettleResponse {
  /** Gas metrics for monitoring (only present on successful settlements) */
  gasMetrics?: GasMetrics;
}
