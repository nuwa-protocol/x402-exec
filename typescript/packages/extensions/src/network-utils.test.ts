/**
 * Tests for network utility functions
 */

import { describe, it, expect } from "vitest";

import {
  toCanonicalNetworkKey,
  getDefaultAsset,
  processPriceToAtomicAmount,
  parseMoneyToDecimal,
  getSupportedHumanReadableNetworks,
  getSupportedNetworkIds,
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
      "No default asset configured for network",
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

describe("getSupportedHumanReadableNetworks", () => {
  it("should return array of v1 network aliases", () => {
    const networks = getSupportedHumanReadableNetworks();
    expect(Array.isArray(networks)).toBe(true);
    expect(networks.length).toBeGreaterThan(0);
    expect(networks).toContain("base-sepolia");
    expect(networks).toContain("base");
    expect(networks).toContain("x-layer-testnet");
    expect(networks).toContain("x-layer");
    expect(networks).toContain("bsc-testnet");
    expect(networks).toContain("bsc");
  });

  it("should return all v1 network aliases that can be converted to CAIP-2", () => {
    const v1Networks = getSupportedHumanReadableNetworks();
    const caip2Networks = getSupportedNetworkIds();

    // All v1 networks should be convertible to CAIP-2
    v1Networks.forEach((v1Net) => {
      expect(() => toCanonicalNetworkKey(v1Net)).not.toThrow();
    });

    // Number of v1 and CAIP-2 networks should match
    expect(v1Networks.length).toBe(caip2Networks.length);
  });
});

describe("getSupportedNetworkIds", () => {
  it("should return array of CAIP-2 network identifiers", () => {
    const networks = getSupportedNetworkIds();
    expect(Array.isArray(networks)).toBe(true);
    expect(networks.length).toBeGreaterThan(0);
    expect(networks).toContain("eip155:84532");
    expect(networks).toContain("eip155:8453");
    expect(networks).toContain("eip155:1952");
    expect(networks).toContain("eip155:196");
    expect(networks).toContain("eip155:97");
    expect(networks).toContain("eip155:56");
  });

  it("should return all CAIP-2 network identifiers that start with eip155:", () => {
    const networks = getSupportedNetworkIds();
    networks.forEach((network) => {
      expect(network).toMatch(/^eip155:\d+$/);
    });
  });
});
