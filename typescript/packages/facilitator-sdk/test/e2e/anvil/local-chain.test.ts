/**
 * Local Chain E2E Tests for Router Settlement Flow
 *
 * These tests use Anvil (Foundry) to run a complete end-to-end flow:
 * 1. Deploy test contracts (ERC20 token, SettlementRouter, TransferHook)
 * 2. Start a test resource server
 * 3. Make HTTP request via @x402/fetch wrapped with payment
 * 4. Verify 402 behavior and payment headers
 * 5. Execute settlement via @x402x/facilitator-sdk
 * 6. Verify on-chain balances and hook execution
 *
 * Prerequisites:
 * - Anvil must be installed (`brew install foundry` or `curl -L https://foundry.paradigm.xyz | bash`)
 * - Contracts must be compiled (`cd contracts && forge build`)
 *
 * Run tests:
 * ```bash
 * pnpm test test/e2e/anvil/local-chain.test.ts
 * ```
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { createServer, type Server } from "http";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import fetch from "node-fetch";

// @x402 official packages
import { x402Client } from "@x402/core/client";
import { wrapFetchWithPayment } from "@x402/fetch";

// @x402x packages
import {
  createExtensionDeclaration,
  generateSalt,
  ROUTER_SETTLEMENT_KEY,
  createRouterSettlementExtension,
} from "@x402x/extensions";
import { ExactEvmSchemeWithRouterSettlement } from "@x402x/extensions/client";
import { createRouterSettlementFacilitator } from "@x402x/facilitator-sdk";

// Test utilities
import { AnvilManager, getGlobalAnvil, stopGlobalAnvil } from "./anvil-manager.js";
import { deployTestContracts, type DeployedContracts } from "./contracts.js";

// Polyfill global fetch for Node.js environment (required by @x402/fetch)
if (!globalThis.fetch) {
  globalThis.fetch = fetch as any;
}

/**
 * Test configuration
 */
const TEST_CONFIG = {
  anvilPort: 8545,
  serverPort: 3000,
  chainId: 31337,
  price: "1000000", // 1 USDC (6 decimals)
  facilitatorFee: "10000", // 0.01 USDC
  maxTimeoutSeconds: 3600,
};

/**
 * Global test state
 */
let anvilManager: AnvilManager;
let contracts: DeployedContracts;
let server: Server;
let serverUrl: string;

