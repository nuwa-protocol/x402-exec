/**
 * Type definitions for @x402x/extensions
 * 
 * Re-exports official x402 v2 types from @x402/core
 */

import type { PaymentRequirements, PaymentPayload } from "@x402/core/types";

// Re-export x402 v2 types for convenience
export type { PaymentRequirements, PaymentPayload };

/**
 * Signer interface for x402x
 * Compatible with x402 v2 client signer patterns
 */
export interface Signer {
  address: string;
  signTypedData?: (params: unknown) => Promise<string>;
  [key: string]: unknown;
}

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
 * Gas model for different networks
 */
export type GasModel = "eip1559" | "legacy";

/**
 * Network metadata containing protocol-level information
 */
export interface NetworkMetadata {
  /** Gas pricing model used by the network */
  gasModel: GasModel;
  /** Native token symbol */
  nativeToken: string;
}

/**
 * Demo hooks configuration for showcase examples
 */
export interface DemoHooks {
  /** NFTMintHook contract address */
  nftMint?: string;
  /** RandomNFT contract address */
  randomNFT?: string;
  /** RewardHook contract address */
  reward?: string;
  /** RewardToken contract address */
  rewardToken?: string;
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
  /** Demo hooks configuration (optional, for showcase examples) */
  demoHooks?: DemoHooks;
  /** Network metadata */
  metadata?: NetworkMetadata;
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

/**
 * Additional types for middleware compatibility
 */

// Re-export Network type from @x402/core
export type { Network } from "@x402/core/types";

/**
 * Money type - string or number representing USD amount
 */
export type Money = string | number;

/**
 * Resource information for payment required responses
 */
export interface Resource {
  url: string;
  description?: string;
  mimeType?: string;
}

/**
 * Facilitator configuration for middleware
 */
export interface FacilitatorConfig {
  url: string;
  apiKey?: string;
}

