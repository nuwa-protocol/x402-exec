/**
 * Account Pool Module
 *
 * Manages multiple facilitator accounts for parallel transaction processing
 * with per-account serial queues to avoid nonce conflicts.
 *
 * Key features:
 * - Multiple accounts working in parallel
 * - Each account processes transactions serially (queue with concurrency=1)
 * - Round-robin account selection for load distribution
 * - Cached signer instances for performance
 * - Zero nonce conflicts within each account
 * - Custom RPC URL support for each network
 */

import pLimit from "p-limit";
import type { Signer } from "x402/types";
import { createWalletClient, http, publicActions } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { getChain as getX402xChain } from "@x402x/extensions";
import { getLogger, recordMetric } from "./telemetry.js";
import { QueueOverloadError, DuplicatePayerError } from "./errors.js";
import { DEFAULTS } from "./defaults.js";

const logger = getLogger();

/**
 * Account pool configuration
 */
export interface AccountPoolConfig {
  /** Account selection strategy */
  strategy?: "round_robin" | "random";
  /** Enable detailed logging */
  verbose?: boolean;

  /** Maximum queue depth per account (prevent request accumulation) */
  maxQueueDepth?: number;
  /** Queue depth warning threshold */
  queueDepthWarning?: number;

  /** Custom RPC URL for this network (overrides viem chain default) */
  rpcUrl?: string;
}

/**
 * Account information
 */
export interface AccountInfo {
  address: string;
  queueDepth: number;
  totalProcessed: number;
}

/**
 * Internal account structure
 */
interface Account {
  address: string;
  signer: Signer;
  queue: ReturnType<typeof pLimit>;
  processed: number;
}

/**
 * Account pool for managing multiple facilitator accounts
 */
export class AccountPool {
  private accounts: Account[] = [];
  private roundRobinIndex = 0;
  private strategy: "round_robin" | "random";
  private network: string;
  private config: AccountPoolConfig;
  private pendingPayers: Set<string> = new Set();

  /**
   * Create an account pool
   *
   * @param network - Network name (e.g., "base-sepolia", "solana-devnet")
   * @param strategy - Account selection strategy
   * @param config - Account pool configuration
   */
  private constructor(
    network: string,
    strategy: "round_robin" | "random",
    config: AccountPoolConfig,
  ) {
    this.network = network;
    this.strategy = strategy;
    this.config = config;
  }

