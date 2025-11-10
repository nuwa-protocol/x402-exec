import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { paymentMiddleware } from "./index";
import type { X402Request } from "./index";

// Mock dependencies
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
  addSettlementExtra: vi.fn((requirements, params) => ({
    ...requirements,
    payTo: "0x32431D4511e061F1133520461B07eC42afF157D6",
    extra: {
      name: "USDC",
      version: "2",
      settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
      salt: "0x" + "1".repeat(64),
      payTo: params.payTo || requirements.payTo,
      facilitatorFee: params.facilitatorFee || "0",
      hook: params.hook,
      hookData: params.hookData,
    },
  })),
  getNetworkConfig: vi.fn(() => ({
    chainId: 84532,
    settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
    usdc: {
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      name: "USDC",
      version: "2",
    },
    hooks: {
      transfer: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
    },
  })),
  TransferHook: {
    getAddress: vi.fn(() => "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8"),
    encode: vi.fn(() => "0x"),
  },
  calculateFacilitatorFee: vi.fn(() =>
    Promise.resolve({
      network: "base-sepolia",
      hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
      hookData: "0x",
      hookAllowed: true,
      facilitatorFee: "10000", // 0.01 USDC in atomic units
      facilitatorFeeUSD: "0.010000",
      calculatedAt: new Date().toISOString(),
      validitySeconds: 60,
      token: {
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        symbol: "USDC",
        decimals: 6,
      },
    }),
  ),
}));

import { useFacilitator } from "x402/verify";
import { exact } from "x402/schemes";
import {
  findMatchingRoute,
  processPriceToAtomicAmount,
  findMatchingPaymentRequirements,
} from "x402/shared";
import { settleResponseHeader } from "x402/types";

