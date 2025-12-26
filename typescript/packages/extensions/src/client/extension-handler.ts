/**
 * x402x Extension Handler
 * 
 * Provides utilities to integrate x402x router settlement with official x402 SDK.
 * 
 * The challenge: x402 v2 spec places extensions at root level in PaymentRequired,
 * but x402x scheme needs settlement parameters from PaymentRequirements.extra.
 * 
 * Solution: Provide two-layer API:
 * 1. High-level: registerX402xScheme() - one line setup (recommended)
 * 2. Low-level: injectX402xExtensionHandler() - flexible configuration
 */

import { x402Client } from "@x402/core/client";
import type { Network } from "@x402/core/types";
import { ROUTER_SETTLEMENT_KEY } from "../server-extension";
import { ExactEvmSchemeWithRouterSettlement, type ClientEvmSigner } from "./exact-evm-scheme";

/**
 * Injects x402x extension handler into x402Client (Low-level API).
 *
 * IMPORTANT (x402 v2 + x402x multi-network):
 * - Server returns per-option x402x info in `accepts[i].extra["x402x-router-settlement"]`
 * - x402Client only passes `PaymentRequirements` to scheme (no root extensions)
 * - Facilitator v2 reads from `paymentPayload.extensions["x402x-router-settlement"]`
 * 
 * Solution: Copy the selected option's x402x info from `selectedRequirements.extra`
 * into `paymentRequired.extensions` so it gets included in `paymentPayload.extensions`.
 * 
 * This does NOT mutate `selectedRequirements` (which becomes `paymentPayload.accepted`),
 * so v2 deepEqual matching still works.
 * 
 * @param client - x402Client instance to inject handler into
 * @param onRouterSettlementExtension - Callback to receive the per-request extension object
 * @returns The same client instance for chaining
 * 
 * @example Low-level API (for advanced users)
 * ```typescript
 * import { x402Client } from '@x402/core/client';
 * import { 
 *   injectX402xExtensionHandler, 
 *   ExactEvmSchemeWithRouterSettlement 
 * } from '@x402x/extensions';
 * 
 * const client = new x402Client();
 * const scheme = new ExactEvmSchemeWithRouterSettlement(signer);
 * injectX402xExtensionHandler(client, (ext) => scheme.setRouterSettlementExtensionFromPaymentRequired(ext))
 *   .register('eip155:84532', scheme);
 * ```
 */
export function injectX402xExtensionHandler(
  client: x402Client,
  onRouterSettlementExtension?: (extension: unknown | undefined) => void,
): x402Client {
  return client.onBeforePaymentCreation(async (context) => {
    const { paymentRequired, selectedRequirements } = context;
    
    // Debug: show what we received
    console.log("[x402x-handler] onBeforePaymentCreation called");
    console.log("[x402x-handler] selectedRequirements.network:", selectedRequirements.network);
    console.log("[x402x-handler] selectedRequirements.extra keys:", Object.keys(selectedRequirements.extra || {}));
    
    // Key insight: Per-option x402x info is in selectedRequirements.extra[x402x-router-settlement].
    // We need to copy it into paymentRequired.extensions[x402x-router-settlement] so that:
    // 1. x402Client copies it into paymentPayload.extensions (v2 standard)
    // 2. Facilitator v2 can read it from paymentPayload.extensions
    // 3. We DON'T mutate selectedRequirements (which becomes paymentPayload.accepted)
    
    const perOptionExtension = selectedRequirements.extra?.[ROUTER_SETTLEMENT_KEY];
    
    if (perOptionExtension) {
      // Initialize extensions object if it doesn't exist
      if (!paymentRequired.extensions) {
        (paymentRequired as any).extensions = {};
      }
      
      // Copy the per-option x402x info into root extensions
      // This will be copied into paymentPayload.extensions by x402Client
      (paymentRequired.extensions as any)[ROUTER_SETTLEMENT_KEY] = perOptionExtension;
      
      console.log("[x402x-handler] ✅ Copied per-option x402x info into PaymentRequired.extensions");
      console.log("[x402x-handler] Extension info:", JSON.stringify(perOptionExtension, null, 2));
    } else {
      // Fallback: if no per-option info, use root-level extension (legacy behavior)
      console.warn("[x402x-handler] ⚠️ No per-option x402x info found in selectedRequirements.extra");
      console.warn("[x402x-handler] This may cause facilitator errors. Check server-side createSettlementRouteConfig.");
    }

    // Forward extension to callback (for schemes that need direct access)
    if (onRouterSettlementExtension) {
      const extensionToUse = perOptionExtension || paymentRequired.extensions?.[ROUTER_SETTLEMENT_KEY];
      onRouterSettlementExtension(extensionToUse);
    }
  });
}

/**
 * Register x402x router settlement scheme with automatic extension handling (High-level API).
 * 
 * This is the recommended way to set up x402x payments. It combines:
 * 1. Extension handler injection (injectX402xExtensionHandler)
 * 2. Scheme registration (ExactEvmSchemeWithRouterSettlement)
 * 
 * Use this for the simplest integration - just provide your signer and network.
 * 
 * @param client - x402Client instance
 * @param network - Network identifier in CAIP-2 format (e.g., "eip155:84532")
 * @param signer - EVM signer with address and signTypedData method
 * @returns The client instance for chaining
 * 
 * @example High-level API (recommended)
 * ```typescript
 * import { x402Client } from '@x402/core/client';
 * import { registerX402xScheme } from '@x402x/extensions';
 * import { useWalletClient } from 'wagmi';
 * 
 * const { data: walletClient } = useWalletClient();
 * 
 * const client = new x402Client();
 * registerX402xScheme(client, 'eip155:84532', {
 *   address: walletClient.account.address,
 *   signTypedData: walletClient.signTypedData,
 * });
 * 
 * // That's it! Client is ready for x402x payments
 * ```
 * 
 * @example Multiple networks
 * ```typescript
 * const client = new x402Client();
 * registerX402xScheme(client, 'eip155:84532', signer); // Base Sepolia
 * registerX402xScheme(client, 'eip155:8453', signer);  // Base Mainnet
 * ```
 */
export function registerX402xScheme(
  client: x402Client,
  network: Network,
  signer: ClientEvmSigner,
): x402Client {
  const scheme = new ExactEvmSchemeWithRouterSettlement(signer);

  // Inject extension handler: capture root-level extension data (incl. dynamic salt)
  // and pass it into the scheme instance without mutating `accepted`.
  injectX402xExtensionHandler(client, (ext) => {
    // Scope to this specific network to avoid cross-network leakage if user registers multiple.
    // (We don't have direct access to `selectedRequirements` here without mutating accepted,
    // so we keep it simple: this scheme instance is per-network registration.)
    scheme.setRouterSettlementExtensionFromPaymentRequired(ext);
  });

  // Register the x402x scheme for this network
  client.register(network, scheme);
  
  return client;
}

