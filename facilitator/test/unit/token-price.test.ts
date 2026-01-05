/**
 * Unit tests for token price module
 *
 * Tests the token price fetching functionality with:
 * - V2 CAIP-2 network ID support
 * - V1 alias backward compatibility
 * - BSC network BNB support
 * - Network normalization and fallback behavior
 * - Config override behavior
 * - Cache management
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getTokenPrice,
  clearTokenPriceCache,
  getTokenPriceCacheStats,
  startTokenPriceUpdater,
  type TokenPriceConfig,
} from "../../src/token-price.js";

// Mock the global fetch for CoinGecko API
global.fetch = vi.fn();

describe("token-price module", () => {
  beforeEach(() => {
    // Clear cache before each test
    clearTokenPriceCache();
    vi.clearAllMocks();
  });

  describe("getTokenPrice with CAIP-2 network IDs", () => {
    it("should map Base Sepolia (eip155:84532) to ethereum", async () => {
      const mockPrice = 3000.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("eip155:84532", 1000, config);

      expect(price).toBe(mockPrice);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=ethereum"),
        expect.any(Object)
      );
    });

    it("should map Base mainnet (eip155:8453) to ethereum", async () => {
      const mockPrice = 3500.75;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("eip155:8453", 1000, config);

      expect(price).toBe(mockPrice);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=ethereum"),
        expect.any(Object)
      );
    });

    it("should map X-Layer testnet (eip155:1952) to okb", async () => {
      const mockPrice = 50.25;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ okb: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("eip155:1952", 10, config);

      expect(price).toBe(mockPrice);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=okb"),
        expect.any(Object)
      );
    });

    it("should map X-Layer mainnet (eip155:196) to okb", async () => {
      const mockPrice = 55.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ okb: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("eip155:196", 10, config);

      expect(price).toBe(mockPrice);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=okb"),
        expect.any(Object)
      );
    });

    it("should map BSC testnet (eip155:97) to binancecoin", async () => {
      const mockPrice = 650.75;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ binancecoin: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("eip155:97", 500, config);

      expect(price).toBe(mockPrice);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=binancecoin"),
        expect.any(Object)
      );
    });

    it("should map BSC mainnet (eip155:56) to binancecoin", async () => {
      const mockPrice = 700.25;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ binancecoin: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("eip155:56", 600, config);

      expect(price).toBe(mockPrice);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=binancecoin"),
        expect.any(Object)
      );
    });
  });

  describe("getTokenPrice with V1 alias backward compatibility", () => {
    it("should work with V1 alias 'base-sepolia'", async () => {
      const mockPrice = 3000.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("base-sepolia", 1000, config);

      expect(price).toBe(mockPrice);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=ethereum"),
        expect.any(Object)
      );
    });

    it("should work with V1 alias 'base'", async () => {
      const mockPrice = 3500.75;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("base", 1000, config);

      expect(price).toBe(mockPrice);
    });

    it("should work with V1 alias 'x-layer-testnet'", async () => {
      const mockPrice = 50.25;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ okb: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("x-layer-testnet", 10, config);

      expect(price).toBe(mockPrice);
    });

    it("should work with V1 alias 'x-layer'", async () => {
      const mockPrice = 55.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ okb: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("x-layer", 10, config);

      expect(price).toBe(mockPrice);
    });

    it("should work with V1 alias 'bsc' for BSC mainnet", async () => {
      const mockPrice = 700.25;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ binancecoin: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("bsc", 600, config);

      expect(price).toBe(mockPrice);
    });
  });

  describe("Config override behavior", () => {
    it("should use custom coin ID from config when provided (v2 key)", async () => {
      const mockPrice = 999.99;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ customcoin: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {
          "eip155:84532": "customcoin", // Override default
        },
      };

      const price = await getTokenPrice("eip155:84532", 1000, config);

      expect(price).toBe(mockPrice);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=customcoin"),
        expect.any(Object)
      );
    });

    it("should use custom coin ID from config when provided (v1 key)", async () => {
      const mockPrice = 888.88;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ customv1: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {
          "base-sepolia": "customv1", // Override with v1 key
        },
      };

      const price = await getTokenPrice("base-sepolia", 1000, config);

      expect(price).toBe(mockPrice);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=customv1"),
        expect.any(Object)
      );
    });

    it("should fall back to default mapping when custom config has different v2 key", async () => {
      const mockPrice = 3000.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {
          "eip155:56": "customcoin", // Override for BSC only
        },
      };

      const price = await getTokenPrice("eip155:84532", 1000, config);

      expect(price).toBe(mockPrice);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=ethereum"),
        expect.any(Object)
      );
    });

    it("should fall back to v1 alias in custom config when v2 canonical key not found", async () => {
      const mockPrice = 777.77;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ v1custom: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {
          "base-sepolia": "v1custom", // Only v1 key in config
        },
      };

      // Pass v2 key, should fall back to v1 alias lookup
      const price = await getTokenPrice("eip155:84532", 1000, config);

      expect(price).toBe(mockPrice);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("ids=v1custom"),
        expect.any(Object)
      );
    });
  });

  describe("Fallback behavior", () => {
    it("should return static price when no CoinGecko ID is found", async () => {
      const staticPrice = 123.45;

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      // Use unsupported network (SKALE or similar)
      const price = await getTokenPrice("eip155:1273221638", staticPrice, config);

      expect(price).toBe(staticPrice);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should return static price when network normalization fails", async () => {
      const staticPrice = 456.78;

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      // Use invalid network format
      const price = await getTokenPrice("invalid-network-format", staticPrice, config);

      expect(price).toBe(staticPrice);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should return static price when CoinGecko API fails", async () => {
      const staticPrice = 789.01;
      (global.fetch as any).mockRejectedValue(new Error("Network error"));

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("eip155:84532", staticPrice, config);

      expect(price).toBe(staticPrice);
    });

    it("should return static price when CoinGecko API returns error", async () => {
      const staticPrice = 234.56;
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("eip155:84532", staticPrice, config);

      expect(price).toBe(staticPrice);
    });

    it("should return static price when CoinGecko response is missing price data", async () => {
      const staticPrice = 345.67;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: {} }), // Missing usd field
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("eip155:84532", staticPrice, config);

      expect(price).toBe(staticPrice);
    });

    it("should return static price when dynamic pricing is disabled", async () => {
      const staticPrice = 999.99;

      const config: TokenPriceConfig = {
        enabled: false, // Disabled
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      const price = await getTokenPrice("eip155:84532", staticPrice, config);

      expect(price).toBe(staticPrice);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Cache behavior", () => {
    it("should cache fetched prices", async () => {
      const mockPrice = 3000.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      // First call - should fetch
      const price1 = await getTokenPrice("eip155:84532", 1000, config);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(price1).toBe(mockPrice);

      // Second call - should use cache
      const price2 = await getTokenPrice("eip155:84532", 1000, config);
      expect(global.fetch).toHaveBeenCalledTimes(1); // No additional fetch
      expect(price2).toBe(mockPrice);
    });

    it("should respect cache TTL", async () => {
      const mockPrice1 = 3000.5;
      const mockPrice2 = 3100.0;
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ethereum: { usd: mockPrice1 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ethereum: { usd: mockPrice2 } }),
        });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 0, // Immediately expire
        updateInterval: 300,
        coinIds: {},
      };

      // First call
      const price1 = await getTokenPrice("eip155:84532", 1000, config);
      expect(price1).toBe(mockPrice1);

      // Second call - cache expired, should fetch again
      const price2 = await getTokenPrice("eip155:84532", 1000, config);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(price2).toBe(mockPrice2);
    });

    it("should provide cache statistics", async () => {
      const mockPrice = 3000.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      // Fetch a price
      await getTokenPrice("eip155:84532", 1000, config);

      // Get stats
      const stats = getTokenPriceCacheStats();

      expect(stats).toHaveProperty("eip155:84532");
      expect(stats["eip155:84532"].price).toBe(mockPrice);
      expect(stats["eip155:84532"].age).toBeGreaterThanOrEqual(0);
    });

    it("should clear cache for specific network", async () => {
      const mockPrice = 3000.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      // Fetch a price
      await getTokenPrice("eip155:84532", 1000, config);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Clear cache for this network
      clearTokenPriceCache("eip155:84532");

      // Fetch again - should call API again
      await getTokenPrice("eip155:84532", 1000, config);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it("should clear all cache", async () => {
      const mockPrice = 3000.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      // Fetch prices for multiple networks
      await getTokenPrice("eip155:84532", 1000, config);
      await getTokenPrice("eip155:56", 600, config);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // Clear all cache
      clearTokenPriceCache();

      // Fetch again - should call API again
      await getTokenPrice("eip155:84532", 1000, config);
      await getTokenPrice("eip155:56", 600, config);
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe("API key support", () => {
    it("should use Pro API URL when API key is provided", async () => {
      const mockPrice = 3000.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        apiKey: "test-api-key",
        coinIds: {},
      };

      await getTokenPrice("eip155:84532", 1000, config);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("pro-api.coingecko.com"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-cg-pro-api-key": "test-api-key",
          }),
        })
      );
    });

    it("should use free API URL when no API key is provided", async () => {
      const mockPrice = 3000.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      await getTokenPrice("eip155:84532", 1000, config);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("api.coingecko.com"),
        expect.any(Object)
      );
    });
  });

  describe("Background updater", () => {
    it("should start background updater and return cleanup function", async () => {
      const mockPrice = 3000.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 1, // 1 second
        coinIds: {},
      };

      const cleanup = startTokenPriceUpdater(
        ["eip155:84532", "eip155:56"],
        { "eip155:84532": 1000, "eip155:56": 600 },
        config
      );

      expect(typeof cleanup).toBe("function");

      // Wait for initial update
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cleanup
      cleanup();

      // Wait to ensure no more updates
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should have been called at least once for initial update
      expect(global.fetch).toHaveBeenCalled();
    });

    it("should handle errors in background updates gracefully", async () => {
      (global.fetch as any).mockRejectedValue(new Error("API error"));

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 1,
        coinIds: {},
      };

      const cleanup = startTokenPriceUpdater(
        ["eip155:84532"],
        { "eip155:84532": 1000 },
        config
      );

      // Wait for initial update attempt
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not throw despite API error
      expect(global.fetch).toHaveBeenCalled();

      cleanup();
    });
  });

  describe("Edge cases", () => {
    it("should handle empty config gracefully", async () => {
      const staticPrice = 100;

      // Config is optional
      const price = await getTokenPrice("eip155:84532", staticPrice);

      expect(price).toBe(staticPrice);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle config with missing coinIds gracefully", async () => {
      const mockPrice = 3000.5;
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ ethereum: { usd: mockPrice } }),
      });

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        // coinIds is optional
      };

      const price = await getTokenPrice("eip155:84532", 1000, config);

      expect(price).toBe(mockPrice);
    });

    it("should handle zero static price", async () => {
      const staticPrice = 0;

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      // Use unsupported network
      const price = await getTokenPrice("eip155:1273221638", staticPrice, config);

      expect(price).toBe(0);
    });

    it("should handle negative static price", async () => {
      const staticPrice = -100;

      const config: TokenPriceConfig = {
        enabled: true,
        cacheTTL: 60,
        updateInterval: 300,
        coinIds: {},
      };

      // Use unsupported network
      const price = await getTokenPrice("eip155:1273221638", staticPrice, config);

      expect(price).toBe(-100);
    });
  });
});
