// @ts-nocheck
// This file is for display purposes only and is not compiled
import { x402xClient } from "@x402x/client";
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
const client = new x402xClient({ facilitatorUrl });
await client.execute({
  hook: nftMintHookAddress,
  hookData,
  amount: "100000", // 0.1 token (atomic units, decimals vary by network)
  payTo: payerAddress, // ← Merchant address (USDC goes here)
});

// Result: NFT minted to payer + payment transferred to merchant
