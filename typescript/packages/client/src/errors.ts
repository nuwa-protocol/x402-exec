/**
 * Error classes for x402x client SDK
 */

/**
 * Base error class for all x402x client errors
 */
export class X402ClientError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "X402ClientError";
    Object.setPrototypeOf(this, X402ClientError.prototype);
  }
}

/**
 * Network-related errors (unsupported network, configuration issues)
 */
export class NetworkError extends X402ClientError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "NetworkError";
    Object.setPrototypeOf(this, NetworkError.prototype);
  }
}

/**
 * Wallet signing errors
 */
export class SigningError extends X402ClientError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "SigningError";
    Object.setPrototypeOf(this, SigningError.prototype);
  }
}

/**
 * Facilitator communication errors
 */
export class FacilitatorError extends X402ClientError {
  constructor(
    message: string,
    code?: string,
    public readonly statusCode?: number,
    public readonly response?: unknown,
  ) {
    super(message, code);
    this.name = "FacilitatorError";
    Object.setPrototypeOf(this, FacilitatorError.prototype);
  }
}

/**
 * Transaction execution errors
 */
export class TransactionError extends X402ClientError {
  constructor(
    message: string,
    code?: string,
    public readonly txHash?: string,
  ) {
    super(message, code);
    this.name = "TransactionError";
    Object.setPrototypeOf(this, TransactionError.prototype);
  }
}

/**
 * Parameter validation errors
 */
export class ValidationError extends X402ClientError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}
