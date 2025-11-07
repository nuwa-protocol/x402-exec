/**
 * Dynamic Gas Price Module
 *
 * Provides dynamic gas price fetching with caching and fallback to static config.
 * Supports multiple strategies: static, dynamic, and hybrid.
 */

import { createPublicClient, http, type PublicClient } from "viem";
import { getLogger } from "./telemetry.js";
import type { GasCostConfig } from "./gas-cost.js";

const logger = getLogger();

/**
 * Gas price cache entry
 */
interface GasPriceCacheEntry {
  gasPrice: string;
  timestamp: number;
}

/**
 * Gas price cache (in-memory)
 */
const gasPriceCache = new Map<string, GasPriceCacheEntry>();

/**
 * Gas price strategy
 */
export type GasPriceStrategy = "static" | "dynamic" | "hybrid";

/**
 * Gas price configuration
 */
export interface DynamicGasPriceConfig {
  strategy: GasPriceStrategy;
  cacheTTL: number; // seconds
  updateInterval: number; // seconds
  rpcUrls: Record<string, string>; // network -> RPC URL
}

/**
 * Get gas price based on strategy
 *
 * @param network - Network name
 * @param config - Gas cost configuration
 * @param dynamicConfig - Dynamic gas price configuration
 * @returns Gas price in wei as string
 */
export async function getGasPrice(
  network: string,
  config: GasCostConfig,
  dynamicConfig?: DynamicGasPriceConfig,
): Promise<string> {
  const strategy = dynamicConfig?.strategy || "static";

  switch (strategy) {
    case "static":
      return getStaticGasPrice(network, config);

    case "dynamic":
      return getDynamicGasPrice(network, config, dynamicConfig);

    case "hybrid":
      return getHybridGasPrice(network, config, dynamicConfig);

    default:
      return getStaticGasPrice(network, config);
  }
}

/**
 * Get static gas price from configuration
 */
function getStaticGasPrice(network: string, config: GasCostConfig): string {
  const gasPrice = config.networkGasPrice[network];
  if (!gasPrice) {
    throw new Error(`No gas price configured for network ${network}`);
  }
  return gasPrice;
}

/**
 * Get dynamic gas price from chain (with caching)
 */
async function getDynamicGasPrice(
  network: string,
  config: GasCostConfig,
  dynamicConfig?: DynamicGasPriceConfig,
): Promise<string> {
  // Check cache first
  const cached = gasPriceCache.get(network);
  if (cached && dynamicConfig) {
    const age = (Date.now() - cached.timestamp) / 1000;
    if (age < dynamicConfig.cacheTTL) {
      logger.debug({ network, gasPrice: cached.gasPrice, age }, "Using cached gas price");
      return cached.gasPrice;
    }
  }

  // Fetch from chain
  try {
    const rpcUrl = dynamicConfig?.rpcUrls[network];
    if (!rpcUrl) {
      throw new Error(`No RPC URL configured for network ${network}`);
    }

    const client = createPublicClient({
      transport: http(rpcUrl),
    });

    const gasPrice = await client.getGasPrice();
    const gasPriceStr = gasPrice.toString();

    // Update cache
    gasPriceCache.set(network, {
      gasPrice: gasPriceStr,
      timestamp: Date.now(),
    });

    logger.debug({ network, gasPrice: gasPriceStr }, "Fetched gas price from chain");

    return gasPriceStr;
  } catch (error) {
    logger.warn({ error, network }, "Failed to fetch gas price from chain, using static fallback");

    // Fallback to static config
    return getStaticGasPrice(network, config);
  }
}

/**
 * Get hybrid gas price (try dynamic, fallback to static)
 */
async function getHybridGasPrice(
  network: string,
  config: GasCostConfig,
  dynamicConfig?: DynamicGasPriceConfig,
): Promise<string> {
  try {
    return await getDynamicGasPrice(network, config, dynamicConfig);
  } catch (error) {
    logger.debug({ error, network }, "Dynamic gas price failed, using static");
    return getStaticGasPrice(network, config);
  }
}

/**
 * Start background gas price updater
 *
 * @param networks - Networks to update
 * @param config - Gas cost configuration
 * @param dynamicConfig - Dynamic gas price configuration
 * @returns Cleanup function to stop the updater
 */
export function startGasPriceUpdater(
  networks: string[],
  config: GasCostConfig,
  dynamicConfig: DynamicGasPriceConfig,
): () => void {
  const updateGasPrices = async () => {
    for (const network of networks) {
      try {
        await getDynamicGasPrice(network, config, dynamicConfig);
      } catch (error) {
        logger.warn({ error, network }, "Failed to update gas price in background");
      }
    }
  };

  // Initial update
  updateGasPrices().catch((error) => {
    logger.error({ error }, "Error in initial gas price update");
  });

  // Schedule periodic updates
  const intervalId = setInterval(() => {
    updateGasPrices().catch((error) => {
      logger.error({ error }, "Error in background gas price update");
    });
  }, dynamicConfig.updateInterval * 1000);

  logger.info(
    {
      networks,
      updateInterval: dynamicConfig.updateInterval,
      cacheTTL: dynamicConfig.cacheTTL,
    },
    "Started background gas price updater",
  );

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    logger.info("Stopped background gas price updater");
  };
}

/**
 * Clear gas price cache for a network (or all networks)
 *
 * @param network - Optional network name (clears all if not specified)
 */
export function clearGasPriceCache(network?: string): void {
  if (network) {
    gasPriceCache.delete(network);
    logger.debug({ network }, "Cleared gas price cache for network");
  } else {
    gasPriceCache.clear();
    logger.debug("Cleared all gas price cache");
  }
}

/**
 * Get gas price cache statistics
 */
export function getGasPriceCacheStats() {
  const stats: Record<string, { gasPrice: string; age: number }> = {};

  for (const [network, entry] of gasPriceCache.entries()) {
    stats[network] = {
      gasPrice: entry.gasPrice,
      age: Math.floor((Date.now() - entry.timestamp) / 1000),
    };
  }

  return stats;
}
