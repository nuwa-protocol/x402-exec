/**
 * Routes Registry
 *
 * Central registry for all application routes.
 * Combines all route modules and registers them with the Express app.
 */

import { Express } from "express";
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
 * Register all routes with the Express app
 *
 * @param app - Express application instance
 * @param deps - Dependencies for all routes
 */
export function registerRoutes(app: Express, deps: RoutesDependencies): void {
  // Health check routes
  const healthRoutes = createHealthRoutes(deps);
  app.use(healthRoutes);

  // Verify routes
  const verifyRoutes = createVerifyRoutes(deps);
  app.use(verifyRoutes);

  // Settle routes
  const settleRoutes = createSettleRoutes(deps);
  app.use(settleRoutes);

  // Supported payment kinds routes
  const supportedRoutes = createSupportedRoutes(deps);
  app.use(supportedRoutes);
}
