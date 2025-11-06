import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isSettlementMode, validateSettlementRouter, settleWithRouter } from "./facilitator";
import type { PaymentPayload, PaymentRequirements, FacilitatorConfig } from "./types";
import { SettlementExtraError } from "./types";
import { mockAddresses } from "./__tests__/fixtures";

describe("isSettlementMode", () => {
  it("should return true when extra has settlementRouter", () => {
    const requirements = {
      extra: {
        settlementRouter: "0x1234567890123456789012345678901234567890",
      },
    } as PaymentRequirements;

    expect(isSettlementMode(requirements)).toBe(true);
  });

  it("should return false when extra is undefined", () => {
    const requirements = {} as PaymentRequirements;

    expect(isSettlementMode(requirements)).toBe(false);
  });

  it("should return false when extra exists but no settlementRouter", () => {
    const requirements = {
      extra: {
        name: "USDC",
        version: "2",
      },
    } as PaymentRequirements;

    expect(isSettlementMode(requirements)).toBe(false);
  });

  it("should return false when settlementRouter is empty string", () => {
    const requirements = {
      extra: {
        settlementRouter: "",
      },
    } as PaymentRequirements;

    expect(isSettlementMode(requirements)).toBe(false);
  });

  it("should return false when settlementRouter is null", () => {
    const requirements = {
      extra: {
        settlementRouter: null,
      },
    } as PaymentRequirements;

    expect(isSettlementMode(requirements)).toBe(false);
  });
});

describe("validateSettlementRouter", () => {
  const allowedRouters = {
    "base-sepolia": [
      "0x32431D4511e061F1133520461B07eC42afF157D6",
      "0x1234567890123456789012345678901234567890",
    ],
    "x-layer-testnet": ["0x1ae0e196dc18355af3a19985faf67354213f833d"],
  };

  it("should pass validation for whitelisted router", () => {
    expect(() => {
      validateSettlementRouter(
        "base-sepolia",
        "0x32431D4511e061F1133520461B07eC42afF157D6",
        allowedRouters,
      );
    }).not.toThrow();
  });

  it("should pass validation regardless of case", () => {
    expect(() => {
      validateSettlementRouter(
        "base-sepolia",
        "0x32431D4511E061F1133520461B07EC42AFF157D6", // uppercase
        allowedRouters,
      );
    }).not.toThrow();
  });

  it("should reject router not in whitelist", () => {
    expect(() => {
      validateSettlementRouter(
        "base-sepolia",
        "0x9999999999999999999999999999999999999999",
        allowedRouters,
      );
    }).toThrow(SettlementExtraError);
  });

  it("should throw SettlementExtraError with router address in message", () => {
    const routerAddress = "0x9999999999999999999999999999999999999999";

    expect(() => {
      validateSettlementRouter("base-sepolia", routerAddress, allowedRouters);
    }).toThrow(`Settlement router ${routerAddress} is not in whitelist`);
  });

  it("should reject router for network without allowed routers", () => {
    expect(() => {
      validateSettlementRouter(
        "unknown-network",
        "0x32431D4511e061F1133520461B07eC42afF157D6",
        allowedRouters,
      );
    }).toThrow(SettlementExtraError);
  });

  it("should throw error with network name for unconfigured network", () => {
    expect(() => {
      validateSettlementRouter(
        "unknown-network",
        "0x32431D4511e061F1133520461B07eC42afF157D6",
        allowedRouters,
      );
    }).toThrow("No allowed settlement routers configured for network: unknown-network");
  });

  it("should handle empty whitelist for network", () => {
    const emptyAllowedRouters = {
      "base-sepolia": [],
    };

    expect(() => {
      validateSettlementRouter(
        "base-sepolia",
        "0x32431D4511e061F1133520461B07eC42afF157D6",
        emptyAllowedRouters,
      );
    }).toThrow("No allowed settlement routers configured");
  });

  it("should handle multiple routers in whitelist", () => {
    expect(() => {
      validateSettlementRouter(
        "base-sepolia",
        "0x1234567890123456789012345678901234567890",
        allowedRouters,
      );
    }).not.toThrow();
  });
});

