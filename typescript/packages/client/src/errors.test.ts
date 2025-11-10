import { describe, it, expect } from "vitest";
import {
  X402ClientError,
  NetworkError,
  SigningError,
  FacilitatorError,
  TransactionError,
  ValidationError,
} from "./errors.js";

describe("errors", () => {
  describe("X402ClientError", () => {
    it("should create base error", () => {
      const error = new X402ClientError("test message", "TEST_CODE");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(X402ClientError);
      expect(error.message).toBe("test message");
      expect(error.code).toBe("TEST_CODE");
      expect(error.name).toBe("X402ClientError");
    });
  });

  describe("NetworkError", () => {
    it("should create network error", () => {
      const error = new NetworkError("network error", "NET_ERR");
      expect(error).toBeInstanceOf(X402ClientError);
      expect(error).toBeInstanceOf(NetworkError);
      expect(error.message).toBe("network error");
      expect(error.name).toBe("NetworkError");
    });
  });

  describe("SigningError", () => {
    it("should create signing error", () => {
      const error = new SigningError("signing error", "SIGN_ERR");
      expect(error).toBeInstanceOf(X402ClientError);
      expect(error).toBeInstanceOf(SigningError);
      expect(error.name).toBe("SigningError");
    });
  });

  describe("FacilitatorError", () => {
    it("should create facilitator error with status code", () => {
      const error = new FacilitatorError("facilitator error", "FAC_ERR", 400, { detail: "test" });
      expect(error).toBeInstanceOf(X402ClientError);
      expect(error).toBeInstanceOf(FacilitatorError);
      expect(error.name).toBe("FacilitatorError");
      expect(error.statusCode).toBe(400);
      expect(error.response).toEqual({ detail: "test" });
    });
  });

  describe("TransactionError", () => {
    it("should create transaction error with tx hash", () => {
      const error = new TransactionError("tx error", "TX_ERR", "0x123");
      expect(error).toBeInstanceOf(X402ClientError);
      expect(error).toBeInstanceOf(TransactionError);
      expect(error.name).toBe("TransactionError");
      expect(error.txHash).toBe("0x123");
    });
  });

  describe("ValidationError", () => {
    it("should create validation error", () => {
      const error = new ValidationError("validation error", "VAL_ERR");
      expect(error).toBeInstanceOf(X402ClientError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.name).toBe("ValidationError");
    });
  });
});
