/**
 * Memory Cache Implementation
 *
 * In-memory caching using node-cache with LRU eviction and automatic TTL expiration.
 * Suitable for single-instance deployments or non-critical caching scenarios.
 */

import NodeCache from "node-cache";
import type { CacheInterface, CacheStats, CacheConfig } from "./interface.js";
import { getLogger } from "../telemetry.js";

const logger = getLogger();

/**
 * Memory cache implementation using node-cache
 */
export class MemoryCache implements CacheInterface {
  private cache: NodeCache;
  private hits = 0;
  private misses = 0;

  constructor(config?: CacheConfig) {
    const defaultConfig: CacheConfig = {
      stdTTL: 3600, // 1 hour default
      checkperiod: 600, // Check for expired keys every 10 minutes
      maxKeys: 1000, // Maximum 1000 keys
    };

    const finalConfig = { ...defaultConfig, ...config };

    this.cache = new NodeCache({
      stdTTL: finalConfig.stdTTL,
      checkperiod: finalConfig.checkperiod,
      maxKeys: finalConfig.maxKeys,
      useClones: false, // Don't clone objects for better performance
    });

    logger.info(
      {
        stdTTL: finalConfig.stdTTL,
        checkperiod: finalConfig.checkperiod,
        maxKeys: finalConfig.maxKeys,
      },
      "Memory cache initialized",
    );

    // Log cache events
    this.cache.on("expired", (key: string) => {
      logger.debug({ key }, "Cache key expired");
    });

    this.cache.on("flush", () => {
      logger.info("Cache flushed");
    });
  }

  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);

    if (value !== undefined) {
      this.hits++;
      logger.debug({ key }, "Cache hit");
      return value;
    }

    this.misses++;
    logger.debug({ key }, "Cache miss");
    return undefined;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const success = this.cache.set(key, value, ttl || 0);

    if (success) {
      logger.debug({ key, ttl: ttl || "default" }, "Cache set");
    } else {
      logger.warn({ key }, "Failed to set cache key");
    }
  }

  del(key: string): boolean {
    const deleted = this.cache.del(key) > 0;

    if (deleted) {
      logger.debug({ key }, "Cache key deleted");
    }

    return deleted;
  }

  has(key: string): boolean {
    return this.cache.has(key);
  }

  flush(): void {
    this.cache.flushAll();
    this.hits = 0;
    this.misses = 0;
    logger.info("Cache flushed");
  }

  getStats(): CacheStats {
    const nodeStats = this.cache.getStats();

    return {
      hits: this.hits,
      misses: this.misses,
      keys: this.cache.keys().length,
      ksize: nodeStats.ksize,
      vsize: nodeStats.vsize,
    };
  }

  /**
   * Get hit rate as a percentage
   */
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }
}

/**
 * Create a memory cache instance with optional configuration
 */
export function createMemoryCache(config?: CacheConfig): MemoryCache {
  return new MemoryCache(config);
}
