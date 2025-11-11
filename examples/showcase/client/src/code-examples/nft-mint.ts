// @ts-nocheck
// This file is for display purposes only and is not compiled
import { X402Client } from '@x402x/client';
import { encodeAbiParameters } from 'viem';

// 1. Configure NFT mint with merchant as payer (for zero-cost demo)
const hookData = encodeAbiParameters(
  [
    { name: 'nftContract', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'merchant', type: 'address' }
  ],
  [
    '0xYourNFTContract...',
    0n,           // 0 = random mint
    payerAddress  // ← USDC returns to this address
  ]
);

// 2. Execute payment with NFT mint hook
const client = new X402Client({ facilitatorUrl });
await client.execute({
  hook: nftMintHookAddress,
  hookData,
  amount: '100000',       // 0.1 USDC (6 decimals)
  recipient: payerAddress // USDC returns here after hook
});

// Result: NFT minted to payer + USDC returned to payer
