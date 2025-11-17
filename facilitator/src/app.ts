/**
 * Application Factory
 *
 * Creates and configures the Express application with all middleware and routes.
 */

import express, { Express } from "express";
import cors from "cors";
import { registerRoutes, RoutesDependencies } from "./routes/index.js";
import { shutdownMiddleware, GracefulShutdown } from "./shutdown.js";
import type { RateLimitConfig } from "./config.js";
import { createVerifyRateLimiter, createSettleRateLimiter } from "./middleware/rate-limit.js";

/**
 * Application dependencies
 */
export interface AppDependencies {
  shutdownManager: GracefulShutdown;
  routesDeps: RoutesDependencies;
  requestBodyLimit: string;
  rateLimitConfig: RateLimitConfig;
}

/**
 * Create and configure Express application
 *
 * @param deps - Application dependencies
 * @returns Configured Express application
 */
export function createApp(deps: AppDependencies): Express {
  const app = express();

  // Trust proxy for accurate IP detection behind reverse proxies (e.g., Railway)
  // This allows express-rate-limit to correctly identify client IPs from X-Forwarded-For header
  app.set("trust proxy", 1);

  // Enable CORS for client-side SDK support (Serverless Mode)
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN || "*",
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
      maxAge: 86400, // 24 hours
    }),
  );

  // Configure express to parse JSON bodies with size limit
  app.use(express.json({ limit: deps.requestBodyLimit }));

  // Add shutdown middleware to reject new requests during shutdown
  app.use(shutdownMiddleware);

  // Create rate limiters
  const verifyRateLimiter = createVerifyRateLimiter(deps.rateLimitConfig);
  const settleRateLimiter = createSettleRateLimiter(deps.rateLimitConfig);

  // Register all routes (rate limiters will be applied per-route)
  registerRoutes(app, deps.routesDeps, { verifyRateLimiter, settleRateLimiter });

  return app;
}
