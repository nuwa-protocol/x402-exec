/**
 * Client-side modules for x402x extension
 * 
 * Provides client schemes that work with the official x402 SDK
 */

export { ExactEvmSchemeWithRouterSettlement } from "./exact-evm-scheme.js";
export type { ClientEvmSigner } from "./exact-evm-scheme.js";
export { injectX402xExtensionHandler, registerX402xScheme } from "./extension-handler.js";


