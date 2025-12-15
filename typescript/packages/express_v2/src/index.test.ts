/**
 * Integration tests for x402x Express v2 middleware wrapper
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import { paymentMiddleware, X402Context } from "./index.js";
import type { X402xRouteConfig, X402Request } from "./index.js";

// Mock the official x402 middleware
vi.mock("@x402/express", () => ({
  x402: vi.fn().mockImplementation(({ server, facilitator }) => {
    return vi.fn().mockImplementation(async (req, res, next) => {
      // Mock the official middleware behavior
      if (!req.headers["x-payment"]) {
        // Get payment requirements from custom server
        const requirements = await server.getPaymentRequirements(req);

        // Mock response with requirements
        (req as any).x402Response = {
          requiresPayment: true,
          accepts: requirements,
        };
        return;
      }

      // Mock successful payment verification
      (req as any).x402Response = {
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
      };

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

describe("express_v2 middleware", () => {
  let app: express.Application;
  let mockFacilitator: any;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
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
    app.get("/api/test", (req, res) => {
      res.json({ success: true });
    });

    // Mock request/response for testing
    const mockReq = {
      method: "GET",
      path: "/api/test",
      url: "/api/test",
      headers: {},
    } as any;

    const mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      headers: {},
      setHeader: vi.fn(),
    } as any;

    await new Promise<void>((resolve) => {
      middleware(mockReq, mockRes, () => {
        resolve();
      });
    });

    expect(mockRes.status).not.toHaveBeenCalledWith(402);
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

    // Test basic route
    const mockReq = {
      method: "GET",
      path: "/api/basic",
      url: "/api/basic",
      headers: {},
    } as any;

    const mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      headers: {},
      setHeader: vi.fn(),
    } as any;

    await new Promise<void>((resolve) => {
      middleware(mockReq, mockRes, () => {
        resolve();
      });
    });

    expect(mockRes.status).not.toHaveBeenCalledWith(402);
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

    const mockReq = {
      method: "GET",
      path: "/api/custom",
      url: "/api/custom",
      headers: {},
    } as any;

    const mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      headers: {},
      setHeader: vi.fn(),
    } as any;

    await new Promise<void>((resolve) => {
      middleware(mockReq, mockRes, () => {
        resolve();
      });
    });

    expect(mockRes.status).not.toHaveBeenCalledWith(402);
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

    const mockReq = {
      method: "GET",
      path: "/api/func",
      url: "/api/func",
      headers: {},
    } as any;

    const mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      headers: {},
      setHeader: vi.fn(),
    } as any;

    await new Promise<void>((resolve) => {
      middleware(mockReq, mockRes, () => {
        resolve();
      });
    });

    expect(mockRes.status).not.toHaveBeenCalledWith(402);
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

    const mockReq = {
      method: "GET",
      path: "/api/multi",
      url: "/api/multi",
      headers: {},
    } as any;

    const mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      headers: {},
      setHeader: vi.fn(),
    } as any;

    await new Promise<void>((resolve) => {
      middleware(mockReq, mockRes, () => {
        resolve();
      });
    });

    expect(mockRes.status).not.toHaveBeenCalledWith(402);
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

    const mockReq = {
      method: "GET",
      path: "/api/context",
      url: "/api/context",
      headers: {
        "x-payment": "mock-payment-token",
      },
    } as any;

    const mockRes = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      headers: {},
      setHeader: vi.fn(),
    } as any;

    await new Promise<void>((resolve) => {
      middleware(mockReq, mockRes, () => {
        resolve();
      });
    });

    // Check that x402 context was attached to request
    const x402 = (mockReq as X402Request).x402;
    expect(x402).toBeDefined();
    expect(x402?.settlement).toBeDefined();
    expect(x402?.payer).toBe("0x1234567890123456789012345678901234567890");
    expect(x402?.amount).toBe("1000000");
  });
});
