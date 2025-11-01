/**
 * SettlementRouter integration types for x402-exec facilitator
 */

/**
 * Settlement extra parameters passed in PaymentRequirements.extra
 * These parameters enable SettlementRouter integration with Hook execution
 */
export interface SettlementExtra {
  /** SettlementRouter contract address */
  settlementRouter: string;

  /** Unique identifier (32 bytes hex) for idempotency */
  salt: string;

  /** Final recipient address (for transparency and UI display) */
  payTo: string;

  /** Facilitator fee amount in token's smallest unit (e.g., 10000 = 0.01 USDC) */
  facilitatorFee: string;

  /** Hook contract address (address(0) means no Hook) */
  hook: string;

  /** Encoded hook parameters (hex string) */
  hookData: string;
}

/**
 * Configuration for SettlementRouter addresses across networks
 */
export interface SettlementConfig {
  routerAddresses: {
    [network: string]: string;
  };
}

/**
 * Error thrown when settlement extra parameters are invalid or missing
 */
export class SettlementExtraError extends Error {
  /**
   * Create a SettlementExtraError
   *
   * @param message - Error message
   */
  constructor(message: string) {
    super(message);
    this.name = "SettlementExtraError";
  }
}
