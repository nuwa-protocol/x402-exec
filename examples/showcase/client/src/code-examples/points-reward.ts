// @ts-nocheck
// This file is for display purposes only and is not compiled
import { X402Client } from '@x402x/client';
import { encodeAbiParameters } from 'viem';

// 1. Configure reward distribution with merchant as payer
const hookData = encodeAbiParameters(
  [
    { name: 'rewardToken', type: 'address' },
    { name: 'merchant', type: 'address' }
  ],
  [
    '0xRewardToken...',
    payerAddress  // ← USDC returns to this address
  ]
);

// 2. Execute payment with reward hook
const client = new X402Client({ facilitatorUrl });
await client.execute({
  hook: rewardHookAddress,
  hookData,
  amount: '100000',       // 0.1 USDC (6 decimals)
  recipient: payerAddress // USDC returns here after hook
});

// Result: Reward points sent to payer + USDC returned to payer
