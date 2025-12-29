/**
 * Tests for commitment calculation utilities
 */

import { describe, it, expect } from "vitest";

import { calculateCommitment, generateSalt, validateCommitmentParams } from "./commitment";
import type { CommitmentParams } from "./types";

// Test fixtures
const mockAddresses = {
  hub: "0x1234567890123456789012345678901234567890",
  asset: "0x2234567890123456789012345678901234567890",
  from: "0x3234567890123456789012345678901234567890",
  payTo: "0x4234567890123456789012345678901234567890",
  hook: "0x5234567890123456789012345678901234567890",
};

const mockCommitmentParams: CommitmentParams = {
  chainId: 84532,
  ...mockAddresses,
  value: "100000",
  validAfter: "0",
  validBefore: "1234567890",
  salt: "0x" + "0".repeat(64),
  facilitatorFee: "10000",
  hookData: "0x",
};

const invalidAddresses = {
  tooShort: "0x1234",
  noPrefix: "1234567890123456789012345678901234567890",
  invalidChars: "0xZZZZ567890123456789012345678901234567890",
  wrongLength: "0x12345678901234567890123456789012345678",
};

describe("calculateCommitment", () => {
  it("should calculate a valid commitment hash", () => {
    const commitment = calculateCommitment(mockCommitmentParams);

    // Should return a bytes32 hash (66 chars: 0x + 64 hex chars)
    expect(commitment).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it("should produce consistent hashes for identical inputs", () => {
    const commitment1 = calculateCommitment(mockCommitmentParams);
    const commitment2 = calculateCommitment(mockCommitmentParams);

    expect(commitment1).toBe(commitment2);
  });

  it("should produce different hashes for different inputs", () => {
    const commitment1 = calculateCommitment(mockCommitmentParams);

    const modifiedParams = {
      ...mockCommitmentParams,
      value: "200000", // Changed value
    };
    const commitment2 = calculateCommitment(modifiedParams);

    expect(commitment1).not.toBe(commitment2);
  });

  it("should produce different hashes when salt changes", () => {
    const params1 = mockCommitmentParams;
    const params2 = {
      ...mockCommitmentParams,
      salt: "0x" + "1".repeat(64),
    };

    const commitment1 = calculateCommitment(params1);
    const commitment2 = calculateCommitment(params2);

    expect(commitment1).not.toBe(commitment2);
  });

  it("should produce different hashes when facilitatorFee changes", () => {
    const params1 = mockCommitmentParams;
    const params2 = {
      ...mockCommitmentParams,
      facilitatorFee: "20000",
    };

    const commitment1 = calculateCommitment(params1);
    const commitment2 = calculateCommitment(params2);

    expect(commitment1).not.toBe(commitment2);
  });

  it("should produce different hashes when hookData changes", () => {
    const params1 = { ...mockCommitmentParams, hookData: "0x" };
    const params2 = { ...mockCommitmentParams, hookData: "0x1234" };

    const commitment1 = calculateCommitment(params1);
    const commitment2 = calculateCommitment(params2);

    expect(commitment1).not.toBe(commitment2);
  });

  it("should handle large values", () => {
    const params = {
      ...mockCommitmentParams,
      value: "999999999999999999",
    };

    const commitment = calculateCommitment(params);
    expect(commitment).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it("should handle different chainIds", () => {
    const params1 = { ...mockCommitmentParams, chainId: 84532 };
    const params2 = { ...mockCommitmentParams, chainId: 1952 };

    const commitment1 = calculateCommitment(params1);
    const commitment2 = calculateCommitment(params2);

    expect(commitment1).not.toBe(commitment2);
  });
});

describe("generateSalt", () => {
  it("should generate a valid bytes32 hex string", () => {
    const salt = generateSalt();

    // Should be 66 chars: 0x + 64 hex chars
    expect(salt).toMatch(/^0x[0-9a-fA-F]{64}$/);
    expect(salt.length).toBe(66);
  });

  it("should generate unique salts on each call", () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    const salt3 = generateSalt();

    expect(salt1).not.toBe(salt2);
    expect(salt2).not.toBe(salt3);
    expect(salt1).not.toBe(salt3);
  });

  it("should generate cryptographically random salts (statistical test)", () => {
    const salts = new Set();
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
      salts.add(generateSalt());
    }

    // All salts should be unique
    expect(salts.size).toBe(iterations);
  });

  it("should work in Node.js environment", () => {
    // This test verifies the function works without throwing
    expect(() => generateSalt()).not.toThrow();
  });

  it("should generate different salts even in rapid succession", () => {
    const salts = [generateSalt(), generateSalt(), generateSalt(), generateSalt(), generateSalt()];

    const uniqueSalts = new Set(salts);
    expect(uniqueSalts.size).toBe(salts.length);
  });
});

describe("validateCommitmentParams", () => {
  it("should validate correct parameters without throwing", () => {
    expect(() => {
      validateCommitmentParams(mockCommitmentParams);
    }).not.toThrow();
  });

  describe("address validation", () => {
    it("should reject invalid hub address", () => {
      const params = {
        ...mockCommitmentParams,
        hub: invalidAddresses.tooShort,
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid hub address");
    });

    it("should reject hub address without 0x prefix", () => {
      const params = {
        ...mockCommitmentParams,
        hub: invalidAddresses.noPrefix,
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid hub address");
    });

    it("should reject invalid asset address", () => {
      const params = {
        ...mockCommitmentParams,
        asset: invalidAddresses.tooShort,
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid asset address");
    });

    it("should reject invalid from address", () => {
      const params = {
        ...mockCommitmentParams,
        from: invalidAddresses.invalidChars,
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid from address");
    });

    it("should reject invalid payTo address", () => {
      const params = {
        ...mockCommitmentParams,
        payTo: invalidAddresses.wrongLength,
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid payTo address");
    });

    it("should reject invalid hook address", () => {
      const params = {
        ...mockCommitmentParams,
        hook: "0x",
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid hook address");
    });
  });

  describe("numeric validation", () => {
    it("should reject invalid value", () => {
      const params = {
        ...mockCommitmentParams,
        value: "not-a-number",
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid numeric parameter");
    });

    it("should reject invalid validAfter", () => {
      const params = {
        ...mockCommitmentParams,
        validAfter: "invalid",
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid numeric parameter");
    });

    it("should reject invalid validBefore", () => {
      const params = {
        ...mockCommitmentParams,
        validBefore: "NaN",
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid numeric parameter");
    });

    it("should reject invalid facilitatorFee", () => {
      const params = {
        ...mockCommitmentParams,
        facilitatorFee: "not-valid",
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid numeric parameter");
    });

    it("should accept zero values", () => {
      const params = {
        ...mockCommitmentParams,
        value: "0",
        validAfter: "0",
        facilitatorFee: "0",
      };

      expect(() => validateCommitmentParams(params)).not.toThrow();
    });

    it("should accept large numeric values", () => {
      const params = {
        ...mockCommitmentParams,
        value: "999999999999999999999",
      };

      expect(() => validateCommitmentParams(params)).not.toThrow();
    });
  });

  describe("salt validation", () => {
    it("should reject salt that is too short", () => {
      const params = {
        ...mockCommitmentParams,
        salt: "0x1234",
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid salt");
    });

    it("should reject salt that is too long", () => {
      const params = {
        ...mockCommitmentParams,
        salt: "0x" + "0".repeat(70),
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid salt");
    });

    it("should reject salt without 0x prefix", () => {
      const params = {
        ...mockCommitmentParams,
        salt: "0".repeat(64),
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid salt");
    });

    it("should reject salt with invalid characters", () => {
      const params = {
        ...mockCommitmentParams,
        salt: "0xZZ" + "0".repeat(62),
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid salt");
    });

    it("should accept valid salt", () => {
      const params = {
        ...mockCommitmentParams,
        salt: "0x" + "0".repeat(64),
      };

      expect(() => validateCommitmentParams(params)).not.toThrow();
    });
  });

  describe("hookData validation", () => {
    it("should reject hookData without 0x prefix", () => {
      const params = {
        ...mockCommitmentParams,
        hookData: "1234",
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid hookData");
    });

    it("should reject hookData with invalid characters", () => {
      const params = {
        ...mockCommitmentParams,
        hookData: "0xGGGG",
      };

      expect(() => validateCommitmentParams(params)).toThrow("Invalid hookData");
    });

    it("should accept empty hookData", () => {
      const params = {
        ...mockCommitmentParams,
        hookData: "0x",
      };

      expect(() => validateCommitmentParams(params)).not.toThrow();
    });

    it("should accept valid hookData", () => {
      const params = {
        ...mockCommitmentParams,
        hookData: "0x1234567890abcdef",
      };

      expect(() => validateCommitmentParams(params)).not.toThrow();
    });
  });
});
