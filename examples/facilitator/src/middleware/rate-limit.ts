/**
 * Rate Limiting Middleware
 *
 * Provides protection against DoS/DDoS attacks and API abuse by limiting
 * the number of requests per IP address within a time window.
 *
 * Different endpoints have different rate limits:
 * - /verify: Higher limit for read-only verification
 * - /settle: Lower limit for write operations
 * - /health, /ready, /supported: No limit for monitoring
 */

import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";
import { getLogger } from "../telemetry.js";

const logger = getLogger();

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  verifyMax: number;
  settleMax: number;
  windowMs: number;
}

/**
 * Create rate limiter for verify endpoint
 *
 * @param config - Rate limiting configuration
 * @returns Express rate limiting middleware
 */
export function createVerifyRateLimiter(config: RateLimitConfig): RateLimitRequestHandler {
  if (!config.enabled) {
    // Return a no-op middleware when disabled
    return (req, res, next) => next();
  }

  return rateLimit({
    windowMs: config.windowMs,
    max: config.verifyMax,
    message: {
      error: "Too many verification requests",
      message: `Rate limit exceeded. Maximum ${config.verifyMax} requests per ${config.windowMs / 1000} seconds allowed.`,
      retryAfter: Math.ceil(config.windowMs / 1000),
    },
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    handler: (req, res) => {
      logger.warn(
        {
          ip: req.ip,
          endpoint: req.path,
          method: req.method,
        },
        "Rate limit exceeded for verify endpoint",
      );
      res.status(429).json({
        error: "Too many verification requests",
        message: `Rate limit exceeded. Maximum ${config.verifyMax} requests per ${config.windowMs / 1000} seconds allowed.`,
        retryAfter: Math.ceil(config.windowMs / 1000),
      });
    },
    // Skip rate limiting for certain conditions if needed
    skip: (_req) => {
      // Could add whitelisted IPs here if needed
      return false;
    },
  });
}

/**
 * Create rate limiter for settle endpoint
 *
 * @param config - Rate limiting configuration
 * @returns Express rate limiting middleware
 */
export function createSettleRateLimiter(config: RateLimitConfig): RateLimitRequestHandler {
  if (!config.enabled) {
    // Return a no-op middleware when disabled
    return (req, res, next) => next();
  }

  return rateLimit({
    windowMs: config.windowMs,
    max: config.settleMax,
    message: {
      error: "Too many settlement requests",
      message: `Rate limit exceeded. Maximum ${config.settleMax} requests per ${config.windowMs / 1000} seconds allowed.`,
      retryAfter: Math.ceil(config.windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn(
        {
          ip: req.ip,
          endpoint: req.path,
          method: req.method,
        },
        "Rate limit exceeded for settle endpoint",
      );
      res.status(429).json({
        error: "Too many settlement requests",
        message: `Rate limit exceeded. Maximum ${config.settleMax} requests per ${config.windowMs / 1000} seconds allowed.`,
        retryAfter: Math.ceil(config.windowMs / 1000),
      });
    },
    skip: (_req) => {
      // Could add whitelisted IPs here if needed
      return false;
    },
  });
}
