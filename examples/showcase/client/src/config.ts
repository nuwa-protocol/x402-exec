/**
 * Auto-generated network configuration
 * Automatically supports all networks from @x402x/extensions
 *
 * Benefits:
 * - No manual updates needed when adding new networks
 * - Type-safe network identifiers
 * - Optional UI customization via NETWORK_UI_OVERRIDES
 */

import { getSupportedNetworkNames, getNetworkConfig as getCoreNetworkConfig, getNetworkId } from "@x402x/extensions";
import { defineChain, type Chain } from "viem";
import * as allChains from "viem/chains";

// Custom chain definitions for networks not in viem's standard list
const customChains: Record<number, Chain> = {
  // X Layer Testnet
  1952: defineChain({
    id: 1952,
    name: "X Layer Testnet",
    nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://testrpc.xlayer.tech"] },
    },
    blockExplorers: {
      default: { name: "OKLink", url: "https://www.oklink.com/xlayer-test" },
    },
    testnet: true,
  }),
  // SKALE Nebula Testnet (Base Sepolia)
  324705682: defineChain({
    id: 324705682,
    name: "SKALE Nebula Testnet",
    nativeCurrency: { name: "sFUEL", symbol: "sFUEL", decimals: 18 },
    rpcUrls: {
      default: {
        http: ["https://testnet.skalenodes.com/v1/lanky-ill-funny-testnet"],
      },
    },
    blockExplorers: {
      default: {
        name: "SKALE Explorer",
        url: "https://lanky-ill-funny-testnet.explorer.testnet.skalenodes.com",
      },
    },
    testnet: true,
  }),
  // X Layer Mainnet
  196: defineChain({
    id: 196,
    name: "X Layer",
    nativeCurrency: { name: "OKB", symbol: "OKB", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://rpc.xlayer.tech"] },
    },
    blockExplorers: {
      default: { name: "OKLink", url: "https://www.oklink.com/xlayer" },
    },
    testnet: false,
  }),
};

// Helper function to get viem chain from network name
function getChainFromNetwork(network: string): Chain {
  // Get the CAIP-2 network ID first (e.g., "base-sepolia" -> "eip155:84532")
  const networkId = getNetworkId(network);
  const chainId = parseInt(networkId.split(":")[1]);

  // Check custom chains first
  if (customChains[chainId]) {
    return customChains[chainId];
  }

  // Then check viem's standard chains
  const chain = Object.values(allChains).find((c) => c.id === chainId);
  if (!chain) {
    throw new Error(
      `Unsupported network: ${network} (chain ID: ${chainId}). ` +
        `Please add custom chain definition in config.ts`,
    );
  }
  return chain;
}

/**
 * Supported network identifiers (auto-generated from @x402x/extensions)
 */
export type Network = ReturnType<typeof getSupportedNetworkNames>[number];

/**
 * Optional UI configuration for specific networks
 */
interface NetworkUIOverride {
  icon?: string;
  displayName?: string;
  faucetUrl?: string;
}

/**
 * Optional UI overrides for specific networks
 * Only add entries here if you want to customize the default display
 */
const NETWORK_UI_OVERRIDES: Partial<Record<string, NetworkUIOverride>> = {
  // Uncomment to customize specific networks:
  // "base-sepolia": {
  //   icon: "🔵",
  //   faucetUrl: "https://faucet.circle.com/",
  // },
};

/**
 * Complete network configuration
 */
export interface NetworkConfig {
  chainId: number;
  name: string;
  displayName: string;
  chain: Chain;
  icon: string;
  faucetUrl: string;
  explorerUrl: string;
  usdcAddress: string;
  defaultAsset: {
    address: string;
    decimals: number;
    eip712: {
      name: string;
      version: string;
    };
  };
}

/**
 * Get default icon based on network name
 */
function getDefaultIcon(networkName: string): string {
  if (networkName.includes("bsc")) return "🟡";
  if (networkName.includes("base")) return "🔵";
  if (networkName.includes("x-layer") || networkName.includes("xlayer")) return "⭕";
  if (networkName.includes("skale")) return "💎";
  if (networkName.includes("avalanche") || networkName.includes("avax")) return "🔺";
  if (networkName.includes("polygon")) return "🟣";
  return "🌐"; // default
}

/**
 * Get default faucet URL based on network
 */
