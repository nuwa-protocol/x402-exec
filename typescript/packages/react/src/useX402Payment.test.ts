import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useX402Payment } from './useX402Payment';

// Mock dependencies
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useWalletClient: vi.fn(),
}));

vi.mock('@x402x/fetch', () => ({
  wrapFetchWithPayment: vi.fn(),
}));

vi.mock('viem', () => ({
  publicActions: vi.fn((client) => ({
    ...client,
    readContract: vi.fn(),
    getBalance: vi.fn(),
  })),
}));

import { useAccount, useWalletClient } from 'wagmi';
import { wrapFetchWithPayment } from '@x402x/fetch';
import { publicActions } from 'viem';

describe('useX402Payment', () => {
  const mockAddress = '0x1234567890123456789012345678901234567890';
  const mockWalletClient = {
    account: {
      address: mockAddress,
    },
    chain: {
      id: 84532,
    },
    extend: vi.fn((fn) => {
      const extended = fn(mockWalletClient);
      return { ...mockWalletClient, ...extended };
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks - provide complete useAccount return value
    vi.mocked(useAccount).mockReturnValue({
      address: mockAddress,
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
      isReconnecting: false,
      status: 'connected',
      connector: undefined,
      chain: undefined,
      chainId: undefined,
      addresses: undefined,
    } as any);

    vi.mocked(useWalletClient).mockReturnValue({
      data: mockWalletClient,
      error: null,
      isError: false,
      isIdle: false,
      isLoading: false,
      isSuccess: true,
      status: 'success',
      dataUpdatedAt: 0,
      errorUpdatedAt: 0,
      failureCount: 0,
      errorUpdateCount: 0,
      isFetched: true,
      isFetchedAfterMount: true,
      isFetching: false,
      isLoadingError: false,
      isPaused: false,
      isPlaceholderData: false,
      isPreviousData: false,
      isRefetchError: false,
      isRefetching: false,
      isStale: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(publicActions).mockReturnValue({
      readContract: vi.fn(),
      getBalance: vi.fn(),
    } as any);
  });

  describe('initial state', () => {
    it('should initialize with idle status', () => {
      const { result } = renderHook(() => useX402Payment());

      expect(result.current.status).toBe('idle');
      expect(result.current.error).toBeNull();
      expect(result.current.result).toBeNull();
    });

    it('should provide wallet address', () => {
      const { result } = renderHook(() => useX402Payment());

      expect(result.current.address).toBe(mockAddress);
      expect(result.current.isConnected).toBe(true);
    });

    it('should indicate not connected when no wallet client', () => {
      vi.mocked(useAccount).mockReturnValue({
        address: undefined,
        isConnected: false,
        isConnecting: false,
        isDisconnected: true,
        isReconnecting: false,
        status: 'disconnected',
        connector: undefined,
        chain: undefined,
        chainId: undefined,
        addresses: undefined,
      } as any);
      
      vi.mocked(useWalletClient).mockReturnValue({
        data: null,
        error: null,
        isError: false,
        isIdle: true,
        isLoading: false,
        isSuccess: false,
        status: 'idle',
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        failureCount: 0,
        errorUpdateCount: 0,
        isFetched: false,
        isFetchedAfterMount: false,
        isFetching: false,
        isLoadingError: false,
        isPaused: false,
        isPlaceholderData: false,
        isPreviousData: false,
        isRefetchError: false,
        isRefetching: false,
        isStale: false,
        refetch: vi.fn(),
      } as any);

      const { result } = renderHook(() => useX402Payment());

      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('pay method', () => {
    it('should make successful payment', async () => {
      const mockFetchWithPay = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      const data = await result.current.pay('/api/test');

      // Status should be success after payment completes
      await waitFor(() => {
        expect(result.current.status).toBe('success');
        expect(result.current.result).toEqual({ success: true });
        expect(result.current.error).toBeNull();
      });

      expect(data).toEqual({ success: true });
      expect(mockFetchWithPay).toHaveBeenCalledWith('/api/test', undefined);
    });

    it('should handle payment with fetch init options', async () => {
      const mockFetchWithPay = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 })
      );
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      const init = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ test: 'data' }),
      };

      await result.current.pay('/api/test', init);

      expect(mockFetchWithPay).toHaveBeenCalledWith('/api/test', init);
    });

    it('should handle custom maxValue option', async () => {
      const mockFetchWithPay = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const maxValue = BigInt(1 * 10 ** 6); // 1 USDC
      const { result } = renderHook(() => useX402Payment({ maxValue }));

      await result.current.pay('/api/test');

      expect(wrapFetchWithPayment).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
        maxValue
      );
    });

    it('should throw error when no wallet client available', async () => {
      vi.mocked(useWalletClient).mockReturnValue({
        data: null,
      } as any);

      const { result } = renderHook(() => useX402Payment());

      await expect(result.current.pay('/api/test')).rejects.toThrow(
        'No wallet client available'
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
        expect(result.current.error).toBe('No wallet client available. Make sure wallet is connected.');
      });
    });

    it('should handle network errors', async () => {
      const mockFetchWithPay = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      await expect(result.current.pay('/api/test')).rejects.toThrow('Network error');

      await waitFor(() => {
        expect(result.current.status).toBe('error');
        expect(result.current.error).toBe('Network error');
      });
    });

    it('should handle API errors (non-200 status)', async () => {
      const mockFetchWithPay = vi.fn().mockResolvedValue(
        new Response('Not found', { status: 404, statusText: 'Not Found' })
      );
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      await expect(result.current.pay('/api/test')).rejects.toThrow(
        'Request failed: 404 Not Found'
      );

      await waitFor(() => {
        expect(result.current.status).toBe('error');
        expect(result.current.error).toContain('Request failed: 404 Not Found');
      });
    });

    it('should extend wallet client with publicActions', async () => {
      const mockFetchWithPay = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      await result.current.pay('/api/test');

      await waitFor(() => {
        expect(mockWalletClient.extend).toHaveBeenCalledWith(publicActions);
        expect(wrapFetchWithPayment).toHaveBeenCalledWith(
          expect.any(Function),
          expect.objectContaining({
            account: expect.any(Object),
            chain: expect.any(Object),
          }),
          undefined // Default maxValue
        );
      });
    });
  });

  describe('reset method', () => {
    it('should reset all state', async () => {
      const mockFetchWithPay = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      // Make a payment
      await result.current.pay('/api/test');

      await waitFor(() => {
        expect(result.current.status).toBe('success');
        expect(result.current.result).toBeTruthy();
      });

      // Reset
      result.current.reset();

      await waitFor(() => {
        expect(result.current.status).toBe('idle');
        expect(result.current.error).toBeNull();
        expect(result.current.result).toBeNull();
      });
    });

    it('should reset after error', async () => {
      const mockFetchWithPay = vi.fn().mockRejectedValue(new Error('Test error'));
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      await expect(result.current.pay('/api/test')).rejects.toThrow();

      await waitFor(() => {
        expect(result.current.status).toBe('error');
        expect(result.current.error).toBeTruthy();
      });

      result.current.reset();

      await waitFor(() => {
        expect(result.current.status).toBe('idle');
        expect(result.current.error).toBeNull();
      });
    });
  });

  describe('state transitions', () => {
    it('should transition from idle -> paying -> success', async () => {
      const mockFetchWithPay = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 })
      );
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      expect(result.current.status).toBe('idle');

      await result.current.pay('/api/test');

      // After payment completes, should be success
      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });
    });

    it('should transition from idle -> paying -> error', async () => {
      const mockFetchWithPay = vi.fn().mockRejectedValue(new Error('Failed'));
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      expect(result.current.status).toBe('idle');

      try {
        await result.current.pay('/api/test');
      } catch (e) {
        // Expected to throw
      }

      // After error, should be in error state
      await waitFor(() => {
        expect(result.current.status).toBe('error');
      });
    });

    it('should transition from success -> idle after reset', async () => {
      const mockFetchWithPay = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 })
      );
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      await result.current.pay('/api/test');

      await waitFor(() => {
        expect(result.current.status).toBe('success');
      });

      result.current.reset();

      await waitFor(() => {
        expect(result.current.status).toBe('idle');
      });
    });
  });

  describe('multiple payments', () => {
    it('should handle multiple sequential payments', async () => {
      const mockFetchWithPay = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ result: 1 }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ result: 2 }), { status: 200 }));
      
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      const data1 = await result.current.pay('/api/test1');
      expect(data1).toEqual({ result: 1 });

      await waitFor(() => {
        expect(result.current.result).toEqual({ result: 1 });
      });

      const data2 = await result.current.pay('/api/test2');
      expect(data2).toEqual({ result: 2 });

      await waitFor(() => {
        expect(result.current.result).toEqual({ result: 2 });
      });
    });
  });

  describe('error handling', () => {
    it('should handle unknown error objects', async () => {
      const mockFetchWithPay = vi.fn().mockRejectedValue({ custom: 'error' });
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      await expect(result.current.pay('/api/test')).rejects.toEqual({ custom: 'error' });

      await waitFor(() => {
        expect(result.current.status).toBe('error');
        expect(result.current.error).toBe('Unknown error occurred');
      });
    });

    it('should preserve error message from Error objects', async () => {
      const errorMessage = 'Specific error message';
      const mockFetchWithPay = vi.fn().mockRejectedValue(new Error(errorMessage));
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      await expect(result.current.pay('/api/test')).rejects.toThrow(errorMessage);

      await waitFor(() => {
        expect(result.current.error).toBe(errorMessage);
      });
    });
  });

  describe('options', () => {
    it('should use default maxValue when not provided', async () => {
      const mockFetchWithPay = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 })
      );
      vi.mocked(wrapFetchWithPayment).mockReturnValue(mockFetchWithPay);

      const { result } = renderHook(() => useX402Payment());

      await result.current.pay('/api/test');

      // Default maxValue should be 0.1 USDC (10^5 atomic units)
      expect(wrapFetchWithPayment).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Object),
        undefined // maxValue defaults to undefined, then wrapped function uses its default
      );
    });

    it('should accept options on initialization', () => {
      const maxValue = BigInt(5 * 10 ** 6);
      const { result } = renderHook(() => useX402Payment({ maxValue }));

      expect(result.current).toBeDefined();
    });
  });
});

