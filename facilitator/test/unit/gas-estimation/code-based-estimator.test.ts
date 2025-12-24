/**
 * CodeBasedGasEstimator Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { CodeBasedGasEstimator } from "../../../src/gas-estimation/strategies/code-based.js";
import type {
  SettlementGasParams,
  GasEstimationConfig,
} from "../../../src/gas-estimation/strategies/base.js";

// Mock hook validators
const mockTransferValidator = {
  validate: vi.fn(),
};

const mockCustomValidator = {
  validate: vi.fn(),
};

// Mock hook type info
vi.mock("../../../src/hook-validators/index.js", () => ({
  getHookTypeInfo: vi.fn(),
}));

import { getHookTypeInfo } from "../../../src/hook-validators/index.js";

describe("CodeBasedGasEstimator", () => {
  let estimator: CodeBasedGasEstimator;
  let mockParams: SettlementGasParams;
  let mockConfig: GasEstimationConfig;

  beforeEach(() => {
    estimator = new CodeBasedGasEstimator();

    mockParams = {
      network: "base-sepolia",
      hook: "0x1234567890123456789012345678901234567890",
      hookData: "0x",
      settlementRouter: "0x0987654321098765432109876543210987654321",
      token: "0x0000000000000000000000000000000000000000",
      from: "0x1111111111111111111111111111111111111111",
      value: 1000000n,
      authorization: {
        validAfter: 1000000n,
        validBefore: 2000000n,
        nonce: "0x1234567890abcdef",
      },
      signature:
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
      salt: "0x1234567890abcdef1234567890abcdef",
      payTo: "0x2222222222222222222222222222222222222222",
      facilitatorFee: 10000n,
      hookAmount: 990000n,
      walletClient: {} as any,
      gasCostConfig: {
        minGasLimit: 150000,
        maxGasLimit: 5000000,
        dynamicGasLimitMargin: 0.2,
        hookGasOverhead: {},
        safetyMultiplier: 1.5,
        validationTolerance: 0.1,
        hookWhitelistEnabled: false,
        allowedHooks: {},
        networkGasPrice: {},
        nativeTokenPrice: {},
      },
      gasEstimationConfig: {
        enabled: true,
        strategy: "smart",
        codeValidationEnabled: true,
        safetyMultiplier: 1.2,
        timeoutMs: 5000,
      },
    };

    mockConfig = mockParams.gasEstimationConfig;
  });

  describe("strategy name", () => {
    it("should have correct strategy name", () => {
      expect(estimator.strategyName).toBe("code_calculation");
    });
  });

  describe("built-in hook validation", () => {
    beforeEach(() => {
      // Mock built-in hook
      vi.mocked(getHookTypeInfo).mockReturnValue({
        isBuiltIn: true,
        hookType: "transfer",
        validator: mockTransferValidator,
      });
    });

    it("should succeed for valid transfer hook with empty hookData", async () => {
      mockTransferValidator.validate.mockReturnValue({
        isValid: true,
      });

      const result = await estimator.estimateGas(mockParams);

      expect(result.isValid).toBe(true);
      expect(result.strategyUsed).toBe("code_calculation");
      expect(result.gasLimit).toBe(150000 + 15000); // minGasLimit + payTo overhead
      expect(result.metadata).toEqual({
        rawEstimate: 165000,
        hookType: "transfer",
      });
    });

    it("should succeed for valid transfer hook with empty hookData", async () => {
      mockTransferValidator.validate.mockReturnValue({
        isValid: true,
      });

      const result = await estimator.estimateGas(mockParams);

      expect(result.isValid).toBe(true);
      expect(result.strategyUsed).toBe("code_calculation");
      expect(result.gasLimit).toBe(150000 + 15000); // minGasLimit + payTo overhead
      expect(result.metadata).toEqual({
        rawEstimate: 165000,
        hookType: "transfer",
      });
    });

    it("should fail when validation fails", async () => {
      mockTransferValidator.validate.mockReturnValue({
        isValid: false,
        errorReason: "Invalid parameters",
      });

      const result = await estimator.estimateGas(mockParams);

      expect(result.isValid).toBe(false);
      expect(result.errorReason).toBe("Invalid parameters");
      expect(result.strategyUsed).toBe("code_calculation");
      expect(result.gasLimit).toBe(0);
      expect(result.metadata).toEqual({
        hookType: "transfer",
      });
    });

    it("should apply max gas limit constraint", async () => {
      // Set minGasLimit high enough to trigger max limit
      mockParams.gasCostConfig.minGasLimit = 4000000;

      mockTransferValidator.validate.mockReturnValue({
        isValid: true,
      });

      const result = await estimator.estimateGas(mockParams);

      expect(result.isValid).toBe(true);
      expect(result.gasLimit).toBe(4015000); // Should NOT be constrained since 4015000 < 5000000
      expect(result.metadata?.rawEstimate).toBe(4015000);
    });
  });

  describe("custom hook handling", () => {
    beforeEach(() => {
      // Mock custom hook (not built-in)
      vi.mocked(getHookTypeInfo).mockReturnValue({
        isBuiltIn: false,
        validator: mockCustomValidator,
      });
    });

    it("should throw error for custom hooks", async () => {
      mockCustomValidator.validate.mockReturnValue({
        isValid: true,
      });

      await expect(estimator.estimateGas(mockParams)).rejects.toThrow(
        "CodeBasedGasEstimator does not support hook: 0x1234567890123456789012345678901234567890",
      );
    });
  });

  describe("hook type resolution", () => {
    it("should handle unknown hook types gracefully", async () => {
      // Mock built-in hook but with unknown type
      vi.mocked(getHookTypeInfo).mockReturnValue({
        isBuiltIn: true,
        hookType: "unknown",
        validator: mockTransferValidator,
      });

      mockTransferValidator.validate.mockReturnValue({
        isValid: true,
      });

      const result = await estimator.estimateGas(mockParams);

      expect(result.isValid).toBe(true);
      expect(result.gasLimit).toBe(150000 + 100000); // minGasLimit + conservative default
    });

    it("should handle missing validator for built-in hook", async () => {
      // Mock built-in hook without validator
      vi.mocked(getHookTypeInfo).mockReturnValue({
        isBuiltIn: true,
        hookType: "transfer",
        validator: undefined,
      });

      await expect(estimator.estimateGas(mockParams)).rejects.toThrow(
        "CodeBasedGasEstimator does not support hook: 0x1234567890123456789012345678901234567890",
      );
    });
  });
});
