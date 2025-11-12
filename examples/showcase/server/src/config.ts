/**
 * Configuration loader for x402-exec Showcase server
 * Loads and validates environment variables
 */

import { config, parse } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evm } from "x402/types";
import { networks as sdkNetworks, TransferHook } from "@x402x/core";

// Load env from local .env first; then fill missing keys from repo root .env
config();

// Try to locate the repository-root .env and load any missing vars from it
(() => {
  try {
    // Walk up from a starting directory until we find a .env (max ~6 levels)
    const startDirs = [
      process.cwd(),
      // Directory of this file at runtime (works in ESM + after build)
      path.dirname(fileURLToPath(import.meta.url)),
    ];

    function findEnvUpwards(startDir: string): string | undefined {
      let dir = path.resolve(startDir);
      for (let i = 0; i < 6; i++) {
        const candidate = path.join(dir, ".env");
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      return undefined;
    }

    let envPath: string | undefined;
    for (const dir of startDirs) {
      envPath = findEnvUpwards(dir);
      if (envPath) break;
    }

    if (envPath && fs.existsSync(envPath)) {
      const parsed = parse(fs.readFileSync(envPath));
      // Only backfill keys that are currently undefined
      for (const [k, v] of Object.entries(parsed)) {
        if (process.env[k] === undefined) process.env[k] = v;
      }
    }
  } catch {
    // Non-fatal if root .env is missing; required keys are validated below
  }
})();

export interface NetworkConfig {
  rpcUrl: string;
  settlementRouterAddress: string;
  transferHookAddress: string; // Built-in TransferHook (used in server mode)
  // Note: The following configs are for serverless scenarios
  // Server only uses TransferHook for Premium Download
  nftMintHookAddress: string;
  randomNFTAddress: string;
  rewardTokenAddress: string;
  rewardHookAddress: string;
  usdcAddress: string;
}

export interface Config {
  port: number;
  defaultNetwork: string;
  facilitatorUrl: string;

  // Network-specific configurations
  networks: Record<string, NetworkConfig>;

  // Resource server configuration
  resourceServerAddress: string;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] || defaultValue;
}

/**
 * Get default RPC URL for a network from viem Chain definition
 * @param network Network name
 * @returns Default RPC URL
 */
function getDefaultRpcUrl(network: string): string {
  try {
    const chain = evm.getChainFromNetwork(network);
    return chain.rpcUrls.default.http[0];
  } catch (error) {
    console.warn(`Failed to get default RPC URL for network ${network}:`, error);
    // Fallback URLs for known networks
    switch (network) {
      case "base-sepolia":
        return "https://sepolia.base.org";
      case "x-layer-testnet":
        return "https://testrpc.xlayer.tech/terigon";
      default:
        throw new Error(`No default RPC URL available for network: ${network}`);
    }
  }
}

/**
 * Get default USDC address for a network from x402 EVM config
 * @param network Network name
 * @returns Default USDC address
 */
function getDefaultUsdcAddress(network: string): string {
  try {
    const chain = evm.getChainFromNetwork(network);
    const chainConfig = evm.config[chain.id.toString()];
    if (chainConfig?.usdcAddress) {
      return chainConfig.usdcAddress as string;
    }
    throw new Error(`No USDC address configured for chain ID: ${chain.id}`);
  } catch (error) {
    console.warn(`Failed to get default USDC address for network ${network}:`, error);
    // Fallback addresses for known networks
    switch (network) {
      case "base-sepolia":
        return "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
      case "x-layer-testnet":
        return "0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d";
      default:
        throw new Error(`No default USDC address available for network: ${network}`);
    }
  }
}

/**
 * Get USDC EIP-712 domain info for a network
 * @param network Network name
 * @returns USDC domain info (name and version)
 */
export function getUsdcDomainForNetwork(network: string): { name: string; version: string } {
  try {
    const chain = evm.getChainFromNetwork(network);
    const chainConfig = evm.config[chain.id.toString()];
    if (chainConfig?.usdcName) {
      return {
        name: chainConfig.usdcName,
        version: "2", // All USDC contracts use version "2"
      };
    }
    throw new Error(`No USDC name configured for chain ID: ${chain.id}`);
  } catch (error) {
    console.warn(`Failed to get USDC domain for network ${network}:`, error);
    // Fallback domain info for known networks
    switch (network) {
      case "base-sepolia":
        return { name: "USDC", version: "2" };
      case "x-layer-testnet":
        return { name: "USDC_TEST", version: "2" };
      case "base":
        return { name: "USD Coin", version: "2" };
      case "polygon":
        return { name: "USD Coin", version: "2" };
      default:
        // Default fallback
        return { name: "USDC", version: "2" };
    }
  }
}

