// @ts-nocheck
// This file is for display purposes only and is not compiled
import { x402xClient } from "@x402x/client";
import { TransferHook } from "@x402x/core";

// 1. Define split configuration
const splits = [
  { recipient: "0xAlice...", bips: 3000 }, // 30%
  { recipient: "0xBob...", bips: 2000 }, // 20%
  // Remainder (50%) goes to primary recipient
];

// 2. Encode split data for TransferHook
const hookData = TransferHook.encode(splits);

// 3. Execute split payment
const client = new x402xClient({ facilitatorUrl });
await client.execute({
  hook: TransferHook.address,
  hookData,
  amount: "100000", // 0.1 token (atomic units, decimals vary by network)
  payTo: primaryRecipient, // Receives remainder (50%)
});

// Result: Funds distributed atomically to all recipients
