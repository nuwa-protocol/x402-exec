/**
 * Version Dispatcher for x402 Facilitator
 *
 * v1 is deprecated - only x402Version=2 is supported.
 * All requests are routed to v2 implementation.
 */

/// <reference path="./types.d.ts" />

import type { PaymentPayload, PaymentRequirements, X402Config } from "x402/types";
import type { PaymentRequirements as V2PaymentRequirements } from "@x402x/extensions";
import type { VerifyResponse, SettleResponse } from "x402/types";
import { getLogger, recordMetric, recordHistogram } from "./telemetry.js";
import type { PoolManager } from "./pool-manager.js";
import type { BalanceChecker } from "./balance-check.js";
import { determineX402Version, isVersionSupported, getCanonicalNetwork } from "./network-utils.js";

const logger = getLogger();

/**
 * Configuration for version dispatcher
 */
export interface VersionDispatcherConfig {
  /** Enable v2 support (requires FACILITATOR_ENABLE_V2=true) */
  enableV2?: boolean;
  /** Allowed routers per network for v2 */
  allowedRouters?: Record<string, string[]>;
  /** RPC URLs per network for both v1 and v2 */
  rpcUrls?: Record<string, string>;
}

/**
 * Dependencies for version dispatcher
 */
export interface VersionDispatcherDependencies {
  poolManager: PoolManager;
  x402Config?: X402Config;
  balanceChecker?: BalanceChecker;
  allowedSettlementRouters?: Record<string, string[]>;
}

/**
 * Verification request data
 */
export interface VerifyRequest {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
  x402Version?: number;
}

/**
 * Settlement request data
 */
export interface SettleRequest {
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
  x402Version?: number;
}

/**
 * Version dispatcher that routes to appropriate implementation
 */
export class VersionDispatcher {
  constructor(
    private deps: VersionDispatcherDependencies,
    private config: VersionDispatcherConfig = {},
  ) {
    if (this.config.enableV2) {
      logger.info(
        {
          hasAllowedRouters: !!this.config.allowedRouters,
          hasRpcUrls: !!this.config.rpcUrls,
        },
        "Version dispatcher: v2 support enabled (using shared AccountPool)",
      );
    } else {
      logger.info("Version dispatcher: v1 only mode");
    }
  }

