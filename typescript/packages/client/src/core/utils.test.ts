import { describe, it, expect } from "vitest";
import {
  generateSalt,
  validateAddress,
  validateHex,
  validateAmount,
  calculateTimeWindow,
  formatFacilitatorUrl,
  parseAmount,
  formatAmount,
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

  describe("validateAddress", () => {
    it("should not throw for valid address", () => {
      expect(() =>
        validateAddress("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1", "address"),
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

  describe("parseAmount", () => {
    it("should parse dollar format", () => {
      expect(parseAmount("$1")).toBe("1000000");
      expect(parseAmount("$1.2")).toBe("1200000");
      expect(parseAmount("$1.20")).toBe("1200000");
      expect(parseAmount("$0.5")).toBe("500000");
      expect(parseAmount("$ 1.2")).toBe("1200000"); // with space
    });

    it("should parse decimal string", () => {
      expect(parseAmount("1")).toBe("1000000");
      expect(parseAmount("1.2")).toBe("1200000");
      expect(parseAmount("1.20")).toBe("1200000");
      expect(parseAmount("0.5")).toBe("500000");
      expect(parseAmount("0.0001")).toBe("100"); // minimum supported by x402's moneySchema
    });

    it("should parse number", () => {
      expect(parseAmount(1)).toBe("1000000");
      expect(parseAmount(1.2)).toBe("1200000");
      expect(parseAmount(0.5)).toBe("500000");
    });

    it("should pass through atomic units", () => {
      expect(parseAmount("1000000")).toBe("1000000");
      expect(parseAmount("1200000")).toBe("1200000");
      expect(parseAmount("500000")).toBe("500000");
      expect(parseAmount("100")).toBe("100"); // threshold: >= 100 treated as atomic
    });

    it("should handle edge cases", () => {
      expect(parseAmount("1")).toBe("1000000"); // "1" means 1 dollar, not 1 atomic unit
      expect(parseAmount("99")).toBe("99000000"); // < 100 treated as decimal
      expect(parseAmount("1000000.123456")).toBe("1000000123456"); // large with decimals
    });

    it("should throw for invalid input", () => {
      expect(() => parseAmount("")).toThrow(ValidationError);
      expect(() => parseAmount("abc")).toThrow(ValidationError);
      expect(() => parseAmount("$")).toThrow(ValidationError);
      expect(() => parseAmount("1.2.3")).toThrow(ValidationError);
      expect(() => parseAmount("0")).toThrow(ValidationError);
      expect(() => parseAmount("-1")).toThrow(ValidationError);
      expect(() => parseAmount(0)).toThrow(ValidationError);
      expect(() => parseAmount(-1)).toThrow(ValidationError);
    });

    it("should support custom decimals", () => {
      // x402's processPriceToAtomicAmount uses network name, not decimals
      // For now, parseAmount always uses the default network (base-sepolia with 6 decimals)
      // If you need custom decimals, use atomic units directly
      expect(parseAmount("1")).toBe("1000000");
      expect(parseAmount("1.5")).toBe("1500000");
    });
  });

  describe("formatAmount", () => {
    it("should format atomic units to decimal", () => {
      expect(formatAmount("1000000")).toBe("1");
      expect(formatAmount("1200000")).toBe("1.2");
      expect(formatAmount("500000")).toBe("0.5");
      expect(formatAmount("1")).toBe("0.000001");
    });

    it("should remove trailing zeros", () => {
      expect(formatAmount("1200000")).toBe("1.2");
      expect(formatAmount("1000000")).toBe("1");
      expect(formatAmount("100000")).toBe("0.1");
    });

    it("should handle edge cases", () => {
      expect(formatAmount("0")).toBe("0");
      expect(formatAmount("1")).toBe("0.000001");
      expect(formatAmount("1000000000000")).toBe("1000000");
    });

    it("should support custom decimals", () => {
      expect(formatAmount("1000000000000000000", 18)).toBe("1"); // ETH
      expect(formatAmount("1500000000000000000", 18)).toBe("1.5");
    });
  });

  describe("validateAmount", () => {
    it("should not throw for valid amounts", () => {
      expect(() => validateAmount("$1.2", "amount")).not.toThrow();
      expect(() => validateAmount("1.2", "amount")).not.toThrow();
      expect(() => validateAmount(1.2, "amount")).not.toThrow();
      expect(() => validateAmount("1000000", "amount")).not.toThrow();
    });

    it("should throw for invalid amounts", () => {
      expect(() => validateAmount("", "amount")).toThrow(ValidationError);
      expect(() => validateAmount("abc", "amount")).toThrow(ValidationError);
      expect(() => validateAmount("0", "amount")).toThrow(ValidationError);
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
