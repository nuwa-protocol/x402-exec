/**
 * Shared test fixtures and mock data for x402x core tests
 */

export const mockAddresses = {
  hub: "0x1234567890123456789012345678901234567890",
  asset: "0x2234567890123456789012345678901234567890",
  from: "0x3234567890123456789012345678901234567890",
  payTo: "0x4234567890123456789012345678901234567890",
  hook: "0x5234567890123456789012345678901234567890",
};

export const mockCommitmentParams = {
  chainId: 84532,
  ...mockAddresses,
  value: "100000",
  validAfter: "0",
  validBefore: "1234567890",
  salt: "0x" + "0".repeat(64),
  facilitatorFee: "10000",
  hookData: "0x",
};

export const invalidAddresses = {
  tooShort: "0x1234",
  noPrefix: "1234567890123456789012345678901234567890",
  invalidChars: "0xZZZZ567890123456789012345678901234567890",
  wrongLength: "0x12345678901234567890123456789012345678",
};
