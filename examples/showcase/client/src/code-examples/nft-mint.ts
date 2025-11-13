// @ts-nocheck
// This file is for display purposes only and is not compiled
import { X402Client } from "@x402x/client";
import { encodeAbiParameters } from "viem";

// 1. Configure NFT mint (simplified - no merchant field)
const hookData = encodeAbiParameters(
  [
    {
      type: "tuple",
      components: [{ name: "nftContract", type: "address" }],
    },
  ],
  [
    {
      nftContract: "0xYourNFTContract...",
    },
  ],
);

// 2. Execute payment with NFT mint hook
const client = new X402Client({ facilitatorUrl });
await client.execute({
  hook: nftMintHookAddress,
  hookData,
  amount: "100000", // 0.1 USDC (6 decimals)
  payTo: merchantAddress, // ← Merchant address (USDC goes here)
});

// Result: NFT minted to payer + payment transferred to merchant
