/**
 * Network configuration for x402x
 *
 * Contains deployed contract addresses and configuration for each supported network.
 * Uses official x402 v2 CAIP-2 network identifiers as keys.
 */

import type { Network } from "@x402/core/types";
import { getDefaultAsset, NETWORK_ALIASES_V1_TO_V2, getNetworkAlias } from "./network-utils.js";
import type { NetworkConfig } from "./types.js";

/**
 * Helper to get default asset config
 */
function getDefaultAssetConfig(network: Network) {
  const defaultAsset = getDefaultAsset(network);
  return {
    address: defaultAsset.address as string,
    decimals: defaultAsset.decimals,
    eip712: {
      name: defaultAsset.eip712.name,
      version: defaultAsset.eip712.version,
    },
  };
}

/**
 * Normalize network identifier to CAIP-2 format
 * 
 * Accepts both human-readable names (string) and CAIP-2 format (Network type).
 * This enables backward compatibility while supporting the new CAIP-2 standard.
 * 
 * @param network - Network identifier (CAIP-2 or human-readable name)
 * @returns CAIP-2 network identifier
 * @throws Error if network is not supported
 * 
 * @example
 * ```typescript
 * normalizeToCAIP2('base-sepolia');    // => 'eip155:84532'
 * normalizeToCAIP2('eip155:84532');    // => 'eip155:84532'
 * ```
 */
function normalizeToCAIP2(network: string | Network): Network {
  // Already CAIP-2 format
  if (network.startsWith('eip155:')) {
    return network as Network;
  }
  // Convert from human-readable name using alias mapping
  const caip2 = NETWORK_ALIASES_V1_TO_V2[network];
  if (!caip2) {
    throw new Error(
      `Unknown network: ${network}. ` +
      `Supported networks: ${Object.keys(NETWORK_ALIASES_V1_TO_V2).join(", ")}`
    );
  }
  return caip2;
}

/**
 * Network configurations for all supported networks
 *
 * Uses CAIP-2 format as keys for consistency with x402 v2 protocol.
 * This ensures compatibility across different ecosystems and simplifies
 * adding new networks (only need chain ID).
 */
