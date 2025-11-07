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
  svmNetworks: string[];
  svmRpcUrl: string;
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
  svmPrivateKeys: string[];
}

/**
 * Parse cache configuration from environment variables
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
 */
function parseNetworkConfig(): NetworkConfig {
  return {
    evmNetworks: ["base-sepolia", "base", "x-layer-testnet", "x-layer"],
    svmNetworks: ["solana-devnet", "solana-mainnet"],
    svmRpcUrl: process.env.SVM_RPC_URL || "",
  };
}

/**
 * Parse server configuration from environment variables
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
 */
function parseAllowedSettlementRouters(): Record<string, string[]> {
  return {
    "base-sepolia": [
      process.env.BASE_SEPOLIA_SETTLEMENT_ROUTER_ADDRESS ||
        "0x32431D4511e061F1133520461B07eC42afF157D6",
    ],
    base: [process.env.BASE_SETTLEMENT_ROUTER_ADDRESS || ""].filter(Boolean),
    "x-layer-testnet": [
      process.env.X_LAYER_TESTNET_SETTLEMENT_ROUTER_ADDRESS ||
        "0x1ae0e196dc18355af3a19985faf67354213f833d",
    ],
    "x-layer": [process.env.X_LAYER_SETTLEMENT_ROUTER_ADDRESS || ""].filter(Boolean),
  };
}

/**
 * Parse X402 configuration from environment variables
 */
function parseX402Config(): X402Config | undefined {
  const svmRpcUrl = process.env.SVM_RPC_URL;
  return svmRpcUrl ? { svmConfig: { rpcUrl: svmRpcUrl } } : undefined;
}

/**
 * Load EVM private keys from environment variables
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
 * Load SVM private keys from environment variables
 */
function loadSvmPrivateKeys(): string[] {
  const keys: string[] = [];

  // Load from SVM_PRIVATE_KEY_1, SVM_PRIVATE_KEY_2, etc.
  for (let i = 1; i <= 100; i++) {
    const key = process.env[`SVM_PRIVATE_KEY_${i}`];
    if (key) {
      keys.push(key);
    } else {
      break; // Stop at first missing key
    }
  }

  // Fallback to single SVM_PRIVATE_KEY
  if (keys.length === 0 && process.env.SVM_PRIVATE_KEY) {
    keys.push(process.env.SVM_PRIVATE_KEY);
  }

  return keys;
}

/**
 * Load and parse all application configuration
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
    svmPrivateKeys: loadSvmPrivateKeys(),
  };
}
