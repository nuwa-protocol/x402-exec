/**
 * Network Chain Resolver
 *
 * Provides dynamic network-to-chain mapping with support for:
 * - viem chain definitions
 * - x402 chain definitions
 * - Environment variable overrides
 * - Caching for performance
 * - Automatic network discovery
 */

import { getSupportedNetworkIds, getChain as getX402xChain } from "@x402x/extensions"; // Use extensions version for v2 CAIP-2 support
// Alias for backward compatibility
const getSupportedNetworks = getSupportedNetworkIds;
import { baseSepolia, base } from "viem/chains";
import type { Chain } from "viem";
import { getLogger } from "./telemetry.js";
import { normalizeNetwork } from "./network-id.js";

/**
 * Chain information interface
 */
export interface ChainInfo {
  chain: Chain;
  rpcUrl: string;
  source: "viem" | "x402" | "x402x" | "environment"; // Added x402x source
  networkName: string;
}

/**
 * Network status information
 */
export interface NetworkStatus {
  valid: boolean;
  hasRpcUrl: boolean;
  source?: string;
  error?: string;
}

/**
 * Network Chain Resolver
 *
 * Handles dynamic resolution of network names to chain definitions and RPC URLs
 */
export class NetworkChainResolver {
  private initialized = false;
  private chainCache = new Map<string, ChainInfo>();
  private viemChainMap: Record<string, Chain>;

  constructor() {
    // Initialize viem chain mappings for networks that have direct viem support
    this.viemChainMap = {
      "base-sepolia": baseSepolia,
      base: base,
    };
  }

  /**
   * Initialize the resolver by pre-loading all supported networks
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const logger = getLogger();
    logger.info("Initializing NetworkChainResolver...");

    const supportedNetworks = getSupportedNetworks();
    logger.info({ networkCount: supportedNetworks.length }, "Loading supported networks");

    // Pre-resolve all networks for better performance
    for (const network of supportedNetworks) {
      try {
        await this.resolveNetworkChain(network);
      } catch (error) {
        logger.warn({ network, error: String(error) }, "Failed to pre-resolve network");
      }
    }

    this.initialized = true;
    logger.info("NetworkChainResolver initialization complete");
  }

  /**
   * Resolve a network name to chain information
   *
   * Priority:
   * 1. Environment variable RPC override (if configured)
   * 2. x402x chains (from @x402x/extensions - includes all supported networks with RPC)
   * 3. viem chains (fallback for standard networks)
   * 4. x402 chains (legacy fallback)
   *
   * @param network - Network identifier (v1 or v2 CAIP-2)
   * @returns Chain information or null if network not found
   */
  async resolveNetworkChain(network: string): Promise<ChainInfo | null> {
    // Check cache first
    if (this.chainCache.has(network)) {
      return this.chainCache.get(network)!;
    }

    const logger = getLogger();

    // Check environment variable override first
    const envRpcUrl = this.getEnvironmentRpcUrl(network);
    if (envRpcUrl) {
      const chain = await this.getChainFromAnySource(network);
      if (chain) {
        const chainInfo: ChainInfo = {
          chain,
          rpcUrl: envRpcUrl,
          source: "environment",
          networkName: network,
        };
        this.chainCache.set(network, chainInfo);
        logger.debug({ network, source: "environment" }, "Resolved chain from env override");
        return chainInfo;
      }
    }

    // Try x402x chains first (highest priority - includes all supported networks with RPC)
    try {
      const x402xChain = getX402xChain(network);
      if (x402xChain?.rpcUrls?.default?.http?.[0]) {
        const chainInfo: ChainInfo = {
          chain: x402xChain,
          rpcUrl: x402xChain.rpcUrls.default.http[0],
          source: "x402x" as any, // Extend source type
          networkName: network,
        };
        this.chainCache.set(network, chainInfo);
        logger.debug({ network, source: "x402x" }, "Resolved chain from x402x/extensions");
        return chainInfo;
      }
    } catch (error) {
      logger.debug({ network, error: String(error) }, "Network not found in x402x chains, trying fallback");
    }

    // Try viem chains (fallback for standard networks)
    const viemChain = this.viemChainMap[network];
    if (viemChain?.rpcUrls?.default?.http?.[0]) {
      const chainInfo: ChainInfo = {
        chain: viemChain,
        rpcUrl: viemChain.rpcUrls.default.http[0],
        source: "viem",
        networkName: network,
      };
      this.chainCache.set(network, chainInfo);
      logger.debug({ network, source: "viem" }, "Resolved chain from viem");
      return chainInfo;
    }

    // Fallback to x402 chains (legacy)
    try {
      const x402Chain = getX402xChain(network);
      if (x402Chain?.rpcUrls?.default?.http?.[0]) {
        const chainInfo: ChainInfo = {
          chain: x402Chain,
          rpcUrl: x402Chain.rpcUrls.default.http[0],
          source: "x402",
          networkName: network,
        };
        this.chainCache.set(network, chainInfo);
        logger.debug({ network, source: "x402" }, "Resolved chain from x402");
        return chainInfo;
      }
    } catch (error) {
      logger.debug({ network, error: String(error) }, "Network not found in x402 chains");
    }

    logger.warn({ network }, "Network not found in any chain source (x402x/viem/x402)");
    return null;
  }

