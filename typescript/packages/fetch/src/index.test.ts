import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { wrapFetchWithPayment } from "./index";

// Mock dependencies
vi.mock("@x402x/core", () => ({
  calculateCommitment: vi.fn(() => "0x" + "c".repeat(64)),
  getNetworkConfig: vi.fn((network: string) => {
    if (network === "base-sepolia") {
      return {
        chainId: 84532,
        settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
        usdc: {
          address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          name: "USDC",
          version: "2",
        },
      };
    }
    throw new Error(`Unsupported network: ${network}`);
  }),
}));

vi.mock("x402/client", () => ({
  createPaymentHeader: vi.fn(() => Promise.resolve("standard-payment-header")),
  selectPaymentRequirements: vi.fn((accepts) => accepts[0]),
}));

vi.mock("x402/types", async () => {
  const actual = await vi.importActual<typeof import("x402/types")>("x402/types");
  return {
    ...actual,
    ChainIdToNetwork: {
      84532: "base-sepolia",
      1952: "x-layer-testnet",
    },
    isMultiNetworkSigner: vi.fn(() => false),
    isSvmSignerWallet: vi.fn(() => false),
    evm: {
      isSignerWallet: vi.fn(() => true),
      EvmSigner: {},
    },
  };
});

import { calculateCommitment } from "@x402x/core";
import { createPaymentHeader, selectPaymentRequirements } from "x402/client";

