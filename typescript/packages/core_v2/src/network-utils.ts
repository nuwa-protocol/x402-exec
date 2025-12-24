/**
 * Network utility functions for x402x core_v2
 * 
 * These utilities provide helpers for working with CAIP-2 network identifiers
 * and accessing network-specific asset information.
 */

import type { Network } from "@x402/core/types";

/**
 * Asset information including EIP-712 domain parameters
 */
export interface AssetInfo {
  address: string;
  decimals: number;
  eip712: {
    name: string;
    version: string;
  };
}

/**
 * Network name to CAIP-2 network ID mapping
 */
const NETWORK_IDS: Record<string, Network> = {
  "base-sepolia": "eip155:84532",
  "x-layer-testnet": "eip155:1952",
  "skale-base-sepolia": "eip155:324705682",
  "base": "eip155:8453",
  "x-layer": "eip155:196",
  "bsc-testnet": "eip155:97",
  "bsc": "eip155:56",
};

/**
 * CAIP-2 network ID to network name mapping (reverse lookup)
 */
const NETWORK_NAMES: Record<Network, string> = {
  "eip155:84532": "base-sepolia",
  "eip155:1952": "x-layer-testnet",
  "eip155:324705682": "skale-base-sepolia",
  "eip155:8453": "base",
  "eip155:196": "x-layer",
  "eip155:97": "bsc-testnet",
  "eip155:56": "bsc",
};

/**
 * Default asset (USDC) configuration per network
 */
const DEFAULT_ASSETS: Record<Network, AssetInfo> = {
  "eip155:84532": {
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    decimals: 6,
    eip712: {
      name: "USDC",
      version: "2",
    },
  },
  "eip155:1952": {
    address: "0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d",
    decimals: 6,
    eip712: {
      name: "USDC_TEST",
      version: "2",
    },
  },
  "eip155:324705682": {
    address: "0x2e08028E3C4c2356572E096d8EF835cD5C6030bD",
    decimals: 6,
    eip712: {
      name: "Bridged USDC (SKALE Bridge)",
      version: "2",
    },
  },
  "eip155:8453": {
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals: 6,
    eip712: {
      name: "USD Coin",
      version: "2",
    },
  },
  "eip155:196": {
    address: "0x74b7f16337b8972027f6196a17a631ac6de26d22",
    decimals: 6,
    eip712: {
      name: "USD Coin",
      version: "2",
    },
  },
  "eip155:97": {
    address: "0xdac693b5f14e7ee5923a4830cd2f82ff178f5098",
    decimals: 18,
    eip712: {
      name: "x402 Wrapped USDT",
      version: "1",
    },
  },
  "eip155:56": {
    address: "0x2fDb94bAa9D664a1879BEe1f944F5F5d2dad4451",
    decimals: 18,
    eip712: {
      name: "x402 Wrapped USDT",
      version: "1",
    },
  },
};

/**
 * Get CAIP-2 network ID from network name
 * 
 * @param networkName - Network name (e.g., 'base-sepolia', 'base')
 * @returns CAIP-2 network identifier (e.g., 'eip155:84532')
 * @throws Error if network name is not supported
 * 
 * @example
 * ```typescript
 * const networkId = getNetworkId('base-sepolia'); // 'eip155:84532'
 * ```
 */
export function getNetworkId(networkName: string): Network {
  const networkId = NETWORK_IDS[networkName];
  if (!networkId) {
    throw new Error(
      `Unsupported network: ${networkName}. ` +
        `Supported networks: ${Object.keys(NETWORK_IDS).join(", ")}`
    );
  }
  return networkId;
}

/**
 * Get network name from CAIP-2 network ID
 * 
 * @param network - CAIP-2 network identifier (e.g., 'eip155:84532')
 * @returns Network name (e.g., 'base-sepolia')
 * @throws Error if network ID is not supported
 * 
 * @example
 * ```typescript
 * const networkName = getNetworkName('eip155:84532'); // 'base-sepolia'
 * ```
 */
export function getNetworkName(network: Network): string {
  const networkName = NETWORK_NAMES[network];
  if (!networkName) {
    throw new Error(
      `Unsupported network ID: ${network}. ` +
        `Supported network IDs: ${Object.keys(NETWORK_NAMES).join(", ")}`
    );
  }
  return networkName;
}

/**
 * Get default asset (USDC) information for a network
 * 
 * @param network - CAIP-2 network identifier (e.g., 'eip155:84532')
 * @returns Asset information including address, decimals, and EIP-712 domain
 * @throws Error if network is not supported
 * 
 * @example
 * ```typescript
 * const asset = getDefaultAsset('eip155:84532');
 * // { address: '0x036Cb...', decimals: 6, eip712: { name: 'USDC', version: '2' } }
 * ```
 */
export function getDefaultAsset(network: Network): AssetInfo {
  const assetInfo = DEFAULT_ASSETS[network];
  if (!assetInfo) {
    throw new Error(`No default asset configured for network: ${network}`);
  }
  return assetInfo;
}