export const appConfig: Config = {
  port: parseInt(process.env.PORT || "3001"),
  defaultNetwork: getRequiredEnv("DEFAULT_NETWORK"),
  facilitatorUrl: getRequiredEnv("FACILITATOR_URL"),

  // Network-specific configurations
  networks: {
    // Base Sepolia configuration
    // Settlement router and transfer hook addresses are loaded from SDK
    "base-sepolia": {
      rpcUrl:
        getOptionalEnv("BASE_SEPOLIA_RPC_URL") ||
        getOptionalEnv("RPC_URL") ||
        getDefaultRpcUrl("base-sepolia"),
      // Load from SDK instead of env vars
      settlementRouterAddress: sdkNetworks["base-sepolia"].settlementRouter,
      transferHookAddress: TransferHook.getAddress("base-sepolia"),
      // Serverless scenario configs (optional for server-only deployment)
      nftMintHookAddress:
        getOptionalEnv("BASE_SEPOLIA_NFT_MINT_HOOK_ADDRESS") ||
        getOptionalEnv("NFT_MINT_HOOK_ADDRESS") ||
        "0x0000000000000000000000000000000000000000",
      randomNFTAddress:
        getOptionalEnv("BASE_SEPOLIA_RANDOM_NFT_ADDRESS") ||
        getOptionalEnv("RANDOM_NFT_ADDRESS") ||
        "0x0000000000000000000000000000000000000000",
      rewardTokenAddress:
        getOptionalEnv("BASE_SEPOLIA_REWARD_TOKEN_ADDRESS") ||
        getOptionalEnv("REWARD_TOKEN_ADDRESS") ||
        "0x0000000000000000000000000000000000000000",
      rewardHookAddress:
        getOptionalEnv("BASE_SEPOLIA_REWARD_HOOK_ADDRESS") ||
        getOptionalEnv("REWARD_HOOK_ADDRESS") ||
        "0x0000000000000000000000000000000000000000",
      usdcAddress:
        getOptionalEnv("BASE_SEPOLIA_USDC_ADDRESS") ||
        getOptionalEnv("USDC_ADDRESS") ||
        getDefaultUsdcAddress("base-sepolia"),
    },
    // X-Layer Testnet configuration
    // Settlement router and transfer hook addresses are loaded from SDK
    "x-layer-testnet": {
      rpcUrl: getOptionalEnv("X_LAYER_TESTNET_RPC_URL") || getDefaultRpcUrl("x-layer-testnet"),
      // Load from SDK instead of env vars
      settlementRouterAddress: sdkNetworks["x-layer-testnet"].settlementRouter,
      transferHookAddress: TransferHook.getAddress("x-layer-testnet"),
      // Serverless scenario configs (optional for server-only deployment)
      nftMintHookAddress:
        getOptionalEnv("X_LAYER_TESTNET_NFT_MINT_HOOK_ADDRESS") ||
        "0x0000000000000000000000000000000000000000",
      randomNFTAddress:
        getOptionalEnv("X_LAYER_TESTNET_RANDOM_NFT_ADDRESS") ||
        "0x0000000000000000000000000000000000000000",
      rewardTokenAddress:
        getOptionalEnv("X_LAYER_TESTNET_REWARD_TOKEN_ADDRESS") ||
        "0x0000000000000000000000000000000000000000",
      rewardHookAddress:
        getOptionalEnv("X_LAYER_TESTNET_REWARD_HOOK_ADDRESS") ||
        "0x0000000000000000000000000000000000000000",
      usdcAddress:
        getOptionalEnv("X_LAYER_TESTNET_USDC_ADDRESS") || getDefaultUsdcAddress("x-layer-testnet"),
    },
  },

  // Resource server configuration
  resourceServerAddress: getRequiredEnv("RESOURCE_SERVER_ADDRESS"),
};

// Helper function to get network configuration
export function getNetworkConfig(network: string): NetworkConfig {
  const config = appConfig.networks[network];
  if (!config) {
    throw new Error(
      `Unsupported network: ${network}. Supported networks: ${Object.keys(appConfig.networks).join(", ")}`,
    );
  }
  return config;
}
