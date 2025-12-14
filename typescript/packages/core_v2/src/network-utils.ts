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
  "skale-base-sepolia": "eip155:1444673419",
  "base": "eip155:8453",
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
  "eip155:1444673419": {
    address: "0x5c7e299cf531eb66f2a1df637d37abb78e6200c7",
    decimals: 6,
    eip712: {
      name: "USD Coin",
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
 * @returns Object with maxAmountRequired as string in atomic units, or error
 * 
 * @example
 * ```typescript
 * const result = processPriceToAtomicAmount('1.5', 'eip155:84532');
 * // { maxAmountRequired: '1500000' }
 * ```
 */
export function processPriceToAtomicAmount(
  price: string | number,
  network: Network
): { maxAmountRequired: string } | { error: string } {
  try {
    const amount = parseMoneyToDecimal(price);
    const asset = getDefaultAsset(network);
    const decimals = asset.decimals;

    // Convert to smallest unit using integer-only arithmetic to avoid floating-point precision issues
    // Split the amount into whole and fractional parts
    const [whole, fractional = '0'] = amount.toString().split('.');
    const paddedFractional = fractional.padEnd(decimals, '0').slice(0, decimals);
    const atomicAmount = BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFractional);

    return { maxAmountRequired: atomicAmount.toString() };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown error processing price",
    };
  }
}