  /**
   * Create an account pool (async factory method)
   *
   * @param privateKeys - Array of private keys
   * @param network - Network name
   * @param config - Optional configuration
   * @returns Account pool instance
   */
  static async create(
    privateKeys: string[],
    network: string,
    config?: AccountPoolConfig,
  ): Promise<AccountPool> {
    if (privateKeys.length === 0) {
      throw new Error("At least one private key is required");
    }

    const defaultConfig: AccountPoolConfig = {
      strategy: DEFAULTS.accountPool.STRATEGY,
      maxQueueDepth: DEFAULTS.accountPool.MAX_QUEUE_DEPTH,
    };
    const finalConfig = { ...defaultConfig, ...config };
    const strategy = finalConfig.strategy || "round_robin";
    const pool = new AccountPool(network, strategy, finalConfig);

    logger.info(
      {
        accountCount: privateKeys.length,
        network,
        strategy,
      },
      "Initializing account pool",
    );

    // Get chain definition from x402x (supports CAIP-2 networks like eip155:56)
    const chain = getX402xChain(network);

    // Determine RPC URL: config > chain default
    const rpcUrl = finalConfig.rpcUrl || chain.rpcUrls?.default?.http?.[0];
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for network ${network}`);
    }

    logger.info(
      {
        network,
        rpcUrl: rpcUrl || "(chain default)",
        isCustomRpc: !!finalConfig.rpcUrl,
      },
      "Using RPC URL for network",
    );

    // Create accounts with serial queues
    for (let i = 0; i < privateKeys.length; i++) {
      try {
        // Create signer using viem directly with custom RPC URL support
        const signer = createWalletClient({
          chain,
          transport: http(rpcUrl), // Use custom RPC URL if provided
          account: privateKeyToAccount(privateKeys[i] as Hex),
        }).extend(publicActions) as unknown as Signer;

        // Get address from signer
        let address = "";
        if ("account" in signer && signer.account) {
          address = (signer.account as { address: string }).address;
        } else if ("address" in signer) {
          address = (signer as { address: string }).address;
        }

        const account: Account = {
          address,
          signer,
          queue: pLimit(1), // Serial queue (concurrency = 1)
          processed: 0,
        };

        pool.accounts.push(account);

        logger.info(
          {
            index: i,
            address: account.address,
            network,
          },
          "Account initialized",
        );
      } catch (error) {
        logger.error(
          {
            index: i,
            error,
          },
          "Failed to initialize account",
        );
        throw error;
      }
    }

    logger.info(
      {
        totalAccounts: pool.accounts.length,
        strategy,
      },
      "Account pool initialized",
    );

    return pool;
  }

  /**
   * Execute a function with an automatically selected account
   *
   * The function will be queued in the selected account's serial queue,
   * ensuring that transactions from the same account are processed in order
   * without nonce conflicts.
   *
   * @param fn - Function to execute with the signer
   * @param payerAddress - Optional payer address for duplicate detection (normalized to lowercase)
   * @returns Result from the function
   */
  async execute<T>(fn: (signer: Signer) => Promise<T>, payerAddress?: string): Promise<T> {
    // Normalize payer address to lowercase for consistent comparison
    const normalizedPayer = payerAddress?.toLowerCase();

    // Check for duplicate payer before selecting account
    if (normalizedPayer && this.pendingPayers.has(normalizedPayer)) {
      logger.warn(
        {
          payerAddress: normalizedPayer,
          pendingPayersCount: this.pendingPayers.size,
        },
        "Duplicate payer detected, rejecting request",
      );

      // Record duplicate payer metric
      recordMetric("facilitator.account.duplicate_payer", 1, {
        network: this.network,
        payerAddress: normalizedPayer,
      });

      throw new DuplicatePayerError(normalizedPayer, {
        pendingPayersCount: this.pendingPayers.size,
      });
    }

    const account = this.selectAccount();
    const queueDepth = account.queue.activeCount + account.queue.pendingCount;

    // Check queue depth limit
    if (this.config.maxQueueDepth && queueDepth >= this.config.maxQueueDepth) {
      logger.warn(
        {
          address: account.address,
          queueDepth,
          maxQueueDepth: this.config.maxQueueDepth,
        },
        "Queue depth limit exceeded, rejecting request",
      );

      // Record queue rejection metric
      recordMetric("facilitator.account.queue_rejected", 1, {
        account: account.address,
        network: this.network,
        queueDepth: queueDepth.toString(),
      });

      throw new QueueOverloadError(
        `Account queue is full (depth: ${queueDepth}/${this.config.maxQueueDepth}). ` +
          `Please retry later.`,
      );
    }

    // Queue depth warning
    if (this.config.queueDepthWarning && queueDepth >= this.config.queueDepthWarning) {
      logger.warn(
        {
          address: account.address,
          queueDepth,
          warningThreshold: this.config.queueDepthWarning,
        },
        "Queue depth approaching limit",
      );
    }

    logger.debug(
      {
        address: account.address,
        queueDepth,
        strategy: this.strategy,
      },
      "Selected account for execution",
    );

    // Record queue depth metric
    recordMetric("facilitator.account.queue_depth", queueDepth, {
      account: account.address,
      network: this.network,
    });

    // Add payer to pending set and execute in account's serial queue
    // Use try-finally to ensure cleanup happens even if errors occur
    if (normalizedPayer) {
      this.pendingPayers.add(normalizedPayer);
      logger.debug(
        {
          payerAddress: normalizedPayer,
          pendingPayersCount: this.pendingPayers.size,
        },
        "Added payer to pending set",
      );
    }

    try {
      // Execute in account's serial queue
      const result = await account.queue(async () => {
        const startTime = Date.now();

        try {
          const result = await fn(account.signer);
          account.processed++;

          const duration = Date.now() - startTime;

          logger.debug(
            {
              address: account.address,
              duration_ms: duration,
              totalProcessed: account.processed,
              payerAddress: normalizedPayer,
            },
            "Account execution completed",
          );

          // Record metrics
          recordMetric("facilitator.account.tx_count", 1, {
            account: account.address,
            network: this.network,
            success: "true",
          });

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;

          logger.error(
            {
              address: account.address,
              duration_ms: duration,
              payerAddress: normalizedPayer,
              error,
            },
            "Account execution failed",
          );

          // Record error metric
          recordMetric("facilitator.account.tx_count", 1, {
            account: account.address,
            network: this.network,
            success: "false",
          });

          throw error;
        }
      });

      return result;
    } finally {
      // Remove payer from pending set after execution completes (success or failure)
      // This cleanup is critical - must always execute to prevent payer address leaks
      if (normalizedPayer) {
        this.pendingPayers.delete(normalizedPayer);
        logger.debug(
          {
            payerAddress: normalizedPayer,
            pendingPayersCount: this.pendingPayers.size,
          },
          "Removed payer from pending set",
        );
      }
    }
  }

  /**
   * Get information about all accounts
   */
  getAccountsInfo(): AccountInfo[] {
    return this.accounts.map((acc) => ({
      address: acc.address,
      queueDepth: acc.queue.activeCount + acc.queue.pendingCount,
      totalProcessed: acc.processed,
    }));
  }

  /**
   * Get the number of pending payers (addresses with transactions in queue)
   */
  getPendingPayersCount(): number {
    return this.pendingPayers.size;
  }

  /**
   * Get total queue depth across all accounts
   */
  getTotalQueueDepth(): number {
    return this.accounts.reduce(
      (sum, acc) => sum + acc.queue.activeCount + acc.queue.pendingCount,
      0,
    );
  }

  /**
   * Get the number of accounts in the pool
   */
  getAccountCount(): number {
    return this.accounts.length;
  }

  /**
   * Get the address of the first account in the pool
   * Used for v2 facilitator advertisement
   *
   * @returns The address of the first account, or undefined if pool is empty
   */
  getFirstAccountAddress(): string | undefined {
    return this.accounts[0]?.address;
  }

  /**
   * Get total number of transactions processed across all accounts
   */
  getTotalProcessed(): number {
    return this.accounts.reduce((sum, acc) => sum + acc.processed, 0);
  }

  /**
   * Select an account based on the configured strategy
   */
  private selectAccount(): Account {
    if (this.strategy === "round_robin") {
      const account = this.accounts[this.roundRobinIndex];
      this.roundRobinIndex = (this.roundRobinIndex + 1) % this.accounts.length;
      return account;
    } else {
      // Random selection
      const index = Math.floor(Math.random() * this.accounts.length);
      return this.accounts[index];
    }
  }
}

/**
 * Load private keys from environment variables
 *
 * Supports three formats (in priority order):
 * 1. EVM_PRIVATE_KEYS - Comma-separated keys (recommended)
 * 2. EVM_PRIVATE_KEY_1, EVM_PRIVATE_KEY_2, ... - Numbered keys
 * 3. EVM_PRIVATE_KEY - Single key (backward compatibility)
 *
 * @returns Array of private keys
 */
export function loadEvmPrivateKeys(): string[] {
  // 1. Try comma-separated format
  const keysStr = process.env.EVM_PRIVATE_KEYS;
  if (keysStr) {
    const keys = keysStr
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (keys.length > 0) {
      logger.info({ count: keys.length }, "Loaded EVM private keys from EVM_PRIVATE_KEYS");
      return keys;
    }
  }

  // 2. Try numbered format
  const keys: string[] = [];
  let i = 1;
  while (true) {
    const key = process.env[`EVM_PRIVATE_KEY_${i}`];
    if (!key) break;
    keys.push(key);
    i++;
  }
  if (keys.length > 0) {
    logger.info({ count: keys.length }, "Loaded EVM private keys from EVM_PRIVATE_KEY_*");
    return keys;
  }

  // 3. Try single key format (backward compatibility)
  const singleKey = process.env.EVM_PRIVATE_KEY;
  if (singleKey) {
    logger.info("Loaded single EVM private key from EVM_PRIVATE_KEY");
    return [singleKey];
  }

  throw new Error(
    "No EVM private keys configured. Set EVM_PRIVATE_KEYS, EVM_PRIVATE_KEY_*, or EVM_PRIVATE_KEY",
  );
}

/**
 * Create account pool from environment variables
 *
 * @param network - Network name
 * @param config - Optional configuration
 * @returns Account pool instance
 */
export async function createAccountPoolFromEnv(
  network: string,
  config?: AccountPoolConfig,
): Promise<AccountPool> {
  const evmKeys = loadEvmPrivateKeys();
  return AccountPool.create(evmKeys, network, config);
}

// Re-export Signer type for use in settlement.ts
export type { Signer } from "x402/types";
