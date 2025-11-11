// @ts-nocheck
// This file is for display purposes only and is not compiled
import { wrapFetchWithPayment } from '@x402x/fetch';
import { useWalletClient } from 'wagmi';

// 1. Create a payment-enabled fetch wrapper
const { data: walletClient } = useWalletClient();
const fetchWithPay = wrapFetchWithPayment(
  fetch,
  walletClient,
  BigInt(1_000_000) // Max 1 USDC
);

// 2. Make request to protected endpoint
// The wrapper automatically:
// - Sends initial request
// - Detects 402 Payment Required
// - Creates payment commitment & signs
// - Retries with payment header
const response = await fetchWithPay('/api/purchase-download', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contentId: 'x402-protocol-guide',
    walletAddress: userAddress
  })
});

// 3. Server validates payment and returns content access
const { downloadUrl, fileName, expiresAt } = await response.json();
console.log(`Download ready: ${fileName}`);
window.open(downloadUrl, '_blank');

// The entire payment flow happens transparently!
