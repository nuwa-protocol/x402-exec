/**
 * @x402x/fetch_v2 - Wraps official @x402/fetch with router-settlement exact-EVM client scheme
 *
 * This package wraps the official @x402/fetch v2 and registers a custom exact-EVM
 * SchemeNetworkClient that supports router settlement (commitment + EIP-712) while
 * delegating to official behavior for standard requests.
 */

import type { Hex } from "viem";
import { getAddress, toHex } from "viem";
import type { PaymentRequirements, PaymentPayload, SchemeNetworkClient } from "@x402/core/types";
import {
  wrapFetchWithPayment as officialWrapFetchWithPayment,
  x402Client,
  type PaymentPolicy,
} from "@x402/fetch";
import { ExactEvmScheme, type ClientEvmSigner } from "@x402/evm";
import { calculateCommitment, getNetworkConfig, getNetworkName } from "@x402x/core_v2";

/**
 * EIP-3009 authorization types for EIP-712 signature
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
};

/**
 * Check if payment requirements use settlement router mode (x402x extension)
 */
function isSettlementMode(requirements: PaymentRequirements): boolean {
  return !!(requirements.extra as any)?.settlementRouter;
}

/**
 * Create random nonce (standard x402 behavior)
 */
function createNonce(): Hex {
  const cryptoObj =
    typeof globalThis.crypto !== "undefined" ? globalThis.crypto : (globalThis as any).crypto;
  if (!cryptoObj) {
    throw new Error("Crypto API not available");
  }
  return toHex(cryptoObj.getRandomValues(new Uint8Array(32)));
}

/**
 * Custom Exact EVM Scheme with Router Settlement support
 *
 * This scheme extends the official ExactEvmScheme to support x402x router settlement.
 * When requirements.extra.settlementRouter is present, it uses commitment-based nonce
 * and includes settlement parameters. Otherwise, it delegates to the official scheme.
 */
export class ExactEvmSchemeWithRouterSettlement implements SchemeNetworkClient {
  private readonly signer: ClientEvmSigner;
  private readonly officialScheme: ExactEvmScheme;
  readonly scheme = "exact";

  /**
   * Creates a new ExactEvmSchemeWithRouterSettlement instance.
   *
   * @param signer - The EVM signer for client operations
   */
  constructor(signer: ClientEvmSigner) {
    this.signer = signer;
    this.officialScheme = new ExactEvmScheme(signer);
  }

