/**
 * Token Cache Wrapper
 *
 * Provides caching for token metadata like version, name, symbol, decimals.
 * Wraps RPC calls with automatic caching and TTL management.
 */

import type { CacheInterface } from "./interface.js";
import { getLogger } from "../telemetry.js";
import type { ConnectedClient } from "x402/types";

const logger = getLogger();

/**
 * Configuration for token cache
 */
export interface TokenCacheConfig {
  /** TTL for token version cache in seconds */
  versionTTL?: number;
  /** TTL for token metadata cache in seconds */
  metadataTTL?: number;
}

/**
 * Token cache wrapper for caching token metadata
 */
export class TokenCache {
  private cache: CacheInterface;
  private config: Required<TokenCacheConfig>;

  constructor(cache: CacheInterface, config?: TokenCacheConfig) {
    this.cache = cache;
    this.config = {
      versionTTL: config?.versionTTL || 3600, // 1 hour
      metadataTTL: config?.metadataTTL || 3600, // 1 hour
    };

    logger.info(
      {
        versionTTL: this.config.versionTTL,
        metadataTTL: this.config.metadataTTL,
      },
      "Token cache initialized",
    );
  }

  /**
   * Get cached token version or fetch from RPC
   *
   * @param network - Network name
   * @param asset - Token contract address
   * @param getter - Function to fetch version from RPC if not cached
   * @returns Token version string
   */
  async getVersion(network: string, asset: string, getter: () => Promise<string>): Promise<string> {
    const key = this.makeVersionKey(network, asset);
    const cached = this.cache.get<string>(key);

    if (cached !== undefined) {
      logger.debug({ network, asset, cached }, "Token version cache hit");
      return cached;
    }

    logger.debug({ network, asset }, "Token version cache miss, fetching...");
    const version = await getter();

    this.cache.set(key, version, this.config.versionTTL);
    logger.debug({ network, asset, version }, "Token version cached");

    return version;
  }

  /**
   * Get cached token metadata or fetch from RPC
   *
   * @param network - Network name
   * @param asset - Token contract address
   * @param getter - Function to fetch metadata from RPC if not cached
   * @returns Token metadata
   */
  async getMetadata<T>(network: string, asset: string, getter: () => Promise<T>): Promise<T> {
    const key = this.makeMetadataKey(network, asset);
    const cached = this.cache.get<T>(key);

    if (cached !== undefined) {
      logger.debug({ network, asset }, "Token metadata cache hit");
      return cached;
    }

    logger.debug({ network, asset }, "Token metadata cache miss, fetching...");
    const metadata = await getter();

    this.cache.set(key, metadata, this.config.metadataTTL);
    logger.debug({ network, asset }, "Token metadata cached");

    return metadata;
  }

  /**
   * Invalidate token version cache
   */
  invalidateVersion(network: string, asset: string): void {
    const key = this.makeVersionKey(network, asset);
    this.cache.del(key);
    logger.info({ network, asset }, "Token version cache invalidated");
  }

  /**
   * Invalidate token metadata cache
   */
  invalidateMetadata(network: string, asset: string): void {
    const key = this.makeMetadataKey(network, asset);
    this.cache.del(key);
    logger.info({ network, asset }, "Token metadata cache invalidated");
  }

  /**
   * Clear all token caches
   */
  clearAll(): void {
    this.cache.flush();
    logger.info("All token caches cleared");
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }

  private makeVersionKey(network: string, asset: string): string {
    return `version:${network}:${asset.toLowerCase()}`;
  }

  private makeMetadataKey(network: string, asset: string): string {
    return `metadata:${network}:${asset.toLowerCase()}`;
  }
}

export function createTokenCache(cache: CacheInterface, config?: TokenCacheConfig): TokenCache {
  return new TokenCache(cache, config);
}
