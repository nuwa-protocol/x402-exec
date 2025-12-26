/**
 * Account Pool Manager
 *
 * Manages initialization and access to account pools for both EVM and SVM networks.
 * Provides a unified interface for working with multiple account pools.
 * Uses canonical network keys for internal consistency.
 */

import { AccountPool } from "./account-pool.js";
import type { AccountPoolConfig, NetworkConfig } from "./config.js";
import { getLogger } from "./telemetry.js";
import { getCanonicalNetwork, getNetworkDisplayName } from "./network-utils.js";
import { getConfigForNetwork, normalizeNetwork, hasNetworkConfig } from "./network-id.js";

const logger = getLogger();

/**
 * Account pools manager
 * Uses canonical network keys (CAIP-2) internally for consistency
 */
export class PoolManager {
  private evmAccountPools: Map<string, AccountPool> = new Map();
  private networkAliasCache: Map<string, string> = new Map();

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
   * Uses canonical network keys for internal storage
   */
  async initialize(): Promise<void> {
    // Initialize EVM account pools
    if (this.evmPrivateKeys.length > 0) {
      for (const network of this.networkConfig.evmNetworks) {
        try {
          // Convert to canonical network key for internal storage
          const canonicalNetwork = getCanonicalNetwork(network);
          const displayName = getNetworkDisplayName(canonicalNetwork);

          // Get RPC URL for this network (with v1/v2 fallback)
          const rpcLookup = getConfigForNetwork(this.rpcUrls, network);
          const rpcUrl = rpcLookup.value;

          const pool = await AccountPool.create(this.evmPrivateKeys, network, {
            strategy: this.accountPoolConfig.strategy,
            rpcUrl, // Pass custom RPC URL if available
          });

          // Store using canonical key but maintain mapping for both formats
          this.evmAccountPools.set(canonicalNetwork, pool);
          this.networkAliasCache.set(network, canonicalNetwork);
          this.networkAliasCache.set(canonicalNetwork, canonicalNetwork);

          logger.info(
            {
              network: displayName,
              canonicalNetwork,
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
        evmNetworks: Array.from(this.evmAccountPools.keys()).map((canonical) =>
          getNetworkDisplayName(canonical),
        ),
        canonicalNetworks: Array.from(this.evmAccountPools.keys()),
        strategy: this.accountPoolConfig.strategy,
      },
      "Account pools initialized",
    );
  }

  /**
   * Get account pool for a given network
   * Accepts both v1 human-readable names and v2 CAIP-2 identifiers
   *
   * @param network - Network name (v1 format) or canonical network key (v2 format)
   * @returns AccountPool if available, undefined otherwise
   */
  getPool(network: string): AccountPool | undefined {
    // Try to get canonical network key from cache or convert on-the-fly
    let canonicalNetwork = this.networkAliasCache.get(network);
    if (!canonicalNetwork) {
      try {
        canonicalNetwork = getCanonicalNetwork(network);
        // Cache the mapping for future lookups
        this.networkAliasCache.set(network, canonicalNetwork);
      } catch (error) {
        logger.warn({ network, error }, "Failed to canonicalize network for pool lookup");
        return undefined;
      }
    }

    return this.evmAccountPools.get(canonicalNetwork);
  }

  /**
   * Get all EVM account pools
   * Returns mapping from canonical network keys to account pools
   */
  getEvmAccountPools(): Map<string, AccountPool> {
    return this.evmAccountPools;
  }

  /**
   * Get supported networks with both human-readable and canonical names
   */
  getSupportedNetworks(): { humanReadable: string; canonical: string }[] {
    return Array.from(this.evmAccountPools.keys()).map((canonical) => ({
      canonical,
      humanReadable: getNetworkDisplayName(canonical),
    }));
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

  /**
   * Get the facilitator signer address for v2 advertisement
   * Returns the address of the first EVM account from any initialized pool
   *
   * @returns The facilitator signer address, or undefined if no pools exist
   */
  getFacilitatorSignerAddress(): string | undefined {
    // Get first pool
    const firstPool = this.evmAccountPools.values().next().value as AccountPool | undefined;
    if (!firstPool) {
      return undefined;
    }

    // Get first account address from the pool
    return firstPool.getFirstAccountAddress();
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
