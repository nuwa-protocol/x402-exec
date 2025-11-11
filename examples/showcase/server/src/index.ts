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
import * as transferWithHook from './scenarios/transfer-with-hook.js';
import * as referral from './scenarios/referral.js';
import * as nft from './scenarios/nft.js';
import * as reward from './scenarios/reward.js';
import * as premiumDownload from './scenarios/premium-download.js';
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
      'transfer-with-hook',
      'referral-split',
      'nft-minting',
      'reward-points',
      'premium-download',
    ],
  });
});

// ===== Scenario 1: Transfer with Hook =====

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

// ===== Scenario 2: Referral Split =====

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

// ===== Scenario 3: NFT Minting =====

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

// ===== Scenario 4: Reward Points =====

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

// ===== Scenario 5: Premium Content Download =====

app.get('/api/premium-download/info', (c) => {
  const info = premiumDownload.getScenarioInfo();
  return c.json(info);
});

app.post('/api/purchase-download',
  paymentMiddleware(
    appConfig.resourceServerAddress,
    {
      price: '$1.00', // 1.00 USD for digital content
      network: Object.keys(appConfig.networks) as any,
      config: {
        description: 'Premium Content Download: Purchase and download digital content',
      },
    },
    facilitatorConfig
  ),
  async (c) => {
    const x402 = c.get('x402');
    const body = await c.req.json();
    
    console.log('[Premium Download] Payment completed successfully');
    console.log(`[Premium Download] Network: ${x402.network}`);
    console.log(`[Premium Download] Payer: ${x402.payer}`);
    
    // Verify content exists
    const contentId = body.contentId || 'x402-protocol-guide';
    const content = premiumDownload.getContentItem(contentId);
    
    if (!content) {
      return c.json({
        success: false,
        error: `Content not found: ${contentId}`,
      }, 404);
    }
    
    // Generate download access
    const downloadAccess = premiumDownload.generateDownloadUrl(
      contentId,
      x402.payer as `0x${string}`
    );
    
    console.log(`[Premium Download] Generated download URL for ${x402.payer}`);
    console.log(`[Premium Download] Content: ${content.title}`);
    console.log(`[Premium Download] Expires: ${downloadAccess.expiresAt}`);
    
    return c.json({
      success: true,
      message: 'Purchase successful',
      downloadUrl: downloadAccess.downloadUrl,
      fileName: downloadAccess.fileName,
      expiresAt: downloadAccess.expiresAt,
      network: x402.network,
    });
  }
);

// Serve download files
app.get('/api/download/:contentId', async (c) => {
  const contentId = c.req.param('contentId');
  const token = c.req.query('token');
  
  if (!token) {
    return c.json({ error: 'Download token required' }, 401);
  }
  
  // Verify token
  const isValid = premiumDownload.verifyDownloadToken(contentId, token);
  if (!isValid) {
    return c.json({ error: 'Invalid or expired download token' }, 403);
  }
  
  const content = premiumDownload.getContentItem(contentId);
  if (!content) {
    return c.json({ error: 'Content not found' }, 404);
  }
  
  // In production, stream file from S3/cloud storage
  // For demo, return a simple PDF or redirect to demo file
  console.log(`[Download] Serving ${content.fileName} to user`);
  
  // Return demo content (in production, use c.stream() or redirect)
  return c.text(
    'Demo PDF Content - x402 Protocol Implementation Guide\n\n' +
    'This is a placeholder for the actual PDF file.\n' +
    'In production, this would stream the actual file content.',
    200,
    {
      'Content-Type': content.mimeType,
      'Content-Disposition': `attachment; filename="${content.fileName}"`,
    }
  );
});

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
