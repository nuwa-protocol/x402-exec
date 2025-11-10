/**
 * Type definitions for @x402x/client
 */

import type { Address, Hex, WalletClient, TransactionReceipt } from "viem";
import type { NetworkConfig } from "@x402x/core";

/**
 * Execute status enum
 */
export type ExecuteStatus =
  | "idle"
  | "preparing"
  | "signing"
  | "submitting"
  | "confirming"
  | "success"
  | "error";

/**
 * X402Client configuration
 */
export interface X402ClientConfig {
  /** Wallet client from wagmi/viem */
  wallet: WalletClient;
  /** Network name (e.g., 'base-sepolia', 'x-layer-testnet') */
  network: string;
  /** Optional: Facilitator URL (default: https://facilitator.x402x.dev/) */
  facilitatorUrl?: string;
  /** Optional: Custom network configuration (overrides built-in) */
  networkConfig?: NetworkConfig;
  /** Optional: Timeout for facilitator requests in milliseconds (default: 30000) */
  timeout?: number;
  /** Optional: Maximum time to wait for transaction confirmation in milliseconds (default: 60000) */
  confirmationTimeout?: number;
}

/**
 * Parameters for executing a settlement
 */
export interface ExecuteParams {
  /** Hook contract address */
  hook: Address;
  /** Encoded hook data */
  hookData: Hex;
  /** Payment amount in token's smallest unit (e.g., USDC has 6 decimals) */
  amount: string;
  /** Primary recipient address */
  recipient: Address;
  /** Optional: Facilitator fee amount (will query if not provided) */
  facilitatorFee?: string;
  /** Optional: Custom salt for idempotency (will generate if not provided) */
  customSalt?: Hex;
  /** Optional: Valid after timestamp (default: 10 minutes before now) */
  validAfter?: string;
  /** Optional: Valid before timestamp (default: 5 minutes from now) */
  validBefore?: string;
}

/**
 * Result from executing a settlement
 */
export interface ExecuteResult {
  /** Transaction hash */
  txHash: Hex;
  /** Network the transaction was executed on */
  network: string;
  /** Payer address */
  payer: Address;
  /** Transaction receipt (if waited for confirmation) */
  receipt?: TransactionReceipt;
  /** Settlement parameters used */
  settlement: SettlementData;
}

/**
 * Prepared settlement data ready for signing
 */
export interface SettlementData {
  /** Network name */
  network: string;
  /** Network configuration */
  networkConfig: NetworkConfig;
  /** Token address (USDC) */
  token: Address;
  /** Payer address */
  from: Address;
  /** Payment amount */
  amount: string;
  /** Valid after timestamp */
  validAfter: string;
  /** Valid before timestamp */
  validBefore: string;
  /** Unique salt for idempotency */
  salt: Hex;
  /** Primary recipient address */
  payTo: Address;
  /** Facilitator fee amount */
  facilitatorFee: string;
  /** Hook contract address */
  hook: Address;
  /** Encoded hook data */
  hookData: Hex;
  /** Calculated commitment hash (becomes EIP-3009 nonce) */
  commitment: Hex;
}

/**
 * Parameters for preparing a settlement
 */
export interface PrepareParams {
  /** Wallet client */
  wallet: WalletClient;
  /** Network name */
  network: string;
  /** Hook contract address */
  hook: Address;
  /** Encoded hook data */
  hookData: Hex;
  /** Payment amount */
  amount: string;
  /** Primary recipient address */
  recipient: Address;
  /** Optional: Facilitator fee (will query if not provided) */
  facilitatorFee?: string;
  /** Optional: Custom salt */
  customSalt?: Hex;
  /** Optional: Valid after timestamp */
  validAfter?: string;
  /** Optional: Valid before timestamp */
  validBefore?: string;
  /** Optional: Custom network configuration */
  networkConfig?: NetworkConfig;
  /** Optional: Facilitator URL for fee query */
  facilitatorUrl?: string;
}

/**
 * Signed authorization ready to submit
 */
export interface SignedAuthorization {
  /** Settlement data */
  settlement: SettlementData;
  /** EIP-712 signature */
  signature: Hex;
  /** Authorization parameters */
  authorization: {
    from: Address;
    to: Address;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: Hex;
  };
}

/**
 * Result from submitting to facilitator
 */
export interface SubmitResult {
  /** Whether the settlement was successful */
  success: boolean;
  /** Transaction hash */
  transaction: Hex;
  /** Network */
  network: string;
  /** Payer address */
  payer: Address;
  /** Error reason if failed */
  errorReason?: string;
}

/**
 * Fee estimate from facilitator
 */
export interface FeeEstimate {
  /** Network name */
  network: string;
  /** Hook address */
  hook: Address;
  /** Whether hook is allowed */
  hookAllowed: boolean;
  /** Minimum facilitator fee in token's smallest unit */
  minFacilitatorFee: string;
  /** Minimum fee in USD */
  minFacilitatorFeeUSD: string;
  /** Fee breakdown details */
  breakdown?: {
    gasLimit: number;
    maxGasLimit: number;
    gasPrice: string;
    gasCostNative: string;
    gasCostUSD: string;
    safetyMultiplier: number;
    finalCostUSD: string;
  };
  /** Token information */
  token?: {
    address: Address;
    symbol: string;
    decimals: number;
  };
  /** Price information */
  prices?: {
    nativeToken: string;
    timestamp: string;
  };
  /** Error message if hook not allowed */
  error?: string;
}

/**
 * Payment payload for x402 protocol
 */
export interface PaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: Hex;
    authorization: {
      from: Address;
      to: Address;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: Hex;
    };
  };
  paymentRequirements?: PaymentRequirements;
}

/**
 * Payment requirements for x402 protocol
 */
export interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  asset: Address;
  payTo: Address;
  maxTimeoutSeconds: number;
  extra?: {
    name?: string;
    version?: string;
    settlementRouter?: Address;
    salt?: Hex;
    payTo?: Address;
    facilitatorFee?: string;
    hook?: Address;
    hookData?: Hex;
  };
}
