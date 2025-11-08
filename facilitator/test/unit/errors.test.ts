/**
 * Tests for errors.ts
 *
 * Tests error classes, classification, and retry logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FacilitatorError,
  ConfigurationError,
  ValidationError,
  NetworkMismatchError,
  UnsupportedNetworkError,
  SchemeMismatchError,
  ReceiverMismatchError,
  InvalidSignatureError,
  InvalidTimingError,
  InsufficientValueError,
  InsufficientFundsError,
  InvalidAddressError,
  SettlementError,
  TransactionFailedError,
  TransactionTimeoutError,
  RpcError,
  NonceError,
  GasEstimationError,
  ContractCallError,
  DecodingError,
  ErrorSeverity,
  classifyError,
  shouldRetry,
} from "../../src/errors.js";

describe("errors", () => {
  describe("ConfigurationError", () => {
    it("should create configuration error with correct properties", () => {
      const error = new ConfigurationError("Missing API key", { key: "API_KEY" });

      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error).toBeInstanceOf(FacilitatorError);
      expect(error.message).toBe("Missing API key");
      expect(error.code).toBe("CONFIGURATION_ERROR");
      expect(error.recoverable).toBe(false);
      expect(error.severity).toBe(ErrorSeverity.CRITICAL);
      expect(error.details).toEqual({ key: "API_KEY" });
    });

    it("should serialize to JSON", () => {
      const error = new ConfigurationError("Test error");
      const json = error.toJSON();

      expect(json.name).toBe("ConfigurationError");
      expect(json.message).toBe("Test error");
      expect(json.code).toBe("CONFIGURATION_ERROR");
      expect(json.recoverable).toBe(false);
    });
  });

  describe("ValidationError", () => {
    it("should create network mismatch error", () => {
      const error = new NetworkMismatchError("base-sepolia", "base", "0xpayer");

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toContain("expected base-sepolia, got base");
      expect(error.code).toBe("NETWORK_MISMATCH");
      expect(error.recoverable).toBe(false);
      expect(error.severity).toBe(ErrorSeverity.WARNING);
      expect(error.payer).toBe("0xpayer");
    });

    it("should create unsupported network error", () => {
      const error = new UnsupportedNetworkError("unknown-network");

      expect(error.code).toBe("UNSUPPORTED_NETWORK");
      expect(error.message).toContain("unknown-network");
    });

    it("should create scheme mismatch error", () => {
      const error = new SchemeMismatchError("exact", "range");

      expect(error.code).toBe("SCHEME_MISMATCH");
      expect(error.message).toContain("expected exact, got range");
    });

    it("should create receiver mismatch error", () => {
      const error = new ReceiverMismatchError("0xaaa", "0xbbb");

      expect(error.code).toBe("RECEIVER_MISMATCH");
      expect(error.message).toContain("expected 0xaaa, got 0xbbb");
    });

    it("should create invalid signature error", () => {
      const error = new InvalidSignatureError("0xpayer");

      expect(error.code).toBe("INVALID_SIGNATURE");
      expect(error.payer).toBe("0xpayer");
    });

    it("should create invalid timing error", () => {
      const error = new InvalidTimingError("0xpayer");

      expect(error.code).toBe("INVALID_TIMING");
      expect(error.message).toContain("expired or not yet valid");
    });

    it("should create insufficient value error", () => {
      const error = new InsufficientValueError("1000", "500");

      expect(error.code).toBe("INSUFFICIENT_VALUE");
      expect(error.message).toContain("required 1000, got 500");
    });

    it("should create insufficient funds error", () => {
      const error = new InsufficientFundsError("1000", "500");

      expect(error.code).toBe("INSUFFICIENT_FUNDS");
      expect(error.message).toContain("required 1000, balance 500");
    });

    it("should create invalid address error", () => {
      const error = new InvalidAddressError("0xinvalid");

      expect(error.code).toBe("INVALID_ADDRESS");
      expect(error.message).toContain("0xinvalid");
    });
  });

  describe("SettlementError", () => {
    it("should create transaction failed error", () => {
      const error = new TransactionFailedError("Transaction reverted", "0xtxhash");

      expect(error).toBeInstanceOf(SettlementError);
      expect(error.code).toBe("TRANSACTION_FAILED");
      expect(error.transactionHash).toBe("0xtxhash");
      expect(error.recoverable).toBe(false);
    });

    it("should create recoverable transaction failed error", () => {
      const error = new TransactionFailedError("Transaction reverted", "0xtxhash", true);

      expect(error.recoverable).toBe(true);
    });

    it("should create transaction timeout error", () => {
      const error = new TransactionTimeoutError("Timeout waiting for confirmation", "0xtxhash");

      expect(error.code).toBe("TRANSACTION_TIMEOUT");
      expect(error.transactionHash).toBe("0xtxhash");
      expect(error.recoverable).toBe(true);
    });

    it("should create RPC error", () => {
      const error = new RpcError("Connection refused", "https://rpc.example.com");

      expect(error.code).toBe("RPC_ERROR");
      expect(error.rpcUrl).toBe("https://rpc.example.com");
      expect(error.recoverable).toBe(true);
    });

    it("should create non-recoverable RPC error", () => {
      const error = new RpcError("Invalid request", "https://rpc.example.com", false);

      expect(error.recoverable).toBe(false);
    });

    it("should create nonce error", () => {
      const error = new NonceError("Nonce too low");

      expect(error.code).toBe("NONCE_ERROR");
      expect(error.recoverable).toBe(true);
    });

    it("should create gas estimation error", () => {
      const error = new GasEstimationError("Execution reverted");

      expect(error.code).toBe("GAS_ESTIMATION_ERROR");
      expect(error.recoverable).toBe(false);
    });

    it("should create contract call error", () => {
      const error = new ContractCallError("Method reverted", "0xcontract", "transfer", false);

      expect(error.code).toBe("CONTRACT_CALL_ERROR");
      expect(error.contractAddress).toBe("0xcontract");
      expect(error.functionName).toBe("transfer");
      expect(error.recoverable).toBe(false);
    });

    it("should create decoding error", () => {
      const error = new DecodingError("Failed to decode transaction data");

      expect(error.code).toBe("DECODING_ERROR");
      expect(error.recoverable).toBe(false);
    });
  });

  describe("classifyError", () => {
    it("should pass through FacilitatorError", () => {
      const original = new ConfigurationError("Test");
      const classified = classifyError(original);

      expect(classified).toBe(original);
    });

    it("should classify timeout errors", () => {
      const error = new Error("Operation timeout exceeded");
      const classified = classifyError(error);

      expect(classified).toBeInstanceOf(TransactionTimeoutError);
      expect(classified.recoverable).toBe(true);
    });

    it("should classify nonce errors", () => {
      const error = new Error("nonce too low");
      const classified = classifyError(error);

      expect(classified).toBeInstanceOf(NonceError);
      expect(classified.recoverable).toBe(true);
    });

    it("should classify already known errors as nonce errors", () => {
      const error = new Error("already known");
      const classified = classifyError(error);

      expect(classified).toBeInstanceOf(NonceError);
    });

    it("should classify insufficient funds errors", () => {
      const error = new Error("insufficient funds");
      const classified = classifyError(error);

      expect(classified).toBeInstanceOf(InsufficientFundsError);
      expect(classified.recoverable).toBe(false);
    });

    it("should classify gas errors", () => {
      const error = new Error("gas estimation failed");
      const classified = classifyError(error);

      expect(classified).toBeInstanceOf(GasEstimationError);
      expect(classified.recoverable).toBe(false);
    });

    it("should classify network errors", () => {
      const error = new Error("network connection failed");
      const classified = classifyError(error);

      expect(classified).toBeInstanceOf(RpcError);
      expect(classified.recoverable).toBe(true);
    });

    it("should classify unknown errors as TransactionFailedError", () => {
      const error = new Error("unknown error");
      const classified = classifyError(error);

      expect(classified).toBeInstanceOf(TransactionFailedError);
      expect(classified.recoverable).toBe(false);
    });

    it("should handle non-Error objects", () => {
      const classified = classifyError("string error");

      expect(classified).toBeInstanceOf(TransactionFailedError);
      expect(classified.message).toBe("string error");
    });
  });

  describe("shouldRetry", () => {
    it("should return true for recoverable errors", () => {
      const error = new TransactionTimeoutError("Timeout");

      expect(shouldRetry(error)).toBe(true);
    });

    it("should return false for non-recoverable errors", () => {
      const error = new ConfigurationError("Missing key");

      expect(shouldRetry(error)).toBe(false);
    });

    it("should return false for unknown errors", () => {
      const error = new Error("Unknown");

      expect(shouldRetry(error)).toBe(false);
    });

    it("should return false for non-Error objects", () => {
      expect(shouldRetry("string error")).toBe(false);
      expect(shouldRetry(null)).toBe(false);
      expect(shouldRetry(undefined)).toBe(false);
    });
  });

  describe("error logging", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should log errors with appropriate severity", () => {
      // Note: In test environment, logger is mocked to noop
      // This test just ensures the log method doesn't throw
      const error = new ConfigurationError("Test");
      expect(() => error.log()).not.toThrow();
    });
  });
});
