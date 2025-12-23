/**
 * Supported Payment Kinds Routes
 *
 * Provides endpoint to list supported payment kinds:
 * - GET /supported: List all supported payment kinds
 */

import { Router, Request, Response } from "express";
import type { SupportedPaymentKind } from "x402/types";
import type { PoolManager } from "../pool-manager.js";

/**
 * Dependencies required by supported routes
 */
export interface SupportedRouteDependencies {
  poolManager: PoolManager;
  /** Enable v2 support (requires FACILITATOR_ENABLE_V2=true) */
  enableV2?: boolean;
  /** Facilitator signer address for v2 */
  v2Signer?: string;
  /** Allowed routers per network for v2 */
  allowedRouters?: Record<string, string[]>;
}

/**
 * Check if v2 is properly configured and should be advertised
 *
 * @param deps - Dependencies containing v2 configuration
 * @returns true if v2 is available for advertisement
 */
function isV2Available(deps: SupportedRouteDependencies): boolean {
  return !!(deps.enableV2 && deps.v2Signer);
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
   * GET /supported - Returns supported payment kinds
   * Supports ?x402Version=1|2 query parameter for filtering
   */
  router.get("/supported", async (req: Request, res: Response) => {
    const kinds: SupportedPaymentKind[] = [];

    // Parse optional version filter from query parameter with validation
    let versionFilter: number | undefined;
    const rawVersionFilter = req.query.x402Version;
    if (typeof rawVersionFilter === "string") {
      const parsed = Number.parseInt(rawVersionFilter, 10);
      if (!Number.isNaN(parsed)) {
        versionFilter = parsed;
      }
    }

    // Get initialized networks from PoolManager (source of truth)
    const supportedNetworks = deps.poolManager.getSupportedNetworks();

    // Check if v2 is available for advertisement
    const v2Available = isV2Available(deps);

    // Generate v1 kinds with human-readable network names
    // (unless filtered to v2 only)
    if (!versionFilter || versionFilter === 1) {
      for (const { humanReadable } of supportedNetworks) {
        kinds.push({
          x402Version: 1,
          scheme: "exact",
          network: humanReadable as any, // Type assertion for dynamic network names
        });
      }
    }

    // Generate v2 kinds with CAIP-2 canonical network names
    // (if v2 available and not filtered to v1 only)
    if (v2Available && (!versionFilter || versionFilter === 2)) {
      for (const { canonical } of supportedNetworks) {
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
