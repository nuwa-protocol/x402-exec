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

/**
 * All dependencies required by routes
 */
export interface RoutesDependencies
  extends HealthRouteDependencies,
    VerifyRouteDependencies,
    SettleRouteDependencies,
    SupportedRouteDependencies {}

/**
 * Rate limiters for specific routes
 */
export interface RateLimiters {
  verifyRateLimiter: RateLimitRequestHandler;
  settleRateLimiter: RateLimitRequestHandler;
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
  // Health check routes (no rate limiting)
  const healthRoutes = createHealthRoutes(deps);
  app.use(healthRoutes);

  // Verify routes (with rate limiting)
  const verifyRoutes = createVerifyRoutes(deps, rateLimiters.verifyRateLimiter);
  app.use(verifyRoutes);

  // Settle routes (with rate limiting)
  const settleRoutes = createSettleRoutes(deps, rateLimiters.settleRateLimiter);
  app.use(settleRoutes);

  // Supported payment kinds routes (no rate limiting)
  const supportedRoutes = createSupportedRoutes(deps);
  app.use(supportedRoutes);
}
