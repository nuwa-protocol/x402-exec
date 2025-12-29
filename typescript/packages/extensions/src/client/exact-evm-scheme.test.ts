/**
 * Tests for ExactEvmSchemeWithRouterSettlement
 */

import type { PaymentRequirements } from "@x402/core/types";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { calculateCommitment } from "../commitment.js";
import { ROUTER_SETTLEMENT_KEY } from "../server-extension.js";

import { ExactEvmSchemeWithRouterSettlement } from "./exact-evm-scheme.js";

describe("ExactEvmSchemeWithRouterSettlement", () => {
  const mockSigner = {
    address: "0x1234567890123456789012345678901234567890" as `0x${string}`,
    signTypedData: vi.fn(async () => "0xsignature" as `0x${string}`),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create payment payload with commitment as nonce", async () => {
    const scheme = new ExactEvmSchemeWithRouterSettlement(mockSigner);

    const paymentRequirements: PaymentRequirements = {
      scheme: "exact",
      network: "eip155:84532",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "100000",
      payTo: "0x1111111111111111111111111111111111111111",
      maxTimeoutSeconds: 300,
      extra: {
        name: "USD Coin",
        version: "2",
        [ROUTER_SETTLEMENT_KEY]: {
          info: {
            schemaVersion: 1,
            salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
            settlementRouter: "0x2222222222222222222222222222222222222222",
            hook: "0x3333333333333333333333333333333333333333",
            hookData: "0x",
            finalPayTo: "0x4444444444444444444444444444444444444444",
            facilitatorFee: "1000",
          },
        },
      },
    };

    const result = await scheme.createPaymentPayload(2, paymentRequirements);

    expect(result.x402Version).toBe(2);
    expect(result.payload).toBeDefined();
    expect(result.payload.authorization).toBeDefined();
    expect(result.payload.signature).toBe("0xsignature");

    // Verify the nonce is a commitment hash (not random)
    const auth = result.payload.authorization;
    expect(auth.nonce).toMatch(/^0x[0-9a-f]{64}$/i);

    // Verify 'to' is settlementRouter
    expect(auth.to.toLowerCase()).toBe("0x2222222222222222222222222222222222222222");

    // Verify signer was called with correct parameters
    expect(mockSigner.signTypedData).toHaveBeenCalledTimes(1);
    const signCall = mockSigner.signTypedData.mock.calls[0][0];
    expect(signCall.domain.chainId).toBe(84532);
    expect(signCall.domain.verifyingContract.toLowerCase()).toBe(
      "0x036cbd53842c5426634e7929541ec2318f3dcf7e",
    );
    expect(signCall.message.to.toLowerCase()).toBe("0x2222222222222222222222222222222222222222");
  });

  it("should support reading router settlement from PaymentRequired.extensions via injected context (without mutating accepted)", async () => {
    const scheme = new ExactEvmSchemeWithRouterSettlement(mockSigner);

    // Server-provided extension data (root-level PaymentRequired.extensions)
    scheme.setRouterSettlementExtensionFromPaymentRequired({
      info: {
        schemaVersion: 1,
        salt: "0x0000000000000000000000000000000000000000000000000000000000000002",
        settlementRouter: "0x2222222222222222222222222222222222222222",
        hook: "0x3333333333333333333333333333333333333333",
        hookData: "0x",
        finalPayTo: "0x4444444444444444444444444444444444444444",
        facilitatorFee: "0",
      },
    });

    const paymentRequirements: PaymentRequirements = {
      scheme: "exact",
      network: "eip155:84532",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "100000",
      payTo: "0x1111111111111111111111111111111111111111",
      maxTimeoutSeconds: 300,
      extra: {
        name: "USD Coin",
        version: "2",
        // NOTE: no x402x router settlement in extra
      },
    };

    const result = await scheme.createPaymentPayload(2, paymentRequirements);
    expect(result.x402Version).toBe(2);
    expect((result.payload as any).authorization?.nonce).toMatch(/^0x[0-9a-f]{64}$/i);
  });

  it("should throw error if x402Version is not 2", async () => {
    const scheme = new ExactEvmSchemeWithRouterSettlement(mockSigner);

    const paymentRequirements: PaymentRequirements = {
      scheme: "exact",
      network: "base-sepolia",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "100000",
      payTo: "0x1111111111111111111111111111111111111111",
      maxTimeoutSeconds: 300,
      extra: {},
    };

    await expect(scheme.createPaymentPayload(1, paymentRequirements)).rejects.toThrow(
      "only supports x402 version 2",
    );
  });

  it("should throw error if x402x extension is missing", async () => {
    const scheme = new ExactEvmSchemeWithRouterSettlement(mockSigner);

    const paymentRequirements: PaymentRequirements = {
      scheme: "exact",
      network: "eip155:84532",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "100000",
      payTo: "0x1111111111111111111111111111111111111111",
      maxTimeoutSeconds: 300,
      extra: {},
    };

    await expect(scheme.createPaymentPayload(2, paymentRequirements)).rejects.toThrow(
      "x402x-router-settlement extension not available",
    );
  });

  it("should throw error if required parameters are missing", async () => {
    const scheme = new ExactEvmSchemeWithRouterSettlement(mockSigner);

    const paymentRequirements: PaymentRequirements = {
      scheme: "exact",
      network: "eip155:84532",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "100000",
      payTo: "0x1111111111111111111111111111111111111111",
      maxTimeoutSeconds: 300,
      extra: {
        name: "USD Coin",
        version: "2",
        "x402x-router-settlement": {
          info: {
            // Missing required fields
            salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
          },
        },
      },
    };

    await expect(scheme.createPaymentPayload(2, paymentRequirements)).rejects.toThrow(
      "Missing required parameter",
    );
  });

  it("should calculate correct commitment hash", async () => {
    const scheme = new ExactEvmSchemeWithRouterSettlement(mockSigner);

    const salt = "0x0000000000000000000000000000000000000000000000000000000000000001";
    const settlementRouter = "0x2222222222222222222222222222222222222222";
    const hook = "0x3333333333333333333333333333333333333333";
    const hookData = "0x";
    const finalPayTo = "0x4444444444444444444444444444444444444444";
    const facilitatorFee = "1000";
    const asset = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
    const amount = "100000";

    const paymentRequirements: PaymentRequirements = {
      scheme: "exact",
      network: "eip155:84532",
      asset,
      amount,
      payTo: "0x1111111111111111111111111111111111111111",
      maxTimeoutSeconds: 300,
      extra: {
        name: "USD Coin",
        version: "2",
        "x402x-router-settlement": {
          info: {
            schemaVersion: 1,
            salt,
            settlementRouter,
            hook,
            hookData,
            finalPayTo,
            facilitatorFee,
          },
        },
      },
    };

    const result = await scheme.createPaymentPayload(2, paymentRequirements);
    const auth = result.payload.authorization;

    // Manually calculate expected commitment
    const now = Math.floor(Date.now() / 1000);
    const expectedCommitment = calculateCommitment({
      chainId: 84532,
      hub: settlementRouter,
      asset,
      from: mockSigner.address,
      value: amount,
      validAfter: auth.validAfter,
      validBefore: auth.validBefore,
      salt,
      payTo: finalPayTo,
      facilitatorFee,
      hook,
      hookData,
    });

    expect(auth.nonce).toBe(expectedCommitment);
  });

  it("should handle different chain IDs correctly", async () => {
    const scheme = new ExactEvmSchemeWithRouterSettlement(mockSigner);

    const paymentRequirements: PaymentRequirements = {
      scheme: "exact",
      network: "eip155:8453", // Base mainnet
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      amount: "1000000",
      payTo: "0x1111111111111111111111111111111111111111",
      maxTimeoutSeconds: 600,
      extra: {
        name: "USD Coin",
        version: "2",
        "x402x-router-settlement": {
          info: {
            schemaVersion: 1,
            salt: "0x0000000000000000000000000000000000000000000000000000000000000002",
            settlementRouter: "0x2222222222222222222222222222222222222222",
            hook: "0x3333333333333333333333333333333333333333",
            hookData: "0x1234",
            finalPayTo: "0x4444444444444444444444444444444444444444",
            facilitatorFee: "2000",
          },
        },
      },
    };

    const result = await scheme.createPaymentPayload(2, paymentRequirements);

    // Verify chainId was parsed correctly
    const signCall = mockSigner.signTypedData.mock.calls[0][0];
    expect(signCall.domain.chainId).toBe(8453);
  });
});
