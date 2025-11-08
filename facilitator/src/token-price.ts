/**
 * Token Price Module
 *
 * Provides dynamic token price fetching from CoinGecko API with caching and fallback.
 */

import { getLogger } from "./telemetry.js";

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
  coinIds: Record<string, string>; // network -> CoinGecko coin ID mapping
}

/**
 * Default CoinGecko coin ID mapping
 */
const DEFAULT_COIN_IDS: Record<string, string> = {
  "base-sepolia": "ethereum",
  base: "ethereum",
  "x-layer-testnet": "okb",
  "x-layer": "okb",
};

/**
 * Get token price with caching and fallback
 *
 * @param network - Network name
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
    const coinId = config.coinIds[network] || DEFAULT_COIN_IDS[network];
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
