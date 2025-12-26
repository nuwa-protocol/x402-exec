/**
 * Tests for network-chain-resolver.ts
 *
 * Tests network chain resolution and RPC URL management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { networkChainResolver } from "../../src/network-chain-resolver.js";

// NOTE: NetworkChainResolver now sources supported networks from @x402x/extensions (CAIP-2).

// Mock viem chains
vi.mock("viem/chains", () => ({
  baseSepolia: {
    id: 84532,
    name: "Base Sepolia",
    rpcUrls: {
      default: {
        http: ["https://sepolia.base.org"],
      },
    },
  },
  base: {
    id: 8453,
    name: "Base",
    rpcUrls: {
      default: {
        http: ["https://mainnet.base.org"],
      },
    },
  },
  bsc: {
    id: 56,
    name: "BSC",
    rpcUrls: {
      default: {
        http: ["https://bsc-dataseed.binance.org"],
      },
    },
  },
  bscTestnet: {
    id: 97,
    name: "BSC Testnet",
    rpcUrls: {
      default: {
        http: ["https://data-seed-prebsc-1-s1.bnbchain.org:8545"],
      },
    },
  },
}));

// Mock x402 evm chains
vi.mock("x402/types", () => ({
  evm: {
    getChainFromNetwork: vi.fn((network: string) => {
      const chains: Record<string, any> = {
        "x-layer-testnet": {
          id: 195,
          name: "X Layer Testnet",
          rpcUrls: {
            default: {
              http: ["https://rpc.xlayer-testnet.xyz"],
            },
          },
        },
        "x-layer": {
          id: 196,
          name: "X Layer",
          rpcUrls: {
            default: {
              http: ["https://rpc.xlayer.xyz"],
            },
          },
        },
        "bsc-testnet": {
          id: 97,
          name: "BSC Testnet",
          rpcUrls: {
            default: {
              http: ["https://data-seed-prebsc-1-s1.bnbchain.org:8545"],
            },
          },
        },
        bsc: {
          id: 56,
          name: "BSC",
          rpcUrls: {
            default: {
              http: ["https://bsc-dataseed.binance.org"],
            },
          },
        },
        "skale-base-sepolia": {
          id: 1544642581,
          name: "SKALE Base Sepolia",
          rpcUrls: {
            default: {
              http: ["https://base-sepolia-testnet-rpc.skalenodes.com"],
            },
          },
        },
      };
      return chains[network] || null;
    }),
  },
}));

// Mock telemetry
vi.mock("../../src/telemetry.js", () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  })),
}));

describe("NetworkChainResolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    networkChainResolver.clearCache();

    // Clear environment variables
    delete process.env.BASE_SEPOLIA_RPC_URL;
    delete process.env.BASE_RPC_URL;
    delete process.env.BSC_RPC_URL;
    delete process.env.BSC_TESTNET_RPC_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialize", () => {
    it("should initialize all supported networks", async () => {
      await networkChainResolver.initialize();

      expect(networkChainResolver.isInitialized()).toBe(true);
    });

    it("should not initialize twice", async () => {
      await networkChainResolver.initialize();
      await networkChainResolver.initialize(); // Second call should be no-op

      expect(networkChainResolver.isInitialized()).toBe(true);
    });
  });

  describe("resolveNetworkChain", () => {
    beforeEach(async () => {
      await networkChainResolver.initialize();
    });

    it("should resolve viem-supported networks", async () => {
      const chainInfo = await networkChainResolver.resolveNetworkChain("base");
      expect(chainInfo).toBeDefined();
      expect(chainInfo?.chain.id).toBe(8453);
      // We now prefer x402x chain definitions first (more complete + CAIP-2 aware)
      expect(chainInfo?.source).toBe("x402x");
      expect(chainInfo?.rpcUrl).toBe("https://mainnet.base.org");
    });

    it("should resolve x402-supported networks", async () => {
      const chainInfo = await networkChainResolver.resolveNetworkChain("bsc");
      expect(chainInfo).toBeDefined();
      expect(chainInfo?.chain.id).toBe(56);
      expect(chainInfo?.source).toBe("x402x");
      expect(chainInfo?.rpcUrl).toMatch(/^https?:\/\//);
    });

    it("should return null for invalid networks", async () => {
      const chainInfo = await networkChainResolver.resolveNetworkChain("invalid-network");
      expect(chainInfo).toBeNull();
    });

    it("should use environment variable override", async () => {
      // Clear cache to ensure environment variable is picked up
      networkChainResolver.clearCache();

      process.env.BSC_RPC_URL = "https://custom-bsc.example.com";

      const chainInfo = await networkChainResolver.resolveNetworkChain("bsc");
      expect(chainInfo).toBeDefined();
      expect(chainInfo?.rpcUrl).toBe("https://custom-bsc.example.com");
      expect(chainInfo?.source).toBe("environment");
    });
  });

  describe("getRpcUrl", () => {
    beforeEach(async () => {
      await networkChainResolver.initialize();
    });

    it("should return RPC URL from environment variable when set", async () => {
      process.env.BASE_RPC_URL = "https://custom-rpc.example.com";

      const rpcUrl = await networkChainResolver.getRpcUrl("base");
      expect(rpcUrl).toBe("https://custom-rpc.example.com");
    });

    it("should return default RPC URL when no override", async () => {
      const rpcUrl = await networkChainResolver.getRpcUrl("base");
      expect(rpcUrl).toBe("https://mainnet.base.org");
    });

    it("should return null for invalid network", async () => {
      const rpcUrl = await networkChainResolver.getRpcUrl("invalid-network");
      expect(rpcUrl).toBeNull();
    });
  });

  describe("getAllRpcUrls", () => {
    beforeEach(async () => {
      await networkChainResolver.initialize();
    });

    it("should return RPC URLs for all supported networks", async () => {
      const rpcUrls = await networkChainResolver.getAllRpcUrls();

      // Should include both canonical CAIP-2 keys and v1 aliases for compatibility
      expect(Object.keys(rpcUrls)).toContain("eip155:8453");
      expect(Object.keys(rpcUrls)).toContain("base");
      expect(Object.keys(rpcUrls)).toContain("eip155:84532");
      expect(Object.keys(rpcUrls)).toContain("base-sepolia");
      expect(Object.keys(rpcUrls)).toContain("eip155:56");
      expect(Object.keys(rpcUrls)).toContain("bsc");
      expect(Object.keys(rpcUrls)).toContain("eip155:97");
      expect(Object.keys(rpcUrls)).toContain("bsc-testnet");
      expect(Object.keys(rpcUrls)).toContain("eip155:324705682");
      expect(Object.keys(rpcUrls)).toContain("skale-base-sepolia");

      // Verify all URLs are valid HTTP/HTTPS URLs
      Object.values(rpcUrls).forEach((url) => {
        expect(url).toMatch(/^https?:\/\//);
      });
    });

    it("should respect environment variable overrides", async () => {
      process.env.BSC_RPC_URL = "https://custom-bsc.example.com";
      process.env.BSC_TESTNET_RPC_URL = "https://custom-bsc-testnet.example.com";

      const rpcUrls = await networkChainResolver.getAllRpcUrls();
      expect(rpcUrls["bsc"]).toBe("https://custom-bsc.example.com");
      expect(rpcUrls["bsc-testnet"]).toBe("https://custom-bsc-testnet.example.com");
    });
  });

  describe("getNetworkStatus", () => {
    beforeEach(async () => {
      await networkChainResolver.initialize();
    });

    it("should return status for all networks", async () => {
      const status = await networkChainResolver.getNetworkStatus();

      // Includes alias keys too
      expect(Object.keys(status)).toContain("base");
      expect(Object.keys(status)).toContain("bsc");
      expect(status).not.toHaveProperty("invalid-network");

      // All supported networks should be valid
      expect(status["base"].valid).toBe(true);
      expect(status["base"].hasRpcUrl).toBe(true);
      expect(status["bsc"].valid).toBe(true);
      expect(status["bsc"].hasRpcUrl).toBe(true);
    });

    it("should indicate invalid networks", async () => {
      // This test depends on the implementation of getNetworkStatus
      const status = await networkChainResolver.getNetworkStatus();

      // All networks returned by getSupportedNetworks should be valid
      Object.values(status).forEach((networkStatus) => {
        if (networkStatus.valid) {
          expect(networkStatus.hasRpcUrl).toBe(true);
          expect(networkStatus.source).toBeDefined();
        } else {
          expect(networkStatus.error).toBeDefined();
        }
      });
    });
  });

  describe("caching", () => {
    beforeEach(async () => {
      await networkChainResolver.initialize();
    });

    it("should cache resolved chain information", async () => {
      const first = await networkChainResolver.resolveNetworkChain("bsc");
      const second = await networkChainResolver.resolveNetworkChain("bsc");

      // Second call should hit cache (same object reference)
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      expect(second).toBe(first);
    });

    it("should clear cache when requested", async () => {
      const first = await networkChainResolver.resolveNetworkChain("bsc");
      expect(first).toBeDefined();

      // Clear cache
      networkChainResolver.clearCache();

      // Re-initialize (initialize() is no-op if already initialized flag was reset)
      await networkChainResolver.initialize();

      const second = await networkChainResolver.resolveNetworkChain("bsc");
      expect(second).toBeDefined();
      // After clearing cache, a new object should be created
      expect(second).not.toBe(first);
    });
  });

  describe("new networks support", () => {
    beforeEach(async () => {
      await networkChainResolver.initialize();
    });

    it("should support BSC network", async () => {
      const chainInfo = await networkChainResolver.resolveNetworkChain("bsc");
      expect(chainInfo).toBeDefined();
      expect(chainInfo?.chain.id).toBe(56);
      expect(chainInfo?.rpcUrl).toMatch(/^https?:\/\//);
    });

    it("should support BSC testnet", async () => {
      const chainInfo = await networkChainResolver.resolveNetworkChain("bsc-testnet");
      expect(chainInfo).toBeDefined();
      expect(chainInfo?.chain.id).toBe(97);
      expect(chainInfo?.rpcUrl).toMatch(/^https?:\/\//);
    });

    it("should support SKALE Base Sepolia", async () => {
      const chainInfo = await networkChainResolver.resolveNetworkChain("skale-base-sepolia");
      expect(chainInfo).toBeDefined();
      // x402x/extensions defines SKALE Nebula Testnet as chainId 324705682
      expect(chainInfo?.chain.id).toBe(324705682);
      expect(chainInfo?.rpcUrl).toMatch(/^https?:\/\//);
    });
  });
});