  /**
   * Creates a payment payload for the Exact scheme.
   *
   * If requirements.extra.settlementRouter is present, uses commitment-based nonce
   * for router settlement. Otherwise delegates to official ExactEvmScheme.
   *
   * @param x402Version - The x402 protocol version
   * @param paymentRequirements - The payment requirements (may include extensions)
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
  ): Promise<Pick<PaymentPayload, "x402Version" | "payload">> {
    // Check if settlement router mode
    if (!isSettlementMode(paymentRequirements)) {
      // Delegate to official scheme for standard behavior
      return this.officialScheme.createPaymentPayload(x402Version, paymentRequirements);
    }

    // Settlement router mode: use commitment-based nonce
    const extra = paymentRequirements.extra as any;
    // Convert CAIP-2 network format to network name for getNetworkConfig
    const networkName = getNetworkName(paymentRequirements.network as any);
    const networkConfig = getNetworkConfig(networkName);
    // Extract numeric chainId from CAIP-2 format (e.g., "eip155:84532" -> 84532)
    const chainId = parseInt(paymentRequirements.network.split(":")[1]);
    const from = this.signer.address;

    const now = Math.floor(Date.now() / 1000);
    const validAfter = (now - 600).toString(); // 10 minutes before
    const validBefore = (now + paymentRequirements.maxTimeoutSeconds).toString();

    // Calculate commitment as nonce (binds all settlement parameters)
    const nonce = calculateCommitment({
      chainId: chainId,
      hub: extra.settlementRouter,
      asset: paymentRequirements.asset,
      from,
      value: paymentRequirements.amount,
      validAfter,
      validBefore,
      salt: extra.salt,
      payTo: extra.payTo,
      facilitatorFee: extra.facilitatorFee || "0",
      hook: extra.hook,
      hookData: extra.hookData,
    }) as Hex;

    // Sign EIP-712 authorization with commitment as nonce
    const signature = await this.signAuthorization(
      {
        from,
        to: getAddress(paymentRequirements.payTo),
        value: paymentRequirements.amount,
        validAfter,
        validBefore,
        nonce,
      },
      paymentRequirements,
    );

    // Create payload with authorization and signature
    const payload = {
      authorization: {
        from,
        to: paymentRequirements.payTo,
        value: paymentRequirements.amount,
        validAfter,
        validBefore,
        nonce,
      },
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
   * @param requirements - The payment requirements (includes EIP-712 domain info)
   * @returns Promise resolving to the signature
   */
  private async signAuthorization(
    authorization: {
      from: string;
      to: string;
      value: string;
      validAfter: string;
      validBefore: string;
      nonce: Hex;
    },
    requirements: PaymentRequirements,
  ): Promise<Hex> {
    const chainId = parseInt(requirements.network.split(":")[1]);

    if (!requirements.extra?.name || !requirements.extra?.version) {
      throw new Error(
        `EIP-712 domain parameters (name, version) are required in payment requirements for asset ${requirements.asset}`,
      );
    }

    const { name, version } = requirements.extra;
    const domain = {
      name,
      version,
      chainId: parseInt(requirements.network.split(":")[1]),
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

/**
 * Enables the payment of APIs using the x402 payment protocol with x402x settlement support.
 *
 * This function wraps the official @x402/fetch wrapFetchWithPayment with a custom scheme
 * that supports router settlement (commitment-based nonce + EIP-712). It automatically
 * detects when requirements.extra.settlementRouter is present and uses the appropriate mode.
 *
 * @param fetch - The fetch function to wrap (typically globalThis.fetch)
 * @param signer - The EVM signer for client operations
 * @param network - The network to use (CAIP-2 format, e.g., "eip155:84532")
 * @param policy - Optional payment policy for controlling payment behavior
 * @returns A wrapped fetch function that handles 402 responses automatically
 *
 * @example
 * ```typescript
 * import { wrapFetchWithPayment } from '@x402x/fetch_v2';
 * import { createWalletClient, custom } from 'viem';
 * import { baseSepolia } from 'viem/chains';
 *
 * const walletClient = createWalletClient({
 *   chain: baseSepolia,
 *   transport: custom(window.ethereum),
 * });
 *
 * const fetchWithPay = wrapFetchWithPayment(
 *   fetch,
 *   walletClient,
 *   'eip155:84532'
 * );
 *
 * const response = await fetchWithPay('/api/protected-resource');
 * ```
 *
 * @throws {Error} If the payment amount exceeds the maximum allowed value
 * @throws {Error} If there's an error creating the payment header
 */
export function wrapFetchWithPayment(
  fetch: typeof globalThis.fetch,
  signer: ClientEvmSigner,
  network: string,
  policy?: PaymentPolicy,
) {
  // Create custom scheme with router settlement support
  const customScheme = new ExactEvmSchemeWithRouterSettlement(signer);

  // Create x402Client with custom scheme
  const client = new x402Client(policy).register(network, customScheme);

  // Use official wrapFetchWithPayment with our custom client
  return officialWrapFetchWithPayment(fetch, client);
}

/**
 * Re-export official types and utilities for convenience
 */
export { x402Client, type PaymentPolicy } from "@x402/fetch";
export type { ClientEvmSigner } from "@x402/evm";
export type { PaymentRequirements, PaymentPayload, Network } from "@x402/core/types";
export type { Hex } from "viem";
