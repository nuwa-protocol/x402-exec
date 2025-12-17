/**
 * RouterSettlementFacilitator implementation
 *
 * Implements SchemeNetworkFacilitator interface using SettlementRouter for atomic settlement
 */

import type { PaymentPayload, PaymentRequirements, SchemeNetworkFacilitator } from "@x402/core/types";
import type {
  VerifyResponse,
  SettleResponse,
  FacilitatorConfig,
  Address,
  Network,
  SettlementRouterError,
} from "./types.js";
import { FacilitatorValidationError } from "./types.js";
import { isSettlementMode, parseSettlementExtra, getNetworkConfig } from "@x402x/core_v2";
import { settleWithSettlementRouter } from "./settlement.js";
import {
  validateFacilitatorConfig,
  validateNetwork,
  validateSettlementExtra,
  validateSettlementRouter,
  validateFeeAmount,
} from "./validation.js";

/**
 * SchemeNetworkFacilitator implementation using SettlementRouter
 *
 * Provides atomic settlement with hooks and facilitator fee handling
 */
export class RouterSettlementFacilitator implements SchemeNetworkFacilitator {
  readonly scheme = "exact";
  readonly caipFamily = "eip155:*";

  private readonly config: FacilitatorConfig;

  constructor(config: FacilitatorConfig) {
    // Validate configuration
    validateFacilitatorConfig(config);

    this.config = {
      // Default values
      gasConfig: {
        maxGasLimit: 5_000_000n,
        gasMultiplier: 1.2,
      },
      feeConfig: {
        minFee: "0x0",
        maxFee: "0xFFFFFFFFFFFFFFFF",
      },
      timeouts: {
        verify: 5000, // 5 seconds
        settle: 30000, // 30 seconds
      },
      // Override with user config
      ...config,
    };
  }

  /**
   * Get scheme-specific extra data for responses
   */
  getExtra(network: string): Record<string, unknown> | undefined {
    try {
      // Validate network format first
      if (!network || typeof network !== "string" || network.trim() === "") {
        return undefined;
      }

      const networkConfig = getNetworkConfig(network);
      if (!networkConfig) {
        return undefined;
      }

      return {
        scheme: this.scheme,
        caipFamily: this.caipFamily,
        settlementRouter: networkConfig?.settlementRouter,
        defaultAsset: networkConfig?.defaultAsset,
        supportedNetworks: [network], // Can be expanded for multi-network support
      };
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get signer addresses for the network
   */
  getSigners(network: string): string[] {
    validateNetwork(network);
    return [this.config.signer];
  }

  /**
   * Verify payment payload without executing settlement
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    try {
      // Basic validations
      this.validateBasicPayload(payload, requirements);

      // Check if SettlementRouter mode
      const isRouterSettlement = isSettlementMode(requirements);

      if (isRouterSettlement) {
        return await this.verifySettlementRouter(payload, requirements);
      } else {
        return await this.verifyStandard(payload, requirements);
      }
    } catch (error) {
      if (error instanceof FacilitatorValidationError || error instanceof SettlementRouterError) {
        return {
          isValid: false,
          invalidReason: error.message,
          payer: payload.payer,
        };
      }

      // Handle unexpected errors
      return {
        isValid: false,
        invalidReason: `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        payer: payload.payer,
      };
    }
  }

  /**
   * Settle payment by executing blockchain transaction
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    try {
      // Pre-verify payment
      const verification = await this.verify(payload, requirements);
      if (!verification.isValid) {
        return {
          success: false,
          transaction: "",
          network: requirements.network,
          payer: payload.payer,
          errorReason: verification.invalidReason || "Payment verification failed",
        };
      }

      // Check if SettlementRouter mode
      const isRouterSettlement = isSettlementMode(requirements);

      if (isRouterSettlement) {
        return await this.settleWithRouter(payload, requirements);
      } else {
        return await this.settleStandard(payload, requirements);
      }
    } catch (error) {
      return {
        success: false,
        transaction: "",
        network: requirements.network,
        payer: payload.payer,
        errorReason: error instanceof Error ? error.message : "Unknown settlement error",
      };
    }
  }

  /**
   * Validate basic payload and requirements
   */
  private validateBasicPayload(payload: PaymentPayload, requirements: PaymentRequirements): void {
    // Validate network
    validateNetwork(requirements.network);

    // Validate scheme match
    if (payload.scheme !== this.scheme) {
      throw new FacilitatorValidationError(
        `Scheme mismatch: expected ${this.scheme}, got ${payload.scheme}`
      );
    }

    // Validate CAIP family
    if (!requirements.network.startsWith("eip155:")) {
      throw new FacilitatorValidationError(
        `Unsupported network family: ${requirements.network}. Only EVM networks (eip155:*) are supported`
      );
    }

    // Validate required fields
    if (!payload.payer) {
      throw new FacilitatorValidationError("Missing payer in payment payload");
    }

    if (!payload.nonce) {
      throw new FacilitatorValidationError("Missing nonce in payment payload");
    }

    if (!payload.signature) {
      throw new FacilitatorValidationError("Missing signature in payment payload");
    }

    if (!requirements.asset) {
      throw new FacilitatorValidationError("Missing asset in payment requirements");
    }

    if (!requirements.payTo) {
      throw new FacilitatorValidationError("Missing payTo address in payment requirements");
    }

    if (!requirements.maxAmountRequired) {
      throw new FacilitatorValidationError("Missing maxAmountRequired in payment requirements");
    }
  }

  /**
   * Verify payment for SettlementRouter mode
   */
  private async verifySettlementRouter(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    // Parse and validate settlement extra
    const settlementExtra = validateSettlementExtra(requirements.extra);

    // Validate SettlementRouter address
    const networkConfig = getNetworkConfig(requirements.network);
    validateSettlementRouter(
      requirements.network,
      settlementExtra.settlementRouter,
      this.config.allowedRouters,
      networkConfig
    );

    // Validate facilitator fee against configuration
    validateFeeAmount(
      settlementExtra.facilitatorFee,
      this.config.feeConfig?.minFee,
      this.config.feeConfig?.maxFee
    );

    // TODO: Add signature verification using @x402/evm
    // TODO: Add commitment verification (nonce must equal calculated commitment)
    // TODO: Add balance checks using viem public client

    return {
      isValid: true,
      payer: payload.payer,
    };
  }

  /**
   * Verify payment for standard mode (fallback)
   */
  private async verifyStandard(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    // TODO: Implement standard EIP-3009 verification
    // This would be used for compatibility with non-SettlementRouter flows

    return {
      isValid: true,
      payer: payload.payer,
    };
  }

  /**
   * Settle payment using SettlementRouter
   */
  private async settleWithRouter(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    return await settleWithSettlementRouter(requirements, payload, this.config, {
      gasMultiplier: this.config.gasConfig?.gasMultiplier,
      timeoutMs: this.config.timeouts?.settle,
    });
  }

  /**
   * Settle payment using standard method (fallback)
   */
  private async settleStandard(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    // TODO: Implement standard EIP-3009 settlement
    // This would be used for compatibility with non-SettlementRouter flows

    return {
      success: false,
      transaction: "",
      network: requirements.network,
      payer: payload.payer,
      errorReason: "Standard settlement mode not yet implemented",
    };
  }
}

/**
 * Factory function to create RouterSettlementFacilitator instance
 */
export function createRouterSettlementFacilitator(config: FacilitatorConfig): RouterSettlementFacilitator {
  return new RouterSettlementFacilitator(config);
}