export const networks: Record<Network, NetworkConfig> = {
  "eip155:84532": {
    chainId: 84532,
    name: "Base Sepolia",
    type: "testnet",
    addressExplorerBaseUrl: "https://sepolia.basescan.org/address/",
    txExplorerBaseUrl: "https://sepolia.basescan.org/tx/",
    settlementRouter: "0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb",
    defaultAsset: getDefaultAssetConfig("eip155:84532"),
    hooks: {
      transfer: "0x4DE234059C6CcC94B8fE1eb1BD24804794083569",
    },
    demoHooks: {
      nftMint: "0x261206558E6eEd104Cba4AD913b2Eec85D21108e",
      randomNFT: "0x5756A67a33118F5Ad9840411f252E14d84Dd7c02",
      reward: "0xf05cE06e7ee4ffCb67a509003DbD73A6d95Cc960",
      rewardToken: "0xb6854e33BfD428d15B4f5398cFf8e84d4196FDA6",
    },
    metadata: {
      gasModel: "eip1559",
      nativeToken: "ETH",
    },
  },
  "eip155:1952": {
    chainId: 1952,
    name: "X Layer Testnet",
    type: "testnet",
    addressExplorerBaseUrl: "https://www.oklink.com/xlayer-test/address/",
    txExplorerBaseUrl: "https://www.oklink.com/xlayer-test/tx/",
    settlementRouter: "0xba9980fb08771e2fd10c17450f52d39bcb9ed576",
    defaultAsset: getDefaultAssetConfig("eip155:1952"),
    hooks: {
      transfer: "0xD4b98dd614c1Ea472fC4547a5d2B93f3D3637BEE",
    },
    demoHooks: {
      nftMint: "0x468F666314b070338841422012AB2f6539bfcE48",
      randomNFT: "0xBA931bB5B2F2DC5354aFAED1d3996B0c6e417518",
      reward: "0xda8B270Ec442Ff797807b95604E3319e36Aad05d",
      rewardToken: "0x348AFDE3B4B70dCb02053aF95588a4ab41e95FbC",
    },
    metadata: {
      gasModel: "eip1559",
      nativeToken: "OKB",
    },
  },
  "eip155:324705682": {
    chainId: 324705682,
    name: "SKALE Base Sepolia",
    type: "testnet",
    addressExplorerBaseUrl: "https://base-sepolia-testnet-explorer.skalenodes.com/address/",
    txExplorerBaseUrl: "https://base-sepolia-testnet-explorer.skalenodes.com/tx/",
    settlementRouter: "0x1Ae0E196dC18355aF3a19985faf67354213F833D",
    defaultAsset: getDefaultAssetConfig("eip155:324705682"),
    hooks: {
      transfer: "0x2f05fe5674aE756E25C26855258B4877E9e021Fd",
    },
    demoHooks: {
      nftMint: "0x73fc659cd5494e69852be8d9d23fe05aab14b29b",
      randomNFT: "0x081258287f692d61575387ee2a4075f34dd7aef7",
      reward: "0xc20634ea518985901e32fbc1ba27fa673d37601a",
      rewardToken: "0x9fc2c199170b039f093abcd54008038f0c0a31d6",
    },
    metadata: {
      gasModel: "legacy",
      nativeToken: "Credits",
    },
  },
  "eip155:97": {
    chainId: 97,
    name: "BSC Testnet",
    type: "testnet",
    addressExplorerBaseUrl: "https://testnet.bscscan.com/address/",
    txExplorerBaseUrl: "https://testnet.bscscan.com/tx/",
    settlementRouter: "0x1Ae0E196dC18355aF3a19985faf67354213F833D",
    defaultAsset: getDefaultAssetConfig("eip155:97"),
    hooks: {
      transfer: "0x2f05fe5674aE756E25C26855258B4877E9e021Fd",
    },
    demoHooks: {
      nftMint: "0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B",
      randomNFT: "0x081258287F692D61575387ee2a4075f34dd7Aef7",
      reward: "0xC20634ea518985901e32Fbc1bA27fa673D37601A",
      rewardToken: "0x9Fc2c199170B039f093ABCd54008038F0C0a31d6",
    },
    metadata: {
      gasModel: "legacy",
      nativeToken: "BNB",
    },
  },
  // Mainnet configurations
  "eip155:8453": {
    chainId: 8453,
    name: "Base Mainnet",
    type: "mainnet",
    addressExplorerBaseUrl: "https://basescan.org/address/",
    txExplorerBaseUrl: "https://basescan.org/tx/",
    settlementRouter: "0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B",
    defaultAsset: getDefaultAssetConfig("eip155:8453"),
    hooks: {
      transfer: "0x081258287F692D61575387ee2a4075f34dd7Aef7",
    },
    demoHooks: {
      nftMint: "0xC20634ea518985901e32Fbc1bA27fa673D37601A",
      randomNFT: "0x9Fc2c199170B039f093ABCd54008038F0C0a31d6",
      reward: "0x4B566FD5eFf76e3BdF20Ca5c3F2FA7cdbb3bD99A",
      rewardToken: "0x12d41108f9F12064f792418C9BA0ACF6EdcE7790",
    },
    metadata: {
      gasModel: "eip1559",
      nativeToken: "ETH",
    },
  },
  "eip155:196": {
    chainId: 196,
    name: "X Layer Mainnet",
    type: "mainnet",
    addressExplorerBaseUrl: "https://www.oklink.com/xlayer/address/",
    txExplorerBaseUrl: "https://www.oklink.com/xlayer/tx/",
    settlementRouter: "0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B",
    defaultAsset: getDefaultAssetConfig("eip155:196"),
    hooks: {
      transfer: "0x081258287F692D61575387ee2a4075f34dd7Aef7",
    },
    demoHooks: {
      nftMint: "0xC20634ea518985901e32Fbc1bA27fa673D37601A",
      randomNFT: "0x9Fc2c199170B039f093ABCd54008038F0C0a31d6",
      reward: "0x4B566FD5eFf76e3BdF20Ca5c3F2FA7cdbb3bD99A",
      rewardToken: "0x12d41108f9F12064f792418C9BA0ACF6EdcE7790",
    },
    metadata: {
      gasModel: "eip1559",
      nativeToken: "OKB",
    },
  },
  "eip155:56": {
    chainId: 56,
    name: "BSC Mainnet",
    type: "mainnet",
    addressExplorerBaseUrl: "https://bscscan.com/address/",
    txExplorerBaseUrl: "https://bscscan.com/tx/",
    settlementRouter: "0x1Ae0E196dC18355aF3a19985faf67354213F833D",
    defaultAsset: getDefaultAssetConfig("eip155:56"),
    hooks: {
      transfer: "0x2f05fe5674aE756E25C26855258B4877E9e021Fd",
    },
    demoHooks: {
      nftMint: "0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B",
      randomNFT: "0x081258287F692D61575387ee2a4075f34dd7Aef7",
      reward: "0xC20634ea518985901e32Fbc1bA27fa673D37601A",
      rewardToken: "0x9Fc2c199170B039f093ABCd54008038F0C0a31d6",
    },
    metadata: {
      gasModel: "legacy",
      nativeToken: "BNB",
    },
  },
};

