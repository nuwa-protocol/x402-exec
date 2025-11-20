/**
 * Indexer integration tests with real environment
 * 
 * These tests use real block explorer APIs and database connections.
 * Make sure to configure .env with valid API keys and credentials.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createBaseScanClient } from '../../src/indexer/basescan-api.js';
import { createOKLinkClient } from '../../src/indexer/oklink-api.js';
import { parseSettledEvent, parseBaseScanLogs } from '../../src/indexer/parser.js';
import { getDatabase, testConnection } from '../../src/database/db.js';
import { getNetworkByName, getAllNetworks } from '../../src/database/models/network.js';
import { config } from '../../src/config.js';

describe('Indexer Integration Tests', () => {
  beforeAll(async () => {
    // Verify database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.warn('⚠️  Database not available, some tests may fail');
    }

    // Check API keys
    if (!config.apiKeys.basescan) {
      console.warn('⚠️  BASESCAN_API_KEY not set, BaseScan tests will be skipped');
    }
    if (!config.apiKeys.oklink) {
      console.warn('⚠️  OKLINK_API_KEY not set, OKLink tests will be skipped');
    }
  });
  
  describe('BaseScan API Integration', () => {
    it('should fetch logs from Base Sepolia SettlementRouter', async () => {
      if (!config.apiKeys.basescan) {
        console.log('⚠️ Skipping: BASESCAN_API_KEY not set');
        return;
      }

      const networkConfig = config.networks['base-sepolia'];
      const client = createBaseScanClient(
        networkConfig.explorerApiUrl,
        config.apiKeys.basescan
      );
      
      const latestBlock = await client.getLatestBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 10000);
      
      console.log(`Fetching logs from block ${fromBlock} to ${latestBlock}...`);
      
      const logs = await client.getLogs({
        address: networkConfig.settlementRouter,
        fromBlock,
        toBlock: latestBlock,
      });
      
      console.log(`✅ Found ${logs.length} logs in recent 10000 blocks`);
      
      // Parse logs
      if (logs.length > 0) {
        const parsed = parseBaseScanLogs(logs, 'base-sepolia', networkConfig.settlementRouter);
        console.log(`✅ Parsed ${parsed.length} Settled events`);
        
        if (parsed.length > 0) {
          const event = parsed[0];
          expect(event.payer).toMatch(/^0x[a-f0-9]{40}$/i);
          expect(event.token).toMatch(/^0x[a-f0-9]{40}$/i);
          expect(parseInt(event.amount)).toBeGreaterThan(0);
          
          console.log(`✅ Sample event:`, {
            payer: event.payer,
            amount: event.amount,
            hook: event.hook,
          });
        }
      }
      
      expect(Array.isArray(logs)).toBe(true);
    }, { timeout: 60000 });
    
    it('should fetch logs from Base Mainnet SettlementRouter', async () => {
      if (!config.apiKeys.basescan) {
        console.log('⚠️ Skipping: BASESCAN_API_KEY not set');
        return;
      }

      const networkConfig = config.networks['base'];
      const client = createBaseScanClient(
        networkConfig.explorerApiUrl,
        config.apiKeys.basescan
      );
      
      const latestBlock = await client.getLatestBlockNumber();
      const fromBlock = Math.max(0, latestBlock - 10000);
      
      console.log(`Fetching logs from block ${fromBlock} to ${latestBlock}...`);
      
      const logs = await client.getLogs({
        address: networkConfig.settlementRouter,
        fromBlock,
        toBlock: latestBlock,
      });
      
      console.log(`✅ Found ${logs.length} logs in recent 10000 blocks`);
      expect(Array.isArray(logs)).toBe(true);
    }, { timeout: 60000 });
  });
  
  describe('OKLink API Integration', () => {
    it('should fetch transactions from X-Layer Testnet SettlementRouter', async () => {
      if (!config.apiKeys.oklink.apiKey) {
        console.log('⚠️ Skipping: OKLINK_API_KEY not set');
        return;
      }

      const networkConfig = config.networks['x-layer-testnet'];
      const client = createOKLinkClient(
        networkConfig.explorerApiUrl,
        config.apiKeys.oklink.apiKey,
        config.apiKeys.oklink.apiSecret,
        config.apiKeys.oklink.passphrase,
        true
      );
      
      console.log(`Fetching transactions for ${networkConfig.settlementRouter}...`);
      
      const response = await client.getAddressTransactions({
        address: networkConfig.settlementRouter,
        limit: 10,
      });
      
      const txCount = response.data?.[0]?.transactionList?.length || 0;
      console.log(`✅ Found ${txCount} transactions`);
      
      expect(response.code).toBe('0');
      expect(Array.isArray(response.data)).toBe(true);
    }, { timeout: 60000 });

    it('should fetch transactions from X-Layer Mainnet SettlementRouter', async () => {
      if (!config.apiKeys.oklink.apiKey) {
        console.log('⚠️ Skipping: OKLINK_API_KEY not set');
        return;
      }

      const networkConfig = config.networks['x-layer'];
      const client = createOKLinkClient(
        networkConfig.explorerApiUrl,
        config.apiKeys.oklink.apiKey,
        config.apiKeys.oklink.apiSecret,
        config.apiKeys.oklink.passphrase,
        false
      );
      
      console.log(`Fetching transactions for ${networkConfig.settlementRouter}...`);
      
      const response = await client.getAddressTransactions({
        address: networkConfig.settlementRouter,
        limit: 10,
      });
      
      const txCount = response.data?.[0]?.transactionList?.length || 0;
      console.log(`✅ Found ${txCount} transactions`);
      
      expect(response.code).toBe('0');
    }, { timeout: 60000 });
  });
  
  describe('Database Operations', () => {
    it('should connect to Supabase database', async () => {
      const connected = await testConnection();
      expect(connected).toBe(true);
      console.log('✅ Database connection successful');
    });
    
    it('should fetch network configuration from database', async () => {
      const network = await getNetworkByName('base-sepolia');
      
      if (network) {
        expect(network.name).toBe('base-sepolia');
        expect(network.chain_id).toBe(84532);
        expect(network.settlement_router).toMatch(/^0x[a-f0-9]{40}$/);
        
        console.log(`✅ Network config:`, {
          name: network.name,
          chainId: network.chain_id,
          settlementRouter: network.settlement_router,
          lastIndexedTimestamp: network.last_indexed_timestamp,
        });
      } else {
        console.warn('⚠️  Network not found in database. Run `pnpm run db:seed` first.');
      }
    });
    
    it('should query all networks from database', async () => {
      const networks = await getAllNetworks();
      
      console.log(`✅ Found ${networks.length} networks in database`);
      
      if (networks.length > 0) {
        networks.forEach(net => {
          console.log(`  - ${net.name} (Chain ID: ${net.chain_id})`);
        });
        
        expect(networks.length).toBeGreaterThan(0);
      } else {
        console.warn('⚠️  No networks found. Run `pnpm run db:seed`');
      }
    });
  });
  
  describe('End-to-End Indexing Test', () => {
    it('should perform a complete indexing cycle for Base Sepolia', async () => {
      if (!config.apiKeys.basescan) {
        console.log('⚠️ Skipping: BASESCAN_API_KEY not set');
        return;
      }

      const network = 'base-sepolia';
      const networkConfig = config.networks[network];
      
      console.log(`\n🚀 Starting E2E indexing test for ${network}...`);
      
      // Step 1: Create API client
      const client = createBaseScanClient(
        networkConfig.explorerApiUrl,
        config.apiKeys.basescan
      );
      console.log(`  1. Created BaseScan API client`);
      
      // Step 2: Get current block
      const currentBlock = await client.getLatestBlockNumber();
      console.log(`  2. Current block: ${currentBlock}`);
      
      // Step 3: Fetch recent logs
      const fromBlock = Math.max(0, currentBlock - 5000);
      const logs = await client.getLogs({
        address: networkConfig.settlementRouter,
        fromBlock,
        toBlock: currentBlock,
      });
      
      console.log(`  3. Found ${logs.length} logs in blocks ${fromBlock}-${currentBlock}`);
      
      // Step 4: Parse events
      const parsed = parseBaseScanLogs(logs, network, networkConfig.settlementRouter);
      console.log(`  4. Successfully parsed ${parsed.length} Settled events`);
      
      // Step 5: Display sample data
      if (parsed.length > 0) {
        const sample = parsed[0];
        console.log(`  5. Sample transaction:`, {
          txHash: sample.txHash,
          payer: sample.payer,
          amount: sample.amount,
          hook: sample.hook,
        });

        expect(sample.txHash).toMatch(/^0x[a-f0-9]{64}$/);
        expect(sample.payer).toMatch(/^0x[a-f0-9]{40}$/i);
        expect(parseInt(sample.amount)).toBeGreaterThan(0);
      }
      
      console.log(`✅ E2E indexing cycle completed successfully\n`);
      
      expect(currentBlock).toBeGreaterThan(0);
      expect(Array.isArray(logs)).toBe(true);
      expect(Array.isArray(parsed)).toBe(true);
    }, { timeout: 60000 });

    it('should perform a complete indexing cycle for X-Layer Testnet', async () => {
      if (!config.apiKeys.oklink.apiKey) {
        console.log('⚠️ Skipping: OKLINK_API_KEY not set');
        return;
      }

      const network = 'x-layer-testnet';
      const networkConfig = config.networks[network];
      
      console.log(`\n🚀 Starting E2E indexing test for ${network}...`);
      
      // Step 1: Create API client
      const client = createOKLinkClient(
        networkConfig.explorerApiUrl,
        config.apiKeys.oklink.apiKey,
        config.apiKeys.oklink.apiSecret,
        config.apiKeys.oklink.passphrase,
        true
      );
      console.log(`  1. Created OKLink API client`);
      
      // Step 2: Get transactions
      const response = await client.getAddressTransactions({
        address: networkConfig.settlementRouter,
        limit: 10,
      });
      
      const txList = response.data?.[0]?.transactionList || [];
      console.log(`  2. Found ${txList.length} transactions`);
      
      // Step 3: Get normalized transactions
      const normalized = [];
      for (const tx of txList.slice(0, 3)) {
        const norm = await client.getTransaction(tx.txId);
        if (norm) {
          normalized.push(norm);
        }
      }
      
      console.log(`  3. Normalized ${normalized.length} transactions`);
      
      // Step 4: Display sample
      if (normalized.length > 0) {
        const sample = normalized[0];
        console.log(`  4. Sample transaction:`, {
          txHash: sample.txHash,
          block: sample.blockNumber,
          from: sample.from,
          logs: sample.logs.length,
        });

        expect(sample.txHash).toBeDefined();
        expect(sample.blockNumber).toBeGreaterThan(0);
      }
      
      console.log(`✅ E2E indexing cycle completed successfully\n`);
    }, { timeout: 90000 });
  });
});

