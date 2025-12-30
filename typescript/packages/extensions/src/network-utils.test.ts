/**
 * Tests for network utility functions
 */

import { describe, it, expect } from "vitest";

import {
  toCanonicalNetworkKey,
  getDefaultAsset,
  processPriceToAtomicAmount,
  parseMoneyToDecimal,
} from "./network-utils";

describe("toCanonicalNetworkKey", () => {
  it("should return correct CAIP-2 network ID for base-sepolia", () => {
    expect(toCanonicalNetworkKey("base-sepolia")).toBe("eip155:84532");
  });

  it("should return correct CAIP-2 network ID for base", () => {
    expect(toCanonicalNetworkKey("base")).toBe("eip155:8453");
  });

  it("should throw error for unsupported network", () => {
    expect(() => toCanonicalNetworkKey("unknown-network")).toThrow("Unsupported network");
  });
});

describe("getDefaultAsset", () => {
  it("should return USDC config for base-sepolia", () => {
    const asset = getDefaultAsset("eip155:84532");
    expect(asset.address).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
    expect(asset.decimals).toBe(6);
    expect(asset.eip712.name).toBe("USDC");
    expect(asset.eip712.version).toBe("2");
  });

  it("should throw error for unsupported network", () => {
    expect(() => getDefaultAsset("eip155:99999" as any)).toThrow(
      "Unsupported CAIP-2 network",
    );
  });
});

describe("parseMoneyToDecimal", () => {
  it("should parse dollar amount", () => {
    expect(parseMoneyToDecimal("$1.50")).toBe(1.5);
  });

  it("should parse decimal string", () => {
    expect(parseMoneyToDecimal("1.50")).toBe(1.5);
  });

  it("should parse number", () => {
    expect(parseMoneyToDecimal(1.5)).toBe(1.5);
  });

  it("should throw error for invalid format", () => {
    expect(() => parseMoneyToDecimal("invalid")).toThrow("Invalid money format");
  });
});

describe("processPriceToAtomicAmount", () => {
  it("should convert decimal to atomic units correctly", () => {
    const result = processPriceToAtomicAmount("1.5", "eip155:84532");
    expect(result).toEqual({ amount: "1500000" });
  });

  it("should handle whole numbers", () => {
    const result = processPriceToAtomicAmount("1", "eip155:84532");
    expect(result).toEqual({ amount: "1000000" });
  });

  it("should handle small decimals without precision loss", () => {
    // Test case for floating-point precision issue (0.1 * 10^6 should be exactly 100000)
    const result = processPriceToAtomicAmount("0.1", "eip155:84532");
    expect(result).toEqual({ amount: "100000" });
  });

  it("should handle dollar sign", () => {
    const result = processPriceToAtomicAmount("$0.5", "eip155:84532");
    expect(result).toEqual({ amount: "500000" });
  });

  it("should return error for invalid network", () => {
    const result = processPriceToAtomicAmount("1.5", "eip155:99999" as any);
    expect(result).toHaveProperty("error");
  });
});
