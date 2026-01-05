/**
 * Chain definitions for x402x supported networks
 *
 * This module provides viem chain configurations for all supported networks,
 * including custom definitions for chains not in viem's standard list.
 */

import type { Network } from "@x402/core/types";
import { defineChain, type Chain } from "viem";
import * as allChains from "viem/chains";

import { NETWORK_ALIASES_V1_TO_V2, NETWORK_ALIASES } from "./network-utils.js";

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
    nativeCurrency: { name: "CREDIT", symbol: "CREDIT", decimals: 18 },
    rpcUrls: {
      default: {
        http: ["https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha"],
      },
    },
    blockExplorers: {
      default: {
        name: "SKALE Explorer",
        url: "https://base-sepolia-testnet-explorer.skalenodes.com",
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

  // SKALE Base Mainnet
  1187947933: defineChain({
    id: 1187947933,
    name: "SKALE Base",
    nativeCurrency: { name: "CREDIT", symbol: "CREDIT", decimals: 18 },
    rpcUrls: {
      default: { http: ["https://skale-base.skalenodes.com/v1/base"] },
    },
    blockExplorers: {
      default: {
        name: "SKALE Explorer",
        url: "https://skale-base-explorer.skalenodes.com",
      },
    },
    testnet: false,
  }),
};

/**
 * Get viem chain configuration for a network
 *
 * Accepts both CAIP-2 format (preferred) and human-readable network names (legacy).
 * Checks custom chains first, then falls back to viem's standard chains.
 *
 * @param network - Network identifier (CAIP-2 or human-readable name)
 * @returns Viem chain configuration
 * @throws Error if network is not supported
 *
 * @example
 * ```typescript
 * // Preferred: CAIP-2 format
 * const chain = getChain("eip155:1952");
 * // => { id: 1952, name: "X Layer Testnet", ... }
 *
 * // Legacy: human-readable name
 * const baseChain = getChain("base-sepolia");
 * // => { id: 84532, name: "Base Sepolia", ... }
 * ```
 */
export function getChain(network: string | Network): Chain {
  let chainId: number;

  // If already CAIP-2 format, validate it's supported before extracting chainId
  if (network.startsWith("eip155:")) {
    const caip2 = network as Network;
    // Validate that this CAIP-2 identifier is in our supported networks
    if (!(caip2 in NETWORK_ALIASES)) {
      throw new Error(
        `Unsupported CAIP-2 network: ${network}. ` +
          `Supported networks: ${Object.keys(NETWORK_ALIASES).join(", ")}`,
      );
    }
    chainId = parseInt(network.split(":")[1]);
  } else {
    // Convert name to CAIP-2, then extract chainId
    const caip2 = NETWORK_ALIASES_V1_TO_V2[network];
    if (!caip2) {
      throw new Error(
        `Unknown network: ${network}. ` +
          `Supported networks: ${Object.keys(NETWORK_ALIASES_V1_TO_V2).join(", ")}`,
      );
    }
    chainId = parseInt(caip2.split(":")[1]);
  }

  // Check custom chains first
  if (customChains[chainId]) {
    return customChains[chainId];
  }

  // Then check viem's standard chains
  const chain = Object.values(allChains).find((c) => c.id === chainId);
  if (!chain) {
    throw new Error(
      `Unsupported chain ID: ${chainId}. ` + `Please add custom chain definition in chains.ts`,
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
      `Unsupported chain ID: ${chainId}. ` + `Please add custom chain definition in chains.ts`,
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
