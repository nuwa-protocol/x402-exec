/**
 * x402-exec Showcase Server
 * Demonstrates x402x settlement with multiple scenarios using @x402x/hono middleware
 * 
 * This server showcases secure payment practices:
 * - Uses dynamic facilitator fee calculation based on current gas prices
 * - Complex scenarios use server-controlled hook parameters
 * - Payer identity and amounts are always verified via payment signatures
 * - Business prices are clearly separated from facilitator fees
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { paymentMiddleware, type X402Context } from '@x402x/hono';
import { TransferHook } from '@x402x/core';
import { appConfig } from './config.js';
import * as directPayment from './scenarios/direct-payment.js';
import * as transferWithHook from './scenarios/transfer-with-hook.js';
import * as referral from './scenarios/referral.js';
import * as nft from './scenarios/nft.js';
import * as reward from './scenarios/reward.js';
import { encodeRevenueSplitData, encodeRewardData, encodeNFTMintData, decodeNFTMintData } from './utils/hookData.js';

// Extend Hono Context to include x402 data
declare module 'hono' {
  interface ContextVariableMap {
    x402: X402Context;
  }
}

const app = new Hono();

// Facilitator configuration
const facilitatorConfig = {
  url: appConfig.facilitatorUrl as `${string}://${string}`
};

// Enable CORS for frontend
app.use('/*', cors({
  origin: '*',
  credentials: false,
}));

// Global error handler
app.onError((err, c) => {
  console.error('[Global Error Handler]', err);
  console.error('[Global Error Stack]', err.stack);
  return c.json({
    error: err.message || 'Internal server error',
    details: err.stack,
  }, 500);
});

// ===== General Endpoints =====

app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    message: 'x402-exec Showcase Server',
    defaultNetwork: appConfig.defaultNetwork,
    supportedNetworks: Object.keys(appConfig.networks),
    networks: appConfig.networks,
  });
});

app.get('/api/scenarios', (c) => {
  return c.json({
    scenarios: [
      'direct-payment',
      'transfer-with-hook',
      'referral-split',
      'nft-minting',
      'reward-points',
    ],
  });
});

// ===== Scenario 1: Direct Payment (No Settlement Extension) =====

app.get('/api/direct-payment/info', (c) => {
  const info = directPayment.getScenarioInfo();
  return c.json(info);
});

// Direct payment uses standard x402 without settlement extension
app.post('/api/direct-payment/payment', async (c) => {
  console.log('[Direct Payment] Received payment request');
  const body = await c.req.json().catch(() => ({}));
  const network = c.req.query('network') || body.network || appConfig.defaultNetwork;
  
  // Get full URL for resource field (required by x402 spec)
  const fullUrl = c.req.url;
  
  const paymentHeader = c.req.header('X-PAYMENT');
  if (!paymentHeader) {
    // Return 402 with direct payment requirements
    const requirements = directPayment.generateDirectPayment({
      resource: fullUrl,
      network,
    });
    return c.json({
      error: 'X-PAYMENT header is required',
      accepts: [requirements],
      x402Version: 1,
    }, 402);
  }
  
  try {
    // Parse payment payload from X-PAYMENT header
    const paymentPayload = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'));
    
    // Generate payment requirements for verification
    const paymentRequirements = directPayment.generateDirectPayment({
      resource: fullUrl,
      network: paymentPayload.network || network,
    });
    
    console.log('[Direct Payment] Verifying payment with facilitator...');
    
    // Step 1: Verify payment with facilitator
    const verifyResponse = await fetch(`${appConfig.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload,
        paymentRequirements,
      }),
    });
    
    if (!verifyResponse.ok) {
      const error = await verifyResponse.text();
      console.error('[Direct Payment] Verification failed:', error);
      return c.json({ error: 'Payment verification failed', details: error }, 400);
    }
    
    const verifyResult = await verifyResponse.json() as { isValid: boolean; invalidReason?: string };
    
    if (!verifyResult.isValid) {
      console.error('[Direct Payment] Payment is invalid:', verifyResult.invalidReason);
      return c.json({
        error: 'Invalid payment',
        reason: verifyResult.invalidReason,
      }, 400);
    }
    
    console.log('[Direct Payment] Payment verified, settling...');
    
    // Step 2: Settle payment with facilitator (standard x402 - no SettlementRouter)
    const settleResponse = await fetch(`${appConfig.facilitatorUrl}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentPayload,
        paymentRequirements,
      }),
    });
    
    if (!settleResponse.ok) {
      const error = await settleResponse.text();
      console.error('[Direct Payment] Settlement failed:', error);
      return c.json({ error: 'Payment settlement failed', details: error }, 500);
    }
    
    const settleResult = await settleResponse.json() as { success: boolean; errorReason?: string; transaction: string; payer: string; network: string };
    
    if (!settleResult.success) {
      console.error('[Direct Payment] Settlement unsuccessful:', settleResult.errorReason);
      return c.json({
        error: 'Settlement failed',
        reason: settleResult.errorReason,
      }, 500);
    }
    
    console.log('[Direct Payment] Payment settled successfully');
    console.log(`[Direct Payment] Transaction: ${settleResult.transaction}`);
    console.log(`[Direct Payment] Payer: ${settleResult.payer}`);
    
    return c.json({
      message: 'Direct payment successful - standard x402 without settlement extension',
      scenario: 'direct-payment',
      network: settleResult.network,
      transaction: settleResult.transaction,
      payer: settleResult.payer,
      note: 'Payment went directly to resource server using transferWithAuthorization',
    });
  } catch (error) {
    console.error('[Direct Payment] Error:', error);
    return c.json({
      error: 'Payment processing failed',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// ===== Scenario 2: Transfer with Hook =====

app.get('/api/transfer-with-hook/info', (c) => {
  const info = transferWithHook.getScenarioInfo();
  return c.json(info);
});

app.post('/api/transfer-with-hook/payment',
  paymentMiddleware(
    appConfig.resourceServerAddress,
    {
      price: '$0.10', // 0.10 USD business price (facilitator fee auto-calculated)
      network: Object.keys(appConfig.networks) as any, // Support all configured networks
      // facilitatorFee auto-calculated based on current gas prices
      config: {
        description: 'Transfer with Hook: Pay $0.10 to merchant (+ dynamic facilitator fee)',
      },
    },
    facilitatorConfig
  ),
  (c) => {
    const x402 = c.get('x402');
    console.log('[Transfer with Hook] Payment completed successfully');
    console.log(`[Transfer with Hook] Network: ${x402.network}`);
    console.log(`[Transfer with Hook] Facilitator fee: ${x402.settlement?.facilitatorFee}`);
    return c.json({
      message: 'Payment successful with TransferHook',
      scenario: 'transfer-with-hook',
      network: x402.network,
      recipient: appConfig.resourceServerAddress,
      facilitatorFee: x402.settlement?.facilitatorFee,
    });
  }
);

// ===== Scenario 3: Referral Split =====

app.get('/api/referral-split/info', (c) => {
  const info = referral.getScenarioInfo();
  return c.json(info);
});

app.post('/api/referral-split/payment',
  paymentMiddleware(
    appConfig.resourceServerAddress,
    {
      price: '$0.10', // 0.10 USD business price (facilitator fee auto-calculated)
      network: Object.keys(appConfig.networks) as any, // Support all configured networks
      // facilitatorFee auto-calculated based on current gas prices
      // For referral, we need custom hook and hook data
      hook: (network: string) => {
        const networkConfig = appConfig.networks[network];
        return networkConfig.revenueSplitHookAddress;
      },
      hookData: () => {
        // SECURITY: Server-controlled split parameters
        // In production, would look up referrer from database based on ref code
        const merchantAddress = '0x1111111111111111111111111111111111111111';
        const referrerAddress = '0x3333333333333333333333333333333333333333';
        const platformAddress = '0x2222222222222222222222222222222222222222';
        
        // Define splits: 70% merchant, 20% referrer, 10% platform
        const splits = [
          { recipient: merchantAddress, bips: 7000 },
          { recipient: referrerAddress, bips: 2000 },
          { recipient: platformAddress, bips: 1000 },
        ];
        
        return encodeRevenueSplitData(splits);
      },
      config: {
        description: 'Referral Split: 70% merchant, 20% referrer, 10% platform (+ dynamic facilitator fee)',
      },
    },
    facilitatorConfig
  ),
  (c) => {
    const x402 = c.get('x402');
    console.log('[Referral Split] Payment completed successfully');
    console.log(`[Referral Split] Network: ${x402.network}`);
    console.log(`[Referral Split] Facilitator fee: ${x402.settlement?.facilitatorFee}`);
    return c.json({
      message: 'Payment successful with referral split',
      scenario: 'referral-split',
      network: x402.network,
      splits: [
        { party: 'Merchant', percentage: '70%' },
        { party: 'Referrer', percentage: '20%' },
        { party: 'Platform', percentage: '10%' },
      ],
      facilitatorFee: x402.settlement?.facilitatorFee,
    });
  }
);

// ===== Scenario 4: NFT Minting =====

app.get('/api/nft-minting/info', async (c) => {
  const info = await nft.getScenarioInfo();
  return c.json(info);
});

app.post('/api/nft-minting/payment',
  paymentMiddleware(
    appConfig.resourceServerAddress,
    {
      price: '$1.00', // 1.00 USD business price (facilitator fee auto-calculated)
      network: Object.keys(appConfig.networks) as any, // Support all configured networks
      // facilitatorFee auto-calculated based on current gas prices
      hook: (network: string) => {
        const networkConfig = appConfig.networks[network];
        return networkConfig.nftMintHookAddress;
      },
      hookData: (network: string) => {
        const networkConfig = appConfig.networks[network];
        const merchantAddress = '0x1111111111111111111111111111111111111111'; // Demo merchant
        
        // SECURITY: Server-controlled NFT mint configuration
        // NFTMintHook will automatically mint to payer (no recipient needed in hookData)
        // Get next tokenId (in production, query from contract or database)
        const tokenId = Math.floor(Math.random() * 1000000); // Random for demo
        
        return encodeNFTMintData({
          nftContract: networkConfig.randomNFTAddress,
          tokenId,
          merchant: merchantAddress,
        });
      },
      config: {
        description: 'NFT Minting: Mint NFT to payer for $1 USDC (+ dynamic facilitator fee)',
      },
    },
    facilitatorConfig
  ),
  async (c) => {
    // SECURITY: Get payer address from payment context (after verification)
    const x402 = c.get('x402');
    const recipientAddress = x402.payer;
    const network = x402.network;
    const networkConfig = appConfig.networks[network];
    
    // Decode tokenId from hookData
    let tokenId: number;
    try {
      const mintConfig = decodeNFTMintData(x402.settlement!.hookData);
      tokenId = mintConfig.tokenId;
    } catch (error) {
      console.error('[NFT Minting] Failed to decode hookData:', error);
      tokenId = 0; // Fallback
    }
    
    console.log('[NFT Minting] Payment completed successfully');
    console.log(`[NFT Minting] Network: ${network}`);
    console.log(`[NFT Minting] NFT #${tokenId} will be minted to payer: ${recipientAddress}`);
    console.log(`[NFT Minting] Facilitator fee: ${x402.settlement?.facilitatorFee}`);
    
    return c.json({
      message: 'Payment successful, NFT minted to payer',
      scenario: 'nft-minting',
      network,
      nftDetails: {
        recipient: recipientAddress,
        tokenId,
        collection: networkConfig.nftMintHookAddress,
      },
    });
  }
);

// ===== Scenario 5: Reward Points =====

app.get('/api/reward-points/info', async (c) => {
  const info = await reward.getScenarioInfo();
  return c.json(info);
});

app.post('/api/reward-points/payment',
  paymentMiddleware(
    appConfig.resourceServerAddress,
    {
      price: '$0.01', // 0.01 USD business price (facilitator fee auto-calculated)
      network: Object.keys(appConfig.networks) as any, // Support all configured networks
      // facilitatorFee auto-calculated based on current gas prices
      hook: (network: string) => {
        const networkConfig = appConfig.networks[network];
        return networkConfig.rewardHookAddress;
      },
      hookData: (network: string) => {
        const networkConfig = appConfig.networks[network];
        const merchantAddress = '0x1111111111111111111111111111111111111111'; // Demo merchant
        
        // SECURITY: Server-controlled reward configuration
        // RewardHook will automatically distribute points to payer based on payment amount
        return encodeRewardData({
          rewardToken: networkConfig.rewardTokenAddress,
          merchant: merchantAddress,
        });
      },
      config: {
        description: 'Reward Points: Earn points for payment (+ dynamic facilitator fee)',
      },
    },
    facilitatorConfig
  ),
  async (c) => {
    // SECURITY: Get payer address and amount from payment context
    const x402 = c.get('x402');
    const userAddress = x402.payer;
    const paidAmount = BigInt(x402.amount);
    const network = x402.network;
    
    // SECURITY: Calculate points based on actual payment amount (server-controlled)
    // 1 USDC (1000000 atomic units) = 100 points
    const points = Number(paidAmount) / 10000; // 0.01 USDC = 1 point
    
    const networkConfig = appConfig.networks[network];
    
    console.log('[Reward Points] Payment completed successfully');
    console.log(`[Reward Points] Network: ${network}`);
    console.log(`[Reward Points] ${points} points issued to ${userAddress}`);
    console.log(`[Reward Points] Facilitator fee: ${x402.settlement?.facilitatorFee}`);
    
    return c.json({
      message: 'Payment successful, reward points issued',
      scenario: 'reward-points',
      network,
      rewardDetails: {
        user: userAddress,
        points,
        token: networkConfig.rewardHookAddress,
      },
      facilitatorFee: x402.settlement?.facilitatorFee,
    });
  }
);

// Start server
const port = Number(process.env.PORT) || 3000;
console.log(`🚀 x402-exec Showcase Server starting on port ${port}`);
console.log(`📍 Default network: ${appConfig.defaultNetwork}`);
console.log(`🌐 Supported networks: ${Object.keys(appConfig.networks).join(', ')}`);
console.log(`💰 Resource server address: ${appConfig.resourceServerAddress}`);
console.log(`🔧 Facilitator URL: ${appConfig.facilitatorUrl}`);

serve({
  fetch: app.fetch,
  port,
});
