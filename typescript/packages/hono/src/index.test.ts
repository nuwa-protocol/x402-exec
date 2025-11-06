import { describe, it, expect, vi, beforeEach } from "vitest";
import { paymentMiddleware } from "./index";

// Mock dependencies (same as express)
vi.mock("x402/verify", () => ({
  useFacilitator: vi.fn(() => ({
    verify: vi.fn(),
    settle: vi.fn(),
  })),
}));

vi.mock("x402/schemes", () => ({
  exact: {
    evm: {
      decodePayment: vi.fn(),
    },
  },
}));

vi.mock("x402/shared", () => ({
  computeRoutePatterns: vi.fn((routes) => {
    return Object.entries(routes).map(([pattern, config]) => {
      const [verb, path] = pattern.includes(" ") ? pattern.split(/\s+/) : ["*", pattern];
      return {
        verb: verb.toUpperCase(),
        pattern: new RegExp(`^${path.replace(/\*/g, ".*?")}$`, "i"),
        config,
      };
    });
  }),
  findMatchingRoute: vi.fn(),
  findMatchingPaymentRequirements: vi.fn(),
  processPriceToAtomicAmount: vi.fn(),
  toJsonSafe: vi.fn((x) => x),
}));

vi.mock("x402/types", async () => {
  const actual = await vi.importActual<typeof import("x402/types")>("x402/types");
  return {
    ...actual,
    SupportedEVMNetworks: ["base-sepolia", "x-layer-testnet"],
    settleResponseHeader: vi.fn((settlement) => JSON.stringify(settlement)),
  };
});

vi.mock("@x402x/core", () => ({
  addSettlementExtra: vi.fn((requirements) => ({
    ...requirements,
    payTo: "0x32431D4511e061F1133520461B07eC42afF157D6",
    extra: {
      settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
      hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
      hookData: "0x",
    },
  })),
  getNetworkConfig: vi.fn(() => ({
    chainId: 84532,
    settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
  })),
  TransferHook: {
    getAddress: vi.fn(() => "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8"),
    encode: vi.fn(() => "0x"),
  },
}));

import { useFacilitator } from "x402/verify";
import { exact } from "x402/schemes";
import {
  findMatchingRoute,
  processPriceToAtomicAmount,
  findMatchingPaymentRequirements,
} from "x402/shared";
import { settleResponseHeader } from "x402/types";

// Mock Hono Context
function createMockContext(path: string, method: string, headers: Record<string, string> = {}) {
  const context: any = {
    req: {
      path,
      method,
      url: `http://localhost${path}`,
      header: (name: string) => headers[name.toLowerCase()],
    },
    res: undefined,
    json: vi.fn((data, status) => {
      context.res = { status, data };
      return context.res;
    }),
    set: vi.fn(),
    get: vi.fn((key) => context._vars?.[key]),
    _vars: {},
  };

  context.set.mockImplementation((key: string, value: any) => {
    if (!context._vars) context._vars = {};
    context._vars[key] = value;
  });

  return context;
}