/**
 * Get network configuration by network identifier
 *
 * Accepts both CAIP-2 format (preferred) and human-readable network names (legacy).
 * This provides backward compatibility while encouraging migration to CAIP-2.
 *
 * @param network - Network identifier, accepts either:
 *   - CAIP-2 format (preferred): 'eip155:84532', 'eip155:8453'
 *   - Human-readable name (legacy): 'base-sepolia', 'base'
 * @returns Network configuration
 * @throws Error if network is not supported
 *
 * @example
 * ```typescript
 * // Preferred: CAIP-2 format
 * const config = getNetworkConfig('eip155:84532');
 * 
 * // Legacy: human-readable name
 * const config2 = getNetworkConfig('base-sepolia');
 * 
 * console.log(config.settlementRouter);
 * ```
 */
export function getNetworkConfig(network: string | Network): NetworkConfig {
  const caip2Network = normalizeToCAIP2(network);
  const config = networks[caip2Network];
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
 * Accepts both CAIP-2 format and human-readable network names.
 *
 * @param network - Network identifier (CAIP-2 or human-readable name)
 * @returns True if network is supported
 *
 * @example
 * ```typescript
 * if (isNetworkSupported('eip155:84532')) {
 *   // proceed...
 * }
 * 
 * if (isNetworkSupported('base-sepolia')) {
 *   // also works...
 * }
 * ```
 */
export function isNetworkSupported(network: string | Network): boolean {
  try {
    const caip2Network = normalizeToCAIP2(network);
    return caip2Network in networks;
  } catch {
    return false;
  }
}

/**
 * Get list of all supported network aliases (v1 configuration names)
 *
 * Returns user-friendly network aliases like "base-sepolia", "base", etc.
 * These aliases are used for configuration files and backward compatibility.
 * Use this for UI display, configuration, and user-facing operations.
 * 
 * This function provides backward compatibility by returning v1 aliases
 * even though the internal storage uses CAIP-2 format.
 *
 * @returns Array of v1 network aliases
 *
 * @example
 * ```typescript
 * const aliases = getSupportedNetworkAliases();
 * // => ['base-sepolia', 'base', 'x-layer-testnet', ...]
 * 
 * // For UI dropdown
 * <select>
 *   {aliases.map(alias => <option key={alias}>{alias}</option>)}
 * </select>
 * ```
 */
export function getSupportedNetworkAliases(): string[] {
  // Convert CAIP-2 keys to v1 aliases using reverse mapping
  return Object.keys(networks).map(caip2 => getNetworkAlias(caip2 as Network));
}
