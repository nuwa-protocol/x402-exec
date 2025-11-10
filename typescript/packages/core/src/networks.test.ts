import { describe, it, expect } from "vitest";
import { networks, getNetworkConfig, isNetworkSupported, getSupportedNetworks } from "./networks";

describe("networks", () => {
  it("should contain base-sepolia configuration", () => {
    expect(networks["base-sepolia"]).toBeDefined();
    expect(networks["base-sepolia"].chainId).toBe(84532);
    expect(networks["base-sepolia"].settlementRouter).toBeDefined();
    expect(networks["base-sepolia"].usdc).toBeDefined();
    expect(networks["base-sepolia"].hooks.transfer).toBeDefined();
  });

  it("should contain x-layer-testnet configuration", () => {
    expect(networks["x-layer-testnet"]).toBeDefined();
    expect(networks["x-layer-testnet"].chainId).toBe(1952);
    expect(networks["x-layer-testnet"].settlementRouter).toBeDefined();
    expect(networks["x-layer-testnet"].usdc).toBeDefined();
    expect(networks["x-layer-testnet"].hooks.transfer).toBeDefined();
  });

  it("should have valid USDC configuration for base-sepolia", () => {
    const usdc = networks["base-sepolia"].usdc;
    expect(usdc.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(usdc.name).toBe("USDC");
    expect(usdc.version).toBe("2");
  });

  it("should have valid USDC configuration for x-layer-testnet", () => {
    const usdc = networks["x-layer-testnet"].usdc;
    expect(usdc.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(usdc.name).toBe("USDC_TEST"); // X-Layer testnet uses USDC_TEST name
    expect(usdc.version).toBe("2");
  });

  it("should have valid settlementRouter addresses", () => {
    expect(networks["base-sepolia"].settlementRouter).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(networks["x-layer-testnet"].settlementRouter).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("should have valid hook addresses", () => {
    expect(networks["base-sepolia"].hooks.transfer).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(networks["x-layer-testnet"].hooks.transfer).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });
});

describe("getNetworkConfig", () => {
  it("should return config for base-sepolia", () => {
    const config = getNetworkConfig("base-sepolia");

    expect(config).toBeDefined();
    expect(config.chainId).toBe(84532);
    expect(config.settlementRouter).toBe(networks["base-sepolia"].settlementRouter);
  });

  it("should return config for x-layer-testnet", () => {
    const config = getNetworkConfig("x-layer-testnet");

    expect(config).toBeDefined();
    expect(config.chainId).toBe(1952);
    expect(config.settlementRouter).toBe(networks["x-layer-testnet"].settlementRouter);
  });

  it("should throw error for unsupported network", () => {
    expect(() => {
      getNetworkConfig("unsupported-network");
    }).toThrow("Unsupported network: unsupported-network");
  });

  it("should include supported networks list in error message", () => {
    expect(() => {
      getNetworkConfig("invalid");
    }).toThrow("Supported networks:");
  });

  it("should return complete network config object", () => {
    const config = getNetworkConfig("base-sepolia");

    expect(config).toHaveProperty("chainId");
    expect(config).toHaveProperty("settlementRouter");
    expect(config).toHaveProperty("usdc");
    expect(config).toHaveProperty("hooks");
    expect(config.usdc).toHaveProperty("address");
    expect(config.usdc).toHaveProperty("name");
    expect(config.usdc).toHaveProperty("version");
    expect(config.hooks).toHaveProperty("transfer");
  });

  it("should return USDC config from x402 library", () => {
    const config = getNetworkConfig("base-sepolia");

    // Verify USDC address format
    expect(config.usdc.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(config.usdc.name).toBe("USDC");
    expect(config.usdc.version).toBe("2");
  });
});

describe("isNetworkSupported", () => {
  it("should return true for base-sepolia", () => {
    expect(isNetworkSupported("base-sepolia")).toBe(true);
  });

  it("should return true for x-layer-testnet", () => {
    expect(isNetworkSupported("x-layer-testnet")).toBe(true);
  });

  it("should return false for unsupported network", () => {
    expect(isNetworkSupported("ethereum")).toBe(false);
    expect(isNetworkSupported("polygon")).toBe(false);
    expect(isNetworkSupported("base")).toBe(false);
  });

  it("should return false for empty string", () => {
    expect(isNetworkSupported("")).toBe(false);
  });

  it("should return false for undefined network name", () => {
    expect(isNetworkSupported("undefined")).toBe(false);
  });

  it("should be case-sensitive", () => {
    expect(isNetworkSupported("Base-Sepolia")).toBe(false);
    expect(isNetworkSupported("BASE-SEPOLIA")).toBe(false);
  });

  it("should handle network names with extra characters", () => {
    expect(isNetworkSupported("base-sepolia ")).toBe(false);
    expect(isNetworkSupported(" base-sepolia")).toBe(false);
  });
});

describe("getSupportedNetworks", () => {
  it("should return array of network names", () => {
    const networks = getSupportedNetworks();

    expect(Array.isArray(networks)).toBe(true);
    expect(networks.length).toBeGreaterThan(0);
  });

  it("should include base-sepolia", () => {
    const networks = getSupportedNetworks();

    expect(networks).toContain("base-sepolia");
  });

  it("should include x-layer-testnet", () => {
    const networks = getSupportedNetworks();

    expect(networks).toContain("x-layer-testnet");
  });

  it("should return all configured networks", () => {
    const networks = getSupportedNetworks();

    // Should match the number of networks in the config
    expect(networks.length).toBeGreaterThanOrEqual(2);
  });

  it("should return unique network names", () => {
    const networks = getSupportedNetworks();
    const uniqueNetworks = new Set(networks);

    expect(uniqueNetworks.size).toBe(networks.length);
  });

  it("should return networks that are supported by isNetworkSupported", () => {
    const networks = getSupportedNetworks();

    networks.forEach((network) => {
      expect(isNetworkSupported(network)).toBe(true);
    });
  });

  it("should match keys in networks object", () => {
    const supportedNetworks = getSupportedNetworks();
    const networkKeys = Object.keys(networks);

    expect(supportedNetworks.sort()).toEqual(networkKeys.sort());
  });
});
