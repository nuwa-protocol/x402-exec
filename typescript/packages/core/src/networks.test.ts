import { describe, it, expect } from "vitest";
import { networks, getNetworkConfig, isNetworkSupported, getSupportedNetworks } from "./networks";

/**
 * Network-specific expected values for testing
 * This allows tests to be data-driven and avoids hardcoding expectations for each network
 */
const NETWORK_EXPECTATIONS = {
  "base-sepolia": {
    chainId: 84532,
    eip712Name: "USDC",
    eip712Version: "2",
    decimals: 6,
  },
  "x-layer-testnet": {
    chainId: 1952,
    eip712Name: "USDC_TEST",
    eip712Version: "2",
    decimals: 6,
  },
  "skale-base-sepolia": {
    chainId: 324705682,
    eip712Name: "Bridged USDC (SKALE Bridge)",
    eip712Version: "2",
    decimals: 6,
  },
  base: {
    chainId: 8453,
    eip712Name: "USD Coin",
    eip712Version: "2",
    decimals: 6,
  },
  "x-layer": {
    chainId: 196,
    eip712Name: "USD Coin",
    eip712Version: "2",
    decimals: 6,
  },
  "bsc-testnet": {
    chainId: 97,
    eip712Name: "x402 Wrapped USDT",
    eip712Version: "1", // BSC uses version "1"
    decimals: 18, // BSC uses 18 decimals
  },
  bsc: {
    chainId: 56,
    eip712Name: "x402 Wrapped USDT",
    eip712Version: "1", // BSC uses version "1"
    decimals: 18, // BSC uses 18 decimals
  },
} as const;

