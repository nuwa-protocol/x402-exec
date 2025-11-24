/**
 * SmartGasEstimator Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SmartGasEstimator } from "../../../src/gas-estimation/strategies/smart.js";
import { CodeBasedGasEstimator } from "../../../src/gas-estimation/strategies/code-based.js";
import { SimulationBasedGasEstimator } from "../../../src/gas-estimation/strategies/simulation.js";
import type { SettlementGasParams, GasEstimationConfig } from "../../../src/gas-estimation/strategies/base.js";
import type { Logger } from "pino";

// Mock hook type info
vi.mock("../../../src/hook-validators/index.js", () => ({
  getHookTypeInfo: vi.fn(),
}));

import { getHookTypeInfo } from "../../../src/hook-validators/index.js";

describe("SmartGasEstimator", () => {
  let mockCodeEstimator: CodeBasedGasEstimator;
  let mockSimulationEstimator: SimulationBasedGasEstimator;
  let mockLogger: Logger;
  let estimator: SmartGasEstimator;
  let mockParams: SettlementGasParams;
  let mockConfig: GasEstimationConfig;

  beforeEach(() => {
    mockCodeEstimator = {
      estimateGas: vi.fn(),
      strategyName: 'code_calculation',
    } as any;

    mockSimulationEstimator = {
      estimateGas: vi.fn(),
      strategyName: 'rpc_simulation',
    } as any;

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    estimator = new SmartGasEstimator(
      mockCodeEstimator,
      mockSimulationEstimator,
      mockConfig,
      mockLogger,
    );

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
      signature: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
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
    estimator = new SmartGasEstimator(
      mockCodeEstimator,
      mockSimulationEstimator,
      mockConfig,
      mockLogger,
    );
  });

  describe("strategy name", () => {
    it("should have correct strategy name", () => {
      expect(estimator.strategyName).toBe("smart");
    });
  });

  describe("built-in hook handling", () => {
    beforeEach(() => {
      // Mock built-in hook
      vi.mocked(getHookTypeInfo).mockReturnValue({
        isBuiltIn: true,
        hookType: "transfer",
        validator: { validate: vi.fn() },
      });
    });

    it("should use code-based estimation for built-in hooks when enabled", async () => {
      const codeResult = {
        isValid: true,
        gasLimit: 200000,
        strategyUsed: "code_calculation" as const,
        metadata: { hookType: "transfer" },
      };

      vi.spyOn(mockCodeEstimator, "estimateGas").mockResolvedValue(codeResult);
      vi.spyOn(mockSimulationEstimator, "estimateGas").mockResolvedValue({
        isValid: true,
        gasLimit: 250000,
        strategyUsed: "rpc_simulation" as const,
      });

      const result = await estimator.estimateGas(mockParams);

      expect(mockCodeEstimator.estimateGas).toHaveBeenCalledWith(mockParams);
      expect(mockSimulationEstimator.estimateGas).not.toHaveBeenCalled();
      expect(result).toEqual(codeResult);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        { network: mockParams.network, hook: mockParams.hook, hookType: "transfer" },
        "Using code-based gas estimation (fast path)"
      );
    });

    it("should fallback to simulation when code-based estimation fails", async () => {
      const simulationResult = {
        isValid: true,
        gasLimit: 250000,
        strategyUsed: "rpc_simulation" as const,
      };

      vi.spyOn(mockCodeEstimator, "estimateGas").mockRejectedValue(new Error("Code estimation failed"));
      vi.spyOn(mockSimulationEstimator, "estimateGas").mockResolvedValue(simulationResult);

      const result = await estimator.estimateGas(mockParams);

      expect(mockCodeEstimator.estimateGas).toHaveBeenCalledWith(mockParams);
      expect(mockSimulationEstimator.estimateGas).toHaveBeenCalledWith(mockParams);
      expect(result).toEqual(simulationResult);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { error: expect.any(Error), network: mockParams.network, hook: mockParams.hook },
        "Code-based estimation failed, falling back to simulation"
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        {
          network: mockParams.network,
          hook: mockParams.hook,
          hookType: "transfer",
          isBuiltIn: true,
          reason: "code_validation_disabled",
        },
        "Using simulation-based gas estimation"
      );
    });
  });

  describe("custom hook handling", () => {
    beforeEach(() => {
      // Mock custom hook
      vi.mocked(getHookTypeInfo).mockReturnValue({
        isBuiltIn: false,
        hookType: "custom",
      });
    });

    it("should use simulation for custom hooks", async () => {
      const simulationResult = {
        isValid: true,
        gasLimit: 300000,
        strategyUsed: "rpc_simulation" as const,
      };

      vi.spyOn(mockCodeEstimator, "estimateGas").mockResolvedValue({
        isValid: true,
        gasLimit: 200000,
        strategyUsed: "code_calculation" as const,
      });
      vi.spyOn(mockSimulationEstimator, "estimateGas").mockResolvedValue(simulationResult);

      const result = await estimator.estimateGas(mockParams);

      expect(mockCodeEstimator.estimateGas).not.toHaveBeenCalled();
      expect(mockSimulationEstimator.estimateGas).toHaveBeenCalledWith(mockParams);
      expect(result).toEqual(simulationResult);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        {
          network: mockParams.network,
          hook: mockParams.hook,
          hookType: "custom",
          isBuiltIn: false,
          reason: "custom_hook",
        },
        "Using simulation-based gas estimation"
      );
    });
  });

  describe("code validation disabled", () => {
    beforeEach(() => {
      // Disable code validation
      mockConfig.codeValidationEnabled = false;
      estimator = new SmartGasEstimator(
        mockCodeEstimator,
        mockSimulationEstimator,
        mockConfig,
        mockLogger,
      );

      // Mock built-in hook
      vi.mocked(getHookTypeInfo).mockReturnValue({
        isBuiltIn: true,
        hookType: "transfer",
        validator: { validate: vi.fn() },
      });
    });

    it("should skip code validation when disabled", async () => {
      const simulationResult = {
        isValid: true,
        gasLimit: 300000,
        strategyUsed: "rpc_simulation" as const,
      };

      vi.spyOn(mockSimulationEstimator, "estimateGas").mockResolvedValue(simulationResult);

      const result = await estimator.estimateGas(mockParams);

      expect(mockCodeEstimator.estimateGas).not.toHaveBeenCalled();
      expect(mockSimulationEstimator.estimateGas).toHaveBeenCalledWith(mockParams);
      expect(result).toEqual(simulationResult);
    });
  });

  describe("error propagation", () => {
    beforeEach(() => {
      // Mock custom hook
      vi.mocked(getHookTypeInfo).mockReturnValue({
        isBuiltIn: false,
        hookType: "custom",
      });
    });

    it("should propagate errors from simulation estimator", async () => {
      const error = new Error("RPC timeout");
      vi.spyOn(mockSimulationEstimator, "estimateGas").mockRejectedValue(error);

      await expect(estimator.estimateGas(mockParams)).rejects.toThrow("RPC timeout");
    });
  });
});
