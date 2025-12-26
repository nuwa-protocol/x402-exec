/**
 * Auto-generated network configuration
 * Automatically supports all networks from @x402x/extensions
 *
 * Benefits:
 * - No manual updates needed when adding new networks
 * - Type-safe network identifiers
 * - Optional UI customization via NETWORK_UI_OVERRIDES
 */

import { getSupportedNetworkAliases, getNetworkConfig as getCoreNetworkConfig, getChain } from "@x402x/extensions";
import type { Chain } from "viem";

/**
 * Supported network identifiers (auto-generated from @x402x/extensions)
 */
export type Network = ReturnType<typeof getSupportedNetworkAliases>[number];

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

  // Get chain from extensions
  const chain = getChain(network);

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
export const NETWORKS = getSupportedNetworkAliases().reduce(
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
