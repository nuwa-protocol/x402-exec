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
    expect(() => validateBasicStructure(null, "test")).toThrow("test is required and must be an object");
  });

  it("should reject undefined", () => {
    expect(() => validateBasicStructure(undefined, "test")).toThrow("test is required and must be an object");
  });

  it("should reject string values", () => {
    expect(() => validateBasicStructure("string", "test")).toThrow("test is required and must be an object");
  });

  it("should reject number values", () => {
    expect(() => validateBasicStructure(123, "test")).toThrow("test is required and must be an object");
  });

  it("should reject boolean values", () => {
    expect(() => validateBasicStructure(true, "test")).toThrow("test is required and must be an object");
  });

  it("should reject arrays", () => {
    expect(() => validateBasicStructure([], "test")).toThrow("test is required and must be an object");
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

describe("validateX402Version", () => {
  it("should accept version 1", () => {
    expect(() => validateX402Version(1)).not.toThrow();
  });

  it("should accept version 2", () => {
    expect(() => validateX402Version(2)).not.toThrow();
  });

  it("should accept undefined (defaults to 1 elsewhere)", () => {
    expect(() => validateX402Version(undefined)).not.toThrow();
  });

  it("should reject version 0", () => {
    expect(() => validateX402Version(0)).toThrow("Invalid x402Version: 0. Only versions 1 and 2 are supported.");
  });

  it("should reject version 3", () => {
    expect(() => validateX402Version(3)).toThrow("Invalid x402Version: 3. Only versions 1 and 2 are supported.");
  });

  it("should reject version 10", () => {
    expect(() => validateX402Version(10)).toThrow("Invalid x402Version: 10. Only versions 1 and 2 are supported.");
  });

  it("should reject negative versions", () => {
    expect(() => validateX402Version(-1)).toThrow("Invalid x402Version: -1. Only versions 1 and 2 are supported.");
  });

  it("should reject fractional versions", () => {
    expect(() => validateX402Version(1.5)).toThrow("Invalid x402Version: 1.5. Only versions 1 and 2 are supported.");
  });

  it("should set ValidationError name on thrown error", () => {
    try {
      validateX402Version(0);
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

  it("should reject null", () => {
    expect(() => validateX402Version(null as unknown)).toThrow(/expected number, got object/);
  });

  it("should reject boolean true", () => {
    expect(() => validateX402Version(true as unknown)).toThrow(/expected number, got boolean/);
  });

  it("should reject array", () => {
    expect(() => validateX402Version([1] as unknown)).toThrow(/expected number, got object/);
  });
});
