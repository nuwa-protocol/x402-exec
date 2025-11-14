/**
 * Network configuration for x402x
 *
 * Contains deployed contract addresses and configuration for each supported network.
 */

import { getUsdcChainConfigForChain } from "x402/shared/evm";
import type { NetworkConfig } from "./types.js";

/**
 * Helper to create USDC config from x402's chain config
 */
function createUsdcConfig(chainId: number) {
  const chainConfig = getUsdcChainConfigForChain(chainId);
  if (!chainConfig) {
    throw new Error(`No USDC config found for chainId ${chainId}`);
  }
  return {
    address: chainConfig.usdcAddress as string,
    name: chainConfig.usdcName,
    version: "2",
  };
}

/**
 * Network configurations for all supported networks
 */
export const networks: Record<string, NetworkConfig> = {
  "base-sepolia": {
    chainId: 84532,
    name: "Base Seploia",
    type: "testnet",
    addressExplorerBaseUrl: "https://sepolia.basescan.org/address/",
    txExplorerBaseUrl: "https://sepolia.basescan.org/tx/",
    settlementRouter: "0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb",
    usdc: createUsdcConfig(84532),
    hooks: {
      transfer: "0x4DE234059C6CcC94B8fE1eb1BD24804794083569",
    },
  },
  "x-layer-testnet": {
    chainId: 1952,
    name: "X Layer Testnet",
    type: "testnet",
    addressExplorerBaseUrl: "https://www.oklink.com/xlayer-test/address/",
    txExplorerBaseUrl: "https://www.oklink.com/xlayer-test/tx/",
    settlementRouter: "0xba9980fb08771e2fd10c17450f52d39bcb9ed576",
    usdc: createUsdcConfig(1952),
    hooks: {
      transfer: "0xD4b98dd614c1Ea472fC4547a5d2B93f3D3637BEE",
    },
  },
  // Mainnet configurations
  base: {
    chainId: 8453,
    name: "Base Mainnet",
    type: "mainnet",
    addressExplorerBaseUrl: "https://basescan.org/address/",
    txExplorerBaseUrl: "https://basescan.org/tx/",
    settlementRouter: "0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B",
    usdc: createUsdcConfig(8453),
    hooks: {
      transfer: "0x081258287F692D61575387ee2a4075f34dd7Aef7",
    },
  },
  "x-layer": {
    chainId: 196,
    name: "X Layer Mainnet",
    type: "mainnet",
    addressExplorerBaseUrl: "https://www.oklink.com/xlayer/address/",
    txExplorerBaseUrl: "https://www.oklink.com/xlayer/tx/",
    settlementRouter: "0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B",
    usdc: createUsdcConfig(196),
    hooks: {
      transfer: "0x081258287F692D61575387ee2a4075f34dd7Aef7",
    },
  },
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
        `Supported networks: ${Object.keys(networks).join(", ")}`,
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
