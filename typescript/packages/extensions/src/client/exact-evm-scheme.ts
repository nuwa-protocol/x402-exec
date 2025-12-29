/**
 * x402x EVM Client Scheme with Router Settlement
 *
 * This scheme extends the standard EVM exact scheme to support x402x router settlement.
 * The key difference is using a commitment hash (binding all settlement parameters)
 * as the EIP-3009 nonce instead of a random value.
 */

import type { PaymentPayload, PaymentRequirements, SchemeNetworkClient } from "@x402/core/types";
import { getAddress, type Hex } from "viem";

import { calculateCommitment } from "../commitment.js";
import { ROUTER_SETTLEMENT_KEY } from "../server-extension.js";
import type { CommitmentParams } from "../types.js";

/**
 * Client EVM signer interface
 * Compatible with viem WalletClient and LocalAccount
 */
export type ClientEvmSigner = {
  readonly address: `0x${string}`;
  signTypedData(message: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<`0x${string}`>;
};

/**
 * EIP-3009 TransferWithAuthorization types for EIP-712 signing
 */
const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/**
 * EVM exact payment payload structure (v2)
 */
interface ExactEvmPayloadV2 {
  authorization: {
    from: string;
    to: string;
    value: string;
    validAfter: string;
    validBefore: string;
    nonce: Hex;
  };
  signature: `0x${string}`;
}

/**
 * x402x router settlement extension info structure
 */
interface RouterSettlementExtension {
  info: {
    schemaVersion?: number;
    description?: string;
    salt: string; // bytes32 hex
    settlementRouter?: string; // address
    hook?: string; // address
    hookData?: string; // bytes hex
    finalPayTo?: string; // address
    facilitatorFee?: string; // uint256 string
  };
  schema?: Record<string, unknown>;
}

/**
 * EVM client implementation for the Exact payment scheme with x402x router settlement.
 *
 * This scheme uses a commitment hash as the EIP-3009 nonce to cryptographically bind
 * all settlement parameters (salt, hook, hookData, etc.) to the user's signature,
 * preventing parameter tampering attacks.
 *
 * @example
 * ```typescript
 * import { ExactEvmSchemeWithRouterSettlement } from '@x402x/extensions/client';
 * import { x402Client } from '@x402/core/client';
 *
 * const signer = { address, signTypedData }; // viem WalletClient or LocalAccount
 * const scheme = new ExactEvmSchemeWithRouterSettlement(signer);
 *
 * const client = new x402Client()
 *   .register('eip155:84532', scheme);
 * ```
 */
export class ExactEvmSchemeWithRouterSettlement implements SchemeNetworkClient {
  readonly scheme = "exact";

  /**
   * Per-request router settlement extension (typically sourced from PaymentRequired.extensions).
   *
   * IMPORTANT: We do NOT put this on `paymentRequirements.extra`, because for x402 v2 the
   * server matches paid requests by deep-equality between `paymentPayload.accepted` and the
   * server-side `accepts[]`. Mutating `accepted` will cause "No matching payment requirements".
   */
  private routerSettlementFromPaymentRequired?: RouterSettlementExtension;

  /**
   * Creates a new ExactEvmSchemeWithRouterSettlement instance.
   *
   * @param signer - The EVM signer for client operations (viem WalletClient or LocalAccount)
   */
  constructor(private readonly signer: ClientEvmSigner) {}

  /**
   * Set router-settlement extension data for the next payment payload creation.
   *
   * Intended to be called from an `x402Client.onBeforePaymentCreation` hook, which has access
   * to `paymentRequired.extensions`.
   */
  setRouterSettlementExtensionFromPaymentRequired(ext: unknown | undefined): void {
    if (!ext) {
      this.routerSettlementFromPaymentRequired = undefined;
      return;
    }
    // We keep this cast narrow and validate at use-time.
    this.routerSettlementFromPaymentRequired = ext as RouterSettlementExtension;
  }

  /**
   * Creates a payment payload for the Exact scheme with router settlement.
   *
   * This method:
   * 1. Extracts settlement parameters from PaymentRequired.extensions
   * 2. Calculates a commitment hash binding all parameters
   * 3. Uses the commitment as the EIP-3009 nonce
   * 4. Signs with settlementRouter as the 'to' address
   *
   * @param x402Version - The x402 protocol version (must be 2)
   * @param paymentRequirements - The payment requirements from the server
   * @returns Promise resolving to a payment payload
   *
   * @throws Error if x402Version is not 2
   * @throws Error if x402x-router-settlement extension is missing
   * @throws Error if required settlement parameters are missing
   */
  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "x402Version" | "payload">> {
    if (x402Version !== 2) {
      throw new Error(
        `ExactEvmSchemeWithRouterSettlement only supports x402 version 2, got: ${x402Version}`,
      );
    }

    // Extract x402x extension.
    // Prefer per-requirement extra (if a server implementation provides it),
    // otherwise use the per-request data injected from PaymentRequired.extensions.
    const routerSettlement =
      (paymentRequirements.extra?.[ROUTER_SETTLEMENT_KEY] as
        | RouterSettlementExtension
        | undefined) ?? this.routerSettlementFromPaymentRequired;

    if (!routerSettlement?.info) {
      throw new Error(
        "x402x-router-settlement extension not available for scheme signing. " +
          "Ensure the resource server includes the extension in PaymentRequired.extensions and " +
          "the client registered x402x via registerX402xScheme() (or injected the handler).",
      );
    }

    const { salt, settlementRouter, hook, hookData, finalPayTo, facilitatorFee } =
      routerSettlement.info;

    // Clear after read to avoid leaking between requests
    this.routerSettlementFromPaymentRequired = undefined;

    // Validate required parameters
    if (!salt) throw new Error("Missing required parameter: salt");
    if (!settlementRouter) throw new Error("Missing required parameter: settlementRouter");
    if (!hook) throw new Error("Missing required parameter: hook");
    if (hookData === undefined) throw new Error("Missing required parameter: hookData");
    if (!finalPayTo) throw new Error("Missing required parameter: finalPayTo");
    // facilitatorFee is optional - if not provided, use "0" (facilitator will calculate actual fee)
    const resolvedFacilitatorFee = facilitatorFee ?? "0";

    // Parse chain ID from network (e.g., "eip155:84532" -> 84532)
    const chainId = parseInt(paymentRequirements.network.split(":")[1]);
    if (isNaN(chainId)) {
      throw new Error(`Invalid network format: ${paymentRequirements.network}`);
    }

    // Calculate time window
    const now = Math.floor(Date.now() / 1000);
    const validAfter = (now - 600).toString(); // 10 minutes before
    const validBefore = (now + paymentRequirements.maxTimeoutSeconds).toString();

    // Build commitment parameters
    const commitmentParams: CommitmentParams = {
      chainId,
      hub: settlementRouter,
      asset: paymentRequirements.asset,
      from: this.signer.address,
      value: paymentRequirements.amount,
      validAfter,
      validBefore,
      salt,
      payTo: finalPayTo,
      facilitatorFee: resolvedFacilitatorFee,
      hook,
      hookData,
    };

    // Calculate commitment hash - this becomes the nonce
    const nonce = calculateCommitment(commitmentParams) as Hex;

    // Build authorization (EIP-3009)
    // CRITICAL: 'to' must be settlementRouter, not payTo
    const authorization: ExactEvmPayloadV2["authorization"] = {
      from: this.signer.address,
      to: getAddress(settlementRouter),
      value: paymentRequirements.amount,
      validAfter,
      validBefore,
      nonce,
    };

    // Sign the authorization using EIP-712
    const signature = await this.signAuthorization(authorization, paymentRequirements, chainId);

    // Build payload
    const payload: Record<string, unknown> = {
      authorization,
      signature,
    };

    return {
      x402Version,
      payload,
    };
  }

  /**
   * Sign the EIP-3009 authorization using EIP-712
   *
   * @param authorization - The authorization to sign
   * @param requirements - The payment requirements
   * @param chainId - The chain ID
   * @returns Promise resolving to the signature
   */
  private async signAuthorization(
    authorization: ExactEvmPayloadV2["authorization"],
    requirements: PaymentRequirements,
    chainId: number,
  ): Promise<`0x${string}`> {
    // Extract EIP-712 domain parameters from extra
    if (!requirements.extra?.name || !requirements.extra?.version) {
      throw new Error(
        `EIP-712 domain parameters (name, version) are required in payment requirements for asset ${requirements.asset}`,
      );
    }

    const { name, version } = requirements.extra;

    const domain = {
      name,
      version,
      chainId,
      verifyingContract: getAddress(requirements.asset),
    };

    const message = {
      from: getAddress(authorization.from),
      to: getAddress(authorization.to),
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce,
    };

    return await this.signer.signTypedData({
      domain,
      types: authorizationTypes,
      primaryType: "TransferWithAuthorization",
      message,
    });
  }
}
