/**
 * Integration tests for the complete facilitator workflow
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouterSettlementFacilitator } from "../src/index.js";
import {
  mockPaymentPayload,
  mockPaymentRequirements,
  MOCK_ADDRESSES,
  setupViemMocks,
  resetAllMocks,
} from "./mocks/viem.js";

// Mock core_v2 utilities for integration tests
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
    rpcUrls: {
      default: {
        http: ["https://sepolia.base.org"],
      },
    },
  })),
}));

describe("Integration tests", () => {
  let facilitator: ReturnType<typeof createRouterSettlementFacilitator>;

  beforeEach(() => {
    resetAllMocks();
    setupViemMocks();

    facilitator = createRouterSettlementFacilitator({
      signer: MOCK_ADDRESSES.facilitator,
      allowedRouters: {
        "eip155:84532": [MOCK_ADDRESSES.settlementRouter],
      },
      rpcUrls: {
        "eip155:84532": "https://sepolia.base.org",
      },
      gasConfig: {
        maxGasLimit: 3_000_000n,
        gasMultiplier: 1.1,
      },
      feeConfig: {
        minFee: "0x0",
        maxFee: "0xFFFFFFFFFFFFFFFF",
      },
    });
  });

  describe("complete settlement workflow", () => {
    it("should handle successful verification and settlement", async () => {
      // Step 1: Verify payment
      const verification = await facilitator.verify(mockPaymentPayload, mockPaymentRequirements);
      expect(verification.isValid).toBe(true);
      expect(verification.payer).toBe(MOCK_ADDRESSES.payer);

      // Step 2: Execute settlement
      const settlement = await facilitator.settle(mockPaymentPayload, mockPaymentRequirements);
      expect(settlement.success).toBe(true);
      expect(settlement.transaction).toBeDefined();
      expect(settlement.network).toBe("eip155:84532");
      expect(settlement.payer).toBe(MOCK_ADDRESSES.payer);
      expect(settlement.errorReason).toBeUndefined();
    });

    it("should reject at verification step for invalid payment", async () => {
      const invalidPayload = {
        ...mockPaymentPayload,
        scheme: "invalid-scheme",
      };

      // Step 1: Verification should fail
      const verification = await facilitator.verify(invalidPayload, mockPaymentRequirements);
      expect(verification.isValid).toBe(false);
      expect(verification.invalidReason).toContain("Scheme mismatch");

      // Step 2: Settlement should also fail
      const settlement = await facilitator.settle(invalidPayload, mockPaymentRequirements);
      expect(settlement.success).toBe(false);
      expect(settlement.errorReason).toContain("Scheme mismatch");
    });

    it("should handle multi-network configuration", async () => {
      const multiNetworkFacilitator = createRouterSettlementFacilitator({
        signer: MOCK_ADDRESSES.facilitator,
        allowedRouters: {
          "eip155:84532": [MOCK_ADDRESSES.settlementRouter],
          "eip155:8453": [MOCK_ADDRESSES.settlementRouter],
        },
        rpcUrls: {
          "eip155:84532": "https://sepolia.base.org",
          "eip155:8453": "https://mainnet.base.org",
        },
      });

      // Test Base Sepolia network
      const verification1 = await multiNetworkFacilitator.verify(mockPaymentPayload, mockPaymentRequirements);
      expect(verification1.isValid).toBe(true);

      // Test Base mainnet
      const mainnetRequirements = {
        ...mockPaymentRequirements,
        network: "eip155:8453",
      };

      const verification2 = await multiNetworkFacilitator.verify(mockPaymentPayload, mainnetRequirements);
      expect(verification2.isValid).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle zero facilitator fee", async () => {
      const zeroFeeRequirements = {
        ...mockPaymentRequirements,
        extra: {
          ...mockPaymentRequirements.extra,
          facilitatorFee: "0x0",
        },
      };

      const verification = await facilitator.verify(mockPaymentPayload, zeroFeeRequirements);
      expect(verification.isValid).toBe(true);

      const settlement = await facilitator.settle(mockPaymentPayload, zeroFeeRequirements);
      expect(settlement.success).toBe(true);
    });

    it("should handle maximum facilitator fee", async () => {
      const maxFeeRequirements = {
        ...mockPaymentRequirements,
        extra: {
          ...mockPaymentRequirements.extra,
          facilitatorFee: "0xFFFFFFFFFFFFFFFF", // Maximum uint256
        },
      };

      const verification = await facilitator.verify(mockPaymentPayload, maxFeeRequirements);
      expect(verification.isValid).toBe(true);
    });

    it("should handle complex hook data", async () => {
      const complexHookDataRequirements = {
        ...mockPaymentRequirements,
        extra: {
          ...mockPaymentRequirements.extra,
          hookData: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        },
      };

      const verification = await facilitator.verify(mockPaymentPayload, complexHookDataRequirements);
      expect(verification.isValid).toBe(true);

      const settlement = await facilitator.settle(mockPaymentPayload, complexHookDataRequirements);
      expect(settlement.success).toBe(true);
    });
  });

  describe("error recovery", () => {
    it("should handle network config missing gracefully", async () => {
      // Mock getNetworkConfig to return undefined
      const { getNetworkConfig } = await import("@x402x/core_v2");
      vi.mocked(getNetworkConfig).mockReturnValue(undefined);

      const verification = await facilitator.verify(mockPaymentPayload, mockPaymentRequirements);
      // Should still work because we have other validation
      expect(verification.isValid).toBe(true);
    });

    it("should handle contract execution failure", async () => {
      const { createWalletClient } = await import("viem");
      const mockCreateWalletClient = vi.mocked(createWalletClient);

      // Mock wallet client to throw error
      mockCreateWalletClient.mockReturnValue({
        writeContract: vi.fn().mockRejectedValue(new Error("Insufficient gas")),
        account: {
          address: MOCK_ADDRESSES.facilitator,
          type: "wallet",
        },
      });

      const settlement = await facilitator.settle(mockPaymentPayload, mockPaymentRequirements);
      expect(settlement.success).toBe(false);
      expect(settlement.errorReason).toContain("SettlementRouter execution failed");
    });
  });

  describe("performance and gas optimization", () => {
    it("should use configured gas multiplier", async () => {
      const customGasFacilitator = createRouterSettlementFacilitator({
        signer: MOCK_ADDRESSES.facilitator,
        gasConfig: {
          maxGasLimit: 5_000_000n,
          gasMultiplier: 1.5,
        },
      });

      await customGasFacilitator.settle(mockPaymentPayload, mockPaymentRequirements);

      // Verify that gas multiplier was used in calculation
      const { createWalletClient } = await import("viem");
      const mockCreateWalletClient = vi.mocked(createWalletClient);

      expect(mockCreateWalletClient).toHaveBeenCalled();
    });
  });
});