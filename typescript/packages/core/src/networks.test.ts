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

  it("should contain base mainnet configuration", () => {
    expect(networks["base"]).toBeDefined();
    expect(networks["base"].chainId).toBe(8453);
    expect(networks["base"].settlementRouter).toBeDefined();
    expect(networks["base"].usdc).toBeDefined();
    expect(networks["base"].hooks.transfer).toBeDefined();
  });

  it("should contain x-layer mainnet configuration", () => {
    expect(networks["x-layer"]).toBeDefined();
    expect(networks["x-layer"].chainId).toBe(196);
    expect(networks["x-layer"].settlementRouter).toBeDefined();
    expect(networks["x-layer"].usdc).toBeDefined();
    expect(networks["x-layer"].hooks.transfer).toBeDefined();
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

  it("should have valid USDC configuration for base mainnet", () => {
    const usdc = networks["base"].usdc;
    expect(usdc.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(usdc.name).toBe("USD Coin"); // Base mainnet uses "USD Coin" as the name
    expect(usdc.version).toBe("2");
  });

  it("should have valid USDC configuration for x-layer mainnet", () => {
    const usdc = networks["x-layer"].usdc;
    expect(usdc.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(usdc.name).toBe("USDC");
    expect(usdc.version).toBe("2");
  });

  it("should have valid settlementRouter addresses", () => {
    expect(networks["base-sepolia"].settlementRouter).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(networks["x-layer-testnet"].settlementRouter).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(networks["base"].settlementRouter).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(networks["x-layer"].settlementRouter).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("should have valid hook addresses", () => {
    expect(networks["base-sepolia"].hooks.transfer).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(networks["x-layer-testnet"].hooks.transfer).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(networks["base"].hooks.transfer).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(networks["x-layer"].hooks.transfer).toMatch(/^0x[0-9a-fA-F]{40}$/);
  });

  it("should have same settlementRouter address for base and x-layer mainnets", () => {
    // Addresses should be the same (deterministic deployment)
    const baseRouter = networks["base"].settlementRouter.toLowerCase();
    const xlayerRouter = networks["x-layer"].settlementRouter.toLowerCase();
    expect(baseRouter).toBe(xlayerRouter);
  });

  it("should have same TransferHook address for base and x-layer mainnets", () => {
    // Addresses should be the same (deterministic deployment)
    const baseHook = networks["base"].hooks.transfer.toLowerCase();
    const xlayerHook = networks["x-layer"].hooks.transfer.toLowerCase();
    expect(baseHook).toBe(xlayerHook);
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

  it("should return true for base mainnet", () => {
    expect(isNetworkSupported("base")).toBe(true);
  });

  it("should return true for x-layer mainnet", () => {
    expect(isNetworkSupported("x-layer")).toBe(true);
  });

  it("should return false for unsupported network", () => {
    expect(isNetworkSupported("ethereum")).toBe(false);
    expect(isNetworkSupported("polygon")).toBe(false);
    expect(isNetworkSupported("arbitrum")).toBe(false);
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

  it("should include base mainnet", () => {
    const networks = getSupportedNetworks();

    expect(networks).toContain("base");
  });

  it("should include x-layer mainnet", () => {
    const networks = getSupportedNetworks();

    expect(networks).toContain("x-layer");
  });

  it("should return all configured networks", () => {
    const networks = getSupportedNetworks();

    // Should match the number of networks in the config (2 testnets + 2 mainnets)
    expect(networks.length).toBeGreaterThanOrEqual(4);
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
