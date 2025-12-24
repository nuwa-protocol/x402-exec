/**
 * Type definitions for @x402x/client
 */

import type { Address, Hex, WalletClient, TransactionReceipt } from "viem";
import type { NetworkConfig } from "@x402x/core_v2";
import type { PaymentRequirements, PaymentPayload } from "@x402x/core_v2";

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
  /** Optional: Hook contract address (defaults to TransferHook) */
  hook?: Address;
  /** Optional: Encoded hook data (defaults to "0x" for no hook data) */
  hookData?: Hex;
  /**
   * Optional: Asset contract address (ERC-3009 token, defaults to network's default asset).
   *
   * If not provided, uses the default asset for the network (typically USDC).
   * Must be a valid ERC-3009 compatible token address.
   */
  asset?: Address;
  /**
   * Payment amount in atomic units (smallest unit of the asset).
   *
   * Must be a positive integer string. For USDC (6 decimals), use parseDefaultAssetAmount()
   * from @x402x/core to convert USD amounts to atomic units.
   *
   * @example
   * ```typescript
   * import { parseDefaultAssetAmount } from '@x402x/core';
   * const atomicAmount = parseDefaultAssetAmount('1', 'base-sepolia'); // '1000000'
   * await client.execute({ amount: atomicAmount, payTo: '0x...' });
   * ```
   */
  amount: string;
  /** Primary recipient address */
  payTo: Address;
  /**
   * Optional: Facilitator fee amount in atomic units (will query if not provided).
   * Must be atomic units, same as amount parameter.
   */
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
  /** Asset contract address (ERC-3009 token) */
  asset: Address;
  /** Payer address */
  from: Address;
  /** Payment amount in atomic units */
  amount: string;
  /** Valid after timestamp */
  validAfter: string;
  /** Valid before timestamp */
  validBefore: string;
  /** Unique salt for idempotency */
  salt: Hex;
  /** Primary recipient address */
  payTo: Address;
  /** Facilitator fee amount in atomic units */
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
  /**
   * Optional: Asset contract address (ERC-3009 token, defaults to network's default asset).
   *
   * If not provided, uses the default asset for the network (typically USDC).
   * Must be a valid ERC-3009 compatible token address.
   */
  asset?: Address;
  /**
   * Payment amount in atomic units (smallest unit of the asset).
   *
   * Must be a positive integer string. For USDC (6 decimals), use parseDefaultAssetAmount()
   * from @x402x/core to convert USD amounts to atomic units.
   */
  amount: string;
  /** Primary recipient address */
  payTo: Address;
  /**
   * Optional: Facilitator fee in atomic units (will query if not provided).
   * Must be atomic units, same as amount parameter.
   */
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
 * Result from settling with facilitator
 */
export interface SettleResult {
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

// Re-export x402 types for convenience
export type { PaymentRequirements, PaymentPayload };
