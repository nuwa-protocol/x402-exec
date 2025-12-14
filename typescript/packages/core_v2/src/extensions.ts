/**
 * Extension helpers for x402x
 * Implements x402x-router-settlement extension for PaymentRequired.extensions
 */

/**
 * Router settlement extension info
 */
export interface RouterSettlementExtensionInfo {
  /** Schema version for the extension */
  schemaVersion: number;
  /** Optional description of the extension */
  description?: string;
}

/**
 * Router settlement extension structure
 * Location: PaymentRequired.extensions["x402x-router-settlement"]
 */
export interface RouterSettlementExtension {
  /** Extension information */
  info: RouterSettlementExtensionInfo;
  /** Optional JSON schema for validation */
  schema?: Record<string, unknown>;
}

/**
 * Create x402x-router-settlement extension declaration
 * 
 * This extension informs clients that the server supports router settlement functionality.
 * Clients MUST echo extensions in their payment payload.
 * 
 * @param params - Extension parameters
 * @param params.description - Optional description of the extension
 * @param params.schema - Optional JSON schema for validation
 * @returns Extension object for PaymentRequired.extensions["x402x-router-settlement"]
 * 
 * @example
 * ```typescript
 * const extension = createRouterSettlementExtension({
 *   description: "Settlement router with atomic fee distribution"
 * });
 * 
 * const paymentRequired = {
 *   x402Version: 2,
 *   resource: { url: "/api/payment", ... },
 *   accepts: [...],
 *   extensions: {
 *     "x402x-router-settlement": extension
 *   }
 * };
 * ```
 */
export function createRouterSettlementExtension(
  params?: {
    description?: string;
    schema?: Record<string, unknown>;
  }
): RouterSettlementExtension {
  return {
    info: {
      schemaVersion: 1,
      description: params?.description,
    },
    schema: params?.schema,
  };
}

/**
 * Get the extension key for router settlement
 * 
 * @returns The extension key "x402x-router-settlement"
 */
export function getRouterSettlementExtensionKey(): string {
  return "x402x-router-settlement";
}
