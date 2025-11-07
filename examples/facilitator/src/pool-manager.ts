/**
 * Account Pool Manager
 *
 * Manages initialization and access to account pools for both EVM and SVM networks.
 * Provides a unified interface for working with multiple account pools.
 */

import { AccountPool } from "./account-pool.js";
import type { AccountPoolConfig, NetworkConfig } from "./config.js";
import { getLogger } from "./telemetry.js";

const logger = getLogger();

/**
 * Account pools manager
 */
export class PoolManager {
  private evmAccountPools: Map<string, AccountPool> = new Map();
  private svmAccountPools: Map<string, AccountPool> = new Map();

  constructor(
    private evmPrivateKeys: string[],
    private svmPrivateKeys: string[],
    private networkConfig: NetworkConfig,
    private accountPoolConfig: AccountPoolConfig,
  ) {}

  /**
   * Initialize all account pools for EVM and SVM networks
   */
  async initialize(): Promise<void> {
    // Initialize EVM account pools
    if (this.evmPrivateKeys.length > 0) {
      for (const network of this.networkConfig.evmNetworks) {
        try {
          const pool = await AccountPool.create(this.evmPrivateKeys, network, {
            strategy: this.accountPoolConfig.strategy,
          });
          this.evmAccountPools.set(network, pool);
          logger.info({ network, accounts: pool.getAccountCount() }, "EVM account pool created");
        } catch (error) {
          logger.warn({ network, error }, "Failed to create EVM account pool for network");
        }
      }
    }

    // Initialize SVM account pools
    if (this.svmPrivateKeys.length > 0) {
      for (const network of this.networkConfig.svmNetworks) {
        try {
          const pool = await AccountPool.create(this.svmPrivateKeys, network, {
            strategy: this.accountPoolConfig.strategy,
          });
          this.svmAccountPools.set(network, pool);
          logger.info({ network, accounts: pool.getAccountCount() }, "SVM account pool created");
        } catch (error) {
          logger.warn({ network, error }, "Failed to create SVM account pool for network");
        }
      }
    }

    // Log account pool summary
    logger.info(
      {
        evmAccounts: this.evmPrivateKeys.length,
        svmAccounts: this.svmPrivateKeys.length,
        evmNetworks: Array.from(this.evmAccountPools.keys()),
        svmNetworks: Array.from(this.svmAccountPools.keys()),
        strategy: this.accountPoolConfig.strategy,
      },
      "Account pools initialized",
    );
  }

  /**
   * Get account pool for a given network
   *
   * @param network - Network name
   * @returns AccountPool if available, undefined otherwise
   */
  getPool(network: string): AccountPool | undefined {
    return this.evmAccountPools.get(network) || this.svmAccountPools.get(network);
  }

  /**
   * Get all EVM account pools
   */
  getEvmAccountPools(): Map<string, AccountPool> {
    return this.evmAccountPools;
  }

  /**
   * Get all SVM account pools
   */
  getSvmAccountPools(): Map<string, AccountPool> {
    return this.svmAccountPools;
  }

  /**
   * Get total number of EVM accounts
   */
  getEvmAccountCount(): number {
    return this.evmPrivateKeys.length;
  }

  /**
   * Get total number of SVM accounts
   */
  getSvmAccountCount(): number {
    return this.svmPrivateKeys.length;
  }

  /**
   * Check if any accounts are configured
   */
  hasAccounts(): boolean {
    return this.evmPrivateKeys.length > 0 || this.svmPrivateKeys.length > 0;
  }
}

/**
 * Create and initialize a pool manager
 *
 * @param evmPrivateKeys - Array of EVM private keys
 * @param svmPrivateKeys - Array of SVM private keys
 * @param networkConfig - Network configuration
 * @param accountPoolConfig - Account pool configuration
 * @returns Initialized PoolManager
 */
export async function createPoolManager(
  evmPrivateKeys: string[],
  svmPrivateKeys: string[],
  networkConfig: NetworkConfig,
  accountPoolConfig: AccountPoolConfig,
): Promise<PoolManager> {
  const manager = new PoolManager(evmPrivateKeys, svmPrivateKeys, networkConfig, accountPoolConfig);
  await manager.initialize();
  return manager;
}
