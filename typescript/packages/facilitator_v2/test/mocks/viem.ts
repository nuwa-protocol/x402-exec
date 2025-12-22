/**
 * Viem client mocks for testing
 */

import { vi } from "vitest";

// Mock addresses for testing
export const MOCK_ADDRESSES = {
  payer: "0x1234567890123456789012345678901234567890",
  facilitator: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  merchant: "0xfedcbafedcbafedcbafedcbafedcbafedcbafedc",
  settlementRouter: "0x1111111111111111111111111111111111111111",
  hook: "0x2222222222222222222222222222222222222222",
  token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base Sepolia
} as const;

// Mock values for testing
export const MOCK_VALUES = {
  usdcBalance: "1000000000", // 1000 USDC (6 decimals)
  ethBalance: "1000000000000000000", // 1 ETH
  paymentAmount: "1000000", // 1 USDC
  facilitatorFee: "0x186A0", // 0.1 USDC in hex (100000)
  salt: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  nonce: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
  signature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  hookData: "0x",
  validAfter: "0x64", // Current timestamp + 100
  validBefore: "0xFFFFFFFFFFFFFFFF",
} as const;

// Mock transaction receipt
export const mockTransactionReceipt = {
  status: "success" as const,
  blockNumber: 12345678n,
  gasUsed: 250000n,
  effectiveGasPrice: 1000000000n,
};

// Mock network config
export const mockNetworkConfig = {
  chainId: 84532,
  name: "base-sepolia",
  type: "testnet" as const,
  addressExplorerBaseUrl: "https://sepolia.basescan.org/address",
  txExplorerBaseUrl: "https://sepolia.basescan.org/tx",
  settlementRouter: MOCK_ADDRESSES.settlementRouter,
  defaultAsset: {
    address: MOCK_ADDRESSES.token,
    decimals: 6,
    eip712: {
      name: "USD Coin",
      version: "3",
    },
  },
  hooks: {
    transfer: MOCK_ADDRESSES.hook,
  },
};

// Mock payment requirements with SettlementRouter
export const mockPaymentRequirements = {
  scheme: "exact",
  network: "eip155:84532",
  maxAmountRequired: MOCK_VALUES.paymentAmount,
  amount: MOCK_VALUES.paymentAmount,
  asset: MOCK_ADDRESSES.token,
  payTo: MOCK_ADDRESSES.settlementRouter,
  maxTimeoutSeconds: 3600,
  extra: {
    settlementRouter: MOCK_ADDRESSES.settlementRouter,
    salt: MOCK_VALUES.salt,
    payTo: MOCK_ADDRESSES.merchant,
    facilitatorFee: MOCK_VALUES.facilitatorFee,
    hook: MOCK_ADDRESSES.hook,
    hookData: MOCK_VALUES.hookData,
    name: "USD Coin",
    version: "3",
  },
};

// Mock payment payload
export const mockPaymentPayload = {
  scheme: "exact",
  network: "eip155:84532",
  payer: MOCK_ADDRESSES.payer,
  nonce: MOCK_VALUES.nonce,
  signature: MOCK_VALUES.signature,
  validAfter: MOCK_VALUES.validAfter,
  validBefore: MOCK_VALUES.validBefore,
};

// Mock successful settlement response
export const mockSettleResponse = {
  success: true,
  transaction: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  network: "eip155:84532",
  payer: MOCK_ADDRESSES.payer,
};

// Mock verification response
export const mockVerifyResponse = {
  isValid: true,
  payer: MOCK_ADDRESSES.payer,
};

// Mock viem public client
export const mockPublicClient = {
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn().mockResolvedValue(mockTransactionReceipt),
  getBalance: vi.fn().mockResolvedValue(BigInt(MOCK_VALUES.ethBalance)),
};

// Mock viem wallet client
export const mockWalletClient = {
  writeContract: vi.fn().mockResolvedValue(mockSettleResponse.transaction as `0x${string}`),
  account: {
    address: MOCK_ADDRESSES.facilitator,
    type: "wallet",
  },
};

// Mock viem createPublicClient
export const mockCreatePublicClient = vi.fn(() => mockPublicClient);

// Mock viem createWalletClient
export const mockCreateWalletClient = vi.fn(() => mockWalletClient);

// Mock ERC-6492 signature parser
export const mockParseErc6492Signature = vi.fn((signature: string) => ({
  signature,
  address: "0x0000000000000000000000000000000000000000",
  data: "0x",
}));

// Setup viem mocks with signature verification
export function setupViemMocks() {
  // Note: viem.mock is already called at module level in individual test files
  // This function now just resets mock states
  mockCreatePublicClient.mockClear();
  mockCreateWalletClient.mockClear();
  mockParseErc6492Signature.mockClear();
}

// Reset all mocks
export function resetAllMocks() {
  vi.clearAllMocks();
  mockCreatePublicClient.mockClear();
  mockCreateWalletClient.mockClear();
  mockParseErc6492Signature.mockClear();
  mockPublicClient.readContract.mockReset();
  mockPublicClient.waitForTransactionReceipt.mockClear();
  mockPublicClient.getBalance.mockClear();
  mockWalletClient.writeContract.mockClear();

  // Reset readContract to default behavior - will be configured per test
  mockPublicClient.readContract.mockReset();
}