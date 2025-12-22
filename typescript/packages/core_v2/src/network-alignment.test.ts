/**
 * Network alignment tests for v1 and v2 consistency
 *
 * Tests ensure that:
 * - v1 and v2 support the same set of networks
 * - every v1 network has a v2 mapping
 * - mapping is stable and complete
 * - API functions work correctly
 */

import { describe, it, expect } from "vitest";
import {
  getSupportedNetworksV2,
  getNetworkAliasesV1ToV2,
  toCanonicalNetworkKey,
  NETWORK_ALIASES_V1_TO_V2,
} from "./network-utils.js";

// Expected v1 networks based on the issue requirements and current configurations
const EXPECTED_V1_NETWORKS = [
  "base-sepolia",
  "x-layer-testnet",
  "skale-base-sepolia",
  "base",
  "x-layer",
  "bsc-testnet",
  "bsc",
] as const;

describe("Network Alignment (v1 ↔ v2)", () => {
  describe("Complete network coverage", () => {
    it("should have v2 mappings for all expected v1 networks", () => {
      const v2Aliases = getNetworkAliasesV1ToV2();

      // Every expected v1 network should have a mapping in v2
      EXPECTED_V1_NETWORKS.forEach((v1Network) => {
        expect(v2Aliases[v1Network]).toBeDefined();
        expect(v2Aliases[v1Network]).toMatch(/^eip155:\d+$/);
      });

      // Should have the same number of networks
      expect(Object.keys(v2Aliases).length).toBe(EXPECTED_V1_NETWORKS.length);
    });

    it("should include all CAIP-2 networks in v2 supported list", () => {
      const v2Aliases = getNetworkAliasesV1ToV2();
      const v2Networks = getSupportedNetworksV2();

      // All CAIP-2 identifiers from aliases should be in the supported list
      Object.values(v2Aliases).forEach((caip2Network) => {
        expect(v2Networks).toContain(caip2Network);
      });

      // Should have the same number of unique networks
      const uniqueCaip2Networks = new Set(Object.values(v2Aliases));
      expect(v2Networks.length).toBe(uniqueCaip2Networks.size);
    });

    it("should have no duplicate or missing network mappings", () => {
      const v1Networks = EXPECTED_V1_NETWORKS;
      const v2Aliases = getNetworkAliasesV1ToV2();
      const v2Networks = getSupportedNetworksV2();

      // Check for duplicates in v1 networks
      const v1NetworkSet = new Set(v1Networks);
      expect(v1NetworkSet.size).toBe(v1Networks.length);

      // Check for duplicates in CAIP-2 mappings
      const caip2Mappings = Object.values(v2Aliases);
      const caip2Set = new Set(caip2Mappings);
      expect(caip2Set.size).toBe(caip2Mappings.length);

      // Check that all CAIP-2 networks are unique
      const v2NetworkSet = new Set(v2Networks);
      expect(v2NetworkSet.size).toBe(v2Networks.length);
    });
  });

  describe("API function behavior", () => {
    it("getSupportedNetworksV2 should return all CAIP-2 networks", () => {
      const v2Networks = getSupportedNetworksV2();

      expect(Array.isArray(v2Networks)).toBe(true);
      expect(v2Networks.length).toBeGreaterThan(0);

      // All networks should be valid CAIP-2 identifiers
      v2Networks.forEach((network) => {
        expect(network).toMatch(/^eip155:\d+$/);
      });

      // Should return the expected networks
      const expectedNetworks = [
        "eip155:84532", // base-sepolia
        "eip155:1952",  // x-layer-testnet
        "eip155:324705682", // skale-base-sepolia
        "eip155:8453",  // base
        "eip155:196",   // x-layer
        "eip155:97",    // bsc-testnet
        "eip155:56",    // bsc
      ];

      expectedNetworks.forEach((expectedNetwork) => {
        expect(v2Networks).toContain(expectedNetwork);
      });
    });

    it("getNetworkAliasesV1ToV2 should return complete alias mapping", () => {
      const aliases = getNetworkAliasesV1ToV2();

      expect(typeof aliases).toBe("object");
      expect(aliases).not.toBeNull();

      // Should contain all expected v1 networks
      const expectedV1Networks = [
        "base-sepolia",
        "x-layer-testnet",
        "skale-base-sepolia",
        "base",
        "x-layer",
        "bsc-testnet",
        "bsc",
      ];

      expectedV1Networks.forEach((v1Network) => {
        expect(aliases[v1Network]).toBeDefined();
        expect(aliases[v1Network]).toMatch(/^eip155:\d+$/);
      });
    });

    describe("toCanonicalNetworkKey", () => {
      it("should handle v1 network names correctly", () => {
        expect(toCanonicalNetworkKey("base-sepolia")).toBe("eip155:84532");
        expect(toCanonicalNetworkKey("x-layer-testnet")).toBe("eip155:1952");
        expect(toCanonicalNetworkKey("skale-base-sepolia")).toBe("eip155:324705682");
        expect(toCanonicalNetworkKey("base")).toBe("eip155:8453");
        expect(toCanonicalNetworkKey("x-layer")).toBe("eip155:196");
        expect(toCanonicalNetworkKey("bsc-testnet")).toBe("eip155:97");
        expect(toCanonicalNetworkKey("bsc")).toBe("eip155:56");
      });

      it("should handle v2 CAIP-2 identifiers correctly", () => {
        expect(toCanonicalNetworkKey("eip155:84532")).toBe("eip155:84532");
        expect(toCanonicalNetworkKey("eip155:1952")).toBe("eip155:1952");
        expect(toCanonicalNetworkKey("eip155:324705682")).toBe("eip155:324705682");
        expect(toCanonicalNetworkKey("eip155:8453")).toBe("eip155:8453");
        expect(toCanonicalNetworkKey("eip155:196")).toBe("eip155:196");
        expect(toCanonicalNetworkKey("eip155:97")).toBe("eip155:97");
        expect(toCanonicalNetworkKey("eip155:56")).toBe("eip155:56");
      });

      it("should throw error for unsupported v1 networks", () => {
        expect(() => toCanonicalNetworkKey("ethereum")).toThrow(
          "Unsupported network: ethereum"
        );
        expect(() => toCanonicalNetworkKey("polygon")).toThrow(
          "Unsupported network: polygon"
        );
        expect(() => toCanonicalNetworkKey("")).toThrow(
          "Unsupported network:"
        );
      });

      it("should throw error for unsupported CAIP-2 networks", () => {
        expect(() => toCanonicalNetworkKey("eip155:1")).toThrow(
          "Unsupported CAIP-2 network: eip155:1"
        );
        expect(() => toCanonicalNetworkKey("eip155:137")).toThrow(
          "Unsupported CAIP-2 network: eip155:137"
        );
        expect(() => toCanonicalNetworkKey("eip155:invalid")).toThrow(); // Invalid format should throw
      });
    });
  });

  describe("Mapping stability", () => {
    it("should maintain stable mappings across calls", () => {
      const aliases1 = getNetworkAliasesV1ToV2();
      const aliases2 = getNetworkAliasesV1ToV2();

      expect(aliases1).toEqual(aliases2);
    });

    it("should have bijective relationship between v1 names and CAIP-2 IDs", () => {
      const aliases = getNetworkAliasesV1ToV2();
      const v1Networks = Object.keys(aliases);
      const caip2Networks = Object.values(aliases);

      // All v1 networks should be unique
      const v1Set = new Set(v1Networks);
      expect(v1Set.size).toBe(v1Networks.length);

      // All CAIP-2 networks should be unique
      const caip2Set = new Set(caip2Networks);
      expect(caip2Set.size).toBe(caip2Networks.length);

      // Should have same number of mappings
      expect(v1Networks.length).toBe(caip2Networks.length);
    });
  });

  describe("Chain ID consistency", () => {
    it("should use correct chain IDs for all networks", () => {
      const aliases = getNetworkAliasesV1ToV2();

      // Known chain ID mappings
      const expectedChainIds = {
        "base-sepolia": "84532",
        "x-layer-testnet": "1952",
        "skale-base-sepolia": "324705682",
        "base": "8453",
        "x-layer": "196",
        "bsc-testnet": "97",
        "bsc": "56",
      };

      Object.entries(expectedChainIds).forEach(([v1Network, expectedChainId]) => {
        const caip2Network = aliases[v1Network];
        expect(caip2Network).toBe(`eip155:${expectedChainId}`);
      });
    });
  });

  describe("Exported constants", () => {
    it("should export NETWORK_ALIASES_V1_TO_V2 constant", () => {
      expect(NETWORK_ALIASES_V1_TO_V2).toBeDefined();
      expect(typeof NETWORK_ALIASES_V1_TO_V2).toBe("object");
      expect(Object.keys(NETWORK_ALIASES_V1_TO_V2).length).toBeGreaterThan(0);

      // Should match the function return value
      const aliases = getNetworkAliasesV1ToV2();
      expect(NETWORK_ALIASES_V1_TO_V2).toEqual(aliases);
    });
  });
});