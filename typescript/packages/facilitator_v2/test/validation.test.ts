/**
 * Tests for validation utilities
 */

import { describe, it, expect } from "vitest";
import {
  isValidEthereumAddress,
  isValidHex,
  isValid32ByteHex,
  isValid256BitHex,
  validateSettlementRouter,
  validateSettlementExtra,
  validateNetwork,
  validateFacilitatorConfig,
  validateGasLimit,
  validateGasMultiplier,
  validateFeeAmount,
  FacilitatorValidationError,
} from "../src/index.js";
import { MOCK_ADDRESSES, MOCK_VALUES, mockNetworkConfig } from "./mocks/viem.js";

describe("validation utilities", () => {
  describe("isValidEthereumAddress", () => {
    it("should return true for valid addresses", () => {
      expect(isValidEthereumAddress(MOCK_ADDRESSES.payer)).toBe(true);
      expect(isValidEthereumAddress("0x0000000000000000000000000000000000000000")).toBe(true);
    });

    it("should return false for invalid addresses", () => {
      expect(isValidEthereumAddress("invalid")).toBe(false);
      expect(isValidEthereumAddress("0x123")).toBe(false);
      expect(isValidEthereumAddress("0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")).toBe(false);
      expect(isValidEthereumAddress("1234567890123456789012345678901234567890")).toBe(false);
    });
  });

  describe("isValidHex", () => {
    it("should return true for valid hex strings", () => {
      expect(isValidHex("0x")).toBe(true);
      expect(isValidHex("0x1234")).toBe(true);
      expect(isValidHex("0xabcdef")).toBe(true);
      expect(isValidHex("0xABCDEF")).toBe(true);
    });

    it("should return false for invalid hex strings", () => {
      expect(isValidHex("1234")).toBe(false);
      expect(isValidHex("0x123")).toBe(false); // odd length
      expect(isValidHex("0xzzzz")).toBe(false);
    });
  });

  describe("isValid32ByteHex", () => {
    it("should return true for valid 32-byte hex", () => {
      expect(isValid32ByteHex(MOCK_VALUES.salt)).toBe(true);
      expect(isValid32ByteHex("0x1111111111111111111111111111111111111111111111111111111111111111")).toBe(true);
    });

    it("should return false for invalid 32-byte hex", () => {
      expect(isValid32ByteHex("0x1234")).toBe(false);
      expect(isValid32ByteHex("0x111111111111111111111111111111111111111111111111111111111111111")).toBe(false); // 63 chars
      expect(isValid32ByteHex("0x111111111111111111111111111111111111111111111111111111111111111111")).toBe(false); // 65 chars
    });
  });

  describe("isValid256BitHex", () => {
    it("should return true for valid 256-bit hex", () => {
      expect(isValid256BitHex("0x1")).toBe(true);
      expect(isValid256BitHex("0xFF")).toBe(true);
      expect(isValid256BitHex("0x" + "FF".repeat(32))).toBe(true);
    });

    it("should return false for invalid 256-bit hex", () => {
      expect(isValid256BitHex("0x" + "FF".repeat(33))).toBe(false); // > 256 bits
      expect(isValid256BitHex("0xGG")).toBe(false);
    });
  });

  describe("validateSettlementRouter", () => {
    it("should validate valid router address", () => {
      const result = validateSettlementRouter(
        "eip155:84532",
        MOCK_ADDRESSES.settlementRouter,
        { "eip155:84532": [MOCK_ADDRESSES.settlementRouter] },
        mockNetworkConfig
      );
      expect(result).toBe(MOCK_ADDRESSES.settlementRouter);
    });

    it("should throw for invalid router address", () => {
      expect(() => {
        validateSettlementRouter(
          "eip155:84532",
          "invalid-router",
          { "eip155:84532": [MOCK_ADDRESSES.settlementRouter] },
          mockNetworkConfig
        );
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for router not in allowed list", () => {
      expect(() => {
        validateSettlementRouter(
          "eip155:84532",
          MOCK_ADDRESSES.hook,
          { "eip155:84532": [MOCK_ADDRESSES.settlementRouter] },
          mockNetworkConfig
        );
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for router not matching network config", () => {
      const differentNetworkConfig = {
        ...mockNetworkConfig,
        settlementRouter: MOCK_ADDRESSES.hook,
      };

      expect(() => {
        validateSettlementRouter(
          "eip155:84532",
          MOCK_ADDRESSES.settlementRouter,
          undefined,
          differentNetworkConfig
        );
      }).toThrow(FacilitatorValidationError);
    });
  });

  describe("validateSettlementExtra", () => {
    it("should validate valid settlement extra", () => {
      const extra = {
        settlementRouter: MOCK_ADDRESSES.settlementRouter,
        salt: MOCK_VALUES.salt,
        payTo: MOCK_ADDRESSES.merchant,
        facilitatorFee: MOCK_VALUES.facilitatorFee,
        hook: MOCK_ADDRESSES.hook,
        hookData: MOCK_VALUES.hookData,
      };

      const result = validateSettlementExtra(extra);
      expect(result).toEqual(extra);
    });

    it("should throw for missing extra", () => {
      expect(() => {
        validateSettlementExtra(null);
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for missing settlementRouter", () => {
      const extra = {
        salt: MOCK_VALUES.salt,
        payTo: MOCK_ADDRESSES.merchant,
        facilitatorFee: MOCK_VALUES.facilitatorFee,
        hook: MOCK_ADDRESSES.hook,
        hookData: MOCK_VALUES.hookData,
      };

      expect(() => {
        validateSettlementExtra(extra);
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for invalid settlementRouter address", () => {
      const extra = {
        settlementRouter: "invalid-router",
        salt: MOCK_VALUES.salt,
        payTo: MOCK_ADDRESSES.merchant,
        facilitatorFee: MOCK_VALUES.facilitatorFee,
        hook: MOCK_ADDRESSES.hook,
        hookData: MOCK_VALUES.hookData,
      };

      expect(() => {
        validateSettlementExtra(extra);
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for invalid salt", () => {
      const extra = {
        settlementRouter: MOCK_ADDRESSES.settlementRouter,
        salt: "invalid-salt",
        payTo: MOCK_ADDRESSES.merchant,
        facilitatorFee: MOCK_VALUES.facilitatorFee,
        hook: MOCK_ADDRESSES.hook,
        hookData: MOCK_VALUES.hookData,
      };

      expect(() => {
        validateSettlementExtra(extra);
      }).toThrow(FacilitatorValidationError);
    });
  });

  describe("validateNetwork", () => {
    it("should validate valid network formats", () => {
      expect(validateNetwork("eip155:84532")).toBe("eip155:84532");
      expect(validateNetwork("base-sepolia")).toBe("base-sepolia");
      expect(validateNetwork("ethereum")).toBe("ethereum");
    });

    it("should throw for invalid network formats", () => {
      expect(() => {
        validateNetwork("");
      }).toThrow(FacilitatorValidationError);

      expect(() => {
        validateNetwork("invalid network!");
      }).toThrow(FacilitatorValidationError);

      expect(() => {
        validateNetwork("eip155:");
      }).toThrow(FacilitatorValidationError);
    });
  });

  describe("validateFacilitatorConfig", () => {
    it("should validate valid config", () => {
      const config = {
        signer: MOCK_ADDRESSES.facilitator,
        allowedRouters: {
          "eip155:84532": [MOCK_ADDRESSES.settlementRouter],
        },
        rpcUrls: {
          "eip155:84532": "https://sepolia.base.org",
        },
      };

      expect(() => {
        validateFacilitatorConfig(config);
      }).not.toThrow();
    });

    it("should throw for missing signer and privateKey", () => {
      expect(() => {
        validateFacilitatorConfig({});
      }).toThrow(FacilitatorValidationError);
    });

    it("should accept valid signer without privateKey", () => {
      expect(() => {
        validateFacilitatorConfig({
          signer: MOCK_ADDRESSES.facilitator,
        });
      }).not.toThrow();
    });

    it("should accept valid privateKey without signer", () => {
      expect(() => {
        validateFacilitatorConfig({
          privateKey: "0x" + "a".repeat(64),
        });
      }).not.toThrow();
    });

    it("should accept privateKey without 0x prefix", () => {
      expect(() => {
        validateFacilitatorConfig({
          privateKey: "a".repeat(64),
        });
      }).not.toThrow();
    });

    it("should throw for invalid privateKey format (too short)", () => {
      expect(() => {
        validateFacilitatorConfig({
          privateKey: "0x" + "a".repeat(32),
        });
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for invalid privateKey format (too long)", () => {
      expect(() => {
        validateFacilitatorConfig({
          privateKey: "0x" + "a".repeat(128),
        });
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for invalid privateKey format (non-hex)", () => {
      expect(() => {
        validateFacilitatorConfig({
          privateKey: "0x" + "z".repeat(64),
        });
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for invalid signer", () => {
      expect(() => {
        validateFacilitatorConfig({
          signer: "invalid-signer",
        });
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for invalid allowedRouters format", () => {
      expect(() => {
        validateFacilitatorConfig({
          signer: MOCK_ADDRESSES.facilitator,
          allowedRouters: {
            "eip155:84532": "not-an-array",
          },
        });
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for invalid router in allowed list", () => {
      expect(() => {
        validateFacilitatorConfig({
          signer: MOCK_ADDRESSES.facilitator,
          allowedRouters: {
            "eip155:84532": ["invalid-router"],
          },
        });
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for invalid RPC URL", () => {
      expect(() => {
        validateFacilitatorConfig({
          signer: MOCK_ADDRESSES.facilitator,
          rpcUrls: {
            "eip155:84532": "invalid-url",
          },
        });
      }).toThrow(FacilitatorValidationError);
    });
  });

  describe("validateGasLimit", () => {
    it("should validate valid gas limits", () => {
      expect(() => {
        validateGasLimit(1000000n);
      }).not.toThrow();

      expect(() => {
        validateGasLimit(5000000n);
      }).not.toThrow();
    });

    it("should throw for invalid gas limits", () => {
      expect(() => {
        validateGasLimit(0n);
      }).toThrow(FacilitatorValidationError);

      expect(() => {
        validateGasLimit(-1n);
      }).toThrow(FacilitatorValidationError);

      expect(() => {
        validateGasLimit(20000000n);
      }).toThrow(FacilitatorValidationError);
    });
  });

  describe("validateGasMultiplier", () => {
    it("should validate valid gas multipliers", () => {
      expect(() => {
        validateGasMultiplier(1.0);
      }).not.toThrow();

      expect(() => {
        validateGasMultiplier(1.5);
      }).not.toThrow();

      expect(() => {
        validateGasMultiplier(2.0);
      }).not.toThrow();
    });

    it("should throw for invalid gas multipliers", () => {
      expect(() => {
        validateGasMultiplier(0);
      }).toThrow(FacilitatorValidationError);

      expect(() => {
        validateGasMultiplier(-1);
      }).toThrow(FacilitatorValidationError);

      expect(() => {
        validateGasMultiplier(10);
      }).toThrow(FacilitatorValidationError);
    });
  });

  describe("validateFeeAmount", () => {
    it("should validate valid fee amounts", () => {
      expect(() => {
        validateFeeAmount("0x0");
      }).not.toThrow();

      expect(() => {
        validateFeeAmount("0x64"); // 100
      }).not.toThrow();

      expect(() => {
        validateFeeAmount("0x100", "0x50", "0x200");
      }).not.toThrow();
    });

    it("should throw for fee below minimum", () => {
      expect(() => {
        validateFeeAmount("0x30", "0x50"); // 48 < 80
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for fee above maximum", () => {
      expect(() => {
        validateFeeAmount("0x300", "0x50", "0x200"); // 768 > 512
      }).toThrow(FacilitatorValidationError);
    });

    it("should throw for negative fee", () => {
      expect(() => {
        validateFeeAmount("-0x1");
      }).toThrow(FacilitatorValidationError);
    });
  });
});