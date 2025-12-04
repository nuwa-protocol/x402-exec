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

  /**
   * Constructor for PoolManager
   *
   * @param evmPrivateKeys - Array of EVM private keys
   * @param networkConfig - Network configuration
   * @param accountPoolConfig - Account pool configuration
   * @param rpcUrls - Optional RPC URLs per network (network name -> RPC URL)
   */
  constructor(
    private evmPrivateKeys: string[],
    private networkConfig: NetworkConfig,
    private accountPoolConfig: AccountPoolConfig,
    private rpcUrls: Record<string, string> = {},
  ) {}

  /**
   * Initialize all account pools for EVM networks
   */
  async initialize(): Promise<void> {
    // Initialize EVM account pools
    if (this.evmPrivateKeys.length > 0) {
      for (const network of this.networkConfig.evmNetworks) {
        try {
          // Get RPC URL for this network (from dynamicGasPrice config)
          const rpcUrl = this.rpcUrls[network];

          const pool = await AccountPool.create(this.evmPrivateKeys, network, {
            strategy: this.accountPoolConfig.strategy,
            rpcUrl, // Pass custom RPC URL if available
          });
          this.evmAccountPools.set(network, pool);
          logger.info(
            {
              network,
              accounts: pool.getAccountCount(),
              rpcUrl: rpcUrl || "(chain default)",
            },
            "EVM account pool created",
          );
        } catch (error) {
          logger.warn({ network, error }, "Failed to create EVM account pool for network");
        }
      }
    }

    // Log account pool summary
    logger.info(
      {
        evmAccounts: this.evmPrivateKeys.length,
        evmNetworks: Array.from(this.evmAccountPools.keys()),
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
    return this.evmAccountPools.get(network);
  }

  /**
   * Get all EVM account pools
   */
  getEvmAccountPools(): Map<string, AccountPool> {
    return this.evmAccountPools;
  }

  /**
   * Get total number of EVM accounts
   */
  getEvmAccountCount(): number {
    return this.evmPrivateKeys.length;
  }

  /**
   * Check if any accounts are configured
   */
  hasAccounts(): boolean {
    return this.evmPrivateKeys.length > 0;
  }
}

/**
 * Create and initialize a pool manager
 *
 * @param evmPrivateKeys - Array of EVM private keys
 * @param networkConfig - Network configuration
 * @param accountPoolConfig - Account pool configuration
 * @param rpcUrls - Optional RPC URLs per network (network name -> RPC URL)
 * @returns Initialized PoolManager
 */
export async function createPoolManager(
  evmPrivateKeys: string[],
  networkConfig: NetworkConfig,
  accountPoolConfig: AccountPoolConfig,
  rpcUrls: Record<string, string> = {},
): Promise<PoolManager> {
  const manager = new PoolManager(evmPrivateKeys, networkConfig, accountPoolConfig, rpcUrls);
  await manager.initialize();
  return manager;
}