  /**
   * Verify payment using v2 implementation
   *
   * v1 is deprecated - only v2 is supported.
   */
  async verify(request: VerifyRequest): Promise<VerifyResponse> {
    const startTime = Date.now();
    const { paymentPayload, paymentRequirements } = request;

    try {
      // Determine version (must be 2)
      const version = determineX402Version(paymentPayload, request);

      // Check if version is supported (v2 must be enabled)
      if (!isVersionSupported(version)) {
        const error = "V2 support is not enabled. Set FACILITATOR_ENABLE_V2=true to enable.";

        logger.warn({ version, error }, "Version not supported");
        recordMetric("facilitator.verify.version_not_supported", 1, { version: String(version) });

        return {
          isValid: false,
          invalidReason: error as any, // Type assertion to handle v2 error format
        };
      }

      // Canonicalize network for internal use
      const canonicalNetwork = getCanonicalNetwork(paymentRequirements.network);

      // V2 implementation - always uses router settlement
      const mode = "v2_router";
      const result = await this.verifyV2(paymentPayload, paymentRequirements as any);

      // Record metrics
      const duration = Date.now() - startTime;
      recordMetric("facilitator.verify.total", 1, {
        network: canonicalNetwork,
        version: String(version),
        mode,
        is_valid: String(result.isValid),
      });
      recordHistogram("facilitator.verify.duration_ms", duration, {
        network: canonicalNetwork,
        version: String(version),
        mode,
      });

      logger.info(
        {
          version,
          mode,
          network: canonicalNetwork,
          isValid: result.isValid,
          payer: result.payer,
          duration_ms: duration,
        },
        "Verification completed",
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ error, duration_ms: duration }, "Verification failed");
      recordMetric("facilitator.verify.errors", 1, {
        error_type: error instanceof Error ? error.name : "unknown",
      });

      return {
        isValid: false,
        invalidReason:
          "Verification failed due to internal error" as VerifyResponse["invalidReason"],
      };
    }
  }

  /**
   * Settle payment using v2 implementation
   *
   * v1 is deprecated - only v2 is supported.
   */
  async settle(request: SettleRequest): Promise<SettleResponse> {
    const startTime = Date.now();
    const { paymentPayload, paymentRequirements } = request;

    try {
      // Determine version (must be 2)
      const version = determineX402Version(paymentPayload, request);

      // Check if version is supported (v2 must be enabled)
      if (!isVersionSupported(version)) {
        const error = "V2 support is not enabled. Set FACILITATOR_ENABLE_V2=true to enable.";

        logger.warn({ version, error }, "Version not supported");
        recordMetric("facilitator.settle.version_not_supported", 1, { version: String(version) });

        throw new Error(error);
      }

      // Canonicalize network for internal use
      const canonicalNetwork = getCanonicalNetwork(paymentRequirements.network);

      // V2 implementation - always uses router settlement
      const mode = "v2_router";
      // paymentRequirements is validated earlier, but its static type includes v1 shapes.
      // Cast via unknown to avoid structural mismatch errors.
      const result = await this.settleV2(
        paymentPayload,
        paymentRequirements as unknown as V2PaymentRequirements,
      );

      // Record metrics
      const duration = Date.now() - startTime;
      recordMetric("facilitator.settle.total", 1, {
        network: canonicalNetwork,
        version: String(version),
        mode,
        success: String(result.success),
      });
      recordHistogram("facilitator.settle.duration_ms", duration, {
        network: canonicalNetwork,
        version: String(version),
        mode,
      });

      logger.info(
        {
          version,
          mode,
          network: canonicalNetwork,
          success: result.success,
          transaction: result.transaction,
          payer: result.payer,
          duration_ms: duration,
        },
        "Settlement completed",
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ error, duration_ms: duration }, "Settlement failed");
      recordMetric("facilitator.settle.errors", 1, {
        error_type: error instanceof Error ? error.name : "unknown",
      });

      // Re-throw to let the route handler format the error response
      throw error;
    }
  }


  /**
   * V2 verification implementation
   * Uses direct validation without creating a separate facilitator instance
   */
  private async verifyV2(
    paymentPayload: PaymentPayload,
    paymentRequirements: V2PaymentRequirements,
  ): Promise<VerifyResponse> {
    // Import v2 verification utilities
    const { createRouterSettlementFacilitator } = await import("@x402x/facilitator-sdk");

    // Create a temporary facilitator for verification (no signer needed for verify)
    // Note: Verification only checks signatures and balances on-chain, it doesn't send transactions.
    // The zero address is used as a placeholder since no actual signing occurs during verification.
    // This is safe because the facilitator's verify() method doesn't use the signer for any operations.
    const facilitator = createRouterSettlementFacilitator({
      allowedRouters: this.config.allowedRouters,
      rpcUrls: this.config.rpcUrls,
      signer: "0x0000000000000000000000000000000000000000", // Placeholder - not used for verification
    });

    // Verify using v2 implementation
    const result = await facilitator.verify(paymentPayload, paymentRequirements);

    // Convert v2 response to v1 format for API consistency
    return {
      isValid: result.isValid,
      invalidReason: result.invalidReason as any,
      payer: result.payer,
    };
  }


  /**
   * V2 settlement implementation
   * Uses AccountPool for queue management and duplicate payer detection
   */
  private async settleV2(
    paymentPayload: PaymentPayload,
    paymentRequirements: V2PaymentRequirements,
  ): Promise<SettleResponse> {
    // Get account pool for the network (same as v1)
    const accountPool = this.deps.poolManager.getPool(paymentRequirements.network);
    if (!accountPool) {
      throw new Error(`No account pool available for network: ${paymentRequirements.network}`);
    }

    // Extract payer address for duplicate detection
    // V2 paymentPayload has payer field (unlike v1 which has nested structure)
    const payerAddress = (paymentPayload as any).payer as string | undefined;

    // Execute in account pool (reuses queue, duplicate detection, etc.)
    return accountPool.execute(async (signer) => {
      // Import necessary modules dynamically
      const facilitatorV2 = (await import("@x402x/facilitator-sdk")) as any;

      // Create public client for the network
      const publicClient = facilitatorV2.createPublicClientForNetwork(
        paymentRequirements.network,
        this.config.rpcUrls,
      );

      // Use the signer from AccountPool as WalletClient
      // The signer from AccountPool is already a viem WalletClient with publicActions
      const walletClient = signer;

      // Execute settlement using the new function
      const result = await facilitatorV2.executeSettlementWithWalletClient(
        walletClient,
        publicClient,
        paymentRequirements,
        paymentPayload,
        {
          gasMultiplier: 1.2,
          timeoutMs: 30000,
          allowedRouters: this.config.allowedRouters,
        },
      );

      // Log V2 settlement result for debugging
      if (!result.success) {
        logger.error(
          {
            network: paymentRequirements.network,
            payer: result.payer,
            errorReason: result.errorReason,
            transaction: result.transaction,
          },
          "V2 settlement failed",
        );
      }

      // Return in v1 format for API consistency
      return {
        success: result.success,
        transaction: result.transaction,
        network: result.network as any,
        payer: result.payer,
        errorReason: result.errorReason as any,
      } as SettleResponse;
    }, payerAddress);
  }

}

/**
 * Create version dispatcher
 */
export function createVersionDispatcher(
  deps: VersionDispatcherDependencies,
  config: VersionDispatcherConfig = {},
): VersionDispatcher {
  return new VersionDispatcher(deps, config);
}
