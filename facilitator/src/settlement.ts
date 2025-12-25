/**
 * Settlement Router Integration Module
 *
 * This module provides functions for detecting and handling settlement mode payments
 * that use the SettlementRouter contract for extended business logic via Hooks.
 *
 * Implements direct contract interaction with additional logging and gas metrics calculation.
 */

import { verify } from "x402/facilitator";
import { evm } from "x402/types";
import type { PaymentPayload, PaymentRequirements, Signer, X402Config } from "x402/types";
import { isEvmSignerWallet } from "x402/types";
import { createPublicClient, http, publicActions } from "viem";
import {
  SettlementExtraError,
  SETTLEMENT_ROUTER_ABI,
  isSettlementMode as isSettlementModeCore,
  parseSettlementExtra as parseSettlementExtraCore,
  calculateCommitment,
} from "@x402x/core";
// Import V2 getNetworkConfig for CAIP-2 support
import { getNetworkConfig } from "@x402x/extensions";
import type { Address, Hex } from "viem";
import { parseErc6492Signature } from "viem/utils";
import { getLogger } from "./telemetry.js";
import { calculateGasMetrics } from "./gas-metrics.js";
import type { SettleResponseWithMetrics } from "./settlement-types.js";
import { calculateEffectiveGasLimit, type GasCostConfig } from "./gas-cost.js";
import { getGasPrice, type DynamicGasPriceConfig } from "./dynamic-gas-price.js";
import type { BalanceChecker } from "./balance-check.js";
import { getCanonicalNetwork, getNetworkDisplayName } from "./network-utils.js";
import { createGasEstimator, type GasEstimationConfig } from "./gas-estimation/index.js";

const logger = getLogger();

/**
 * Check if a payment request requires SettlementRouter mode
 *
 * Re-exported from @x402x/core for convenience.
 *
 * @param paymentRequirements - The payment requirements from the 402 response
 * @returns True if settlement mode is required (extra.settlementRouter exists)
 */
export function isSettlementMode(paymentRequirements: PaymentRequirements): boolean {
  return isSettlementModeCore(paymentRequirements);
}

/**
 * Validate SettlementRouter address against whitelist
 *
 * @param network - The network name (e.g., "base-sepolia", "x-layer-testnet")
 * @param routerAddress - The SettlementRouter address to validate
 * @param allowedRouters - Whitelist of allowed router addresses per network
 * @throws SettlementExtraError if router address is not in whitelist
 */
export function validateSettlementRouter(
  network: string,
  routerAddress: string,
  allowedRouters: Record<string, string[]>,
): void {
  const allowedForNetwork = allowedRouters[network];

  if (!allowedForNetwork || allowedForNetwork.length === 0) {
    logger.error(
      {
        network,
        routerAddress,
      },
      "No allowed settlement routers configured for network",
    );
    throw new SettlementExtraError(
      `No allowed settlement routers configured for network: ${network}`,
    );
  }

  const normalizedRouter = routerAddress.toLowerCase();
  const isAllowed = allowedForNetwork.some((allowed) => allowed.toLowerCase() === normalizedRouter);

  if (!isAllowed) {
    logger.error(
      {
        network,
        routerAddress,
        allowedAddresses: allowedForNetwork,
      },
      "Settlement router not in whitelist",
    );
    throw new SettlementExtraError(
      `Settlement router ${routerAddress} is not in whitelist for network ${network}. ` +
        `Allowed: ${allowedForNetwork.join(", ")}`,
    );
  }

  logger.info(
    {
      network,
      routerAddress,
    },
    "Settlement router validated",
  );
}

/**
 * Validate token address (only USDC is currently supported)
 *
 * @param network - The network name in V1 format (e.g., "base-sepolia", "x-layer-testnet")
 * @param tokenAddress - The token address to validate
 * @throws SettlementExtraError if token is not supported
 */
export function validateTokenAddress(network: string, tokenAddress: string): void {
  const networkConfig = getNetworkConfig(network);
  const expectedUsdcAddress = networkConfig.defaultAsset.address.toLowerCase();
  const actualTokenAddress = tokenAddress.toLowerCase();

  if (actualTokenAddress !== expectedUsdcAddress) {
    logger.error(
      {
        network,
        providedToken: tokenAddress,
        expectedToken: networkConfig.defaultAsset.address,
      },
      "Unsupported token address detected in settlement",
    );
    throw new SettlementExtraError(
      `Only USDC is currently supported for settlement on ${network}. ` +
        `Expected: ${networkConfig.defaultAsset.address}, Got: ${tokenAddress}`,
    );
  }

  logger.debug(
    {
      network,
      tokenAddress: networkConfig.defaultAsset.address,
    },
    "Token address validated",
  );
}

