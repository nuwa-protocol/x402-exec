// Central configuration for the $X402X token mint.
// Update this file to change contract addresses, ABIs and sale parameters.

export type ContractAbi = readonly unknown[];

import { base } from "@reown/appkit/networks";

// Network used for the token mint – today we only support Base testnet.
export const TOKEN_MINT_NETWORK = "base" as const;

export const X402X_TOKEN_CONFIG = {
  // Display / metadata
  symbol: "X402X",
  name: "X402X Token",
  decimals: 18,

  // Supply & allocation (in full tokens, not atomic units)
  totalSupplyTokens: 1_000_000_000,
  // Portion of the total supply allocated to this initial mint event
  mintAllocationTokens: 100_000_000, // 10% of total supply

  // ERC20 token contract for $X402X
  address: "0x6929F5eC638b2b9eb42073A4bDfBEF202A4DC4C4" as `0x${string}`,
} as const;

export const X402X_MINT_CONFIG = {
  // Mint / hook contract that receives USDC and mints $X402X (used as x402x hook).
  address: "0x261b0716cE47C0eB3DB15F2e134F9cdADE00ca80" as `0x${string}`,

  // Unix timestamp (in seconds) when the initial mint is scheduled to end.
  // Fixed at Dec-05-2025 05:08:55 AM +UTC (Dec-04-2025 05:08:55 AM +UTC + 24 hours).
  mintEndTimestamp: 1_764_911_335,

  // Bonding curve parameters (front-end only; keep in sync with contract).
  // P0: starting price (in USDC per token, human-readable).
  //     Contract default ≈ 0.00007775486736425522 USDC.
  // K: curvature/scale factor for the bonding curve.
  //     Contract default ≈ 3.65280641579468.
  p0: 0.00007775486736425522,
  k: 3.65280641579468,
  chain: base,
} as const;

// Finalization configuration for the initial mint.
// All numbers and external links related to the concluded mint live here.
export const X402X_MINT_FINALIZATION_CONFIG = {
  // Total unsold tokens from the initial allocation that will be burned.
  unsoldTokens: 14_100_000,
  unaddedLPTokens: 4_178_524,

  // Primary liquidity pool configuration for $X402X.
  // lpUrl should point to the canonical LP page (e.g. on a DEX UI), while
  // lpAddress is the on-chain address of the LP token/position (if applicable).
  // TODO: Update these to the actual LP URL/address when deployed.
  lpUrl: "https://app.uniswap.org/explore/pools/base/0xeBbC33a81A619F6153a87F4AeeF685F28975c45C",
  lpAddress: "0xeBbC33a81A619F6153a87F4AeeF685F28975c45C",

  // Transaction hashes for each finalization step (to be filled post-execution).
  // These are surfaced in the UI so users can independently verify each action
  // on the block explorer.
  // 1) Mint hook is permanently closed in the contracts (no separate tx needed).
  // 2) Burning all unsold tokens from the initial allocation.
  mintTokenBurnTx: "0x171a4ae17df2c3e200de6089e175272bdd5d507a9e15ae950741dbc4bfeb5d98",
  // 3) Burning all additional tokens that are not added to the liquidity pool.
  lpTokenBurnTx: "0x5e43285a824f8d7495fb99d7d024df5a51961c283366a158deef04f193948183",
  // 4) Creating / seeding the primary liquidity pool.
  lpCreateTx: "0xd9b38bf9eb76bd72ee001afd894b124133fba3c89f7aa4dd0f22a0abafbc2f76",
} as const;
