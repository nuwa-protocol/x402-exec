/**
 * Chain definitions for x402x supported networks
 * 
 * This module provides viem chain configurations for all supported networks,
 * including custom definitions for chains not in viem's standard list.
 */

import { defineChain, type Chain } from "viem";
import * as allChains from "viem/chains";
import { getNetworkId } from "./network-utils.js";

/**
 * Custom chain definitions for networks not in viem's standard list
 */
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

/**
 * Get viem chain configuration for a network name
 * 
 * Checks custom chains first, then falls back to viem's standard chains.
 * 
 * @param network - Network name (e.g., "base-sepolia", "x-layer-testnet")
 * @returns Viem chain configuration
 * @throws Error if network is not supported
 * 
 * @example
 * ```typescript
 * const chain = getChain("x-layer-testnet");
 * // => { id: 1952, name: "X Layer Testnet", ... }
 * 
 * const baseChain = getChain("base-sepolia");
 * // => { id: 84532, name: "Base Sepolia", ... }
 * ```
 */
export function getChain(network: string): Chain {
  // Get the CAIP-2 network ID (e.g., "base-sepolia" -> "eip155:84532")
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
        `Please add custom chain definition in chains.ts`
    );
  }
  return chain;
}

/**
 * Get viem chain configuration by chain ID
 * 
 * @param chainId - Chain ID
 * @returns Viem chain configuration
 * @throws Error if chain ID is not supported
 * 
 * @example
 * ```typescript
 * const chain = getChainById(1952);
 * // => { id: 1952, name: "X Layer Testnet", ... }
 * ```
 */
export function getChainById(chainId: number): Chain {
  // Check custom chains first
  if (customChains[chainId]) {
    return customChains[chainId];
  }

  // Then check viem's standard chains
  const chain = Object.values(allChains).find((c) => c.id === chainId);
  if (!chain) {
    throw new Error(
      `Unsupported chain ID: ${chainId}. ` +
        `Please add custom chain definition in chains.ts`
    );
  }
  return chain;
}

/**
 * Get all custom chain definitions
 * 
 * @returns Record of chain ID to chain configuration
 * 
 * @example
 * ```typescript
 * const customs = getCustomChains();
 * // => { 1952: { id: 1952, name: "X Layer Testnet", ... }, ... }
 * ```
 */
export function getCustomChains(): Record<number, Chain> {
  return { ...customChains };
}

/**
 * Check if a chain ID has a custom definition
 * 
 * @param chainId - Chain ID to check
 * @returns True if chain has custom definition
 * 
 * @example
 * ```typescript
 * isCustomChain(1952); // true (X Layer Testnet)
 * isCustomChain(84532); // false (Base Sepolia - in viem)
 * ```
 */
export function isCustomChain(chainId: number): boolean {
  return chainId in customChains;
}

