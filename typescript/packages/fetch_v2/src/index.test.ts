/**
 * Tests for @x402x/fetch_v2
 * 
 * Validates the custom ExactEvmSchemeWithRouterSettlement client that wraps
 * official @x402/fetch with router settlement support.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExactEvmSchemeWithRouterSettlement } from "./index.js";
import type { PaymentRequirements } from "@x402/core/types";
import type { ClientEvmSigner } from "@x402/evm";
import type { Hex } from "viem";

// Mock signer for testing
const createMockSigner = (): ClientEvmSigner => {
  return {
    address: "0x1234567890123456789012345678901234567890",
    signTypedData: vi.fn(async () => "0xabcdef" as Hex),
  } as any;
};

describe("ExactEvmSchemeWithRouterSettlement", () => {
  let scheme: ExactEvmSchemeWithRouterSettlement;
  let mockSigner: ClientEvmSigner;

  beforeEach(() => {
    mockSigner = createMockSigner();
    scheme = new ExactEvmSchemeWithRouterSettlement(mockSigner);
  });

  describe("scheme property", () => {
    it("should be 'exact'", () => {
      expect(scheme.scheme).toBe("exact");
    });
  });

  describe("createPaymentPayload - settlement mode", () => {
    it("should use commitment-based nonce when settlementRouter is present", async () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x1111111111111111111111111111111111111111",
        amount: "100000",
        maxTimeoutSeconds: 3600,
        extra: {
          settlementRouter: "0x2222222222222222222222222222222222222222",
          salt: "0x" + "00".repeat(32),
          payTo: "0x3333333333333333333333333333333333333333",
          facilitatorFee: "10000",
          hook: "0x4444444444444444444444444444444444444444",
          hookData: "0x",
          name: "USD Coin",
          version: "2",
        },
      };

      const result = await scheme.createPaymentPayload(2, requirements);

      expect(result.x402Version).toBe(2);
      expect(result.payload).toBeDefined();
      expect(result.payload.authorization).toBeDefined();
      expect(result.payload.signature).toBeDefined();

      // Verify authorization structure
      const auth = result.payload.authorization;
      expect(auth.from).toBe(mockSigner.address);
      expect(auth.to).toBe(requirements.payTo);
      expect(auth.value).toBe(requirements.amount);
      expect(auth.validAfter).toBeDefined();
      expect(auth.validBefore).toBeDefined();
      
      // Verify nonce is commitment (not random)
      expect(auth.nonce).toBeDefined();
      expect(auth.nonce).toMatch(/^0x[a-fA-F0-9]{64}$/);
      
      // Nonce should be deterministic based on commitment parameters
      // Run again with same params to verify
      const result2 = await scheme.createPaymentPayload(2, requirements);
      expect(result2.payload.authorization.nonce).toBe(auth.nonce);
    });

    it("should include correct EIP-712 signing parameters for settlement", async () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x1111111111111111111111111111111111111111",
        amount: "100000",
        maxTimeoutSeconds: 3600,
        extra: {
          settlementRouter: "0x2222222222222222222222222222222222222222",
          salt: "0x" + "00".repeat(32),
          payTo: "0x3333333333333333333333333333333333333333",
          facilitatorFee: "10000",
          hook: "0x4444444444444444444444444444444444444444",
          hookData: "0x",
          name: "USD Coin",
          version: "2",
        },
      };

      await scheme.createPaymentPayload(2, requirements);

      // Verify signTypedData was called
      expect(mockSigner.signTypedData).toHaveBeenCalledTimes(1);
      
      const signCall = (mockSigner.signTypedData as any).mock.calls[0][0];
      
      // Verify domain parameters
      expect(signCall.domain).toMatchObject({
        name: "USD Coin",
        version: "2",
        chainId: 84532,
        verifyingContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      });

      // Verify types
      expect(signCall.types.TransferWithAuthorization).toBeDefined();
      expect(signCall.primaryType).toBe("TransferWithAuthorization");

      // Verify message structure
      expect(signCall.message.from).toBe("0x1234567890123456789012345678901234567890");
      expect(signCall.message.to).toBe("0x1111111111111111111111111111111111111111");
      expect(signCall.message.value).toBe(BigInt("100000"));
      expect(signCall.message.nonce).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should throw error if EIP-712 domain parameters are missing", async () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x1111111111111111111111111111111111111111",
        amount: "100000",
        maxTimeoutSeconds: 3600,
        extra: {
          settlementRouter: "0x2222222222222222222222222222222222222222",
          salt: "0x" + "00".repeat(32),
          payTo: "0x3333333333333333333333333333333333333333",
          facilitatorFee: "10000",
          hook: "0x4444444444444444444444444444444444444444",
          hookData: "0x",
          // Missing name and version
        },
      };

      await expect(
        scheme.createPaymentPayload(2, requirements)
      ).rejects.toThrow(/EIP-712 domain parameters/);
    });
  });

  describe("createPaymentPayload - standard mode", () => {
    it("should delegate to official scheme when settlementRouter is absent", async () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x1111111111111111111111111111111111111111",
        amount: "100000",
        maxTimeoutSeconds: 3600,
        extra: {
          name: "USD Coin",
          version: "2",
        },
      };

      const result = await scheme.createPaymentPayload(2, requirements);

      expect(result.x402Version).toBe(2);
      expect(result.payload).toBeDefined();
      expect(result.payload.authorization).toBeDefined();
      expect(result.payload.signature).toBeDefined();

      // Verify nonce is random (not commitment-based)
      const auth = result.payload.authorization;
      expect(auth.nonce).toMatch(/^0x[a-fA-F0-9]{64}$/);
      
      // Run again to verify nonce changes (random, not deterministic)
      const result2 = await scheme.createPaymentPayload(2, requirements);
      expect(result2.payload.authorization.nonce).not.toBe(auth.nonce);
    });

    it("should use random nonce for standard mode", async () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x1111111111111111111111111111111111111111",
        amount: "100000",
        maxTimeoutSeconds: 3600,
        extra: {
          name: "USD Coin",
          version: "2",
        },
      };

      const result1 = await scheme.createPaymentPayload(2, requirements);
      const result2 = await scheme.createPaymentPayload(2, requirements);

      // Nonces should be different (random)
      expect(result1.payload.authorization.nonce).not.toBe(
        result2.payload.authorization.nonce
      );
    });
  });

  describe("settlement vs non-settlement selection", () => {
    it("should select settlement mode when settlementRouter exists", async () => {
      const requirementsWithRouter: PaymentRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x1111111111111111111111111111111111111111",
        amount: "100000",
        maxTimeoutSeconds: 3600,
        extra: {
          settlementRouter: "0x2222222222222222222222222222222222222222",
          salt: "0x" + "00".repeat(32),
          payTo: "0x3333333333333333333333333333333333333333",
          facilitatorFee: "10000",
          hook: "0x4444444444444444444444444444444444444444",
          hookData: "0x",
          name: "USD Coin",
          version: "2",
        },
      };

      const result1 = await scheme.createPaymentPayload(2, requirementsWithRouter);
      const result2 = await scheme.createPaymentPayload(2, requirementsWithRouter);

      // Settlement mode: nonces should be identical (deterministic commitment)
      expect(result1.payload.authorization.nonce).toBe(
        result2.payload.authorization.nonce
      );
    });

    it("should select standard mode when settlementRouter is absent", async () => {
      const requirementsWithoutRouter: PaymentRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x1111111111111111111111111111111111111111",
        amount: "100000",
        maxTimeoutSeconds: 3600,
        extra: {
          name: "USD Coin",
          version: "2",
        },
      };

      const result1 = await scheme.createPaymentPayload(2, requirementsWithoutRouter);
      const result2 = await scheme.createPaymentPayload(2, requirementsWithoutRouter);

      // Standard mode: nonces should be different (random)
      expect(result1.payload.authorization.nonce).not.toBe(
        result2.payload.authorization.nonce
      );
    });
  });

  describe("payload shape validation", () => {
    it("should return correct payload structure for settlement mode", async () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x1111111111111111111111111111111111111111",
        amount: "100000",
        maxTimeoutSeconds: 3600,
        extra: {
          settlementRouter: "0x2222222222222222222222222222222222222222",
          salt: "0x" + "00".repeat(32),
          payTo: "0x3333333333333333333333333333333333333333",
          facilitatorFee: "10000",
          hook: "0x4444444444444444444444444444444444444444",
          hookData: "0x",
          name: "USD Coin",
          version: "2",
        },
      };

      const result = await scheme.createPaymentPayload(2, requirements);

      // Validate top-level structure
      expect(result).toHaveProperty("x402Version");
      expect(result).toHaveProperty("payload");
      
      // Validate payload structure
      expect(result.payload).toHaveProperty("authorization");
      expect(result.payload).toHaveProperty("signature");
      
      // Validate authorization structure
      const auth = result.payload.authorization;
      expect(auth).toHaveProperty("from");
      expect(auth).toHaveProperty("to");
      expect(auth).toHaveProperty("value");
      expect(auth).toHaveProperty("validAfter");
      expect(auth).toHaveProperty("validBefore");
      expect(auth).toHaveProperty("nonce");
      
      // Validate types
      expect(typeof auth.from).toBe("string");
      expect(typeof auth.to).toBe("string");
      expect(typeof auth.value).toBe("string");
      expect(typeof auth.validAfter).toBe("string");
      expect(typeof auth.validBefore).toBe("string");
      expect(typeof auth.nonce).toBe("string");
      expect(typeof result.payload.signature).toBe("string");
    });

    it("should include valid timestamp range", async () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "eip155:84532",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        payTo: "0x1111111111111111111111111111111111111111",
        amount: "100000",
        maxTimeoutSeconds: 3600,
        extra: {
          settlementRouter: "0x2222222222222222222222222222222222222222",
          salt: "0x" + "00".repeat(32),
          payTo: "0x3333333333333333333333333333333333333333",
          facilitatorFee: "10000",
          hook: "0x4444444444444444444444444444444444444444",
          hookData: "0x",
          name: "USD Coin",
          version: "2",
        },
      };

      const result = await scheme.createPaymentPayload(2, requirements);
      const auth = result.payload.authorization;

      const now = Math.floor(Date.now() / 1000);
      const validAfter = parseInt(auth.validAfter);
      const validBefore = parseInt(auth.validBefore);

      // validAfter should be ~10 minutes before now
      expect(validAfter).toBeGreaterThan(now - 700);
      expect(validAfter).toBeLessThan(now - 500);

      // validBefore should be ~1 hour after now
      expect(validBefore).toBeGreaterThan(now + 3500);
      expect(validBefore).toBeLessThan(now + 3700);

      // validBefore should be after validAfter
      expect(validBefore).toBeGreaterThan(validAfter);
    });
  });
});
