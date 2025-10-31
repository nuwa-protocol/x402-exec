/**
 * Settlement Showcase Server
 * Provides payment endpoints for 3 demonstration scenarios
 */

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { exact } from 'x402/schemes';
import { PaymentPayload, settleResponseHeader } from 'x402/types';
import { useFacilitator } from 'x402/verify';
import { findMatchingPaymentRequirements } from 'x402/shared';
import { appConfig } from './config.js';
import * as referral from './scenarios/referral.js';
import * as nft from './scenarios/nft.js';
import * as reward from './scenarios/reward.js';

const app = new Hono();

// Initialize facilitator for manual payment verification
const { verify, settle } = useFacilitator({ url: appConfig.facilitatorUrl as `${string}://${string}` });
const x402Version = 1;

// Enable CORS for frontend
app.use('/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
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

// ===== Payment Processing Helper =====

/**
 * Generic payment processing function
 * Handles 402 response, payment verification, and settlement
 */
async function processPayment(
  c: any,
  scenarioName: string,
  paymentRequirements: any[],
  onSuccess: (settlement: any, selectedRequirement: any) => any
) {
  const logPrefix = `[${scenarioName}]`;
  
  // Check for X-PAYMENT header
  const payment = c.req.header('X-PAYMENT');
  if (!payment) {
    console.log(`${logPrefix} No X-PAYMENT header found, returning 402`);
    // First request: return 402 with payment requirements
    return c.json({
      error: 'X-PAYMENT header is required',
      accepts: paymentRequirements,
      x402Version,
    }, 402);
  }
  
  console.log(`${logPrefix} X-PAYMENT header found, processing payment...`);
  console.log(`${logPrefix} X-PAYMENT (first 100 chars):`, payment.substring(0, 100) + '...');
  
  // Decode and verify payment
  let decodedPayment: PaymentPayload;
  try {
    decodedPayment = exact.evm.decodePayment(payment);
    decodedPayment.x402Version = x402Version;
    console.log(`${logPrefix} Decoded payment:`, JSON.stringify({
      scheme: decodedPayment.scheme,
      network: decodedPayment.network,
      from: 'authorization' in decodedPayment.payload ? decodedPayment.payload.authorization.from : 'N/A',
      to: 'authorization' in decodedPayment.payload ? decodedPayment.payload.authorization.to : 'N/A',
      value: 'authorization' in decodedPayment.payload ? decodedPayment.payload.authorization.value : 'N/A',
    }, null, 2));
  } catch (error: any) {
    console.error(`${logPrefix} Error decoding payment:`, error);
    return c.json({
      error: 'Invalid or malformed payment header',
      accepts: paymentRequirements,
      x402Version,
    }, 402);
  }
  
  // Find matching payment requirement
  const selectedRequirement = findMatchingPaymentRequirements(paymentRequirements, decodedPayment);
  if (!selectedRequirement) {
    console.error(`${logPrefix} No matching payment requirements found`);
    return c.json({
      error: 'Unable to find matching payment requirements',
      accepts: paymentRequirements,
      x402Version,
    }, 402);
  }
  console.log(`${logPrefix} Found matching requirement`);
  
  // Verify payment
  console.log(`${logPrefix} Starting payment verification...`);
  const verification = await verify(decodedPayment, selectedRequirement);
  console.log(`${logPrefix} Verification result:`, JSON.stringify(verification, null, 2));
  
  if (!verification.isValid) {
    console.error(`${logPrefix} Payment verification failed:`, verification.invalidReason);
    return c.json({
      error: verification.invalidReason,
      accepts: paymentRequirements,
      payer: verification.payer,
      x402Version,
    }, 402);
  }
  console.log(`${logPrefix} Payment verified successfully`);
  
  // Settle payment
  console.log(`${logPrefix} Starting payment settlement...`);
  const settlement = await settle(decodedPayment, selectedRequirement);
  console.log(`${logPrefix} Settlement result:`, JSON.stringify(settlement, null, 2));
  
  if (!settlement.success) {
    console.error(`${logPrefix} Settlement failed:`, settlement.errorReason);
    return c.json({
      error: settlement.errorReason || 'Settlement failed',
      accepts: paymentRequirements,
      x402Version,
    }, 402);
  }
  console.log(`${logPrefix} Payment settled successfully`);
  
  // Set settlement response header
  const responseHeader = settleResponseHeader(settlement);
  c.header('X-PAYMENT-RESPONSE', responseHeader);
  
  console.log(`${logPrefix} Payment completed successfully`);
  // Call success callback
  return onSuccess(settlement, selectedRequirement);
}

// ===== General Endpoints =====

app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    message: 'Settlement Showcase Server',
    network: appConfig.network,
    contracts: {
      settlementRouter: appConfig.settlementRouterAddress,
      randomNFT: appConfig.randomNFTAddress,
      rewardToken: appConfig.rewardTokenAddress,
    },
  });
});

app.get('/api/scenarios', async (c) => {
  try {
    const scenarios = [
      referral.getScenarioInfo(),
      await nft.getScenarioInfo(),
      await reward.getScenarioInfo(),
    ];
    return c.json({ scenarios });
  } catch (error) {
    return c.json({ error: 'Failed to fetch scenarios' }, 500);
  }
});

// ===== Scenario 1: Referral Split =====

app.get('/api/scenario-1/info', (c) => {
  const info = referral.getScenarioInfo();
  return c.json(info);
});

