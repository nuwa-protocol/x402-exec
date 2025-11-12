/**
 * Balance Check Module
 *
 * Provides functionality to check user ERC20 token balances with caching support.
 * Used to prevent settlement of payments when users have insufficient funds.
 */

import { Address } from "viem";
import { CacheInterface } from "./cache/interface.js";
import { getLogger } from "./telemetry.js";

// Minimal ERC20 ABI with balanceOf function
const erc20ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const logger = getLogger();

/**
 * Balance check result
 */
export interface BalanceCheckResult {
  /** Whether the user has sufficient balance */
  hasSufficient: boolean;
  /** User's current balance as string (in wei) */
  balance: string;
  /** Required amount as string (in wei) */
  required: string;
  /** Whether this result came from cache */
  cached: boolean;
}

/**
 * Balance check configuration
 */
export interface BalanceCheckConfig {
  /** Cache TTL in seconds (default: 30) */
  cacheTTL?: number;
  /** Maximum number of cache entries (default: 1000) */
  maxCacheKeys?: number;
}

/**
 * Balance checker class with caching support
 */
export class BalanceChecker {
  private cache: CacheInterface;
  private cacheTTL: number;

  /**
   * Create a new BalanceChecker instance
   *
   * @param cache - Cache interface for storing balance data
   * @param config - Configuration options for balance checking
   */
  constructor(cache: CacheInterface, config: BalanceCheckConfig = {}) {
    this.cache = cache;
    this.cacheTTL = config.cacheTTL || 30; // 30 seconds default

    logger.info(
      {
        cacheTTL: this.cacheTTL,
        maxCacheKeys: config.maxCacheKeys,
      },
      "Balance checker initialized",
    );
  }

  /**
   * Check if user has sufficient ERC20 token balance
   *
   * @param client - Viem client for the network
   * @param userAddress - User's wallet address
   * @param tokenAddress - ERC20 token contract address
   * @param requiredAmount - Required amount in wei as string
   * @param network - Network name (for logging)
   * @returns Balance check result
   */
  async checkBalance(
    client: any, // Viem client with readContract method
    userAddress: Address,
    tokenAddress: Address,
    requiredAmount: string,
    network: string,
  ): Promise<BalanceCheckResult> {
    const cacheKey = `${network}:${userAddress}:${tokenAddress}`;

    // Try cache first
    const cachedResult = this.cache.get<BalanceCheckResult>(cacheKey);
    if (cachedResult) {
      logger.debug(
        {
          network,
          userAddress,
          tokenAddress,
          requiredAmount,
          cachedBalance: cachedResult.balance,
          cached: true,
        },
        "Balance check cache hit",
      );

      // Check if cached balance is still sufficient
      const cachedHasSufficient = BigInt(cachedResult.balance) >= BigInt(requiredAmount);
      return {
        ...cachedResult,
        hasSufficient: cachedHasSufficient,
        cached: true,
      };
    }

    // Cache miss - query blockchain
    logger.debug(
      {
        network,
        userAddress,
        tokenAddress,
        requiredAmount,
        cached: false,
      },
      "Balance check cache miss, querying blockchain",
    );

    try {
      const balance = (await client.readContract({
        address: tokenAddress,
        abi: erc20ABI,
        functionName: "balanceOf",
        args: [userAddress],
      })) as bigint;

      const balanceStr = balance.toString();
      const hasSufficient = balance >= BigInt(requiredAmount);

      const result: BalanceCheckResult = {
        hasSufficient,
        balance: balanceStr,
        required: requiredAmount,
        cached: false,
      };

      // Cache the result
      this.cache.set(cacheKey, result, this.cacheTTL);

      logger.debug(
        {
          network,
          userAddress,
          tokenAddress,
          balance: balanceStr,
          requiredAmount,
          hasSufficient,
          cached: false,
        },
        "Balance check completed",
      );

      return result;
    } catch (error) {
      logger.error(
        {
          error,
          network,
          userAddress,
          tokenAddress,
          requiredAmount,
        },
        "Failed to check user balance",
      );
      throw error;
    }
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics including hits, misses, and keys
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Clear all cached balance data
   */
  clearCache(): void {
    // Balance checker uses a dedicated cache instance, so this only clears balance data
    this.cache.flush();
    logger.info("Balance cache cleared");
  }
}

/**
 * Create a balance checker instance
 *
 * @param cache - Cache interface implementation
 * @param config - Balance check configuration
 * @returns Balance checker instance
 */
export function createBalanceChecker(
  cache: CacheInterface,
  config: BalanceCheckConfig = {},
): BalanceChecker {
  return new BalanceChecker(cache, config);
}