describe("settleWithRouter", () => {
  let mockWalletClient: any;
  let mockPaymentPayload: PaymentPayload;
  let mockPaymentRequirements: PaymentRequirements;
  let mockConfig: FacilitatorConfig;

  beforeEach(() => {
    // Mock wallet client with viem methods
    mockWalletClient = {
      writeContract: vi.fn(),
      waitForTransactionReceipt: vi.fn(),
    };

    mockPaymentPayload = {
      scheme: "exact",
      network: "base-sepolia",
      x402Version: 1,
      payload: {
        signature:
          "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890",
        authorization: {
          from: mockAddresses.from,
          to: mockAddresses.hub,
          value: "100000",
          validAfter: "0",
          validBefore: "1234567890",
          nonce: "0x" + "0".repeat(64),
        },
      },
    };

    mockPaymentRequirements = {
      scheme: "exact",
      network: "base-sepolia",
      maxAmountRequired: "100000",
      resource: "/api/test",
      description: "Test payment",
      mimeType: "application/json",
      payTo: "0x32431D4511e061F1133520461B07eC42afF157D6",
      maxTimeoutSeconds: 300,
      asset: mockAddresses.token,
      extra: {
        settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
        salt: "0x" + "1".repeat(64),
        payTo: mockAddresses.payTo,
        facilitatorFee: "10000",
        hook: mockAddresses.hook,
        hookData: "0x",
      },
    };

    mockConfig = {
      allowedRouters: {
        "base-sepolia": ["0x32431D4511e061F1133520461B07eC42afF157D6"],
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should successfully settle payment", async () => {
    const mockTxHash = "0xabcd1234";
    mockWalletClient.writeContract.mockResolvedValue(mockTxHash);
    mockWalletClient.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
    });

    const result = await settleWithRouter(
      mockWalletClient,
      mockPaymentPayload,
      mockPaymentRequirements,
      mockConfig,
    );

    expect(result.success).toBe(true);
    expect(result.transaction).toBe(mockTxHash);
    expect(result.network).toBe("base-sepolia");
    expect(result.payer).toBe(mockAddresses.from);
  });

  it("should call writeContract with correct parameters", async () => {
    mockWalletClient.writeContract.mockResolvedValue("0xhash");
    mockWalletClient.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
    });

    await settleWithRouter(
      mockWalletClient,
      mockPaymentPayload,
      mockPaymentRequirements,
      mockConfig,
    );

    expect(mockWalletClient.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: mockPaymentRequirements.extra.settlementRouter,
        functionName: "settleAndExecute",
        args: expect.arrayContaining([
          mockAddresses.token,
          mockAddresses.from,
          BigInt("100000"),
          BigInt("0"),
          BigInt("1234567890"),
          expect.any(String), // nonce
          expect.any(String), // signature
          mockPaymentRequirements.extra.salt,
          mockAddresses.payTo,
          BigInt("10000"),
          mockAddresses.hook,
          "0x",
        ]),
      }),
    );
  });

  it("should return failure when transaction status is not success", async () => {
    mockWalletClient.writeContract.mockResolvedValue("0xhash");
    mockWalletClient.waitForTransactionReceipt.mockResolvedValue({
      status: "reverted",
    });

    const result = await settleWithRouter(
      mockWalletClient,
      mockPaymentPayload,
      mockPaymentRequirements,
      mockConfig,
    );

    expect(result.success).toBe(false);
    expect(result.errorReason).toBe("invalid_transaction_state");
  });

  it("should fail when router is not in whitelist", async () => {
    const invalidRequirements = {
      ...mockPaymentRequirements,
      extra: {
        ...mockPaymentRequirements.extra,
        settlementRouter: "0x9999999999999999999999999999999999999999",
      },
    };

    const result = await settleWithRouter(
      mockWalletClient,
      mockPaymentPayload,
      invalidRequirements,
      mockConfig,
    );

    expect(result.success).toBe(false);
    expect(result.errorReason).toBe("invalid_payment_requirements");
  });

  it("should fail when extra field is missing", async () => {
    const invalidRequirements = {
      ...mockPaymentRequirements,
      extra: undefined,
    };

    const result = await settleWithRouter(
      mockWalletClient,
      mockPaymentPayload,
      invalidRequirements as any,
      mockConfig,
    );

    expect(result.success).toBe(false);
    expect(result.errorReason).toBe("invalid_payment_requirements");
  });

  it("should fail when signer lacks required methods", async () => {
    const invalidSigner = {}; // Missing writeContract and waitForTransactionReceipt

    const result = await settleWithRouter(
      invalidSigner,
      mockPaymentPayload,
      mockPaymentRequirements,
      mockConfig,
    );

    expect(result.success).toBe(false);
    expect(result.errorReason).toBe("unexpected_settle_error");
  });

  it("should handle writeContract errors", async () => {
    mockWalletClient.writeContract.mockRejectedValue(new Error("Transaction failed"));

    const result = await settleWithRouter(
      mockWalletClient,
      mockPaymentPayload,
      mockPaymentRequirements,
      mockConfig,
    );

    expect(result.success).toBe(false);
    expect(result.errorReason).toBe("unexpected_settle_error");
  });

  it("should handle ERC-6492 wrapped signatures", async () => {
    // For this test, we'll simply verify that settleWithRouter can process
    // any signature format, as parseErc6492Signature is mocked at module level
    // to return the signature as-is
    const erc6492Signature =
      "0x1234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890" as `0x${string}`;

    const payloadWithErc6492 = {
      ...mockPaymentPayload,
      payload: {
        ...mockPaymentPayload.payload,
        signature: erc6492Signature,
      },
    };

    mockWalletClient.writeContract.mockResolvedValue("0xhash");
    mockWalletClient.waitForTransactionReceipt.mockResolvedValue({
      status: "success",
    });

    const result = await settleWithRouter(
      mockWalletClient,
      payloadWithErc6492,
      mockPaymentRequirements,
      mockConfig,
    );

    expect(result.success).toBe(true);
    expect(mockWalletClient.writeContract).toHaveBeenCalled();
  });

  it("should extract payer from payload on error", async () => {
    mockWalletClient.writeContract.mockRejectedValue(new Error("Failed"));

    const result = await settleWithRouter(
      mockWalletClient,
      mockPaymentPayload,
      mockPaymentRequirements,
      mockConfig,
    );

    expect(result.payer).toBe(mockAddresses.from);
  });

  it("should handle missing settlementRouter in extra", async () => {
    const invalidRequirements = {
      ...mockPaymentRequirements,
      extra: {
        salt: "0x" + "1".repeat(64),
        payTo: mockAddresses.payTo,
        facilitatorFee: "10000",
        hook: mockAddresses.hook,
        hookData: "0x",
        // settlementRouter missing
      },
    };

    const result = await settleWithRouter(
      mockWalletClient,
      mockPaymentPayload,
      invalidRequirements as any,
      mockConfig,
    );

    expect(result.success).toBe(false);
    expect(result.errorReason).toBe("invalid_payment_requirements");
  });

  it("should handle missing salt in extra", async () => {
    const invalidRequirements = {
      ...mockPaymentRequirements,
      extra: {
        settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
        // salt missing
        payTo: mockAddresses.payTo,
        facilitatorFee: "10000",
        hook: mockAddresses.hook,
        hookData: "0x",
      },
    };

    const result = await settleWithRouter(
      mockWalletClient,
      mockPaymentPayload,
      invalidRequirements as any,
      mockConfig,
    );

    expect(result.success).toBe(false);
    expect(result.errorReason).toBe("invalid_payment_requirements");
  });
});
