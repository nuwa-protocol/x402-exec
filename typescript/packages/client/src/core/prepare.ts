/**
 * Prepare settlement data for signing
 *
 * This module handles the preparation of settlement parameters before signing,
 * including generating salt, calculating commitment hash, and fetching facilitator fees.
 */

import type { Address, Hex } from "viem";
import { getNetworkConfig, calculateFacilitatorFee, type FeeCalculationResult } from "@x402x/core";
import { calculateCommitment } from "@x402x/core";
import type { PrepareParams, SettlementData } from "../types.js";
import { NetworkError, ValidationError, FacilitatorError } from "../errors.js";
import {
  generateSalt,
  validateAddress,
  validateHex,
  parseAmount,
  calculateTimeWindow,
} from "./utils.js";

/**
 * Query facilitator fee from facilitator service (internal helper)
 *
 * Uses the /calculate-fee endpoint which provides accurate gas cost estimates
 * with safety margins.
 *
 * @internal
 * @param facilitatorUrl - Facilitator URL
 * @param network - Network name
 * @param hook - Hook contract address
 * @param hookData - Optional encoded hook parameters (default: '0x')
 * @returns Fee calculation result
 *
 * @throws FacilitatorError if request fails
 */
async function queryFacilitatorFee(
  facilitatorUrl: string,
  network: string,
  hook: Address,
  hookData: Hex = "0x",
): Promise<FeeCalculationResult> {
  try {
    return await calculateFacilitatorFee(facilitatorUrl, network, hook, hookData);
  } catch (error) {
    if (error instanceof Error) {
      throw new FacilitatorError(
        `Failed to query facilitator fee: ${error.message}`,
        "FEE_QUERY_FAILED",
      );
    }
    throw new FacilitatorError("Failed to query facilitator fee: Unknown error", "UNKNOWN_ERROR");
  }
}

/**
 * Prepare settlement data for signing
 *
 * This function:
 * 1. Validates all parameters
 * 2. Loads network configuration
 * 3. Generates salt (if not provided)
 * 4. Queries facilitator fee (if not provided)
 * 5. Calculates time window (if not provided)
 * 6. Calculates commitment hash
 * 7. Returns prepared settlement data
 *
 * @param params - Preparation parameters
 * @returns Prepared settlement data ready for signing
 *
 * @throws NetworkError if network is unsupported
 * @throws ValidationError if parameters are invalid
 *
 * @example
 * ```typescript
 * import { prepareSettlement } from '@x402x/client';
 * import { TransferHook } from '@x402x/core';
 *
 * const settlement = await prepareSettlement({
 *   wallet: walletClient,
 *   network: 'base-sepolia',
 *   hook: TransferHook.getAddress('base-sepolia'),
 *   hookData: TransferHook.encode(),
 *   amount: '1000000',
 *   recipient: '0x...',
 *   facilitatorUrl: 'https://facilitator.x402x.dev'
 * });
 * ```
 */
export async function prepareSettlement(params: PrepareParams): Promise<SettlementData> {
  // 1. Validate parameters
  validateAddress(params.hook, "hook");
  validateHex(params.hookData, "hookData");
  validateAddress(params.recipient, "recipient");

  // 2. Validate and parse amount
  let atomicAmount: string;
  try {
    atomicAmount = parseAmount(params.amount, params.network as any);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw new ValidationError(`Invalid amount: ${error.message}`);
    }
    throw error;
  }

  if (params.customSalt) {
    validateHex(params.customSalt, "customSalt", 32);
  }

  // 2. Get wallet account address
  const from = params.wallet.account?.address;
  if (!from) {
    throw new ValidationError("Wallet client must have an account");
  }

  // 3. Load network configuration
  const networkConfig = params.networkConfig || getNetworkConfig(params.network);
  if (!networkConfig) {
    throw new NetworkError(
      `Network '${params.network}' is not supported. Please provide custom networkConfig.`,
    );
  }

  // 4. Generate salt (if not provided)
  const salt = params.customSalt || generateSalt();

  // 5. Query facilitator fee (if not provided and facilitatorUrl is available)
  let facilitatorFee = params.facilitatorFee || "0";
  if (!params.facilitatorFee && params.facilitatorUrl) {
    try {
      const feeEstimate = await queryFacilitatorFee(
        params.facilitatorUrl,
        params.network,
        params.hook,
        params.hookData, // Pass hookData for accurate fee calculation
      );

      if (!feeEstimate.hookAllowed) {
        throw new ValidationError(
          `Hook ${params.hook} is not allowed on network ${params.network}.`,
        );
      }

      facilitatorFee = feeEstimate.facilitatorFee;
    } catch (error) {
      // If fee query fails, log warning and use 0
      console.warn(
        `[x402x] Failed to query facilitator fee, using 0. This may cause settlement to fail. Error: ${error instanceof Error ? error.message : "Unknown"}`,
      );
      facilitatorFee = "0";
    }
  }

  // 6. Calculate time window (if not provided)
  const timeWindow =
    params.validAfter && params.validBefore
      ? { validAfter: params.validAfter, validBefore: params.validBefore }
      : calculateTimeWindow(300); // 5 minutes default

  // 7. Calculate commitment hash
  const commitment = calculateCommitment({
    chainId: networkConfig.chainId,
    hub: networkConfig.settlementRouter as Address,
    token: networkConfig.usdc.address as Address,
    from,
    value: atomicAmount,
    validAfter: timeWindow.validAfter,
    validBefore: timeWindow.validBefore,
    salt,
    payTo: params.recipient,
    facilitatorFee,
    hook: params.hook,
    hookData: params.hookData,
  });

  // 8. Return prepared settlement data
  return {
    network: params.network,
    networkConfig,
    token: networkConfig.usdc.address as Address,
    from,
    amount: atomicAmount,
    validAfter: timeWindow.validAfter,
    validBefore: timeWindow.validBefore,
    salt,
    payTo: params.recipient,
    facilitatorFee,
    hook: params.hook,
    hookData: params.hookData,
    commitment: commitment as Hex,
  };
}
