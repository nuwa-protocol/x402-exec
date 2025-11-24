/**
 * Gas Estimation Factory Unit Tests
 */

import { describe, it, expect, vi } from "vitest";
import { createGasEstimator } from "../../../src/gas-estimation/factory.js";
import { CodeBasedGasEstimator } from "../../../src/gas-estimation/strategies/code-based.js";
import { SimulationBasedGasEstimator } from "../../../src/gas-estimation/strategies/simulation.js";
import { SmartGasEstimator } from "../../../src/gas-estimation/strategies/smart.js";
import type { GasEstimationConfig } from "../../../src/gas-estimation/strategies/base.js";
import type { Logger } from "pino";

describe("createGasEstimator", () => {
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;
  });

  describe("strategy selection", () => {
    it("should create CodeBasedGasEstimator for 'code' strategy", () => {
      const config: GasEstimationConfig = {
        enabled: true,
        strategy: "code",
        codeValidationEnabled: true,
        safetyMultiplier: 1.2,
        timeoutMs: 5000,
      };

      const estimator = createGasEstimator(config, mockLogger);

      expect(estimator).toBeInstanceOf(CodeBasedGasEstimator);
      expect(estimator.strategyName).toBe("code_calculation");
      expect(mockLogger.info).toHaveBeenCalledWith("Using code-based gas estimation strategy (forced)");
    });

    it("should create SimulationBasedGasEstimator for 'simulation' strategy", () => {
      const config: GasEstimationConfig = {
        enabled: true,
        strategy: "simulation",
        codeValidationEnabled: true,
        safetyMultiplier: 1.2,
        timeoutMs: 5000,
      };

      const estimator = createGasEstimator(config, mockLogger);

      expect(estimator).toBeInstanceOf(SimulationBasedGasEstimator);
      expect(estimator.strategyName).toBe("rpc_simulation");
      expect(mockLogger.info).toHaveBeenCalledWith("Using simulation-based gas estimation strategy (forced)");
    });

    it("should create SmartGasEstimator for 'smart' strategy", () => {
      const config: GasEstimationConfig = {
        enabled: true,
        strategy: "smart",
        codeValidationEnabled: true,
        safetyMultiplier: 1.2,
        timeoutMs: 5000,
      };

      const estimator = createGasEstimator(config, mockLogger);

      expect(estimator).toBeInstanceOf(SmartGasEstimator);
      expect(estimator.strategyName).toBe("smart");
      expect(mockLogger.info).toHaveBeenCalledWith(
        { codeValidationEnabled: true },
        "Using smart gas estimation strategy (auto-select)"
      );
    });

    it("should default to 'smart' strategy when not specified", () => {
      const config: GasEstimationConfig = {
        enabled: true,
        // strategy not specified
        codeValidationEnabled: false,
        safetyMultiplier: 1.2,
        timeoutMs: 5000,
      };

      const estimator = createGasEstimator(config, mockLogger);

      expect(estimator).toBeInstanceOf(SmartGasEstimator);
      expect(estimator.strategyName).toBe("smart");
      expect(mockLogger.info).toHaveBeenCalledWith(
        { codeValidationEnabled: false },
        "Using smart gas estimation strategy (auto-select)"
      );
    });
  });

  describe("configuration handling", () => {
    it("should pass codeValidationEnabled to SmartGasEstimator", () => {
      const config: GasEstimationConfig = {
        enabled: true,
        strategy: "smart",
        codeValidationEnabled: false, // Explicitly disabled
        safetyMultiplier: 1.2,
        timeoutMs: 5000,
      };

      const estimator = createGasEstimator(config, mockLogger);

      expect(estimator).toBeInstanceOf(SmartGasEstimator);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { codeValidationEnabled: false },
        "Using smart gas estimation strategy (auto-select)"
      );
    });

    it("should handle all required config properties", () => {
      const config: GasEstimationConfig = {
        enabled: false,
        strategy: "simulation",
        codeValidationEnabled: true,
        safetyMultiplier: 1.5,
        timeoutMs: 10000,
      };

      const estimator = createGasEstimator(config, mockLogger);

      expect(estimator).toBeInstanceOf(SimulationBasedGasEstimator);
      expect(mockLogger.info).toHaveBeenCalledWith("Using simulation-based gas estimation strategy (forced)");
    });
  });

  describe("error handling", () => {
    it("should handle invalid strategy gracefully", () => {
      const config = {
        enabled: true,
        strategy: "invalid" as any, // Invalid strategy
        codeValidationEnabled: true,
        safetyMultiplier: 1.2,
        timeoutMs: 5000,
      };

      // Should default to smart strategy
      const estimator = createGasEstimator(config, mockLogger);

      expect(estimator).toBeInstanceOf(SmartGasEstimator);
      expect(mockLogger.info).toHaveBeenCalledWith(
        { codeValidationEnabled: true },
        "Using smart gas estimation strategy (auto-select)"
      );
    });
  });
});
