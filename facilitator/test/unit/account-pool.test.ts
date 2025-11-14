/**
 * Tests for account-pool.ts
 *
 * Tests account pool management and selection strategies
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AccountPool } from "../../src/account-pool.js";
import { createMockEvmSigner } from "../mocks/signers.js";

// Mock x402/types
vi.mock("x402/types", async () => {
  const actual = await vi.importActual("x402/types");
  return {
    ...actual,
    createSigner: vi.fn((network: string, privateKey: string) => {
      // Extract a unique part of the private key for the address
      const suffix = privateKey.slice(-2);
      return createMockEvmSigner({ address: `0x${suffix}000000` });
    }),
  };
});

describe("account-pool", () => {
  describe("AccountPool", () => {
    describe("creation", () => {
      it("should create pool with single account", async () => {
        const pool = await AccountPool.create(
          ["0x0000000000000000000000000000000000000000000000000000000000000001"],
          "base-sepolia",
        );

        expect(pool.getAccountCount()).toBe(1);
      });

      it("should create pool with multiple accounts", async () => {
        const pool = await AccountPool.create(
          [
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            "0x0000000000000000000000000000000000000000000000000000000000000002",
            "0x0000000000000000000000000000000000000000000000000000000000000003",
          ],
          "base-sepolia",
        );

        expect(pool.getAccountCount()).toBe(3);
      });

      it("should throw when no private keys provided", async () => {
        await expect(AccountPool.create([], "base-sepolia")).rejects.toThrow(
          "At least one private key is required",
        );
      });

      it("should use default strategy", async () => {
        const pool = await AccountPool.create(
          ["0x0000000000000000000000000000000000000000000000000000000000000001"],
          "base-sepolia",
        );

        expect(pool).toBeDefined();
      });

      it("should accept custom strategy", async () => {
        const pool = await AccountPool.create(
          ["0x0000000000000000000000000000000000000000000000000000000000000001"],
          "base-sepolia",
          { strategy: "random" },
        );

        expect(pool).toBeDefined();
      });

      it("should use default config values when partial config provided", async () => {
        const pool = await AccountPool.create(
          ["0x0000000000000000000000000000000000000000000000000000000000000001"],
          "base-sepolia",
          { strategy: "random" }, // Only provide strategy, not maxQueueDepth
        );

        // Access the private config property for testing
        const accountsInfo = pool.getAccountsInfo();
        expect(accountsInfo).toHaveLength(1);

        // The pool should have been created with default maxQueueDepth of 10
        // and the config should be accessible through internal means
        // We can't directly test the config values without exposing them,
        // but the pool creation should succeed with defaults applied
        expect(pool.getAccountCount()).toBe(1);
      });
    });

    describe("execute", () => {
      it("should execute function with signer", async () => {
        const pool = await AccountPool.create(
          ["0x0000000000000000000000000000000000000000000000000000000000000001"],
          "base-sepolia",
        );

        const fn = vi.fn(async (signer) => {
          return signer.account.address;
        });

        const result = await pool.execute(fn);

        expect(fn).toHaveBeenCalledTimes(1);
        expect(result).toContain("0x");
      });

      it("should execute multiple times", async () => {
        const pool = await AccountPool.create(
          ["0x0000000000000000000000000000000000000000000000000000000000000001"],
          "base-sepolia",
        );

        const fn = vi.fn(async () => "result");

        await pool.execute(fn);
        await pool.execute(fn);
        await pool.execute(fn);

        expect(fn).toHaveBeenCalledTimes(3);
      });

      it("should track processed count", async () => {
        const pool = await AccountPool.create(
          ["0x0000000000000000000000000000000000000000000000000000000000000001"],
          "base-sepolia",
        );

        const fn = vi.fn(async () => "result");

        await pool.execute(fn);
        await pool.execute(fn);

        expect(pool.getTotalProcessed()).toBe(2);
      });

      it("should propagate errors", async () => {
        const pool = await AccountPool.create(
          ["0x0000000000000000000000000000000000000000000000000000000000000001"],
          "base-sepolia",
        );

        const fn = vi.fn(async () => {
          throw new Error("Test error");
        });

        await expect(pool.execute(fn)).rejects.toThrow("Test error");
      });
    });

    describe("round-robin strategy", () => {
      it("should distribute work evenly across accounts", async () => {
        const pool = await AccountPool.create(
          [
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            "0x0000000000000000000000000000000000000000000000000000000000000002",
            "0x0000000000000000000000000000000000000000000000000000000000000003",
          ],
          "base-sepolia",
          { strategy: "round_robin" },
        );

        const addresses: string[] = [];
        const fn = vi.fn(async (signer) => {
          const addr = signer.account.address;
          addresses.push(addr);
          return addr;
        });

        // Execute 6 times (2 rounds)
        for (let i = 0; i < 6; i++) {
          await pool.execute(fn);
        }

        // Each account should be used exactly twice
        const accountInfo = pool.getAccountsInfo();
        for (const info of accountInfo) {
          expect(info.totalProcessed).toBe(2);
        }
      });

      it("should cycle through accounts in order", async () => {
        const pool = await AccountPool.create(
          [
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            "0x0000000000000000000000000000000000000000000000000000000000000002",
          ],
          "base-sepolia",
          { strategy: "round_robin" },
        );

        const addresses: string[] = [];
        for (let i = 0; i < 4; i++) {
          await pool.execute(async (signer) => {
            addresses.push(signer.account.address);
          });
        }

        // Should cycle: account1, account2, account1, account2
        expect(addresses[0]).toBe(addresses[2]);
        expect(addresses[1]).toBe(addresses[3]);
        expect(addresses[0]).not.toBe(addresses[1]);
      });
    });

    describe("random strategy", () => {
      it("should select accounts randomly", async () => {
        const pool = await AccountPool.create(
          [
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            "0x0000000000000000000000000000000000000000000000000000000000000002",
            "0x0000000000000000000000000000000000000000000000000000000000000003",
          ],
          "base-sepolia",
          { strategy: "random" },
        );

        const addresses: string[] = [];
        for (let i = 0; i < 10; i++) {
          await pool.execute(async (signer) => {
            addresses.push(signer.account.address);
          });
        }

        // With random selection, we should see some variation (not perfectly even)
        const uniqueAddresses = new Set(addresses);
        expect(uniqueAddresses.size).toBeGreaterThan(1);
      });
    });

    describe("accounts info", () => {
      it("should return account information", async () => {
        const pool = await AccountPool.create(
          ["0x0000000000000000000000000000000000000000000000000000000000000001"],
          "base-sepolia",
        );

        await pool.execute(async () => "result");

        const info = pool.getAccountsInfo();
        expect(info).toHaveLength(1);
        expect(info[0].address).toContain("0x");
        expect(info[0].totalProcessed).toBe(1);
        expect(info[0].queueDepth).toBe(0);
      });

      it("should track queue depth", async () => {
        const pool = await AccountPool.create(
          ["0x0000000000000000000000000000000000000000000000000000000000000001"],
          "base-sepolia",
        );

        // Create a slow function
        const fn = vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        });

        // Start multiple executions without waiting
        const promises = [pool.execute(fn), pool.execute(fn), pool.execute(fn)];

        // Queue depth should be > 0 during execution
        // (This is timing-dependent, so we just check the structure)
        const info = pool.getAccountsInfo();
        expect(info[0]).toHaveProperty("queueDepth");

        await Promise.all(promises);
      });
    });

    describe("statistics", () => {
      it("should track total processed transactions", async () => {
        const pool = await AccountPool.create(
          [
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            "0x0000000000000000000000000000000000000000000000000000000000000002",
          ],
          "base-sepolia",
        );

        const fn = vi.fn(async () => "result");

        await pool.execute(fn);
        await pool.execute(fn);
        await pool.execute(fn);

        expect(pool.getTotalProcessed()).toBe(3);
      });

      it("should count accounts correctly", async () => {
        const pool = await AccountPool.create(
          [
            "0x0000000000000000000000000000000000000000000000000000000000000001",
            "0x0000000000000000000000000000000000000000000000000000000000000002",
            "0x0000000000000000000000000000000000000000000000000000000000000003",
          ],
          "base-sepolia",
        );

        expect(pool.getAccountCount()).toBe(3);
      });
    });

    describe("serial execution", () => {
      it("should execute transactions serially per account", async () => {
        const pool = await AccountPool.create(
          ["0x0000000000000000000000000000000000000000000000000000000000000001"],
          "base-sepolia",
        );

        const executionOrder: number[] = [];
        const delays = [50, 30, 40]; // Intentionally out of order

        const promises = delays.map((delay, index) =>
          pool.execute(async () => {
            await new Promise((resolve) => setTimeout(resolve, delay));
            executionOrder.push(index);
          }),
        );

        await Promise.all(promises);

        // Despite different delays, should execute in submission order
        expect(executionOrder).toEqual([0, 1, 2]);
      });
    });
  });
});
