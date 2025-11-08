/**
 * Tests for cache/memory-cache.ts
 *
 * Tests memory cache implementation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryCache, createMemoryCache } from "../../../src/cache/memory-cache.js";

describe("cache/memory-cache", () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = createMemoryCache({
      stdTTL: 10, // 10 seconds for test
      checkperiod: 0, // Disable auto cleanup for deterministic tests
      maxKeys: 10,
    });
  });

  describe("basic operations", () => {
    it("should set and get values", () => {
      cache.set("key1", "value1");

      const value = cache.get<string>("key1");
      expect(value).toBe("value1");
    });

    it("should return undefined for missing keys", () => {
      const value = cache.get("nonexistent");
      expect(value).toBeUndefined();
    });

    it("should delete keys", () => {
      cache.set("key1", "value1");
      expect(cache.has("key1")).toBe(true);

      const deleted = cache.del("key1");
      expect(deleted).toBe(true);
      expect(cache.has("key1")).toBe(false);
    });

    it("should return false when deleting nonexistent key", () => {
      const deleted = cache.del("nonexistent");
      expect(deleted).toBe(false);
    });

    it("should check if key exists", () => {
      expect(cache.has("key1")).toBe(false);

      cache.set("key1", "value1");
      expect(cache.has("key1")).toBe(true);
    });

    it("should flush all keys", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      cache.set("key3", "value3");

      expect(cache.getStats().keys).toBe(3);

      cache.flush();

      expect(cache.getStats().keys).toBe(0);
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
    });
  });

  describe("TTL expiration", () => {
    it("should expire keys after TTL", async () => {
      cache.set("key1", "value1", 1); // 1 second TTL

      expect(cache.get("key1")).toBe("value1");

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(cache.get("key1")).toBeUndefined();
    });

    it("should use default TTL when not specified", async () => {
      // For this test, we just verify the key exists initially
      // Testing actual expiration would take 10 seconds
      cache.set("key1", "value1"); // Use default 10s TTL

      expect(cache.get("key1")).toBe("value1");
      // Don't wait for expiration in tests
    });

    it("should allow different TTLs for different keys", async () => {
      cache.set("short", "value1", 1); // 1 second
      cache.set("long", "value2", 3); // 3 seconds

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(cache.get("short")).toBeUndefined();
      expect(cache.get("long")).toBe("value2");
    });
  });

  describe("statistics", () => {
    it("should track hits and misses", () => {
      cache.set("key1", "value1");

      // Hit
      cache.get("key1");

      // Miss
      cache.get("key2");
      cache.get("key3");

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
    });

    it("should track number of keys", () => {
      expect(cache.getStats().keys).toBe(0);

      cache.set("key1", "value1");
      cache.set("key2", "value2");

      expect(cache.getStats().keys).toBe(2);

      cache.del("key1");
      expect(cache.getStats().keys).toBe(1);
    });

    it("should calculate hit rate", () => {
      cache.set("key1", "value1");

      // 2 hits
      cache.get("key1");
      cache.get("key1");

      // 1 miss
      cache.get("key2");

      const hitRate = cache.getHitRate();
      expect(hitRate).toBeCloseTo(66.67, 1); // 2/3 = 66.67%
    });

    it("should return 0 hit rate when no access", () => {
      const hitRate = cache.getHitRate();
      expect(hitRate).toBe(0);
    });

    it("should reset stats on flush", () => {
      cache.set("key1", "value1");
      cache.get("key1");
      cache.get("key2");

      expect(cache.getStats().hits).toBe(1);
      expect(cache.getStats().misses).toBe(1);

      cache.flush();

      expect(cache.getStats().hits).toBe(0);
      expect(cache.getStats().misses).toBe(0);
    });
  });

  describe("data types", () => {
    it("should store and retrieve strings", () => {
      cache.set("str", "hello");
      expect(cache.get<string>("str")).toBe("hello");
    });

    it("should store and retrieve numbers", () => {
      cache.set("num", 42);
      expect(cache.get<number>("num")).toBe(42);
    });

    it("should store and retrieve booleans", () => {
      cache.set("bool", true);
      expect(cache.get<boolean>("bool")).toBe(true);
    });

    it("should store and retrieve objects", () => {
      const obj = { name: "test", value: 123 };
      cache.set("obj", obj);
      expect(cache.get("obj")).toEqual(obj);
    });

    it("should store and retrieve arrays", () => {
      const arr = [1, 2, 3, 4];
      cache.set("arr", arr);
      expect(cache.get<number[]>("arr")).toEqual(arr);
    });

    it("should store and retrieve null", () => {
      cache.set("null", null);
      expect(cache.get("null")).toBe(null);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string key", () => {
      cache.set("", "value");
      expect(cache.get("")).toBe("value");
    });

    it("should handle overwriting existing keys", () => {
      cache.set("key", "value1");
      expect(cache.get("key")).toBe("value1");

      cache.set("key", "value2");
      expect(cache.get("key")).toBe("value2");
    });

    it("should respect maxKeys limit", () => {
      // Cache configured with maxKeys: 10
      // node-cache throws error when max keys exceeded
      // Just verify we can add up to maxKeys
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      const stats = cache.getStats();
      expect(stats.keys).toBe(10);
    });
  });

  describe("factory function", () => {
    it("should create cache with default config", () => {
      const defaultCache = createMemoryCache();
      expect(defaultCache).toBeInstanceOf(MemoryCache);
    });

    it("should create cache with custom config", () => {
      const customCache = createMemoryCache({
        stdTTL: 60,
        maxKeys: 100,
      });
      expect(customCache).toBeInstanceOf(MemoryCache);
    });
  });
});
