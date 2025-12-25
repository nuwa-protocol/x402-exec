/**
 * Integration tests for the complete facilitator workflow
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createRouterSettlementFacilitator } from "../src/index.js";
import {
  mockPaymentPayload,
  mockPaymentRequirements,
  MOCK_ADDRESSES,
  MOCK_VALUES,
  setupViemMocks,
  resetAllMocks,
  mockPublicClient,
  mockWalletClient,
} from "./mocks/viem.js";

// Mock viem for signature verification at module level
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    verifyTypedData: vi.fn().mockResolvedValue(true), // Mock successful signature verification
    parseErc6492Signature: vi.fn((signature: string) => ({
      signature,
      address: "0x0000000000000000000000000000000000000000",
      data: "0x",
    })),
    createPublicClient: vi.fn(() => mockPublicClient),
    createWalletClient: vi.fn(() => mockWalletClient),
  };
});

// Mock core_v2 utilities for integration tests
vi.mock("@x402x/extensions", async () => {
  const actual = await vi.importActual("@x402x/extensions");
  return {
    ...actual,
    isSettlementMode: vi.fn((requirements) => !!requirements.extra?.settlementRouter),
    parseSettlementExtra: vi.fn((extra) => {
      if (!extra?.settlementRouter) {
        throw new Error("Missing settlementRouter");
      }
      return extra;
    }),
    toCanonicalNetworkKey: vi.fn((network) => {
      // For CAIP-2 format, return as-is; for v1 names, convert to CAIP-2
      if (network.startsWith("eip155:")) {
        return network;
      }
      // Convert common v1 names to CAIP-2
      const nameToId: Record<string, string> = {
        "base-sepolia": "eip155:84532",
        "base": "eip155:8453",
      };
      return nameToId[network] || network;
    }),
    getNetworkName: vi.fn((network) => {
      // Convert CAIP-2 to v1 name
      const idToName: Record<string, string> = {
        "eip155:84532": "base-sepolia",
        "eip155:8453": "base",
      };
      return idToName[network] || network;
    }),
    getNetworkConfig: vi.fn(() => ({
      chainId: 84532,
      name: "base-sepolia",
      type: "testnet" as const,
      addressExplorerBaseUrl: "https://sepolia.basescan.org/address/",
      txExplorerBaseUrl: "https://sepolia.basescan.org/tx/",
      settlementRouter: MOCK_ADDRESSES.settlementRouter,
      defaultAsset: {
        address: MOCK_ADDRESSES.token,
        decimals: 6,
        eip712: {
          name: "USD Coin",
          version: "3",
        },
      },
      hooks: {
        transfer: "0x0000000000000000000000000000000000000000",
        exchange: "0x0000000000000000000000000000000000000000",
      },
    })),
    calculateCommitment: vi.fn(
      () => "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
    ),
  };
});

describe("Integration tests", () => {
  let facilitator: ReturnType<typeof createRouterSettlementFacilitator>;

  beforeEach(() => {
    resetAllMocks();
    setupViemMocks();

    // Configure mocks for successful verification
    mockPublicClient.readContract.mockImplementation((params) => {
      // Handle different function calls
      if (params.functionName === "isSettled") {
        return Promise.resolve(false);
      }
      if (params.functionName === "balanceOf") {
        // Return very large balance to support maximum facilitator fee tests
        return Promise.resolve(
          BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
        );
      }
      // Default fallback
      return Promise.resolve(
        BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"),
      );
    });

    // Configure wallet client for successful settlement
    mockWalletClient.writeContract.mockResolvedValue(
      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`,
    );

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
      const invalidRequirements = {
        ...mockPaymentRequirements,
        scheme: "invalid-scheme",
      };

      // Step 1: Verification should fail
      const verification = await facilitator.verify(mockPaymentPayload, invalidRequirements);
      expect(verification.isValid).toBe(false);
      expect(verification.invalidReason).toContain("Scheme mismatch");

      // Step 2: Settlement should also fail
      const settlement = await facilitator.settle(mockPaymentPayload, invalidRequirements);
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
      const verification1 = await multiNetworkFacilitator.verify(
        mockPaymentPayload,
        mockPaymentRequirements,
      );
      expect(verification1.isValid).toBe(true);

      // Test Base mainnet
      const mainnetRequirements = {
        ...mockPaymentRequirements,
        network: "eip155:8453",
      };

      const verification2 = await multiNetworkFacilitator.verify(
        mockPaymentPayload,
        mainnetRequirements,
      );
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

      const verification = await facilitator.verify(
        mockPaymentPayload,
        complexHookDataRequirements,
      );
      expect(verification.isValid).toBe(true);

      const settlement = await facilitator.settle(mockPaymentPayload, complexHookDataRequirements);
      expect(settlement.success).toBe(true);
    });
  });

  describe("error recovery", () => {
    it("should handle network config missing gracefully", async () => {
      // Mock getNetworkConfig to return undefined
      const { getNetworkConfig } = await import("@x402x/extensions");
      vi.mocked(getNetworkConfig).mockReturnValue(undefined);

      const verification = await facilitator.verify(mockPaymentPayload, mockPaymentRequirements);
      // Should fail gracefully when network config is missing
      expect(verification.isValid).toBe(false);
      expect(verification.invalidReason).toBeDefined();
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
      // The error happens during verification due to wallet client issues,
      // so the error reason will be from verification, not settlement router execution
      expect(settlement.errorReason).toBeDefined();
    });
  });
});
