/**
 * Network configuration for x402x
 * 
 * Contains deployed contract addresses and configuration for each supported network.
 */

import type { NetworkConfig } from './types.js';

/**
 * Network configurations for all supported networks
 */
export const networks: Record<string, NetworkConfig> = {
  'base-sepolia': {
    chainId: 84532,
    settlementRouter: '0x32431D4511e061F1133520461B07eC42afF157D6',
    usdc: {
      address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      name: 'USD Coin',
      version: '2',
    },
    hooks: {
      transfer: '0x6b486aF5A08D27153d0374BE56A1cB1676c460a8',
    },
  },
  'x-layer-testnet': {
    chainId: 195,
    settlementRouter: '0x1ae0e196dc18355af3a19985faf67354213f833d',
    usdc: {
      address: '0x...',  // TODO: Add X-Layer Testnet USDC address
      name: 'USD Coin',
      version: '2',
    },
    hooks: {
      transfer: '0x3D07D4E03a2aDa2EC49D6937ab1B40a83F3946AB',
    },
  },
  // Mainnet configurations (pending audit)
  // 'base': {
  //   chainId: 8453,
  //   settlementRouter: '0x...',
  //   usdc: {
  //     address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  //     name: 'USD Coin',
  //     version: '2',
  //   },
  //   hooks: {
  //     transfer: '0x...',
  //   },
  // },
};

/**
 * Get network configuration by network name
 * 
 * @param network - Network name (e.g., 'base-sepolia', 'x-layer-testnet')
 * @returns Network configuration
 * @throws Error if network is not supported
 * 
 * @example
 * ```typescript
 * const config = getNetworkConfig('base-sepolia');
 * console.log(config.settlementRouter);
 * ```
 */
export function getNetworkConfig(network: string): NetworkConfig {
  const config = networks[network];
  if (!config) {
    throw new Error(
      `Unsupported network: ${network}. ` +
      `Supported networks: ${Object.keys(networks).join(', ')}`
    );
  }
  return config;
}

/**
 * Check if a network is supported
 * 
 * @param network - Network name to check
 * @returns True if network is supported
 * 
 * @example
 * ```typescript
 * if (isNetworkSupported('base-sepolia')) {
 *   // proceed...
 * }
 * ```
 */
export function isNetworkSupported(network: string): boolean {
  return network in networks;
}

/**
 * Get list of all supported networks
 * 
 * @returns Array of supported network names
 * 
 * @example
 * ```typescript
 * const networks = getSupportedNetworks();
 * // => ['base-sepolia', 'x-layer-testnet']
 * ```
 */
export function getSupportedNetworks(): string[] {
  return Object.keys(networks);
}

