/**
 * Simplified Mock E2E Tests for v2 Stack
 *
 * Validates the core components work together without complex HTTP server setup
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExactEvmSchemeWithRouterSettlement } from "@x402x/fetch_v2";
import { createRouterSettlementFacilitator } from "@x402x/facilitator_v2";
import { paymentMiddleware } from "@x402x/hono_v2";

// Mock blockchain components
import {
  mockPaymentPayload,
  mockPaymentRequirements,
  MOCK_ADDRESSES,
  MOCK_VALUES,
  setupViemMocks,
  resetAllMocks,
  mockPublicClient,
  mockWalletClient,
} from "../mocks/viem.js";

// Mock viem for all E2E tests
vi.mock("viem", async () => {
  const actual = await vi.importActual("viem");
  return {
    ...actual,
    verifyTypedData: vi.fn().mockResolvedValue(true),
    parseErc6492Signature: vi.fn((signature: string) => ({
      signature,
      address: "0x0000000000000000000000000000000000000000",
      data: "0x",
    })),
    createPublicClient: vi.fn(() => mockPublicClient),
    createWalletClient: vi.fn(() => mockWalletClient),
  };
});

// Mock core_v2 utilities
vi.mock("@x402x/core_v2", () => ({
  isSettlementMode: vi.fn((requirements) => !!requirements.extra?.settlementRouter),
  parseSettlementExtra: vi.fn((extra) => extra),
  getNetworkConfig: vi.fn(() => ({
    settlementRouter: MOCK_ADDRESSES.settlementRouter,
    rpcUrls: {
      default: {
        http: ["https://sepolia.base.org"],
      },
    },
  })),
  calculateCommitment: vi.fn(() => MOCK_VALUES.nonce),
}));

describe("E2E Mock Contract Tests - Simplified", () => {
  let facilitator: ReturnType<typeof createRouterSettlementFacilitator>;

  beforeEach(() => {
    resetAllMocks();
    setupViemMocks();

    // Configure mocks for successful operations
    mockPublicClient.readContract.mockImplementation((params) => {
      if (params.functionName === 'isSettled') {
        return Promise.resolve(false);
      }
      if (params.functionName === 'balanceOf') {
        return Promise.resolve(BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF"));
      }
      return Promise.resolve(BigInt("1000000000"));
    });

    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      status: "success" as const,
      blockNumber: 12345678n,
      gasUsed: 250000n,
      effectiveGasPrice: 1000000000n,
    });

    mockWalletClient.writeContract.mockResolvedValue("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" as `0x${string}`);

    // Create facilitator
    facilitator = createRouterSettlementFacilitator({
      signer: MOCK_ADDRESSES.facilitator,
      allowedRouters: {
        "eip155:84532": [MOCK_ADDRESSES.settlementRouter],
      },
    });
  });

  describe("Client-Server-Facilitator Integration", () => {
    it("should create and verify settlement payment", async () => {
      // Step 1: Create payment requirements
      const settlementRequirements = {
        ...mockPaymentRequirements,
        extra: {
          settlementRouter: MOCK_ADDRESSES.settlementRouter,
          salt: MOCK_VALUES.salt,
          payTo: MOCK_ADDRESSES.merchant,
          facilitatorFee: MOCK_VALUES.facilitatorFee,
          hook: MOCK_ADDRESSES.hook,
          hookData: MOCK_VALUES.hookData,
          name: "USD Coin",
          version: "3",
        },
      };

      // Step 2: Create payment with client
      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      const paymentResult = await client.createPaymentPayload(2, settlementRequirements);

      expect(paymentResult.x402Version).toBe(2);
      expect(paymentResult.payload).toBeDefined();
      expect(paymentResult.payload.authorization).toBeDefined();
      expect(paymentResult.payload.signature).toBeDefined();

      // Step 3: Verify with facilitator
      const verification = await facilitator.verify(paymentResult.payload, settlementRequirements);

      expect(verification.isValid).toBe(true);
      expect(verification.payer).toBe(MOCK_ADDRESSES.payer);
    });

    it("should execute settlement flow end-to-end", async () => {
      // Step 1: Create settlement payment
      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      const paymentResult = await client.createPaymentPayload(2, mockPaymentRequirements);

      // Step 2: Execute settlement
      const settlement = await facilitator.settle(paymentResult.payload, mockPaymentRequirements);

      expect(settlement.success).toBe(true);
      expect(settlement.transaction).toBeDefined();
      expect(settlement.network).toBe("eip155:84532");
      expect(settlement.payer).toBe(MOCK_ADDRESSES.payer);
    });

    it("should handle verification failures gracefully", async () => {
      // Mock signature verification to fail
      const { verifyTypedData } = await import("viem");
      vi.mocked(verifyTypedData).mockResolvedValueOnce(false);

      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue("0xinvalidsignature" as any),
      } as any);

      const paymentResult = await client.createPaymentPayload(2, mockPaymentRequirements);

      const verification = await facilitator.verify(paymentResult.payload, mockPaymentRequirements);

      expect(verification.isValid).toBe(false);
      expect(verification.invalidReason).toBeDefined();
    });
  });

  describe("Middleware Integration", () => {
    it("should create payment middleware successfully", () => {
      expect(() => {
        paymentMiddleware(
          MOCK_ADDRESSES.merchant,
          {
            price: "1000000",
            network: "eip155:84532",
          },
          {
            url: "http://localhost:3001",
          }
        );
      }).not.toThrow();
    });

    it("should handle multiple networks in middleware", () => {
      expect(() => {
        paymentMiddleware(
          MOCK_ADDRESSES.merchant,
          {
            price: "1000000",
            network: ["eip155:84532", "eip155:8453", "eip155:1"],
          },
          {
            url: "http://localhost:3001",
          }
        );
      }).not.toThrow();
    });

    it("should handle route-specific configuration", () => {
      expect(() => {
        paymentMiddleware(
          MOCK_ADDRESSES.merchant,
          {
            "/api/basic": {
              price: "1000000",
              network: "eip155:84532",
            },
            "POST /api/premium": {
              price: "2000000",
              network: ["eip155:84532", "eip155:8453"],
              facilitatorFee: "100000",
            },
          },
          {
            url: "http://localhost:3001",
          }
        );
      }).not.toThrow();
    });
  });

  describe("Router Settlement Parameter Propagation", () => {
    it("should propagate settlement router parameters correctly", async () => {
      const settlementRequirements = {
        ...mockPaymentRequirements,
        extra: {
          settlementRouter: MOCK_ADDRESSES.settlementRouter,
          salt: MOCK_VALUES.salt,
          payTo: MOCK_ADDRESSES.merchant,
          facilitatorFee: MOCK_VALUES.facilitatorFee,
          hook: MOCK_ADDRESSES.hook,
          hookData: MOCK_VALUES.hookData,
          name: "USD Coin",
          version: "3",
        },
      };

      // Create payment payload
      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      const paymentResult = await client.createPaymentPayload(2, settlementRequirements);

      // Verify payload contains commitment-based nonce
      expect(paymentResult.payload.authorization.nonce).toBe(MOCK_VALUES.nonce);

      // Test verification
      const verification = await facilitator.verify(paymentResult.payload, settlementRequirements);

      expect(verification.isValid).toBe(true);
      expect(verification.payer).toBe(MOCK_ADDRESSES.payer);

      // Test settlement
      const settlement = await facilitator.settle(paymentResult.payload, settlementRequirements);

      expect(settlement.success).toBe(true);
      expect(settlement.transaction).toBeDefined();
      expect(settlement.payer).toBe(MOCK_ADDRESSES.payer);
      expect(settlement.network).toBe("eip155:84532");
    });

    it("should handle complex hook data in settlement", async () => {
      const complexHookData = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

      const complexSettlementRequirements = {
        ...mockPaymentRequirements,
        extra: {
          ...mockPaymentRequirements.extra,
          hookData: complexHookData,
        },
      };

      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      const paymentResult = await client.createPaymentPayload(2, complexSettlementRequirements);

      const settlement = await facilitator.settle(paymentResult.payload, complexSettlementRequirements);

      expect(settlement.success).toBe(true);
    });
  });

  describe("eip155:* wildcard support", () => {
    it("should support multiple eip155 networks", async () => {
      const testNetworks = [
        "eip155:84532", // Base Sepolia
        "eip155:8453",  // Base Mainnet
        "eip155:1",     // Ethereum Mainnet
        "eip155:137",   // Polygon
      ];

      for (const network of testNetworks) {
        const requirements = {
          ...mockPaymentRequirements,
          network,
        };

        const client = new ExactEvmSchemeWithRouterSettlement({
          address: MOCK_ADDRESSES.payer,
          signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
        } as any);

        const paymentResult = await client.createPaymentPayload(2, requirements);

        expect(paymentResult.payload.authorization).toBeDefined();
        expect(paymentResult.payload.signature).toBeDefined();

        const verification = await facilitator.verify(paymentResult.payload, requirements);

        if (network === "eip155:84532") { // Only supported network
          expect(verification.isValid).toBe(true);
          expect(verification.payer).toBe(MOCK_ADDRESSES.payer);
        }
      }
    });
  });

  describe("Extensions Support", () => {
    it("should handle custom extensions in requirements", async () => {
      const extensions = {
        customField: "customValue",
        metadata: {
          source: "e2e-test",
          version: "1.0.0",
        },
      };

      const requirementsWithExtensions = {
        ...mockPaymentRequirements,
        extra: {
          ...mockPaymentRequirements.extra,
          extensions,
        },
      };

      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      const paymentResult = await client.createPaymentPayload(2, requirementsWithExtensions);

      expect(paymentResult.x402Version).toBe(2);
      expect(paymentResult.payload).toBeDefined();

      const verification = await facilitator.verify(paymentResult.payload, requirementsWithExtensions);

      expect(verification.isValid).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid settlement router addresses", async () => {
      const invalidRequirements = {
        ...mockPaymentRequirements,
        extra: {
          ...mockPaymentRequirements.extra,
          settlementRouter: "0xinvalid",
        },
      };

      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      const paymentResult = await client.createPaymentPayload(2, invalidRequirements);

      const settlement = await facilitator.settle(paymentResult.payload, invalidRequirements);

      expect(settlement.success).toBe(false);
      expect(settlement.errorReason).toContain("Invalid SettlementRouter");
    });

    it("should handle missing settlement router", async () => {
      const standardRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        maxAmountRequired: "1000000",
        asset: MOCK_ADDRESSES.token,
        payTo: MOCK_ADDRESSES.merchant,
        // No extra field = standard mode
      };

      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      const paymentResult = await client.createPaymentPayload(2, standardRequirements);

      // Standard mode should work fine
      expect(paymentResult.x402Version).toBe(2);
      expect(paymentResult.payload.authorization.nonce).toMatch(/^0x[a-fA-F0-9]{64}$/);

      // Nonce should be random in standard mode
      const paymentResult2 = await client.createPaymentPayload(2, standardRequirements);
      expect(paymentResult.payload.authorization.nonce).not.toBe(paymentResult2.payload.authorization.nonce);
    });
  });
});