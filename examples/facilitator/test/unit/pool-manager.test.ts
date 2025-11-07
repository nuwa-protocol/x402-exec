/**
 * Tests for pool-manager.ts
 *
 * Tests pool manager initialization and access
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PoolManager, createPoolManager } from "../../src/pool-manager.js";
import { AccountPool } from "../../src/account-pool.js";

// Mock AccountPool
vi.mock("../../src/account-pool.js", () => {
  const mockPool = {
    getAccountCount: vi.fn(() => 2),
    getAccountsInfo: vi.fn(() => []),
    getTotalProcessed: vi.fn(() => 0),
    execute: vi.fn(async (fn) => fn({ account: { address: "0xmock" } })),
  };

  return {
    AccountPool: {
      create: vi.fn(async () => mockPool),
    },
  };
});

describe("pool-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PoolManager", () => {
    describe("initialization", () => {
      it("should initialize with EVM keys only", async () => {
        const manager = await createPoolManager(
          ["0xevm1", "0xevm2"],
          [],
          {
            evmNetworks: ["base-sepolia", "x-layer-testnet"],
            svmNetworks: [],
            svmRpcUrl: "",
          },
          { strategy: "round_robin" },
        );

        expect(manager.getEvmAccountCount()).toBe(2);
        expect(manager.getSvmAccountCount()).toBe(0);
      });

      it("should initialize with SVM keys only", async () => {
        const manager = await createPoolManager(
          [],
          ["svm1", "svm2", "svm3"],
          {
            evmNetworks: [],
            svmNetworks: ["solana-devnet"],
            svmRpcUrl: "https://api.devnet.solana.com",
          },
          { strategy: "round_robin" },
        );

        expect(manager.getEvmAccountCount()).toBe(0);
        expect(manager.getSvmAccountCount()).toBe(3);
      });

      it("should initialize with both EVM and SVM keys", async () => {
        const manager = await createPoolManager(
          ["0xevm1"],
          ["svm1"],
          {
            evmNetworks: ["base-sepolia"],
            svmNetworks: ["solana-devnet"],
            svmRpcUrl: "https://api.devnet.solana.com",
          },
          { strategy: "round_robin" },
        );

        expect(manager.getEvmAccountCount()).toBe(1);
        expect(manager.getSvmAccountCount()).toBe(1);
        expect(manager.hasAccounts()).toBe(true);
      });

      it("should create pools for each EVM network", async () => {
        const manager = await createPoolManager(
          ["0xevm1"],
          [],
          {
            evmNetworks: ["base-sepolia", "x-layer-testnet"],
            svmNetworks: [],
            svmRpcUrl: "",
          },
          { strategy: "round_robin" },
        );

        expect(AccountPool.create).toHaveBeenCalledWith(
          ["0xevm1"],
          "base-sepolia",
          expect.anything(),
        );
        expect(AccountPool.create).toHaveBeenCalledWith(
          ["0xevm1"],
          "x-layer-testnet",
          expect.anything(),
        );
      });

      it("should create pools for each SVM network", async () => {
        const manager = await createPoolManager(
          [],
          ["svm1"],
          {
            evmNetworks: [],
            svmNetworks: ["solana-devnet", "solana-mainnet"],
            svmRpcUrl: "https://api.devnet.solana.com",
          },
          { strategy: "round_robin" },
        );

        expect(AccountPool.create).toHaveBeenCalledWith(
          ["svm1"],
          "solana-devnet",
          expect.anything(),
        );
        expect(AccountPool.create).toHaveBeenCalledWith(
          ["svm1"],
          "solana-mainnet",
          expect.anything(),
        );
      });
    });

    describe("pool access", () => {
      it("should get pool for specific network", async () => {
        const manager = await createPoolManager(
          ["0xevm1"],
          [],
          {
            evmNetworks: ["base-sepolia"],
            svmNetworks: [],
            svmRpcUrl: "",
          },
          { strategy: "round_robin" },
        );

        const pool = manager.getPool("base-sepolia");
        expect(pool).toBeDefined();
      });

      it("should return undefined for unknown network", async () => {
        const manager = await createPoolManager(
          ["0xevm1"],
          [],
          {
            evmNetworks: ["base-sepolia"],
            svmNetworks: [],
            svmRpcUrl: "",
          },
          { strategy: "round_robin" },
        );

        const pool = manager.getPool("unknown-network");
        expect(pool).toBeUndefined();
      });

      it("should get EVM account pools", async () => {
        const manager = await createPoolManager(
          ["0xevm1"],
          [],
          {
            evmNetworks: ["base-sepolia", "x-layer-testnet"],
            svmNetworks: [],
            svmRpcUrl: "",
          },
          { strategy: "round_robin" },
        );

        const evmPools = manager.getEvmAccountPools();
        expect(evmPools.size).toBe(2);
        expect(evmPools.has("base-sepolia")).toBe(true);
        expect(evmPools.has("x-layer-testnet")).toBe(true);
      });

      it("should get SVM account pools", async () => {
        const manager = await createPoolManager(
          [],
          ["svm1"],
          {
            evmNetworks: [],
            svmNetworks: ["solana-devnet"],
            svmRpcUrl: "https://api.devnet.solana.com",
          },
          { strategy: "round_robin" },
        );

        const svmPools = manager.getSvmAccountPools();
        expect(svmPools.size).toBe(1);
        expect(svmPools.has("solana-devnet")).toBe(true);
      });
    });

    describe("statistics", () => {
      it("should return EVM account count", async () => {
        const manager = await createPoolManager(
          ["0xevm1", "0xevm2", "0xevm3"],
          [],
          {
            evmNetworks: ["base-sepolia"],
            svmNetworks: [],
            svmRpcUrl: "",
          },
          { strategy: "round_robin" },
        );

        expect(manager.getEvmAccountCount()).toBe(3);
      });

      it("should return SVM account count", async () => {
        const manager = await createPoolManager(
          [],
          ["svm1", "svm2"],
          {
            evmNetworks: [],
            svmNetworks: ["solana-devnet"],
            svmRpcUrl: "https://api.devnet.solana.com",
          },
          { strategy: "round_robin" },
        );

        expect(manager.getSvmAccountCount()).toBe(2);
      });

      it("should check if has accounts", async () => {
        const withAccounts = await createPoolManager(
          ["0xevm1"],
          [],
          {
            evmNetworks: ["base-sepolia"],
            svmNetworks: [],
            svmRpcUrl: "",
          },
          { strategy: "round_robin" },
        );

        expect(withAccounts.hasAccounts()).toBe(true);

        const withoutAccounts = await createPoolManager(
          [],
          [],
          {
            evmNetworks: [],
            svmNetworks: [],
            svmRpcUrl: "",
          },
          { strategy: "round_robin" },
        );

        expect(withoutAccounts.hasAccounts()).toBe(false);
      });
    });

    describe("error handling", () => {
      it("should handle pool creation failures gracefully", async () => {
        // Mock one pool creation to fail
        vi.mocked(AccountPool.create).mockRejectedValueOnce(new Error("Failed to create pool"));

        // Should not throw, just skip failed pool
        const manager = await createPoolManager(
          ["0xevm1"],
          [],
          {
            evmNetworks: ["base-sepolia", "x-layer-testnet"],
            svmNetworks: [],
            svmRpcUrl: "",
          },
          { strategy: "round_robin" },
        );

        expect(manager).toBeDefined();
      });
    });
  });
});
