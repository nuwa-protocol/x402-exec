/**
 * Unit Tests for Route Validation Helpers
 */

import { describe, it, expect, vi } from "vitest";
import { validateBasicStructure, validateX402Version } from "../../../src/routes/validation.js";

describe("validateBasicStructure", () => {
  it("should accept valid object structures", () => {
    const data = { network: "eip155:84532", asset: "0x1234" };
    expect(() => validateBasicStructure(data, "test")).not.toThrow();
  });

  it("should accept empty objects", () => {
    const data = {};
    expect(() => validateBasicStructure(data, "test")).not.toThrow();
  });

  it("should reject null", () => {
    expect(() => validateBasicStructure(null, "test")).toThrow(
      "test is required and must be an object",
    );
  });

  it("should reject undefined", () => {
    expect(() => validateBasicStructure(undefined, "test")).toThrow(
      "test is required and must be an object",
    );
  });

  it("should reject string values", () => {
    expect(() => validateBasicStructure("string", "test")).toThrow(
      "test is required and must be an object",
    );
  });

  it("should reject number values", () => {
    expect(() => validateBasicStructure(123, "test")).toThrow(
      "test is required and must be an object",
    );
  });

  it("should reject boolean values", () => {
    expect(() => validateBasicStructure(true, "test")).toThrow(
      "test is required and must be an object",
    );
  });

  it("should reject arrays", () => {
    expect(() => validateBasicStructure([], "test")).toThrow(
      "test is required and must be an object",
    );
  });

  it("should return the data when valid", () => {
    const data = { network: "eip155:84532", asset: "0x1234" };
    const result = validateBasicStructure(data, "test");
    expect(result).toBe(data);
  });

  it("should set ValidationError name on thrown error", () => {
    try {
      validateBasicStructure(null, "test");
      vi.fail("Expected error to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe("ValidationError");
    }
  });
});

describe("validateX402Version (v2-only)", () => {
  it("should accept version 2", () => {
    expect(() => validateX402Version(2)).not.toThrow();
  });

  it("should reject undefined (v2 requirement)", () => {
    expect(() => validateX402Version(undefined)).toThrow(
      "x402Version is required. v1 is deprecated - please use x402Version=2",
    );
  });

  it("should reject null", () => {
    expect(() => validateX402Version(null as unknown)).toThrow(
      "x402Version is required. v1 is deprecated - please use x402Version=2",
    );
  });

  it("should reject version 1 (deprecated)", () => {
    expect(() => validateX402Version(1)).toThrow(
      "Version not supported: x402Version 1 is deprecated. Please use x402Version=2.",
    );
  });

  it("should reject version 0", () => {
    expect(() => validateX402Version(0)).toThrow(
      "Version not supported: x402Version 0 is deprecated. Please use x402Version=2.",
    );
  });

  it("should reject version 3", () => {
    expect(() => validateX402Version(3)).toThrow(
      "Version not supported: x402Version 3 is deprecated. Please use x402Version=2.",
    );
  });

  it("should reject version 10", () => {
    expect(() => validateX402Version(10)).toThrow(
      "Version not supported: x402Version 10 is deprecated. Please use x402Version=2.",
    );
  });

  it("should reject negative versions", () => {
    expect(() => validateX402Version(-1)).toThrow(
      "Version not supported: x402Version -1 is deprecated. Please use x402Version=2.",
    );
  });

  it("should reject fractional versions", () => {
    expect(() => validateX402Version(1.5)).toThrow(
      "Version not supported: x402Version 1.5 is deprecated. Please use x402Version=2.",
    );
  });

  it("should set ValidationError name on thrown error", () => {
    try {
      validateX402Version(1);
      vi.fail("Expected error to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe("ValidationError");
    }
  });

  // Type safety tests: ensure non-number types are rejected
  it("should reject string '1'", () => {
    expect(() => validateX402Version("1" as unknown)).toThrow(/expected number, got string/);
  });

  it("should reject string '2'", () => {
    expect(() => validateX402Version("2" as unknown)).toThrow(/expected number, got string/);
  });

  it("should reject random string", () => {
    expect(() => validateX402Version("abc" as unknown)).toThrow(/expected number, got string/);
  });

  it("should reject object", () => {
    expect(() => validateX402Version({} as unknown)).toThrow(/expected number, got object/);
  });

  it("should reject boolean true", () => {
    expect(() => validateX402Version(true as unknown)).toThrow(/expected number, got boolean/);
  });

  it("should reject array", () => {
    expect(() => validateX402Version([1] as unknown)).toThrow(/expected number, got object/);
  });

  it("error messages should include migration guide link", () => {
    try {
      validateX402Version(1);
      vi.fail("Expected error to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("https://github.com/nuwa-protocol/x402-exec");
    }
  });
});
