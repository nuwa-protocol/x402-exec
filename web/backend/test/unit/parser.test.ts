/**
 * Event Parser Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseSettledEvent,
  parseTransaction,
  parseBaseScanLogs,
  validateParsedTransaction,
  SETTLED_EVENT_TOPIC,
} from '../../src/indexer/parser.js';
import type { RawLog, NormalizedTransaction } from '../../src/indexer/types.js';

describe('Event Parser', () => {
  describe('Settled Event Topic', () => {
    it('should export correct Settled event topic', () => {
      expect(SETTLED_EVENT_TOPIC).toBeDefined();
      expect(SETTLED_EVENT_TOPIC).toMatch(/^0x[a-f0-9]{64}$/);
    });
  });

  describe('parseSettledEvent', () => {
    it('should parse valid Settled event', () => {
      const mockLog: RawLog = {
        address: '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb',
        topics: [
          SETTLED_EVENT_TOPIC,
          '0x1234567890123456789012345678901234567890123456789012345678901234', // contextKey
          '0x000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beef', // payer
          '0x000000000000000000000000036cbd53842c5426634e7929541ec2318f3dcf7e', // token
        ],
        data: '0x0000000000000000000000000000000000000000000000000000000005f5e100' + // amount
              '0000000000000000000000000000000000000000000000000000000000000000' + // hook (address 0)
              '9876543210987654321098765432109876543210987654321098765432109876' + // salt
              '000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beef' + // payTo
              '00000000000000000000000000000000000000000000000000000000000186a0', // facilitatorFee
        blockNumber: '12345678',
        timeStamp: '1700000000',
        gasPrice: '1000000000',
        gasUsed: '150000',
        logIndex: '0',
        transactionHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        transactionIndex: '0',
      };

      const event = parseSettledEvent(mockLog);

      expect(event).not.toBeNull();
      if (event) {
        expect(event.payer).toMatch(/^0x[a-f0-9]{40}$/i);
        expect(event.token).toMatch(/^0x[a-f0-9]{40}$/i);
        expect(typeof event.amount).toBe('bigint');
        expect(event.amount).toBeGreaterThan(0n);
        expect(typeof event.facilitatorFee).toBe('bigint');
      }
    });

    it('should return null for non-Settled event', () => {
      const mockLog: RawLog = {
        address: '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb',
        topics: [
          '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef', // Transfer event
        ],
        data: '0x0000000000000000000000000000000000000000000000000000000005f5e100',
        blockNumber: '12345678',
        timeStamp: '1700000000',
        gasPrice: '1000000000',
        gasUsed: '150000',
        logIndex: '0',
        transactionHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        transactionIndex: '0',
      };

      const event = parseSettledEvent(mockLog);
      expect(event).toBeNull();
    });

    it('should handle malformed data gracefully', () => {
      const mockLog: RawLog = {
        address: '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb',
        topics: [SETTLED_EVENT_TOPIC],
        data: '0xinvalid',
        blockNumber: '12345678',
        timeStamp: '1700000000',
        gasPrice: '1000000000',
        gasUsed: '150000',
        logIndex: '0',
        transactionHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        transactionIndex: '0',
      };

      const event = parseSettledEvent(mockLog);
      expect(event).toBeNull();
    });
  });

  describe('parseTransaction', () => {
    it('should parse normalized transaction with Settled event', () => {
      const mockTx: NormalizedTransaction = {
        txHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        blockNumber: 12345678,
        blockTimestamp: 1700000000,
        from: '0x742d35cc6634c0532925a3b844bc9e7595f0beef',
        to: '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb',
        gasUsed: 150000,
        gasPrice: '1000000000',
        status: 'success',
        logs: [
          {
            address: '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb',
            topics: [
              SETTLED_EVENT_TOPIC,
              '0x1234567890123456789012345678901234567890123456789012345678901234',
              '0x000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beef',
              '0x000000000000000000000000036cbd53842c5426634e7929541ec2318f3dcf7e',
            ],
            data: '0x0000000000000000000000000000000000000000000000000000000005f5e100' +
                  '0000000000000000000000000000000000000000000000000000000000000000' +
                  '9876543210987654321098765432109876543210987654321098765432109876' +
                  '000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beef' +
                  '00000000000000000000000000000000000000000000000000000000000186a0',
          },
        ],
      };

      const parsed = parseTransaction(
        mockTx,
        'base-sepolia',
        '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb'
      );

      expect(parsed).not.toBeNull();
      if (parsed) {
        expect(parsed.txHash).toBe(mockTx.txHash);
        expect(parsed.network).toBe('base-sepolia');
        expect(parsed.blockNumber).toBe(mockTx.blockNumber);
        expect(parsed.facilitator).toBe(mockTx.from);
        expect(parsed.status).toBe('success');
        expect(parsed.payer).toMatch(/^0x[a-f0-9]{40}$/i);
      }
    });

    it('should return null for transaction without Settled event', () => {
      const mockTx: NormalizedTransaction = {
        txHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        blockNumber: 12345678,
        blockTimestamp: 1700000000,
        from: '0x742d35cc6634c0532925a3b844bc9e7595f0beef',
        to: '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb',
        gasUsed: 150000,
        gasPrice: '1000000000',
        status: 'success',
        logs: [],
      };

      const parsed = parseTransaction(
        mockTx,
        'base-sepolia',
        '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb'
      );

      expect(parsed).toBeNull();
    });
  });

  describe('parseBaseScanLogs', () => {
    it('should parse multiple BaseScan logs', () => {
      const mockLogs: RawLog[] = [
        {
          address: '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb',
          topics: [
            SETTLED_EVENT_TOPIC,
            '0x1234567890123456789012345678901234567890123456789012345678901234',
            '0x000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beef',
            '0x000000000000000000000000036cbd53842c5426634e7929541ec2318f3dcf7e',
          ],
          data: '0x0000000000000000000000000000000000000000000000000000000005f5e100' +
                '0000000000000000000000000000000000000000000000000000000000000000' +
                '9876543210987654321098765432109876543210987654321098765432109876' +
                '000000000000000000000000742d35cc6634c0532925a3b844bc9e7595f0beef' +
                '00000000000000000000000000000000000000000000000000000000000186a0',
          blockNumber: '12345678',
          timeStamp: '1700000000',
          gasPrice: '1000000000',
          gasUsed: '150000',
          logIndex: '0',
          transactionHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
          transactionIndex: '0',
        },
      ];

      const parsed = parseBaseScanLogs(
        mockLogs,
        'base-sepolia',
        '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb'
      );

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBe(1);
      
      if (parsed.length > 0) {
        expect(parsed[0]).toHaveProperty('txHash');
        expect(parsed[0]).toHaveProperty('network');
        expect(parsed[0]).toHaveProperty('payer');
        expect(parsed[0]).toHaveProperty('amount');
      }
    });

    it('should filter out non-Settled events', () => {
      const mockLogs: RawLog[] = [
        {
          address: '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb',
          topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
          data: '0x0',
          blockNumber: '12345678',
          timeStamp: '1700000000',
          gasPrice: '1000000000',
          gasUsed: '150000',
          logIndex: '0',
          transactionHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
          transactionIndex: '0',
        },
      ];

      const parsed = parseBaseScanLogs(
        mockLogs,
        'base-sepolia',
        '0x817e4f0ee2fbdaac426f1178e149f7dc98873ecb'
      );

      expect(parsed.length).toBe(0);
    });
  });

  describe('validateParsedTransaction', () => {
    it('should validate correct parsed transaction', () => {
      const validTx = {
        txHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        network: 'base-sepolia' as const,
        blockNumber: 12345678,
        blockTimestamp: 1700000000,
        contextKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
        payer: '0x742d35cc6634c0532925a3b844bc9e7595f0beef',
        token: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
        amount: '100000000',
        hook: null,
        salt: '0x9876543210987654321098765432109876543210987654321098765432109876',
        payTo: '0x742d35cc6634c0532925a3b844bc9e7595f0beef',
        facilitatorFee: '100000',
        facilitator: '0x742d35cc6634c0532925a3b844bc9e7595f0beef',
        gasUsed: 150000,
        gasPrice: '1000000000',
        status: 'success' as const,
      };

      const isValid = validateParsedTransaction(validTx);
      expect(isValid).toBe(true);
    });

    it('should reject transaction with missing fields', () => {
      const invalidTx = {
        txHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        network: 'base-sepolia' as const,
        // Missing required fields
      } as any;

      const isValid = validateParsedTransaction(invalidTx);
      expect(isValid).toBe(false);
    });

    it('should reject transaction with invalid address format', () => {
      const invalidTx = {
        txHash: '0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
        network: 'base-sepolia' as const,
        blockNumber: 12345678,
        blockTimestamp: 1700000000,
        contextKey: '0x1234567890123456789012345678901234567890123456789012345678901234',
        payer: 'invalid_address',
        token: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
        amount: '100000000',
        hook: null,
        salt: '0x9876543210987654321098765432109876543210987654321098765432109876',
        payTo: '0x742d35cc6634c0532925a3b844bc9e7595f0beef',
        facilitatorFee: '100000',
        facilitator: '0x742d35cc6634c0532925a3b844bc9e7595f0beef',
        gasUsed: 150000,
        gasPrice: '1000000000',
        status: 'success' as const,
      };

      const isValid = validateParsedTransaction(invalidTx);
      expect(isValid).toBe(false);
    });
  });
});

