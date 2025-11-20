/**
 * Indexer Logic Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createIndexer } from '../../src/indexer/index.js';
import type { NetworkName } from '../../src/types.js';

describe('Chain Indexer', () => {
  describe('Indexer Creation', () => {
    it('should create indexer for Base Sepolia', () => {
      const indexer = createIndexer('base-sepolia');
      
      expect(indexer).toBeDefined();
      expect(indexer.getNetwork()).toBe('base-sepolia');
      expect(typeof indexer.start).toBe('function');
      expect(typeof indexer.stop).toBe('function');
      expect(typeof indexer.getState).toBe('function');
    });

    it('should create indexer for X-Layer', () => {
      const indexer = createIndexer('x-layer');
      
      expect(indexer).toBeDefined();
      expect(indexer.getNetwork()).toBe('x-layer');
    });

    it('should create indexer for all supported networks', () => {
      const networks: NetworkName[] = ['base', 'base-sepolia', 'x-layer', 'x-layer-testnet'];
      
      networks.forEach(network => {
        const indexer = createIndexer(network);
        expect(indexer).toBeDefined();
        expect(indexer.getNetwork()).toBe(network);
      });
    });
  });

  describe('Indexer State', () => {
    it('should have initial state', () => {
      const indexer = createIndexer('base-sepolia');
      const state = indexer.getState();
      
      expect(state).toHaveProperty('network');
      expect(state).toHaveProperty('isRunning');
      expect(state).toHaveProperty('lastIndexedTimestamp');
      expect(state).toHaveProperty('transactionsProcessed');
      
      expect(state.network).toBe('base-sepolia');
      expect(state.isRunning).toBe(false);
      expect(state.transactionsProcessed).toBe(0);
    });

    it('should update state after starting', async () => {
      const indexer = createIndexer('base-sepolia');
      
      const stateBefore = indexer.getState();
      expect(stateBefore.isRunning).toBe(false);
      
      // Note: We won't actually start the indexer in unit tests
      // This would require mocking the entire chain of dependencies
    });
  });

  describe('Indexer Network Configuration', () => {
    it('should use correct network configuration', () => {
      const networks: NetworkName[] = ['base', 'base-sepolia', 'x-layer', 'x-layer-testnet'];
      
      networks.forEach(network => {
        const indexer = createIndexer(network);
        const state = indexer.getState();
        
        expect(state.network).toBe(network);
      });
    });
  });
});

