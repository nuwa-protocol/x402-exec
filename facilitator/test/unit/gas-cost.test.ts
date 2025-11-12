/**
 * Unit tests for gas cost calculation module
 *
 * Tests the calculateEffectiveGasLimit function which implements
 * dynamic gas limit calculation with triple constraints:
 * 1. Minimum limit (ensure transaction can execute)
 * 2. Maximum limit (absolute safety cap)
 * 3. Dynamic limit (based on facilitator fee for profitability)
 */

import { describe, it, expect } from "vitest";
import { calculateEffectiveGasLimit, type GasCostConfig } from "../../src/gas-cost.js";

describe("calculateEffectiveGasLimit", () => {
  // Base configuration for tests
  const baseConfig: GasCostConfig = {
    minGasLimit: 150000,
    maxGasLimit: 500000,
    dynamicGasLimitMargin: 0.2, // 20% profit margin
    hookGasOverhead: { transfer: 50000, custom: 100000 },
    safetyMultiplier: 1.5,
    validationTolerance: 0.1,
    hookWhitelistEnabled: false,
    allowedHooks: {},
    networkGasPrice: { "base-sepolia": "1000000000" },
    nativeTokenPrice: { "base-sepolia": 3000 },
  };

  describe("Dynamic gas limit (always enabled)", () => {
    it("should use static maxGasLimit when margin is 0 (dynamic disabled)", () => {
      const config = { ...baseConfig, dynamicGasLimitMargin: 0 }; // 0 margin = all fee goes to gas
      const facilitatorFee = "10000000"; // 10 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 3000; // $3000

      // With 0 margin, available = $10.00 (100%)
      // Max affordable gas = $10.00 / $3000 * 1e18 / 10e9 = 333,333 gas
      // Result should be max(150000, min(333333, 500000)) = 333,333 (dynamic still applies)

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(333333);
    });
  });

  describe("When dynamic gas limit is enabled", () => {
    it("should use minimum gas limit when fee is too low", () => {
      const config = baseConfig;
      const facilitatorFee = "1000000"; // 1 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 3000; // ETH = $3000

      // Available for gas = $1.00 * 0.8 = $0.80
      // Max affordable gas = $0.80 / $3000 * 1e18 / 10e9 = 26,666 gas
      // Result should be max(150000, min(26666, 500000)) = 150000 (minimum)

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(config.minGasLimit);
    });

    it("should use dynamic limit when fee is moderate", () => {
      const config = baseConfig;
      const facilitatorFee = "10000000"; // 10 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 3000; // ETH = $3000

      // Available for gas = $10.00 * 0.8 = $8.00
      // Max affordable gas = $8.00 / $3000 * 1e18 / 10e9 = 266,666 gas
      // Result should be max(150000, min(266666, 500000)) = 266,666 (dynamic)

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(266666);
    });

    it("should cap at maxGasLimit when fee is very high", () => {
      const config = baseConfig;
      const facilitatorFee = "100000000"; // 100 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 3000; // ETH = $3000

      // Available for gas = $100.00 * 0.8 = $80.00
      // Max affordable gas = $80.00 / $3000 * 1e18 / 10e9 = 2,666,666 gas
      // Result should be max(150000, min(2666666, 500000)) = 500,000 (maximum)

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(config.maxGasLimit);
    });

    it("should adjust with different profit margins", () => {
      const config = { ...baseConfig, dynamicGasLimitMargin: 0.3 }; // 30% margin
      const facilitatorFee = "10000000"; // 10 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 3000; // ETH = $3000

      // Available for gas = $10.00 * 0.7 = $7.00 (70% available with 30% margin)
      // Max affordable gas = $7.00 / $3000 * 1e18 / 10e9 = 233,333 gas

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(233333);
    });

    it("should handle high gas prices", () => {
      const config = baseConfig;
      const facilitatorFee = "10000000"; // 10 USDC
      const gasPrice = "100000000000"; // 100 gwei (10x higher)
      const nativeTokenPrice = 3000; // ETH = $3000

      // Available for gas = $10.00 * 0.8 = $8.00
      // Max affordable gas = $8.00 / $3000 * 1e18 / 100e9 = 26,666 gas
      // Result should be max(150000, min(26666, 500000)) = 150,000 (minimum)

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(config.minGasLimit);
    });

    it("should handle low gas prices", () => {
      const config = baseConfig;
      const facilitatorFee = "10000000"; // 10 USDC
      const gasPrice = "1000000000"; // 1 gwei (10x lower)
      const nativeTokenPrice = 3000; // ETH = $3000

      // Available for gas = $10.00 * 0.8 = $8.00
      // Max affordable gas = $8.00 / $3000 * 1e18 / 1e9 = 2,666,666 gas
      // Result should be max(150000, min(2666666, 500000)) = 500,000 (maximum)

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(config.maxGasLimit);
    });

    it("should handle different native token prices", () => {
      const config = baseConfig;
      const facilitatorFee = "10000000"; // 10 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 1500; // ETH = $1500 (50% lower)

      // Available for gas = $10.00 * 0.8 = $8.00
      // Max affordable gas = $8.00 / $1500 * 1e18 / 10e9 = 533,333 gas
      // Result should be max(150000, min(533333, 500000)) = 500,000 (maximum)

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(config.maxGasLimit);
    });

    it("should handle expensive tokens (higher ETH price)", () => {
      const config = baseConfig;
      const facilitatorFee = "10000000"; // 10 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 6000; // ETH = $6000 (2x higher)

      // Available for gas = $10.00 * 0.8 = $8.00
      // Max affordable gas = $8.00 / $6000 * 1e18 / 10e9 = 133,333 gas
      // Result should be max(150000, min(133333, 500000)) = 150,000 (minimum)

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(config.minGasLimit);
    });

    it("should handle custom minimum gas limits", () => {
      const config = { ...baseConfig, minGasLimit: 200000 };
      const facilitatorFee = "5000000"; // 5 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 3000; // ETH = $3000

      // Available for gas = $5.00 * 0.8 = $4.00
      // Max affordable gas = $4.00 / $3000 * 1e18 / 10e9 = 133,333 gas
      // Result should be max(200000, min(133333, 500000)) = 200,000 (minimum)

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(200000);
    });

    it("should handle custom maximum gas limits", () => {
      const config = { ...baseConfig, maxGasLimit: 300000 };
      const facilitatorFee = "20000000"; // 20 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 3000; // ETH = $3000

      // Available for gas = $20.00 * 0.8 = $16.00
      // Max affordable gas = $16.00 / $3000 * 1e18 / 10e9 = 533,333 gas
      // Result should be max(150000, min(533333, 300000)) = 300,000 (maximum)

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(300000);
    });

    it("should handle zero profit margin (all fee goes to gas)", () => {
      const config = { ...baseConfig, dynamicGasLimitMargin: 0 };
      const facilitatorFee = "10000000"; // 10 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 3000; // ETH = $3000

      // Available for gas = $10.00 * 1.0 = $10.00 (100% available)
      // Max affordable gas = $10.00 / $3000 * 1e18 / 10e9 = 333,333 gas

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(333333);
    });

    it("should handle very low facilitator fees", () => {
      const config = baseConfig;
      const facilitatorFee = "100000"; // 0.1 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 3000; // ETH = $3000

      // Available for gas = $0.10 * 0.8 = $0.08
      // Max affordable gas = $0.08 / $3000 * 1e18 / 10e9 = 2,666 gas
      // Result should be max(150000, min(2666, 500000)) = 150,000 (minimum)

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(config.minGasLimit);
    });

    it("should protect against division by zero with zero token price", () => {
      const config = baseConfig;
      const facilitatorFee = "10000000"; // 10 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 0; // Invalid: $0

      // This should result in NaN or Infinity, but still be clamped by min/max
      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      // Should fallback to reasonable values (minimum or maximum)
      expect(result).toBeGreaterThanOrEqual(config.minGasLimit);
      expect(result).toBeLessThanOrEqual(config.maxGasLimit);
    });

    it("should handle edge case: facilitatorFee equals minGasLimit cost", () => {
      const config = baseConfig;
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 3000; // ETH = $3000

      // Cost of minGasLimit = 150,000 gas * 10 gwei * $3000 / 1e18 = $4.50
      // Set fee to exactly $4.50 / 0.8 = $5.625 USDC = 5,625,000 smallest units
      const facilitatorFee = "5625000"; // 5.625 USDC

      // Available for gas = $5.625 * 0.8 = $4.50
      // Max affordable gas = $4.50 / $3000 * 1e18 / 10e9 = 150,000 gas

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBe(150000);
    });
  });

  describe("Triple constraint validation", () => {
    it("should respect minimum constraint", () => {
      const config = baseConfig;
      const facilitatorFee = "0"; // No fee
      const gasPrice = "10000000000";
      const nativeTokenPrice = 3000;

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBeGreaterThanOrEqual(config.minGasLimit);
    });

    it("should respect maximum constraint", () => {
      const config = baseConfig;
      const facilitatorFee = "1000000000"; // 1000 USDC (very high)
      const gasPrice = "1"; // Very low gas price
      const nativeTokenPrice = 100; // Low token price

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      expect(result).toBeLessThanOrEqual(config.maxGasLimit);
    });

    it("should apply dynamic constraint within bounds", () => {
      const config = baseConfig;
      const facilitatorFee = "10000000"; // 10 USDC
      const gasPrice = "10000000000"; // 10 gwei
      const nativeTokenPrice = 3000; // ETH = $3000

      const result = calculateEffectiveGasLimit(facilitatorFee, gasPrice, nativeTokenPrice, config);

      // Dynamic calculation gives 266,666 gas
      expect(result).toBeGreaterThan(config.minGasLimit);
      expect(result).toBeLessThan(config.maxGasLimit);
      expect(result).toBe(266666);
    });
  });
});
