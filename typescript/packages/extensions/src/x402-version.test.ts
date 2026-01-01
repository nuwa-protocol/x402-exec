/**
 * Tests for x402 version validation (v2-only, v1 is deprecated)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import { x402ResourceServer } from "@x402/core/server";
import type { PaymentPayload, PaymentRequirements, x402Client } from "@x402/core/types";

import { registerSettlementHooks } from "./settlement-routes.js";

// Mock x402ResourceServer
vi.mock("@x402/core/server", () => ({
  x402ResourceServer: vi.fn(() => ({
    onBeforeVerify: vi.fn(),
    onBeforeSettle: vi.fn(),
    registerExtension: vi.fn(),
  })),
}));

describe("x402 version validation (v2-only)", () => {
  let mockServer: x402ResourceServer;
  let onBeforeVerifyCallback: Function | null;
  let onBeforeSettleCallback: Function | null;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock server with callback capture
    onBeforeVerifyCallback = null;
    onBeforeSettleCallback = null;

    mockServer = {
      onBeforeVerify: vi.fn((callback: Function) => {
        onBeforeVerifyCallback = callback;
        return mockServer;
      }),
      onBeforeSettle: vi.fn((callback: Function) => {
        onBeforeSettleCallback = callback;
        return mockServer;
      }),
      registerExtension: vi.fn(() => mockServer),
    } as unknown as x402ResourceServer;
  });

  describe("registerSettlementHooks - onBeforeVerify", () => {
    it("should allow x402Version=2", async () => {
      registerSettlementHooks(mockServer, {
        enableSaltExtraction: true,
      });

      expect(onBeforeVerifyCallback).not.toBeNull();

      const context = {
        paymentPayload: {
          x402Version: 2,
        } as PaymentPayload,
        requirements: {} as PaymentRequirements,
      };

      const result = await onBeforeVerifyCallback!(context);
      expect(result).toBeUndefined(); // Should not abort
    });

    it("should reject missing x402Version", async () => {
      registerSettlementHooks(mockServer, {
        enableSaltExtraction: true,
      });

      const context = {
        paymentPayload: {} as PaymentPayload,
        requirements: {} as PaymentRequirements,
      };

      await expect(onBeforeVerifyCallback!(context)).rejects.toThrow(
        "x402Version is required and must be 2. v1 is deprecated - please use x402Version=2",
      );
    });

    it("should reject x402Version=1", async () => {
      registerSettlementHooks(mockServer, {
        enableSaltExtraction: true,
      });

      const context = {
        paymentPayload: {
          x402Version: 1,
        } as PaymentPayload,
        requirements: {} as PaymentRequirements,
      };

      await expect(onBeforeVerifyCallback!(context)).rejects.toThrow(
        "x402Version 1 is deprecated",
      );
    });

    it("should reject x402Version=3", async () => {
      registerSettlementHooks(mockServer, {
        enableSaltExtraction: true,
      });

      const context = {
        paymentPayload: {
          x402Version: 3,
        } as PaymentPayload,
        requirements: {} as PaymentRequirements,
      };

      await expect(onBeforeVerifyCallback!(context)).rejects.toThrow(
        "Version not supported: x402Version 3 is not supported",
      );
    });

    it("should reject non-number x402Version", async () => {
      registerSettlementHooks(mockServer, {
        enableSaltExtraction: true,
      });

      const context = {
        paymentPayload: {
          x402Version: "2" as unknown as number,
        } as PaymentPayload,
        requirements: {} as PaymentRequirements,
      };

      await expect(onBeforeVerifyCallback!(context)).rejects.toThrow(
        "Invalid x402Version: expected number, got string",
      );
    });

    it("should reject null x402Version", async () => {
      registerSettlementHooks(mockServer, {
        enableSaltExtraction: true,
      });

      const context = {
        paymentPayload: {
          x402Version: null as unknown as number,
        } as PaymentPayload,
        requirements: {} as PaymentRequirements,
      };

      await expect(onBeforeVerifyCallback!(context)).rejects.toThrow(
        "x402Version is required and must be 2. v1 is deprecated - please use x402Version=2",
      );
    });
  });

  describe("registerSettlementHooks - onBeforeSettle", () => {
    it("should allow x402Version=2", async () => {
      registerSettlementHooks(mockServer, {
        validateSettlementParams: true,
      });

      expect(onBeforeSettleCallback).not.toBeNull();

      // Create minimal valid context
      const context = {
        paymentPayload: {
          x402Version: 2,
          extensions: {
            "x402x-router-settlement": {
              info: {
                settlementRouter: "0x1234567890123456789012345678901234567890",
                hook: "0x1234567890123456789012345678901234567890",
                hookData: "0x",
                finalPayTo: "0x1234567890123456789012345678901234567890",
              },
            },
          },
        } as PaymentPayload,
        requirements: {} as PaymentRequirements,
      };

      const result = await onBeforeSettleCallback!(context);
      expect(result).toBeUndefined(); // Should not abort
    });

    it("should reject missing x402Version in onBeforeSettle", async () => {
      registerSettlementHooks(mockServer, {
        validateSettlementParams: true,
      });

      const context = {
        paymentPayload: {} as PaymentPayload,
        requirements: {} as PaymentRequirements,
      };

      await expect(onBeforeSettleCallback!(context)).rejects.toThrow(
        "x402Version is required and must be 2. v1 is deprecated - please use x402Version=2",
      );
    });

    it("should reject x402Version=1 in onBeforeSettle", async () => {
      registerSettlementHooks(mockServer, {
        validateSettlementParams: true,
      });

      const context = {
        paymentPayload: {
          x402Version: 1,
        } as PaymentPayload,
        requirements: {} as PaymentRequirements,
      };

      await expect(onBeforeSettleCallback!(context)).rejects.toThrow(
        "x402Version 1 is deprecated",
      );
    });
  });

  // Note: ExactEvmSchemeWithRouterSettlement version validation is already tested in
  // src/client/exact-evm-scheme.test.ts - no need to duplicate here
});
