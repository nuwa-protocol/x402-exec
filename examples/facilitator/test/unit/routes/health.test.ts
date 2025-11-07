/**
 * Tests for routes/health.ts
 *
 * Tests health check endpoints
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createHealthRoutes, type HealthRouteDependencies } from "../../../src/routes/health.js";

describe("routes/health", () => {
  let app: express.Application;
  let mockDeps: HealthRouteDependencies;

  beforeEach(() => {
    // Create mock dependencies
    const mockPool = {
      getAccountsInfo: vi.fn(() => [{ address: "0xabc", queueDepth: 0, totalProcessed: 10 }]),
    };

    mockDeps = {
      shutdownManager: {
        isShutdown: vi.fn(() => false),
        getActiveRequestCount: vi.fn(() => 0),
      } as any,
      evmAccountPools: new Map([["base-sepolia", mockPool as any]]),
      svmAccountPools: new Map(),
      evmAccountCount: 1,
      svmAccountCount: 0,
      tokenCache: {
        getStats: vi.fn(() => ({
          hits: 100,
          misses: 20,
          keys: 50,
          ksize: 1000,
          vsize: 5000,
        })),
      } as any,
      allowedSettlementRouters: {
        "base-sepolia": ["0xrouter"],
      },
    };

    app = express();
    app.use(express.json());
    app.use(createHealthRoutes(mockDeps));
  });

  describe("GET /health", () => {
    it("should return OK status", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.uptime).toBeGreaterThan(0);
    });
  });

  describe("GET /ready", () => {
    it("should return ready when all checks pass", async () => {
      const response = await request(app).get("/ready");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ready");
      expect(response.body.checks).toBeDefined();
    });

    it("should check account availability", async () => {
      const response = await request(app).get("/ready");

      expect(response.body.checks.accounts).toBeDefined();
      expect(response.body.checks.accounts.evm).toBe(1);
      expect(response.body.checks.accounts.svm).toBe(0);
      expect(response.body.checks.accounts.status).toBe("ok");
    });

    it("should return error when no accounts configured", async () => {
      mockDeps.evmAccountCount = 0;
      mockDeps.svmAccountCount = 0;

      const response = await request(app).get("/ready");

      expect(response.status).toBe(503);
      expect(response.body.status).toBe("not_ready");
      expect(response.body.checks.accounts.status).toBe("error");
    });

    it("should check account pools status", async () => {
      const response = await request(app).get("/ready");

      expect(response.body.checks.accountPools).toBeDefined();
      expect(response.body.checks.accountPools.evm).toHaveLength(1);
      expect(response.body.checks.accountPools.status).toBe("ok");
    });

    it("should check cache status when enabled", async () => {
      const response = await request(app).get("/ready");

      expect(response.body.checks.cache).toBeDefined();
      expect(response.body.checks.cache.enabled).toBe(true);
      expect(response.body.checks.cache.hits).toBe(100);
      expect(response.body.checks.cache.misses).toBe(20);
      expect(response.body.checks.cache.hitRate).toBe("83.33%");
    });

    it("should check cache status when disabled", async () => {
      mockDeps.tokenCache = undefined;

      const response = await request(app).get("/ready");

      expect(response.body.checks.cache.enabled).toBe(false);
      expect(response.body.checks.cache.status).toBe("ok");
    });

    it("should check settlement router whitelist", async () => {
      const response = await request(app).get("/ready");

      expect(response.body.checks.settlementRouterWhitelist).toBeDefined();
      expect(response.body.checks.settlementRouterWhitelist.status).toBe("ok");
    });

    it("should warn when no routers configured", async () => {
      mockDeps.allowedSettlementRouters = {};

      const response = await request(app).get("/ready");

      expect(response.body.checks.settlementRouterWhitelist.status).toBe("warning");
    });

    it("should check shutdown status", async () => {
      const response = await request(app).get("/ready");

      expect(response.body.checks.shutdown).toBeDefined();
      expect(response.body.checks.shutdown.status).toBe("ok");
    });

    it("should return error when shutdown in progress", async () => {
      vi.mocked(mockDeps.shutdownManager.isShutdown).mockReturnValue(true);

      const response = await request(app).get("/ready");

      expect(response.status).toBe(503);
      expect(response.body.checks.shutdown.status).toBe("error");
    });

    it("should check active requests", async () => {
      vi.mocked(mockDeps.shutdownManager.getActiveRequestCount).mockReturnValue(5);

      const response = await request(app).get("/ready");

      expect(response.body.checks.activeRequests).toBeDefined();
      expect(response.body.checks.activeRequests.message).toContain("5");
    });

    it("should include timestamp in response", async () => {
      const response = await request(app).get("/ready");

      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });
});
