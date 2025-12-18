// @ts-nocheck
// This file is for display purposes only and is not compiled
import { X402Client } from "@x402x/client";
import { encodeAbiParameters } from "viem";

// 1. Configure reward distribution (simplified - no merchant field)
const hookData = encodeAbiParameters(
  [
    {
      type: "tuple",
      components: [{ name: "rewardToken", type: "address" }],
    },
  ],
  [
    {
      rewardToken: "0xRewardToken...",
    },
  ],
);

// 2. Execute payment with reward hook
const client = new X402Client({ facilitatorUrl });
await client.execute({
  hook: rewardHookAddress,
  hookData,
  amount: "100000", // 0.1 token (atomic units, decimals vary by network)
  payTo: merchantAddress, // ← Merchant receives payment
});

// Result: Payment to merchant + 1000 reward points to payer
