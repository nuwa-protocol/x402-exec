/**
 * OKLink API Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createOKLinkClient } from '../../src/indexer/oklink-api.js';

describe('OKLink API Client', () => {
  let client: ReturnType<typeof createOKLinkClient>;

  beforeEach(() => {
    const apiUrl = 'https://web3.okx.com';
    const apiKey = process.env.OKLINK_API_KEY || '';
    const apiSecret = process.env.OKLINK_API_SECRET || '';
    const passphrase = process.env.OKLINK_API_PASSPHRASE || '';
    client = createOKLinkClient(apiUrl, apiKey, apiSecret, passphrase, true); // testnet
  });

  describe('API Client Creation', () => {
    it('should create OKLink client instance', () => {
      expect(client).toBeDefined();
      expect(typeof client.getAddressTransactions).toBe('function');
      expect(typeof client.getTransaction).toBe('function');
    });

    it('should track request count', () => {
      const initialCount = client.getRequestCount();
      expect(initialCount).toBe(0);
    });
  });

  describe('Block Height Operations', () => {
    it('should get latest block height', async () => {
      if (!process.env.OKLINK_API_KEY) {
        console.log('⚠️ Skipping: OKLINK_API_KEY not set');
        return;
      }

      const blockHeight = await client.getLatestBlockHeight();
      
      expect(blockHeight).toBeGreaterThan(0);
      expect(typeof blockHeight).toBe('number');
      
      console.log(`✅ Latest block height: ${blockHeight}`);
    }, { timeout: 10000 });
  });

  describe('Transaction Operations', () => {
    it('should fetch transactions for a contract address', async () => {
      if (!process.env.OKLINK_API_KEY) {
        console.log('⚠️ Skipping: OKLINK_API_KEY not set');
        return;
      }

      const routerAddress = '0xba9980fb08771e2fd10c17450f52d39bcb9ed576';
      
      const response = await client.getAddressTransactions({
        address: routerAddress,
        limit: 10,
      });

      expect(response).toHaveProperty('code');
      expect(response).toHaveProperty('data');
      expect(response.code).toBe('0'); // Success code
      
      console.log(`✅ OKLink API response successful`);

      if (response.data && response.data.length > 0) {
        const txList = response.data[0].transactionList || [];
        console.log(`✅ Found ${txList.length} transactions`);

        if (txList.length > 0) {
          const tx = txList[0];
          expect(tx).toHaveProperty('txId');
          expect(tx).toHaveProperty('blockHeight');
          expect(tx).toHaveProperty('from');
          expect(tx).toHaveProperty('to');
        }
      }
    }, { timeout: 15000 });

    it('should fetch transaction details with event logs', async () => {
      if (!process.env.OKLINK_API_KEY) {
        console.log('⚠️ Skipping: OKLINK_API_KEY not set');
        return;
      }

      const routerAddress = '0xba9980fb08771e2fd10c17450f52d39bcb9ed576';
      
      // First get a transaction hash
      const txResponse = await client.getAddressTransactions({
        address: routerAddress,
        limit: 5,
      });

      if (txResponse.data && txResponse.data.length > 0) {
        const txList = txResponse.data[0].transactionList || [];
        
        if (txList.length > 0) {
          const txHash = txList[0].txId;
          const details = await client.getTransactionDetails(txHash);

          expect(details).toHaveProperty('code');
          expect(details).toHaveProperty('data');
          expect(details.code).toBe('0');

          if (details.data && details.data.length > 0) {
            const tx = details.data[0];
            expect(tx.txId).toBe(txHash);
            
            console.log(`✅ Transaction details:`, {
              txId: tx.txId,
              block: tx.blockHeight,
              eventLogs: tx.eventLogList?.length || 0,
            });
          }
        }
      } else {
        console.log('ℹ️ No transactions found to test');
      }
    }, { timeout: 20000 });

    it('should get normalized transaction', async () => {
      if (!process.env.OKLINK_API_KEY) {
        return;
      }

      const routerAddress = '0xba9980fb08771e2fd10c17450f52d39bcb9ed576';
      
      const txResponse = await client.getAddressTransactions({
        address: routerAddress,
        limit: 1,
      });

      if (txResponse.data && txResponse.data.length > 0) {
        const txList = txResponse.data[0].transactionList || [];
        
        if (txList.length > 0) {
          const txHash = txList[0].txId;
          const normalized = await client.getTransaction(txHash);

          if (normalized) {
            expect(normalized).toHaveProperty('txHash');
            expect(normalized).toHaveProperty('blockNumber');
            expect(normalized).toHaveProperty('blockTimestamp');
            expect(normalized).toHaveProperty('from');
            expect(normalized).toHaveProperty('to');
            expect(normalized).toHaveProperty('logs');
            expect(Array.isArray(normalized.logs)).toBe(true);
            
            console.log(`✅ Normalized transaction:`, {
              txHash: normalized.txHash,
              block: normalized.blockNumber,
              logs: normalized.logs.length,
            });
          }
        }
      }
    }, { timeout: 20000 });
  });

  describe('Timestamp-based Queries', () => {
    it('should fetch transactions by timestamp range', async () => {
      if (!process.env.OKLINK_API_KEY) {
        return;
      }

      const routerAddress = '0xba9980fb08771e2fd10c17450f52d39bcb9ed576';
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 60 * 60;

      const transactions = await client.getTransactionsByTimestamp({
        address: routerAddress,
        startTimestamp: oneDayAgo,
        endTimestamp: now,
        limit: 10,
      });

      expect(Array.isArray(transactions)).toBe(true);
      console.log(`✅ Found ${transactions.length} transactions in last 24 hours`);

      if (transactions.length > 0) {
        const tx = transactions[0];
        expect(tx).toHaveProperty('txHash');
        expect(tx).toHaveProperty('blockTimestamp');
        expect(tx.blockTimestamp).toBeGreaterThanOrEqual(oneDayAgo);
        expect(tx.blockTimestamp).toBeLessThanOrEqual(now);
      }
    }, { timeout: 30000 });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits when making multiple requests', async () => {
      if (!process.env.OKLINK_API_KEY) {
        return;
      }

      const startTime = Date.now();
      
      // Make 5 consecutive requests
      for (let i = 0; i < 5; i++) {
        await client.getLatestBlockHeight();
      }
      
      const duration = Date.now() - startTime;
      
      // With 50ms minimum interval, 5 requests should take at least 200ms
      expect(duration).toBeGreaterThanOrEqual(200);
      
      console.log(`✅ 5 requests took ${duration}ms (rate limited correctly)`);
    }, { timeout: 10000 });
  });

  describe('Error Handling', () => {
    it('should handle invalid API key gracefully', async () => {
      const badClient = createOKLinkClient(
        'https://web3.okx.com',
        'invalid_key',
        'invalid_secret',
        'invalid_passphrase',
        true
      );

      await expect(badClient.getLatestBlockHeight()).rejects.toThrow();
    }, { timeout: 10000 });

    it('should return null for non-existent transaction', async () => {
      if (!process.env.OKLINK_API_KEY) {
        return;
      }

      const fakeTxHash = '0x0000000000000000000000000000000000000000000000000000000000000001';
      const transaction = await client.getTransaction(fakeTxHash);

      expect(transaction).toBeNull();
    }, { timeout: 10000 });
  });
});

