/**
 * Version Dispatcher for x402 Facilitator
 *
 * Handles routing between v1 and v2 x402 implementations based on x402Version
 * and network format detection.
 */

/// <reference path="./types.d.ts" />

import { verify as v1Verify, settle as v1Settle } from "x402/facilitator";
import type { PaymentPayload, PaymentRequirements, X402Config } from "x402/types";
import type { PaymentRequirements as V2PaymentRequirements } from "@x402x/extensions";
import type { VerifyResponse, SettleResponse } from "x402/types";
import { getLogger, recordMetric, recordHistogram } from "./telemetry.js";
import type { PoolManager } from "./pool-manager.js";
import type { BalanceChecker } from "./balance-check.js";
import { determineX402Version, isVersionSupported, getCanonicalNetwork } from "./network-utils.js";
import { settleWithRouter } from "./settlement.js";

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
   * Verify payment using appropriate version implementation
   */
  async verify(request: VerifyRequest): Promise<VerifyResponse> {
    const startTime = Date.now();
    const { paymentPayload, paymentRequirements } = request;

    try {
      // Determine version
      const version = determineX402Version(paymentPayload, request);

      // Check if version is supported
      if (!isVersionSupported(version)) {
        const error =
          version === 2
            ? "V2 support is not enabled. Set FACILITATOR_ENABLE_V2=true to enable."
            : `Unsupported x402Version: ${version}`;

        logger.warn({ version, error }, "Version not supported");
        recordMetric("facilitator.verify.version_not_supported", 1, { version: String(version) });

        return {
          isValid: false,
          invalidReason: error as any, // Type assertion to handle v2 error format
        };
      }

      // Canonicalize network for internal use
      const canonicalNetwork = getCanonicalNetwork(paymentRequirements.network);

      // Route to appropriate implementation
      let result: VerifyResponse;
      let mode: "v1_standard" | "v1_settlementRouter" | "v2_router";

      if (version === 1) {
        // V1 implementation - detect SettlementRouter mode
        const isSettlementRouterMode = this.isV1SettlementRouterMode(paymentRequirements);
        mode = isSettlementRouterMode ? "v1_settlementRouter" : "v1_standard";

        result = await this.verifyV1(paymentPayload, paymentRequirements);
      } else {
        // V2 implementation - always uses router settlement
        mode = "v2_router";
        result = await this.verifyV2(paymentPayload, paymentRequirements as any);
      }

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
   * Settle payment using appropriate version implementation
   */
  async settle(request: SettleRequest): Promise<SettleResponse> {
    const startTime = Date.now();
    const { paymentPayload, paymentRequirements } = request;

    try {
      // Determine version
      const version = determineX402Version(paymentPayload, request);

      // Check if version is supported
      if (!isVersionSupported(version)) {
        const error =
          version === 2
            ? "V2 support is not enabled. Set FACILITATOR_ENABLE_V2=true to enable."
            : `Unsupported x402Version: ${version}`;

        logger.warn({ version, error }, "Version not supported");
        recordMetric("facilitator.settle.version_not_supported", 1, { version: String(version) });

        throw new Error(error);
      }

      // Canonicalize network for internal use
      const canonicalNetwork = getCanonicalNetwork(paymentRequirements.network);

      // Route to appropriate implementation
      let result: SettleResponse;
      let mode: "v1_standard" | "v1_settlementRouter" | "v2_router";

      if (version === 1) {
        // V1 implementation - detect SettlementRouter mode
        const isSettlementRouterMode = this.isV1SettlementRouterMode(paymentRequirements);
        mode = isSettlementRouterMode ? "v1_settlementRouter" : "v1_standard";

        result = await this.settleV1(paymentPayload, paymentRequirements);
      } else {
        // V2 implementation - always uses router settlement
        mode = "v2_router";
        result = await this.settleV2(paymentPayload, paymentRequirements as V2PaymentRequirements);
      }

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
   * V1 verification implementation
   */
  private async verifyV1(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): Promise<VerifyResponse> {
    // Create client (same as current v1 implementation)
    const { evm } = await import("x402/types");
    const { createPublicClient, http, publicActions } = await import("viem");

    // Type assertion for dynamic import - SupportedEVMNetworks exists on evm module
    if (!(evm as any).SupportedEVMNetworks?.includes(paymentRequirements.network)) {
      throw new Error("Invalid network. Only EVM networks are supported.");
    }

    const chain = evm.getChainFromNetwork(paymentRequirements.network);
    const rpcUrl =
      this.config.rpcUrls?.[paymentRequirements.network] || chain.rpcUrls?.default?.http?.[0];
    const client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    }).extend(publicActions);

    // Verify using v1 implementation
    return v1Verify(client, paymentPayload, paymentRequirements, this.deps.x402Config);
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
   * V1 settlement implementation
   */
  private async settleV1(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements,
  ): Promise<SettleResponse> {
    // Get account pool for v1 settlement
    const accountPool = this.deps.poolManager.getPool(paymentRequirements.network);
    if (!accountPool) {
      throw new Error(`No account pool available for network: ${paymentRequirements.network}`);
    }

    // Extract payer address for duplicate detection
    let payerAddress: string | undefined;
    if (
      paymentPayload.payload &&
      typeof paymentPayload.payload === "object" &&
      "authorization" in paymentPayload.payload &&
      paymentPayload.payload.authorization &&
      typeof paymentPayload.payload.authorization === "object" &&
      "from" in paymentPayload.payload.authorization
    ) {
      payerAddress = (paymentPayload.payload.authorization as { from: string }).from;
    }

    // Execute in account pool
    return accountPool.execute(async (signer) => {
      if (this.isV1SettlementRouterMode(paymentRequirements)) {
        // SettlementRouter mode for v1
        const response = await settleWithRouter(
          signer,
          paymentPayload,
          paymentRequirements,
          this.deps.allowedSettlementRouters || {},
        );

        // Return standard format - type assertion for v2 -> v1 response conversion
        return {
          success: response.success,
          transaction: response.transaction,
          network: response.network as any,
          payer: response.payer,
          errorReason: response.errorReason as any,
        } as SettleResponse;
      } else {
        // Standard mode for v1
        return v1Settle(signer, paymentPayload, paymentRequirements, this.deps.x402Config);
      }
    }, payerAddress);
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

  /**
   * Check if v1 payment requirements indicate SettlementRouter mode
   */
  private isV1SettlementRouterMode(paymentRequirements: PaymentRequirements): boolean {
    return !!paymentRequirements.extra?.settlementRouter;
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
