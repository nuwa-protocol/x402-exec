/**
 * Structured Error Types for Facilitator
 * 
 * This module defines a hierarchy of error types for better error handling
 * and reporting throughout the facilitator.
 * 
 * Based on deps/x402-rs/src/chain/mod.rs (FacilitatorLocalError)
 */

import { getLogger } from "./telemetry.js";

const logger = getLogger();

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  /** Informational - not really an error */
  INFO = "info",
  /** Warning - may impact functionality but not critical */
  WARNING = "warning",
  /** Error - significant problem occurred */
  ERROR = "error",
  /** Critical - service degradation */
  CRITICAL = "critical",
}

/**
 * Base facilitator error class
 */
export abstract class FacilitatorError extends Error {
  /** Error code for programmatic identification */
  public readonly code: string;
  
  /** Whether this error is recoverable (can retry) */
  public readonly recoverable: boolean;
  
  /** Error severity level */
  public readonly severity: ErrorSeverity;
  
  /** Additional error details */
  public readonly details?: Record<string, unknown>;
  
  /** Original error if wrapping another error */
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    recoverable: boolean,
    severity: ErrorSeverity = ErrorSeverity.ERROR,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.recoverable = recoverable;
    this.severity = severity;
    this.details = details;
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for logging/API responses
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      recoverable: this.recoverable,
      severity: this.severity,
      details: this.details,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }

  /**
   * Log this error with appropriate level
   */
  log(): void {
    const logContext = {
      error: this.toJSON(),
    };

    switch (this.severity) {
      case ErrorSeverity.INFO:
        logger.info(logContext, this.message);
        break;
      case ErrorSeverity.WARNING:
        logger.warn(logContext, this.message);
        break;
      case ErrorSeverity.ERROR:
        logger.error(logContext, this.message);
        break;
      case ErrorSeverity.CRITICAL:
        logger.fatal(logContext, this.message);
        break;
    }
  }
}

/**
 * Configuration error - missing or invalid environment variables
 */
export class ConfigurationError extends FacilitatorError {
  constructor(message: string, details?: Record<string, unknown>, cause?: Error) {
    super(
      message,
      "CONFIGURATION_ERROR",
      false, // Not recoverable - requires config fix
      ErrorSeverity.CRITICAL,
      details,
      cause
    );
  }
}

/**
 * Validation error base class
 */
export abstract class ValidationError extends FacilitatorError {
  public readonly payer?: string;

  constructor(
    message: string,
    code: string,
    payer?: string,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      message,
      code,
      false, // Validation errors are not recoverable - invalid input
      ErrorSeverity.WARNING,
      { ...details, payer },
      cause
    );
    this.payer = payer;
  }
}

/**
 * Network mismatch error
 */
export class NetworkMismatchError extends ValidationError {
  constructor(
    expected: string,
    actual: string,
    payer?: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Network mismatch: expected ${expected}, got ${actual}`,
      "NETWORK_MISMATCH",
      payer,
      { ...details, expected, actual }
    );
  }
}

/**
 * Unsupported network error
 */
export class UnsupportedNetworkError extends ValidationError {
  constructor(network: string, payer?: string, details?: Record<string, unknown>) {
    super(
      `Unsupported network: ${network}`,
      "UNSUPPORTED_NETWORK",
      payer,
      { ...details, network }
    );
  }
}

/**
 * Scheme mismatch error
 */
export class SchemeMismatchError extends ValidationError {
  constructor(
    expected: string,
    actual: string,
    payer?: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Scheme mismatch: expected ${expected}, got ${actual}`,
      "SCHEME_MISMATCH",
      payer,
      { ...details, expected, actual }
    );
  }
}

/**
 * Receiver mismatch error
 */
export class ReceiverMismatchError extends ValidationError {
  constructor(
    expected: string,
    actual: string,
    payer?: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Receiver mismatch: expected ${expected}, got ${actual}`,
      "RECEIVER_MISMATCH",
      payer,
      { ...details, expected, actual }
    );
  }
}

/**
 * Invalid signature error
 */
export class InvalidSignatureError extends ValidationError {
  constructor(payer?: string, details?: Record<string, unknown>, cause?: Error) {
    super(
      "Invalid signature",
      "INVALID_SIGNATURE",
      payer,
      details,
      cause
    );
  }
}

/**
 * Invalid timing error (authorization expired or not yet valid)
 */
export class InvalidTimingError extends ValidationError {
  constructor(payer?: string, details?: Record<string, unknown>) {
    super(
      "Authorization timing is invalid (expired or not yet valid)",
      "INVALID_TIMING",
      payer,
      details
    );
  }
}

/**
 * Insufficient value error (amount too low)
 */
export class InsufficientValueError extends ValidationError {
  constructor(
    required: string,
    actual: string,
    payer?: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Insufficient value: required ${required}, got ${actual}`,
      "INSUFFICIENT_VALUE",
      payer,
      { ...details, required, actual }
    );
  }
}

