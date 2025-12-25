/**
 * Tests for helper functions
 */

import { describe, it, expect } from "vitest";
import {
  withRouterSettlement,
  isRouterSettlement,
  type WithRouterSettlementOptions,
} from "./helpers.js";
import { getRouterSettlementExtensionKey } from "./extensions.js";
import type { PaymentRequirements } from "./types.js";

describe("Helper Functions", () => {
  describe("withRouterSettlement", () => {
    const baseRequirements: Partial<PaymentRequirements> = {
      scheme: "exact",
      network: "base-sepolia", // Use V1 network name
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      amount: "1000000",
      payTo: "0x1234567890123456789012345678901234567890",
    };

    const settlementOptions: WithRouterSettlementOptions = {
      hook: "0x4DE234059C6CcC94B8fE1eb1BD24804794083569",
      hookData: "0x",
      facilitatorFee: "10000",
      payTo: "0x1234567890123456789012345678901234567890",
    };

    it("should add settlement router parameters", () => {
      const requirements = withRouterSettlement(baseRequirements, settlementOptions);

      expect(requirements.extra).toBeDefined();
      expect(requirements.extra?.settlementRouter).toBeDefined();
      expect(requirements.extra?.salt).toBeDefined();
      expect(requirements.extra?.payTo).toBe(settlementOptions.payTo);
      expect(requirements.extra?.facilitatorFee).toBe(settlementOptions.facilitatorFee);
      expect(requirements.extra?.hook).toBe(settlementOptions.hook);
      expect(requirements.extra?.hookData).toBe(settlementOptions.hookData);
    });

    it("should add EIP-712 domain info", () => {
      const requirements = withRouterSettlement(baseRequirements, settlementOptions);

      expect(requirements.extra?.name).toBeDefined();
      expect(requirements.extra?.version).toBeDefined();
    });

    it("should add extension declaration", () => {
      const requirements = withRouterSettlement(baseRequirements, settlementOptions);

      const extensionKey = getRouterSettlementExtensionKey();
      expect(requirements.extensions).toBeDefined();
      expect(requirements.extensions?.[extensionKey]).toBeDefined();
    });

    it("should use provided salt if given", () => {
      const customSalt = "0x1111111111111111111111111111111111111111111111111111111111111111";
      const requirements = withRouterSettlement(baseRequirements, {
        ...settlementOptions,
        salt: customSalt,
      });

      expect(requirements.extra?.salt).toBe(customSalt);
    });

    it("should generate salt if not provided", () => {
      const requirements = withRouterSettlement(baseRequirements, settlementOptions);

      expect(requirements.extra?.salt).toBeDefined();
      expect(requirements.extra?.salt).toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it("should use custom name and version if provided", () => {
      const requirements = withRouterSettlement(baseRequirements, {
        ...settlementOptions,
        name: "Custom Token",
        version: "2",
      });

      expect(requirements.extra?.name).toBe("Custom Token");
      expect(requirements.extra?.version).toBe("2");
    });

    it("should throw if network is missing", () => {
      expect(() => {
        withRouterSettlement({ ...baseRequirements, network: undefined }, settlementOptions);
      }).toThrow("Network is required");
    });

    it("should throw if asset is missing", () => {
      expect(() => {
        withRouterSettlement({ ...baseRequirements, asset: undefined }, settlementOptions);
      }).toThrow("Asset is required");
    });

    it("should preserve existing extra fields", () => {
      const requirementsWithExtra: Partial<PaymentRequirements> = {
        ...baseRequirements,
        extra: {
          customField: "custom value",
        },
      };

      const requirements = withRouterSettlement(requirementsWithExtra, settlementOptions);

      expect((requirements.extra as any).customField).toBe("custom value");
    });

    it("should preserve existing extensions", () => {
      const requirementsWithExtension: Partial<PaymentRequirements> = {
        ...baseRequirements,
        extensions: {
          "custom-extension": { info: { test: true } },
        },
      };

      const requirements = withRouterSettlement(requirementsWithExtension, settlementOptions);

      expect(requirements.extensions?.["custom-extension"]).toEqual({ info: { test: true } });
    });
  });

  describe("isRouterSettlement", () => {
    it("should return true for requirements with settlementRouter", () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "base-sepolia", // Use V1 network name
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        amount: "1000000",
        payTo: "0x1234567890123456789012345678901234567890",
        extra: {
          settlementRouter: "0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb",
          salt: "0x0000000000000000000000000000000000000000000000000000000000000000",
          payTo: "0x1234567890123456789012345678901234567890",
          facilitatorFee: "10000",
          hook: "0x4DE234059C6CcC94B8fE1eb1BD24804794083569",
          hookData: "0x",
        },
      };

      expect(isRouterSettlement(requirements)).toBe(true);
    });

    it("should return false for requirements without settlementRouter", () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "base-sepolia", // Use V1 network name
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        amount: "1000000",
        payTo: "0x1234567890123456789012345678901234567890",
      };

      expect(isRouterSettlement(requirements)).toBe(false);
    });

    it("should return false for requirements with empty extra", () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "base-sepolia", // Use V1 network name
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        amount: "1000000",
        payTo: "0x1234567890123456789012345678901234567890",
        extra: {},
      };

      expect(isRouterSettlement(requirements)).toBe(false);
    });
  });
});

