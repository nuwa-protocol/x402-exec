import { describe, it, expect, vi, beforeEach } from "vitest";
import { addSettlementExtra } from "./utils";
import type { PaymentRequirements } from "./types";
import { mockAddresses } from "./__tests__/fixtures";
import { networks } from "./networks";

// Mock the dependencies
vi.mock("./networks", async () => {
  const actual = await vi.importActual<typeof import("./networks")>("./networks");
  return {
    ...actual,
    getNetworkConfig: vi.fn((network: string) => {
      const config = actual.networks[network];
      if (!config) {
        throw new Error(`Unsupported network: ${network}`);
      }
      return config;
    }),
  };
});

vi.mock("./commitment", () => ({
  generateSalt: vi.fn(() => "0x" + "9".repeat(64)),
}));

describe("addSettlementExtra", () => {
  let baseRequirements: PaymentRequirements;

  beforeEach(() => {
    vi.clearAllMocks();

    baseRequirements = {
      scheme: "exact",
      network: "base-sepolia",
      maxAmountRequired: "100000",
      resource: "/api/test",
      description: "Test payment",
      mimeType: "application/json",
      payTo: mockAddresses.payTo,
      maxTimeoutSeconds: 300,
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    };
  });

  it("should add settlement extra with all required fields", () => {
    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
      facilitatorFee: "10000",
      payTo: mockAddresses.payTo,
    });

    expect(result.extra).toBeDefined();
    expect(result.extra).toMatchObject({
      name: "USDC",
      version: "2",
      settlementRouter: networks["base-sepolia"].settlementRouter,
      salt: expect.stringMatching(/^0x[0-9a-fA-F]{64}$/),
      payTo: mockAddresses.payTo,
      facilitatorFee: "10000",
      hook: mockAddresses.hook,
      hookData: "0x",
    });
  });

  it("should override payTo to point to SettlementRouter", () => {
    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
      facilitatorFee: "10000",
      payTo: mockAddresses.payTo,
    });

    expect(result.payTo).toBe(networks["base-sepolia"].settlementRouter);
    expect(result.payTo).not.toBe(baseRequirements.payTo);
  });

  it("should auto-generate salt when not provided", () => {
    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
    });

    expect(result.extra.salt).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it("should use provided salt when given", () => {
    const customSalt = "0x" + "1".repeat(64);

    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
      salt: customSalt,
    });

    expect(result.extra.salt).toBe(customSalt);
  });

  it("should use requirements.payTo when payTo not provided in params", () => {
    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
    });

    expect(result.extra.payTo).toBe(baseRequirements.payTo);
  });

  it('should default facilitatorFee to "0" when not provided', () => {
    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
    });

    expect(result.extra.facilitatorFee).toBe("0");
  });

  it("should preserve existing extra fields from requirements", () => {
    const requirementsWithExtra = {
      ...baseRequirements,
      extra: {
        customField: "customValue",
        anotherField: 123,
      },
    };

    const result = addSettlementExtra(requirementsWithExtra, {
      hook: mockAddresses.hook,
      hookData: "0x",
    });

    expect(result.extra).toMatchObject({
      customField: "customValue",
      anotherField: 123,
      settlementRouter: expect.any(String),
      hook: mockAddresses.hook,
      hookData: "0x",
    });
  });

  it("should preserve name and version from existing extra", () => {
    const requirementsWithExtra = {
      ...baseRequirements,
      extra: {
        name: "Custom Token",
        version: "3",
      },
    };

    const result = addSettlementExtra(requirementsWithExtra, {
      hook: mockAddresses.hook,
      hookData: "0x",
    });

    expect(result.extra.name).toBe("Custom Token");
    expect(result.extra.version).toBe("3");
  });

  it("should use config values as fallback when extra fields missing", () => {
    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
    });

    expect(result.extra.name).toBe("USDC");
    expect(result.extra.version).toBe("2");
  });

  it("should handle different networks correctly", () => {
    const xlayerRequirements = {
      ...baseRequirements,
      network: "x-layer-testnet",
    };

    const result = addSettlementExtra(xlayerRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
    });

    expect(result.extra.settlementRouter).toBe(networks["x-layer-testnet"].settlementRouter);
    expect(result.payTo).toBe(networks["x-layer-testnet"].settlementRouter);
  });

  it("should handle empty hookData", () => {
    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
    });

    expect(result.extra.hookData).toBe("0x");
  });

  it("should handle non-empty hookData", () => {
    const hookData = "0x1234567890abcdef";

    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData,
    });

    expect(result.extra.hookData).toBe(hookData);
  });

  it("should preserve all original requirements fields", () => {
    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
    });

    expect(result.scheme).toBe(baseRequirements.scheme);
    expect(result.network).toBe(baseRequirements.network);
    expect(result.maxAmountRequired).toBe(baseRequirements.maxAmountRequired);
    expect(result.resource).toBe(baseRequirements.resource);
    expect(result.description).toBe(baseRequirements.description);
    expect(result.mimeType).toBe(baseRequirements.mimeType);
    expect(result.maxTimeoutSeconds).toBe(baseRequirements.maxTimeoutSeconds);
    expect(result.asset).toBe(baseRequirements.asset);
  });

  it("should handle zero facilitatorFee", () => {
    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
      facilitatorFee: "0",
    });

    expect(result.extra.facilitatorFee).toBe("0");
  });

  it("should handle large facilitatorFee", () => {
    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
      facilitatorFee: "999999999999",
    });

    expect(result.extra.facilitatorFee).toBe("999999999999");
  });

  it("should create valid PaymentRequirements for settlement mode", () => {
    const result = addSettlementExtra(baseRequirements, {
      hook: mockAddresses.hook,
      hookData: "0x",
      facilitatorFee: "10000",
      payTo: mockAddresses.payTo,
    });

    // Verify all required fields for settlement
    expect(result.payTo).toBe(networks["base-sepolia"].settlementRouter);
    expect(result.extra.settlementRouter).toBeDefined();
    expect(result.extra.salt).toBeDefined();
    expect(result.extra.payTo).toBeDefined();
    expect(result.extra.facilitatorFee).toBeDefined();
    expect(result.extra.hook).toBeDefined();
    expect(result.extra.hookData).toBeDefined();
  });
});
