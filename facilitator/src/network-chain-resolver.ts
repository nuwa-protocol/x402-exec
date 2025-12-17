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

import { evm } from "x402/types";
import { getSupportedNetworks } from "@x402x/core";
import { baseSepolia, base } from "viem/chains";
import type { Chain } from "viem";
import { getLogger } from "./telemetry.js";

/**
 * Chain information interface
 */
export interface ChainInfo {
  chain: Chain;
  rpcUrl: string;
  source: "viem" | "x402" | "environment";
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
      "base": base,
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
   * @param network - Network name (e.g., 'base', 'bsc', 'x-layer')
   * @returns Chain information or null if network not found
   */
  async resolveNetworkChain(network: string): Promise<ChainInfo | null> {
    // Check cache first
    if (this.chainCache.has(network)) {
      return this.chainCache.get(network)!;
    }

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
        return chainInfo;
      }
    }

    // Try viem chains first (for networks with direct viem support)
    const viemChain = this.viemChainMap[network];
    if (viemChain?.rpcUrls?.default?.http?.[0]) {
      const chainInfo: ChainInfo = {
        chain: viemChain,
        rpcUrl: viemChain.rpcUrls.default.http[0],
        source: "viem",
        networkName: network,
      };
      this.chainCache.set(network, chainInfo);
      return chainInfo;
    }

    // Fallback to x402 chains
    try {
      const x402Chain = evm.getChainFromNetwork(network);
      if (x402Chain?.rpcUrls?.default?.http?.[0]) {
        const chainInfo: ChainInfo = {
          chain: x402Chain,
          rpcUrl: x402Chain.rpcUrls.default.http[0],
          source: "x402",
          networkName: network,
        };
        this.chainCache.set(network, chainInfo);
        return chainInfo;
      }
    } catch (error) {
      const logger = getLogger();
    logger.debug({ network, error: String(error) }, "Network not found in x402 chains");
    }

    const logger = getLogger();
    logger.warn({ network }, "Network not found in any chain source");
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
        rpcUrls[network] = rpcUrl;
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
    }

    return status;
  }

  /**
   * Clear the resolver cache
   */
  clearCache(): void {
    this.chainCache.clear();
  }

  /**
   * Check if resolver is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get chain from any available source
   */
  private async getChainFromAnySource(network: string): Promise<Chain | null> {
    // Try viem first
    const viemChain = this.viemChainMap[network];
    if (viemChain) {
      return viemChain;
    }

    // Try x402
    try {
      return evm.getChainFromNetwork(network);
    } catch {
      return null;
    }
  }

  /**
   * Get RPC URL from environment variable
   */
  private getEnvironmentRpcUrl(network: string): string | undefined {
    const envVarName = `${network.toUpperCase().replace(/-/g, "_")}_RPC_URL`;
    return process.env[envVarName];
  }
}

// Export singleton instance
export const networkChainResolver = new NetworkChainResolver();