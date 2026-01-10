/**
 * Test Fixtures
 *
 * Common test data and factory functions for creating test objects
 */

import type { PaymentRequirements, PaymentPayload, Signer } from "x402/types";
import { vi } from "vitest";

/**
 * Create a mock EVM signer
 *
 * @param address
 */
export function createMockEvmSigner(
  address = "0x1234567890123456789012345678901234567890",
): Signer {
  return {
    account: {
      address,
    },
    signMessage: vi.fn(),
    signTransaction: vi.fn(),
    sendTransaction: vi.fn(),
  } as any;
}

/**
 * Create mock payment requirements (standard mode, v2)
 *
 * @param overrides
 */
export function createMockPaymentRequirements(
  overrides?: Partial<PaymentRequirements>,
): PaymentRequirements {
  return {
    x402Version: 2,
    scheme: "exact",
    network: "eip155:84532",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    receiver: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    maxAmountRequired: "1000000",
    extra: {},
    ...overrides,
  };
}

/**
 * Create mock payment requirements (settlement router mode, v2)
 *
 * @param overrides
 */
export function createMockSettlementRouterPaymentRequirements(
  overrides?: Partial<PaymentRequirements>,
): PaymentRequirements {
  const base: PaymentRequirements = {
    x402Version: 2,
    scheme: "exact",
    network: "eip155:84532",
    asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    receiver: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    maxAmountRequired: "1000000",
    extra: {
      settlementRouter: "0x32431D4511e061F1133520461B07eC42afF157D6",
      hook: "0x0000000000000000000000000000000000000000",
      hookData: "0x",
      payTo: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      facilitatorFee: "0",
      salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
    },
  };

  // Deep merge extra if provided in overrides
  if (overrides?.extra) {
    return {
      ...base,
      ...overrides,
      extra: {
        ...base.extra,
        ...overrides.extra,
      },
    };
  }

  return {
    ...base,
    ...overrides,
  };
}

/**
 * Create mock payment payload (v2)
 *
 * @param overrides
 */
export function createMockPaymentPayload(overrides?: Partial<PaymentPayload>): PaymentPayload {
  return {
    x402Version: 2,
    scheme: "exact",
    network: "eip155:84532",
    resource: "/api/example",
    payload: {
      authorization: {
        from: "0x1234567890123456789012345678901234567890",
        to: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        value: "1000000",
        validAfter: 0,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        nonce: "0x0000000000000000000000000000000000000000000000000000000000000001",
      },
      signature: {
        v: 27,
        r: "0x1234567890123456789012345678901234567890123456789012345678901234",
        s: "0x1234567890123456789012345678901234567890123456789012345678901234",
      },
    },
    ...overrides,
  };
}

/**
 * Create a mock cache interface
 */
export function createMockCache() {
  const storage = new Map<string, { value: any; ttl: number }>();

  return {
    get: vi.fn((key: string) => {
      const item = storage.get(key);
      if (!item) return undefined;
      if (Date.now() > item.ttl) {
        storage.delete(key);
        return undefined;
      }
      return item.value;
    }),
    set: vi.fn((key: string, value: any, ttl: number) => {
      storage.set(key, { value, ttl: Date.now() + ttl * 1000 });
      return true;
    }),
    del: vi.fn((key: string) => {
      storage.delete(key);
      return 1;
    }),
    flush: vi.fn(() => {
      storage.clear();
    }),
    getStats: vi.fn(() => ({
      keys: storage.size,
      hits: 0,
      misses: 0,
      ksize: storage.size,
      vsize: 0,
    })),
  };
}

/**
 * Wait for a specified number of milliseconds
 *
 * @param ms
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Mock environment variables
 *
 * @param vars
 */
export function mockEnv(vars: Record<string, string>): () => void {
  const original = { ...process.env };

  Object.entries(vars).forEach(([key, value]) => {
    process.env[key] = value;
  });

  return () => {
    process.env = original;
  };
}
