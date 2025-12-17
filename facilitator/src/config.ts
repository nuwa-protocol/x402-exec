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
import { evm } from "x402/types";
import { getSupportedNetworks, getNetworkConfig, isNetworkSupported } from "@x402x/core";
import type { GasCostConfig } from "./gas-cost.js";
import type { DynamicGasPriceConfig } from "./dynamic-gas-price.js";
import type { TokenPriceConfig } from "./token-price.js";
import { networkChainResolver } from "./network-chain-resolver.js";
import { DEFAULTS } from "./defaults.js";

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
  maxQueueDepth?: number;
  queueDepthWarning?: number;
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
 * Fee claim configuration
 */
export interface FeeClaimConfig {
  /** Minimum claim amount per token (token address => amount) */
  minClaimAmount: Record<string, bigint>;
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
  dynamicGasPrice: DynamicGasPriceConfig;
  tokenPrice: TokenPriceConfig;
  feeClaim: FeeClaimConfig;
}

/**
 * Parse cache configuration from environment variables
 *
 * @returns Cache configuration object
 */
function parseCacheConfig(): CacheConfig {
  return {
    enabled: process.env.CACHE_ENABLED !== "false",
    ttlTokenVersion: parseInt(
      process.env.CACHE_TTL_TOKEN_VERSION || String(DEFAULTS.cache.TTL_TOKEN_VERSION),
    ),
    ttlTokenMetadata: parseInt(
      process.env.CACHE_TTL_TOKEN_METADATA || String(DEFAULTS.cache.TTL_TOKEN_METADATA),
    ),
    maxKeys: parseInt(process.env.CACHE_MAX_KEYS || String(DEFAULTS.cache.MAX_KEYS)),
  };
}

/**
 * Parse account pool configuration from environment variables
 *
 * @returns Account pool configuration object
 */
function parseAccountPoolConfig(): AccountPoolConfig {
  const strategy = process.env.ACCOUNT_SELECTION_STRATEGY || DEFAULTS.accountPool.STRATEGY;
  if (strategy !== "round_robin" && strategy !== "random") {
    throw new Error(`Invalid ACCOUNT_SELECTION_STRATEGY: ${strategy}`);
  }

  // Parse and validate maxQueueDepth
  let maxQueueDepth: number = DEFAULTS.accountPool.MAX_QUEUE_DEPTH;
  if (process.env.ACCOUNT_POOL_MAX_QUEUE_DEPTH) {
    const parsed = parseInt(process.env.ACCOUNT_POOL_MAX_QUEUE_DEPTH);
    if (isNaN(parsed) || parsed <= 0) {
      throw new Error(
        `Invalid ACCOUNT_POOL_MAX_QUEUE_DEPTH: ${process.env.ACCOUNT_POOL_MAX_QUEUE_DEPTH}. Must be a positive integer.`,
      );
    }
    if (parsed > 1000) {
      throw new Error(
        `ACCOUNT_POOL_MAX_QUEUE_DEPTH too large: ${parsed}. Maximum allowed is 1000.`,
      );
    }
    maxQueueDepth = parsed;
  }

  // Calculate queueDepthWarning as 80% of maxQueueDepth (rounded up)
  const queueDepthWarning = Math.ceil(maxQueueDepth * 0.8);

  return {
    strategy,
    maxQueueDepth,
    queueDepthWarning,
  };
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
    port: parseInt(process.env.PORT || String(DEFAULTS.server.PORT)),
    shutdownTimeoutMs: DEFAULTS.server.SHUTDOWN_TIMEOUT_MS,
    requestBodyLimit: process.env.REQUEST_BODY_LIMIT || DEFAULTS.server.REQUEST_BODY_LIMIT,
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
    verifyMax: parseInt(process.env.RATE_LIMIT_VERIFY_MAX || String(DEFAULTS.rateLimit.VERIFY_MAX)),
    settleMax: parseInt(process.env.RATE_LIMIT_SETTLE_MAX || String(DEFAULTS.rateLimit.SETTLE_MAX)),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(DEFAULTS.rateLimit.WINDOW_MS)),
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
    transfer: parseInt(
      process.env.GAS_COST_HOOK_TRANSFER_OVERHEAD ||
        String(DEFAULTS.gasCost.HOOK_TRANSFER_OVERHEAD),
    ),
    custom: parseInt(
      process.env.GAS_COST_HOOK_CUSTOM_OVERHEAD || String(DEFAULTS.gasCost.HOOK_CUSTOM_OVERHEAD),
    ),
  };

  // Parse network gas prices (used as fallback for dynamic strategy)
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
      // Check for most specific matches first
      if (network.includes("x-layer")) {
        nativeTokenPrice[network] = DEFAULTS.nativeTokenPrice.OKB;
      } else if (network.includes("base")) {
        nativeTokenPrice[network] = DEFAULTS.nativeTokenPrice.ETH;
      } else {
        nativeTokenPrice[network] = DEFAULTS.nativeTokenPrice.GENERIC;
      }
    }
  }

  return {
    // Gas Limit Configuration
    minGasLimit: parseInt(
      process.env.GAS_COST_MIN_GAS_LIMIT || String(DEFAULTS.gasCost.MIN_GAS_LIMIT),
    ),
    maxGasLimit: parseInt(
      process.env.GAS_COST_MAX_GAS_LIMIT || String(DEFAULTS.gasCost.MAX_GAS_LIMIT),
    ),
    dynamicGasLimitMargin: parseFloat(
      process.env.GAS_COST_DYNAMIC_GAS_LIMIT_MARGIN ||
        String(DEFAULTS.gasCost.DYNAMIC_GAS_LIMIT_MARGIN),
    ),

    // Gas Overhead Configuration
    hookGasOverhead,
    safetyMultiplier: parseFloat(
      process.env.GAS_COST_SAFETY_MULTIPLIER || String(DEFAULTS.gasCost.SAFETY_MULTIPLIER),
    ),

    // Fee Validation
    validationTolerance: parseFloat(
      process.env.GAS_COST_VALIDATION_TOLERANCE || String(DEFAULTS.gasCost.VALIDATION_TOLERANCE),
    ),
    minFacilitatorFeeUsd: parseFloat(
      process.env.GAS_COST_MIN_FACILITATOR_FEE_USD ||
        String(DEFAULTS.gasCost.MIN_FACILITATOR_FEE_USD),
    ),

    // Hook Security
    hookWhitelistEnabled: process.env.HOOK_WHITELIST_ENABLED === "true",
    allowedHooks: parseAllowedHooks(),

    // Fallback Prices
    networkGasPrice,
    nativeTokenPrice,
  };
}

