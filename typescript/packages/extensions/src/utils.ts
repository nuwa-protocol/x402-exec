/**
 * Utility functions for x402x
 */

import type { PaymentRequirements, SettlementExtra } from "./types.js";
import { getNetworkConfig } from "./networks.js";
import { generateSalt } from "./commitment.js";
import { assertValidSettlementExtra } from "./validation.js";
import { getNetworkName } from "./network-utils.js";

/**
 * Add settlement extension to PaymentRequirements
 *
 * This function enriches standard x402 PaymentRequirements with settlement-specific
 * parameters in the `extra` field.
 *
 * @param requirements - Base PaymentRequirements (standard x402)
 * @param params - Settlement parameters
 * @returns Enhanced PaymentRequirements with settlement extra
 *
 * @example
 * ```typescript
 * import { addSettlementExtra, TransferHook, getNetworkConfig } from '@x402x/core';
 *
 * const baseRequirements = {
 *   scheme: 'exact',
 *   network: 'base-sepolia',
 *   maxAmountRequired: '100000',
 *   asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
 *   payTo: '0x...',
 *   resource: '/api/payment',
 * };
 *
 * const requirements = addSettlementExtra(baseRequirements, {
 *   hook: TransferHook.getAddress('base-sepolia'),
 *   hookData: TransferHook.encode(),
 *   facilitatorFee: '10000',
 *   payTo: merchantAddress,
 * });
 * ```
 */
export function addSettlementExtra(
  requirements: PaymentRequirements,
  params: {
    hook: string;
    hookData: string;
    facilitatorFee?: string;
    payTo?: string;
    salt?: string;
  },
): PaymentRequirements {
  // Convert CAIP-2 network ID to friendly name for config lookup
  const networkName = getNetworkName(requirements.network);
  const config = getNetworkConfig(networkName);

  // Preserve existing name/version from requirements.extra if they exist (from x402 official middleware)
  // Only use config values as fallback
  const existingExtra = requirements.extra || {};
  const name = (existingExtra.name as string) || config.defaultAsset.eip712.name;
  const version = (existingExtra.version as string) || config.defaultAsset.eip712.version;

  const extra: SettlementExtra = {
    // Asset EIP-712 domain info (preserve existing if available)
    name,
    version,
    // Settlement parameters
    settlementRouter: config.settlementRouter,
    salt: params.salt || generateSalt(),
    payTo: params.payTo || requirements.payTo,
    facilitatorFee: params.facilitatorFee || "0",
    hook: params.hook,
    hookData: params.hookData,
  };

  // Validate the settlement extra parameters
  assertValidSettlementExtra(extra);

  return {
    ...requirements,
    // Override payTo to point to SettlementRouter
    payTo: config.settlementRouter,
    extra: {
      ...requirements.extra,
      ...extra,
    },
  };
}
