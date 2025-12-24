// Type declarations for workspace packages that may not have generated types yet
declare module "@x402x/core_v2" {
  export function toCanonicalNetworkKey(network: string): string;
  export function getNetworkName(network: string): string;
  export function getNetworkConfig(network: string): any;
  export function calculateCommitment(params: any): string;
  export function isSettlementMode(pr: any): boolean;
  export function parseSettlementExtra(extra: any): any;
  export const NETWORK_ALIASES: Record<string, string>;

  // V2 PaymentRequirements from @x402/core/types
  // Using 'any' to avoid complex type definition that may not match exactly
  export type PaymentRequirements = any;
}

declare module "@x402x/facilitator_v2" {
  export type RouterSettlementFacilitator = {
    scheme: string;
    caipFamily: string;
    verify(
      payload: any,
      requirements: any,
    ): Promise<{
      isValid: boolean;
      invalidReason?: string;
      payer?: string;
    }>;
    settle(
      payload: any,
      requirements: any,
    ): Promise<{
      success: boolean;
      transaction: string;
      network: string;
      payer: string;
      errorReason?: string;
    }>;
  };

  export function createRouterSettlementFacilitator(config: any): RouterSettlementFacilitator;
}
