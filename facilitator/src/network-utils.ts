/**
 * Network Utilities for x402 Facilitator
 *
 * Provides network canonicalization and alias mapping to support both v1 and v2 network formats.
 * Uses v2 CAIP-2 identifiers as canonical keys for internal consistency.
 */

import { toCanonicalNetworkKey, getNetworkName } from "@x402x/core_v2";
import type { Network } from "x402/types";

/**
 * Type alias for network identifiers
 */
export type Network = string;

/**
 * Feature flag for enabling v2 support
 */
export const FACILITATOR_ENABLE_V2 = process.env.FACILITATOR_ENABLE_V2 === "true";

/**
 * Get canonical network key from any network identifier
 *
 * @param network - Network identifier (v1 name or v2 CAIP-2)
 * @returns Canonical v2 CAIP-2 network identifier
 * @throws Error if network is not supported
 */
export function getCanonicalNetwork(network: string): Network {
  try {
    return toCanonicalNetworkKey(network);
  } catch (error) {
    throw new Error(
      `Unsupported network: ${network}. ` +
      `Supported networks: base-sepolia, base, x-layer-testnet, x-layer, bsc-testnet, bsc`
    );
  }
}

/**
 * Get human-readable network name from canonical key
 *
 * @param canonicalNetwork - Canonical v2 CAIP-2 network identifier
 * @returns Human-readable network name (v1 format)
 */
export function getNetworkDisplayName(canonicalNetwork: Network): string {
  try {
    return getNetworkName(canonicalNetwork as any);
  } catch (error) {
    // Fallback to canonical key if name lookup fails
    return canonicalNetwork;
  }
}

/**
 * Network alias mapping from v1 names to v2 CAIP-2 identifiers
 * This provides the canonicalization mapping
 */
export const NETWORK_ALIASES: Record<string, Network> = {
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
 * Reverse mapping from CAIP-2 to human-readable names
 */
export const CANONICAL_TO_HUMAN_READABLE: Record<Network, string> = Object.fromEntries(
  Object.entries(NETWORK_ALIASES).map(([name, canonical]) => [canonical, name])
);

/**
 * Check if network identifier is already in canonical format (CAIP-2)
 */
export function isCanonicalNetwork(network: string): boolean {
  return network.startsWith('eip155:');
}

/**
 * Convert network identifier to canonical format with caching
 */
const canonicalCache = new Map<string, Network>();
export function getCachedCanonicalNetwork(network: string): Network {
  if (canonicalCache.has(network)) {
    return canonicalCache.get(network)!;
  }

  const canonical = getCanonicalNetwork(network);
  canonicalCache.set(network, canonical);
  return canonical;
}

/**
 * Get all supported canonical networks
 */
export function getSupportedCanonicalNetworks(): Network[] {
  return Object.values(NETWORK_ALIASES);
}

/**
 * Get all supported human-readable network names
 */
export function getSupportedHumanReadableNetworks(): string[] {
  return Object.keys(NETWORK_ALIASES);
}

/**
 * Network validation for both v1 and v2 formats
 */
export function validateNetwork(network: string): Network {
  if (!network || typeof network !== "string") {
    throw new Error("Invalid network: must be a non-empty string");
  }

  return getCanonicalNetwork(network);
}

/**
 * Determine x402 version from request data
 *
 * @param paymentPayload - Payment payload containing optional x402Version
 * @param body - Request body containing optional x402Version
 * @returns The x402 version number (1 or 2)
 */
export function determineX402Version(
  paymentPayload?: { x402Version?: number },
  body?: { x402Version?: number }
): number {
  // Priority: paymentPayload.x402Version > body.x402Version > default to 1
  const version = paymentPayload?.x402Version ?? body?.x402Version ?? 1;

  if (version !== 1 && version !== 2) {
    throw new Error(`Invalid x402Version: ${version}. Only versions 1 and 2 are supported.`);
  }

  return version;
}

/**
 * Check if v2 features are enabled and version is supported
 */
export function isVersionSupported(version: number): boolean {
  if (version === 1) {
    return true; // v1 is always supported
  }

  if (version === 2) {
    return FACILITATOR_ENABLE_V2;
  }

  return false;
}