describe("paymentMiddleware", () => {
  let mockReq: Partial<X402Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockVerify: ReturnType<typeof vi.fn>;
  let mockSettle: ReturnType<typeof vi.fn>;

  const payTo = "0x1234567890123456789012345678901234567890";
  const mockConfig = {
    url: "https://facilitator.example.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      path: "/api/test",
      method: "POST",
      headers: {},
      originalUrl: "/api/test",
    } as X402Request;

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      setHeader: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
      headersSent: false,
      statusCode: 200,
    } as Partial<Response>;

    // Mock next to call callback immediately
    mockNext = vi.fn((callback?: (err?: any) => void) => {
      if (callback) {
        callback();
      }
    }) as NextFunction;
    mockVerify = vi.fn();
    mockSettle = vi.fn();

    vi.mocked(useFacilitator).mockReturnValue({
      verify: mockVerify,
      settle: mockSettle,
      supported: vi.fn(),
      list: vi.fn(),
    });

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

  afterEach(() => {
    vi.restoreAllMocks();
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

    it("should initialize with multiple route config", () => {
      const middleware = paymentMiddleware(
        payTo,
        {
          "/api/basic": {
            price: "$0.01",
            network: "base-sepolia",
          },
          "/api/premium": {
            price: "$1.00",
            network: ["base-sepolia", "x-layer-testnet"],
          },
        },
        mockConfig,
      );

      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe("function");
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

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(402);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          accepts: expect.any(Array),
          x402Version: 1,
        }),
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

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      const jsonCall = vi.mocked(mockRes.json).mock.calls[0][0];
      expect(jsonCall.accepts).toBeDefined();
      expect(jsonCall.accepts[0]).toMatchObject({
        scheme: "exact",
        network: "base-sepolia",
        payTo: "0x32431D4511e061F1133520461B07eC42afF157D6",
        extra: expect.objectContaining({
          settlementRouter: expect.any(String),
          hook: expect.any(String),
          hookData: expect.any(String),
        }),
      });
    });

    it("should handle multi-network configuration", async () => {
      vi.mocked(findMatchingRoute).mockReturnValue({
        verb: "POST",
        pattern: /^\/api\/test$/,
        config: {
          price: "$0.01",
          network: ["base-sepolia", "x-layer-testnet"],
        },
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: ["base-sepolia", "x-layer-testnet"],
        },
        mockConfig,
      );

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      const jsonCall = vi.mocked(mockRes.json).mock.calls[0][0];
      expect(jsonCall.accepts.length).toBeGreaterThanOrEqual(1);
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
      mockReq.headers = { "x-payment": "encoded-payment" };

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
          facilitatorFee: "10000",
          payTo: payTo,
          salt: "0x" + "1".repeat(64),
        },
      });
    });

    it("should verify payment and proceed if valid", async () => {
      // Setup mocks for payment verification flow
      mockReq.headers = { "x-payment": "mock-payment-header" };

      vi.mocked(findMatchingRoute).mockReturnValue({
        verb: "POST",
        pattern: /^\/api\/test$/,
        config: { price: "$0.01", network: "base-sepolia" },
      });

      vi.mocked(exact.evm.decodePayment).mockReturnValue({
        x402Version: 1,
        scheme: "exact",
        network: "base-sepolia",
        payload: {
          signature: "0xMockSignature",
          authorization: {
            from: "0x3234567890123456789012345678901234567890",
            to: "0x32431D4511e061F1133520461B07eC42afF157D6",
            value: "100000",
            validAfter: "1",
            validBefore: "1000",
            nonce: "0xMockNonce",
          },
        },
        paymentRequirements: {
          scheme: "exact",
          network: "base-sepolia",
          maxAmountRequired: "100000",
          resource: "/api/test",
          payTo: "0x32431D4511e061F1133520461B07eC42afF157D6",
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          extra: {
            settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
            salt: "0x" + "1".repeat(64),
            payTo: payTo,
            facilitatorFee: "0",
            hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
            hookData: "0x",
          },
        },
      });

      vi.mocked(findMatchingPaymentRequirements).mockReturnValue({
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "100000",
        resource: "/api/test",
        payTo: "0x32431D4511e061F1133520461B07eC42afF157D6",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      });

      mockVerify.mockResolvedValue({
        isValid: true,
        payer: "0x3234567890123456789012345678901234567890",
      });
      mockSettle.mockResolvedValue({
        success: true,
        transaction: "0xabcd",
        network: "base-sepolia",
        payer: "0x3234567890123456789012345678901234567890",
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockVerify).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it("should return 402 if payment verification fails", async () => {
      mockVerify.mockResolvedValue({
        isValid: false,
        invalidReason: "invalid_signature",
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(402);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should set X402Context on request after verification", async () => {
      // Setup mocks for payment verification flow
      mockReq.headers = { "x-payment": "mock-payment-header" };

      vi.mocked(findMatchingRoute).mockReturnValue({
        verb: "POST",
        pattern: /^\/api\/test$/,
        config: { price: "$0.01", network: "base-sepolia" },
      });

      vi.mocked(exact.evm.decodePayment).mockReturnValue({
        x402Version: 1,
        scheme: "exact",
        network: "base-sepolia",
        payload: {
          signature: "0xMockSignature",
          authorization: {
            from: "0x3234567890123456789012345678901234567890",
            to: "0x32431D4511e061F1133520461B07eC42afF157D6",
            value: "100000",
            validAfter: "1",
            validBefore: "1000",
            nonce: "0xMockNonce",
          },
        },
        paymentRequirements: {
          scheme: "exact",
          network: "base-sepolia",
          maxAmountRequired: "100000",
          resource: "/api/test",
          payTo: "0x32431D4511e061F1133520461B07eC42afF157D6",
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          extra: {
            settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
            salt: "0x" + "1".repeat(64),
            payTo: payTo,
            facilitatorFee: "0",
            hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
            hookData: "0x",
          },
        },
      });

      vi.mocked(findMatchingPaymentRequirements).mockReturnValue({
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "100000",
        resource: "/api/test",
        payTo: "0x32431D4511e061F1133520461B07eC42afF157D6",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        extra: {
          settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
          salt: "0x" + "1".repeat(64),
          payTo: payTo,
          facilitatorFee: "0",
          hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
          hookData: "0x",
        },
      });

      mockVerify.mockResolvedValue({
        isValid: true,
        payer: "0x3234567890123456789012345678901234567890",
      });
      mockSettle.mockResolvedValue({
        success: true,
        transaction: "0xabcd",
        network: "base-sepolia",
        payer: "0x3234567890123456789012345678901234567890",
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect((mockReq as X402Request).x402).toBeDefined();
      expect((mockReq as X402Request).x402?.payer).toBe(
        "0x3234567890123456789012345678901234567890",
      );
      expect((mockReq as X402Request).x402?.amount).toBe("100000");
      expect((mockReq as X402Request).x402?.network).toBe("base-sepolia");
      expect((mockReq as X402Request).x402?.settlement).toBeDefined();
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
      mockReq.headers = { "x-payment": "encoded-payment" };

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
          facilitatorFee: "10000",
          payTo: payTo,
          salt: "0x" + "1".repeat(64),
        },
      });

      mockVerify.mockResolvedValue({
        isValid: true,
        payer: "0x3234567890123456789012345678901234567890",
      });
    });

    it("should settle after successful verification", async () => {
      mockSettle.mockResolvedValue({
        success: true,
        transaction: "0xabcd",
        network: "base-sepolia",
        payer: "0x3234567890123456789012345678901234567890",
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSettle).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith("X-PAYMENT-RESPONSE", expect.any(String));
    });

    it("should return 402 if settlement fails", async () => {
      mockSettle.mockResolvedValue({
        success: false,
        errorReason: "insufficient_balance",
        transaction: "",
        network: "base-sepolia",
        payer: "0x3234567890123456789012345678901234567890",
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(402);
    });

    it("should not settle if business logic returns >= 400", async () => {
      mockSettle.mockResolvedValue({
        success: true,
        transaction: "0xabcd",
        network: "base-sepolia",
        payer: "0x3234567890123456789012345678901234567890",
      });

      mockRes.statusCode = 400;

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockSettle).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    beforeEach(() => {
      vi.mocked(findMatchingRoute).mockReturnValue({
        verb: "POST",
        pattern: /^\/api\/test$/,
        config: { price: "$0.01", network: "base-sepolia" },
      });
    });

    it("should handle invalid payment header format", async () => {
      mockReq.headers = { "x-payment": "invalid" };
      vi.mocked(exact.evm.decodePayment).mockImplementation(() => {
        throw new Error("Invalid payment format");
      });

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(402);
    });

    it("should handle missing matching requirements", async () => {
      mockReq.headers = { "x-payment": "encoded-payment" };
      vi.mocked(exact.evm.decodePayment).mockReturnValue({
        scheme: "exact",
        network: "base-sepolia",
        x402Version: 1,
        payload: {} as any,
      });
      vi.mocked(findMatchingPaymentRequirements).mockReturnValue(undefined);

      const middleware = paymentMiddleware(
        payTo,
        {
          price: "$0.01",
          network: "base-sepolia",
        },
        mockConfig,
      );

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(402);
    });
  });
});