  /**
   * Get RPC URL for a network
   *
   * @param network - Network name
   * @returns RPC URL or null if not found
   */
  async getRpcUrl(network: string): Promise<string | null> {
    // Check environment variable first
    const envRpcUrl = this.getEnvironmentRpcUrl(network);
    if (envRpcUrl) {
      return envRpcUrl;
    }

    // Get from resolved chain info
    const chainInfo = await this.resolveNetworkChain(network);
    return chainInfo?.rpcUrl || null;
  }

  /**
   * Get all RPC URLs for supported networks
   *
   * @returns Record mapping network names to RPC URLs
   */
  async getAllRpcUrls(): Promise<Record<string, string>> {
    const supportedNetworks = getSupportedNetworks();
    const rpcUrls: Record<string, string> = {};

    for (const network of supportedNetworks) {
      const rpcUrl = await this.getRpcUrl(network);
      if (rpcUrl) {
        // Store under canonical key
        rpcUrls[network] = rpcUrl;
        // Also store under v1 alias for backward compatibility (e.g., "base-sepolia", "bsc")
        try {
          const normalized = normalizeNetwork(network);
          rpcUrls[normalized.aliasV1] = rpcUrl;
        } catch {
          // ignore
        }
      }
    }

    return rpcUrls;
  }

  /**
   * Get status information for all supported networks
   *
   * @returns Network status information
   */
  async getNetworkStatus(): Promise<Record<string, NetworkStatus>> {
    const supportedNetworks = getSupportedNetworks();
    const status: Record<string, NetworkStatus> = {};

    for (const network of supportedNetworks) {
      const chainInfo = await this.resolveNetworkChain(network);

      status[network] = {
        valid: !!chainInfo,
        hasRpcUrl: !!chainInfo?.rpcUrl,
        source: chainInfo?.source,
        error: chainInfo ? undefined : "Network not found",
      };

      // Also expose status under v1 alias for backward compatibility
      try {
        const normalized = normalizeNetwork(network);
        status[normalized.aliasV1] = status[network];
      } catch {
        // ignore
      }
    }

    return status;
  }

  /**
   * Clear the resolver cache and reset initialization state
   */
  clearCache(): void {
    this.chainCache.clear();
    this.initialized = false;
  }

  /**
   * Check if resolver is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get chain from any available source
   * Priority: x402x > viem > x402
   */
  private async getChainFromAnySource(network: string): Promise<Chain | null> {
    // Try x402x first (highest priority - includes all supported networks)
    try {
      const x402xChain = getX402xChain(network);
      if (x402xChain) {
        return x402xChain;
      }
    } catch {
      // Continue to next source
    }

    // Try viem (fallback for standard networks)
    const viemChain = this.viemChainMap[network];
    if (viemChain) {
      return viemChain;
    }

    // Try x402 (legacy fallback)
    try {
      return getX402xChain(network);
    } catch {
      return null;
    }
  }

  /**
   * Get RPC URL from environment variable
   */
  private getEnvironmentRpcUrl(network: string): string | undefined {
    // Backward compatible env var lookup:
    // - Accept v1 aliases: BASE_SEPOLIA_RPC_URL, BSC_RPC_URL, etc.
    // - Accept CAIP-2 canonical: EIP155_84532_RPC_URL, EIP155_56_RPC_URL, etc.
    //
    // NOTE: raw CAIP-2 contains ":", which is not valid in env var names, so we normalize.
    const direct = `${network.toUpperCase().replace(/[-:]/g, "_")}_RPC_URL`;
    if (process.env[direct]) return process.env[direct];

    try {
      const normalized = normalizeNetwork(network);
      const aliasKey = `${normalized.aliasV1.toUpperCase().replace(/[-:]/g, "_")}_RPC_URL`;
      if (process.env[aliasKey]) return process.env[aliasKey];

      const canonicalKey = `${normalized.canonical.toUpperCase().replace(/[-:]/g, "_")}_RPC_URL`;
      if (process.env[canonicalKey]) return process.env[canonicalKey];
    } catch {
      // ignore
    }

    return undefined;
  }
}

// Export singleton instance
export const networkChainResolver = new NetworkChainResolver();
