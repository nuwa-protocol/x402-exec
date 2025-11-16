import { describe, it, expect } from "vitest";
import { parseDefaultAssetAmount, formatDefaultAssetAmount, AmountError } from "./amount.js";

describe("parseDefaultAssetAmount", () => {
  it("should parse dollar format", () => {
    expect(parseDefaultAssetAmount("$1", "base-sepolia")).toBe("1000000");
    expect(parseDefaultAssetAmount("$1.2", "base-sepolia")).toBe("1200000");
    expect(parseDefaultAssetAmount("$1.20", "base-sepolia")).toBe("1200000");
    expect(parseDefaultAssetAmount("$0.5", "base-sepolia")).toBe("500000");
    expect(parseDefaultAssetAmount("$ 1.2", "base-sepolia")).toBe("1200000"); // with space
  });

  it("should parse decimal string", () => {
    expect(parseDefaultAssetAmount("1", "base-sepolia")).toBe("1000000");
    expect(parseDefaultAssetAmount("1.2", "base-sepolia")).toBe("1200000");
    expect(parseDefaultAssetAmount("1.20", "base-sepolia")).toBe("1200000");
    expect(parseDefaultAssetAmount("0.5", "base-sepolia")).toBe("500000");
    expect(parseDefaultAssetAmount("0.0001", "base-sepolia")).toBe("100"); // minimum supported by x402's moneySchema
  });

  it("should parse number", () => {
    expect(parseDefaultAssetAmount(1, "base-sepolia")).toBe("1000000");
    expect(parseDefaultAssetAmount(1.2, "base-sepolia")).toBe("1200000");
    expect(parseDefaultAssetAmount(0.5, "base-sepolia")).toBe("500000");
  });

  it("should treat all string numbers as USD amounts (no atomic unit pass-through)", () => {
    // Previously ambiguous cases - now all treated as USD
    expect(parseDefaultAssetAmount("100", "base-sepolia")).toBe("100000000"); // 100 USDC, not 100 atomic units
    expect(parseDefaultAssetAmount("99", "base-sepolia")).toBe("99000000"); // 99 USDC
    expect(parseDefaultAssetAmount("1000000", "base-sepolia")).toBe("1000000000000"); // 1,000,000 USDC
  });

  it("should handle edge cases", () => {
    expect(parseDefaultAssetAmount("1", "base-sepolia")).toBe("1000000"); // "1" means 1 dollar
    expect(parseDefaultAssetAmount("1000000.123456", "base-sepolia")).toBe("1000000123456"); // large with decimals
  });

  it("should throw for invalid input", () => {
    expect(() => parseDefaultAssetAmount("", "base-sepolia")).toThrow(AmountError);
    expect(() => parseDefaultAssetAmount("abc", "base-sepolia")).toThrow(AmountError);
    expect(() => parseDefaultAssetAmount("$", "base-sepolia")).toThrow(AmountError);
    expect(() => parseDefaultAssetAmount("1.2.3", "base-sepolia")).toThrow(AmountError);
    expect(() => parseDefaultAssetAmount("0", "base-sepolia")).toThrow(AmountError);
    expect(() => parseDefaultAssetAmount("-1", "base-sepolia")).toThrow(AmountError);
    expect(() => parseDefaultAssetAmount(0, "base-sepolia")).toThrow(AmountError);
    expect(() => parseDefaultAssetAmount(-1, "base-sepolia")).toThrow(AmountError);
  });

  it("should require network parameter", () => {
    // Network parameter is now required - no default value
    expect(parseDefaultAssetAmount("1", "base-sepolia")).toBe("1000000");
    expect(parseDefaultAssetAmount("$5", "base-sepolia")).toBe("5000000");
  });

  it("should support different networks", () => {
    expect(parseDefaultAssetAmount("1", "base-sepolia")).toBe("1000000");
    expect(parseDefaultAssetAmount("1", "x-layer-testnet")).toBe("1000000");
  });
});

describe("formatDefaultAssetAmount", () => {
  it("should format atomic units to decimal", () => {
    expect(formatDefaultAssetAmount("1000000", "base-sepolia")).toBe("1");
    expect(formatDefaultAssetAmount("1200000", "base-sepolia")).toBe("1.2");
    expect(formatDefaultAssetAmount("500000", "base-sepolia")).toBe("0.5");
    expect(formatDefaultAssetAmount("1", "base-sepolia")).toBe("0.000001");
  });

  it("should remove trailing zeros", () => {
    expect(formatDefaultAssetAmount("1200000", "base-sepolia")).toBe("1.2");
    expect(formatDefaultAssetAmount("1000000", "base-sepolia")).toBe("1");
    expect(formatDefaultAssetAmount("100000", "base-sepolia")).toBe("0.1");
  });

  it("should handle edge cases", () => {
    expect(formatDefaultAssetAmount("0", "base-sepolia")).toBe("0");
    expect(formatDefaultAssetAmount("1", "base-sepolia")).toBe("0.000001");
    expect(formatDefaultAssetAmount("1000000000000", "base-sepolia")).toBe("1000000");
  });

  it("should require network parameter", () => {
    // Network parameter is now required - no default value
    expect(formatDefaultAssetAmount("1000000", "base-sepolia")).toBe("1");
    expect(formatDefaultAssetAmount("5000000", "base-sepolia")).toBe("5");
  });

  it("should support different networks", () => {
    expect(formatDefaultAssetAmount("1000000", "base-sepolia")).toBe("1");
    expect(formatDefaultAssetAmount("1000000", "x-layer-testnet")).toBe("1");
  });

  it("should throw for negative amounts", () => {
    expect(() => formatDefaultAssetAmount("-1", "base-sepolia")).toThrow(AmountError);
  });
});

describe("round-trip conversion", () => {
  it("should correctly round-trip parse and format", () => {
    const testCases = [
      { input: "1", expected: "1" },
      { input: "1.2", expected: "1.2" },
      { input: "0.5", expected: "0.5" },
      { input: "100", expected: "100" },
    ];

    for (const testCase of testCases) {
      const atomic = parseDefaultAssetAmount(testCase.input, "base-sepolia");
      const formatted = formatDefaultAssetAmount(atomic, "base-sepolia");
      expect(formatted).toBe(testCase.expected);
    }
  });
});