function getDefaultFaucetUrl(networkName: string, chain: Chain): string {
  // For mainnets, return bridge/buy link
  if (!chain.testnet) {
    if (networkName.includes("bsc")) return "https://www.bnbchain.org/en/bridge";
    if (networkName.includes("base")) return "https://docs.base.org/docs/tools/bridge-funds/";
    if (networkName.includes("x-layer")) return "https://www.okx.com/xlayer/bridge";
    return chain.blockExplorers?.default.url || "";
  }

  // For testnets, return faucet
  if (networkName.includes("bsc")) return "https://testnet.bnbchain.org/faucet-smart";
  if (networkName.includes("base")) return "https://faucet.circle.com/";
  if (networkName.includes("x-layer")) return "https://www.okx.com/xlayer/faucet";
  if (networkName.includes("skale")) return "https://base-sepolia-faucet.skale.space";

  return ""; // no faucet known
}

/**
 * Get complete network configuration
 * Automatically combines @x402x/extensions data with viem chain info and optional UI overrides
 */
export function getNetworkConfig(network: string): NetworkConfig {
  // Get core network config
  const coreConfig = getCoreNetworkConfig(network);

  // Get chain from viem
  const chain = getChainFromNetwork(network);

  // Get optional UI overrides
  const uiOverride = NETWORK_UI_OVERRIDES[network] || {};

  return {
    chainId: coreConfig.chainId,
    name: network,
    chain,
    usdcAddress: coreConfig.defaultAsset.address,
    explorerUrl: chain.blockExplorers?.default.url || "",
    defaultAsset: coreConfig.defaultAsset,

    // Use override or defaults
    displayName: uiOverride.displayName || coreConfig.name,
    icon: uiOverride.icon || getDefaultIcon(network),
    faucetUrl: uiOverride.faucetUrl || getDefaultFaucetUrl(network, chain),
  };
}

/**
 * All supported networks configurations (auto-generated)
 * Automatically includes all networks from @x402x/extensions
 */
export const NETWORKS = getSupportedNetworkNames().reduce(
  (acc, network) => {
    acc[network] = getNetworkConfig(network);
    return acc;
  },
  {} as Record<string, NetworkConfig>,
);

/**
 * Get network config by chain ID
 */
export function getNetworkByChainId(chainId: number): string | undefined {
  return Object.entries(NETWORKS).find(([_, config]) => config.chainId === chainId)?.[0];
}

/**
 * LocalStorage key for storing user's preferred network
 */
export const PREFERRED_NETWORK_KEY = "x402-preferred-network";

/**
 * Get user's preferred network from localStorage
 */
export function getPreferredNetwork(): string | null {
  const stored = localStorage.getItem(PREFERRED_NETWORK_KEY);
  if (stored && stored in NETWORKS) {
    return stored;
  }
  return null;
}

/**
 * Save user's preferred network to localStorage
 */
export function setPreferredNetwork(network: string): void {
  localStorage.setItem(PREFERRED_NETWORK_KEY, network);
}

/**
 * Get the facilitator URL
 * In development: can use local facilitator via VITE_FACILITATOR_URL
 * In production: uses VITE_FACILITATOR_URL environment variable or default
 *
 * @returns Facilitator URL
 */
export function getFacilitatorUrl(): string {
  const facilitatorUrl = import.meta.env.VITE_FACILITATOR_URL;

  // If no facilitator URL is set (undefined or empty string), use default
  if (!facilitatorUrl || facilitatorUrl.trim() === "") {
    return "https://facilitator.x402x.dev";
  }

  // Remove trailing slash if present
  return facilitatorUrl.trim().replace(/\/$/, "");
}

/**
 * Get the API base URL
 * In development: uses empty string to leverage Vite proxy
 * In production: uses VITE_SERVER_URL environment variable
 */
export function getServerUrl(): string {
  const serverUrl = import.meta.env.VITE_SERVER_URL;

  // If no server URL is set (undefined or empty string), use relative paths (Vite proxy in dev, or same-origin in production)
  if (!serverUrl || serverUrl.trim() === "") {
    return "";
  }

  // Remove trailing slash if present
  return serverUrl.trim().replace(/\/$/, "");
}

/**
 * Build API endpoint URL
 * @param path - API path (e.g., '/api/health' or 'api/health')
 * @returns Full URL or relative path
 */
export function buildApiUrl(path: string): string {
  const serverUrl = getServerUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return serverUrl ? `${serverUrl}${normalizedPath}` : normalizedPath;
}

// Export configuration object for convenience
export const config = {
  facilitatorUrl: getFacilitatorUrl(),
  serverUrl: getServerUrl(),
  buildApiUrl,
  networks: NETWORKS,
};
