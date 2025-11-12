/**
 * Fee Validation Middleware Tests
 *
 * Tests the fee validation logic with tolerance mechanism
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createFeeValidationMiddleware } from "../../../src/middleware/fee-validation.js";
import type { GasCostConfig } from "../../../src/gas-cost.js";
import type { DynamicGasPriceConfig } from "../../../src/dynamic-gas-price.js";
import type { TokenPriceConfig } from "../../../src/token-price.js";
import { calculateMinFacilitatorFee } from "../../../src/gas-cost.js";
import { isSettlementMode } from "../../../src/settlement.js";
import { DEFAULTS } from "../../../src/defaults.js";

// Mock dependencies
vi.mock("../../../src/gas-cost.js", async () => {
  const actual = await vi.importActual("../../../src/gas-cost.js");
  return {
    ...actual,
    calculateMinFacilitatorFee: vi.fn(),
  };
});

vi.mock("../../../src/settlement.js", () => ({
  isSettlementMode: vi.fn(),
}));

vi.mock("@x402x/core", () => ({
  getNetworkConfig: vi.fn(() => ({
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  })),
}));

describe("Fee Validation Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let config: GasCostConfig;
  let dynamicConfig: DynamicGasPriceConfig;
  let tokenPriceConfig: TokenPriceConfig;

  beforeEach(() => {
    mockReq = {
      body: {
        paymentRequirements: {
          network: "base-sepolia",
          extra: {
            hook: "0x1234567890123456789012345678901234567890",
            facilitatorFee: "1000000", // 1 USDC (6 decimals)
          },
        },
      },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();

    config = {
      // Gas Limit Configuration
      minGasLimit: DEFAULTS.gasCost.MIN_GAS_LIMIT,
      maxGasLimit: DEFAULTS.gasCost.MAX_GAS_LIMIT,
      dynamicGasLimitMargin: DEFAULTS.gasCost.DYNAMIC_GAS_LIMIT_MARGIN,

      // Gas Overhead Configuration
      hookGasOverhead: {
        transfer: DEFAULTS.gasCost.HOOK_TRANSFER_OVERHEAD,
        custom: DEFAULTS.gasCost.HOOK_CUSTOM_OVERHEAD,
      },
      safetyMultiplier: DEFAULTS.gasCost.SAFETY_MULTIPLIER,

      // Fee Validation
      validationTolerance: DEFAULTS.gasCost.VALIDATION_TOLERANCE, // 10% tolerance

      // Hook Security
      hookWhitelistEnabled: false,
      allowedHooks: {},

      // Fallback Prices
      networkGasPrice: {
        "base-sepolia": "1000000000", // 1 gwei
      },
      nativeTokenPrice: {
        "base-sepolia": 3000, // $3000 ETH
      },
    } satisfies GasCostConfig;

    dynamicConfig = {
      strategy: "static",
      cacheTTL: 300,
      updateInterval: 60,
      rpcUrls: {},
    } satisfies DynamicGasPriceConfig;

    tokenPriceConfig = {
      enabled: false,
      cacheTTL: 3600,
      updateInterval: 600,
      coinIds: {},
    } satisfies TokenPriceConfig;

    // Reset mocks
    vi.clearAllMocks();
  });

  describe("Tolerance Mechanism", () => {
    it("should accept fee exactly at minimum requirement", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(true);
      vi.mocked(calculateMinFacilitatorFee).mockResolvedValue({
        minFacilitatorFee: "1000000", // Exactly the provided fee
        minFacilitatorFeeUSD: "1.00",
        gasLimit: 200000,
        maxGasLimit: 500000,
        gasPrice: "1000000000",
        gasCostNative: "0.0006",
        gasCostUSD: "1.80",
        safetyMultiplier: 1.5,
        finalCostUSD: "1.00",
        hookAllowed: true,
      });

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should accept fee within tolerance (5% below minimum)", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(true);

      // Required fee is 1.05 USDC, but provided is 1.00 USDC
      // With 10% tolerance, threshold = 1.05 * 0.9 = 0.945 USDC
      // Provided 1.00 > 0.945, so should pass
      vi.mocked(calculateMinFacilitatorFee).mockResolvedValue({
        minFacilitatorFee: "1050000", // 1.05 USDC
        minFacilitatorFeeUSD: "1.05",
        gasLimit: 200000,
        maxGasLimit: 500000,
        gasPrice: "1000000000",
        gasCostNative: "0.0006",
        gasCostUSD: "1.80",
        safetyMultiplier: 1.5,
        finalCostUSD: "1.05",
        hookAllowed: true,
      });

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should accept fee exactly at tolerance threshold", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(true);

      // Required fee is 1,111,111 (threshold = 1,111,111 * 0.9 = 1,000,000)
      // Provided fee is exactly 1,000,000, should pass
      vi.mocked(calculateMinFacilitatorFee).mockResolvedValue({
        minFacilitatorFee: "1111111",
        minFacilitatorFeeUSD: "1.11",
        gasLimit: 200000,
        maxGasLimit: 500000,
        gasPrice: "1000000000",
        gasCostNative: "0.0006",
        gasCostUSD: "1.80",
        safetyMultiplier: 1.5,
        finalCostUSD: "1.11",
        hookAllowed: true,
      });

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should reject fee below tolerance threshold", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(true);

      // Required fee is 1.2 USDC
      // With 10% tolerance, threshold = 1.2 * 0.9 = 1.08 USDC
      // Provided 1.0 < 1.08, so should fail
      vi.mocked(calculateMinFacilitatorFee).mockResolvedValue({
        minFacilitatorFee: "1200000", // 1.2 USDC
        minFacilitatorFeeUSD: "1.20",
        gasLimit: 200000,
        maxGasLimit: 500000,
        gasPrice: "1000000000",
        gasCostNative: "0.0006",
        gasCostUSD: "1.80",
        safetyMultiplier: 1.5,
        finalCostUSD: "1.20",
        hookAllowed: true,
      });

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Insufficient facilitator fee",
          providedFee: "1000000",
          minFacilitatorFee: "1200000",
          threshold: "1080000", // 1.2 * 0.9 = 1.08
          validationTolerance: 0.1,
        }),
      );
    });

    it("should work with different tolerance values", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(true);

      // Set 20% tolerance
      config.validationTolerance = 0.2;

      // Required fee is 1.25 USDC
      // With 20% tolerance, threshold = 1.25 * 0.8 = 1.0 USDC
      // Provided 1.0 = 1.0, so should pass
      vi.mocked(calculateMinFacilitatorFee).mockResolvedValue({
        minFacilitatorFee: "1250000", // 1.25 USDC
        minFacilitatorFeeUSD: "1.25",
        gasLimit: 200000,
        maxGasLimit: 500000,
        gasPrice: "1000000000",
        gasCostNative: "0.0006",
        gasCostUSD: "1.80",
        safetyMultiplier: 1.5,
        finalCostUSD: "1.25",
        hookAllowed: true,
      });

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should work with zero tolerance (strict validation)", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(true);

      // Set 0% tolerance (strict validation)
      config.validationTolerance = 0;

      // Required fee is 1.01 USDC, provided is 1.00 USDC
      // Should fail with strict validation
      vi.mocked(calculateMinFacilitatorFee).mockResolvedValue({
        minFacilitatorFee: "1010000", // 1.01 USDC
        minFacilitatorFeeUSD: "1.01",
        gasLimit: 200000,
        maxGasLimit: 500000,
        gasPrice: "1000000000",
        gasCostNative: "0.0006",
        gasCostUSD: "1.80",
        safetyMultiplier: 1.5,
        finalCostUSD: "1.01",
        hookAllowed: true,
      });

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should handle large fee amounts correctly", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(true);

      // Large amounts: 100 USDC
      mockReq.body!.paymentRequirements.extra.facilitatorFee = "100000000"; // 100 USDC

      // Required is 105 USDC
      // Threshold = 105 * 0.9 = 94.5 USDC
      // Provided 100 > 94.5, should pass
      vi.mocked(calculateMinFacilitatorFee).mockResolvedValue({
        minFacilitatorFee: "105000000", // 105 USDC
        minFacilitatorFeeUSD: "105.00",
        gasLimit: 200000,
        maxGasLimit: 500000,
        gasPrice: "1000000000",
        gasCostNative: "0.0006",
        gasCostUSD: "1.80",
        safetyMultiplier: 1.5,
        finalCostUSD: "105.00",
        hookAllowed: true,
      });

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should handle very small fee amounts correctly", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(true);

      // Small amounts: 0.01 USDC
      mockReq.body!.paymentRequirements.extra.facilitatorFee = "10000"; // 0.01 USDC

      // Required is 0.011 USDC
      // Threshold = 0.011 * 0.9 = 0.0099 USDC
      // Provided 0.01 > 0.0099, should pass
      vi.mocked(calculateMinFacilitatorFee).mockResolvedValue({
        minFacilitatorFee: "11000", // 0.011 USDC
        minFacilitatorFeeUSD: "0.011",
        gasLimit: 200000,
        maxGasLimit: 500000,
        gasPrice: "1000000000",
        gasCostNative: "0.0006",
        gasCostUSD: "1.80",
        safetyMultiplier: 1.5,
        finalCostUSD: "0.011",
        hookAllowed: true,
      });

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("Price Fluctuation Scenarios", () => {
    it("should handle gas price increase within tolerance", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(true);

      // Simulate scenario where gas price increased by 8% between calculation and validation
      // Original calculated fee was 1.0 USDC, but now requires 1.08 USDC
      // With 10% tolerance, threshold = 1.08 * 0.9 = 0.972 USDC
      // Provided 1.0 > 0.972, should pass
      vi.mocked(calculateMinFacilitatorFee).mockResolvedValue({
        minFacilitatorFee: "1080000", // 1.08 USDC (8% increase)
        minFacilitatorFeeUSD: "1.08",
        gasLimit: 200000,
        maxGasLimit: 500000,
        gasPrice: "1080000000", // Gas price increased
        gasCostNative: "0.000648",
        gasCostUSD: "1.944",
        safetyMultiplier: 1.5,
        finalCostUSD: "1.08",
        hookAllowed: true,
      });

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should reject fee when gas price increase exceeds tolerance", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(true);

      // Simulate scenario where gas price increased by 15% between calculation and validation
      // Original calculated fee was 1.0 USDC, but now requires 1.15 USDC
      // With 10% tolerance, threshold = 1.15 * 0.9 = 1.035 USDC
      // Provided 1.0 < 1.035, should fail
      vi.mocked(calculateMinFacilitatorFee).mockResolvedValue({
        minFacilitatorFee: "1150000", // 1.15 USDC (15% increase)
        minFacilitatorFeeUSD: "1.15",
        gasLimit: 200000,
        maxGasLimit: 500000,
        gasPrice: "1150000000", // Gas price increased significantly
        gasCostNative: "0.00069",
        gasCostUSD: "2.07",
        safetyMultiplier: 1.5,
        finalCostUSD: "1.15",
        hookAllowed: true,
      });

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it("should handle token price fluctuation within tolerance", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(true);

      // Simulate scenario where ETH price decreased by 5%
      // This would increase the required fee in USDC terms
      vi.mocked(calculateMinFacilitatorFee).mockResolvedValue({
        minFacilitatorFee: "1050000", // 1.05 USDC (5% increase due to ETH price drop)
        minFacilitatorFeeUSD: "1.05",
        gasLimit: 200000,
        maxGasLimit: 500000,
        gasPrice: "1000000000",
        gasCostNative: "0.0006",
        gasCostUSD: "1.71", // Less USD because ETH price dropped
        safetyMultiplier: 1.5,
        finalCostUSD: "1.05",
        hookAllowed: true,
      });

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should skip validation when not in settlement mode", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(false);

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(calculateMinFacilitatorFee).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle missing payment requirements", async () => {
      mockReq.body = {};

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Invalid request",
          message: "Missing paymentRequirements in request body",
        }),
      );
    });

    it("should handle fee calculation errors gracefully", async () => {
      vi.mocked(isSettlementMode).mockReturnValue(true);
      vi.mocked(calculateMinFacilitatorFee).mockRejectedValue(new Error("Gas price fetch failed"));

      const middleware = createFeeValidationMiddleware(config, dynamicConfig, tokenPriceConfig);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Invalid request",
          message: "Gas price fetch failed",
        }),
      );
    });
  });
});
