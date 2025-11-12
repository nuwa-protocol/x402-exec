/**
 * Tests for settlement.ts
 *
 * Tests settlement logic wrapper
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isSettlementMode,
  validateSettlementRouter,
  settleWithRouter,
} from "../../src/settlement.js";
import {
  createMockPaymentRequirements,
  createMockSettlementRouterPaymentRequirements,
  createMockPaymentPayload,
} from "../utils/fixtures.js";
import { createMockEvmSigner } from "../mocks/signers.js";

// Mock viem
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    parseErc6492Signature: vi.fn((sig: string) => ({
      signature: sig,
      address: "0x0000000000000000000000000000000000000000",
      data: "0x",
    })),
  };
});

// Mock @x402x/core
vi.mock("@x402x/core", () => {
  class MockSettlementExtraError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "SettlementExtraError";
    }
  }

  return {
    isSettlementMode: vi.fn((pr) => !!pr.extra?.settlementRouter),
    SettlementExtraError: MockSettlementExtraError,
  };
});

describe("settlement", () => {
  describe("isSettlementMode", () => {
    it("should return true when settlementRouter is present", () => {
      const requirements = createMockSettlementRouterPaymentRequirements();

      expect(isSettlementMode(requirements)).toBe(true);
    });

    it("should return false when settlementRouter is absent", () => {
      const requirements = createMockPaymentRequirements();

      expect(isSettlementMode(requirements)).toBe(false);
    });

    it("should return false when extra is empty object", () => {
      const requirements = createMockPaymentRequirements({ extra: {} });

      expect(isSettlementMode(requirements)).toBe(false);
    });

    it("should return false when extra is undefined", () => {
      const requirements = createMockPaymentRequirements({ extra: undefined });

      expect(isSettlementMode(requirements)).toBe(false);
    });
  });

  describe("validateSettlementRouter", () => {
    const allowedRouters = {
      "base-sepolia": ["0x32431D4511e061F1133520461B07eC42afF157D6"],
      "x-layer-testnet": ["0x1ae0e196dc18355af3a19985faf67354213f833d"],
    };

    it("should pass validation for whitelisted router", () => {
      expect(() =>
        validateSettlementRouter(
          "base-sepolia",
          "0x32431D4511e061F1133520461B07eC42afF157D6",
          allowedRouters,
        ),
      ).not.toThrow();
    });

    it("should throw for non-whitelisted router", () => {
      expect(() =>
        validateSettlementRouter(
          "base-sepolia",
          "0x9999999999999999999999999999999999999999",
          allowedRouters,
        ),
      ).toThrow("not in whitelist");
    });

    it("should throw for unknown network", () => {
      expect(() =>
        validateSettlementRouter(
          "unknown-network",
          "0x32431D4511e061F1133520461B07eC42afF157D6",
          allowedRouters,
        ),
      ).toThrow("No allowed settlement routers configured");
    });

    it("should handle multiple routers in whitelist", () => {
      const multiRouters = {
        "base-sepolia": [
          "0x32431D4511e061F1133520461B07eC42afF157D6",
          "0x1111111111111111111111111111111111111111",
        ],
      };

      expect(() =>
        validateSettlementRouter(
          "base-sepolia",
          "0x1111111111111111111111111111111111111111",
          multiRouters,
        ),
      ).not.toThrow();
    });
  });

  describe("settleWithRouter", () => {
    let signer: ReturnType<typeof createMockEvmSigner>;
    let paymentPayload: ReturnType<typeof createMockPaymentPayload>;
    let paymentRequirements: ReturnType<typeof createMockSettlementRouterPaymentRequirements>;
    const allowedRouters = {
      "base-sepolia": ["0x32431D4511e061F1133520461B07eC42afF157D6"],
    };

    beforeEach(() => {
      vi.clearAllMocks();
      signer = createMockEvmSigner();
      paymentPayload = createMockPaymentPayload({
        signature:
          "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890",
      });
      paymentRequirements = createMockSettlementRouterPaymentRequirements();
    });

    it("should throw error for missing signature", async () => {
      const payloadWithoutSignature = {
        ...paymentPayload,
        signature: undefined,
      };

      const result = await settleWithRouter(
        signer,
        payloadWithoutSignature as any,
        paymentRequirements,
        allowedRouters,
      );

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("unexpected_settle_error");
    });

    it("should throw error for missing authorization", async () => {
      const payloadWithoutAuth = {
        ...paymentPayload,
        payload: {},
      };

      const result = await settleWithRouter(
        signer,
        payloadWithoutAuth as any,
        paymentRequirements,
        allowedRouters,
      );

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("unexpected_settle_error");
    });

    it("should successfully settle with router", async () => {
      // Skip: Requires actual contract interaction
      // This is covered by e2e tests
    });

    it("should throw for non-EVM signer", async () => {
      const svmSigner = {
        address: "11111111111111111111111111111111",
        publicKey: "11111111111111111111111111111111",
      } as any;

      const result = await settleWithRouter(
        svmSigner,
        paymentPayload,
        paymentRequirements,
        allowedRouters,
      );

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("unexpected_settle_error");
    });

    it("should return error response on settlement failure", async () => {
      // Mock walletClient.writeContract to throw
      signer.walletClient.writeContract = vi
        .fn()
        .mockRejectedValueOnce(new Error("Transaction failed"));

      const result = await settleWithRouter(
        signer,
        paymentPayload,
        paymentRequirements,
        allowedRouters,
      );

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("unexpected_settle_error");
    });

    it("should extract payer from payload on error", async () => {
      signer.walletClient.writeContract = vi.fn().mockRejectedValueOnce(new Error("Test error"));

      const result = await settleWithRouter(
        signer,
        paymentPayload,
        paymentRequirements,
        allowedRouters,
      );

      expect(result.success).toBe(false);
      expect(result.payer).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should handle missing payer gracefully", async () => {
      signer.walletClient.writeContract = vi.fn().mockRejectedValueOnce(new Error("Test error"));

      const invalidPayload = { ...paymentPayload, payload: {} };

      const result = await settleWithRouter(
        signer,
        invalidPayload as any,
        paymentRequirements,
        allowedRouters,
      );

      expect(result.success).toBe(false);
      expect(result.payer).toBe("");
    });
  });
});
