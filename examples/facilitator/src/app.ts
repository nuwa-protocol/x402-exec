/**
 * Application Factory
 *
 * Creates and configures the Express application with all middleware and routes.
 */

import express, { Express } from "express";
import { registerRoutes, RoutesDependencies } from "./routes/index.js";
import { shutdownMiddleware, GracefulShutdown } from "./shutdown.js";

/**
 * Create and configure Express application
 *
 * @param shutdownManager - Shutdown manager for graceful shutdown
 * @param routesDeps - Dependencies for all routes
 * @returns Configured Express application
 */
export function createApp(
  shutdownManager: GracefulShutdown,
  routesDeps: RoutesDependencies,
): Express {
  const app = express();

  // Configure express to parse JSON bodies
  app.use(express.json());

  // Add shutdown middleware to reject new requests during shutdown
  app.use(shutdownMiddleware);

  // Register all routes
  registerRoutes(app, routesDeps);

  return app;
}

