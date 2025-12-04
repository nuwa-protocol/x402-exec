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
  getNetworkConfig,
  calculateCommitment,
} from "@x402x/core";
import type { Address, Hex } from "viem";
import { parseErc6492Signature } from "viem/utils";
import { getLogger } from "./telemetry.js";
import { calculateGasMetrics } from "./gas-metrics.js";
import type { SettleResponseWithMetrics } from "./settlement-types.js";
import { calculateEffectiveGasLimit, type GasCostConfig } from "./gas-cost.js";
import { getGasPrice, type DynamicGasPriceConfig } from "./dynamic-gas-price.js";
import type { BalanceChecker } from "./balance-check.js";

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
 * @param network - The network name (e.g., "base-sepolia", "x-layer-testnet")
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
 * Parse and validate settlement extra parameters
 *
 * Uses @x402x/core's parseSettlementExtra for validation.
 *
 * @param extra - Extra field from PaymentRequirements
 * @returns Parsed settlement extra parameters
 * @throws SettlementExtraError if parameters are invalid
 */
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
): Promise<SettleResponseWithMetrics> {
  try {
    // 1. Ensure signer is EVM signer
    if (!isEvmSignerWallet(signer)) {
      throw new Error("Settlement Router requires an EVM signer");
    }

    const network = paymentRequirements.network;
    const asset = paymentRequirements.asset;

    // 2. Validate token address (SECURITY: only USDC is currently supported)
    validateTokenAddress(network, asset);

    // 3. Parse settlement extra parameters
    const extra = parseSettlementExtra(paymentRequirements.extra);

    logger.debug(
      {
        network,
        asset,
        router: extra.settlementRouter,
        facilitatorFee: extra.facilitatorFee,
      },
      "Starting settlement with router",
    );

    // 4. Validate SettlementRouter address against whitelist (SECURITY)
    validateSettlementRouter(network, extra.settlementRouter, allowedRouters);

    // 5. Parse authorization and signature from payload
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
      hub: extra.settlementRouter,
      asset: asset,
      from: authorization.from,
      value: authorization.value,
      validAfter: authorization.validAfter,
      validBefore: authorization.validBefore,
      salt: extra.salt,
      payTo: extra.payTo,
      facilitatorFee: extra.facilitatorFee,
      hook: extra.hook,
      hookData: extra.hookData,
    });

    if (authorization.nonce.toLowerCase() !== expectedCommitment.toLowerCase()) {
      logger.error(
        {
          network,
          from: authorization.from,
          expectedCommitment,
          actualNonce: authorization.nonce,
          chainId: chain.id,
          settlementRouter: extra.settlementRouter,
          salt: extra.salt,
          payTo: extra.payTo,
          facilitatorFee: extra.facilitatorFee,
          hook: extra.hook,
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
        const calculatedLimit = calculateEffectiveGasLimit(
          extra.facilitatorFee,
          gasPrice,
          nativePrice,
          gasCostConfig,
        );

        effectiveGasLimit = BigInt(calculatedLimit);
        gasLimitMode = gasCostConfig.dynamicGasLimitMargin > 0 ? "dynamic" : "static";

        logger.debug(
          {
            network,
            facilitatorFee: extra.facilitatorFee,
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

    // 7. Defensive balance check (verify stage should have already caught this)
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walletClient = signer as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const publicClient = signer as any;

    if (!walletClient.writeContract || !publicClient.waitForTransactionReceipt) {
      throw new Error(
        "Signer must be an EVM wallet client with writeContract and waitForTransactionReceipt methods",
      );
    }

    const tx = await walletClient.writeContract({
      address: extra.settlementRouter as Address,
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
        extra.salt as Hex,
        extra.payTo as Address,
        BigInt(extra.facilitatorFee),
        extra.hook as Address,
        extra.hookData as Hex,
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
    const gasMetrics = calculateGasMetrics(
      receipt,
      extra.facilitatorFee,
      extra.hook,
      network,
      nativePrice.toString(),
      6, // USDC decimals (all current settlements use USDC)
    );

    // 10. Log settlement success with gas metrics
    logger.info(
      {
        transaction: tx,
        payer: authorization.from,
        network,
        hook: extra.hook,
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
