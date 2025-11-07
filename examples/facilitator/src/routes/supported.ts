/**
 * Supported Payment Kinds Routes
 *
 * Provides endpoint to list supported payment kinds:
 * - GET /supported: List all supported payment kinds
 */

import { Router, Request, Response } from "express";
import { SupportedPaymentKind, isSvmSignerWallet } from "x402/types";
import type { PoolManager } from "../pool-manager.js";

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

    // EVM networks
    if (deps.poolManager.getEvmAccountCount() > 0) {
      kinds.push({
        x402Version: 1,
        scheme: "exact",
        network: "base-sepolia",
      });

      kinds.push({
        x402Version: 1,
        scheme: "exact",
        network: "x-layer",
      });

      kinds.push({
        x402Version: 1,
        scheme: "exact",
        network: "x-layer-testnet",
      });
    }

    // SVM networks
    if (deps.poolManager.getSvmAccountCount() > 0) {
      const pool = deps.poolManager.getPool("solana-devnet");
      if (pool) {
        const feePayer = await pool.execute(async (signer) => {
          return isSvmSignerWallet(signer) ? signer.address : undefined;
        });

        kinds.push({
          x402Version: 1,
          scheme: "exact",
          network: "solana-devnet",
          extra: {
            feePayer,
          },
        });
      }
    }

    res.json({
      kinds,
    });
  });

  return router;
}
