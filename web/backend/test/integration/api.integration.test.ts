/**
 * API Integration Tests
 * 
 * Tests all REST API endpoints with a running server
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import apiRoutes from '../../src/routes/index.js';
import { initDatabase, testConnection } from '../../src/database/db.js';

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Setup Express app
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/api', apiRoutes);

    // Initialize database
    initDatabase();
    const isConnected = await testConnection();
    
    if (!isConnected) {
      console.warn('⚠️  Database not connected, API tests may fail');
    }
  });

  describe('Health Check', () => {
    it('GET /api/health should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('indexer');
      expect(response.body.data).toHaveProperty('database');

      console.log('✅ Health check:', response.body.data.status);
    });

    it('GET /api/version should return API version', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('version');
      expect(response.body.data).toHaveProperty('name', 'x402 Scanner Backend');

      console.log('✅ API version:', response.body.data.version);
    });
  });

  describe('Networks API', () => {
    it('GET /api/networks should return all networks', async () => {
      const response = await request(app)
        .get('/api/networks')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const network = response.body.data[0];
        expect(network).toHaveProperty('name');
        expect(network).toHaveProperty('chainId');
        expect(network).toHaveProperty('type');
        expect(network).toHaveProperty('settlementRouter');

        console.log(`✅ Found ${response.body.data.length} networks`);
      }
    });
  });

  describe('Transactions API', () => {
    it('GET /api/transactions should return transaction list', async () => {
      const response = await request(app)
        .get('/api/transactions')
        .query({ limit: 10 })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('transactions');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.transactions)).toBe(true);

      const { pagination } = response.body.data;
      expect(pagination).toHaveProperty('page');
      expect(pagination).toHaveProperty('limit');
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('totalPages');

      console.log(`✅ Transactions: ${response.body.data.transactions.length}, Total: ${pagination.total}`);
    });

    it('GET /api/transactions should support network filter', async () => {
      const response = await request(app)
        .get('/api/transactions')
        .query({ network: 'base-sepolia', limit: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.transactions)).toBe(true);

      // All transactions should be from base-sepolia
      response.body.data.transactions.forEach((tx: any) => {
        expect(tx.network).toBe('base-sepolia');
      });

      console.log(`✅ Base Sepolia transactions: ${response.body.data.transactions.length}`);
    });

    it('GET /api/transactions should support pagination', async () => {
      const page1 = await request(app)
        .get('/api/transactions')
        .query({ page: 1, limit: 5 })
        .expect(200);

      const page2 = await request(app)
        .get('/api/transactions')
        .query({ page: 2, limit: 5 })
        .expect(200);

      expect(page1.body.data.pagination.page).toBe(1);
      expect(page2.body.data.pagination.page).toBe(2);

      // Pages should have different transactions
      const page1Hashes = page1.body.data.transactions.map((tx: any) => tx.txHash);
      const page2Hashes = page2.body.data.transactions.map((tx: any) => tx.txHash);
      
      const overlap = page1Hashes.filter((hash: string) => page2Hashes.includes(hash));
      expect(overlap.length).toBe(0);

      console.log('✅ Pagination working correctly');
    });

    it('GET /api/transactions should support sorting', async () => {
      const asc = await request(app)
        .get('/api/transactions')
        .query({ sortBy: 'timestamp', sortOrder: 'asc', limit: 5 })
        .expect(200);

      const desc = await request(app)
        .get('/api/transactions')
        .query({ sortBy: 'timestamp', sortOrder: 'desc', limit: 5 })
        .expect(200);

      if (asc.body.data.transactions.length >= 2 && desc.body.data.transactions.length >= 2) {
        // Check ascending order
        const ascTimestamps = asc.body.data.transactions.map((tx: any) => 
          new Date(tx.timestamp).getTime()
        );
        expect(ascTimestamps[0]).toBeLessThanOrEqual(ascTimestamps[ascTimestamps.length - 1]);

        // Check descending order
        const descTimestamps = desc.body.data.transactions.map((tx: any) => 
          new Date(tx.timestamp).getTime()
        );
        expect(descTimestamps[0]).toBeGreaterThanOrEqual(descTimestamps[descTimestamps.length - 1]);

        console.log('✅ Sorting working correctly');
      }
    });

    it('GET /api/transaction/:txHash should return 404 for non-existent transaction', async () => {
      const fakeTxHash = '0x0000000000000000000000000000000000000000000000000000000000000001';
      
      const response = await request(app)
        .get(`/api/transaction/${fakeTxHash}`)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('NOT_FOUND');

      console.log('✅ 404 handling works correctly');
    });

    it('GET /api/transaction/:txHash should return transaction details if exists', async () => {
      // First get a transaction hash
      const listResponse = await request(app)
        .get('/api/transactions')
        .query({ limit: 1 })
        .expect(200);

      if (listResponse.body.data.transactions.length > 0) {
        const txHash = listResponse.body.data.transactions[0].txHash;

        const response = await request(app)
          .get(`/api/transaction/${txHash}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('txHash', txHash);
        expect(response.body.data).toHaveProperty('network');
        expect(response.body.data).toHaveProperty('payer');
        expect(response.body.data).toHaveProperty('amount');

        console.log(`✅ Transaction details retrieved: ${txHash}`);
      } else {
        console.log('ℹ️ No transactions to test');
      }
    });
  });

  describe('Statistics API', () => {
    it('GET /api/stats should return aggregated statistics', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('byNetwork');
      expect(response.body.data).toHaveProperty('byHook');
      expect(response.body.data).toHaveProperty('byFacilitator');

      const { overview } = response.body.data;
      expect(overview).toHaveProperty('totalTransactions');
      expect(overview).toHaveProperty('totalVolumeUSD');
      expect(overview).toHaveProperty('uniquePayers');
      expect(overview).toHaveProperty('uniqueFacilitators');

      console.log('✅ Stats overview:', {
        transactions: overview.totalTransactions,
        volumeUSD: overview.totalVolumeUSD,
        payers: overview.uniquePayers,
      });
    });

    it('GET /api/stats/overview should return overview only', async () => {
      const response = await request(app)
        .get('/api/stats/overview')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalTransactions');
      expect(response.body.data).toHaveProperty('totalVolumeUSD');

      console.log('✅ Overview retrieved');
    });

    it('GET /api/stats/networks should return network statistics', async () => {
      const response = await request(app)
        .get('/api/stats/networks')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe('object');

      console.log(`✅ Network stats for ${Object.keys(response.body.data).length} networks`);
    });

    it('GET /api/stats/hooks should return hook statistics', async () => {
      const response = await request(app)
        .get('/api/stats/hooks')
        .query({ limit: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      console.log(`✅ Hook stats: ${response.body.data.length} hooks`);
    });

    it('GET /api/stats/facilitators should return facilitator statistics', async () => {
      const response = await request(app)
        .get('/api/stats/facilitators')
        .query({ limit: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      console.log(`✅ Facilitator stats: ${response.body.data.length} facilitators`);
    });

    it('GET /api/stats should support network filtering', async () => {
      const response = await request(app)
        .get('/api/stats')
        .query({ network: 'base-sepolia' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');

      console.log('✅ Network-filtered stats retrieved');
    });

    it('GET /api/stats should support period filtering', async () => {
      const response = await request(app)
        .get('/api/stats')
        .query({ period: 'week' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('timeSeries');

      console.log('✅ Period-filtered stats retrieved');
    });
  });

  describe('Hooks API', () => {
    it('GET /api/hooks should return hook list', async () => {
      const response = await request(app)
        .get('/api/hooks')
        .query({ limit: 10 })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('hooks');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.hooks)).toBe(true);

      console.log(`✅ Found ${response.body.data.hooks.length} hooks`);
    });

    it('GET /api/hooks should support network filter', async () => {
      const response = await request(app)
        .get('/api/hooks')
        .query({ network: 'base-sepolia' })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      response.body.data.hooks.forEach((hook: any) => {
        expect(hook.network).toBe('base-sepolia');
      });

      console.log('✅ Network-filtered hooks retrieved');
    });

    it('POST /api/hook should register a new hook', async () => {
      const newHook = {
        address: '0x1234567890123456789012345678901234567890',
        network: 'base-sepolia',
        name: 'Test Hook',
        description: 'A test hook for integration testing',
        category: 'test',
        version: '1.0.0',
        author: 'Test Team',
      };

      const response = await request(app)
        .post('/api/hook')
        .send(newHook)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.address).toBe(newHook.address.toLowerCase());
      expect(response.body.data.name).toBe(newHook.name);

      console.log(`✅ Hook registered: ${response.body.data.name}`);
    });

    it('POST /api/hook should validate required fields', async () => {
      const invalidHook = {
        address: '0x1234567890123456789012345678901234567890',
        // Missing network and name
      };

      const response = await request(app)
        .post('/api/hook')
        .send(invalidHook)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');

      console.log('✅ Validation works correctly');
    });

    it('POST /api/hook should validate address format', async () => {
      const invalidHook = {
        address: 'invalid_address',
        network: 'base-sepolia',
        name: 'Test Hook',
      };

      const response = await request(app)
        .post('/api/hook')
        .send(invalidHook)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('address');

      console.log('✅ Address validation works correctly');
    });

    it('GET /api/hook/:address should return 400 without network parameter', async () => {
      const response = await request(app)
        .get('/api/hook/0x1234567890123456789012345678901234567890')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Network');

      console.log('✅ Network parameter validation works');
    });

    it('GET /api/hook/:address should return hook details if exists', async () => {
      // First register a hook
      const hookAddress = '0x9876543210987654321098765432109876543210';
      await request(app)
        .post('/api/hook')
        .send({
          address: hookAddress,
          network: 'base-sepolia',
          name: 'Lookup Test Hook',
        })
        .expect(201);

      // Then fetch it
      const response = await request(app)
        .get(`/api/hook/${hookAddress}`)
        .query({ network: 'base-sepolia' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.address).toBe(hookAddress.toLowerCase());
      expect(response.body.data.name).toBe('Lookup Test Hook');

      console.log(`✅ Hook lookup successful: ${response.body.data.name}`);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoint', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error.code).toBe('NOT_FOUND');

      console.log('✅ 404 error handling works');
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/hook')
        .set('Content-Type', 'application/json')
        .send('{"invalid json')
        .expect(400);

      console.log('✅ Malformed JSON handling works');
    });
  });
});

