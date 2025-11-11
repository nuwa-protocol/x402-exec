/**
 * Client configuration
 * Manages environment variables and runtime configuration
 * 
 * This config maximizes reuse of x402 protocol definitions:
 * - Chain definitions from x402/types (xLayerTestnet, etc.)
 * - USDC addresses from x402 evm.config
 * - Explorer URLs from chain.blockExplorers
 * 
 * Only UI-specific fields (icon, displayName, faucetUrl) are defined locally.
 */

import { Chain } from 'viem';
import { evm } from 'x402/types';

// Re-export xLayerTestnet from evm namespace
const { xLayerTestnet } = evm;

/**
 * Supported network identifiers
 */
export type Network = 'base-sepolia' | 'x-layer-testnet';

/**
 * UI-specific network configuration
 * Only contains presentation fields not available in x402
 */
export interface NetworkUIConfig {
  icon: string;
  displayName: string;
  faucetUrl: string;
}

/**
 * Complete network configuration
 * Combines x402 protocol data with UI metadata
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
}

/**
 * UI configuration for supported networks
 * Only contains presentation-layer fields
 */
export const NETWORK_UI_CONFIG: Record<Network, NetworkUIConfig> = {
  'base-sepolia': {
    icon: '🔵',
    displayName: 'Base Sepolia',
    faucetUrl: 'https://faucet.circle.com/',
  },
  'x-layer-testnet': {
    icon: '⭕',
    displayName: 'X Layer Testnet',
    faucetUrl: 'https://www.okx.com/xlayer/faucet',
  },
};

/**
 * Get complete network configuration by combining x402 data with UI config
 * @param network Network identifier
 * @returns Complete network configuration
 */
export function getNetworkConfig(network: Network): NetworkConfig {
  const chain = evm.getChainFromNetwork(network);
  const chainConfig = evm.config[chain.id.toString()];
  const uiConfig = NETWORK_UI_CONFIG[network];
  
  if (!chainConfig) {
    throw new Error(`No chain config found for network: ${network} (chain ID: ${chain.id})`);
  }
  
  return {
    chainId: chain.id,
    name: network,
    chain,
    usdcAddress: chainConfig.usdcAddress as string,
    explorerUrl: chain.blockExplorers?.default.url || '',
    ...uiConfig,
  };
}

/**
 * All supported networks configurations
 * Data sourced from x402, only UI fields are local
 */
export const NETWORKS: Record<Network, NetworkConfig> = {
  'base-sepolia': getNetworkConfig('base-sepolia'),
  'x-layer-testnet': getNetworkConfig('x-layer-testnet'),
};

/**
 * Get network config by chain ID
 */
export function getNetworkByChainId(chainId: number): Network | undefined {
  return Object.entries(NETWORKS).find(([_, config]) => config.chainId === chainId)?.[0] as Network | undefined;
}

/**
 * LocalStorage key for storing user's preferred network
 */
export const PREFERRED_NETWORK_KEY = 'x402-preferred-network';

/**
 * Get user's preferred network from localStorage
 */
export function getPreferredNetwork(): Network | null {
  const stored = localStorage.getItem(PREFERRED_NETWORK_KEY);
  if (stored && stored in NETWORKS) {
    return stored as Network;
  }
  return null;
}

/**
 * Save user's preferred network to localStorage
 */
export function setPreferredNetwork(network: Network): void {
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
  if (!facilitatorUrl || facilitatorUrl.trim() === '') {
    return 'https://facilitator.x402x.dev';
  }
  
  // Remove trailing slash if present
  return facilitatorUrl.trim().replace(/\/$/, '');
}

/**
 * Get the API base URL
 * In development: uses empty string to leverage Vite proxy
 * In production: uses VITE_SERVER_URL environment variable
 */
export function getServerUrl(): string {
  const serverUrl = import.meta.env.VITE_SERVER_URL;
  
  // If no server URL is set (undefined or empty string), use relative paths (Vite proxy in dev, or same-origin in production)
  if (!serverUrl || serverUrl.trim() === '') {
    return '';
  }
  
  // Remove trailing slash if present
  return serverUrl.trim().replace(/\/$/, '');
}

/**
 * Build API endpoint URL
 * @param path - API path (e.g., '/api/health' or 'api/health')
 * @returns Full URL or relative path
 */
export function buildApiUrl(path: string): string {
  const serverUrl = getServerUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return serverUrl ? `${serverUrl}${normalizedPath}` : normalizedPath;
}

// Export configuration object for convenience
export const config = {
  facilitatorUrl: getFacilitatorUrl(),
  serverUrl: getServerUrl(),
  buildApiUrl,
  networks: NETWORKS,
};

// Re-export xLayerTestnet for wagmi config (from evm namespace)
export { xLayerTestnet };
