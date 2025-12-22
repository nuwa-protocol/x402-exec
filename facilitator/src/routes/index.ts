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
import type { GasCostConfig } from "../gas-cost.js";
import type { DynamicGasPriceConfig } from "../dynamic-gas-price.js";
import type { TokenPriceConfig } from "../token-price.js";

/**
 * All dependencies required by routes
 */
export interface RoutesDependencies
  extends HealthRouteDependencies,
    SupportedRouteDependencies,
    FeeRouteDependencies,
    StatsRouteDependencies {
  // Verify route dependencies
  poolManager: import("../pool-manager.js").PoolManager;
  x402Config?: import("x402/types").X402Config;
  balanceChecker?: import("../balance-check.js").BalanceChecker;
  rpcUrls?: Record<string, string>;
  enableV2?: boolean;
  v2Signer?: string;
  allowedRouters?: Record<string, string[]>;

  // Settle route dependencies
  allowedSettlementRouters: Record<string, string[]>;
  gasCost: GasCostConfig;
  dynamicGasPrice: DynamicGasPriceConfig;
  tokenPrice: TokenPriceConfig;
  gasEstimation: import("../gas-estimation/index.js").GasEstimationConfig;
  v2: import("../config.js").V2Config;
}

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

  // Health check routes (no rate limiting)
  const healthRoutes = createHealthRoutes(deps);
  app.use(healthRoutes);

  // Verify routes (with rate limiting and validation)
  const verifyRoutes = createVerifyRoutes(
    deps,
    rateLimiters.verifyRateLimiter,
    hookValidation,
    feeValidation,
  );
  app.use(verifyRoutes);

  // Settle routes (with rate limiting and validation)
  const settleRoutes = createSettleRoutes(
    deps,
    rateLimiters.settleRateLimiter,
    hookValidation,
    feeValidation,
  );
  app.use(settleRoutes);

  // Fee query routes (no rate limiting)
  const feeRoutes = createFeeRoutes(deps);
  app.use(feeRoutes);

  // Supported payment kinds routes (no rate limiting)
  const supportedRoutes = createSupportedRoutes(deps);
  app.use(supportedRoutes);

  // Stats routes (no rate limiting)
  const statsRoutes = createStatsRoutes(deps);
  app.use(statsRoutes);
}
