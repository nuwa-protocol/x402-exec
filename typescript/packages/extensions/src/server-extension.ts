/**
 * x402x Router Settlement Server Extension
 * 
 * Implements ResourceServerExtension interface to integrate router settlement
 * functionality into x402 v2 resource servers.
 */

import type { ResourceServerExtension } from "@x402/core/types";
import type { x402ResourceServer } from "@x402/core/server";
import { createRouterSettlementExtension } from "./extensions.js";
import { generateSalt } from "./commitment.js";

/**
 * Extension key constant
 */
export const ROUTER_SETTLEMENT_KEY = "x402x-router-settlement";

/**
 * Type guard to check if context is an HTTP request context.
 * 
 * @param ctx - The context to check
 * @returns True if context is an HTTPRequestContext
 */
function isHTTPRequestContext(ctx: unknown): ctx is { method?: string; adapter?: unknown } {
  return ctx !== null && typeof ctx === "object" && "method" in ctx;
}

/**
 * Router settlement extension declaration type
 */
interface RouterSettlementDeclaration {
  [key: string]: unknown;
  info?: {
    [key: string]: unknown;
    schemaVersion?: number;
    description?: string;
    /** Dynamic fields that need to be generated per-request */
    dynamic?: {
      salt?: boolean;
      [key: string]: unknown;
    };
  };
  schema?: Record<string, unknown>;
}

/**
 * x402x Router Settlement ResourceServerExtension
 * 
 * This extension enriches PaymentRequired responses with router settlement
 * information, enabling clients to use the SettlementRouter for atomic payments.
 * 
 * The extension dynamically generates per-request values like salt to ensure
 * each payment authorization is unique and cannot be replayed.
 * 
 * @example
 * ```typescript
 * import { x402ResourceServer } from "@x402/core/server";
 * import { routerSettlementServerExtension } from "@x402x/extensions";
 * 
 * const server = new x402ResourceServer(facilitatorClient);
 * server.registerExtension(routerSettlementServerExtension);
 * ```
 */
export const routerSettlementServerExtension: ResourceServerExtension = {
  key: ROUTER_SETTLEMENT_KEY,

  enrichDeclaration: (declaration, transportContext) => {
    // Cast to typed declaration
    const extension = declaration as RouterSettlementDeclaration;

    // Generate dynamic salt for this request
    const salt = generateSalt();

    // Basic enrichment - ensure proper structure with dynamic salt
    const enriched: RouterSettlementDeclaration = {
      ...extension,
      info: {
        schemaVersion: 1,
        ...(extension.info || {}),
        // Add the generated salt to the info
        salt,
      },
    };

    // If HTTP context is available, we could add additional metadata
    if (isHTTPRequestContext(transportContext)) {
      // Future: could add HTTP-specific metadata here
      // For now, the salt generation is the main dynamic enhancement
    }

    return enriched;
  },
};

/**
 * Register router settlement extension with an x402ResourceServer
 * 
 * Convenience function to register the routerSettlementServerExtension.
 * Also registers necessary hooks for handling settlement parameters.
 * 
 * @param server - x402ResourceServer instance
 * @returns The server instance for chaining
 * 
 * @example
 * ```typescript
 * import { x402ResourceServer } from "@x402/core/server";
 * import { registerExactEvmScheme } from "@x402/evm/exact/server/register";
 * import { registerRouterSettlement } from "@x402x/extensions";
 * 
 * const server = new x402ResourceServer(facilitatorClient);
 * registerExactEvmScheme(server, {});
 * registerRouterSettlement(server);
 * ```
 */
export function registerRouterSettlement(server: x402ResourceServer): x402ResourceServer {
  // Register the extension for enriching PaymentRequired responses
  server.registerExtension(routerSettlementServerExtension);
  
  // Note: Hooks for verify/settle are registered separately via 
  // registerSettlementHooks if needed for custom validation logic
  
  return server;
}

/**
 * Create extension declaration for routes
 * 
 * Helper function to create properly formatted extension declarations
 * for use in route configurations. The extension enables dynamic salt
 * generation per request and includes all settlement parameters.
 * 
 * @param params - Extension parameters including settlement info
 * @returns Extension declaration object
 * 
 * @example
 * ```typescript
 * const routes = {
 *   "GET /api/data": {
 *     accepts: { scheme: "exact", price: "$0.01", network: "eip155:84532", payTo: "0x..." },
 *     extensions: createExtensionDeclaration({ 
 *       description: "Router settlement with dynamic salt",
 *       settlementRouter: "0x...",
 *       hook: "0x...",
 *       hookData: "0x",
 *       finalPayTo: "0x...",
 *       facilitatorFee: "0",
 *       salt: "0x..." // Optional, will be auto-generated if not provided
 *     })
 *   }
 * };
 * ```
 */
export function createExtensionDeclaration(params?: {
  description?: string;
  schema?: Record<string, unknown>;
  settlementRouter?: string;
  hook?: string;
  hookData?: string;
  finalPayTo?: string;
  facilitatorFee?: string;
  salt?: string; // Optional salt, will be auto-generated if not provided
}): Record<string, unknown> {
  return {
    [ROUTER_SETTLEMENT_KEY]: createRouterSettlementExtension(params),
  };
}

