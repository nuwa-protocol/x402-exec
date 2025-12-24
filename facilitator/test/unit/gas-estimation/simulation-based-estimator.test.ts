/**
 * SimulationBasedGasEstimator Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SimulationBasedGasEstimator } from "../../../src/gas-estimation/strategies/simulation.ts";
import type { SettlementGasParams } from "../../../src/gas-estimation/strategies/base.js";

// Mock dependencies
vi.mock("../../../src/hook-validators/index.js", () => ({
  getHookTypeInfo: vi.fn(),
}));

vi.mock("../../../src/gas-estimation/utils.js", () => ({
  parseEstimateGasError: vi.fn(),
}));

import { getHookTypeInfo } from "../../../src/hook-validators/index.js";
import { parseEstimateGasError } from "../../../src/gas-estimation/utils.js";

describe("SimulationBasedGasEstimator", () => {
  let estimator: SimulationBasedGasEstimator;
  let mockParams: SettlementGasParams;
  let mockWalletClient: any;

  beforeEach(() => {
    estimator = new SimulationBasedGasEstimator();

    mockWalletClient = {
      estimateGas: vi.fn().mockResolvedValue(200000n), // Default mock
      account: {
        address: "0x9999999999999999999999999999999999999999",
      },
    };

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
        nonce: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      },
      signature:
        "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
      salt: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      payTo: "0x2222222222222222222222222222222222222222",
      facilitatorFee: 10000n,
      hookAmount: 990000n,
      walletClient: mockWalletClient,
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

    // Mock hook type info
    vi.mocked(getHookTypeInfo).mockReturnValue({
      isBuiltIn: false,
      hookType: "custom",
    });
  });

  describe("strategy name", () => {
    it("should have correct strategy name", () => {
      expect(estimator.strategyName).toBe("rpc_simulation");
    });
  });

  describe("successful estimation", () => {
    it("should estimate gas successfully and apply safety multiplier", async () => {
      const estimatedGas = 200000n;
      mockWalletClient.estimateGas.mockResolvedValue(estimatedGas);

      const result = await estimator.estimateGas(mockParams);

      expect(result.isValid).toBe(true);
      expect(result.strategyUsed).toBe("rpc_simulation");
      expect(result.gasLimit).toBe(Math.floor(200000 * 1.2)); // safetyMultiplier = 1.2
      expect(result.metadata).toEqual({
        rawEstimate: 200000,
        safetyMultiplier: 1.2,
        hookType: "custom",
      });

      // Verify estimateGas was called with correct parameters
      expect(mockWalletClient.estimateGas).toHaveBeenCalledWith({
        account: mockWalletClient.account.address,
        to: mockParams.settlementRouter as `0x${string}`,
        data: expect.any(String), // Encoded function data
        value: 0n,
      });
    });

    it("should apply max gas limit constraint", async () => {
      const estimatedGas = 4500000n; // High estimate that, after safety multiplier (1.2), exceeds maxGasLimit (5000000)
      mockWalletClient.estimateGas.mockResolvedValue(estimatedGas);

      const result = await estimator.estimateGas(mockParams);

      expect(result.isValid).toBe(true);
      expect(result.gasLimit).toBe(5000000); // maxGasLimit (4500000 * 1.2 = 5400000, capped at 5000000)
      expect(result.metadata?.rawEstimate).toBe(4500000);
    });

    it("should handle different safety multipliers", async () => {
      const estimatedGas = 100000n;
      mockWalletClient.estimateGas.mockResolvedValue(estimatedGas);

      // Test with different safety multiplier
      mockParams.gasEstimationConfig.safetyMultiplier = 1.5;

      const result = await estimator.estimateGas(mockParams);

      expect(result.gasLimit).toBe(Math.floor(100000 * 1.5)); // 150000
    });
  });

  describe("error handling", () => {
    it("should handle estimateGas failure and parse error", async () => {
      const mockError = new Error("Execution reverted");
      mockWalletClient.estimateGas.mockRejectedValue(mockError);

      vi.mocked(parseEstimateGasError).mockReturnValue("Transaction reverted");

      const result = await estimator.estimateGas(mockParams);

      expect(result.isValid).toBe(false);
      expect(result.errorReason).toBe("Transaction reverted");
      expect(result.strategyUsed).toBe("rpc_simulation");
      expect(result.gasLimit).toBe(0);
      expect(result.metadata?.hookType).toBe("custom");

      expect(parseEstimateGasError).toHaveBeenCalledWith(mockError);
    });

    it("should handle timeout errors", async () => {
      mockWalletClient.estimateGas.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("timeout")), 6000); // Longer than timeoutMs
          }),
      );

      vi.mocked(parseEstimateGasError).mockReturnValue("Gas estimation timeout");

      const result = await estimator.estimateGas(mockParams);

      expect(result.isValid).toBe(false);
      expect(result.errorReason).toBe("Gas estimation timeout");
      expect(result.strategyUsed).toBe("rpc_simulation");
    });

    it("should handle generic errors during error parsing", async () => {
      mockWalletClient.estimateGas.mockRejectedValue("string error");

      vi.mocked(parseEstimateGasError).mockImplementation(() => {
        throw new Error("Parse failed");
      });

      const result = await estimator.estimateGas(mockParams);

      expect(result.isValid).toBe(false);
      expect(result.errorReason).toBe("Gas estimation failed - unable to determine cause");
    });
  });

  describe("transaction encoding", () => {
    it("should encode settleAndExecute function call correctly", async () => {
      mockWalletClient.estimateGas.mockResolvedValue(150000n);

      await estimator.estimateGas(mockParams);

      const estimateGasCall = mockWalletClient.estimateGas.mock.calls[0][0];

      // Verify the encoded data structure (without checking exact bytes)
      expect(estimateGasCall.data).toBeDefined();
      expect(typeof estimateGasCall.data).toBe("string");
      expect(estimateGasCall.data.startsWith("0x")).toBe(true);

      expect(estimateGasCall.account).toBe(mockWalletClient.account.address);
      expect(estimateGasCall.to).toBe(mockParams.settlementRouter);
      expect(estimateGasCall.value).toBe(0n);
    });
  });
});
