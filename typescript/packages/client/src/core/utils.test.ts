import { describe, it, expect } from "vitest";
import {
  generateSalt,
  normalizeAddress,
  validateAddress,
  validateHex,
  validateAmount,
  calculateTimeWindow,
  formatFacilitatorUrl,
} from "./utils.js";
import { ValidationError } from "../errors.js";

describe("utils", () => {
  describe("generateSalt", () => {
    it("should generate a 32-byte hex string", () => {
      const salt = generateSalt();
      expect(salt).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("should generate different salts each time", () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1).not.toBe(salt2);
    });
  });

  describe("normalizeAddress", () => {
    it("should normalize lowercase address to checksum format", () => {
      const result = normalizeAddress("0x742d35cc6634c0532925a3b844bc9e7595f0beb1");
      expect(result).toBe("0x742d35cC6634c0532925A3b844bc9E7595F0beB1");
    });

    it("should normalize mixed-case address to checksum format", () => {
      const result = normalizeAddress("0x742d35cC6634c0532925a3b844bc9e7595f0beb1");
      expect(result).toBe("0x742d35cC6634c0532925A3b844bc9E7595F0beB1");
    });

    it("should keep correct checksum address unchanged", () => {
      const result = normalizeAddress("0x742d35cC6634c0532925A3b844bc9E7595F0beB1");
      expect(result).toBe("0x742d35cC6634c0532925A3b844bc9E7595F0beB1");
    });

    it("should throw for invalid address", () => {
      expect(() => normalizeAddress("invalid")).toThrow(ValidationError);
      expect(() => normalizeAddress("0x123")).toThrow(ValidationError);
    });

    it("should throw for missing address", () => {
      expect(() => normalizeAddress("")).toThrow(ValidationError);
    });

    it("should use custom parameter name in error", () => {
      try {
        normalizeAddress("invalid", "hook");
      } catch (error: any) {
        expect(error.message).toContain("hook");
      }
    });
  });

  describe("validateAddress", () => {
    it("should not throw for valid checksum address", () => {
      expect(() =>
        validateAddress("0x742d35cC6634c0532925A3b844bc9E7595F0beB1", "address"),
      ).not.toThrow();
    });

    it("should not throw for valid lowercase address", () => {
      expect(() =>
        validateAddress("0x742d35cc6634c0532925a3b844bc9e7595f0beb1", "address"),
      ).not.toThrow();
    });

    it("should throw for invalid address", () => {
      expect(() => validateAddress("invalid", "address")).toThrow(ValidationError);
      expect(() => validateAddress("0x123", "address")).toThrow(ValidationError);
    });

    it("should throw for missing address", () => {
      expect(() => validateAddress("", "address")).toThrow(ValidationError);
    });
  });

  describe("validateHex", () => {
    it("should not throw for valid hex", () => {
      expect(() => validateHex("0x1234", "hex")).not.toThrow();
      expect(() => validateHex("0x", "hex")).not.toThrow();
    });

    it("should throw for invalid hex", () => {
      expect(() => validateHex("1234", "hex")).toThrow(ValidationError);
      expect(() => validateHex("0xGGGG", "hex")).toThrow(ValidationError);
    });

    it("should validate expected length", () => {
      expect(() => validateHex("0x1234", "hex", 2)).not.toThrow();
      expect(() => validateHex("0x1234", "hex", 3)).toThrow(ValidationError);
    });
  });

  describe("validateAmount", () => {
    it("should not throw for valid atomic unit amounts", () => {
      expect(() => validateAmount("1000000", "amount")).not.toThrow();
      expect(() => validateAmount("1", "amount")).not.toThrow();
      expect(() => validateAmount("999999999", "amount")).not.toThrow();
      expect(() => validateAmount(1000000, "amount")).not.toThrow(); // number converts to string
    });

    it("should throw for USD format amounts (not atomic units)", () => {
      expect(() => validateAmount("$1.2", "amount")).toThrow(ValidationError);
      expect(() => validateAmount("1.2", "amount")).toThrow(ValidationError);
      expect(() => validateAmount("0.5", "amount")).toThrow(ValidationError);
    });

    it("should throw for invalid amounts", () => {
      expect(() => validateAmount("", "amount")).toThrow(ValidationError);
      expect(() => validateAmount("abc", "amount")).toThrow(ValidationError);
      expect(() => validateAmount("0", "amount")).toThrow(ValidationError);
      expect(() => validateAmount("-1", "amount")).toThrow(ValidationError);
      expect(() => validateAmount("1.5", "amount")).toThrow(ValidationError);
    });

    it("should provide helpful error message for non-atomic units", () => {
      try {
        validateAmount("1.2", "amount");
      } catch (error: any) {
        expect(error.message).toContain("atomic units");
        expect(error.message).toContain("parseDefaultAssetAmount");
      }
    });
  });

  describe("calculateTimeWindow", () => {
    it("should return valid time window", () => {
      const window = calculateTimeWindow(300);
      expect(window).toHaveProperty("validAfter");
      expect(window).toHaveProperty("validBefore");

      const validAfter = parseInt(window.validAfter);
      const validBefore = parseInt(window.validBefore);
      expect(validBefore).toBeGreaterThan(validAfter);
    });
  });

  describe("formatFacilitatorUrl", () => {
    it("should remove trailing slash", () => {
      expect(formatFacilitatorUrl("https://example.com/")).toBe("https://example.com");
    });

    it("should keep URL without trailing slash", () => {
      expect(formatFacilitatorUrl("https://example.com")).toBe("https://example.com");
    });
  });
});
