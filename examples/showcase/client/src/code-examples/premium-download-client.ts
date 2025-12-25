// @ts-nocheck
// This file is for display purposes only and is not compiled

// 1. Make initial request to protected endpoint
const response = await fetch("/api/purchase-download", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    contentId: "x402-whitepaper",
    walletAddress: userAddress,
  }),
});

// 2. Server returns 402 Payment Required with x402 v2 + x402x extension
if (response.status === 402) {
  const paymentRequired = await response.json();
  // paymentRequired.x402Version === 2
  // paymentRequired.accepts[0] contains payment requirements
  // paymentRequired.extensions["x402x-router-settlement"] contains salt

  // 3. Extract payment parameters
  const paymentReq = paymentRequired.accepts[0];
  const salt = paymentRequired.extensions["x402x-router-settlement"].info.salt;
  const { settlementRouter, hook, hookData, payTo } = paymentReq.extra;

  // 4. Calculate commitment (nonce = hash of all settlement params)
  const nonce = calculateCommitment({
    chainId, hub: settlementRouter, asset, from,
    value, validAfter, validBefore, salt,
    payTo, facilitatorFee, hook, hookData,
  });

  // 5. Sign EIP-3009 authorization with commitment as nonce
  const signature = await walletClient.signTypedData({
    domain: { name: "USDC", version: "2", chainId, verifyingContract: asset },
    types: { TransferWithAuthorization: [/* ... */] },
    message: { from, to: settlementRouter, value, validAfter, validBefore, nonce },
  });

  // 6. Resend request with X-PAYMENT header
  const finalResponse = await fetch("/api/purchase-download", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": base64url({ x402Version: 2, scheme, network, payload: { signature, authorization } }),
    },
    body: JSON.stringify({ contentId, walletAddress }),
  });

  // 7. Server validates payment and returns content access
  const { downloadUrl, fileName } = await finalResponse.json();
  console.log(`Download ready: ${fileName}`);
  window.open(downloadUrl, "_blank");
}

// The entire payment flow happens transparently!
