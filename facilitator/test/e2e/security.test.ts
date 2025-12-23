/**
 * Security Features E2E Tests
 *
 * Tests rate limiting and input validation features
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { createApp, type AppDependencies } from "../../src/app.js";
import { GracefulShutdown } from "../../src/shutdown.js";
import type { PoolManager } from "../../src/pool-manager.js";
import type { RateLimitConfig } from "../../src/config.js";

// Mock dependencies
const mockPoolManager: Partial<PoolManager> = {
  getPool: vi.fn(() => null),
  getEvmAccountPools: vi.fn(() => new Map()),
  getSvmAccountPools: vi.fn(() => new Map()),
  getEvmAccountCount: vi.fn(() => 0),
  getSvmAccountCount: vi.fn(() => 0),
  getSupportedNetworks: vi.fn(() => []),
};

describe("Security Features E2E", () => {
  let app: Express;
  let shutdownManager: GracefulShutdown;

  beforeAll(() => {
    shutdownManager = new GracefulShutdown(30000);

    const rateLimitConfig: RateLimitConfig = {
      enabled: true,
      verifyMax: 5, // Low limit for testing
      settleMax: 3, // Low limit for testing
      windowMs: 60000,
    };

    const appDeps: AppDependencies = {
      shutdownManager,
      routesDeps: {
        shutdownManager,
        poolManager: mockPoolManager as PoolManager,
        evmAccountPools: new Map(),
        svmAccountPools: new Map(),
        evmAccountCount: 0,
        svmAccountCount: 0,
        tokenCache: undefined,
        allowedSettlementRouters: {
          "base-sepolia": ["0x32431D4511e061F1133520461B07eC42afF157D6"],
        },
        x402Config: undefined,
        gasCost: {
          enabled: false, // Disable gas cost validation for tests
          baseGasLimit: 150000,
          hookGasOverhead: {
            transfer: 50000,
            custom: 100000,
          },
          safetyMultiplier: 1.5,
          networkGasPrice: {
            "base-sepolia": "50000000000",
          },
          nativeTokenPrice: {
            "base-sepolia": 3000,
          },
          maxGasLimit: 5000000,
          hookWhitelistEnabled: false,
          allowedHooks: {},
        },
        dynamicGasPrice: {
          strategy: "static" as const,
          cacheTTL: 300,
          updateInterval: 60,
          rpcUrls: {},
        },
      },
      requestBodyLimit: "100kb", // Small limit for testing
      rateLimitConfig,
    };

    app = createApp(appDeps);
  });

  afterAll(async () => {
    // No cleanup needed - just let the test finish
  });

  describe("Rate Limiting", () => {
    it("should allow requests within rate limit", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
    });

    it("should return rate limit headers", async () => {
      const response = await request(app).post("/verify").send({
        paymentPayload: {},
        paymentRequirements: {},
      });

      // Rate limit headers should be present
      expect(response.headers["ratelimit-limit"]).toBeDefined();
      expect(response.headers["ratelimit-remaining"]).toBeDefined();
    });
  });

  describe("Request Body Size Limit", () => {
    it("should reject extremely large requests", async () => {
      // Create a payload larger than the limit
      const largePayload = {
        paymentPayload: {
          data: "x".repeat(200 * 1024), // 200KB
        },
        paymentRequirements: {},
      };

      const response = await request(app).post("/verify").send(largePayload);

      // Should be rejected with 413 Payload Too Large
      expect([413, 400]).toContain(response.status);
    });

    it("should accept normal-sized requests", async () => {
      const normalPayload = {
        paymentPayload: {},
        paymentRequirements: {},
      };

      const response = await request(app).post("/verify").send(normalPayload);

      // Should process the request (even if it fails validation)
      expect([200, 400]).toContain(response.status);
    });
  });

  describe("Error Handling", () => {
    it("should return sanitized error messages", async () => {
      const invalidPayload = {
        paymentPayload: "invalid",
        paymentRequirements: "invalid",
      };

      const response = await request(app).post("/verify").send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.message).toBeDefined();
      // Should not leak internal details like stack traces
      expect(response.body.stack).toBeUndefined();
      expect(response.body.details).toBeUndefined();
    });

    it("should not expose internal error details for settle endpoint", async () => {
      const invalidPayload = {
        paymentPayload: { invalid: "data" },
        paymentRequirements: { invalid: "data" },
      };

      const response = await request(app).post("/settle").send(invalidPayload);

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.message).toBeDefined();
      // Should not leak internal details
      expect(response.body.stack).toBeUndefined();
    });
  });

  describe("Health Endpoints (No Rate Limiting)", () => {
    it("should allow unlimited health check requests", async () => {
      // Make multiple requests
      const requests = Array.from({ length: 20 }, () => request(app).get("/health"));

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });

    it("should allow unlimited readiness check requests", async () => {
      // Make multiple requests
      const requests = Array.from({ length: 20 }, () => request(app).get("/ready"));

      const responses = await Promise.all(requests);

      // All should return (may be 200 or 503 depending on readiness)
      responses.forEach((response) => {
        expect([200, 503]).toContain(response.status);
      });
    });

    it("should allow unlimited supported endpoint requests", async () => {
      // Make multiple requests
      const requests = Array.from({ length: 20 }, () => request(app).get("/supported"));

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
