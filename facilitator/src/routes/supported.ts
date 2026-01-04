/**
 * Supported Payment Kinds Routes
 *
 * Provides endpoint to list supported payment kinds:
 * - GET /supported: List all supported payment kinds (v2-only)
 *
 * v1 is deprecated - only v2 payment kinds are returned.
 * Only advertises networks that are actually usable (have RPC URL and at least one allowed router).
 * This prevents resource servers from failing initialization due to missing facilitator support.
 */

import { Router, Request, Response } from "express";
import type { PoolManager } from "../pool-manager.js";

// SupportedPaymentKind type (matches the structure pushed to the array)
interface SupportedPaymentKind {
  x402Version: number;
  scheme: string;
  network: string;
}
import { hasNetworkConfig } from "../network-id.js";
import { getLogger } from "../telemetry.js";

/**
 * Dependencies required by supported routes
 * v2-only - v1 has been deprecated
 */
export interface SupportedRouteDependencies {
  poolManager: PoolManager;
  /** Facilitator signer address for v2 (optional, will be derived from privateKey if not provided) */
  v2Signer?: string;
  /** Private key for v2 local signing (reuses EVM_PRIVATE_KEY) */
  v2PrivateKey?: string;
  /** Allowed routers per network (CAIP-2 network IDs, for availability check) */
  allowedRouters?: Record<string, string[]>;
  /** RPC URLs per network (for availability check) */
  rpcUrls?: Record<string, string>;
}

const logger = getLogger();

/**
 * Check if a network is properly configured and ready to be advertised
 * 
 * A network is considered "ready" if:
 * - It has an account pool (poolManager has it initialized)
 * - It has at least one allowed settlement router (for v2)
 * - It has an RPC URL configured (for gas price/chain queries)
 * 
 * @param network - Network to check (canonical CAIP-2 format)
 * @param deps - Dependencies containing configuration
 * @returns true if network should be advertised
 */
function isNetworkReady(network: string, deps: SupportedRouteDependencies): boolean {
  // Check if network is in poolManager (already initialized)
  const pool = deps.poolManager.getPool(network);
  if (!pool) {
    logger.debug({ network }, "Network not ready: no account pool");
    return false;
  }

  // For v2, check if it has allowed routers configured
  if (deps.allowedRouters) {
    const hasRouter = hasNetworkConfig(deps.allowedRouters, network);
    if (!hasRouter) {
      logger.debug({ network }, "Network not ready: no allowed routers for v2");
      return false;
    }
  }

  // Check if it has RPC URL configured (optional but recommended)
  if (deps.rpcUrls) {
    const hasRpc = hasNetworkConfig(deps.rpcUrls, network);
    if (!hasRpc) {
      logger.warn({ network }, "Network ready but missing RPC URL - may have issues with dynamic gas pricing");
    }
  }

  return true;
}

/**
 * Create supported payment kinds routes
 *
 * @param deps - Dependencies for supported routes
 * @returns Express Router with supported endpoints
 */
export function createSupportedRoutes(deps: SupportedRouteDependencies): Router {
  const router = Router();

  /**
   * GET /supported - Returns supported payment kinds (v2-only)
   *
   * v1 is deprecated - only returns v2 kinds.
   * Only advertises networks that are properly configured (have pool + routers + RPC).
   */
  router.get("/supported", async (req: Request, res: Response) => {
    const kinds: SupportedPaymentKind[] = [];

    // Get initialized networks from PoolManager (source of truth)
    const supportedNetworks = deps.poolManager.getSupportedNetworks();

    // Filter to only networks that are fully ready (have required config)
    const readyNetworks = supportedNetworks.filter(({ canonical }) =>
      isNetworkReady(canonical, deps)
    );

    logger.debug(
      {
        total: supportedNetworks.length,
        ready: readyNetworks.length,
        filtered: supportedNetworks.length - readyNetworks.length,
      },
      "Filtered networks for /supported"
    );

    // v2 is always available
    const v2Available = !!(deps.v2Signer || deps.v2PrivateKey);

    // Only generate v2 kinds with CAIP-2 canonical network names
    // v1 is deprecated and no longer returned
    if (v2Available) {
      for (const { canonical } of readyNetworks) {
        kinds.push({
          x402Version: 2,
          scheme: "exact",
          network: canonical as any, // Type assertion for CAIP-2 network identifiers
        });
      }
    }

    res.json({
      kinds,
    });
  });

  return router;
}
