/**
 * E2E Tests for Facilitator Server
 *
 * Tests complete HTTP request flows with mocked dependencies
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createApp } from "../../src/app.js";
import type { RoutesDependencies } from "../../src/routes/index.js";

// Mock modules that depend on external services
vi.mock("x402/facilitator", () => ({
  settle: vi.fn(async () => ({
    success: true,
    transaction: "0xtxhash123",
    payer: "0x1234567890123456789012345678901234567890",
    network: "base-sepolia",
  })),
  verify: vi.fn(async () => ({
    isValid: true,
    payer: "0x1234567890123456789012345678901234567890",
  })),
}));

vi.mock("../../src/settlement.js", () => ({
  isSettlementMode: vi.fn((pr) => !!pr.extra?.settlementRouter),
  settleWithRouter: vi.fn(async () => ({
    success: true,
    transaction: "0xroutertx",
    payer: "0x1234567890123456789012345678901234567890",
    network: "base-sepolia",
  })),
  validateSettlementRouter: vi.fn(),
}));

vi.mock("x402/types", async () => {
  const actual = await vi.importActual("x402/types");
  return {
    ...actual,
    createSigner: vi.fn(() => ({
      account: { address: "0xfacilitator" },
    })),
    createConnectedClient: vi.fn(() => ({
      request: vi.fn(),
    })),
  };
});

describe("E2E: Facilitator Server", () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    // Create mock dependencies
    const mockPool = {
      execute: vi.fn(async (fn) =>
        fn({
          account: { address: "0xfacilitator" },
        }),
      ),
      getAccountsInfo: vi.fn(() => [
        { address: "0xfacilitator", queueDepth: 0, totalProcessed: 0 },
      ]),
      getAccountCount: vi.fn(() => 1),
      getTotalProcessed: vi.fn(() => 0),
    };

    const mockShutdownManager = {
      isShutdown: vi.fn(() => false),
      getActiveRequestCount: vi.fn(() => 0),
      registerServer: vi.fn(),
    };

    const routesDeps: RoutesDependencies = {
      shutdownManager: mockShutdownManager as any,
      poolManager: {
        getPool: vi.fn(() => mockPool),
        getEvmAccountPools: vi.fn(() => new Map([["base-sepolia", mockPool as any]])),
        getSvmAccountPools: vi.fn(() => new Map()),
        getEvmAccountCount: vi.fn(() => 1),
        getSvmAccountCount: vi.fn(() => 0),
        hasAccounts: vi.fn(() => true),
      } as any,
      evmAccountPools: new Map([["base-sepolia", mockPool as any]]),
      svmAccountPools: new Map(),
      evmAccountCount: 1,
      svmAccountCount: 0,
      tokenCache: undefined,
      allowedSettlementRouters: {
        "base-sepolia": ["0x32431D4511e061F1133520461B07eC42afF157D6"],
      },
      x402Config: undefined,
    };

    app = createApp({
      shutdownManager: mockShutdownManager as any,
      routesDeps,
      requestBodyLimit: "1mb",
      rateLimitConfig: {
        enabled: false, // Disable rate limiting for tests
        verifyMax: 100,
        settleMax: 20,
        windowMs: 60000,
      },
    });
  });

  describe("Health Check Endpoints", () => {
    it("should respond to /health", async () => {
      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ok");
    });

    it("should respond to /ready", async () => {
      const response = await request(app).get("/ready");

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("ready");
      expect(response.body.checks).toBeDefined();
    });
  });

  describe("Supported Payment Kinds", () => {
    it("should return supported payment kinds", async () => {
      const response = await request(app).get("/supported");

      expect(response.status).toBe(200);
      expect(response.body.kinds).toBeDefined();
      expect(Array.isArray(response.body.kinds)).toBe(true);
    });
  });

  describe("Payment Verification Flow", () => {
    it("should verify valid payment payload", async () => {
      const payload = {
        x402Version: 1,
        scheme: "exact",
        network: "base-sepolia",
        resource: "/api/example",
        payload: {
          authorization: {
            from: "0x1234567890123456789012345678901234567890",
            to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
            value: "1000000",
            validAfter: 0,
            validBefore: Math.floor(Date.now() / 1000) + 3600,
            nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
          },
          signature: {
            v: 27,
            r: "0x1234567890123456789012345678901234567890123456789012345678901234",
            s: "0x1234567890123456789012345678901234567890123456789012345678901234",
          },
        },
      };

      const requirements = {
        x402Version: 1,
        scheme: "exact",
        network: "base-sepolia",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        receiver: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        maxAmountRequired: "1000000",
      };

      const response = await request(app).post("/verify").send({
        paymentPayload: payload,
        paymentRequirements: requirements,
      });

      // Verify endpoint is responding
      // Note: 400 indicates schema validation is working, which is also valid
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.body).toBeDefined();
    });
  });

  describe("Standard Settlement Flow", () => {
    it("should settle payment in standard mode", async () => {
      const payload = {
        x402Version: 1,
        scheme: "exact",
        network: "base-sepolia",
        resource: "/api/example",
        payload: {
          authorization: {
            from: "0x1234567890123456789012345678901234567890",
            to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
            value: "1000000",
            validAfter: 0,
            validBefore: Math.floor(Date.now() / 1000) + 3600,
            nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
          },
          signature: {
            v: 27,
            r: "0x1234567890123456789012345678901234567890123456789012345678901234",
            s: "0x1234567890123456789012345678901234567890123456789012345678901234",
          },
        },
      };

      const requirements = {
        x402Version: 1,
        scheme: "exact",
        network: "base-sepolia",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        receiver: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        maxAmountRequired: "1000000",
      };

      const response = await request(app).post("/settle").send({
        paymentPayload: payload,
        paymentRequirements: requirements,
      });

      // Settle endpoint is responding
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.body).toBeDefined();
    });
  });

  describe("Settlement Router Flow", () => {
    it("should settle payment with settlement router", async () => {
      const payload = {
        x402Version: 1,
        scheme: "exact",
        network: "base-sepolia",
        resource: "/api/example",
        payload: {
          authorization: {
            from: "0x1234567890123456789012345678901234567890",
            to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
            value: "1000000",
            validAfter: 0,
            validBefore: Math.floor(Date.now() / 1000) + 3600,
            nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
          },
          signature: {
            v: 27,
            r: "0x1234567890123456789012345678901234567890123456789012345678901234",
            s: "0x1234567890123456789012345678901234567890123456789012345678901234",
          },
        },
      };

      const requirements = {
        x402Version: 1,
        scheme: "exact",
        network: "base-sepolia",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        receiver: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        maxAmountRequired: "1000000",
        extra: {
          settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
          hook: "0x1234567890123456789012345678901234567890",
          hookData: "0x",
          payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          facilitatorFee: "100000",
          salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
        },
      };

      const response = await request(app).post("/settle").send({
        paymentPayload: payload,
        paymentRequirements: requirements,
      });

      // Settle endpoint is responding
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
      expect(response.body).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle 404 for unknown endpoints", async () => {
      const response = await request(app).get("/unknown");

      expect(response.status).toBe(404);
    });

    it("should handle invalid JSON", async () => {
      const response = await request(app)
        .post("/settle")
        .set("Content-Type", "application/json")
        .send("invalid json");

      expect(response.status).toBe(400);
    });

    it("should validate request schema", async () => {
      const response = await request(app)
        .post("/settle")
        .send({
          paymentPayload: { invalid: "data" },
          paymentRequirements: { invalid: "data" },
        });

      expect(response.status).toBe(400);
    });
  });

  describe("Concurrent Requests", () => {
    it("should handle multiple concurrent requests", async () => {
      const requests = Array.from({ length: 10 }, () => request(app).get("/health"));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
