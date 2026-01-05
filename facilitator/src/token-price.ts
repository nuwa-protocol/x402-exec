/**
 * Token Price Module
 *
 * Provides dynamic token price fetching from CoinGecko API with caching and fallback.
 */

import { getLogger } from "./telemetry.js";
import { normalizeNetwork } from "./network-id.js";

const logger = getLogger();

/**
 * Token price cache entry
 */
interface TokenPriceCacheEntry {
  price: number;
  timestamp: number;
}

/**
 * Token price cache (in-memory)
 */
const tokenPriceCache = new Map<string, TokenPriceCacheEntry>();

/**
 * Token price configuration
 */
export interface TokenPriceConfig {
  enabled: boolean; // Enable dynamic price fetching
  cacheTTL: number; // Cache TTL in seconds
  updateInterval: number; // Background update interval in seconds
  apiKey?: string; // Optional CoinGecko Pro API key
  coinIds?: Record<string, string>; // Optional network -> CoinGecko coin ID mapping
}

/**
 * Default native token CoinGecko coin ID mapping by CAIP-2 network ID
 *
 * Maps CAIP-2 network identifiers to CoinGecko coin IDs for fetching native token prices.
 * Used when no custom coin ID is provided via TOKEN_PRICE_CONFIG.coinIds.
 *
 * @example
 * ```typescript
 * // Get CoinGecko ID for Base Sepolia
 * const coinId = DEFAULT_NETWORK_COIN_IDS["eip155:84532"]; // "ethereum"
 *
 * // Get CoinGecko ID for BSC mainnet
 * const coinId = DEFAULT_NETWORK_COIN_IDS["eip155:56"]; // "binancecoin"
 * ```
 */
const DEFAULT_NETWORK_COIN_IDS: Record<string, string> = {
  // Base networks (ETH)
  "eip155:84532": "ethereum", // Base Sepolia testnet
  "eip155:8453": "ethereum", // Base mainnet

  // X-Layer networks (OKB)
  "eip155:1952": "okb", // X-Layer testnet
  "eip155:196": "okb", // X-Layer mainnet

  // BSC networks (BNB)
  "eip155:97": "binancecoin", // BSC testnet
  "eip155:56": "binancecoin", // BSC mainnet
};

/**
 * Get token price with caching and fallback
 *
 * Accepts both v1 aliases (e.g., "base-sepolia") and v2 CAIP-2 IDs (e.g., "eip155:84532").
 * Internally normalizes to CAIP-2 for looking up in DEFAULT_NETWORK_COIN_IDS.
 *
 * @param network - Network name (v1 alias or v2 CAIP-2)
 * @param staticPrice - Static fallback price
 * @param config - Optional token price configuration
 * @returns Token price in USD
 */
export async function getTokenPrice(
  network: string,
  staticPrice: number,
  config?: TokenPriceConfig,
): Promise<number> {
  // If dynamic pricing is disabled, return static price
  if (!config?.enabled) {
    return staticPrice;
  }

  // Check cache first
  const cached = tokenPriceCache.get(network);
  if (cached) {
    const age = (Date.now() - cached.timestamp) / 1000;
    if (age < config.cacheTTL) {
      logger.debug({ network, price: cached.price, age }, "Using cached token price");
      return cached.price;
    }
  }

  // Fetch from CoinGecko API
  try {
    // Try custom coin IDs from config first (supports both v1 and v2 keys)
    let coinId = config?.coinIds?.[network];

    // If not in custom config, look up in default mapping
    if (!coinId) {
      try {
        // Normalize to CAIP-2 canonical format
        const normalized = normalizeNetwork(network);

        // Try canonical CAIP-2 key in custom config
        if (!coinId && config?.coinIds) {
          coinId = config.coinIds[normalized.canonical];
        }

        // Try v1 alias in custom config for backward compatibility
        if (!coinId && config?.coinIds) {
          coinId = config.coinIds[normalized.aliasV1];
        }

        // Finally, fall back to default network coin ID mapping
        if (!coinId) {
          coinId = DEFAULT_NETWORK_COIN_IDS[normalized.canonical];
        }
      } catch {
        // Network normalization failed (unsupported network), will use static fallback
      }
    }

    if (!coinId) {
      logger.warn({ network }, "No CoinGecko ID for network, using static price");
      return staticPrice;
    }

    const price = await fetchCoinGeckoPrice(coinId, config.apiKey);

    // Update cache
    tokenPriceCache.set(network, {
      price,
      timestamp: Date.now(),
    });

    logger.debug({ network, coinId, price }, "Fetched token price from CoinGecko");

    return price;
  } catch (error) {
    logger.warn({ error, network }, "Failed to fetch token price, using static fallback");
    return staticPrice;
  }
}

/**
 * Fetch price from CoinGecko API
 *
 * @param coinId - CoinGecko coin ID (e.g., "ethereum", "okb")
 * @param apiKey - Optional Pro API key
 * @returns Price in USD
 */
async function fetchCoinGeckoPrice(coinId: string, apiKey?: string): Promise<number> {
  const baseUrl = apiKey
    ? "https://pro-api.coingecko.com/api/v3"
    : "https://api.coingecko.com/api/v3";

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (apiKey) {
    headers["x-cg-pro-api-key"] = apiKey;
  }

  const url = `${baseUrl}/simple/price?ids=${coinId}&vs_currencies=usd`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as Record<string, { usd: number }>;

  const price = data[coinId]?.usd;
  if (!price) {
    throw new Error(`Price not found for coin ${coinId}`);
  }

  return price;
}

/**
 * Start background token price updater
 *
 * @param networks - Networks to update
 * @param staticPrices - Static price fallbacks
 * @param config - Token price configuration
 * @returns Cleanup function to stop the updater
 */
export function startTokenPriceUpdater(
  networks: string[],
  staticPrices: Record<string, number>,
  config: TokenPriceConfig,
): () => void {
  const updatePrices = async () => {
    for (const network of networks) {
      try {
        const staticPrice = staticPrices[network] || 0;
        await getTokenPrice(network, staticPrice, config);
      } catch (error) {
        logger.warn({ error, network }, "Failed to update token price in background");
      }
    }
  };

  // Initial update
  updatePrices().catch((error) => {
    logger.error({ error }, "Error in initial token price update");
  });

  // Schedule periodic updates
  const intervalId = setInterval(() => {
    updatePrices().catch((error) => {
      logger.error({ error }, "Error in background token price update");
    });
  }, config.updateInterval * 1000);

  logger.info(
    {
      networks,
      updateInterval: config.updateInterval,
      cacheTTL: config.cacheTTL,
    },
    "Started background token price updater",
  );

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    logger.info("Stopped background token price updater");
  };
}

/**
 * Clear token price cache
 *
 * @param network - Optional network name (clears all if not specified)
 */
export function clearTokenPriceCache(network?: string): void {
  if (network) {
    tokenPriceCache.delete(network);
    logger.debug({ network }, "Cleared token price cache for network");
  } else {
    tokenPriceCache.clear();
    logger.debug("Cleared all token price cache");
  }
}

/**
 * Get token price cache statistics
 */
export function getTokenPriceCacheStats() {
  const stats: Record<string, { price: number; age: number }> = {};

  for (const [network, entry] of tokenPriceCache.entries()) {
    stats[network] = {
      price: entry.price,
      age: Math.floor((Date.now() - entry.timestamp) / 1000),
    };
  }

  return stats;
}
