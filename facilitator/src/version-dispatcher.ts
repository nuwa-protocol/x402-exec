/**
 * Version Dispatcher for x402 Facilitator
 *
 * Handles routing between v1 and v2 x402 implementations based on x402Version
 * and network format detection.
 */

import { verify as v1Verify, settle as v1Settle } from "x402/facilitator";
import { createRouterSettlementFacilitator } from "@x402x/facilitator_v2";
import type { PaymentPayload, PaymentRequirements, X402Config } from "x402/types";
import type { PaymentRequirements as V2PaymentRequirements } from "x402/types";
import { SupportedEVMNetworks } from "x402/types";
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
  /** Facilitator signer address for v2 */
  signer?: string;
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
  private v2Facilitator?: ReturnType<typeof createRouterSettlementFacilitator>;

  constructor(
    private deps: VersionDispatcherDependencies,
    private config: VersionDispatcherConfig = {}
  ) {
    // Initialize v2 facilitator if enabled
    if (this.config.enableV2 && this.config.signer) {
      this.v2Facilitator = createRouterSettlementFacilitator({
        signer: this.config.signer,
        allowedRouters: this.config.allowedRouters,
        rpcUrls: this.config.rpcUrls,
      });
      logger.info("V2 facilitator initialized");
    }

    if (this.config.enableV2) {
      logger.info("Version dispatcher: v2 support enabled");
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
        const error = version === 2
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

      logger.info({
        version,
        mode,
        network: canonicalNetwork,
        isValid: result.isValid,
        payer: result.payer,
        duration_ms: duration,
      }, "Verification completed");

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error({ error, duration_ms: duration }, "Verification failed");
      recordMetric("facilitator.verify.errors", 1, {
        error_type: error instanceof Error ? error.name : "unknown",
      });

      return {
        isValid: false,
        invalidReason: "Verification failed due to internal error" as any,
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
        const error = version === 2
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
        result = await this.settleV2(paymentPayload, paymentRequirements as any);
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

      logger.info({
        version,
        mode,
        network: canonicalNetwork,
        success: result.success,
        transaction: result.transaction,
        payer: result.payer,
        duration_ms: duration,
      }, "Settlement completed");

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
    paymentRequirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    // Create client (same as current v1 implementation)
    const { evm } = await import("x402/types");
    const { createPublicClient, http, publicActions } = await import("viem");

    if (!evm.SupportedEVMNetworks.includes(paymentRequirements.network)) {
      throw new Error("Invalid network. Only EVM networks are supported.");
    }

    const chain = evm.getChainFromNetwork(paymentRequirements.network);
    const rpcUrl = this.config.rpcUrls?.[paymentRequirements.network] || chain.rpcUrls?.default?.http?.[0];
    const client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    }).extend(publicActions);

    // Verify using v1 implementation
    return v1Verify(client, paymentPayload, paymentRequirements, this.deps.x402Config);
  }

  /**
   * V2 verification implementation
   */
  private async verifyV2(
    paymentPayload: PaymentPayload,
    paymentRequirements: V2PaymentRequirements
  ): Promise<VerifyResponse> {
    if (!this.v2Facilitator) {
      throw new Error("V2 facilitator not initialized");
    }

    // Verify using v2 implementation
    const result = await this.v2Facilitator.verify(paymentPayload, paymentRequirements);

    // Convert v2 response to v1 format for API consistency
    return {
      isValid: result.isValid,
      invalidReason: result.invalidReason,
      payer: result.payer,
    };
  }

  /**
   * V1 settlement implementation
   */
  private async settleV1(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
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
        const { settleWithRouter } = await import("../settlement.js");
        const response = await settleWithRouter(
          signer,
          paymentPayload,
          paymentRequirements,
          this.deps.allowedSettlementRouters || {}
        );

        // Return standard format
        return {
          success: response.success,
          transaction: response.transaction,
          network: response.network,
          payer: response.payer,
          errorReason: response.errorReason,
        };
      } else {
        // Standard mode for v1
        return v1Settle(signer, paymentPayload, paymentRequirements, this.deps.x402Config);
      }
    }, payerAddress);
  }

  /**
   * V2 settlement implementation
   */
  private async settleV2(
    paymentPayload: PaymentPayload,
    paymentRequirements: V2PaymentRequirements
  ): Promise<SettleResponse> {
    if (!this.v2Facilitator) {
      throw new Error("V2 facilitator not initialized");
    }

    // Settle using v2 implementation
    const result = await this.v2Facilitator.settle(paymentPayload, paymentRequirements);

    // Convert v2 response to v1 format for API consistency
    return {
      success: result.success,
      transaction: result.transaction,
      network: result.network,
      payer: result.payer,
      errorReason: result.errorReason,
    };
  }

  /**
   * Check if v1 payment requirements indicate SettlementRouter mode
   */
  private isV1SettlementRouterMode(paymentRequirements: PaymentRequirements): boolean {
    return !!(paymentRequirements.extra?.settlementRouter);
  }
}

/**
 * Create version dispatcher
 */
export function createVersionDispatcher(
  deps: VersionDispatcherDependencies,
  config: VersionDispatcherConfig = {}
): VersionDispatcher {
  return new VersionDispatcher(deps, config);
}