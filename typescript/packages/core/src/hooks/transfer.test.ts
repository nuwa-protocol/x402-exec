import { describe, it, expect } from 'vitest';
import { TransferHook } from './transfer';

describe('TransferHook.encode', () => {
  it('should return empty bytes', () => {
    const hookData = TransferHook.encode();
    
    expect(hookData).toBe('0x');
  });

  it('should always return the same value', () => {
    const hookData1 = TransferHook.encode();
    const hookData2 = TransferHook.encode();
    
    expect(hookData1).toBe(hookData2);
  });
});

describe('TransferHook.getAddress', () => {
  it('should return address for base-sepolia', () => {
    const address = TransferHook.getAddress('base-sepolia');
    
    expect(address).toBeDefined();
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(address).toBe('0x6b486aF5A08D27153d0374BE56A1cB1676c460a8');
  });

  it('should return address for x-layer-testnet', () => {
    const address = TransferHook.getAddress('x-layer-testnet');
    
    expect(address).toBeDefined();
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(address).toBe('0x3D07D4E03a2aDa2EC49D6937ab1B40a83F3946AB');
  });

  it('should throw error for unsupported network', () => {
    expect(() => {
      TransferHook.getAddress('unsupported-network');
    }).toThrow();
  });

  it('should return different addresses for different networks', () => {
    const addressBaseSepolia = TransferHook.getAddress('base-sepolia');
    const addressXLayer = TransferHook.getAddress('x-layer-testnet');
    
    expect(addressBaseSepolia).not.toBe(addressXLayer);
  });

  it('should return consistent address for same network', () => {
    const address1 = TransferHook.getAddress('base-sepolia');
    const address2 = TransferHook.getAddress('base-sepolia');
    
    expect(address1).toBe(address2);
  });

  it('should throw descriptive error for invalid network', () => {
    expect(() => {
      TransferHook.getAddress('invalid-network');
    }).toThrow('Unsupported network');
  });

  it('should return valid Ethereum address format', () => {
    const address = TransferHook.getAddress('base-sepolia');
    
    // Check format: 0x followed by 40 hex characters
    expect(address.length).toBe(42);
    expect(address.startsWith('0x')).toBe(true);
    expect(/^0x[0-9a-fA-F]{40}$/.test(address)).toBe(true);
  });
});

