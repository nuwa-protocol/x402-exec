// @ts-nocheck
// This file is for display purposes only and is not compiled
import { Hono } from 'hono';
import { paymentMiddleware } from '@x402x/hono';

const app = new Hono();

// Premium content endpoint with payment protection
app.post('/api/purchase-download',
  paymentMiddleware({
    // Define payment requirements
    getPaymentRequirements: async (c) => {
      const { contentId } = await c.req.json();
      const content = getContentMetadata(contentId);
      
      return {
        amount: '100000',  // 0.1 USDC (6 decimals)
        currency: 'USDC',
        recipient: merchantAddress,
        memo: `Purchase: ${content.title}`
      };
    },
    
    // Handle successful payment
    onPaymentSuccess: async (c) => {
      const { contentId, walletAddress } = await c.req.json();
      
      // Generate secure download link (expires in 24h)
      const downloadUrl = generateSecureUrl(contentId, walletAddress);
      
      return c.json({
        success: true,
        downloadUrl,
        fileName: 'x402-whitepaper.pdf',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    }
  })
);