/**
 * Parse and validate settlement parameters
 *
 * Extracts settlement parameters following the v2 standard protocol design:
 * - PRIMARY: Reads from PaymentPayload.extensions["x402x-router-settlement"].info (v2 standard)
 * - FALLBACK: Reads from PaymentRequirements.extra (v1 compatibility)
 *
 * This unified function handles both v2 and v1 payment formats, ensuring backward compatibility
 * while following the new x402 v2 specification where extensions contain protocol-level
 * functionality and extra contains scheme-specific parameters.
 *
 * @param paymentPayload - The payment payload (may contain extensions in v2 format)
 * @param paymentRequirements - The payment requirements (contains extra for v1 fallback)
 * @returns Parsed settlement parameters with all required fields
 * @throws SettlementExtraError if parameters are invalid or missing
 */
function parseSettlementParams(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
): {
  settlementRouter: string;
  salt: string;
  payTo: string;
  facilitatorFee: string;
  hook: string;
  hookData: string;
} {
  // Try v2 standard: extract from PaymentPayload.extensions
  // Use type assertion as v1 PaymentPayload doesn't have extensions field
  const payloadWithExtensions = paymentPayload as any;
  if (
    payloadWithExtensions.extensions &&
    "x402x-router-settlement" in payloadWithExtensions.extensions
  ) {
    const extension = payloadWithExtensions.extensions["x402x-router-settlement"] as any;
    if (extension?.info) {
      const info = extension.info;

      // Validate all required fields are present
      if (info.settlementRouter && info.salt && info.hook && info.hookData) {
        // Use finalPayTo or payTo
        const payTo = info.finalPayTo || info.payTo;
        if (payTo) {
          logger.debug("Using settlement params from PaymentPayload.extensions (v2 standard)");
          return {
            settlementRouter: info.settlementRouter,
            salt: info.salt,
            payTo,
            facilitatorFee: info.facilitatorFee || "0",
            hook: info.hook,
            hookData: info.hookData,
          };
        }
      }
    }
  }

  // Fallback: v1/old format from PaymentRequirements.extra
  logger.debug("Falling back to settlement params from PaymentRequirements.extra (v1 compat)");
  return parseSettlementExtraCore(paymentRequirements.extra);
}

/**
 * Parse and validate settlement extra parameters (LEGACY)
 *
 * @deprecated This function only reads from PaymentRequirements.extra (v1 format).
 * Use {@link parseSettlementParams} instead for full v2 support with automatic
 * fallback to v1 format.
 *
 * @internal This function is kept for documentation purposes and backward compatibility.
 * Not actively used in the codebase.
 *
 * Uses parseSettlementExtraCore (imported from @x402x/core) for validation.
 *
 * @param extra - Extra field from PaymentRequirements
 * @returns Parsed settlement extra parameters
 * @throws SettlementExtraError if parameters are invalid
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function parseSettlementExtra(extra: unknown): {
  settlementRouter: string;
  salt: string;
  payTo: string;
  facilitatorFee: string;
  hook: string;
  hookData: string;
} {
  return parseSettlementExtraCore(extra);
}

/**
 * Settle payment using SettlementRouter contract
 *
 * Directly calls SettlementRouter.settleAndExecute which:
 * 1. Verifies the EIP-3009 authorization
 * 2. Transfers tokens from payer to Router
 * 3. Deducts facilitator fee
 * 4. Executes the Hook with remaining amount
 * 5. Ensures Router doesn't hold funds
 *
 * This function implements:
 * - Router whitelist validation (SECURITY)
 * - Dynamic gas limit calculation based on facilitator fee
 * - Gas cost tracking and profitability metrics
 * - Detailed logging for monitoring
 * - Warning on unprofitable settlements
 *
 * @param signer - The facilitator's wallet signer (must support EVM)
 * @param paymentPayload - The payment payload with authorization and signature
 * @param paymentRequirements - The payment requirements with settlement extra parameters
 * @param allowedRouters - Whitelist of allowed SettlementRouter addresses per network
 * @param gasCostConfig - Gas cost configuration for dynamic gas limit
 * @param dynamicGasPriceConfig - Dynamic gas price configuration
 * @param nativeTokenPrices - Optional native token prices by network (for gas metrics)
 * @param balanceChecker - Optional balance checker for defensive balance validation
 * @param x402Config - Optional x402 configuration for verification
 * @param gasEstimationConfig - Optional gas estimation configuration for smart gas limit calculation
 * @returns SettleResponse with gas metrics for monitoring
 * @throws Error if the payment is for non-EVM network or settlement fails
 */
