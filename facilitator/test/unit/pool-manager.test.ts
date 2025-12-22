/**
 * Tests for pool-manager.ts
 *
 * Tests pool manager initialization and access
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPoolManager } from "../../src/pool-manager.js";
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
      it("should initialize with EVM keys", async () => {
        const manager = await createPoolManager(
          ["0xevm1", "0xevm2"],
          {
            evmNetworks: ["base-sepolia", "x-layer-testnet"],
          },
          { strategy: "round_robin" },
        );

        expect(manager.getEvmAccountCount()).toBe(2);
      });

      it("should initialize without keys", async () => {
        const manager = await createPoolManager(
          [],
          {
            evmNetworks: ["base-sepolia"],
          },
          { strategy: "round_robin" },
        );

        expect(manager.getEvmAccountCount()).toBe(0);
        expect(manager.hasAccounts()).toBe(false);
      });

      it("should create pools for each EVM network", async () => {
        const manager = await createPoolManager(
          ["0xevm1"],
          {
            evmNetworks: ["base-sepolia", "x-layer-testnet"],
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
    });

    describe("pool access", () => {
      it("should get pool for specific network", async () => {
        const manager = await createPoolManager(
          ["0xevm1"],
          {
            evmNetworks: ["base-sepolia"],
          },
          { strategy: "round_robin" },
        );

        const pool = manager.getPool("base-sepolia");
        expect(pool).toBeDefined();
      });

      it("should return undefined for unknown network", async () => {
        const manager = await createPoolManager(
          ["0xevm1"],
          {
            evmNetworks: ["base-sepolia"],
          },
          { strategy: "round_robin" },
        );

        const pool = manager.getPool("unknown-network");
        expect(pool).toBeUndefined();
      });

      it("should get EVM account pools", async () => {
        const manager = await createPoolManager(
          ["0xevm1"],
          {
            evmNetworks: ["base-sepolia", "x-layer-testnet"],
          },
          { strategy: "round_robin" },
        );

        const evmPools = manager.getEvmAccountPools();
        expect(evmPools.size).toBe(2);
        expect(evmPools.has("eip155:84532")).toBe(true);  // base-sepolia canonical key
        expect(evmPools.has("eip155:1952")).toBe(true);     // x-layer-testnet canonical key
      });
    });

    describe("statistics", () => {
      it("should return EVM account count", async () => {
        const manager = await createPoolManager(
          ["0xevm1", "0xevm2", "0xevm3"],
          {
            evmNetworks: ["base-sepolia"],
          },
          { strategy: "round_robin" },
        );

        expect(manager.getEvmAccountCount()).toBe(3);
      });

      it("should check if has accounts", async () => {
        const managerWithAccounts = await createPoolManager(
          ["0xevm1"],
          {
            evmNetworks: ["base-sepolia"],
          },
          { strategy: "round_robin" },
        );

        expect(managerWithAccounts.hasAccounts()).toBe(true);

        const managerWithoutAccounts = await createPoolManager(
          [],
          {
            evmNetworks: [],
          },
          { strategy: "round_robin" },
        );

        expect(managerWithoutAccounts.hasAccounts()).toBe(false);
      });
    });

    describe("error handling", () => {
      it("should handle pool creation failures gracefully", async () => {
        // Mock AccountPool.create to throw error
        vi.mocked(AccountPool.create).mockRejectedValueOnce(new Error("Pool creation failed"));

        const manager = await createPoolManager(
          ["0xevm1"],
          {
            evmNetworks: ["base-sepolia", "x-layer-testnet"],
          },
          { strategy: "round_robin" },
        );

        // Should still initialize but skip failed pools
        expect(manager).toBeDefined();
        expect(manager.getEvmAccountCount()).toBe(1);
      });
    });
  });
});
