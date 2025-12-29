/**
 * Tests for validation helpers
 */

import { describe, it, expect } from "vitest";

import { SettlementExtraError } from "./types";
import {
  validateSettlementExtra,
  assertValidSettlementExtra,
  isValidAddress,
  isValidHex,
  isValid32ByteHex,
  isValidNumericString,
} from "./validation";

describe("isValidAddress", () => {
  it("should accept valid Ethereum addresses", () => {
    expect(isValidAddress("0x1234567890123456789012345678901234567890")).toBe(true);
    expect(isValidAddress("0xAbCdEf1234567890123456789012345678901234")).toBe(true);
  });

  it("should reject invalid addresses", () => {
    expect(isValidAddress("1234567890123456789012345678901234567890")).toBe(false); // no 0x
    expect(isValidAddress("0x123")).toBe(false); // too short
    expect(isValidAddress("0x12345678901234567890123456789012345678901")).toBe(false); // too long
    expect(isValidAddress("0x123456789012345678901234567890123456789g")).toBe(false); // invalid hex
    expect(isValidAddress("")).toBe(false);
  });
});

describe("isValidHex", () => {
  it("should accept valid hex strings", () => {
    expect(isValidHex("0x")).toBe(true);
    expect(isValidHex("0x1234")).toBe(true);
    expect(isValidHex("0xabcdef")).toBe(true);
    expect(isValidHex("0xABCDEF")).toBe(true);
  });

  it("should reject invalid hex strings", () => {
    expect(isValidHex("1234")).toBe(false); // no 0x
    expect(isValidHex("0x123")).toBe(false); // odd length
    expect(isValidHex("0x123g")).toBe(false); // invalid hex character
    expect(isValidHex("")).toBe(false);
  });
});

describe("isValid32ByteHex", () => {
  it("should accept valid 32-byte hex strings", () => {
    const valid32Bytes = "0x" + "a".repeat(64);
    expect(isValid32ByteHex(valid32Bytes)).toBe(true);
  });

  it("should reject invalid 32-byte hex strings", () => {
    expect(isValid32ByteHex("0x" + "a".repeat(63))).toBe(false); // too short
    expect(isValid32ByteHex("0x" + "a".repeat(65))).toBe(false); // too long
    expect(isValid32ByteHex("0x" + "g".repeat(64))).toBe(false); // invalid hex
    expect(isValid32ByteHex("0x")).toBe(false);
  });
});

describe("isValidNumericString", () => {
  it("should accept valid numeric strings", () => {
    expect(isValidNumericString("0")).toBe(true);
    expect(isValidNumericString("123")).toBe(true);
    expect(isValidNumericString("1000000")).toBe(true);
  });

  it("should reject invalid numeric strings", () => {
    expect(isValidNumericString("-1")).toBe(false); // negative
    expect(isValidNumericString("1.5")).toBe(false); // decimal
    expect(isValidNumericString("abc")).toBe(false); // not numeric
    expect(isValidNumericString("")).toBe(false);
    expect(isValidNumericString("0x123")).toBe(false); // hex notation
  });
});

describe("validateSettlementExtra", () => {
  const validExtra = {
    settlementRouter: "0x1234567890123456789012345678901234567890",
    payTo: "0xAbCdEf1234567890123456789012345678901234",
    facilitatorFee: "10000",
    hook: "0x9876543210987654321098765432109876543210",
    hookData: "0x1234abcd",
    name: "USDC",
    version: "2",
    salt: "0x" + "a".repeat(64),
  };

  it("should validate correct settlement extra", () => {
    const result = validateSettlementExtra(validExtra);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should accept empty hookData", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      hookData: "0x",
    });
    expect(result.valid).toBe(true);
  });

  it("should accept zero facilitatorFee", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      facilitatorFee: "0",
    });
    expect(result.valid).toBe(true);
  });

  it("should reject missing settlementRouter", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      settlementRouter: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("settlementRouter is required");
  });

  it("should reject invalid settlementRouter", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      settlementRouter: "invalid",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("settlementRouter must be a valid Ethereum address");
  });

  it("should reject missing payTo", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      payTo: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("payTo is required");
  });

  it("should reject invalid payTo", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      payTo: "0xinvalid",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("payTo must be a valid Ethereum address");
  });

  it("should reject missing facilitatorFee", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      facilitatorFee: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("facilitatorFee is required");
  });

  it("should reject invalid facilitatorFee", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      facilitatorFee: "-100",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("facilitatorFee must be a non-negative numeric string");
  });

  it("should reject missing hook", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      hook: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("hook is required");
  });

  it("should reject invalid hook", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      hook: "not-an-address",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("hook must be a valid Ethereum address");
  });

  it("should reject missing hookData", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      hookData: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("hookData is required");
  });

  it("should reject invalid hookData", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      hookData: "not-hex",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("hookData must be a valid hex string");
  });

  it("should reject missing name", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      name: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("name is required");
  });

  it("should reject empty name", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      name: "  ",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("name must be a non-empty string");
  });

  it("should reject missing version", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      version: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("version is required");
  });

  it("should reject empty version", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      version: "",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("version is required");
  });

  it("should reject missing salt", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      salt: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("salt is required");
  });

  it("should reject invalid salt", () => {
    const result = validateSettlementExtra({
      ...validExtra,
      salt: "0x1234", // not 32 bytes
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("salt must be a 32-byte hex string");
  });
});

describe("assertValidSettlementExtra", () => {
  const validExtra = {
    settlementRouter: "0x1234567890123456789012345678901234567890",
    payTo: "0xAbCdEf1234567890123456789012345678901234",
    facilitatorFee: "10000",
    hook: "0x9876543210987654321098765432109876543210",
    hookData: "0x1234abcd",
    name: "USDC",
    version: "2",
    salt: "0x" + "a".repeat(64),
  };

  it("should not throw for valid settlement extra", () => {
    expect(() => assertValidSettlementExtra(validExtra)).not.toThrow();
  });

  it("should throw SettlementExtraError for invalid settlement extra", () => {
    expect(() =>
      assertValidSettlementExtra({
        ...validExtra,
        settlementRouter: undefined,
      }),
    ).toThrow(SettlementExtraError);
  });

  it("should throw with correct error message", () => {
    try {
      assertValidSettlementExtra({
        ...validExtra,
        payTo: "invalid",
      });
      expect.fail("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SettlementExtraError);
      expect((error as Error).message).toContain("payTo must be a valid Ethereum address");
    }
  });
});
