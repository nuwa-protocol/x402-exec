// Type declarations for workspace packages that may not have generated types yet
declare module '@x402x/core_v2' {
  export function toCanonicalNetworkKey(network: string): string;
  export function getNetworkName(network: string): string;
  export const NETWORK_ALIASES: Record<string, string>;
}

declare module '@x402x/facilitator_v2' {
  export function createRouterSettlementFacilitator(config: any): any;
}