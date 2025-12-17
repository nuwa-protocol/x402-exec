/**
 * Tests for RouterSettlementFacilitator
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RouterSettlementFacilitator, createRouterSettlementFacilitator } from "../src/index.js";
import { FacilitatorValidationError } from "../src/types.js";
import {
  mockPaymentPayload,
  mockPaymentRequirements,
  MOCK_ADDRESSES,
  setupViemMocks,
  resetAllMocks,
} from "./mocks/viem.js";

// Mock core_v2 utilities
vi.mock("@x402x/core_v2", () => ({
  isSettlementMode: vi.fn((requirements) => !!requirements.extra?.settlementRouter),
  parseSettlementExtra: vi.fn((extra) => {
    if (!extra?.settlementRouter) {
      throw new Error("Missing settlementRouter");
    }
    return extra;
  }),
  getNetworkConfig: vi.fn(() => ({
    settlementRouter: MOCK_ADDRESSES.settlementRouter,
  })),
}));

describe("RouterSettlementFacilitator", () => {
  let facilitator: RouterSettlementFacilitator;

  beforeEach(() => {
    resetAllMocks();
    setupViemMocks();

    facilitator = createRouterSettlementFacilitator({
      signer: MOCK_ADDRESSES.facilitator,
      allowedRouters: {
        "eip155:84532": [MOCK_ADDRESSES.settlementRouter],
      },
    });
  });

  describe("constructor", () => {
    it("should create facilitator with valid config", () => {
      expect(facilitator).toBeDefined();
      expect(facilitator.scheme).toBe("exact");
      expect(facilitator.caipFamily).toBe("eip155:*");
    });

    it("should throw error for invalid signer", () => {
      expect(() => {
        createRouterSettlementFacilitator({
          signer: "invalid-address",
        });
      }).toThrow(FacilitatorValidationError);
    });

    it("should use default config values", () => {
      const defaultFacilitator = createRouterSettlementFacilitator({
        signer: MOCK_ADDRESSES.facilitator,
      });

      expect(defaultFacilitator).toBeDefined();
    });
  });

  describe("getExtra", () => {
    it("should return extra data for valid network", () => {
      const extra = facilitator.getExtra("eip155:84532");
      expect(extra).toBeDefined();
      expect(extra?.scheme).toBe("exact");
      expect(extra?.caipFamily).toBe("eip155:*");
    });

    it("should return undefined for invalid network", () => {
      const extra = facilitator.getExtra("invalid-network");
      expect(extra).toBeUndefined();
    });
  });

  describe("getSigners", () => {
    it("should return signer address", () => {
      const signers = facilitator.getSigners("eip155:84532");
      expect(signers).toEqual([MOCK_ADDRESSES.facilitator]);
    });
  });

  describe("verify - SettlementRouter mode", () => {
    it("should verify valid SettlementRouter payment", async () => {
      const result = await facilitator.verify(mockPaymentPayload, mockPaymentRequirements);

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(MOCK_ADDRESSES.payer);
    });

    it("should reject payment with invalid scheme", async () => {
      const invalidPayload = {
        ...mockPaymentPayload,
        scheme: "invalid",
      };

      const result = await facilitator.verify(invalidPayload, mockPaymentRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("Scheme mismatch");
      expect(result.payer).toBe(MOCK_ADDRESSES.payer);
    });

    it("should reject payment with missing payer", async () => {
      const invalidPayload = {
        ...mockPaymentPayload,
        payer: undefined,
      };

      const result = await facilitator.verify(invalidPayload, mockPaymentRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("Missing payer");
    });

    it("should reject payment with invalid network", async () => {
      const invalidRequirements = {
        ...mockPaymentRequirements,
        network: "invalid-network",
      };

      const result = await facilitator.verify(mockPaymentPayload, invalidRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("Invalid network");
    });

    it("should reject payment with missing settlement extra", async () => {
      const invalidRequirements = {
        ...mockPaymentRequirements,
        extra: {},
      };

      const result = await facilitator.verify(mockPaymentPayload, invalidRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("Missing settlementRouter");
    });

    it("should reject payment with invalid settlement router", async () => {
      const invalidRequirements = {
        ...mockPaymentRequirements,
        extra: {
          ...mockPaymentRequirements.extra,
          settlementRouter: "invalid-router",
        },
      };

      const result = await facilitator.verify(mockPaymentPayload, invalidRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("Invalid SettlementRouter address");
    });

    it("should reject payment with disallowed router", async () => {
      const strictFacilitator = createRouterSettlementFacilitator({
        signer: MOCK_ADDRESSES.facilitator,
        allowedRouters: {
          "eip155:84532": ["0xanother-router"],
        },
      });

      const result = await strictFacilitator.verify(mockPaymentPayload, mockPaymentRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("not allowed for network");
    });
  });

  describe("verify - Standard mode", () => {
    it("should verify valid standard payment", async () => {
      const standardRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        maxAmountRequired: "1000000",
        asset: MOCK_ADDRESSES.token,
        payTo: MOCK_ADDRESSES.merchant,
        // No extra field = standard mode
      };

      const result = await facilitator.verify(mockPaymentPayload, standardRequirements);

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(MOCK_ADDRESSES.payer);
    });
  });

  describe("settle - SettlementRouter mode", () => {
    it("should settle valid SettlementRouter payment", async () => {
      const result = await facilitator.settle(mockPaymentPayload, mockPaymentRequirements);

      expect(result.success).toBe(true);
      expect(result.transaction).toBe(mockSettleResponse.transaction);
      expect(result.network).toBe("eip155:84532");
      expect(result.payer).toBe(MOCK_ADDRESSES.payer);
    });

    it("should fail to settle invalid payment", async () => {
      const invalidPayload = {
        ...mockPaymentPayload,
        scheme: "invalid",
      };

      const result = await facilitator.settle(invalidPayload, mockPaymentRequirements);

      expect(result.success).toBe(false);
      expect(result.errorReason).toContain("Scheme mismatch");
      expect(result.payer).toBe(MOCK_ADDRESSES.payer);
    });

    it("should handle verification failure in settle", async () => {
      const invalidRequirements = {
        ...mockPaymentRequirements,
        extra: {}, // Invalid extra
      };

      const result = await facilitator.settle(mockPaymentPayload, invalidRequirements);

      expect(result.success).toBe(false);
      expect(result.errorReason).toBeDefined();
    });
  });

  describe("settle - Standard mode", () => {
    it("should fail to settle standard payment (not implemented)", async () => {
      const standardRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        maxAmountRequired: "1000000",
        asset: MOCK_ADDRESSES.token,
        payTo: MOCK_ADDRESSES.merchant,
        // No extra field = standard mode
      };

      const result = await facilitator.settle(mockPaymentPayload, standardRequirements);

      expect(result.success).toBe(false);
      expect(result.errorReason).toContain("Standard settlement mode not yet implemented");
    });
  });

  describe("error handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      // Mock a function to throw an error
      const mockIsSettlementMode = vi.fn(() => {
        throw new Error("Unexpected error");
      });

      vi.doMock("@x402x/core_v2", () => ({
        isSettlementMode: mockIsSettlementMode,
        parseSettlementExtra: vi.fn(),
        getNetworkConfig: vi.fn(),
      }));

      const result = await facilitator.verify(mockPaymentPayload, mockPaymentRequirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toContain("Verification failed");
    });
  });
});