export async function settleWithRouter(
  signer: Signer,
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements,
  allowedRouters: Record<string, string[]>,
  gasCostConfig?: GasCostConfig,
  dynamicGasPriceConfig?: DynamicGasPriceConfig,
  nativeTokenPrices?: Record<string, number>,
  balanceChecker?: BalanceChecker,
  x402Config?: X402Config,
  gasEstimationConfig?: GasEstimationConfig,
): Promise<SettleResponseWithMetrics> {
  try {
    // 1. Ensure signer is EVM signer
    if (!isEvmSignerWallet(signer)) {
      throw new Error("Settlement Router requires an EVM signer");
    }

    // 2. Normalize network identifier (V1/V2 -> V1)
    // This ensures all network-related config lookups use the correct format
    const canonicalNetwork = getCanonicalNetwork(paymentRequirements.network);
    const network = getNetworkDisplayName(canonicalNetwork);
    const asset = paymentRequirements.asset;

    // 3. Validate token address (SECURITY: only USDC is currently supported)
    validateTokenAddress(network, asset);

    // 4. Parse settlement parameters (v2: from extensions, v1: from extra)
    const settlementParams = parseSettlementParams(paymentPayload, paymentRequirements);

    logger.debug(
      {
        network,
        asset,
        router: settlementParams.settlementRouter,
        facilitatorFee: settlementParams.facilitatorFee,
      },
      "Starting settlement with router",
    );

    // 5. Validate SettlementRouter address against whitelist (SECURITY)
    validateSettlementRouter(network, settlementParams.settlementRouter, allowedRouters);

    // 6. Parse authorization and signature from payload
    const payload = paymentPayload.payload;

    // Type guard: ensure this is an EVM payload with authorization and signature
    if (!payload || typeof payload !== "object" || !("authorization" in payload)) {
      throw new Error("Missing authorization in payment payload");
    }

    if (!("signature" in payload) || !payload.signature) {
      throw new Error("Missing signature in payment payload");
    }

    // Now we can safely access the EVM payload fields
    type EvmPayload = { authorization: any; signature: string };
    const evmPayload = payload as EvmPayload;
    const authorization = evmPayload.authorization;
    const { signature } = parseErc6492Signature(evmPayload.signature as Hex);

    // Log authorization details for debugging signature issues
    logger.debug(
      {
        network,
        from: authorization.from,
        to: authorization.to,
        value: authorization.value,
        validAfter: authorization.validAfter,
        validBefore: authorization.validBefore,
        nonce: authorization.nonce,
        asset,
      },
      "Settlement authorization details (before on-chain validation)",
    );

    // 5.5. Validate payment using x402 SDK (SECURITY: prevent any invalid payments from wasting gas)
    // Create client with custom RPC URL support
    const chain = evm.getChainFromNetwork(network);
    const rpcUrl = dynamicGasPriceConfig?.rpcUrls[network] || chain.rpcUrls?.default?.http?.[0];
    const client = createPublicClient({
      chain,
      transport: http(rpcUrl),
    }).extend(publicActions);
    const verifyResult = await verify(
      client as any,
      paymentPayload,
      paymentRequirements,
      x402Config,
    );

    if (!verifyResult.isValid) {
      // x402 SDK verification failed - return error to prevent gas waste on guaranteed-to-fail transactions
      // This catches: invalid signatures, wrong recipients, insufficient balance, expired timestamps, etc.
      const invalidReason = verifyResult.invalidReason || "";
      const payer = verifyResult.payer || authorization.from;

      logger.warn(
        {
          network,
          from: authorization.from,
          payer,
          invalidReason,
          validAfter: authorization.validAfter,
          validBefore: authorization.validBefore,
          currentTime: Math.floor(Date.now() / 1000),
        },
        "x402 SDK verification failed - preventing wasted gas transaction",
      );

      // Map x402 SDK error reasons to our error reasons for better user experience
      let errorReason = "PAYMENT_VERIFICATION_FAILED";
      if (invalidReason.includes("authorization_valid_before")) {
        errorReason = "AUTHORIZATION_EXPIRED";
      } else if (invalidReason.includes("authorization_valid_after")) {
        errorReason = "AUTHORIZATION_NOT_YET_VALID";
      } else if (invalidReason.includes("signature")) {
        errorReason = "INVALID_SIGNATURE";
      } else if (invalidReason.includes("recipient")) {
        errorReason = "INVALID_RECIPIENT";
      } else if (invalidReason.includes("insufficient_funds")) {
        errorReason = "INSUFFICIENT_FUNDS";
      }

      return {
        success: false,
        errorReason,
        transaction: "",
        network: paymentPayload.network,
        payer,
      };
    }

    // 5.6. Validate commitment hash (SECURITY: ensure nonce matches calculated commitment)
    // This prevents parameter tampering attacks where settlement parameters are modified after signing
    const expectedCommitment = calculateCommitment({
      chainId: chain.id,
      hub: settlementParams.settlementRouter,
      asset: asset,
      from: authorization.from,
      value: authorization.value,
      validAfter: authorization.validAfter,
      validBefore: authorization.validBefore,
      salt: settlementParams.salt,
      payTo: settlementParams.payTo,
      facilitatorFee: settlementParams.facilitatorFee,
      hook: settlementParams.hook,
      hookData: settlementParams.hookData,
    });

    if (authorization.nonce.toLowerCase() !== expectedCommitment.toLowerCase()) {
      logger.error(
        {
          network,
          from: authorization.from,
          expectedCommitment,
          actualNonce: authorization.nonce,
          chainId: chain.id,
          settlementRouter: settlementParams.settlementRouter,
          salt: settlementParams.salt,
          payTo: settlementParams.payTo,
          facilitatorFee: settlementParams.facilitatorFee,
          hook: settlementParams.hook,
        },
        "Commitment mismatch detected - preventing wasted gas transaction",
      );

      return {
        success: false,
        errorReason: "INVALID_COMMITMENT",
        transaction: "",
        network: paymentPayload.network,
        payer: authorization.from,
      };
    }

    logger.debug(
      {
        network,
        commitment: expectedCommitment,
      },
      "Commitment validation passed",
    );

    // 6. Calculate effective gas limit if config is provided
    let effectiveGasLimit: bigint | undefined;
    let gasLimitMode = "static";

    if (gasCostConfig && dynamicGasPriceConfig) {
      try {
        // Get current gas price for the network
        const gasPrice = await getGasPrice(network, gasCostConfig, dynamicGasPriceConfig);

        // Get native token price
        const nativePrice = nativeTokenPrices?.[network] || 0;

        // Calculate effective gas limit with triple constraints
        const networkConfig = getNetworkConfig(network);
        const calculatedLimit = calculateEffectiveGasLimit(
          settlementParams.facilitatorFee,
          gasPrice,
          nativePrice,
          networkConfig.defaultAsset.decimals,
          gasCostConfig,
        );

        effectiveGasLimit = BigInt(calculatedLimit);
        gasLimitMode = gasCostConfig.dynamicGasLimitMargin > 0 ? "dynamic" : "static";

        logger.debug(
          {
            network,
            facilitatorFee: settlementParams.facilitatorFee,
            gasPrice,
            nativePrice,
            effectiveGasLimit: calculatedLimit,
            mode: gasLimitMode,
            minGasLimit: gasCostConfig.minGasLimit,
            maxGasLimit: gasCostConfig.maxGasLimit,
            dynamicMargin: gasCostConfig.dynamicGasLimitMargin,
          },
          "Calculated effective gas limit for settlement",
        );
      } catch (error) {
        logger.warn(
          {
            error,
            network,
          },
          "Failed to calculate dynamic gas limit, using default",
        );
        // Continue with default gas limit
      }
    }

    // Prepare wallet client for pre-validation and execution
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = signer as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publicClient = signer as any;

    // 7. Pre-validate settlement transaction (NEW: prevent gas waste on invalid transactions)
    if (gasEstimationConfig?.enabled) {
      try {
        // Create gas estimator (can be cached at app level for better performance)
        const gasEstimator = createGasEstimator(
          gasEstimationConfig,
          logger.child({ module: "gas-estimation" }),
        );

        const hookAmount = BigInt(authorization.value) - BigInt(settlementParams.facilitatorFee);

        const estimation = await gasEstimator.estimateGas({
          network,
          hook: settlementParams.hook,
          hookData: settlementParams.hookData,
          settlementRouter: settlementParams.settlementRouter,
          token: asset,
          from: authorization.from,
          value: BigInt(authorization.value),
          authorization: {
            validAfter: authorization.validAfter,
            validBefore: authorization.validBefore,
            nonce: authorization.nonce,
          },
          signature,
          salt: settlementParams.salt,
          payTo: settlementParams.payTo,
          facilitatorFee: BigInt(settlementParams.facilitatorFee),
          hookAmount,
          walletClient,
          gasCostConfig: gasCostConfig || {
            minGasLimit: 150000,
            maxGasLimit: 5000000,
            dynamicGasLimitMargin: 0.2,
            hookGasOverhead: {},
            safetyMultiplier: 1.5,
            validationTolerance: 0.1,
            hookWhitelistEnabled: false,
            minFacilitatorFeeUsd: 0.01,
            allowedHooks: {},
            networkGasPrice: {},
            nativeTokenPrice: {},
          },
          gasEstimationConfig,
        });

        if (!estimation.isValid) {
          logger.warn(
            {
              network,
              hook: settlementParams.hook,
              strategy: estimation.strategyUsed,
              errorReason: estimation.errorReason,
              payer: authorization.from,
            },
            "Settlement pre-validation failed - preventing gas waste",
          );

          return {
            success: false,
            errorReason: estimation.errorReason || "SETTLEMENT_PREVALIDATION_FAILED",
            transaction: "",
            network: paymentPayload.network,
            payer: authorization.from,
          };
        }

        // Use estimated gas limit
        effectiveGasLimit = BigInt(estimation.gasLimit);
        gasLimitMode = estimation.strategyUsed;

        logger.debug(
          {
            network,
            hook: settlementParams.hook,
            strategy: estimation.strategyUsed,
            gasLimit: estimation.gasLimit,
            mode: gasLimitMode,
            metadata: estimation.metadata,
          },
          "Settlement pre-validation passed with gas limit",
        );
      } catch (error) {
        logger.warn(
          { error, network, hook: settlementParams.hook },
          "Error during settlement pre-validation, falling back to static gas limit",
        );
        // Fallback to static gas limit if pre-validation itself fails
        const fallbackGasCostConfig = gasCostConfig || {
          minGasLimit: 150000,
          maxGasLimit: 5000000,
          dynamicGasLimitMargin: 0.2,
          hookGasOverhead: {},
          safetyMultiplier: 1.5,
          validationTolerance: 0.1,
          hookWhitelistEnabled: false,
          minFacilitatorFeeUsd: 0.01,
          allowedHooks: {},
          networkGasPrice: {},
          nativeTokenPrice: {},
        };
        const networkConfig = getNetworkConfig(network);
        effectiveGasLimit = BigInt(
          calculateEffectiveGasLimit(
            settlementParams.facilitatorFee,
            await getGasPrice(network, fallbackGasCostConfig, dynamicGasPriceConfig),
            nativeTokenPrices?.[network] || 0,
            networkConfig.defaultAsset.decimals,
            fallbackGasCostConfig,
          ),
        );
        gasLimitMode = "static_fallback";
      }
    }

    // 8. Defensive balance check (verify stage should have already caught this)
    if (balanceChecker) {
      try {
        const balanceCheck = await balanceChecker.checkBalance(
          signer as any, // Signer has readContract method needed for balance checks
          authorization.from as `0x${string}`,
          asset as `0x${string}`,
          authorization.value,
          network,
        );

        if (!balanceCheck.hasSufficient) {
          logger.error(
            {
              payer: authorization.from,
              network,
              balance: balanceCheck.balance,
              required: balanceCheck.required,
              cached: balanceCheck.cached,
            },
            "Insufficient balance detected during settlement (defensive check)",
          );

          return {
            success: false,
            errorReason: "INSUFFICIENT_FUNDS",
            transaction: "",
            network: paymentPayload.network,
            payer: authorization.from,
          };
        } else {
          logger.debug(
            {
              payer: authorization.from,
              network,
              balance: balanceCheck.balance,
              required: balanceCheck.required,
              cached: balanceCheck.cached,
            },
            "Balance check passed during settlement (defensive check)",
          );
        }
      } catch (error) {
        logger.error(
          {
            error,
            payer: authorization.from,
            network,
          },
          "Balance check failed during settlement, proceeding with transaction",
        );
        // If balance check fails, we continue with the transaction
        // This ensures settlement can still work even if balance check has issues
      }
    }

    // 8. Call SettlementRouter.settleAndExecute
    if (!walletClient.writeContract || !publicClient.waitForTransactionReceipt) {
      throw new Error(
        "Signer must be an EVM wallet client with writeContract and waitForTransactionReceipt methods",
      );
    }

    const tx = await walletClient.writeContract({
      address: settlementParams.settlementRouter as Address,
      abi: SETTLEMENT_ROUTER_ABI,
      functionName: "settleAndExecute",
      args: [
        paymentRequirements.asset as Address,
        authorization.from as Address,
        BigInt(authorization.value),
        BigInt(authorization.validAfter),
        BigInt(authorization.validBefore),
        authorization.nonce as Hex,
        signature,
        settlementParams.salt as Hex,
        settlementParams.payTo as Address,
        BigInt(settlementParams.facilitatorFee),
        settlementParams.hook as Address,
        settlementParams.hookData as Hex,
      ],
      // Add gas limit if configured (for security against malicious hooks)
      ...(effectiveGasLimit ? { gas: effectiveGasLimit } : {}),
    });

    // 8. Wait for transaction confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

    if (receipt.status !== "success") {
      return {
        success: false,
        errorReason: "invalid_transaction_state",
        transaction: tx,
        network: paymentPayload.network,
        payer: authorization.from,
      };
    }

    // 9. Calculate gas metrics
    const nativePrice = nativeTokenPrices?.[network] || 0;
    const networkConfig = getNetworkConfig(network);
    const gasMetrics = calculateGasMetrics(
      receipt,
      settlementParams.facilitatorFee,
      settlementParams.hook,
      network,
      nativePrice.toString(),
      networkConfig.defaultAsset.decimals,
    );

    // 10. Log settlement success with gas metrics
    logger.info(
      {
        transaction: tx,
        payer: authorization.from,
        network,
        hook: settlementParams.hook,
        gasLimit: {
          value: effectiveGasLimit?.toString(),
          mode: gasLimitMode,
        },
        gasMetrics: {
          gasUsed: gasMetrics.gasUsed,
          effectiveGasPrice: gasMetrics.effectiveGasPrice,
          actualGasCostNative: gasMetrics.actualGasCostNative,
          actualGasCostUSD: gasMetrics.actualGasCostUSD,
          facilitatorFee: gasMetrics.facilitatorFee,
          facilitatorFeeUSD: gasMetrics.facilitatorFeeUSD,
          profitUSD: gasMetrics.profitUSD,
          profitMarginPercent: gasMetrics.profitMarginPercent,
          profitable: gasMetrics.profitable,
        },
      },
      "SettlementRouter transaction confirmed with gas metrics",
    );

    // 11. Warn if unprofitable
    if (!gasMetrics.profitable) {
      const lossPercent = Math.abs(parseFloat(gasMetrics.profitMarginPercent));
      logger.warn(
        {
          transaction: tx,
          network,
          hook: gasMetrics.hook,
          facilitatorFeeUSD: gasMetrics.facilitatorFeeUSD,
          actualGasCostUSD: gasMetrics.actualGasCostUSD,
          lossUSD: gasMetrics.profitUSD,
          lossPercent: `${lossPercent}%`,
        },
        "⚠️ UNPROFITABLE SETTLEMENT: Facilitator fee did not cover gas costs",
      );
    }

    // 12. Return successful settlement response with gas metrics
    return {
      success: true,
      transaction: tx,
      network: paymentPayload.network,
      payer: authorization.from,
      gasMetrics,
    };
  } catch (error) {
    logger.error(
      {
        error,
        network: paymentRequirements.network,
        router: paymentRequirements.extra?.settlementRouter,
      },
      "Error in settleWithRouter",
    );

    // Extract payer from payload if available
    let payer = "";
    try {
      const payload = paymentPayload.payload;
      if (payload && typeof payload === "object" && "authorization" in payload) {
        const auth = (payload as any).authorization;
        payer = auth?.from || "";
      }
    } catch {
      // Ignore extraction errors
    }

    return {
      success: false,
      errorReason:
        error instanceof SettlementExtraError
          ? "invalid_payment_requirements"
          : "unexpected_settle_error",
      transaction: "",
      network: paymentPayload.network,
      payer,
    };
  }
}
