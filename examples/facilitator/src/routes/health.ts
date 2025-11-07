/**
 * Health Check Routes
 *
 * Provides health check endpoints for monitoring and orchestration:
 * - GET /health: Liveness probe (simple health check)
 * - GET /ready: Readiness probe (detailed health checks with dependencies)
 */

import { Router, Request, Response } from "express";
import type { AccountPool } from "../account-pool.js";
import type { TokenCache } from "../cache/index.js";
import type { GracefulShutdown } from "../shutdown.js";

/**
 * Dependencies required by health routes
 */
export interface HealthRouteDependencies {
  shutdownManager: GracefulShutdown;
  evmAccountPools: Map<string, AccountPool>;
  svmAccountPools: Map<string, AccountPool>;
  evmAccountCount: number;
  svmAccountCount: number;
  tokenCache?: TokenCache;
  allowedSettlementRouters: Record<string, string[]>;
}

/**
 * Create health check routes
 *
 * @param deps - Dependencies for health routes
 * @returns Express Router with health check endpoints
 */
export function createHealthRoutes(deps: HealthRouteDependencies): Router {
  const router = Router();

  /**
   * GET /health - Health check (liveness probe)
   */
  router.get("/health", (req: Request, res: Response) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  /**
   * GET /ready - Readiness check with account pool health checks
   */
  router.get("/ready", async (req: Request, res: Response) => {
    const checks: Record<
      string,
      | { status: string; message?: string }
      | { evm: number; svm: number; status: string }
      | {
          evm: Array<{
            network: string;
            accounts: Array<{ address: string; queueDepth: number; totalProcessed: number }>;
          }>;
          svm: Array<{
            network: string;
            accounts: Array<{ address: string; queueDepth: number; totalProcessed: number }>;
          }>;
          status: string;
        }
      | {
          enabled: boolean;
          hits?: number;
          misses?: number;
          keys?: number;
          hitRate?: string;
          status: string;
        }
    > = {};
    let allHealthy = true;

    // Check private keys are loaded
    checks.accounts = {
      evm: deps.evmAccountCount,
      svm: deps.svmAccountCount,
      status: deps.evmAccountCount > 0 || deps.svmAccountCount > 0 ? "ok" : "error",
    };

    if (checks.accounts.status === "error") {
      allHealthy = false;
    }

    // Check account pools
    const evmAccountsInfo: Array<{
      network: string;
      accounts: Array<{ address: string; queueDepth: number; totalProcessed: number }>;
    }> = [];
    for (const [network, pool] of deps.evmAccountPools.entries()) {
      const accounts = pool.getAccountsInfo();
      evmAccountsInfo.push({
        network,
        accounts: accounts.map((acc) => ({
          address: acc.address,
          queueDepth: acc.queueDepth,
          totalProcessed: acc.totalProcessed,
        })),
      });
    }

    const svmAccountsInfo: Array<{
      network: string;
      accounts: Array<{ address: string; queueDepth: number; totalProcessed: number }>;
    }> = [];
    for (const [network, pool] of deps.svmAccountPools.entries()) {
      const accounts = pool.getAccountsInfo();
      svmAccountsInfo.push({
        network,
        accounts: accounts.map((acc) => ({
          address: acc.address,
          queueDepth: acc.queueDepth,
          totalProcessed: acc.totalProcessed,
        })),
      });
    }

    checks.accountPools = {
      evm: evmAccountsInfo,
      svm: svmAccountsInfo,
      status: "ok",
    };

    // Check cache
    if (deps.tokenCache) {
      const cacheStats = deps.tokenCache.getStats();
      checks.cache = {
        enabled: true,
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        keys: cacheStats.keys,
        hitRate:
          cacheStats.hits + cacheStats.misses > 0
            ? ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(2) + "%"
            : "0%",
        status: "ok",
      };
    } else {
      checks.cache = {
        enabled: false,
        status: "ok",
      };
    }

    // Check settlement router whitelist configured
    const hasRouters = Object.values(deps.allowedSettlementRouters).some(
      (routers) => routers.length > 0,
    );
    checks.settlementRouterWhitelist = hasRouters
      ? { status: "ok" }
      : { status: "warning", message: "No settlement routers configured" };

    // Check if shutdown is in progress
    checks.shutdown = deps.shutdownManager.isShutdown()
      ? { status: "error", message: "Shutdown in progress" }
      : { status: "ok" };

    if (checks.shutdown.status === "error") {
      allHealthy = false;
    }

    // Check active requests
    const activeRequests = deps.shutdownManager.getActiveRequestCount();
    checks.activeRequests = {
      status: "ok",
      message: `${activeRequests} active request(s)`,
    };

    const status = allHealthy ? 200 : 503;

    res.status(status).json({
      status: allHealthy ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  return router;
}

