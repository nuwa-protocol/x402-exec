/**
 * Tests for config.ts
 *
 * Tests configuration parsing and validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { loadConfig } from "../../src/config.js";


// Mock networkChainResolver
vi.mock("../../src/network-chain-resolver.js", () => ({
  networkChainResolver: {
    isInitialized: vi.fn(() => true),
    initialize: vi.fn(() => Promise.resolve()),
    getAllRpcUrls: vi.fn(() => Promise.resolve({
      "base-sepolia": "https://sepolia.base.org",
      "base": "https://mainnet.base.org",
      "x-layer-testnet": "https://rpc.xlayer-testnet.xyz",
      "x-layer": "https://rpc.xlayer.xyz",
    })),
  },
}));

// Mock @x402x/core to return test networks
vi.mock("@x402x/core", () => ({
  getSupportedNetworks: vi.fn(() => ["base-sepolia", "base", "x-layer-testnet", "x-layer"]),
  getNetworkConfig: vi.fn((network: string) => {
    const configs: Record<string, any> = {
      "base-sepolia": {
        settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
        defaultAsset: {
          address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          symbol: "USDC",
          decimals: 6,
        },
      },
      "x-layer-testnet": {
        settlementRouter: "0x1ae0e196dc18355af3a19985faf67354213f833d",
        defaultAsset: {
          address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
          symbol: "USDC",
          decimals: 6,
        },
      },
    };
    return configs[network] || {
      defaultAsset: {
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        symbol: "USDC",
        decimals: 6,
      },
    };
  }),
  isNetworkSupported: vi.fn((network: string) =>
    ["base-sepolia", "base", "x-layer-testnet", "x-layer"].includes(network),
  ),
}));

describe("config", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("loadConfig", () => {
    it("should load config with default values", async () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";
      // Clear PORT to use default
      delete process.env.PORT;

      const config = await loadConfig();

      expect(config).toBeDefined();
      expect(config.cache.enabled).toBe(true);
      expect(config.cache.ttlTokenVersion).toBe(3600);
      expect(config.server.port).toBe(3000);
      expect(config.accountPool.strategy).toBe("round_robin");
    });

    it("should load custom port from environment", async () => {
      process.env.PORT = "8080";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config.server.port).toBe(8080);
    });

    it("should disable cache when CACHE_ENABLED=false", async () => {
      process.env.CACHE_ENABLED = "false";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config.cache.enabled).toBe(false);
    });

    it("should load custom cache TTL values", async () => {
      process.env.CACHE_TTL_TOKEN_VERSION = "7200";
      process.env.CACHE_TTL_TOKEN_METADATA = "14400";
      process.env.CACHE_MAX_KEYS = "2000";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config.cache.ttlTokenVersion).toBe(7200);
      expect(config.cache.ttlTokenMetadata).toBe(14400);
      expect(config.cache.maxKeys).toBe(2000);
    });

    it("should load account selection strategy", async () => {
      process.env.ACCOUNT_SELECTION_STRATEGY = "random";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config.accountPool.strategy).toBe("random");
    });

    it("should throw on invalid account selection strategy", () => {
      process.env.ACCOUNT_SELECTION_STRATEGY = "invalid";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      expect(async () => await loadConfig()).rejects.toThrow("Invalid ACCOUNT_SELECTION_STRATEGY");
    });

    it("should load default queue depth values", async () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config.accountPool.maxQueueDepth).toBe(10);
      expect(config.accountPool.queueDepthWarning).toBe(8); // 80% of 10, rounded up
    });

    it("should load custom queue depth values", async () => {
      process.env.ACCOUNT_POOL_MAX_QUEUE_DEPTH = "25";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config.accountPool.maxQueueDepth).toBe(25);
      expect(config.accountPool.queueDepthWarning).toBe(20); // 80% of 25, rounded up
    });

    it("should calculate queue depth warning correctly for odd numbers", async () => {
      process.env.ACCOUNT_POOL_MAX_QUEUE_DEPTH = "7";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config.accountPool.maxQueueDepth).toBe(7);
      expect(config.accountPool.queueDepthWarning).toBe(6); // 80% of 7 = 5.6, rounded up to 6
    });

    it("should throw on invalid maxQueueDepth (NaN)", async () => {
      process.env.ACCOUNT_POOL_MAX_QUEUE_DEPTH = "invalid";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      expect(async () => await loadConfig()).rejects.toThrow(
        "Invalid ACCOUNT_POOL_MAX_QUEUE_DEPTH: invalid. Must be a positive integer.",
      );
    });

    it("should throw on invalid maxQueueDepth (negative)", async () => {
      process.env.ACCOUNT_POOL_MAX_QUEUE_DEPTH = "-5";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      expect(async () => await loadConfig()).rejects.toThrow(
        "Invalid ACCOUNT_POOL_MAX_QUEUE_DEPTH: -5. Must be a positive integer.",
      );
    });

    it("should throw on maxQueueDepth too large", async () => {
      process.env.ACCOUNT_POOL_MAX_QUEUE_DEPTH = "2000";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      expect(async () => await loadConfig()).rejects.toThrow(
        "ACCOUNT_POOL_MAX_QUEUE_DEPTH too large: 2000. Maximum allowed is 1000.",
      );
    });
  });

  describe("private keys loading", () => {
    it("should load single EVM private key", async () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config.evmPrivateKeys).toHaveLength(1);
      expect(config.evmPrivateKeys[0]).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      );
    });

    it("should load numbered EVM private keys", async () => {
      process.env.EVM_PRIVATE_KEY_1 =
        "0x0000000000000000000000000000000000000000000000000000000000000001";
      process.env.EVM_PRIVATE_KEY_2 =
        "0x0000000000000000000000000000000000000000000000000000000000000002";
      process.env.EVM_PRIVATE_KEY_3 =
        "0x0000000000000000000000000000000000000000000000000000000000000003";

      const config = await loadConfig();

      expect(config.evmPrivateKeys).toHaveLength(3);
      expect(config.evmPrivateKeys[0]).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      );
      expect(config.evmPrivateKeys[1]).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000002",
      );
    });

    it("should prioritize numbered keys over single key", async () => {
      process.env.EVM_PRIVATE_KEY = "0xsingle";
      process.env.EVM_PRIVATE_KEY_1 =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config.evmPrivateKeys).toHaveLength(1);
      expect(config.evmPrivateKeys[0]).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      );
    });
  });

  describe("settlement router whitelist", () => {
    it("should load default settlement router addresses", async () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config.allowedSettlementRouters).toBeDefined();
      expect(config.allowedSettlementRouters["base-sepolia"]).toContain(
        "0x32431D4511e061F1133520461B07eC42afF157D6",
      );
      expect(config.allowedSettlementRouters["x-layer-testnet"]).toContain(
        "0x1ae0e196dc18355af3a19985faf67354213f833d",
      );
    });

    it("should load custom settlement router addresses", async () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";
      process.env.BASE_SEPOLIA_SETTLEMENT_ROUTER_ADDRESS = "0xcustom";

      const config = await loadConfig();

      expect(config.allowedSettlementRouters["base-sepolia"]).toContain("0xcustom");
    });

    it("should filter empty router addresses", async () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";
      process.env.BASE_SETTLEMENT_ROUTER_ADDRESS = "";

      const config = await loadConfig();

      // When env var is empty string, the network should have an empty array
      expect(config.allowedSettlementRouters["base"]).toBeDefined();
      expect(config.allowedSettlementRouters["base"]).toHaveLength(0);
    });
  });

  describe("network configuration", () => {
    it("should configure EVM networks", async () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config.network.evmNetworks).toContain("base-sepolia");
      expect(config.network.evmNetworks).toContain("base");
      expect(config.network.evmNetworks).toContain("x-layer-testnet");
      expect(config.network.evmNetworks).toContain("x-layer");
    });
  });
});
