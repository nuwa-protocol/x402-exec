/**
 * Network ID Normalization and Configuration Lookup
 * 
 * Provides unified network ID handling for facilitator:
 * - Accepts both v1 aliases (e.g., "base-sepolia", "bsc") and v2 CAIP-2 (e.g., "eip155:84532", "eip155:56")
 * - Internally normalizes to CAIP-2 canonical format
 * - Provides fallback lookup to support existing v1 configuration keys
 * 
 * This allows facilitator to:
 * 1. Operate internally with v2 CAIP-2 network IDs
 * 2. Support existing v1 configuration files without immediate migration
 * 3. Gradually transition to v2-only configuration
 */

import {
  toCanonicalNetworkKey,
  getNetworkAlias,
  isNetworkSupported,
} from "@x402x/extensions";

/**
 * Normalized network ID result
 */
export interface NormalizedNetwork {
  /** CAIP-2 canonical network ID (e.g., "eip155:84532") */
  canonical: `${string}:${string}`;
  /** V1 alias for backward compatibility (e.g., "base-sepolia") */
  aliasV1: string;
  /** Original input network ID */
  input: string;
}

/**
 * Normalize a network ID to canonical CAIP-2 format
 * 
 * Accepts both v1 aliases and v2 CAIP-2 format.
 * 
 * @param network - Network identifier (v1 alias or v2 CAIP-2)
 * @returns Normalized network with canonical and v1 alias
 * @throws Error if network is not supported by x402x
 * 
 * @example
 * ```typescript
 * // V1 input
 * normalizeNetwork("base-sepolia")
 * // => { canonical: "eip155:84532", aliasV1: "base-sepolia", input: "base-sepolia" }
 * 
 * // V2 input
 * normalizeNetwork("eip155:84532")
 * // => { canonical: "eip155:84532", aliasV1: "base-sepolia", input: "eip155:84532" }
 * ```
 */
export function normalizeNetwork(network: string): NormalizedNetwork {
  // Check if network is supported (throws if not)
  if (!isNetworkSupported(network)) {
    throw new Error(
      `Unsupported network: ${network}. ` +
      `Network is not supported by x402x. Check @x402x/extensions for supported networks.`
    );
  }

  // Normalize to canonical CAIP-2
  const canonical = toCanonicalNetworkKey(network) as `${string}:${string}`;
  
  // Get v1 alias for fallback lookup
  const aliasV1 = getNetworkAlias(canonical);

  return {
    canonical,
    aliasV1,
    input: network,
  };
}

/**
 * Result of configuration lookup
 */
export interface ConfigLookupResult<T> {
  /** The value found (undefined if not found) */
  value: T | undefined;
  /** Which key was used to find the value */
  keyUsed?: "canonical" | "alias" | "input";
  /** Normalized network information */
  network: NormalizedNetwork;
}

/**
 * Lookup configuration value for a network with v1/v2 key fallback
 * 
 * Tries multiple keys in order:
 * 1. Canonical CAIP-2 (e.g., "eip155:84532")
 * 2. V1 alias (e.g., "base-sepolia")
 * 3. Original input (in case config uses non-standard key)
 * 
 * This allows existing v1 configuration files to continue working
 * while facilitator internally uses v2 CAIP-2 network IDs.
 * 
 * @param configMap - Configuration map (e.g., rpcUrls, allowedRouters)
 * @param network - Network identifier (v1 or v2)
 * @returns Lookup result with value and metadata
 * 
 * @example
 * ```typescript
 * const rpcUrls = {
 *   "base-sepolia": "https://...",  // V1 config key
 * };
 * 
 * // V2 input still works via fallback
 * const result = getConfigForNetwork(rpcUrls, "eip155:84532");
 * // => { value: "https://...", keyUsed: "alias", network: {...} }
 * ```
 */
export function getConfigForNetwork<T>(
  configMap: Record<string, T>,
  network: string,
): ConfigLookupResult<T> {
  // Normalize network (throws if unsupported)
  const normalized = normalizeNetwork(network);

  // Try canonical key first (preferred for v2)
  if (normalized.canonical in configMap) {
    return {
      value: configMap[normalized.canonical],
      keyUsed: "canonical",
      network: normalized,
    };
  }

  // Try v1 alias fallback (for existing v1 configs)
  if (normalized.aliasV1 in configMap) {
    return {
      value: configMap[normalized.aliasV1],
      keyUsed: "alias",
      network: normalized,
    };
  }

  // Try original input as last resort (edge case)
  if (normalized.input in configMap && normalized.input !== normalized.canonical && normalized.input !== normalized.aliasV1) {
    return {
      value: configMap[normalized.input],
      keyUsed: "input",
      network: normalized,
    };
  }

  // Not found in any key
  return {
    value: undefined,
    keyUsed: undefined,
    network: normalized,
  };
}

/**
 * Check if a network has configuration available
 * 
 * @param configMap - Configuration map to check
 * @param network - Network identifier
 * @returns true if configuration exists for this network
 */
export function hasNetworkConfig<T>(
  configMap: Record<string, T>,
  network: string,
): boolean {
  try {
    const result = getConfigForNetwork(configMap, network);
    return result.value !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get all configured networks from a config map
 * 
 * Returns both canonical CAIP-2 and v1 aliases for each configured network.
 * Useful for iterating over all available networks.
 * 
 * @param configMap - Configuration map
 * @returns Array of normalized networks for all configured keys
 * 
 * @example
 * ```typescript
 * const rpcUrls = {
 *   "base-sepolia": "https://...",
 *   "eip155:56": "https://...",
 * };
 * 
 * const networks = getAllConfiguredNetworks(rpcUrls);
 * // => [
 * //   { canonical: "eip155:84532", aliasV1: "base-sepolia", ... },
 * //   { canonical: "eip155:56", aliasV1: "bsc", ... }
 * // ]
 * ```
 */
export function getAllConfiguredNetworks(
  configMap: Record<string, unknown>,
): NormalizedNetwork[] {
  const networks: NormalizedNetwork[] = [];
  const seen = new Set<string>();

  for (const key of Object.keys(configMap)) {
    try {
      const normalized = normalizeNetwork(key);
      
      // Deduplicate by canonical ID (in case both v1 and v2 keys exist)
      if (!seen.has(normalized.canonical)) {
        seen.add(normalized.canonical);
        networks.push(normalized);
      }
    } catch {
      // Skip unsupported/invalid network keys
      continue;
    }
  }

  return networks;
}

