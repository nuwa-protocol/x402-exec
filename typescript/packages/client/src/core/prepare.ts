/**
 * Prepare settlement data for signing
 *
 * This module handles the preparation of settlement parameters before signing,
 * including generating salt, calculating commitment hash, and fetching facilitator fees.
 */

import type { Address, Hex } from "viem";
import { getNetworkConfig } from "@x402x/core";
import { calculateCommitment } from "@x402x/core";
import type { PrepareParams, SettlementData, FeeEstimate } from "../types.js";
import { NetworkError, ValidationError } from "../errors.js";
import {
  generateSalt,
  validateAddress,
  validateHex,
  parseAmount,
  calculateTimeWindow,
  formatFacilitatorUrl,
} from "./utils.js";

/**
 * Query minimum facilitator fee from facilitator
 *
 * @param facilitatorUrl - Facilitator URL
 * @param network - Network name
 * @param hook - Hook contract address
 * @returns Fee estimate
 *
 * @throws FacilitatorError if request fails
 *
 * @example
 * ```typescript
 * const fee = await queryFacilitatorFee(
 *   'https://facilitator.x402.io',
 *   'base-sepolia',
 *   '0x...'
 * );
 * console.log('Min fee:', fee.minFacilitatorFee);
 * ```
 */
export async function queryFacilitatorFee(
  facilitatorUrl: string,
  network: string,
  hook: Address,
): Promise<FeeEstimate> {
  const url = `${formatFacilitatorUrl(facilitatorUrl)}/min-facilitator-fee?network=${encodeURIComponent(network)}&hook=${encodeURIComponent(hook)}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data as FeeEstimate;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to query facilitator fee: ${error.message}`);
    }
    throw new Error("Failed to query facilitator fee: Unknown error");
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
 *   facilitatorUrl: 'https://facilitator.x402.io'
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
      );

      if (!feeEstimate.hookAllowed) {
        throw new ValidationError(
          `Hook ${params.hook} is not allowed on network ${params.network}. ` +
            `Error: ${feeEstimate.error || "Unknown error"}`,
        );
      }

      facilitatorFee = feeEstimate.minFacilitatorFee;
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
