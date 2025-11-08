/**
 * Tests for cache/token-cache.ts
 *
 * Tests token cache wrapper
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TokenCache, createTokenCache } from "../../../src/cache/token-cache.js";
import { createMockCache } from "../../utils/fixtures.js";

describe("cache/token-cache", () => {
  let mockCache: ReturnType<typeof createMockCache>;
  let tokenCache: TokenCache;

  beforeEach(() => {
    mockCache = createMockCache();
    tokenCache = createTokenCache(mockCache, {
      versionTTL: 3600,
      metadataTTL: 7200,
    });
  });

  describe("getVersion", () => {
    it("should fetch and cache version on cache miss", async () => {
      const getter = vi.fn().mockResolvedValue("1");

      const version = await tokenCache.getVersion("base-sepolia", "0xtoken", getter);

      expect(version).toBe("1");
      expect(getter).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith("version:base-sepolia:0xtoken", "1", 3600);
    });

    it("should return cached version on cache hit", async () => {
      // Pre-populate cache
      mockCache.get.mockReturnValueOnce("1");

      const getter = vi.fn().mockResolvedValue("1");

      const version = await tokenCache.getVersion("base-sepolia", "0xtoken", getter);

      expect(version).toBe("1");
      expect(getter).not.toHaveBeenCalled();
      expect(mockCache.get).toHaveBeenCalledWith("version:base-sepolia:0xtoken");
    });

    it("should normalize token address to lowercase", async () => {
      const getter = vi.fn().mockResolvedValue("1");

      await tokenCache.getVersion("base-sepolia", "0xTOKEN", getter);

      expect(mockCache.set).toHaveBeenCalledWith("version:base-sepolia:0xtoken", "1", 3600);
    });
  });

  describe("getMetadata", () => {
    it("should fetch and cache metadata on cache miss", async () => {
      const metadata = { name: "USDC", symbol: "USDC", decimals: 6 };
      const getter = vi.fn().mockResolvedValue(metadata);

      const result = await tokenCache.getMetadata("base-sepolia", "0xtoken", getter);

      expect(result).toEqual(metadata);
      expect(getter).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith("metadata:base-sepolia:0xtoken", metadata, 7200);
    });

    it("should return cached metadata on cache hit", async () => {
      const metadata = { name: "USDC", symbol: "USDC", decimals: 6 };
      mockCache.get.mockReturnValueOnce(metadata);

      const getter = vi.fn();

      const result = await tokenCache.getMetadata("base-sepolia", "0xtoken", getter);

      expect(result).toEqual(metadata);
      expect(getter).not.toHaveBeenCalled();
    });

    it("should normalize token address to lowercase", async () => {
      const metadata = { name: "USDC" };
      const getter = vi.fn().mockResolvedValue(metadata);

      await tokenCache.getMetadata("base-sepolia", "0xTOKEN", getter);

      expect(mockCache.set).toHaveBeenCalledWith("metadata:base-sepolia:0xtoken", metadata, 7200);
    });
  });

  describe("invalidateVersion", () => {
    it("should delete version from cache", () => {
      tokenCache.invalidateVersion("base-sepolia", "0xtoken");

      expect(mockCache.del).toHaveBeenCalledWith("version:base-sepolia:0xtoken");
    });

    it("should normalize token address to lowercase", () => {
      tokenCache.invalidateVersion("base-sepolia", "0xTOKEN");

      expect(mockCache.del).toHaveBeenCalledWith("version:base-sepolia:0xtoken");
    });
  });

  describe("invalidateMetadata", () => {
    it("should delete metadata from cache", () => {
      tokenCache.invalidateMetadata("base-sepolia", "0xtoken");

      expect(mockCache.del).toHaveBeenCalledWith("metadata:base-sepolia:0xtoken");
    });

    it("should normalize token address to lowercase", () => {
      tokenCache.invalidateMetadata("base-sepolia", "0xTOKEN");

      expect(mockCache.del).toHaveBeenCalledWith("metadata:base-sepolia:0xtoken");
    });
  });

  describe("clearAll", () => {
    it("should flush underlying cache", () => {
      tokenCache.clearAll();

      expect(mockCache.flush).toHaveBeenCalled();
    });
  });

  describe("getStats", () => {
    it("should return stats from underlying cache", () => {
      const stats = {
        keys: 5,
        hits: 10,
        misses: 2,
        ksize: 100,
        vsize: 500,
      };

      mockCache.getStats.mockReturnValue(stats);

      const result = tokenCache.getStats();

      expect(result).toEqual(stats);
      expect(mockCache.getStats).toHaveBeenCalled();
    });
  });

  describe("cache key generation", () => {
    it("should generate version keys with correct format", async () => {
      const getter = vi.fn().mockResolvedValue("1");

      await tokenCache.getVersion("network", "0xaddress", getter);

      expect(mockCache.set).toHaveBeenCalledWith(
        "version:network:0xaddress",
        expect.anything(),
        expect.anything(),
      );
    });

    it("should generate metadata keys with correct format", async () => {
      const getter = vi.fn().mockResolvedValue({});

      await tokenCache.getMetadata("network", "0xaddress", getter);

      expect(mockCache.set).toHaveBeenCalledWith(
        "metadata:network:0xaddress",
        expect.anything(),
        expect.anything(),
      );
    });

    it("should differentiate between version and metadata keys", async () => {
      const versionGetter = vi.fn().mockResolvedValue("1");
      const metadataGetter = vi.fn().mockResolvedValue({});

      await tokenCache.getVersion("network", "0xaddress", versionGetter);
      await tokenCache.getMetadata("network", "0xaddress", metadataGetter);

      const calls = mockCache.set.mock.calls;
      expect(calls[0][0]).toBe("version:network:0xaddress");
      expect(calls[1][0]).toBe("metadata:network:0xaddress");
    });
  });

  describe("TTL configuration", () => {
    it("should use configured versionTTL", async () => {
      const getter = vi.fn().mockResolvedValue("1");

      await tokenCache.getVersion("network", "0xaddress", getter);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        3600, // versionTTL
      );
    });

    it("should use configured metadataTTL", async () => {
      const getter = vi.fn().mockResolvedValue({});

      await tokenCache.getMetadata("network", "0xaddress", getter);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        7200, // metadataTTL
      );
    });

    it("should use default TTL when not configured", async () => {
      const defaultCache = createTokenCache(mockCache);
      const getter = vi.fn().mockResolvedValue("1");

      await defaultCache.getVersion("network", "0xaddress", getter);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        3600, // default 1 hour
      );
    });
  });

  describe("factory function", () => {
    it("should create TokenCache instance", () => {
      const cache = createTokenCache(mockCache);
      expect(cache).toBeInstanceOf(TokenCache);
    });

    it("should accept custom config", () => {
      const cache = createTokenCache(mockCache, {
        versionTTL: 1800,
        metadataTTL: 3600,
      });
      expect(cache).toBeInstanceOf(TokenCache);
    });
  });
});
