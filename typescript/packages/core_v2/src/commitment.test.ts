/**
 * Tests for commitment calculation utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checksumAddress } from "viem";
import {
  calculateCommitment,
  generateSalt,
  validateCommitmentParams,
} from "./commitment";
import type { CommitmentParams } from "./types";

describe("commitment", () => {
  // Mock data for testing
  const validCommitmentParams: CommitmentParams = {
    chainId: 84532,
    hub: checksumAddress("0x1234567890123456789012345678901234567890"),
    asset: checksumAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
    from: checksumAddress("0x1111111111111111111111111111111111111111"),
    value: "1000000",
    validAfter: "0",
    validBefore: "1234567890",
    salt: "0x" + "a".repeat(64),
    payTo: checksumAddress("0x2222222222222222222222222222222222222222"),
    facilitatorFee: "10000",
    hook: checksumAddress("0x3333333333333333333333333333333333333333"),
    hookData: "0x",
  };

  describe("calculateCommitment", () => {
    it("should calculate commitment hash with valid parameters", () => {
      const commitment = calculateCommitment(validCommitmentParams);

      expect(commitment).toMatch(/^0x[0-9a-f]{64}$/);
      expect(commitment).toHaveLength(66);
    });

    it("should produce consistent results for same parameters", () => {
      const commitment1 = calculateCommitment(validCommitmentParams);
      const commitment2 = calculateCommitment(validCommitmentParams);

      expect(commitment1).toBe(commitment2);
    });

    it("should handle different hookData values correctly", () => {
      const params1 = { ...validCommitmentParams, hookData: "0x1234" };
      const params2 = { ...validCommitmentParams, hookData: "0x5678" };

      const commitment1 = calculateCommitment(params1);
      const commitment2 = calculateCommitment(params2);

      expect(commitment1).not.toBe(commitment2);
    });

    it("should handle different numeric values correctly", () => {
      const params1 = { ...validCommitmentParams, value: "1000000" };
      const params2 = { ...validCommitmentParams, value: "2000000" };

      const commitment1 = calculateCommitment(params1);
      const commitment2 = calculateCommitment(params2);

      expect(commitment1).not.toBe(commitment2);
    });

    it("should handle zero values correctly", () => {
      const zeroValueParams = {
        ...validCommitmentParams,
        value: "0",
        facilitatorFee: "0",
        validAfter: "0",
      };

      const commitment = calculateCommitment(zeroValueParams);
      expect(commitment).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("should handle maximum numeric values", () => {
      const maxValueParams = {
        ...validCommitmentParams,
        value: "115792089237316195423570985008687907853269984665640564039457584007913129639935", // uint256 max
        facilitatorFee: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
        validBefore: "18446744073709551615", // uint64 max
      };

      const commitment = calculateCommitment(maxValueParams);
      expect(commitment).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("should handle mixed case addresses", () => {
      const mixedCaseParams = {
        ...validCommitmentParams,
        hub: checksumAddress("0xAbCdEf1234567890123456789012345678901234"),
        from: checksumAddress("0xabcdefABCDEF1234567890123456789012345678"),
      };

      const commitment = calculateCommitment(mixedCaseParams);
      expect(commitment).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });

  describe("generateSalt", () => {
    it("should generate a 32-byte hex string", () => {
      const salt = generateSalt();

      expect(salt).toMatch(/^0x[0-9a-f]{64}$/);
      expect(salt).toHaveLength(66);
    });

    it("should generate unique salts each time", () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      expect(salt1).not.toBe(salt2);
    });

    it("should generate valid salt with proper format", () => {
      // Test multiple generations
      for (let i = 0; i < 5; i++) {
        const salt = generateSalt();
        expect(salt).toMatch(/^0x[0-9a-f]{64}$/);
        expect(salt).toHaveLength(66);
      }
    });
  });

  describe("validateCommitmentParams", () => {
    it("should pass validation for valid parameters", () => {
      expect(() => {
        validateCommitmentParams(validCommitmentParams);
      }).not.toThrow();
    });

    it("should throw error for invalid hub address", () => {
      const invalidParams = {
        ...validCommitmentParams,
        hub: "invalid_address",
      };

      expect(() => {
        validateCommitmentParams(invalidParams);
      }).toThrow("Invalid hub address");
    });

    it("should throw error for invalid asset address", () => {
      const invalidParams = {
        ...validCommitmentParams,
        asset: "0xinvalid",
      };

      expect(() => {
        validateCommitmentParams(invalidParams);
      }).toThrow("Invalid asset address");
    });

    it("should throw error for invalid from address", () => {
      const invalidParams = {
        ...validCommitmentParams,
        from: "1234567890123456789012345678901234567890", // missing 0x
      };

      expect(() => {
        validateCommitmentParams(invalidParams);
      }).toThrow("Invalid from address");
    });

    it("should throw error for invalid payTo address", () => {
      const invalidParams = {
        ...validCommitmentParams,
        payTo: "0x123", // too short
      };

      expect(() => {
        validateCommitmentParams(invalidParams);
      }).toThrow("Invalid payTo address");
    });

    it("should throw error for invalid hook address", () => {
      const invalidParams = {
        ...validCommitmentParams,
        hook: "0xgggggggggggggggggggggggggggggggggggggggg", // invalid hex
      };

      expect(() => {
        validateCommitmentParams(invalidParams);
      }).toThrow("Invalid hook address");
    });

    it("should throw error for invalid numeric value", () => {
      const invalidParams = {
        ...validCommitmentParams,
        value: "not_a_number",
      };

      expect(() => {
        validateCommitmentParams(invalidParams);
      }).toThrow("Invalid numeric parameter");
    });

    it("should throw error for invalid validAfter", () => {
      const invalidParams = {
        ...validCommitmentParams,
        validAfter: "123abc",
      };

      expect(() => {
        validateCommitmentParams(invalidParams);
      }).toThrow("Invalid numeric parameter");
    });

    it("should throw error for invalid validBefore", () => {
      const invalidParams = {
        ...validCommitmentParams,
        validBefore: "not_a_number",
      };

      expect(() => {
        validateCommitmentParams(invalidParams);
      }).toThrow("Invalid numeric parameter");
    });

    it("should throw error for invalid facilitatorFee", () => {
      const invalidParams = {
        ...validCommitmentParams,
        facilitatorFee: "1.5", // decimal not allowed in BigInt
      };

      expect(() => {
        validateCommitmentParams(invalidParams);
      }).toThrow("Invalid numeric parameter");
    });

    it("should throw error for invalid salt length", () => {
      const invalidParams = {
        ...validCommitmentParams,
        salt: "0x1234", // too short
      };

      expect(() => {
        validateCommitmentParams(invalidParams);
      }).toThrow("Invalid salt: must be bytes32 (0x + 64 hex chars)");
    });

    it("should throw error for invalid salt format", () => {
      const invalidParams = {
        ...validCommitmentParams,
        salt: "1234" + "a".repeat(64), // missing 0x
      };

      expect(() => {
        validateCommitmentParams(invalidParams);
      }).toThrow("Invalid salt: must be bytes32 (0x + 64 hex chars)");
    });

    it("should throw error for invalid hookData format", () => {
      const invalidParams = {
        ...validCommitmentParams,
        hookData: "not_hex",
      };

      expect(() => {
        validateCommitmentParams(invalidParams);
      }).toThrow("Invalid hookData: must be hex string");
    });

    it("should accept empty hookData", () => {
      const validParams = {
        ...validCommitmentParams,
        hookData: "0x",
      };

      expect(() => {
        validateCommitmentParams(validParams);
      }).not.toThrow();
    });

    it("should accept valid hex hookData", () => {
      const validParams = {
        ...validCommitmentParams,
        hookData: "0x1234567890abcdef",
      };

      expect(() => {
        validateCommitmentParams(validParams);
      }).not.toThrow();
    });

    it("should accept zero address for hook (no hook case)", () => {
      const validParams = {
        ...validCommitmentParams,
        hook: "0x0000000000000000000000000000000000000000",
      };

      expect(() => {
        validateCommitmentParams(validParams);
      }).not.toThrow();
    });

    it("should validate mixed case addresses correctly", () => {
      const mixedCaseParams = {
        ...validCommitmentParams,
        hub: checksumAddress("0xAbCdEf1234567890123456789012345678901234"),
        asset: checksumAddress("0xabcdefABCDEF1234567890123456789012345678"),
        from: checksumAddress("0x1111111111111111111111111111111111111111"),
        payTo: checksumAddress("0x2222222222222222222222222222222222222222"),
        hook: checksumAddress("0x3333333333333333333333333333333333333333"),
      };

      expect(() => {
        validateCommitmentParams(mixedCaseParams);
      }).not.toThrow();
    });

    it("should handle very large numeric values", () => {
      const largeNumberParams = {
        ...validCommitmentParams,
        value: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
        facilitatorFee: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      };

      expect(() => {
        validateCommitmentParams(largeNumberParams);
      }).not.toThrow();
    });
  });

  describe("integration tests", () => {
    it("should generate salt and use it in commitment calculation", () => {
      const salt = generateSalt();
      const params = { ...validCommitmentParams, salt };

      expect(() => {
        validateCommitmentParams(params);
      }).not.toThrow();

      const commitment = calculateCommitment(params);
      expect(commitment).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it("should produce different commitments for different salts", () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      const params1 = { ...validCommitmentParams, salt: salt1 };
      const params2 = { ...validCommitmentParams, salt: salt2 };

      const commitment1 = calculateCommitment(params1);
      const commitment2 = calculateCommitment(params2);

      expect(commitment1).not.toBe(commitment2);
    });

    it("should handle complete workflow with validation and calculation", () => {
      const customSalt = generateSalt();
      const params: CommitmentParams = {
        chainId: 1,
        hub: checksumAddress("0x1234567890123456789012345678901234567890"),
        asset: checksumAddress("0xA0b86a33E6441e2a5C3e23e3C7D1D3e3D9a1C8b9"),
        from: checksumAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
        value: "500000000", // 500 USDC (6 decimals)
        validAfter: Math.floor(Date.now() / 1000).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
        salt: customSalt,
        payTo: checksumAddress("0x5555555555555555555555555555555555555555"),
        facilitatorFee: "5000000", // 5 USDC fee
        hook: checksumAddress("0x6666666666666666666666666666666666666666"),
        hookData: "0x1234567890abcdef",
      };

      expect(() => {
        validateCommitmentParams(params);
      }).not.toThrow();

      const commitment = calculateCommitment(params);
      expect(commitment).toMatch(/^0x[0-9a-f]{64}$/);
    });
  });
});