/**
 * Insufficient funds error (payer balance too low)
 */
export class InsufficientFundsError extends ValidationError {
  constructor(
    required: string,
    balance: string,
    payer?: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Insufficient funds: required ${required}, balance ${balance}`,
      "INSUFFICIENT_FUNDS",
      payer,
      { ...details, required, balance }
    );
  }
}

/**
 * Invalid address error
 */
export class InvalidAddressError extends ValidationError {
  constructor(address: string, details?: Record<string, unknown>, cause?: Error) {
    super(
      `Invalid address: ${address}`,
      "INVALID_ADDRESS",
      undefined,
      { ...details, address },
      cause
    );
  }
}

/**
 * Settlement error base class
 */
export abstract class SettlementError extends FacilitatorError {
  constructor(
    message: string,
    code: string,
    recoverable: boolean,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      message,
      code,
      recoverable,
      ErrorSeverity.ERROR,
      details,
      cause
    );
  }
}

/**
 * Transaction failed error
 */
export class TransactionFailedError extends SettlementError {
  public readonly transactionHash?: string;

  constructor(
    message: string,
    transactionHash?: string,
    recoverable = false,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      message,
      "TRANSACTION_FAILED",
      recoverable,
      { ...details, transactionHash },
      cause
    );
    this.transactionHash = transactionHash;
  }
}

/**
 * Transaction timeout error
 */
export class TransactionTimeoutError extends SettlementError {
  public readonly transactionHash?: string;

  constructor(
    message: string,
    transactionHash?: string,
    details?: Record<string, unknown>
  ) {
    super(
      message,
      "TRANSACTION_TIMEOUT",
      true, // Timeout may be temporary - recoverable
      { ...details, transactionHash }
    );
    this.transactionHash = transactionHash;
  }
}

/**
 * RPC error (connection issue, rate limit, etc.)
 */
export class RpcError extends SettlementError {
  public readonly rpcUrl?: string;

  constructor(
    message: string,
    rpcUrl?: string,
    recoverable = true,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      message,
      "RPC_ERROR",
      recoverable,
      { ...details, rpcUrl },
      cause
    );
    this.rpcUrl = rpcUrl;
  }
}

/**
 * Nonce error (nonce too low, already used, etc.)
 */
export class NonceError extends SettlementError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      message,
      "NONCE_ERROR",
      true, // Can retry with new nonce
      details,
      cause
    );
  }
}

/**
 * Gas estimation error
 */
export class GasEstimationError extends SettlementError {
  constructor(message: string, details?: Record<string, unknown>, cause?: Error) {
    super(
      message,
      "GAS_ESTIMATION_ERROR",
      false, // Usually indicates contract call will fail
      details,
      cause
    );
  }
}

/**
 * Contract call error
 */
export class ContractCallError extends SettlementError {
  public readonly contractAddress?: string;
  public readonly functionName?: string;

  constructor(
    message: string,
    contractAddress?: string,
    functionName?: string,
    recoverable = false,
    details?: Record<string, unknown>,
    cause?: Error
  ) {
    super(
      message,
      "CONTRACT_CALL_ERROR",
      recoverable,
      { ...details, contractAddress, functionName },
      cause
    );
    this.contractAddress = contractAddress;
    this.functionName = functionName;
  }
}

/**
 * Decode error (unable to decode transaction data)
 */
export class DecodingError extends FacilitatorError {
  constructor(message: string, details?: Record<string, unknown>, cause?: Error) {
    super(
      message,
      "DECODING_ERROR",
      false,
      ErrorSeverity.ERROR,
      details,
      cause
    );
  }
}

/**
 * Helper function to classify unknown errors
 */
export function classifyError(error: unknown): FacilitatorError {
  if (error instanceof FacilitatorError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Classify by message content
    if (message.includes("timeout")) {
      return new TransactionTimeoutError(error.message, undefined, { originalError: error.message });
    }

    if (message.includes("nonce") || message.includes("already known")) {
      return new NonceError(error.message, { originalError: error.message }, error);
    }

    if (message.includes("insufficient funds") || message.includes("insufficient balance")) {
      return new InsufficientFundsError("unknown", "unknown", undefined, { originalError: error.message });
    }

    if (message.includes("gas")) {
      return new GasEstimationError(error.message, { originalError: error.message }, error);
    }

    if (message.includes("network") || message.includes("connection")) {
      return new RpcError(error.message, undefined, true, { originalError: error.message }, error);
    }

    // Generic transaction error
    return new TransactionFailedError(error.message, undefined, false, { originalError: error.message }, error);
  }

  // Unknown error type
  return new TransactionFailedError(
    String(error),
    undefined,
    false,
    { originalError: String(error) }
  );
}

/**
 * Helper to determine if error should trigger retry
 */
export function shouldRetry(error: unknown): boolean {
  if (error instanceof FacilitatorError) {
    return error.recoverable;
  }
  
  // Unknown errors - don't retry
  return false;
}

