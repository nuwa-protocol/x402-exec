/**
 * Mock x402 Core Functions
 *
 * Mock implementations of @x402x/core functions for testing
 */

import { vi } from "vitest";

/**
 * Mock isSettlementMode
 */
export const mockIsSettlementMode = vi.fn((paymentRequirements: any) => {
  return !!paymentRequirements.extra?.settlementRouter;
});

/**
 * Mock validateSettlementRouter
 */
export const mockValidateSettlementRouter = vi.fn(
  (network: string, router: string, whitelist: any) => {
    const allowed = whitelist[network] || [];
    if (!allowed.includes(router)) {
      throw new Error(`Router ${router} not in whitelist for network ${network}`);
    }
  },
);

/**
 * Mock settleWithRouter
 */
export const mockSettleWithRouter = vi.fn(async () => {
  return {
    success: true,
    transaction: "0xtxhash",
    payer: "0x1234567890123456789012345678901234567890",
    network: "base-sepolia",
  };
});

/**
 * Mock settle (standard mode)
 */
export const mockSettle = vi.fn(async () => {
  return {
    success: true,
    transaction: "0xtxhash",
    payer: "0x1234567890123456789012345678901234567890",
    network: "base-sepolia",
  };
});

/**
 * Mock verify
 */
export const mockVerify = vi.fn(async () => {
  return {
    isValid: true,
    payer: "0x1234567890123456789012345678901234567890",
  };
});
