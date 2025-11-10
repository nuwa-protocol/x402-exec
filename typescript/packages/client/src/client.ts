/**
 * X402Client - High-level client for x402x Serverless Mode
 *
 * This is the main client class that provides a simple API for executing
 * on-chain contracts via facilitator without needing a resource server.
 */

import type { Address, Hex, TransactionReceipt } from "viem";
import type { X402ClientConfig, ExecuteParams, ExecuteResult, FeeEstimate } from "./types.js";
import { prepareSettlement, queryFacilitatorFee } from "./core/prepare.js";
import { signAuthorization } from "./core/sign.js";
import { submitToFacilitator } from "./core/submit.js";
import { ValidationError } from "./errors.js";
import { validateAddress, validateHex, validateAmount } from "./core/utils.js";

/**
 * Default facilitator URL
 */
export const DEFAULT_FACILITATOR_URL = "https://facilitator.x402x.dev";

/**
 * Internal configuration with required fields
 */
interface InternalConfig extends X402ClientConfig {
  facilitatorUrl: string;
  timeout: number;
  confirmationTimeout: number;
}

/**
 * X402Client - High-level client for x402x Serverless Mode
 *
 * This client simplifies the entire settlement flow into a single execute() call,
 * automatically handling:
 * - Parameter preparation
 * - Commitment calculation
 * - EIP-712 signing
 * - Facilitator submission
 * - Transaction confirmation
 *
 * @example
 * ```typescript
 * import { X402Client } from '@x402x/client';
 * import { TransferHook } from '@x402x/core';
 * import { useWalletClient } from 'wagmi';
 *
 * const { data: wallet } = useWalletClient();
 *
 * // Use default facilitator
 * const client = new X402Client({
 *   wallet,
 *   network: 'base-sepolia'
 * });
 *
 * // Or specify custom facilitator
 * const client = new X402Client({
 *   wallet,
 *   network: 'base-sepolia',
 *   facilitatorUrl: 'https://custom-facilitator.example.com'
 * });
 *
 * const result = await client.execute({
 *   hook: TransferHook.getAddress('base-sepolia'),
 *   hookData: TransferHook.encode(),
 *   amount: '1000000',
 *   recipient: '0x...'
 * });
 * ```
 */
export class X402Client {
  private config: InternalConfig;

  /**
   * Create a new X402Client instance
   *
   * @param config - Client configuration
   * @throws NetworkError if network is unsupported
   * @throws ValidationError if configuration is invalid
   */
  constructor(config: X402ClientConfig) {
    // Validate configuration
    if (!config.wallet) {
      throw new ValidationError("wallet is required");
    }
    if (!config.network) {
      throw new ValidationError("network is required");
    }

    this.config = {
      ...config,
      facilitatorUrl: config.facilitatorUrl || DEFAULT_FACILITATOR_URL,
      timeout: config.timeout || 30000,
      confirmationTimeout: config.confirmationTimeout || 60000,
    };
  }

  /**
   * Execute a settlement transaction
   *
   * This is the main method that orchestrates the entire settlement flow:
   * 1. Validates parameters
   * 2. Prepares settlement data (queries fee if needed)
   * 3. Signs EIP-3009 authorization
   * 4. Submits to facilitator
   * 5. Optionally waits for transaction confirmation
   *
   * @param params - Execution parameters
   * @param waitForConfirmation - Whether to wait for transaction confirmation (default: true)
   * @returns Execution result with transaction hash and optional receipt
   *
   * @throws ValidationError if parameters are invalid
   * @throws NetworkError if network is unsupported
   * @throws SigningError if user rejects signing
   * @throws FacilitatorError if facilitator request fails
   * @throws TransactionError if transaction fails
   *
   * @example
   * ```typescript
   * const result = await client.execute({
   *   hook: '0x...',
   *   hookData: '0x...',
   *   amount: '1000000',
   *   recipient: '0x...'
   * });
   * console.log('Transaction:', result.txHash);
   * ```
   */
  async execute(
    params: ExecuteParams,
    waitForConfirmation: boolean = true,
  ): Promise<ExecuteResult> {
    // 1. Validate parameters
    validateAddress(params.hook, "hook");
    validateHex(params.hookData, "hookData");
    validateAmount(params.amount, "amount");
    validateAddress(params.recipient, "recipient");

    // 2. Prepare settlement
    const settlement = await prepareSettlement({
      wallet: this.config.wallet,
      network: this.config.network,
      hook: params.hook,
      hookData: params.hookData,
      amount: params.amount,
      recipient: params.recipient,
      facilitatorFee: params.facilitatorFee,
      customSalt: params.customSalt,
      validAfter: params.validAfter,
      validBefore: params.validBefore,
      networkConfig: this.config.networkConfig,
      facilitatorUrl: this.config.facilitatorUrl,
    });

    // 3. Sign authorization
    const signed = await signAuthorization(this.config.wallet, settlement);

    // 4. Submit to facilitator
    const submitResult = await submitToFacilitator(
      this.config.facilitatorUrl,
      signed,
      this.config.timeout,
    );

    // 5. Optionally wait for confirmation
    let receipt: TransactionReceipt | undefined;
    if (waitForConfirmation) {
      receipt = await this.waitForTransaction(submitResult.transaction);
    }

    return {
      txHash: submitResult.transaction,
      network: submitResult.network,
      payer: submitResult.payer,
      receipt,
      settlement,
    };
  }

  /**
   * Query minimum facilitator fee for a hook
   *
   * @param hook - Hook contract address
   * @returns Fee estimate
   *
   * @throws FacilitatorError if query fails
   *
   * @example
   * ```typescript
   * const fee = await client.estimateFee('0x...');
   * console.log('Min fee:', fee.minFacilitatorFee);
   * ```
   */
  async estimateFee(hook: Address): Promise<FeeEstimate> {
    validateAddress(hook, "hook");
    return queryFacilitatorFee(this.config.facilitatorUrl, this.config.network, hook);
  }

  /**
   * Wait for transaction confirmation
   *
   * @param txHash - Transaction hash to wait for
   * @returns Transaction receipt
   *
   * @throws TransactionError if transaction fails or times out
   *
   * @example
   * ```typescript
   * const receipt = await client.waitForTransaction('0x...');
   * console.log('Status:', receipt.status);
   * ```
   */
  async waitForTransaction(txHash: Hex): Promise<TransactionReceipt> {
    // Check if wallet has waitForTransactionReceipt method
    const publicClient = this.config.wallet as any;
    if (typeof publicClient.waitForTransactionReceipt !== "function") {
      throw new Error(
        "Wallet client does not support waitForTransactionReceipt. " +
          "Please use a viem PublicClient or WalletClient with public actions.",
      );
    }

    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        timeout: this.config.confirmationTimeout,
      });

      if (receipt.status !== "success") {
        throw new Error(`Transaction failed with status: ${receipt.status}`);
      }

      return receipt;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to confirm transaction: ${error.message}`);
      }
      throw new Error("Failed to confirm transaction: Unknown error");
    }
  }

  /**
   * Get the network name
   */
  get network(): string {
    return this.config.network;
  }

  /**
   * Get the facilitator URL
   */
  get facilitatorUrl(): string {
    return this.config.facilitatorUrl;
  }

  /**
   * Get the wallet client
   */
  get wallet() {
    return this.config.wallet;
  }
}
