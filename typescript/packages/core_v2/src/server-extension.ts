/**
 * x402x Router Settlement Server Extension
 * 
 * Implements ResourceServerExtension interface to integrate router settlement
 * functionality into x402 v2 resource servers.
 */

import type { ResourceServerExtension } from "@x402/core/types";
import type { x402ResourceServer } from "@x402/core/server";
import { getRouterSettlementExtensionKey, createRouterSettlementExtension } from "./extensions.js";

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
function isHTTPRequestContext(ctx: unknown): ctx is { method?: string; adapter?: string } {
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
  };
  schema?: Record<string, unknown>;
}

/**
 * x402x Router Settlement ResourceServerExtension
 * 
 * This extension enriches PaymentRequired responses with router settlement
 * information, enabling clients to use the SettlementRouter for atomic payments.
 * 
 * @example
 * ```typescript
 * import { x402ResourceServer } from "@x402/core/server";
 * import { routerSettlementServerExtension } from "@x402x/core_v2";
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

    // Basic enrichment - ensure proper structure
    const enriched: RouterSettlementDeclaration = {
      ...extension,
      info: {
        schemaVersion: 1,
        ...(extension.info || {}),
      },
    };

    // If HTTP context is available, we could add additional metadata
    if (isHTTPRequestContext(transportContext)) {
      // Future: could add HTTP-specific metadata here
      // For now, just pass through
    }

    return enriched;
  },
};

/**
 * Register router settlement extension with an x402ResourceServer
 * 
 * Convenience function to register the routerSettlementServerExtension.
 * 
 * @param server - x402ResourceServer instance
 * @returns The server instance for chaining
 * 
 * @example
 * ```typescript
 * import { x402ResourceServer } from "@x402/core/server";
 * import { registerExactEvmScheme } from "@x402/evm/exact/server/register";
 * import { registerRouterSettlement } from "@x402x/core_v2";
 * 
 * const server = new x402ResourceServer(facilitatorClient);
 * registerExactEvmScheme(server, {});
 * registerRouterSettlement(server);
 * ```
 */
export function registerRouterSettlement(server: x402ResourceServer): x402ResourceServer {
  return server.registerExtension(routerSettlementServerExtension);
}

/**
 * Create extension declaration for routes
 * 
 * Helper function to create properly formatted extension declarations
 * for use in route configurations.
 * 
 * @param params - Extension parameters
 * @returns Extension declaration object
 * 
 * @example
 * ```typescript
 * const routes = {
 *   "GET /api/data": {
 *     accepts: { scheme: "exact", price: "$0.01", network: "eip155:84532", payTo: "0x..." },
 *     extensions: {
 *       ...createExtensionDeclaration({ description: "Router settlement enabled" })
 *     }
 *   }
 * };
 * ```
 */
export function createExtensionDeclaration(params?: {
  description?: string;
  schema?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    [ROUTER_SETTLEMENT_KEY]: createRouterSettlementExtension(params),
  };
}

