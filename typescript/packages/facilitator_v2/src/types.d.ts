// Type declarations for workspace packages that may not have generated types yet
declare module '@x402x/core_v2' {
  export function toCanonicalNetworkKey(network: string): string;
  export function getNetworkName(network: string): string;
  export function getNetworkConfig(network: string): any;
  export function calculateCommitment(params: any): string;
  export function isSettlementMode(pr: any): boolean;
  export function parseSettlementExtra(extra: any): any;
  export const NETWORK_ALIASES: Record<string, string>;
}