describe("E2E: Local Chain (Anvil) - Router Settlement Flow", () => {
  beforeAll(async () => {
    // Start Anvil
    anvilManager = getGlobalAnvil({
      port: TEST_CONFIG.anvilPort,
      chainId: TEST_CONFIG.chainId,
    });

    const anvilConfig = await anvilManager.start();
    console.log(`[E2E] Anvil running at ${anvilConfig.rpcUrl}`);

    // Deploy test contracts
    contracts = await deployTestContracts(anvilConfig.rpcUrl);
    console.log(`[E2E] Contracts deployed:`, {
      token: contracts.token.address,
      settlementRouter: contracts.settlementRouter.address,
      transferHook: contracts.transferHook.address,
    });

    // Create test server
    await createTestServer(anvilConfig.rpcUrl);
  }, 60000); // 60s timeout for Anvil start + contract deployment

  afterAll(async () => {
    // Stop server
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    // Stop Anvil
    await stopGlobalAnvil();
  });

  describe("Happy Path - Complete Payment Flow", () => {
    it("should complete full router settlement flow: 402 → payment → settlement → hook execution", async () => {
      // Setup: Create viem clients
      const publicClient = createPublicClient({
        transport: http(`http://localhost:${TEST_CONFIG.anvilPort}`),
      });

      // Payer account (Anvil account #2)
      const payerAccount = privateKeyToAccount(
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex
      );

      const walletClient = createWalletClient({
        account: payerAccount,
        transport: http(`http://localhost:${TEST_CONFIG.anvilPort}`),
      });

      // Get initial balances
      const initialPayerBalance = await publicClient.readContract({
        address: contracts.token.address,
        abi: contracts.token.abi,
        functionName: "balanceOf",
        args: [contracts.accounts.payer],
      });

      const initialMerchantBalance = await publicClient.readContract({
        address: contracts.token.address,
        abi: contracts.token.abi,
        functionName: "balanceOf",
        args: [contracts.accounts.merchant],
      });

      const initialFacilitatorBalance = await publicClient.readContract({
        address: contracts.token.address,
        abi: contracts.token.abi,
        functionName: "balanceOf",
        args: [contracts.accounts.facilitator],
      });

      console.log(`[E2E] Initial balances:`, {
        payer: initialPayerBalance.toString(),
        merchant: initialMerchantBalance.toString(),
        facilitator: initialFacilitatorBalance.toString(),
      });

      // Step 1: Initial request without payment → 402
      const response1 = await fetch(`${serverUrl}/api/protected`, {
        method: "GET",
      });

      // Verify 402 Payment Required response
      expect(response1.status).toBe(402);

      const paymentRequired = await response1.json();
      expect(paymentRequired.requiresPayment).toBe(true);
      expect(paymentRequired.accepts).toBeDefined();
      expect(paymentRequired.accepts).toHaveLength(1);

      console.log(`[E2E] Received payment requirements:`, {
        accepts: paymentRequired.accepts?.[0],
      });

      // Extract payment requirements
      const requirements = paymentRequired.accepts![0];
      expect(requirements.scheme).toBe("exact");
      expect(requirements.network).toBe("eip155:31337");
      expect(requirements.amount).toBe(TEST_CONFIG.price);

      // Verify x402x-router-settlement extension
      const routerSettlementExt = paymentRequired.extensions?.[ROUTER_SETTLEMENT_KEY] as any;
      expect(routerSettlementExt).toBeDefined();
      expect(routerSettlementExt.info).toBeDefined();
      expect(routerSettlementExt.info.settlementRouter).toBe(contracts.settlementRouter.address);
      expect(routerSettlementExt.info.hook).toBe(contracts.transferHook.address);
      expect(routerSettlementExt.info.finalPayTo).toBe(contracts.accounts.merchant);
      expect(routerSettlementExt.info.facilitatorFee).toBe(TEST_CONFIG.facilitatorFee);

      // Step 2: Create payment with client
      const client = new x402Client().register(
        "eip155:31337",
        new ExactEvmSchemeWithRouterSettlement(walletClient)
      );

      // Wrap fetch with payment handling
      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      // Step 3: Request with payment headers
      const response2 = await fetchWithPayment(`${serverUrl}/api/protected`, {
        method: "GET",
      });

      // Verify successful payment
      expect(response2.status).toBe(200);
      expect(response2.headers.get("Content-Type")).toBe("application/json");

      const result = await response2.json();
      expect(result.success).toBe(true);
      expect(result.message).toBe("Payment successful");

      console.log(`[E2E] Payment successful, response:`, result);

      // Step 4: Verify on-chain balances
      const finalPayerBalance = await publicClient.readContract({
        address: contracts.token.address,
        abi: contracts.token.abi,
        functionName: "balanceOf",
        args: [contracts.accounts.payer],
      });

      const finalMerchantBalance = await publicClient.readContract({
        address: contracts.token.address,
        abi: contracts.token.abi,
        functionName: "balanceOf",
        args: [contracts.accounts.merchant],
      });

      const finalFacilitatorBalance = await publicClient.readContract({
        address: contracts.token.address,
        abi: contracts.token.abi,
        functionName: "balanceOf",
        args: [contracts.accounts.facilitator],
      });

      console.log(`[E2E] Final balances:`, {
        payer: finalPayerBalance.toString(),
        merchant: finalMerchantBalance.toString(),
        facilitator: finalFacilitatorBalance.toString(),
      });

      // Verify payer spent correct amount (price + facilitator fee)
      const expectedSpent = BigInt(TEST_CONFIG.price) + BigInt(TEST_CONFIG.facilitatorFee);
      expect(initialPayerBalance - finalPayerBalance).toBe(expectedSpent);

      // Verify merchant received correct amount (price)
      const expectedMerchant = BigInt(TEST_CONFIG.price);
      expect(finalMerchantBalance - initialMerchantBalance).toBe(expectedMerchant);

      // Verify facilitator fee is pending in SettlementRouter
      const pendingFees = await publicClient.readContract({
        address: contracts.settlementRouter.address,
        abi: contracts.settlementRouter.abi,
        functionName: "getPendingFees",
        args: [contracts.accounts.facilitator, contracts.token.address],
      });

      expect(pendingFees).toBe(BigInt(TEST_CONFIG.facilitatorFee));
    });

    it("should handle multiple sequential payments correctly", async () => {
      // Setup payer
      const payerAccount = privateKeyToAccount(
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex
      );

      const walletClient = createWalletClient({
        account: payerAccount,
        transport: http(`http://localhost:${TEST_CONFIG.anvilPort}`),
      });

      const client = new x402Client().register(
        "eip155:31337",
        new ExactEvmSchemeWithRouterSettlement(walletClient)
      );

      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      // Get initial pending fees before this test
      const publicClient = createPublicClient({
        transport: http(`http://localhost:${TEST_CONFIG.anvilPort}`),
      });

      const initialPendingFees = await publicClient.readContract({
        address: contracts.settlementRouter.address,
        abi: contracts.settlementRouter.abi,
        functionName: "getPendingFees",
        args: [contracts.accounts.facilitator, contracts.token.address],
      });

      // Make 3 sequential payments
      for (let i = 0; i < 3; i++) {
        const response = await fetchWithPayment(`${serverUrl}/api/protected`, {
          method: "GET",
        });

        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);
      }

      // Verify facilitator fees accumulated (initial + 3 new fees)
      const finalPendingFees = await publicClient.readContract({
        address: contracts.settlementRouter.address,
        abi: contracts.settlementRouter.abi,
        functionName: "getPendingFees",
        args: [contracts.accounts.facilitator, contracts.token.address],
      });

      const expectedTotalFees = initialPendingFees + BigInt(TEST_CONFIG.facilitatorFee) * 3n;
      expect(finalPendingFees).toBe(expectedTotalFees);
    });
  });

  describe("Failure Path - Invalid Payment", () => {
    it("should reject payment with invalid signature", async () => {
      // This test verifies that invalid signatures are properly rejected
      // We'll manually construct a request with an invalid signature

      const response = await fetch(`${serverUrl}/api/protected`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "PAYMENT-SIGNATURE": "invalid_base64_signature",
        },
        body: JSON.stringify({ test: "data" }),
      });

      // Should return payment required response for invalid payment
      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.requiresPayment).toBe(true);
    });
  });

  describe("Extension Echo Behavior", () => {
    it("should echo back custom extension data", async () => {
      const payerAccount = privateKeyToAccount(
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex
      );

      const walletClient = createWalletClient({
        account: payerAccount,
        transport: http(`http://localhost:${TEST_CONFIG.anvilPort}`),
      });

      const client = new x402Client().register(
        "eip155:31337",
        new ExactEvmSchemeWithRouterSettlement(walletClient)
      );

      const fetchWithPayment = wrapFetchWithPayment(fetch, client);

      // Request to extensions echo endpoint
      const response = await fetchWithPayment(`${serverUrl}/api/extensions-echo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customField: "testValue",
          metadata: { source: "e2e-test" },
        }),
      });

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.extensions).toBeDefined();
    });
  });
});

/**
 * Create test server with x402x payment middleware
 */
async function createTestServer(rpcUrl: string): Promise<void> {
  // Create publicClient for facilitator
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });
  const app = new Hono();

  // Protected endpoint - returns 402 with payment requirements
  app.get("/api/protected", async (c) => {
    // Check for X-Payment header indicating payment attempt
    const paymentHeader = c.req.header("X-Payment");

    if (!paymentHeader) {
      // No payment - return 402 with requirements
      const salt = generateSalt();
      const requirements = {
        requiresPayment: true,
        accepts: [
          {
            scheme: "exact" as const,
            network: "eip155:31337",
            amount: TEST_CONFIG.price,
            asset: contracts.token.address,
            maxTimeoutSeconds: TEST_CONFIG.maxTimeoutSeconds,
            extra: {
              name: "MockUSDC",
              version: "1",
            },
            extensions: createExtensionDeclaration({
              settlementRouter: contracts.settlementRouter.address,
              hook: contracts.transferHook.address,
              hookData: "0x",
              finalPayTo: contracts.accounts.merchant,
              facilitatorFee: TEST_CONFIG.facilitatorFee,
              salt,
            }),
          },
        ],
        extensions: {
          [ROUTER_SETTLEMENT_KEY]: createRouterSettlementExtension({
            settlementRouter: contracts.settlementRouter.address,
            hook: contracts.transferHook.address,
            hookData: "0x",
            finalPayTo: contracts.accounts.merchant,
            facilitatorFee: TEST_CONFIG.facilitatorFee,
            salt,
          }),
        },
      };

      console.log("[E2E] No payment header - returning 402");
      // Return 402 Payment Required with Payment-Response header
      // Base64 encode the requirements for the header
      const requirementsJson = JSON.stringify(requirements);
      const requirementsB64 = Buffer.from(requirementsJson).toString('base64');
      c.header('Payment-Response', requirementsB64);
      return c.json(requirements, 402);
    }

    // Payment provided - settle and verify
    try {
      console.log("[E2E] Payment header received, processing settlement...");
      const facilitator = createRouterSettlementFacilitator({
        signer: contracts.accounts.facilitator,
        publicClient,
        allowedRouters: {
          "eip155:31337": [contracts.settlementRouter.address],
        },
      });

      // Decode payment header
      console.log("[E2E] Decoding payment payload...");
      const paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
      console.log("[E2E] Payment payload decoded:", JSON.stringify(paymentPayload).slice(0, 200));

      // Get requirements from query/body for settlement
      const salt = generateSalt();
      const paymentRequirements = {
        accepts: [
          {
            scheme: "exact" as const,
            network: "eip155:31337",
            amount: TEST_CONFIG.price,
            asset: contracts.token.address,
            maxTimeoutSeconds: TEST_CONFIG.maxTimeoutSeconds,
            extensions: createExtensionDeclaration({
              settlementRouter: contracts.settlementRouter.address,
              hook: contracts.transferHook.address,
              hookData: "0x",
              finalPayTo: contracts.accounts.merchant,
              facilitatorFee: TEST_CONFIG.facilitatorFee,
              salt,
            }),
          },
        ],
        extensions: {
          [ROUTER_SETTLEMENT_KEY]: createRouterSettlementExtension({
            settlementRouter: contracts.settlementRouter.address,
            hook: contracts.transferHook.address,
            hookData: "0x",
            finalPayTo: contracts.accounts.merchant,
            facilitatorFee: TEST_CONFIG.facilitatorFee,
            salt,
          }),
        },
      };

      // Settle payment
      await facilitator.settle(paymentPayload, paymentRequirements);

      return c.json({ success: true, message: "Payment successful" });
    } catch (error) {
      console.error("[E2E] Settlement error:", error);
      return c.json({ success: false, error: (error as Error).message }, 402);
    }
  });

  // Extensions echo endpoint (similar to protected but with POST)
  app.post("/api/extensions-echo", async (c) => {
    const paymentHeader = c.req.header("X-Payment");

    if (!paymentHeader) {
      const salt = generateSalt();
      const requirements = {
        requiresPayment: true,
        accepts: [
          {
            scheme: "exact" as const,
            network: "eip155:31337",
            amount: TEST_CONFIG.price,
            asset: contracts.token.address,
            maxTimeoutSeconds: TEST_CONFIG.maxTimeoutSeconds,
            extra: {
              name: "MockUSDC",
              version: "1",
            },
            extensions: createExtensionDeclaration({
              settlementRouter: contracts.settlementRouter.address,
              hook: contracts.transferHook.address,
              hookData: "0x",
              finalPayTo: contracts.accounts.merchant,
              facilitatorFee: TEST_CONFIG.facilitatorFee,
              salt,
            }),
          },
        ],
        extensions: {
          [ROUTER_SETTLEMENT_KEY]: createRouterSettlementExtension({
            settlementRouter: contracts.settlementRouter.address,
            hook: contracts.transferHook.address,
            hookData: "0x",
            finalPayTo: contracts.accounts.merchant,
            facilitatorFee: TEST_CONFIG.facilitatorFee,
            salt,
          }),
        },
      };
      return c.json(requirements, 402);
    }

    // Payment provided - settle and return echo
    try {
      const facilitator = createRouterSettlementFacilitator({
        signer: contracts.accounts.facilitator,
        publicClient,
        allowedRouters: {
          "eip155:31337": [contracts.settlementRouter.address],
        },
      });

      const paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString());
      const salt = generateSalt();
      const paymentRequirements = {
        accepts: [
          {
            scheme: "exact" as const,
            network: "eip155:31337",
            amount: TEST_CONFIG.price,
            asset: contracts.token.address,
            maxTimeoutSeconds: TEST_CONFIG.maxTimeoutSeconds,
            extensions: createExtensionDeclaration({
              settlementRouter: contracts.settlementRouter.address,
              hook: contracts.transferHook.address,
              hookData: "0x",
              finalPayTo: contracts.accounts.merchant,
              facilitatorFee: TEST_CONFIG.facilitatorFee,
              salt,
            }),
          },
        ],
        extensions: {
          [ROUTER_SETTLEMENT_KEY]: createRouterSettlementExtension({
            settlementRouter: contracts.settlementRouter.address,
            hook: contracts.transferHook.address,
            hookData: "0x",
            finalPayTo: contracts.accounts.merchant,
            facilitatorFee: TEST_CONFIG.facilitatorFee,
            salt,
          }),
        },
      };

      await facilitator.settle(paymentPayload, paymentRequirements);

      // Return echo of extensions data
      return c.json({
        success: true,
        echoedExtensions: paymentRequirements.extensions,
      });
    } catch (error) {
      console.error("[E2E] Settlement error:", error);
      return c.json({ success: false, error: (error as Error).message }, 402);
    }
  });

  // Start HTTP server
  serverUrl = await new Promise<string>((resolve) => {
    server = createServer(app as any);
    server.listen(TEST_CONFIG.serverPort, () => {
      resolve(`http://localhost:${TEST_CONFIG.serverPort}`);
    });
  });

  console.log(`[E2E] Test server running at ${serverUrl}`);
}
