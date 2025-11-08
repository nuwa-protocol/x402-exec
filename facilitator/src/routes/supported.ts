/**
 * Supported Payment Kinds Routes
 *
 * Provides endpoint to list supported payment kinds:
 * - GET /supported: List all supported payment kinds
 */

import { Router, Request, Response } from "express";
import type { SupportedPaymentKind } from "x402/types";
import type { PoolManager } from "../pool-manager.js";
import { getSupportedNetworks } from "@x402x/core";

/**
 * Dependencies required by supported routes
 */
export interface SupportedRouteDependencies {
  poolManager: PoolManager;
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
   */
  router.get("/supported", async (req: Request, res: Response) => {
    const kinds: SupportedPaymentKind[] = [];

    // Return all supported EVM networks if we have accounts
    if (deps.poolManager.getEvmAccountCount() > 0) {
      const supportedNetworks = getSupportedNetworks();

      for (const network of supportedNetworks) {
        kinds.push({
          x402Version: 1,
          scheme: "exact",
          network: network as any, // Type assertion for dynamic networks
        });
      }
    }

    res.json({
      kinds,
    });
  });

  return router;
}
