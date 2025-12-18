/**
 * End-to-end tests for network auto-discovery
 *
 * Tests the complete network discovery and gas price functionality
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import express from "express";
import { networkChainResolver } from "../../src/network-chain-resolver.js";
import { loadConfig } from "../../src/config.js";
import { createApp } from "../../src/app.js";
import type { RoutesDependencies } from "../../src/routes/index.js";

// Mock modules that depend on external services
vi.mock("x402/facilitator", () => ({
  settle: vi.fn(async () => ({
    success: true,
    transaction: "0xtxhash123",
    payer: "0x1234567890123456789012345678901234567890",
    network: "base-sepolia",
  })),
  verify: vi.fn(async () => ({
    isValid: true,
    payer: "0x1234567890123456789012345678901234567890",
  })),
}));

vi.mock("x402/types", async () => {
  const actual = await vi.importActual("x402/types");
  return {
    ...actual,
    createSigner: vi.fn(() => ({
      account: { address: "0xfacilitator" },
    })),
    createConnectedClient: vi.fn(() => ({
      request: vi.fn(),
    })),
  };
});

describe("Network Auto Discovery E2E", () => {
  let app: express.Application;

  beforeAll(async () => {
    // Initialize network resolver
    await networkChainResolver.initialize();

    // Mock required environment variables for config loading
    process.env.EVM_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";

    // Load configuration
    const config = await loadConfig();

    // Mock dependencies for app creation
    const mockDeps: RoutesDependencies = {
      shutdownManager: {
        registerServer: vi.fn(),
        addCleanupHandler: vi.fn(),
        gracefulShutdown: vi.fn(),
      },
      poolManager: {
        getEvmAccountPools: vi.fn(() => []),
        getEvmAccountCount: vi.fn(() => 1), // Mock 1 account to enable networks
      } as any,
      evmAccountPools: [],
      evmAccountCount: 1,
      tokenCache: undefined,
      balanceChecker: undefined,
      allowedSettlementRouters: config.allowedSettlementRouters,
      x402Config: config.x402Config,
      gasCost: config.gasCost,
      dynamicGasPrice: config.dynamicGasPrice,
      tokenPrice: config.tokenPrice,
      feeClaim: config.feeClaim,
      rpcUrls: config.dynamicGasPrice.rpcUrls,
    };

    // Create Express app
    app = createApp({
      shutdownManager: mockDeps.shutdownManager,
      routesDeps: mockDeps,
      requestBodyLimit: config.server.requestBodyLimit,
      rateLimitConfig: config.rateLimit,
    });
  });

  afterAll(() => {
    networkChainResolver.clearCache();
  });

  describe("Network Chain Resolver", () => {
    it("should resolve all supported networks", async () => {
      const supportedNetworks = [
        "base-sepolia",
        "base",
        "x-layer-testnet",
        "x-layer",
        "bsc-testnet",
        "bsc",
        "skale-base-sepolia"
      ];

      for (const network of supportedNetworks) {
        const chainInfo = await networkChainResolver.resolveNetworkChain(network);
        expect(chainInfo).toBeDefined();
        expect(chainInfo!.chain.id).toBeTypeOf("number");
        expect(chainInfo!.rpcUrl).toMatch(/^https?:\/\//);
        expect(chainInfo!.networkName).toBe(network);
      }
    });

    it("should get RPC URLs for all networks", async () => {
      const rpcUrls = await networkChainResolver.getAllRpcUrls();

      // Verify all expected networks are present
      const expectedNetworks = [
        "base-sepolia",
        "base",
        "x-layer-testnet",
        "x-layer",
        "bsc-testnet",
        "bsc",
        "skale-base-sepolia"
      ];

      expectedNetworks.forEach(network => {
        expect(rpcUrls[network]).toBeDefined();
        expect(rpcUrls[network]).toMatch(/^https?:\/\//);
      });
    });

    it("should provide network status information", async () => {
      const networkStatus = await networkChainResolver.getNetworkStatus();

      // All networks should have status information
      Object.entries(networkStatus).forEach(([network, status]) => {
        expect(status).toHaveProperty("valid");
        expect(status).toHaveProperty("hasRpcUrl");

        if (status.valid) {
          expect(status.hasRpcUrl).toBe(true);
          expect(status.source).toBeDefined();
        }
      });
    });
  });

  describe("Configuration Integration", () => {
    it("should load configuration with dynamic gas price config", async () => {
      // Mock required environment variables
      process.env.EVM_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config).toBeDefined();
      expect(config.dynamicGasPrice).toBeDefined();
      expect(config.dynamicGasPrice.rpcUrls).toBeDefined();

      // Verify all expected networks have RPC URLs
      const expectedNetworks = [
        "base-sepolia",
        "base",
        "x-layer-testnet",
        "x-layer",
        "bsc-testnet",
        "bsc",
        "skale-base-sepolia"
      ];

      expectedNetworks.forEach(network => {
        expect(config.dynamicGasPrice.rpcUrls[network]).toBeDefined();
        expect(config.dynamicGasPrice.rpcUrls[network]).toMatch(/^https?:\/\//);
      });
    });

    it("should respect environment variable overrides", async () => {
      // Set custom RPC URLs
      process.env.BSC_RPC_URL = "https://custom-bsc.example.com";
      process.env.BSC_TESTNET_RPC_URL = "https://custom-bsc-testnet.example.com";
      process.env.EVM_PRIVATE_KEY = "0x0000000000000000000000000000000000000000000000000000000000000001";

      const config = await loadConfig();

      expect(config.dynamicGasPrice.rpcUrls["bsc"]).toBe("https://custom-bsc.example.com");
      expect(config.dynamicGasPrice.rpcUrls["bsc-testnet"]).toBe("https://custom-bsc-testnet.example.com");

      // Clear environment variables
      delete process.env.BSC_RPC_URL;
      delete process.env.BSC_TESTNET_RPC_URL;
    });
  });

  describe("Backward Compatibility", () => {
    it("should maintain support for original hardcoded networks", async () => {
      const originalNetworks = ["base-sepolia", "base", "x-layer-testnet", "x-layer"];

      for (const network of originalNetworks) {
        const chainInfo = await networkChainResolver.resolveNetworkChain(network);
        expect(chainInfo).toBeDefined();

        // Original networks should still work with their expected sources
        if (network === "base-sepolia" || network === "base") {
          expect(chainInfo!.source).toBe("viem");
        } else {
          expect(chainInfo!.source).toBe("x402");
        }
      }
    });

    it("should handle missing RPC URLs gracefully", async () => {
      // Test with an invalid network
      const chainInfo = await networkChainResolver.resolveNetworkChain("invalid-network");
      expect(chainInfo).toBeNull();

      const rpcUrl = await networkChainResolver.getRpcUrl("invalid-network");
      expect(rpcUrl).toBeNull();
    });
  });

  describe("Network Auto-Discovery", () => {
    it("should automatically support networks from @x402x/core", async () => {
      const networkStatus = await networkChainResolver.getNetworkStatus();
      const validNetworks = Object.entries(networkStatus)
        .filter(([_, status]) => status.valid)
        .map(([network]) => network);

      // Should include the new networks that weren't in the original hardcoded list
      expect(validNetworks).toContain("bsc");
      expect(validNetworks).toContain("bsc-testnet");
      expect(validNetworks).toContain("skale-base-sepolia");

      // Should still include the original networks
      expect(validNetworks).toContain("base");
      expect(validNetworks).toContain("base-sepolia");
      expect(validNetworks).toContain("x-layer");
      expect(validNetworks).toContain("x-layer-testnet");
    });

    it("should provide consistent network information", async () => {
      const networks = ["bsc", "bsc-testnet", "skale-base-sepolia"];

      for (const network of networks) {
        const chainInfo1 = await networkChainResolver.resolveNetworkChain(network);
        const chainInfo2 = await networkChainResolver.resolveNetworkChain(network);

        // Multiple calls should return the same information (cached)
        expect(chainInfo1).toEqual(chainInfo2);
        expect(chainInfo1!.networkName).toBe(network);
        expect(chainInfo1!.chain.id).toBeTypeOf("number");
        expect(chainInfo1!.rpcUrl).toMatch(/^https?:\/\//);
      }
    });
  });

  describe("API Endpoints", () => {
    it("should return all supported networks via /supported endpoint", async () => {
      const response = await request(app)
        .get("/supported")
        .expect(200);

      expect(response.body).toHaveProperty("kinds");
      // All networks are EVM networks, so we can directly map to network names
      const supportedNetworks = response.body.kinds.map((kind: any) => kind.network);

      // Should include all networks from @x402x/core
      expect(supportedNetworks).toContain("base");
      expect(supportedNetworks).toContain("base-sepolia");
      expect(supportedNetworks).toContain("x-layer");
      expect(supportedNetworks).toContain("x-layer-testnet");
      expect(supportedNetworks).toContain("bsc");
      expect(supportedNetworks).toContain("bsc-testnet");
      expect(supportedNetworks).toContain("skale-base-sepolia");
    });
  });

  describe("Error Handling", () => {
    it("should handle malformed network names gracefully", async () => {
      const invalidNames = ["", "invalid-network", "UPPERCASE-NETWORK", "network with spaces"];

      for (const networkName of invalidNames) {
        const chainInfo = await networkChainResolver.resolveNetworkChain(networkName);
        expect(chainInfo).toBeNull();
      }
    });

    it("should handle network resolver initialization errors", async () => {
      // Clear and re-initialize to test error handling
      networkChainResolver.clearCache();

      // Re-initialization should work fine
      await expect(networkChainResolver.initialize()).resolves.not.toThrow();
      expect(networkChainResolver.isInitialized()).toBe(true);
    });
  });
});