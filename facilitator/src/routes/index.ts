/**
 * Routes Registry
 *
 * Central registry for all application routes.
 * Combines all route modules and registers them with the Express app.
 */

import { Express } from "express";
import type { RateLimitRequestHandler } from "express-rate-limit";
import { createHealthRoutes, HealthRouteDependencies } from "./health.js";
import { createVerifyRoutes, VerifyRouteDependencies } from "./verify.js";
import { createSettleRoutes, SettleRouteDependencies } from "./settle.js";
import { createSupportedRoutes, SupportedRouteDependencies } from "./supported.js";
import { createFeeRoutes, FeeRouteDependencies } from "./fee.js";
import { createStatsRoutes, type StatsRouteDependencies } from "./stats.js";
import { createHookValidationMiddleware } from "../middleware/hook-validation.js";
import { createFeeValidationMiddleware } from "../middleware/fee-validation.js";
import { createVersionDispatcher } from "../version-dispatcher.js";
import type { GasCostConfig } from "../gas-cost.js";
import type { DynamicGasPriceConfig } from "../dynamic-gas-price.js";
import type { TokenPriceConfig } from "../token-price.js";

/**
 * All dependencies required by routes
 */
export type RoutesDependencies = HealthRouteDependencies &
  SupportedRouteDependencies &
  StatsRouteDependencies &
  VerifyRouteDependencies &
  SettleRouteDependencies & {
    // Override optional properties from SettleRouteDependencies to make them required
    gasCost: GasCostConfig;
    dynamicGasPrice: DynamicGasPriceConfig;
    tokenPrice: TokenPriceConfig;
    gasEstimation: import("../gas-estimation/index.js").GasEstimationConfig;
    feeClaim: import("../fee-claim.js").FeeClaimConfig;
  };

/**
 * Rate limiters for specific routes
 */
export interface RateLimiters {
  verifyRateLimiter: any;
  settleRateLimiter: any;
}

/**
 * Register all routes with the Express app
 *
 * @param app - Express application instance
 * @param deps - Dependencies for all routes
 * @param rateLimiters - Rate limiting middleware for specific routes
 */
export function registerRoutes(
  app: Express,
  deps: RoutesDependencies,
  rateLimiters: RateLimiters,
): void {
  // Create validation middleware
  const hookValidation = createHookValidationMiddleware(deps.gasCost);
  const feeValidation = createFeeValidationMiddleware(
    deps.gasCost,
    deps.dynamicGasPrice,
    deps.tokenPrice,
  );

  // Create shared version dispatcher for both verify and settle routes
  const versionDispatcher = createVersionDispatcher(
    {
      poolManager: deps.poolManager,
      x402Config: deps.x402Config,
      balanceChecker: deps.balanceChecker,
      allowedSettlementRouters: deps.allowedSettlementRouters,
    },
    {
      enableV2: deps.enableV2,
      allowedRouters: deps.allowedRouters,
      rpcUrls: deps.rpcUrls,
    },
  );

  // Health check routes (no rate limiting)
  const healthRoutes = createHealthRoutes(deps);
  app.use(healthRoutes);

  // Verify routes (with rate limiting and validation)
  const verifyRoutes = createVerifyRoutes(
    deps,
    rateLimiters.verifyRateLimiter,
    hookValidation,
    feeValidation,
    versionDispatcher, // Pass shared dispatcher
  );
  app.use(verifyRoutes);

  // Settle routes (with rate limiting and validation)
  const settleRoutes = createSettleRoutes(
    deps,
    rateLimiters.settleRateLimiter,
    hookValidation,
    feeValidation,
    versionDispatcher, // Pass shared dispatcher
  );
  app.use(settleRoutes);

  // Fee query routes (no rate limiting)
  const feeRoutes = createFeeRoutes(deps);
  app.use(feeRoutes);

  // Supported payment kinds routes (no rate limiting)
  // Create /supported routes
  const supportedRoutes = createSupportedRoutes({
    poolManager: deps.poolManager,
    enableV2: deps.enableV2,
    v2Signer: deps.v2Signer,
    v2PrivateKey: deps.v2PrivateKey,
    allowedRouters: deps.allowedSettlementRouters, // Pass for availability check
    rpcUrls: deps.dynamicGasPrice.rpcUrls, // Pass for availability check
  });
  app.use(supportedRoutes);

  // Stats routes (no rate limiting)
  const statsRoutes = createStatsRoutes(deps);
  app.use(statsRoutes);
}
