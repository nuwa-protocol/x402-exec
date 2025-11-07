/**
 * Configuration Module
 *
 * Centralizes all configuration management including:
 * - Environment variable parsing
 * - Cache configuration
 * - Account selection strategy
 * - SettlementRouter whitelist
 * - X402 configuration
 */

import { config as loadEnv } from "dotenv";
import type { X402Config } from "x402/types";
import { getSupportedNetworks, getNetworkConfig, isNetworkSupported } from "@x402x/core";
import type { GasCostConfig } from "./gas-cost.js";

// Load environment variables
loadEnv();

/**
 * Cache configuration
 */
export interface CacheConfig {
  enabled: boolean;
  ttlTokenVersion: number;
  ttlTokenMetadata: number;
  maxKeys: number;
}

/**
 * Account pool configuration
 */
export interface AccountPoolConfig {
  strategy: "round_robin" | "random";
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  evmNetworks: string[];
}

/**
 * Server configuration
 */
export interface ServerConfig {
  port: number;
  shutdownTimeoutMs: number;
  requestBodyLimit: string;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  verifyMax: number;
  settleMax: number;
  windowMs: number;
}

/**
 * Application configuration
 */
export interface AppConfig {
  cache: CacheConfig;
  accountPool: AccountPoolConfig;
  network: NetworkConfig;
  server: ServerConfig;
  rateLimit: RateLimitConfig;
  allowedSettlementRouters: Record<string, string[]>;
  x402Config?: X402Config;
  evmPrivateKeys: string[];
  gasCost: GasCostConfig;
}

/**
 * Parse cache configuration from environment variables
 *
 * @returns Cache configuration object
 */
function parseCacheConfig(): CacheConfig {
  return {
    enabled: process.env.CACHE_ENABLED !== "false",
    ttlTokenVersion: parseInt(process.env.CACHE_TTL_TOKEN_VERSION || "3600"),
    ttlTokenMetadata: parseInt(process.env.CACHE_TTL_TOKEN_METADATA || "3600"),
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS || "1000"),
  };
}

/**
 * Parse account pool configuration from environment variables
 *
 * @returns Account pool configuration object
 */
function parseAccountPoolConfig(): AccountPoolConfig {
  const strategy = process.env.ACCOUNT_SELECTION_STRATEGY || "round_robin";
  if (strategy !== "round_robin" && strategy !== "random") {
    throw new Error(`Invalid ACCOUNT_SELECTION_STRATEGY: ${strategy}`);
  }
  return { strategy };
}

/**
 * Parse network configuration from environment variables
 * Uses x402x core to get supported networks dynamically
 *
 * @returns Network configuration object
 */
function parseNetworkConfig(): NetworkConfig {
  // Get supported networks from x402x core
  const supportedNetworks = getSupportedNetworks();

  return {
    evmNetworks: supportedNetworks,
  };
}

/**
 * Parse server configuration from environment variables
 *
 * @returns Server configuration object
 */
function parseServerConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || "3000"),
    shutdownTimeoutMs: 30000, // 30 seconds
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT || "1mb",
  };
}

/**
 * Parse rate limiting configuration from environment variables
 *
 * @returns Rate limiting configuration object
 */
function parseRateLimitConfig(): RateLimitConfig {
  return {
    enabled: process.env.RATE_LIMIT_ENABLED !== "false", // Enabled by default
    verifyMax: parseInt(process.env.RATE_LIMIT_VERIFY_MAX || "100"),
    settleMax: parseInt(process.env.RATE_LIMIT_SETTLE_MAX || "20"),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"), // 1 minute
  };
}

/**
 * Parse SettlementRouter whitelist from environment variables
 * Priority: Environment variables > x402x core default configuration
 *
 * @returns Record mapping network names to allowed SettlementRouter addresses
 */
function parseAllowedSettlementRouters(): Record<string, string[]> {
  const supportedNetworks = getSupportedNetworks();
  const routers: Record<string, string[]> = {};

  for (const network of supportedNetworks) {
    const addresses: string[] = [];

    // 1. Try to get from environment variable
    const envVarName = networkToEnvVar(network);
    const envAddress = process.env[envVarName];

    if (envAddress) {
      addresses.push(envAddress);
    } else {
      // 2. Fallback to x402x core configuration
      try {
        if (isNetworkSupported(network)) {
          const networkConfig = getNetworkConfig(network);
          if (networkConfig.settlementRouter) {
            addresses.push(networkConfig.settlementRouter);
          }
        }
      } catch {
        // Network not configured in x402x core, skip
      }
    }

    routers[network] = addresses.filter(Boolean);
  }

  return routers;
}

/**
 * Convert network name to environment variable name
 * e.g., "base-sepolia" -> "BASE_SEPOLIA_SETTLEMENT_ROUTER_ADDRESS"
 *
 * @param network - Network name to convert
 * @returns Environment variable name for the network
 */
function networkToEnvVar(network: string): string {
  return `${network.toUpperCase().replace(/-/g, "_")}_SETTLEMENT_ROUTER_ADDRESS`;
}

/**
 * Parse X402 configuration from environment variables
 *
 * @returns X402 configuration object or undefined if not configured
 */
function parseX402Config(): X402Config | undefined {
  // Currently no X402 config needed for EVM-only setup
  return undefined;
}

/**
 * Check if a network is a testnet based on its name
 * Testnets typically contain: sepolia, testnet, fuji, amoy, etc.
 *
 * @param network - Network name to check
 * @returns True if the network is a testnet, false otherwise
 */
export function isTestnet(network: string): boolean {
  const testnetKeywords = ["sepolia", "testnet", "fuji", "amoy", "goerli"];
  return testnetKeywords.some((keyword) => network.toLowerCase().includes(keyword));
}