app.post('/api/scenario-1/payment', async (c) => {
  try {
    console.log('[Referral Split] Received payment request');
    const body = await c.req.json().catch(() => ({}));
    console.log('[Referral Split] Request body:', JSON.stringify(body, null, 2));
    
    // Get the full URL for the resource field
    const url = new URL(c.req.url);
    const resource = url.href;
    console.log('[Referral Split] Resource URL:', resource);
    
    // Generate payment requirements with custom extra fields (including hookData)
    const paymentRequirements = [referral.generateReferralPayment({
      referrer: body.referrer,
      merchantAddress: body.merchantAddress,
      platformAddress: body.platformAddress,
      resource, // Pass the full URL
    })];
    console.log('[Referral Split] Generated payment requirements:', JSON.stringify(paymentRequirements, null, 2));
    
    // Use generic payment processor
    return await processPayment(c, 'Referral Split', paymentRequirements, (settlement, selectedRequirement) => {
      return c.json({
        success: true,
        message: 'Payment processed! Funds split among 3 parties.',
        settlement: {
          transaction: settlement.transaction,
          network: settlement.network,
          payer: settlement.payer,
        },
      });
    });
  } catch (error: any) {
    console.error('[Referral Split] Unexpected error:', error);
    console.error('[Referral Split] Error stack:', error.stack);
    return c.json({ error: error.message }, 400);
  }
});

// ===== Scenario 2: Random NFT Mint =====

app.get('/api/scenario-2/info', async (c) => {
  try {
    const info = await nft.getScenarioInfo();
    return c.json(info);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/scenario-2/payment', async (c) => {
  try {
    console.log('[NFT Mint] Received payment request');
    const body = await c.req.json().catch(() => ({}));
    console.log('[NFT Mint] Request body:', JSON.stringify(body, null, 2));
    
    if (!body.recipient) {
      return c.json({ error: 'Recipient address required' }, 400);
    }
    
    // Get the full URL for the resource field
    const url = new URL(c.req.url);
    const resource = url.href;
    console.log('[NFT Mint] Resource URL:', resource);
    
    // Generate payment requirements with custom extra fields
    const paymentRequirements = [await nft.generateNFTPayment({
      recipient: body.recipient,
      merchantAddress: body.merchantAddress,
      resource, // Pass the full URL
    })];
    console.log('[NFT Mint] Generated payment requirements:', JSON.stringify(paymentRequirements, null, 2));
    
    // Use generic payment processor
    return await processPayment(c, 'NFT Mint', paymentRequirements, (settlement, selectedRequirement) => {
      return c.json({
        success: true,
        message: `NFT #${selectedRequirement.extra?.nftTokenId} minted to your wallet!`,
        settlement: {
          transaction: settlement.transaction,
          network: settlement.network,
          payer: settlement.payer,
        },
        nftTokenId: selectedRequirement.extra?.nftTokenId,
      });
    });
  } catch (error: any) {
    console.error('[NFT Mint] Unexpected error:', error);
    console.error('[NFT Mint] Error stack:', error.stack);
    return c.json({ error: error.message }, 400);
  }
});

// ===== Scenario 3: Points Reward =====

app.get('/api/scenario-3/info', async (c) => {
  try {
    const info = await reward.getScenarioInfo();
    return c.json(info);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

app.post('/api/scenario-3/payment', async (c) => {
  try {
    console.log('[Reward Points] Received payment request');
    const body = await c.req.json().catch(() => ({}));
    console.log('[Reward Points] Request body:', JSON.stringify(body, null, 2));
    
    // Get the full URL for the resource field
    const url = new URL(c.req.url);
    const resource = url.href;
    console.log('[Reward Points] Resource URL:', resource);
    
    // Generate payment requirements with custom extra fields
    const paymentRequirements = [await reward.generateRewardPayment({
      merchantAddress: body.merchantAddress,
      resource, // Pass the full URL
    })];
    console.log('[Reward Points] Generated payment requirements:', JSON.stringify(paymentRequirements, null, 2));
    
    // Use generic payment processor
    return await processPayment(c, 'Reward Points', paymentRequirements, (settlement, selectedRequirement) => {
      return c.json({
        success: true,
        message: '1000 reward points credited to your wallet!',
        settlement: {
          transaction: settlement.transaction,
          network: settlement.network,
          payer: settlement.payer,
        },
        rewardAmount: selectedRequirement.extra?.rewardAmount,
      });
    });
  } catch (error: any) {
    console.error('[Reward Points] Unexpected error:', error);
    console.error('[Reward Points] Error stack:', error.stack);
    return c.json({ error: error.message }, 400);
  }
});

// Start server
const port = appConfig.port;

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🎯 Settlement Showcase Server                           ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   Network:           ${appConfig.network.padEnd(33)}║
║   Port:              ${port.toString().padEnd(33)}║
║   Facilitator:       ${appConfig.facilitatorUrl.slice(0, 33)}║
║                                                           ║
║   SettlementRouter:     ${appConfig.settlementRouterAddress.slice(0, 20)}...       ║
║   USDC Address:      ${appConfig.usdcAddress.slice(0, 20)}...       ║
║   RandomNFT:         ${appConfig.randomNFTAddress.slice(0, 20)}...       ║
║   RewardToken:       ${appConfig.rewardTokenAddress.slice(0, 20)}...       ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   📋 Scenarios:                                           ║
║   1. Referral Split    - 3-way payment split             ║
║   2. Random NFT Mint   - Sequential NFT minting          ║
║   3. Points Reward     - Reward token distribution       ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║   🌐 Endpoints:                                           ║
║   GET  /api/health                                        ║
║   GET  /api/scenarios                                     ║
║   GET  /api/scenario-{1|2|3}/info                        ║
║   POST /api/scenario-{1|2|3}/payment                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

✅ Server ready! Waiting for payment requests...
`);

serve({
  fetch: app.fetch,
  port,
});

