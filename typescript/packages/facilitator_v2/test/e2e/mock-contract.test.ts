/**
 * Mock End-to-End Contract Tests for v2 Stack
 *
 * Tests the complete payment flow from client -> server -> facilitator
 * using mocked HTTP servers and blockchain components.
 *
 * Validates:
 * - PAYMENT-* headers (PAYMENT-REQUIRED, PAYMENT-SIGNATURE, PAYMENT-RESPONSE)
 * - extensions echo behavior
 * - eip155:* wildcard path handling
 * - router settlement parameter propagation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createServer, type Server } from "http";
import { ExactEvmSchemeWithRouterSettlement } from "@x402x/fetch_v2";
import { paymentMiddleware } from "@x402x/hono_v2";
import { createRouterSettlementFacilitator } from "@x402x/facilitator_v2";
import { Hono } from "hono";
import fetch from "node-fetch";

// Add fetch global type for Node.js environment
declare global {
  var fetch: typeof import("node-fetch").default;
}

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

describe("E2E Mock Contract Tests", () => {
  let mockServer: Server;
  let facilitatorServer: Server;
  let serverUrl: string;
  let facilitatorUrl: string;
  let app: Hono;
  let facilitator: ReturnType<typeof createRouterSettlementFacilitator>;

  beforeEach(async () => {
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

    // Setup mock merchant server with Hono middleware
    app = new Hono();

    // Add X402 middleware for wildcard path
    app.use("/api/*", paymentMiddleware(
      MOCK_ADDRESSES.merchant, // Final recipient
      {
        price: "1000000", // 1 USDC in atomic units
        network: "eip155:84532",
      },
      {
        url: "http://localhost:3001",
      }
    ));

    // Add extensions echo endpoint
    app.post("/api/extensions-echo", async (c) => {
      const extensions = c.get("x402Extensions");
      return c.json({
        success: true,
        extensions: extensions || {},
        echoed: true,
      });
    });

    // Add protected endpoint that requires payment
    app.get("/api/protected", (c) => {
      const x402Context = c.get("x402");
      if (!x402Context) {
        return c.json({ error: "Payment required" }, 402);
      }

      return c.json({
        success: true,
        message: "Access granted",
        payer: x402Context.payer,
        network: x402Context.network,
        amount: x402Context.amount,
      });
    });

    // Add eip155 wildcard test endpoint
    app.get("/api/wildcard/:network/:path*", (c) => {
      const x402Context = c.get("x402");
      const network = c.req.param("network");
      const path = c.req.param("path");

      if (!x402Context) {
        return c.json({ error: "Payment required" }, 402);
      }

      return c.json({
        success: true,
        network: `eip155:${network}`,
        path,
        payer: x402Context.payer,
      });
    });

    // Create mock merchant server
    serverUrl = await new Promise<string>((resolve) => {
      mockServer = createServer(app as any);
      mockServer.listen(3000, () => {
        resolve("http://localhost:3000");
      });
    });

    // Create mock facilitator server
    const facilitatorApp = new Hono();

    facilitatorApp.post("/verify", async (c) => {
      const body = await c.req.json();
      const { payload, requirements } = body;

      try {
        const verification = await facilitator.verify(payload, requirements);
        return c.json(verification);
      } catch (error) {
        return c.json({
          isValid: false,
          invalidReason: error instanceof Error ? error.message : "Unknown error",
        }, 400);
      }
    });

    facilitatorApp.post("/settle", async (c) => {
      const body = await c.req.json();
      const { payload, requirements } = body;

      try {
        const settlement = await facilitator.settle(payload, requirements);
        return c.json(settlement);
      } catch (error) {
        return c.json({
          success: false,
          errorReason: error instanceof Error ? error.message : "Unknown error",
        }, 400);
      }
    });

    facilitatorUrl = await new Promise<string>((resolve) => {
      facilitatorServer = createServer(facilitatorApp as any);
      facilitatorServer.listen(3001, () => {
        resolve("http://localhost:3001");
      });
    });
  });

  afterEach(() => {
    if (mockServer) {
      mockServer.close();
    }
    if (facilitatorServer) {
      facilitatorServer.close();
    }
  });

  describe("PAYMENT-* headers flow", () => {
    it("should handle complete payment flow with correct headers", async () => {
      // Step 1: Initial request returns payment requirements
      const response1 = await fetch(`${serverUrl}/api/protected`);

      expect(response1.status).toBe(200);

      const result1 = await response1.json() as any;
      expect(result1.requiresPayment).toBe(true);
      expect(result1.accepts).toBeDefined();
      expect(result1.x402Version).toBe(1);

      // Get payment requirements from accepts array
      const paymentRequirements = result1.accepts[0];
      expect(paymentRequirements.scheme).toBe("exact");
      expect(paymentRequirements.network).toBe("eip155:84532");

      // Step 2: Create payment with client
      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      const paymentPayload = await client.createPaymentPayload(2, paymentRequirements);

      // Step 3: Request with payment headers
      const response2 = await fetch(`${serverUrl}/api/protected`, {
        method: "POST",
        headers: {
          "X-PAYMENT": JSON.stringify({
            x402Version: 2,
            payload: paymentPayload.payload,
          }),
          "X-SIGNATURE": paymentPayload.payload.signature,
          "Content-Type": "application/json",
        },
      });

      expect(response2.status).toBe(200);

      const result2 = await response2.json() as any;
      expect(result2.success).toBe(true);
      expect(result2.payer).toBe(MOCK_ADDRESSES.payer);
    });

    it("should validate PAYMENT-RESPONSE header on settlement", async () => {
      // Create settlement requirements
      const settlementRequirements = {
        ...mockPaymentRequirements,
        network: "eip155:84532",
      };

      // Create payment payload for settlement
      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      const paymentPayload = await client.createPaymentPayload(2, settlementRequirements);

      // Mock facilitator settlement
      const response = await fetch(`${facilitatorUrl}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: paymentPayload.payload,
          requirements: settlementRequirements,
        }),
      });

      expect(response.status).toBe(200);

      const settlement = await response.json() as any;
      expect(settlement.success).toBe(true);
      expect(settlement.transaction).toBeDefined();
      expect(settlement.network).toBe("eip155:84532");
    });
  });

  describe("extensions echo behavior", () => {
    it("should echo back extensions correctly", async () => {
      const extensions = {
        customField: "customValue",
        metadata: {
          source: "e2e-test",
          version: "1.0.0",
        },
      };

      // Create payment with extensions
      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      const requirementsWithExtensions = {
        ...mockPaymentRequirements,
        extra: {
          ...mockPaymentRequirements.extra,
          extensions,
        },
      };

      const paymentPayload = await client.createPaymentPayload(2, requirementsWithExtensions);

      // Request to extensions echo endpoint
      const response = await fetch(`${serverUrl}/api/extensions-echo`, {
        method: "POST",
        headers: {
          "PAYMENT-SIGNATURE": paymentPayload.payload.signature,
          "Content-Type": "application/json",
          "PAYMENT-PAYLOAD": JSON.stringify(paymentPayload.payload),
        },
        body: JSON.stringify({ extensions }),
      });

      expect(response.status).toBe(200);

      const result = await response.json() as any;
      expect(result.success).toBe(true);
      expect(result.echoed).toBe(true);
      expect(result.extensions).toEqual(extensions);
    });

    it("should handle empty extensions gracefully", async () => {
      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      const paymentPayload = await client.createPaymentPayload(2, mockPaymentRequirements);

      const response = await fetch(`${serverUrl}/api/extensions-echo`, {
        method: "POST",
        headers: {
          "PAYMENT-SIGNATURE": paymentPayload.payload.signature,
          "Content-Type": "application/json",
          "PAYMENT-PAYLOAD": JSON.stringify(paymentPayload.payload),
        },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(200);

      const result = await response.json() as any;
      expect(result.success).toBe(true);
      expect(result.extensions).toEqual({});
    });
  });

  describe("eip155:* wildcard path handling", () => {
    it("should handle wildcard network paths correctly", async () => {
      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      // Test different networks
      const testCases = [
        { network: "84532", expected: "eip155:84532" }, // Base Sepolia
        { network: "8453", expected: "eip155:8453" },   // Base Mainnet
        { network: "1", expected: "eip155:1" },         // Ethereum Mainnet
      ];

      for (const testCase of testCases) {
        const requirements = {
          ...mockPaymentRequirements,
          network: testCase.expected,
        };

        const paymentPayload = await client.createPaymentPayload(2, requirements);

        const response = await fetch(`${serverUrl}/api/wildcard/${testCase.network}/some/extra/path`, {
          headers: {
            "PAYMENT-SIGNATURE": paymentPayload.payload.signature,
            "Content-Type": "application/json",
            "PAYMENT-PAYLOAD": JSON.stringify(paymentPayload.payload),
          },
        });

        expect(response.status).toBe(200);

        const result = await response.json() as any;
        expect(result.success).toBe(true);
        expect(result.network).toBe(testCase.expected);
        expect(result.path).toBe("some/extra/path");
        expect(result.payer).toBe(MOCK_ADDRESSES.payer);
      }
    });

    it("should reject invalid network formats", async () => {
      const response = await fetch(`${serverUrl}/api/wildcard/invalid-network/path`);

      expect(response.status).toBe(402);
      expect(response.headers.get("PAYMENT-REQUIRED")).toBeDefined();
    });
  });

  describe("router settlement parameter propagation", () => {
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

      // Verify the requirements contain settlement router params
      expect(settlementRequirements.extra.settlementRouter).toBe(MOCK_ADDRESSES.settlementRouter);
      expect(settlementRequirements.extra.salt).toBe(MOCK_VALUES.salt);
      expect(settlementRequirements.extra.payTo).toBe(MOCK_ADDRESSES.merchant);
      expect(settlementRequirements.extra.facilitatorFee).toBe(MOCK_VALUES.facilitatorFee);

      // Create payment payload
      const client = new ExactEvmSchemeWithRouterSettlement({
        address: MOCK_ADDRESSES.payer,
        signTypedData: vi.fn().mockResolvedValue(MOCK_VALUES.signature),
      } as any);

      const paymentPayload = await client.createPaymentPayload(2, settlementRequirements);

      // Verify payload contains commitment-based nonce
      expect(paymentPayload.payload.authorization.nonce).toBe(MOCK_VALUES.nonce);

      // Test verification flow
      const verifyResponse = await fetch(`${facilitatorUrl}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: paymentPayload.payload,
          requirements: settlementRequirements,
        }),
      });

      expect(verifyResponse.status).toBe(200);

      const verification = await verifyResponse.json() as any;
      expect(verification.isValid).toBe(true);
      expect(verification.payer).toBe(MOCK_ADDRESSES.payer);

      // Test settlement flow
      const settleResponse = await fetch(`${facilitatorUrl}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: paymentPayload.payload,
          requirements: settlementRequirements,
        }),
      });

      expect(settleResponse.status).toBe(200);

      const settlement = await settleResponse.json() as any;
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

      const paymentPayload = await client.createPaymentPayload(2, complexSettlementRequirements);

      // Test settlement with complex hook data
      const settleResponse = await fetch(`${facilitatorUrl}/settle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: paymentPayload.payload,
          requirements: complexSettlementRequirements,
        }),
      });

      expect(settleResponse.status).toBe(200);

      const settlement = await settleResponse.json() as any;
      expect(settlement.success).toBe(true);
    });
  });

  describe("error handling and edge cases", () => {
    it("should handle invalid signatures gracefully", async () => {
      const response = await fetch(`${serverUrl}/api/protected`, {
        headers: {
          "PAYMENT-SIGNATURE": "0xinvalidsignature",
          "Content-Type": "application/json",
          "PAYMENT-PAYLOAD": JSON.stringify({ invalid: "payload" }),
        },
      });

      expect(response.status).toBe(402);
      expect(response.headers.get("PAYMENT-REQUIRED")).toBeDefined();
    });

    it("should handle missing payment headers", async () => {
      const response = await fetch(`${serverUrl}/api/protected`);

      expect(response.status).toBe(402);
      expect(response.headers.get("PAYMENT-REQUIRED")).toBeDefined();
      expect(response.headers.get("PAYMENT-REQUIREMENTS")).toBeDefined();
    });

    it("should handle malformed payment requirements", async () => {
      // Mock server to return invalid requirements
      app.get("/api/invalid-requirements", paymentMiddleware(
        MOCK_ADDRESSES.merchant,
        {
          price: "1000000",
          network: "eip155:84532",
        },
        {
          url: facilitatorUrl,
        }
      ), (c) => {
        // Force invalid requirements response
        return new Response(JSON.stringify({ error: "Invalid requirements" }), {
          status: 402,
          headers: {
            "PAYMENT-REQUIRED": "true",
            "PAYMENT-REQUIREMENTS": JSON.stringify({ invalid: "structure" }),
          },
        });
      });

      const response = await fetch(`${serverUrl}/api/invalid-requirements`);

      expect(response.status).toBe(402);
      expect(response.headers.get("PAYMENT-REQUIRED")).toBeDefined();
    });
  });
});