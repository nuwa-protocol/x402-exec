// Type declarations for workspace packages that may not have generated types yet
//
// IMPORTANT:
// Do NOT declare module "@x402x/extensions" here.
// The @x402x/extensions package generates proper .d.ts and this file would shadow it,
// causing TypeScript to believe exports are missing (e.g. getSupportedNetworkIds).

declare module "@x402x/facilitator-sdk" {
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