describe("wrapFetchWithPayment", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockWalletClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetch = vi.fn();

    mockWalletClient = {
      account: {
        address: "0x3234567890123456789012345678901234567890",
      },
      chain: {
        id: 84532,
      },
      signTypedData: vi.fn(() => Promise.resolve("0x" + "1".repeat(130))),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("non-402 responses", () => {
    it("should return response directly for 200 status", async () => {
      const mockResponse = new Response("success", { status: 200 });
      mockFetch.mockResolvedValue(mockResponse);

      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient);
      const result = await fetchWithPay("/api/test", {});

      expect(result.status).toBe(200);
      expect(await result.text()).toBe("success");
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should return response directly for 404 status", async () => {
      const mockResponse = new Response("not found", { status: 404 });
      mockFetch.mockResolvedValue(mockResponse);

      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient);
      const result = await fetchWithPay("/api/test", {});

      expect(result.status).toBe(404);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should return response directly for 500 status", async () => {
      const mockResponse = new Response("error", { status: 500 });
      mockFetch.mockResolvedValue(mockResponse);

      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient);
      const result = await fetchWithPay("/api/test", {});

      expect(result.status).toBe(500);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("402 response handling", () => {
    const mock402Response = {
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "base-sepolia",
          maxAmountRequired: "100000",
          resource: "/api/test",
          description: "Test",
          mimeType: "application/json",
          payTo: "0x32431D4511e061F1133520461B07eC42afF157D6",
          maxTimeoutSeconds: 300,
          asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        },
      ],
    };

    it("should handle 402 response and retry with payment header", async () => {
      const first402Response = new Response(JSON.stringify(mock402Response), {
        status: 402,
      });
      const secondSuccessResponse = new Response("success", { status: 200 });

      mockFetch
        .mockResolvedValueOnce(first402Response)
        .mockResolvedValueOnce(secondSuccessResponse);

      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient);
      const result = await fetchWithPay("/api/test", {});

      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        "/api/test",
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-PAYMENT": expect.any(String),
          }),
        }),
      );
    });

    it("should throw error when no payment requirements provided", async () => {
      const invalid402Response = new Response(JSON.stringify({ x402Version: 1, accepts: [] }), {
        status: 402,
      });

      mockFetch.mockResolvedValue(invalid402Response);

      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient);

      await expect(fetchWithPay("/api/test", {})).rejects.toThrow(
        "No payment requirements provided",
      );
    });

    it("should validate payment amount against maxValue", async () => {
      const highPrice402Response = new Response(
        JSON.stringify({
          ...mock402Response,
          accepts: [
            {
              ...mock402Response.accepts[0],
              maxAmountRequired: "1000000", // 1 USDC
            },
          ],
        }),
        { status: 402 },
      );

      mockFetch.mockResolvedValue(highPrice402Response);

      const maxValue = BigInt(0.1 * 10 ** 6); // 0.1 USDC
      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient, maxValue);

      await expect(fetchWithPay("/api/test", {})).rejects.toThrow(
        "Payment amount exceeds maximum allowed",
      );
    });

    it("should allow payment within maxValue", async () => {
      const affordable402Response = new Response(JSON.stringify(mock402Response), {
        status: 402,
      });
      const successResponse = new Response("success", { status: 200 });

      mockFetch.mockResolvedValueOnce(affordable402Response).mockResolvedValueOnce(successResponse);

      const maxValue = BigInt(1 * 10 ** 6); // 1 USDC
      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient, maxValue);
      const result = await fetchWithPay("/api/test", {});

      expect(result.status).toBe(200);
    });
  });

  describe("settlement mode detection", () => {
    it("should use settlement mode for requirements with settlementRouter", async () => {
      const settlement402Response = {
        x402Version: 1,
        accepts: [
          {
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
              salt: "0x" + "1".repeat(64),
              payTo: "0x1234567890123456789012345678901234567890",
              facilitatorFee: "10000",
              hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
              hookData: "0x",
              name: "USDC",
              version: "2",
            },
          },
        ],
      };

      const first402Response = new Response(JSON.stringify(settlement402Response), {
        status: 402,
      });
      const successResponse = new Response("success", { status: 200 });

      mockFetch.mockResolvedValueOnce(first402Response).mockResolvedValueOnce(successResponse);

      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient);
      await fetchWithPay("/api/test", {});

      // Should use settlement mode (commitment-based nonce)
      expect(calculateCommitment).toHaveBeenCalled();
      expect(mockWalletClient.signTypedData).toHaveBeenCalled();
    });

    it("should use standard mode for requirements without settlementRouter", async () => {
      const standard402Response = {
        x402Version: 1,
        accepts: [
          {
            scheme: "exact",
            network: "base-sepolia",
            maxAmountRequired: "100000",
            resource: "/api/test",
            description: "Test",
            mimeType: "application/json",
            payTo: "0x1234567890123456789012345678901234567890",
            maxTimeoutSeconds: 300,
            asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          },
        ],
      };

      const first402Response = new Response(JSON.stringify(standard402Response), {
        status: 402,
      });
      const successResponse = new Response("success", { status: 200 });

      mockFetch.mockResolvedValueOnce(first402Response).mockResolvedValueOnce(successResponse);

      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient);
      await fetchWithPay("/api/test", {});

      // Should use standard x402 mode
      expect(createPaymentHeader).toHaveBeenCalled();
    });
  });

  describe("EIP-712 signature", () => {
    it("should sign with correct EIP-712 parameters for settlement mode", async () => {
      const settlement402Response = {
        x402Version: 1,
        accepts: [
          {
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
              salt: "0x" + "1".repeat(64),
              payTo: "0x1234567890123456789012345678901234567890",
              facilitatorFee: "10000",
              hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
              hookData: "0x",
              name: "USDC",
              version: "2",
            },
          },
        ],
      };

      const first402Response = new Response(JSON.stringify(settlement402Response), {
        status: 402,
      });
      const successResponse = new Response("success", { status: 200 });

      mockFetch.mockResolvedValueOnce(first402Response).mockResolvedValueOnce(successResponse);

      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient);
      await fetchWithPay("/api/test", {});

      expect(mockWalletClient.signTypedData).toHaveBeenCalledWith(
        expect.objectContaining({
          types: expect.objectContaining({
            TransferWithAuthorization: expect.any(Array),
          }),
          domain: expect.objectContaining({
            name: "USDC",
            version: "2",
            chainId: 84532,
            verifyingContract: expect.any(String),
          }),
          primaryType: "TransferWithAuthorization",
          message: expect.objectContaining({
            from: expect.any(String),
            to: expect.any(String),
            value: expect.any(String),
            validAfter: expect.any(String),
            validBefore: expect.any(String),
            nonce: expect.any(String),
          }),
        }),
      );
    });

    it("should use commitment as nonce in settlement mode", async () => {
      const settlement402Response = {
        x402Version: 1,
        accepts: [
          {
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
              salt: "0x" + "1".repeat(64),
              payTo: "0x1234567890123456789012345678901234567890",
              facilitatorFee: "10000",
              hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
              hookData: "0x",
              name: "USDC",
              version: "2",
            },
          },
        ],
      };

      const first402Response = new Response(JSON.stringify(settlement402Response), {
        status: 402,
      });
      const successResponse = new Response("success", { status: 200 });

      mockFetch.mockResolvedValueOnce(first402Response).mockResolvedValueOnce(successResponse);

      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient);
      await fetchWithPay("/api/test", {});

      // Verify commitment was calculated
      expect(calculateCommitment).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 84532,
          hub: "0x32431D4511e061F1133520461B07eC42afF157D6",
          token: expect.any(String),
          from: expect.any(String),
          value: expect.any(String),
          validAfter: expect.any(String),
          validBefore: expect.any(String),
          salt: "0x" + "1".repeat(64),
          payTo: "0x1234567890123456789012345678901234567890",
          facilitatorFee: "10000",
          hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
          hookData: "0x",
        }),
      );

      // Verify nonce in signature matches commitment
      const signCall = mockWalletClient.signTypedData.mock.calls[0][0];
      expect(signCall.message.nonce).toMatch(/^0x[0-9a-fA-F]{64}$/);
    });
  });

  describe("retry protection", () => {
    it("should throw error on payment retry attempt", async () => {
      const settlement402Response = {
        x402Version: 1,
        accepts: [
          {
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
              salt: "0x" + "1".repeat(64),
              payTo: "0x1234567890123456789012345678901234567890",
              facilitatorFee: "10000",
              hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
              hookData: "0x",
              name: "USDC",
              version: "2",
            },
          },
        ],
      };

      // Return 402 response
      const first402Response = new Response(JSON.stringify(settlement402Response), {
        status: 402,
      });

      mockFetch.mockResolvedValueOnce(first402Response);

      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient);

      // Pass in the __is402Retry flag to simulate a retry attempt
      await expect(
        fetchWithPay("/api/test", { __is402Retry: true } as RequestInit),
      ).rejects.toThrow("Payment already attempted");
    });

    it("should throw error when init config is missing", async () => {
      const settlement402Response = {
        x402Version: 1,
        accepts: [
          {
            scheme: "exact",
            network: "base-sepolia",
            maxAmountRequired: "100000",
            resource: "/api/test",
            description: "Test",
            mimeType: "application/json",
            payTo: "0x32431D4511e061F1133520461B07eC42afF157D6",
            maxTimeoutSeconds: 300,
            asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          },
        ],
      };

      const first402Response = new Response(JSON.stringify(settlement402Response), {
        status: 402,
      });

      mockFetch.mockResolvedValue(first402Response);

      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient);

      // Call without init parameter
      await expect(fetchWithPay("/api/test")).rejects.toThrow(
        "Missing fetch request configuration",
      );
    });
  });

  describe("payment header encoding", () => {
    it("should include paymentRequirements in encoded header", async () => {
      const settlement402Response = {
        x402Version: 1,
        accepts: [
          {
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
              salt: "0x" + "1".repeat(64),
              payTo: "0x1234567890123456789012345678901234567890",
              facilitatorFee: "10000",
              hook: "0x6b486aF5A08D27153d0374BE56A1cB1676c460a8",
              hookData: "0x",
              name: "USDC",
              version: "2",
            },
          },
        ],
      };

      const first402Response = new Response(JSON.stringify(settlement402Response), {
        status: 402,
      });
      const successResponse = new Response("success", { status: 200 });

      mockFetch.mockResolvedValueOnce(first402Response).mockResolvedValueOnce(successResponse);

      const fetchWithPay = wrapFetchWithPayment(mockFetch, mockWalletClient);
      await fetchWithPay("/api/test", {});

      const secondCall = mockFetch.mock.calls[1][1];
      const paymentHeader = secondCall.headers["X-PAYMENT"];

      expect(paymentHeader).toBeDefined();
      expect(typeof paymentHeader).toBe("string");

      // Decode base64url to verify structure
      const decoded = JSON.parse(atob(paymentHeader.replace(/-/g, "+").replace(/_/g, "/")));
      expect(decoded).toHaveProperty("paymentRequirements");
      expect(decoded).toHaveProperty("payload");
      expect(decoded).toHaveProperty("scheme");
      expect(decoded).toHaveProperty("network");
    });
  });
});
