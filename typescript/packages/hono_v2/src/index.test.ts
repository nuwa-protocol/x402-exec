/**
 * Integration tests for x402x Hono v2 middleware wrapper
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { paymentMiddleware, X402Context } from "./index.js";
import type { X402xRouteConfig } from "./index.js";

// Mock the official x402 middleware
vi.mock("@x402/hono", () => ({
  x402: vi.fn().mockImplementation(({ server, facilitator }) => {
    return vi.fn().mockImplementation(async (c, next) => {
      // Mock the official middleware behavior
      if (!c.req.header("X-PAYMENT")) {
        // Get payment requirements from custom server
        const requirements = await server.getPaymentRequirements(c.req);

        // Mock response with requirements
        c.set("x402Response", {
          requiresPayment: true,
          accepts: requirements,
        });
        return;
      }

      // Mock successful payment verification
      c.set("x402Response", {
        paymentContext: {
          payer: "0x1234567890123456789012345678901234567890",
          amount: "1000000",
          network: "eip155:84532",
          payment: { scheme: "exact" },
          requirements: { scheme: "exact" },
          settlement: {
            router: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            hook: "0x1111111111111111111111111111111111111111",
            hookData: "0x",
            facilitatorFee: "100000",
          },
        },
      });

      await next();
    });
  }),
}));

// Mock core_v2 utilities
vi.mock("@x402x/core_v2", () => ({
  addSettlementExtra: vi.fn().mockImplementation((base, extra) => ({
    ...base,
    extra,
  })),
  getNetworkConfig: vi.fn().mockReturnValue({
    settlementRouter: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  }),
  TransferHook: {
    getAddress: vi.fn().mockReturnValue("0x1111111111111111111111111111111111111111"),
    encode: vi.fn().mockReturnValue("0x"),
  },
  calculateFacilitatorFee: vi.fn().mockResolvedValue({
    facilitatorFee: "100000",
    facilitatorFeeUSD: "0.10",
  }),
  processPriceToAtomicAmount: vi.fn().mockReturnValue({
    maxAmountRequired: "900000",
    asset: {
      address: "0x2222222222222222222222222222222222222222",
      decimals: 6,
    },
  }),
  computeRoutePatterns: vi.fn().mockReturnValue([]),
  findMatchingRoute: vi.fn().mockReturnValue(null),
  toJsonSafe: vi.fn().mockImplementation((val) => val),
}));

describe("hono_v2 middleware", () => {
  let app: Hono;
  let mockFacilitator: any;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    mockFacilitator = {
      url: "https://facilitator.x402.org",
    };
  });

  it("should import and create payment middleware", () => {
    const middleware = paymentMiddleware(
      "0x1234567890123456789012345678901234567890",
      {
        price: "$0.01",
        network: "eip155:84532",
      },
      mockFacilitator
    );

    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe("function");
  });

  it("should handle simple route configuration", async () => {
    const routeConfig: X402xRouteConfig = {
      price: "$0.01",
      network: "eip155:84532",
    };

    const middleware = paymentMiddleware(
      "0x1234567890123456789012345678901234567890",
      routeConfig,
      mockFacilitator
    );

    app.use("/api/*", middleware);
    app.get("/api/test", (c) => c.json({ success: true }));

    const res = await app.request("/api/test");
    expect(res.status).toBe(200);
  });

  it("should handle per-route configuration", async () => {
    const routes = {
      "/api/basic": {
        price: "$0.01",
        network: "eip155:84532",
      },
      "/api/premium": {
        price: "$0.10",
        network: "eip155:84532",
        facilitatorFee: "$0.01",
      },
    };

    const middleware = paymentMiddleware(
      "0x1234567890123456789012345678901234567890",
      routes,
      mockFacilitator
    );

    app.use(middleware);
    app.get("/api/basic", (c) => c.json({ tier: "basic" }));
    app.get("/api/premium", (c) => c.json({ tier: "premium" }));

    const res = await app.request("/api/basic");
    expect(res.status).toBe(200);
  });

  it("should support custom hook configuration", async () => {
    const routeConfig: X402xRouteConfig = {
      price: "$0.01",
      network: "eip155:84532",
      hook: "0xCustomHook123456789012345678901234567890123456",
      hookData: "0x1234567890",
    };

    const middleware = paymentMiddleware(
      "0x1234567890123456789012345678901234567890",
      routeConfig,
      mockFacilitator
    );

    app.use("/api/*", middleware);
    app.get("/api/custom", (c) => c.json({ success: true }));

    const res = await app.request("/api/custom");
    expect(res.status).toBe(200);
  });

  it("should support function-based hooks and fees", async () => {
    const routeConfig: X402xRouteConfig = {
      price: "$0.01",
      network: "eip155:84532",
      hook: (network) => `0xHookFor${network}`,
      facilitatorFee: (network) => network === "eip155:84532" ? "$0.01" : "$0.02",
    };

    const middleware = paymentMiddleware(
      "0x1234567890123456789012345678901234567890",
      routeConfig,
      mockFacilitator
    );

    app.use("/api/*", middleware);
    app.get("/api/func", (c) => c.json({ success: true }));

    const res = await app.request("/api/func");
    expect(res.status).toBe(200);
  });

  it("should support multi-network configuration", async () => {
    const routeConfig: X402xRouteConfig = {
      price: "$0.01",
      network: ["eip155:84532", "eip155:8453"],
    };

    const middleware = paymentMiddleware(
      "0x1234567890123456789012345678901234567890",
      routeConfig,
      mockFacilitator
    );

    app.use("/api/*", middleware);
    app.get("/api/multi", (c) => c.json({ success: true }));

    const res = await app.request("/api/multi");
    expect(res.status).toBe(200);
  });

  it("should provide x402x context with settlement information", async () => {
    const middleware = paymentMiddleware(
      "0x1234567890123456789012345678901234567890",
      {
        price: "$0.01",
        network: "eip155:84532",
      },
      mockFacilitator
    );

    app.use("/api/*", middleware);
    app.get("/api/context", (c) => {
      const x402 = c.get("x402") as X402Context;
      return c.json({
        hasContext: !!x402,
        hasSettlement: !!x402?.settlement,
        payer: x402?.payer,
        amount: x402?.amount,
      });
    });

    // Mock payment header
    const res = await app.request("/api/context", {
      headers: {
        "X-PAYMENT": "mock-payment-token",
      },
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.hasContext).toBe(true);
    expect(data.hasSettlement).toBe(true);
  });
});
