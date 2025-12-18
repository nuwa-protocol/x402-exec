/**
 * Tests for utils (addSettlementExtra with validation)
 */

import { describe, it, expect } from "vitest";
import { addSettlementExtra } from "./utils";
import { SettlementExtraError } from "./types";
import type { PaymentRequirements } from "./types";

describe("addSettlementExtra", () => {
  const baseRequirements: PaymentRequirements = {
    scheme: "exact",
    network: "eip155:84532", // base-sepolia
    maxAmountRequired: "100000",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    payTo: "0x1234567890123456789012345678901234567890",
    resource: "/api/payment",
    extra: {},
  };

  it("should add settlement extra with validation", () => {
    const requirements = addSettlementExtra(baseRequirements, {
      hook: "0x9876543210987654321098765432109876543210",
      hookData: "0x",
      facilitatorFee: "10000",
    });

    expect(requirements.extra.settlementRouter).toBe("0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb");
    expect(requirements.extra.payTo).toBe("0x1234567890123456789012345678901234567890");
    expect(requirements.extra.facilitatorFee).toBe("10000");
    expect(requirements.extra.hook).toBe("0x9876543210987654321098765432109876543210");
    expect(requirements.extra.hookData).toBe("0x");
    expect(requirements.extra.name).toBe("USDC");
    expect(requirements.extra.version).toBe("2");
    expect(requirements.extra.salt).toBeDefined();
    expect(requirements.extra.salt).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  it("should override payTo to settlementRouter in requirements", () => {
    const requirements = addSettlementExtra(baseRequirements, {
      hook: "0x9876543210987654321098765432109876543210",
      hookData: "0x",
    });

    expect(requirements.payTo).toBe("0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb");
    expect(requirements.extra.payTo).toBe("0x1234567890123456789012345678901234567890");
  });

  it("should use provided payTo parameter", () => {
    const customPayTo = "0xAbCdEf1234567890123456789012345678901234";

    const requirements = addSettlementExtra(baseRequirements, {
      hook: "0x9876543210987654321098765432109876543210",
      hookData: "0x",
      payTo: customPayTo,
    });

    expect(requirements.extra.payTo).toBe(customPayTo);
  });

  it("should use provided salt", () => {
    const customSalt = "0x" + "a".repeat(64);

    const requirements = addSettlementExtra(baseRequirements, {
      hook: "0x9876543210987654321098765432109876543210",
      hookData: "0x",
      salt: customSalt,
    });

    expect(requirements.extra.salt).toBe(customSalt);
  });

  it("should default facilitatorFee to 0", () => {
    const requirements = addSettlementExtra(baseRequirements, {
      hook: "0x9876543210987654321098765432109876543210",
      hookData: "0x",
    });

    expect(requirements.extra.facilitatorFee).toBe("0");
  });

  it("should preserve existing extra fields", () => {
    const requirementsWithExtra: PaymentRequirements = {
      ...baseRequirements,
      extra: {
        customField: "customValue",
      },
    };

    const requirements = addSettlementExtra(requirementsWithExtra, {
      hook: "0x9876543210987654321098765432109876543210",
      hookData: "0x",
    });

    expect(requirements.extra.customField).toBe("customValue");
  });

  it("should throw SettlementExtraError for invalid hook address", () => {
    expect(() =>
      addSettlementExtra(baseRequirements, {
        hook: "invalid",
        hookData: "0x",
      })
    ).toThrow(SettlementExtraError);
  });

  it("should throw SettlementExtraError for invalid hookData", () => {
    expect(() =>
      addSettlementExtra(baseRequirements, {
        hook: "0x9876543210987654321098765432109876543210",
        hookData: "not-hex",
      })
    ).toThrow(SettlementExtraError);
  });

  it("should throw SettlementExtraError for invalid facilitatorFee", () => {
    expect(() =>
      addSettlementExtra(baseRequirements, {
        hook: "0x9876543210987654321098765432109876543210",
        hookData: "0x",
        facilitatorFee: "-100",
      })
    ).toThrow(SettlementExtraError);
  });

  it("should throw SettlementExtraError for invalid salt", () => {
    expect(() =>
      addSettlementExtra(baseRequirements, {
        hook: "0x9876543210987654321098765432109876543210",
        hookData: "0x",
        salt: "0x1234", // not 32 bytes
      })
    ).toThrow(SettlementExtraError);
  });

  it("should work with base mainnet network", () => {
    const baseMainnetRequirements: PaymentRequirements = {
      ...baseRequirements,
      network: "eip155:8453", // base mainnet
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    };

    const requirements = addSettlementExtra(baseMainnetRequirements, {
      hook: "0x9876543210987654321098765432109876543210",
      hookData: "0x",
    });

    expect(requirements.extra.settlementRouter).toBe("0x73fc659Cd5494E69852bE8D9D23FE05Aab14b29B");
    expect(requirements.extra.name).toBe("USD Coin");
    expect(requirements.extra.version).toBe("2");
  });

  it("should preserve existing name/version from requirements.extra", () => {
    const requirementsWithEIP712: PaymentRequirements = {
      ...baseRequirements,
      extra: {
        name: "CustomAsset",
        version: "1",
      },
    };

    const requirements = addSettlementExtra(requirementsWithEIP712, {
      hook: "0x9876543210987654321098765432109876543210",
      hookData: "0x",
    });

    expect(requirements.extra.name).toBe("CustomAsset");
    expect(requirements.extra.version).toBe("1");
  });
});
