/**
 * Tests for config.ts
 *
 * Tests configuration parsing and validation
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../src/config.js";

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
    it("should load config with default values", () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";
      // Clear PORT to use default
      delete process.env.PORT;

      const config = loadConfig();

      expect(config).toBeDefined();
      expect(config.cache.enabled).toBe(true);
      expect(config.cache.ttlTokenVersion).toBe(3600);
      expect(config.server.port).toBe(3000);
      expect(config.accountPool.strategy).toBe("round_robin");
    });

    it("should load custom port from environment", () => {
      process.env.PORT = "8080";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = loadConfig();

      expect(config.server.port).toBe(8080);
    });

    it("should disable cache when CACHE_ENABLED=false", () => {
      process.env.CACHE_ENABLED = "false";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = loadConfig();

      expect(config.cache.enabled).toBe(false);
    });

    it("should load custom cache TTL values", () => {
      process.env.CACHE_TTL_TOKEN_VERSION = "7200";
      process.env.CACHE_TTL_TOKEN_METADATA = "14400";
      process.env.CACHE_MAX_KEYS = "2000";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = loadConfig();

      expect(config.cache.ttlTokenVersion).toBe(7200);
      expect(config.cache.ttlTokenMetadata).toBe(14400);
      expect(config.cache.maxKeys).toBe(2000);
    });

    it("should load account selection strategy", () => {
      process.env.ACCOUNT_SELECTION_STRATEGY = "random";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = loadConfig();

      expect(config.accountPool.strategy).toBe("random");
    });

    it("should throw on invalid account selection strategy", () => {
      process.env.ACCOUNT_SELECTION_STRATEGY = "invalid";
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      expect(() => loadConfig()).toThrow("Invalid ACCOUNT_SELECTION_STRATEGY");
    });
  });

  describe("private keys loading", () => {
    it("should load single EVM private key", () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = loadConfig();

      expect(config.evmPrivateKeys).toHaveLength(1);
      expect(config.evmPrivateKeys[0]).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      );
    });

    it("should load numbered EVM private keys", () => {
      process.env.EVM_PRIVATE_KEY_1 =
        "0x0000000000000000000000000000000000000000000000000000000000000001";
      process.env.EVM_PRIVATE_KEY_2 =
        "0x0000000000000000000000000000000000000000000000000000000000000002";
      process.env.EVM_PRIVATE_KEY_3 =
        "0x0000000000000000000000000000000000000000000000000000000000000003";

      const config = loadConfig();

      expect(config.evmPrivateKeys).toHaveLength(3);
      expect(config.evmPrivateKeys[0]).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      );
      expect(config.evmPrivateKeys[1]).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000002",
      );
    });

    it("should prioritize numbered keys over single key", () => {
      process.env.EVM_PRIVATE_KEY = "0xsingle";
      process.env.EVM_PRIVATE_KEY_1 =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = loadConfig();

      expect(config.evmPrivateKeys).toHaveLength(1);
      expect(config.evmPrivateKeys[0]).toBe(
        "0x0000000000000000000000000000000000000000000000000000000000000001",
      );
    });

    it("should load single SVM private key", () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";
      process.env.SVM_PRIVATE_KEY = "svm-key-1";

      const config = loadConfig();

      expect(config.svmPrivateKeys).toHaveLength(1);
      expect(config.svmPrivateKeys[0]).toBe("svm-key-1");
    });

    it("should load numbered SVM private keys", () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";
      process.env.SVM_PRIVATE_KEY_1 = "svm-key-1";
      process.env.SVM_PRIVATE_KEY_2 = "svm-key-2";

      const config = loadConfig();

      expect(config.svmPrivateKeys).toHaveLength(2);
      expect(config.svmPrivateKeys[0]).toBe("svm-key-1");
      expect(config.svmPrivateKeys[1]).toBe("svm-key-2");
    });

    it("should return empty array for missing SVM keys", () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = loadConfig();

      expect(config.svmPrivateKeys).toHaveLength(0);
    });
  });

  describe("settlement router whitelist", () => {
    it("should load default settlement router addresses", () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = loadConfig();

      expect(config.allowedSettlementRouters).toBeDefined();
      expect(config.allowedSettlementRouters["base-sepolia"]).toContain(
        "0x32431D4511e061F1133520461B07eC42afF157D6",
      );
      expect(config.allowedSettlementRouters["x-layer-testnet"]).toContain(
        "0x1ae0e196dc18355af3a19985faf67354213f833d",
      );
    });

    it("should load custom settlement router addresses", () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";
      process.env.BASE_SEPOLIA_SETTLEMENT_ROUTER_ADDRESS = "0xcustom";

      const config = loadConfig();

      expect(config.allowedSettlementRouters["base-sepolia"]).toContain("0xcustom");
    });

    it("should filter empty router addresses", () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";
      process.env.BASE_SETTLEMENT_ROUTER_ADDRESS = "";

      const config = loadConfig();

      expect(config.allowedSettlementRouters["base"]).toHaveLength(0);
    });
  });

  describe("network configuration", () => {
    it("should configure EVM networks", () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = loadConfig();

      expect(config.network.evmNetworks).toContain("base-sepolia");
      expect(config.network.evmNetworks).toContain("base");
      expect(config.network.evmNetworks).toContain("x-layer-testnet");
      expect(config.network.evmNetworks).toContain("x-layer");
    });

    it("should configure SVM networks", () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = loadConfig();

      expect(config.network.svmNetworks).toContain("solana-devnet");
      expect(config.network.svmNetworks).toContain("solana-mainnet");
    });

    it("should load SVM RPC URL", () => {
      process.env.EVM_PRIVATE_KEY =
        "0x0000000000000000000000000000000000000000000000000000000000000001";
      process.env.SVM_RPC_URL = "https://api.devnet.solana.com";

      const config = loadConfig();

      expect(config.network.svmRpcUrl).toBe("https://api.devnet.solana.com");
      expect(config.x402Config?.svmConfig?.rpcUrl).toBe("https://api.devnet.solana.com");
    });
  });
});
