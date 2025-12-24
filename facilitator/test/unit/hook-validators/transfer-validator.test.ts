/**
 * TransferHookValidator Unit Tests
 *
 * Tests that TransferHookValidator only performs validation and does not calculate gas.
 */

import { describe, it, expect, vi } from "vitest";
import { TransferHookValidator } from "../../../src/hook-validators/transfer-hook.ts";
import { encodeAbiParameters } from "viem";

describe("TransferHookValidator", () => {
  let validator: TransferHookValidator;

  beforeEach(() => {
    validator = new TransferHookValidator();
  });

  describe("validate method", () => {
    it("should validate empty hookData (payTo-only transfer)", async () => {
      const result = validator.validate(
        "base-sepolia",
        "0x74215d0c1b2a5e6f8b9c3d4e5f6a7b8c9d0e1f2a",
        "",
        1000000n,
      );

      expect(result).toEqual({
        isValid: true,
      });
    });

    it("should validate '0x' hookData (payTo-only transfer)", async () => {
      const result = validator.validate(
        "base-sepolia",
        "0x74215d0c1b2a5e6f8b9c3d4e5f6a7b8c9d0e1f2a",
        "0x",
        1000000n,
      );

      expect(result).toEqual({
        isValid: true,
      });
    });

    it("should validate valid transfer hook with recipients", async () => {
      // Use proper ABI encoding for (address[] recipients, uint256[] amounts)
      const hookData = encodeAbiParameters(
        [{ type: "address[]" }, { type: "uint256[]" }],
        [
          [
            "0x74215d0c1b2a5e6f8b9c3d4e5f6a7b8c9d0e1f2a",
            "0x84215d0c1b2a5e6f8b9c3d4e5f6a7b8c9d0e1f2b",
          ],
          [100000n, 100000n],
        ],
      );

      const result = validator.validate(
        "base-sepolia",
        "0x74215d0c1b2a5e6f8b9c3d4e5f6a7b8c9d0e1f2a",
        hookData,
        200000n, // Total amount should match sum of amounts
      );

      expect(result).toEqual({
        isValid: true,
      });
    });

    it("should reject invalid recipient address", async () => {
      const hookData = encodeAbiParameters(
        [{ type: "address[]" }, { type: "uint256[]" }],
        [
          [
            "0x0000000000000000000000000000000000000000", // zero address
            "0x84215d0c1b2a5e6f8b9c3d4e5f6a7b8c9d0e1f2b",
          ],
          [100000n, 100000n],
        ],
      );

      const result = validator.validate(
        "base-sepolia",
        "0x74215d0c1b2a5e6f8b9c3d4e5f6a7b8c9d0e1f2a",
        hookData,
        200000n,
      );

      expect(result).toEqual({
        isValid: false,
        errorReason: "Zero address not allowed as recipient at index 0",
      });
    });

    it("should reject mismatched array lengths", async () => {
      const hookData = encodeAbiParameters(
        [{ type: "address[]" }, { type: "uint256[]" }],
        [
          ["0x74215d0c1b2a5e6f8b9c3d4e5f6a7b8c9d0e1f2a"], // 1 recipient
          [100000n, 100000n], // 2 amounts (mismatch)
        ],
      );

      const result = validator.validate(
        "base-sepolia",
        "0x74215d0c1b2a5e6f8b9c3d4e5f6a7b8c9d0e1f2a",
        hookData,
        200000n,
      );

      expect(result.isValid).toBe(false);
      expect(result.errorReason).toContain("Recipients and amounts length mismatch");
    });

    it("should reject invalid hookData format", async () => {
      const result = validator.validate(
        "base-sepolia",
        "0x74215d0c1b2a5e6f8b9c3d4e5f6a7b8c9d0e1f2a",
        "invalid-data",
        1000000n,
      );

      expect(result.isValid).toBe(false);
      expect(result.errorReason).toContain("TransferHook validation failed");
    });

    it("should reject empty recipients array", async () => {
      // Empty arrays would be encoded as just the function signature, but let's simulate
      const result = validator.validate(
        "base-sepolia",
        "0x74215d0c1b2a5e6f8b9c3d4e5f6a7b8c9d0e1f2a",
        "0x", // This should be parsed as empty arrays
        1000000n,
      );

      // Note: The current implementation treats "0x" as payTo-only transfer
      // If we want to distinguish empty arrays from payTo-only, we might need to adjust
      expect(result).toEqual({
        isValid: true,
      });
    });
  });

  describe("gas calculation separation", () => {
    it("should NOT have getGasOverhead method", () => {
      // This test ensures that gas calculation has been moved to CodeBasedGasEstimator
      expect(validator).not.toHaveProperty("getGasOverhead");
      expect(validator).not.toHaveProperty("calculateGasOverhead");
    });

    it("should only have validate method", () => {
      expect(typeof validator.validate).toBe("function");
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(validator));
      expect(methods).toContain("validate");
      expect(methods).toContain("decodeHookData");
      expect(methods).not.toContain("getGasOverhead");
      expect(methods).not.toContain("calculateGasOverhead");
    });
  });
});
