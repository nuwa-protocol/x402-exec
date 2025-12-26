import { describe, it, expect } from "vitest";
import { validateTokenAddress } from "../../src/settlement.js";
import { SettlementExtraError } from "@x402x/core";

describe("Token Address Validation", () => {
  describe("validateTokenAddress", () => {
    it("should accept valid USDC address for base-sepolia", () => {
      const network = "base-sepolia";
      const usdcAddress = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

      expect(() => {
        validateTokenAddress(network, usdcAddress);
      }).not.toThrow();
    });

    it("should accept USDC address in different case", () => {
      const network = "base-sepolia";
      const usdcAddress = "0x036cbd53842c5426634e7929541ec2318f3dcf7e"; // lowercase

      expect(() => {
        validateTokenAddress(network, usdcAddress);
      }).not.toThrow();
    });

    it("should reject non-USDC token address", () => {
      const network = "base-sepolia";
      const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F"; // DAI on mainnet

      expect(() => {
        validateTokenAddress(network, daiAddress);
      }).toThrow(SettlementExtraError);

      expect(() => {
        validateTokenAddress(network, daiAddress);
      }).toThrow(/Only USDC is currently supported/);
    });

    it("should accept valid USDC address for x-layer-testnet", () => {
      const network = "x-layer-testnet";
      const usdcAddress = "0xcb8bf24c6ce16ad21d707c9505421a17f2bec79d";

      expect(() => {
        validateTokenAddress(network, usdcAddress);
      }).not.toThrow();
    });

    it("should reject random token address", () => {
      const network = "base-sepolia";
      const randomAddress = "0x1234567890123456789012345678901234567890";

      expect(() => {
        validateTokenAddress(network, randomAddress);
      }).toThrow(SettlementExtraError);
    });

    it("should throw error for unsupported network", () => {
      const network = "unknown-network";
      const someAddress = "0x1234567890123456789012345678901234567890";

      expect(() => {
        validateTokenAddress(network, someAddress);
      }).toThrow(/Unknown network/);
    });

    it("should provide helpful error message with expected and actual addresses", () => {
      const network = "base-sepolia";
      const wrongAddress = "0x1234567890123456789012345678901234567890";

      try {
        validateTokenAddress(network, wrongAddress);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).toBeInstanceOf(SettlementExtraError);
        const message = (error as Error).message;
        expect(message).toContain("Only USDC is currently supported");
        expect(message).toContain("base-sepolia");
        expect(message).toContain("Expected:");
        expect(message).toContain("Got:");
        expect(message).toContain(wrongAddress);
      }
    });
  });
});
