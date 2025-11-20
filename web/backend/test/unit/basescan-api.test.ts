/**
 * BaseScan API Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createBaseScanClient } from '../../src/indexer/basescan-api.js';

describe('BaseScan API Client', () => {
  let client: ReturnType<typeof createBaseScanClient>;

  beforeEach(() => {
    const apiUrl = process.env.BASE_SEPOLIA_EXPLORER_URL || 'https://api-sepolia.basescan.org/api';
    const apiKey = process.env.BASESCAN_API_KEY || '';
    client = createBaseScanClient(apiUrl, apiKey);
  });

  describe('API Client Creation', () => {
    it('should create BaseScan client instance', () => {
      expect(client).toBeDefined();
      expect(typeof client.getLogs).toBe('function');
      expect(typeof client.getLatestBlockNumber).toBe('function');
    });

    it('should track request count', () => {
      const initialCount = client.getRequestCount();
      expect(initialCount).toBe(0);
    });
  });

  describe('Block Number Operations', () => {
    it('should get latest block number', async () => {
      if (!process.env.BASESCAN_API_KEY) {
        console.log('⚠️ Skipping: BASESCAN_API_KEY not set');
        return;
      }

      const blockNumber = await client.getLatestBlockNumber();
      
      expect(blockNumber).toBeGreaterThan(0);
      expect(typeof blockNumber).toBe('number');
      
      console.log(`✅ Latest block: ${blockNumber}`);
    }, { timeout: 10000 });

    it('should increment request count after API call', async () => {
      if (!process.env.BASESCAN_API_KEY) {
        return;
      }

      const beforeCount = client.getRequestCount();
      await client.getLatestBlockNumber();
      const afterCount = client.getRequestCount();
      
      expect(afterCount).toBeGreaterThan(beforeCount);
    }, { timeout: 10000 });
  });

  describe('Event Logs Operations', () => {
    it('should fetch logs for a contract address', async () => {
      if (!process.env.BASESCAN_API_KEY) {
        console.log('⚠️ Skipping: BASESCAN_API_KEY not set');
        return;
      }

      const routerAddress = '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb';
      const latestBlock = await client.getLatestBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 1000);

      const logs = await client.getLogs({
        address: routerAddress,
        fromBlock,
        toBlock: latestBlock,
      });

      expect(Array.isArray(logs)).toBe(true);
      console.log(`✅ Found ${logs.length} logs in blocks ${fromBlock}-${latestBlock}`);

      if (logs.length > 0) {
        const log = logs[0];
        expect(log).toHaveProperty('address');
        expect(log).toHaveProperty('topics');
        expect(log).toHaveProperty('data');
        expect(log).toHaveProperty('transactionHash');
        expect(log).toHaveProperty('blockNumber');
      }
    }, { timeout: 15000 });

    it('should handle no logs found gracefully', async () => {
      if (!process.env.BASESCAN_API_KEY) {
        return;
      }

      // Use a dummy address that has no logs
      const logs = await client.getLogs({
        address: '0x0000000000000000000000000000000000000001',
        fromBlock: 1,
        toBlock: 100,
      });

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBe(0);
    }, { timeout: 10000 });
  });

  describe('Transaction Operations', () => {
    it('should fetch transaction details by hash', async () => {
      if (!process.env.BASESCAN_API_KEY) {
        console.log('⚠️ Skipping: BASESCAN_API_KEY not set');
        return;
      }

      // First, get a real transaction hash from recent logs
      const routerAddress = '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb';
      const latestBlock = await client.getLatestBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 10000);

      const logs = await client.getLogs({
        address: routerAddress,
        fromBlock,
        toBlock: latestBlock,
      });

      if (logs.length > 0) {
        const txHash = logs[0].transactionHash;
        const transaction = await client.getTransaction(txHash);

        if (transaction) {
          expect(transaction).toHaveProperty('txHash');
          expect(transaction).toHaveProperty('blockNumber');
          expect(transaction).toHaveProperty('from');
          expect(transaction).toHaveProperty('to');
          expect(transaction.txHash.toLowerCase()).toBe(txHash.toLowerCase());
          
          console.log(`✅ Transaction details:`, {
            txHash: transaction.txHash,
            block: transaction.blockNumber,
            from: transaction.from,
          });
        }
      } else {
        console.log('ℹ️ No transactions found to test');
      }
    }, { timeout: 20000 });

    it('should return null for non-existent transaction', async () => {
      if (!process.env.BASESCAN_API_KEY) {
        return;
      }

      const fakeTxHash = '0x0000000000000000000000000000000000000000000000000000000000000001';
      const transaction = await client.getTransaction(fakeTxHash);

      expect(transaction).toBeNull();
    }, { timeout: 10000 });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits when making multiple requests', async () => {
      if (!process.env.BASESCAN_API_KEY) {
        return;
      }

      const startTime = Date.now();
      
      // Make 5 consecutive requests
      for (let i = 0; i < 5; i++) {
        await client.getLatestBlockNumber();
      }
      
      const duration = Date.now() - startTime;
      
      // With 200ms minimum interval, 5 requests should take at least 800ms
      expect(duration).toBeGreaterThanOrEqual(800);
      
      console.log(`✅ 5 requests took ${duration}ms (rate limited correctly)`);
    }, { timeout: 10000 });
  });

  describe('Error Handling', () => {
    it('should handle invalid API key gracefully', async () => {
      const badClient = createBaseScanClient(
        'https://api-sepolia.basescan.org/api',
        'invalid_key'
      );

      await expect(badClient.getLatestBlockNumber()).rejects.toThrow();
    }, { timeout: 10000 });
  });
});