/**
 * Check if standard x402 settlement is allowed for a given network
 * Mainnet networks disable standard x402 due to lack of API key protection
 * Only SettlementRouter (x402x) mode is allowed on mainnet
 *
 * @param network - Network name to check
 * @returns True if standard x402 settlement is allowed, false otherwise
 */
export function isStandardX402Allowed(network: string): boolean {
  return isTestnet(network);
}

/**
 * Load EVM private keys from environment variables
 *
 * @returns Array of EVM private keys
 */
function loadEvmPrivateKeys(): string[] {
  const keys: string[] = [];

  // Load from EVM_PRIVATE_KEY_1, EVM_PRIVATE_KEY_2, etc.
  for (let i = 1; i <= 100; i++) {
    const key = process.env[`EVM_PRIVATE_KEY_${i}`];
    if (key) {
      keys.push(key);
    } else {
      break; // Stop at first missing key
    }
  }

  // Fallback to single EVM_PRIVATE_KEY
  if (keys.length === 0 && process.env.EVM_PRIVATE_KEY) {
    keys.push(process.env.EVM_PRIVATE_KEY);
  }

  return keys;
}

/**
 * Parse Hook whitelist from environment variables
 *
 * @returns Record mapping network names to allowed Hook addresses
 */
function parseAllowedHooks(): Record<string, string[]> {
  const supportedNetworks = getSupportedNetworks();
  const hooks: Record<string, string[]> = {};

  for (const network of supportedNetworks) {
    const addresses: string[] = [];

    // Try to get from environment variable
    const envVarName = `${network.toUpperCase().replace(/-/g, "_")}_ALLOWED_HOOKS`;
    const envValue = process.env[envVarName];

    if (envValue) {
      // Support comma-separated list
      addresses.push(
        ...envValue
          .split(",")
          .map((addr) => addr.trim())
          .filter(Boolean),
      );
    } else {
      // Fallback to default hooks from network config
      try {
        if (isNetworkSupported(network)) {
          const networkConfig = getNetworkConfig(network);
          if (networkConfig.hooks?.transfer) {
            addresses.push(networkConfig.hooks.transfer);
          }
        }
      } catch {
        // Network not configured, skip
      }
    }

    hooks[network] = addresses.filter(Boolean);
  }

  return hooks;
}

/**
 * Parse gas cost configuration from environment variables
 *
 * @returns Gas cost configuration object
 */
function parseGasCostConfig(): GasCostConfig {
  const supportedNetworks = getSupportedNetworks();

  // Parse hook gas overhead
  const hookGasOverhead: Record<string, number> = {
    transfer: parseInt(process.env.GAS_COST_HOOK_TRANSFER_OVERHEAD || "50000"),
    custom: parseInt(process.env.GAS_COST_HOOK_CUSTOM_OVERHEAD || "100000"),
  };

  // Parse network gas prices
  const networkGasPrice: Record<string, string> = {};
  for (const network of supportedNetworks) {
    const envVarName = `${network.toUpperCase().replace(/-/g, "_")}_TARGET_GAS_PRICE`;
    const gasPrice = process.env[envVarName];
    if (gasPrice) {
      networkGasPrice[network] = gasPrice;
    } else {
      // Default gas prices for common networks (testnets have low gas prices)
      if (network.includes("sepolia")) {
        networkGasPrice[network] = "1000000000"; // 1 gwei for Sepolia testnets
      } else if (network.includes("testnet")) {
        networkGasPrice[network] = "100000000"; // 0.1 gwei for other testnets (very cheap)
      } else {
        networkGasPrice[network] = "1000000000"; // 1 gwei default for mainnets
      }
    }
  }

  // Parse native token prices
  const nativeTokenPrice: Record<string, number> = {};
  for (const network of supportedNetworks) {
    const envVarName = `${network.toUpperCase().replace(/-/g, "_")}_ETH_PRICE`;
    const price = process.env[envVarName];
    if (price) {
      nativeTokenPrice[network] = parseFloat(price);
    } else {
      // Default prices (conservative estimates)
      if (network.includes("base")) {
        nativeTokenPrice[network] = 3000; // ETH price
      } else if (network.includes("x-layer")) {
        nativeTokenPrice[network] = 50; // OKB price
      } else {
        nativeTokenPrice[network] = 100; // Generic default
      }
    }
  }

  return {
    enabled: process.env.GAS_COST_VALIDATION_ENABLED !== "false", // Enabled by default
    baseGasLimit: parseInt(process.env.GAS_COST_BASE_LIMIT || "150000"),
    hookGasOverhead,
    safetyMultiplier: parseFloat(process.env.GAS_COST_SAFETY_MULTIPLIER || "1.5"),
    networkGasPrice,
    nativeTokenPrice,
    maxGasLimit: parseInt(process.env.GAS_COST_MAX_GAS_LIMIT || "500000"),
    hookWhitelistEnabled: process.env.HOOK_WHITELIST_ENABLED === "true", // Disabled by default
    allowedHooks: parseAllowedHooks(),
  };
}

/**
 * Load and parse all application configuration
 *
 * @returns Complete application configuration object
 */
export function loadConfig(): AppConfig {
  return {
    cache: parseCacheConfig(),
    accountPool: parseAccountPoolConfig(),
    network: parseNetworkConfig(),
    server: parseServerConfig(),
    rateLimit: parseRateLimitConfig(),
    allowedSettlementRouters: parseAllowedSettlementRouters(),
    x402Config: parseX402Config(),
    evmPrivateKeys: loadEvmPrivateKeys(),
    gasCost: parseGasCostConfig(),
  };
}
