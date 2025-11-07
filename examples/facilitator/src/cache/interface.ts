/**
 * Cache Interface
 *
 * Unified caching interface to support multiple implementations (memory, Redis, etc.)
 * This allows for future extensibility while maintaining a consistent API.
 */

export interface CacheInterface {
  /**
   * Get a value from the cache
   *
   * @param key - Cache key
   * @returns The cached value, or undefined if not found or expired
   */
  get<T>(key: string): T | undefined;

  /**
   * Set a value in the cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds (optional, uses default if not provided)
   */
  set<T>(key: string, value: T, ttl?: number): void;

  /**
   * Delete a value from the cache
   *
   * @param key - Cache key
   * @returns True if the key was deleted, false if it didn't exist
   */
  del(key: string): boolean;

  /**
   * Check if a key exists in the cache
   *
   * @param key - Cache key
   * @returns True if the key exists and hasn't expired
   */
  has(key: string): boolean;

  /**
   * Clear all entries from the cache
   */
  flush(): void;

  /**
   * Get cache statistics
   *
   * @returns Cache statistics (hits, misses, keys, etc.)
   */
  getStats(): CacheStats;
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize?: number; // Key size in bytes (if available)
  vsize?: number; // Value size in bytes (if available)
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Default TTL in seconds */
  stdTTL?: number;
  /** Check period for expired keys in seconds */
  checkperiod?: number;
  /** Maximum number of keys */
  maxKeys?: number;
}