describe("networks", () => {
  // Data-driven test for all network configurations
  describe("network configurations", () => {
    Object.entries(NETWORK_EXPECTATIONS).forEach(([networkName, expectations]) => {
      describe(networkName, () => {
        it("should have complete configuration", () => {
          const network = networks[networkName];
          expect(network).toBeDefined();
          expect(network.chainId).toBe(expectations.chainId);
          expect(network.settlementRouter).toBeDefined();
          expect(network.defaultAsset).toBeDefined();
          expect(network.hooks.transfer).toBeDefined();
        });

        it("should have valid default asset configuration", () => {
          const defaultAsset = networks[networkName].defaultAsset;
          expect(defaultAsset.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
          expect(defaultAsset.eip712.name).toBe(expectations.eip712Name);
          expect(defaultAsset.eip712.version).toBe(expectations.eip712Version);
          expect(defaultAsset.decimals).toBe(expectations.decimals);
        });

        it("should have valid contract addresses", () => {
          const network = networks[networkName];
          expect(network.settlementRouter).toMatch(/^0x[0-9a-fA-F]{40}$/);
          expect(network.hooks.transfer).toMatch(/^0x[0-9a-fA-F]{40}$/);
        });
      });
    });
  });

  // Generic tests that apply to all networks
  it("should have at least one network configured", () => {
    const networkNames = Object.keys(networks);
    expect(networkNames.length).toBeGreaterThan(0);
  });

  it("all networks should have required fields", () => {
    Object.entries(networks).forEach(([networkName, config]) => {
      expect(config.chainId, `${networkName} should have chainId`).toBeTypeOf("number");
      expect(config.settlementRouter, `${networkName} should have settlementRouter`).toMatch(
        /^0x[0-9a-fA-F]{40}$/,
      );
      expect(config.defaultAsset, `${networkName} should have defaultAsset`).toBeDefined();
      expect(config.defaultAsset.address, `${networkName} should have defaultAsset.address`).toMatch(
        /^0x[0-9a-fA-F]{40}$/,
      );
      expect(
        config.defaultAsset.decimals,
        `${networkName} should have defaultAsset.decimals`,
      ).toBeGreaterThan(0);
      expect(
        config.defaultAsset.eip712.name,
        `${networkName} should have defaultAsset.eip712.name`,
      ).toBeTypeOf("string");
      expect(
        config.defaultAsset.eip712.version,
        `${networkName} should have defaultAsset.eip712.version`,
      ).toBeTypeOf("string");
      expect(config.hooks, `${networkName} should have hooks`).toBeDefined();
      expect(config.hooks.transfer, `${networkName} should have hooks.transfer`).toMatch(
        /^0x[0-9a-fA-F]{40}$/,
      );
    });
  });

  // Deterministic deployment tests - these verify that contracts deployed
  // with CREATE2 have the same address across different networks
  describe("deterministic deployments", () => {
    it("should have same settlementRouter address for BSC testnet and mainnet", () => {
      // BSC uses deterministic deployment - addresses should be the same
      const testnetRouter = networks["bsc-testnet"].settlementRouter.toLowerCase();
      const mainnetRouter = networks["bsc"].settlementRouter.toLowerCase();
      expect(testnetRouter).toBe(mainnetRouter);
    });

    it("should have same TransferHook address for BSC testnet and mainnet", () => {
      // BSC uses deterministic deployment - addresses should be the same
      const testnetHook = networks["bsc-testnet"].hooks.transfer.toLowerCase();
      const mainnetHook = networks["bsc"].hooks.transfer.toLowerCase();
      expect(testnetHook).toBe(mainnetHook);
    });

    it("should have same settlementRouter address for Base and X-Layer mainnets", () => {
      // Addresses should be the same (deterministic deployment)
      const baseRouter = networks["base"].settlementRouter.toLowerCase();
      const xlayerRouter = networks["x-layer"].settlementRouter.toLowerCase();
      expect(baseRouter).toBe(xlayerRouter);
    });

    it("should have same TransferHook address for Base and X-Layer mainnets", () => {
      // Addresses should be the same (deterministic deployment)
      const baseHook = networks["base"].hooks.transfer.toLowerCase();
      const xlayerHook = networks["x-layer"].hooks.transfer.toLowerCase();
      expect(baseHook).toBe(xlayerHook);
    });
  });
});

describe("getNetworkConfig", () => {
  // Test that getNetworkConfig returns correct config for each configured network
  Object.entries(NETWORK_EXPECTATIONS).forEach(([networkName, expectations]) => {
    it(`should return config for ${networkName}`, () => {
      const config = getNetworkConfig(networkName);

      expect(config).toBeDefined();
      expect(config.chainId).toBe(expectations.chainId);
      expect(config.settlementRouter).toBe(networks[networkName].settlementRouter);
      expect(config.defaultAsset.eip712.name).toBe(expectations.eip712Name);
      expect(config.defaultAsset.eip712.version).toBe(expectations.eip712Version);
      expect(config.defaultAsset.decimals).toBe(expectations.decimals);
    });
  });

  it("should throw error for unsupported network", () => {
    expect(() => {
      getNetworkConfig("unsupported-network" as any);
    }).toThrow("Unsupported network: unsupported-network");
  });

  it("should include supported networks list in error message", () => {
    expect(() => {
      getNetworkConfig("invalid" as any);
    }).toThrow("Supported networks:");
  });

  it("should return complete network config object with all required fields", () => {
    const supportedNetworks = getSupportedNetworks();
    expect(supportedNetworks.length).toBeGreaterThan(0);

    // Test the first network as a representative
    const config = getNetworkConfig(supportedNetworks[0]);

    expect(config).toHaveProperty("chainId");
    expect(config).toHaveProperty("settlementRouter");
    expect(config).toHaveProperty("defaultAsset");
    expect(config).toHaveProperty("hooks");
    expect(config.defaultAsset).toHaveProperty("address");
    expect(config.defaultAsset).toHaveProperty("decimals");
    expect(config.defaultAsset).toHaveProperty("eip712");
    expect(config.defaultAsset.eip712).toHaveProperty("name");
    expect(config.defaultAsset.eip712).toHaveProperty("version");
    expect(config.hooks).toHaveProperty("transfer");
  });

  it("should return valid address formats for all networks", () => {
    const supportedNetworks = getSupportedNetworks();

    supportedNetworks.forEach((networkName) => {
      const config = getNetworkConfig(networkName);
      expect(config.defaultAsset.address, `${networkName} address`).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(config.settlementRouter, `${networkName} router`).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(config.hooks.transfer, `${networkName} hook`).toMatch(/^0x[0-9a-fA-F]{40}$/);
    });
  });
});

describe("isNetworkSupported", () => {
  // Test all configured networks
  Object.keys(NETWORK_EXPECTATIONS).forEach((networkName) => {
    it(`should return true for ${networkName}`, () => {
      expect(isNetworkSupported(networkName)).toBe(true);
    });
  });

  it("should return false for unsupported networks", () => {
    const unsupportedNetworks = ["ethereum", "polygon", "arbitrum", "optimism", "avalanche"];
    unsupportedNetworks.forEach((network) => {
      expect(isNetworkSupported(network)).toBe(false);
    });
  });

  it("should return false for empty string", () => {
    expect(isNetworkSupported("")).toBe(false);
  });

  it("should return false for undefined network name", () => {
    expect(isNetworkSupported("undefined")).toBe(false);
  });

  it("should be case-sensitive", () => {
    // Test case sensitivity with the first supported network
    const firstNetwork = Object.keys(networks)[0];
    const upperCase = firstNetwork.toUpperCase();
    const titleCase = firstNetwork.charAt(0).toUpperCase() + firstNetwork.slice(1);

    expect(isNetworkSupported(upperCase)).toBe(false);
    expect(isNetworkSupported(titleCase)).toBe(false);
  });

  it("should handle network names with whitespace", () => {
    const firstNetwork = Object.keys(networks)[0];
    expect(isNetworkSupported(`${firstNetwork} `)).toBe(false);
    expect(isNetworkSupported(` ${firstNetwork}`)).toBe(false);
    expect(isNetworkSupported(` ${firstNetwork} `)).toBe(false);
  });
});

describe("getSupportedNetworks", () => {
  it("should return array of network names", () => {
    const networkList = getSupportedNetworks();

    expect(Array.isArray(networkList)).toBe(true);
    expect(networkList.length).toBeGreaterThan(0);
  });

  // Test that all configured networks are included
  Object.keys(NETWORK_EXPECTATIONS).forEach((networkName) => {
    it(`should include ${networkName}`, () => {
      const networkList = getSupportedNetworks();
      expect(networkList).toContain(networkName);
    });
  });

  it("should return all configured networks", () => {
    const networkList = getSupportedNetworks();
    const expectedCount = Object.keys(NETWORK_EXPECTATIONS).length;

    // Should match the number of networks in expectations
    expect(networkList.length).toBe(expectedCount);
  });

  it("should return unique network names", () => {
    const networkList = getSupportedNetworks();
    const uniqueNetworks = new Set(networkList);

    expect(uniqueNetworks.size).toBe(networkList.length);
  });

  it("should return networks that are all supported by isNetworkSupported", () => {
    const networkList = getSupportedNetworks();

    networkList.forEach((network) => {
      expect(isNetworkSupported(network)).toBe(true);
    });
  });

  it("should match keys in networks object", () => {
    const supportedNetworks = getSupportedNetworks();
    const networkKeys = Object.keys(networks);

    expect(supportedNetworks.sort()).toEqual(networkKeys.sort());
  });

  it("should have minimum expected number of networks", () => {
    const networkList = getSupportedNetworks();

    // Should have at least testnets and mainnets for Base, X-Layer, and BSC
    expect(networkList.length).toBeGreaterThanOrEqual(6);
  });
});