describe("paymentMiddleware", () => {
  const payTo = "0x1234567890123456789012345678901234567890";
  const mockConfig = {
    url: "https://facilitator.example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(processPriceToAtomicAmount).mockReturnValue({
      maxAmountRequired: "100000",
      asset: {
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        decimals: 6,
        eip712: {
          name: "USDC",
          version: "2",
        },
      },
    });
  });

  describe("middleware initialization", () => {
    it("should initialize with single route config", () => {
      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe("function");
    });

    it("should initialize with multiple routes", () => {
      const middleware = paymentMiddleware(
        payTo,
        {
          "/api/basic": {
            price: "$0.01",
            network: "base-sepolia",
          },
          "POST /api/premium": {
            price: "$1.00",
            network: ["base-sepolia", "x-layer-testnet"],
          },
        },
        mockConfig,
      );

      expect(middleware).toBeDefined();
    });
  });

  describe("402 response generation", () => {
    it("should return 402 when no payment header is present", async () => {
      vi.mocked(findMatchingRoute).mockReturnValue({
        verb: "POST",
        pattern: /^\/api\/test$/,
        config: { price: "$0.01", network: "base-sepolia" },
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      const mockCtx = createMockContext("/api/test", "POST");
      const mockNext = vi.fn();

      await middleware(mockCtx, mockNext);

      expect(mockCtx.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          accepts: expect.any(Array),
          x402Version: 1,
        }),
        402,
      );
    });

    it("should return PaymentRequirements with settlement extra", async () => {
      vi.mocked(findMatchingRoute).mockReturnValue({
        verb: "POST",
        pattern: /^\/api\/test$/,
        config: { price: "$0.01", network: "base-sepolia" },
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      const mockCtx = createMockContext("/api/test", "POST");
      const mockNext = vi.fn();

      await middleware(mockCtx, mockNext);

      const response = mockCtx.res;
      expect(response.data.accepts).toBeDefined();
      expect(response.data.accepts[0].extra).toMatchObject({
        settlementRouter: expect.any(String),
        hook: expect.any(String),
        hookData: expect.any(String),
      });
    });
  });

  describe("payment verification", () => {
    const mockPaymentPayload = {
      scheme: "exact" as const,
      network: "base-sepolia" as const,
      x402Version: 1,
      payload: {
        signature: "0x1234",
        authorization: {
          from: "0x3234567890123456789012345678901234567890",
          to: "0x32431D4511e061F1133520461B07eC42afF157D6",
          value: "100000",
          validAfter: "0",
          validBefore: "1234567890",
          nonce: "0x" + "0".repeat(64),
        },
      },
    };

    beforeEach(() => {
      vi.mocked(findMatchingRoute).mockReturnValue({
        verb: "POST",
        pattern: /^\/api\/test$/,
        config: { price: "$0.01", network: "base-sepolia" },
      });

      vi.mocked(exact.evm.decodePayment).mockReturnValue(mockPaymentPayload);

      vi.mocked(findMatchingPaymentRequirements).mockReturnValue({
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "100000",
        resource: "/api/test",
        description: "Test",
        mimeType: "application/json",
        payTo: "0x32431D4511e061F1133520461B07eC42afF157D6",
        maxTimeoutSeconds: 300,
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        extra: {
          settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
          hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
          hookData: "0x",
        },
      });
    });

    it("should verify payment and proceed if valid", async () => {
      const mockVerify = vi.fn().mockResolvedValue({
        isValid: true,
        payer: "0x3234567890123456789012345678901234567890",
      });
      const mockSettle = vi.fn().mockResolvedValue({
        success: true,
        transaction: "0xabcd",
        network: "base-sepolia",
        payer: "0x3234567890123456789012345678901234567890",
      });

      vi.mocked(useFacilitator).mockReturnValue({
        verify: mockVerify,
        settle: mockSettle,
        supported: vi.fn(),
        list: vi.fn(),
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      const mockCtx = createMockContext("/api/test", "POST", { "x-payment": "encoded-payment" });
      mockCtx.res = { status: 200, headers: new Map() };
      const mockNext = vi.fn();

      await middleware(mockCtx, mockNext);

      expect(mockVerify).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it("should return 402 if payment verification fails", async () => {
      const mockVerify = vi.fn().mockResolvedValue({
        isValid: false,
        invalidReason: "invalid_signature",
      });

      vi.mocked(useFacilitator).mockReturnValue({
        verify: mockVerify,
        settle: vi.fn(),
        supported: vi.fn(),
        list: vi.fn(),
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      const mockCtx = createMockContext("/api/test", "POST", { "x-payment": "encoded-payment" });
      const mockNext = vi.fn();

      await middleware(mockCtx, mockNext);

      expect(mockCtx.res.status).toBe(402);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should set X402Context on context after verification", async () => {
      const mockVerify = vi.fn().mockResolvedValue({
        isValid: true,
        payer: "0x3234567890123456789012345678901234567890",
      });
      const mockSettle = vi.fn().mockResolvedValue({
        success: true,
        transaction: "0xabcd",
        network: "base-sepolia",
        payer: "0x3234567890123456789012345678901234567890",
      });

      vi.mocked(useFacilitator).mockReturnValue({
        verify: mockVerify,
        settle: mockSettle,
        supported: vi.fn(),
        list: vi.fn(),
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      const mockCtx = createMockContext("/api/test", "POST", { "x-payment": "encoded-payment" });
      mockCtx.res = { status: 200, headers: new Map() };
      const mockNext = vi.fn();

      await middleware(mockCtx, mockNext);

      expect(mockCtx.set).toHaveBeenCalledWith(
        "x402",
        expect.objectContaining({
          payer: "0x3234567890123456789012345678901234567890",
          amount: "100000",
          network: "base-sepolia",
        }),
      );
    });
  });

  describe("settlement handling", () => {
    const mockPaymentPayload = {
      scheme: "exact" as const,
      network: "base-sepolia" as const,
      x402Version: 1,
      payload: {
        signature: "0x1234",
        authorization: {
          from: "0x3234567890123456789012345678901234567890",
          to: "0x32431D4511e061F1133520461B07eC42afF157D6",
          value: "100000",
          validAfter: "0",
          validBefore: "1234567890",
          nonce: "0x" + "0".repeat(64),
        },
      },
    };

    beforeEach(() => {
      vi.mocked(findMatchingRoute).mockReturnValue({
        verb: "POST",
        pattern: /^\/api\/test$/,
        config: { price: "$0.01", network: "base-sepolia" },
      });

      vi.mocked(exact.evm.decodePayment).mockReturnValue(mockPaymentPayload);

      vi.mocked(findMatchingPaymentRequirements).mockReturnValue({
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "100000",
        resource: "/api/test",
        description: "Test",
        mimeType: "application/json",
        payTo: "0x32431D4511e061F1133520461B07eC42afF157D6",
        maxTimeoutSeconds: 300,
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        extra: {
          settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
          hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
          hookData: "0x",
        },
      });
    });

    it("should settle after successful verification", async () => {
      const mockVerify = vi.fn().mockResolvedValue({
        isValid: true,
        payer: "0x3234567890123456789012345678901234567890",
      });
      const mockSettle = vi.fn().mockResolvedValue({
        success: true,
        transaction: "0xabcd",
        network: "base-sepolia",
        payer: "0x3234567890123456789012345678901234567890",
      });

      vi.mocked(useFacilitator).mockReturnValue({
        verify: mockVerify,
        settle: mockSettle,
        supported: vi.fn(),
        list: vi.fn(),
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      const responseHeaders = new Map();
      const mockCtx = createMockContext("/api/test", "POST", { "x-payment": "encoded-payment" });
      mockCtx.res = {
        status: 200,
        headers: {
          set: (key: string, value: string) => responseHeaders.set(key, value),
        },
      };
      const mockNext = vi.fn();

      await middleware(mockCtx, mockNext);

      expect(mockSettle).toHaveBeenCalled();
      expect(responseHeaders.get("X-PAYMENT-RESPONSE")).toBeDefined();
    });

    it("should not settle if business logic returns >= 400", async () => {
      const mockVerify = vi.fn().mockResolvedValue({
        isValid: true,
        payer: "0x3234567890123456789012345678901234567890",
      });
      const mockSettle = vi.fn();

      vi.mocked(useFacilitator).mockReturnValue({
        verify: mockVerify,
        settle: mockSettle,
        supported: vi.fn(),
        list: vi.fn(),
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      const mockCtx = createMockContext("/api/test", "POST", { "x-payment": "encoded-payment" });
      mockCtx.res = { status: 400 };
      const mockNext = vi.fn();

      await middleware(mockCtx, mockNext);

      expect(mockSettle).not.toHaveBeenCalled();
    });
  });
});