/**
 * Parse dynamic gas price configuration from environment variables
 *
 * @returns Dynamic gas price configuration object
 */
async function parseDynamicGasPriceConfig(): Promise<DynamicGasPriceConfig> {
  const supportedNetworks = getSupportedNetworks();

  // Determine strategy:
  // - If any network has explicit TARGET_GAS_PRICE set, use static
  // - Otherwise, use hybrid (dynamic with static fallback)
  let hasExplicitGasPrice = false;
  for (const network of supportedNetworks) {
    const envVarName = `${network.toUpperCase().replace(/-/g, "_")}_TARGET_GAS_PRICE`;
    if (process.env[envVarName]) {
      hasExplicitGasPrice = true;
      break;
    }
  }

  // Allow explicit strategy override
  const strategyEnv = process.env.GAS_PRICE_STRATEGY as "static" | "dynamic" | "hybrid" | undefined;
  const strategy = strategyEnv || (hasExplicitGasPrice ? "static" : "hybrid");

  // Initialize the network chain resolver if not already done
  if (!networkChainResolver.isInitialized()) {
    await networkChainResolver.initialize();
  }

  // Get all RPC URLs using the dynamic resolver
  const rpcUrls = await networkChainResolver.getAllRpcUrls();

  return {
    strategy,
    cacheTTL: parseInt(process.env.GAS_PRICE_CACHE_TTL || "300"), // 5 minutes
    updateInterval: parseInt(process.env.GAS_PRICE_UPDATE_INTERVAL || "60"), // 1 minute
    rpcUrls,
  };
}

/**
 * Parse fee claim configuration from environment variables
 *
 * @returns Fee claim configuration object
 */
function parseFeeClaimConfig(): FeeClaimConfig {
  const minClaimAmountUsdc =
    process.env.FEE_CLAIM_MIN_AMOUNT_USDC || DEFAULTS.feeClaim.MIN_CLAIM_AMOUNT_USDC;

  // Build minimum claim amounts map
  const minClaimAmount: Record<string, bigint> = {};

  // Get all supported networks to determine USDC addresses
  const supportedNetworks = getSupportedNetworks();
  for (const network of supportedNetworks) {
    try {
      const networkConfig = getNetworkConfig(network);
      const usdcAddress = networkConfig.defaultAsset.address.toLowerCase();

      // Use the same minimum amount for all USDC tokens (currently only USDC is supported)
      minClaimAmount[usdcAddress] = BigInt(minClaimAmountUsdc);
    } catch {
      // Skip networks without default asset configuration
      continue;
    }
  }

  return {
    minClaimAmount,
  };
}

/**
 * Parse token price configuration from environment variables
 *
 * @returns Token price configuration object
 */
function parseTokenPriceConfig(): TokenPriceConfig {
  const supportedNetworks = getSupportedNetworks();

  // Token price enabled by default (unless explicitly disabled)
  const enabled = process.env.TOKEN_PRICE_ENABLED !== "false";

  // Parse custom coin IDs
  const coinIds: Record<string, string> = {};
  for (const network of supportedNetworks) {
    const envVarName = `${network.toUpperCase().replace(/-/g, "_")}_COIN_ID`;
    const coinId = process.env[envVarName];
    if (coinId) {
      coinIds[network] = coinId;
    }
  }

  return {
    enabled,
    cacheTTL: parseInt(process.env.TOKEN_PRICE_CACHE_TTL || "3600"), // 1 hour
    updateInterval: parseInt(process.env.TOKEN_PRICE_UPDATE_INTERVAL || "600"), // 10 minutes
    apiKey: process.env.COINGECKO_API_KEY,
    coinIds,
  };
}

/**
 * Load and parse all application configuration
 *
 * @returns Complete application configuration object
 */
export async function loadConfig(): Promise<AppConfig> {
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
    dynamicGasPrice: await parseDynamicGasPriceConfig(),
    tokenPrice: parseTokenPriceConfig(),
    feeClaim: parseFeeClaimConfig(),
  };
}
