/**
 * Type definitions for @x402x/core
 */

import type { PaymentRequirements, PaymentPayload, Signer } from "x402/types";

// Re-export x402 types for convenience
export type { PaymentRequirements, PaymentPayload, Signer };

/**
 * Commitment calculation parameters
 * All parameters must match exactly with SettlementRouter.sol
 */
export interface CommitmentParams {
  /** Chain ID (e.g., 84532 for Base Sepolia) */
  chainId: number;
  /** SettlementRouter contract address */
  hub: string;
  /** Asset contract address (ERC-3009 token, e.g., USDC) */
  asset: string;
  /** Payer address */
  from: string;
  /** Payment amount in asset's smallest unit */
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
  /** Network Name */
  name: string;
  /** Network Type */
  type: "mainnet" | "testnet";
  /** Network Address Explorer Base URL */
  addressExplorerBaseUrl: string;
  /** Network Transaction Explorer Base URL */
  txExplorerBaseUrl: string;
  /** SettlementRouter contract address */
  settlementRouter: string;
  /** Default asset configuration (ERC-3009 token, typically USDC) */
  defaultAsset: {
    /** Asset contract address */
    address: string;
    /** Asset decimals */
    decimals: number;
    /** EIP-712 domain info for signing */
    eip712: {
      /** Asset contract name (for EIP-712) */
      name: string;
      /** Asset contract version (for EIP-712) */
      version: string;
    };
  };
  /** Builtin hook addresses */
  hooks: {
    /** TransferHook address */
    transfer: string;
  };
}

/**
 * Core settlement parameters (without EIP-712 domain info)
 */
export interface SettlementExtraCore {
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
 * Settlement extra parameters for PaymentRequirements
 * Includes EIP-712 domain info (name, version) for asset signature validation
 */
export interface SettlementExtra extends SettlementExtraCore {
  /** Asset contract name (for EIP-712) */
  name: string;
  /** Asset contract version (for EIP-712) */
  version: string;
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
