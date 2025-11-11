import { describe, it, expect, beforeEach, vi } from "vitest";
import { RewardHook } from "./RewardHook";

describe("RewardHook", () => {
  beforeEach(() => {
    // Reset environment variables before each test
    vi.stubEnv("VITE_BASE_SEPOLIA_REWARD_HOOK_ADDRESS", "");
    vi.stubEnv("VITE_X_LAYER_TESTNET_REWARD_HOOK_ADDRESS", "");
  });

  describe("getAddress", () => {
    it("should throw error when address is not configured", () => {
      expect(() => RewardHook.getAddress("base-sepolia")).toThrow(
        'RewardHook address not configured for network "base-sepolia"'
      );
    });

    it("should throw error with helpful message about env variable", () => {
      expect(() => RewardHook.getAddress("base-sepolia")).toThrow(
        "Please set VITE_BASE_SEPOLIA_REWARD_HOOK_ADDRESS in .env file"
      );
    });

    it("should throw error for xlayer-testnet when not configured", () => {
      expect(() => RewardHook.getAddress("xlayer-testnet")).toThrow(
        'RewardHook address not configured for network "xlayer-testnet"'
      );
      expect(() => RewardHook.getAddress("xlayer-testnet")).toThrow(
        "Please set VITE_X_LAYER_TESTNET_REWARD_HOOK_ADDRESS in .env file"
      );
    });

    it("should return address when configured", () => {
      // Mock environment variable
      vi.stubEnv("VITE_BASE_SEPOLIA_REWARD_HOOK_ADDRESS", "0x1234567890123456789012345678901234567890");
      
      const address = RewardHook.getAddress("base-sepolia");
      expect(address).toBe("0x1234567890123456789012345678901234567890");
    });

    it("should throw error for unknown network", () => {
      expect(() => RewardHook.getAddress("unknown-network")).toThrow(
        'RewardHook address not configured for network "unknown-network"'
      );
    });
  });

  describe("encode", () => {
    it("should encode RewardConfig correctly", () => {
      const config = {
        rewardToken: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        merchant: "0x0987654321098765432109876543210987654321" as `0x${string}`,
      };

      const encoded = RewardHook.encode(config);
      
      // Should return a hex string
      expect(encoded).toMatch(/^0x[0-9a-f]+$/);
      // Should be non-empty
      expect(encoded.length).toBeGreaterThan(2);
    });
  });
});

