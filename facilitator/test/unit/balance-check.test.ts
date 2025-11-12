/**
 * Balance Check Module Tests
 *
 * Tests the balance checking functionality with caching support.
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from "vitest";
import { createBalanceChecker, type BalanceCheckResult } from "../../src/balance-check.js";
import type { CacheInterface } from "../../src/cache/interface.js";
import type { ConnectedClient } from "x402/types";

// Mock the cache interface
const mockCache: CacheInterface = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  has: vi.fn(),
  flush: vi.fn(),
  getStats: vi.fn(),
};

// Mock viem client
const mockClient = {
  readContract: vi.fn(),
  chain: { id: 11155111 }, // Sepolia testnet
} as any; // Use any to match the implementation's client parameter type

describe("BalanceChecker", () => {
  let balanceChecker: ReturnType<typeof createBalanceChecker>;

  beforeEach(() => {
    vi.clearAllMocks();
    balanceChecker = createBalanceChecker(mockCache, {
      cacheTTL: 30,
      maxCacheKeys: 1000,
    });
  });

  describe("checkBalance", () => {
    const userAddress = "0x1234567890123456789012345678901234567890" as const;
    const tokenAddress = "0xA0b86a33E6441a8b5d3E93f0B0F8B6B8c7E7E6E5" as const;
    const network = "sepolia";
    const requiredAmount = "1000000"; // 1 USDC (6 decimals)

    it("should return cached result when available", async () => {
      const cachedResult: BalanceCheckResult = {
        hasSufficient: true,
        balance: "2000000",
        required: requiredAmount,
        cached: true,
      };

      (mockCache.get as MockedFunction<typeof mockCache.get>).mockReturnValue(cachedResult);

      const result = await balanceChecker.checkBalance(
        mockClient,
        userAddress,
        tokenAddress,
        requiredAmount,
        network,
      );

      expect(result).toEqual(cachedResult);
      expect(mockCache.get).toHaveBeenCalledWith(`${network}:${userAddress}:${tokenAddress}`);
      expect(mockClient.readContract).not.toHaveBeenCalled();
    });

    it("should query blockchain when cache miss", async () => {
      const balance = 1500000n; // 1.5 USDC

      (mockCache.get as MockedFunction<typeof mockCache.get>).mockReturnValue(undefined);
      (mockClient.readContract as MockedFunction<typeof mockClient.readContract>).mockResolvedValue(
        balance,
      );

      const result = await balanceChecker.checkBalance(
        mockClient,
        userAddress,
        tokenAddress,
        requiredAmount,
        network,
      );

      expect(result.hasSufficient).toBe(true);
      expect(result.balance).toBe("1500000");
      expect(result.required).toBe(requiredAmount);
      expect(result.cached).toBe(false);

      expect(mockCache.get).toHaveBeenCalledWith(`${network}:${userAddress}:${tokenAddress}`);
      expect(mockClient.readContract).toHaveBeenCalledWith(
        expect.objectContaining({
          address: tokenAddress,
          functionName: "balanceOf",
          args: [userAddress],
        }),
      );
      expect(mockCache.set).toHaveBeenCalledWith(
        `${network}:${userAddress}:${tokenAddress}`,
        expect.objectContaining({
          hasSufficient: true,
          balance: "1500000",
          required: requiredAmount,
          cached: false,
        }),
        30,
      );
    });

    it("should return insufficient when balance is too low", async () => {
      const balance = 500000n; // 0.5 USDC

      (mockCache.get as MockedFunction<typeof mockCache.get>).mockReturnValue(undefined);
      (mockClient.readContract as MockedFunction<typeof mockClient.readContract>).mockResolvedValue(
        balance,
      );

      const result = await balanceChecker.checkBalance(
        mockClient,
        userAddress,
        tokenAddress,
        requiredAmount,
        network,
      );

      expect(result.hasSufficient).toBe(false);
      expect(result.balance).toBe("500000");
      expect(result.required).toBe(requiredAmount);
      expect(result.cached).toBe(false);
    });

    it("should handle cached insufficient balance correctly", async () => {
      const cachedResult: BalanceCheckResult = {
        hasSufficient: false,
        balance: "500000",
        required: requiredAmount,
        cached: true,
      };

      (mockCache.get as MockedFunction<typeof mockCache.get>).mockReturnValue(cachedResult);

      const result = await balanceChecker.checkBalance(
        mockClient,
        userAddress,
        tokenAddress,
        requiredAmount,
        network,
      );

      expect(result.hasSufficient).toBe(false);
      expect(result.cached).toBe(true);
    });

    it("should throw error when blockchain query fails", async () => {
      const error = new Error("RPC error");

      (mockCache.get as MockedFunction<typeof mockCache.get>).mockReturnValue(undefined);
      (mockClient.readContract as MockedFunction<typeof mockClient.readContract>).mockRejectedValue(
        error,
      );

      await expect(
        balanceChecker.checkBalance(mockClient, userAddress, tokenAddress, requiredAmount, network),
      ).rejects.toThrow("RPC error");

      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it("should handle different networks correctly", async () => {
      const mainnetClient = {
        ...mockClient,
        chain: { id: 1 }, // Ethereum mainnet
      } as any;

      const balance = 2000000n;

      (mockCache.get as MockedFunction<typeof mockCache.get>).mockReturnValue(undefined);
      (mockClient.readContract as MockedFunction<typeof mockClient.readContract>).mockResolvedValue(
        balance,
      );

      await balanceChecker.checkBalance(
        mainnetClient,
        userAddress,
        tokenAddress,
        requiredAmount,
        "mainnet",
      );

      // Note: This test would need proper USDC address for mainnet
      // For now, we just verify the cache key structure
      expect(mockCache.get).toHaveBeenCalledWith(
        `mainnet:${userAddress}:0xA0b86a33E6441a8b5d3E93f0B0F8B6B8c7E7E6E5`,
      );
    });
  });

  describe("cache management", () => {
    it("should provide cache statistics", () => {
      const stats = { hits: 10, misses: 5, keys: 3 };
      (mockCache.getStats as MockedFunction<typeof mockCache.getStats>).mockReturnValue(stats);

      const result = balanceChecker.getCacheStats();
      expect(result).toEqual(stats);
    });

    it("should clear cache when requested", () => {
      balanceChecker.clearCache();
      expect(mockCache.flush).toHaveBeenCalled();
    });
  });
});