/**
 * Parse money value to decimal number
 * 
 * Handles various formats:
 * - Dollar sign: '$1.50' -> 1.50
 * - Decimal string: '1.50' -> 1.50
 * - Number: 1.50 -> 1.50
 * 
 * @param money - Money value as string or number
 * @returns Decimal number
 * @throws Error if money format is invalid
 * 
 * @example
 * ```typescript
 * parseMoneyToDecimal('$1.50');  // 1.50
 * parseMoneyToDecimal('1.50');   // 1.50
 * parseMoneyToDecimal(1.50);     // 1.50
 * ```
 */
export function parseMoneyToDecimal(money: string | number): number {
  if (typeof money === "number") {
    return money;
  }

  // Remove $ sign and whitespace, then parse
  const cleanMoney = money.replace(/^\$/, "").trim();
  const amount = parseFloat(cleanMoney);

  if (isNaN(amount)) {
    throw new Error(`Invalid money format: ${money}`);
  }

  return amount;
}

/**
 * Process price to atomic amount for the default asset on a network
 * 
 * This function converts various price formats to atomic units (smallest denomination).
 * For USDC with 6 decimals: 1.5 USD -> '1500000'
 * 
 * @param price - Price as string or number (in USD, not atomic units)
 * @param network - CAIP-2 network identifier
 * @returns Object with amount as string in atomic units, or error
 * 
 * @example
 * ```typescript
 * const result = processPriceToAtomicAmount('1.5', 'eip155:84532');
 * // { amount: '1500000' }
 * ```
 */
export function processPriceToAtomicAmount(
  price: string | number,
  network: Network
): { amount: string } | { error: string } {
  try {
    const amount = parseMoneyToDecimal(price);
    const asset = getDefaultAsset(network);
    const decimals = asset.decimals;

    // Convert to smallest unit using integer-only arithmetic to avoid floating-point precision issues
    // Split the amount into whole and fractional parts
    const [whole, fractional = '0'] = amount.toString().split('.');
    const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals);
    const atomicAmount = BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFractional);

    return { amount: atomicAmount.toString() };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error processing price",
    };
  }
}

/**
 * Alias mapping from v1 network names to v2 CAIP-2 identifiers
 * This provides backward compatibility for v1 network names
 */
export const NETWORK_ALIASES_V1_TO_V2: Record<string, Network> = {
  // V1 human-readable names -> V2 CAIP-2 canonical keys
  "base-sepolia": "eip155:84532",
  "x-layer-testnet": "eip155:1952",
  "skale-base-sepolia": "eip155:324705682",
  "base": "eip155:8453",
  "x-layer": "eip155:196",
  "bsc-testnet": "eip155:97",
  "bsc": "eip155:56",
};

/**
 * Get list of all supported networks using v2 CAIP-2 identifiers
 *
 * @returns Array of CAIP-2 network identifiers
 *
 * @example
 * ```typescript
 * const networks = getSupportedNetworksV2();
 * // => ['eip155:84532', 'eip155:1952', 'eip155:324705682', ...]
 * ```
 */
export function getSupportedNetworksV2(): Network[] {
  return Object.keys(NETWORK_NAMES) as Network[];
}

/**
 * Get the alias mapping from v1 network names to v2 CAIP-2 identifiers
 *
 * @returns Record mapping v1 names to v2 CAIP-2 keys
 *
 * @example
 * ```typescript
 * const aliases = getNetworkAliasesV1ToV2();
 * // => { 'base-sepolia': 'eip155:84532', 'x-layer-testnet': 'eip155:1952', ... }
 * ```
 */
export function getNetworkAliasesV1ToV2(): Record<string, Network> {
  return { ...NETWORK_ALIASES_V1_TO_V2 };
}

/**
 * Convert any network identifier to its canonical v2 CAIP-2 key
 *
 * Handles both v1 human-readable names and v2 CAIP-2 identifiers,
 * returning the canonical v2 CAIP-2 identifier for all inputs.
 *
 * @param network - Network identifier (v1 name or v2 CAIP-2)
 * @returns Canonical v2 CAIP-2 network identifier
 * @throws Error if network is not supported
 *
 * @example
 * ```typescript
 * toCanonicalNetworkKey('base-sepolia'); // 'eip155:84532'
 * toCanonicalNetworkKey('eip155:84532');  // 'eip155:84532'
 * toCanonicalNetworkKey('x-layer');      // 'eip155:196'
 * ```
 */
export function toCanonicalNetworkKey(network: string): Network {
  // If it's already a CAIP-2 identifier, validate it
  if (network.startsWith('eip155:')) {
    const canonicalNetwork = network as Network;
    if (canonicalNetwork in NETWORK_NAMES) {
      return canonicalNetwork;
    }
    throw new Error(
      `Unsupported CAIP-2 network: ${network}. ` +
        `Supported networks: ${Object.keys(NETWORK_NAMES).join(", ")}`
    );
  }

  // If it's a v1 name, convert it using the alias map
  const canonicalNetwork = NETWORK_ALIASES_V1_TO_V2[network];
  if (!canonicalNetwork) {
    throw new Error(
      `Unsupported network: ${network}. ` +
        `Supported networks: ${Object.keys(NETWORK_ALIASES_V1_TO_V2).join(", ")}`
    );
  }
  return canonicalNetwork;
}
