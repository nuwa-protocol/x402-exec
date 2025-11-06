import { useState, useCallback } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { publicActions } from 'viem';
import { x402xFetch } from '@x402x/fetch';

/**
 * Hook options
 */
export interface UseX402PaymentOptions {
  /**
   * Maximum allowed payment amount (in token base units)
   * Defaults to 0.1 USDC = 10^5
   */
  maxValue?: bigint;
}

/**
 * Payment status type
 */
export type PaymentStatus = 'idle' | 'paying' | 'success' | 'error';

/**
 * React Hook for handling x402x payments
 * 
 * Provides a simple interface for making paid API requests with automatic
 * 402 handling and settlement mode support.
 * 
 * @param options - Hook configuration options
 * @returns Payment state and methods
 * 
 * @example
 * ```typescript
 * import { useX402Payment } from '@x402x/react';
 * 
 * function MyComponent() {
 *   const { status, error, result, pay, reset } = useX402Payment();
 * 
 *   const handlePayment = async () => {
 *     try {
 *       const data = await pay('/api/premium-content');
 *       console.log('Received data:', data);
 *     } catch (err) {
 *       console.error('Payment failed:', err);
 *     }
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={handlePayment} disabled={status === 'paying'}>
 *         {status === 'paying' ? 'Processing...' : 'Pay & Fetch'}
 *       </button>
 *       {error && <div>Error: {error}</div>}
 *       {result && <div>Success: {JSON.stringify(result)}</div>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useX402Payment(options?: UseX402PaymentOptions) {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  
  /**
   * Make a paid API request
   * 
   * @param url - The URL to fetch
   * @param init - Optional fetch init options
   * @returns The response data (parsed JSON)
   */
  const pay = useCallback(async (url: string, init?: RequestInit) => {
    if (!walletClient) {
      const error = 'No wallet client available. Make sure wallet is connected.';
      setStatus('error');
      setError(error);
      throw new Error(error);
    }
    
    setStatus('paying');
    setError(null);
    
    try {
      // Extend wagmi's wallet client with publicActions to make it compatible with Signer type
      // This follows the same pattern used in x402's PaywallApp
      const extendedWalletClient = walletClient.extend(publicActions);
      
      const fetchWithPay = x402xFetch(fetch, extendedWalletClient as any, options?.maxValue);
      const response = await fetchWithPay(url, init);
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setResult(data);
      setStatus('success');
      return data;
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown error occurred';
      setError(errorMessage);
      setStatus('error');
      throw err;
    }
  }, [walletClient, options?.maxValue]);
  
  /**
   * Reset the hook state
   */
  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setResult(null);
  }, []);
  
  return {
    /**
     * Current payment status
     */
    status,
    
    /**
     * Error message (if any)
     */
    error,
    
    /**
     * Result data from successful payment (if any)
     */
    result,
    
    /**
     * User's connected wallet address
     */
    address,
    
    /**
     * Whether wallet is connected
     */
    isConnected: !!walletClient,
    
    /**
     * Make a paid API request
     */
    pay,
    
    /**
     * Reset the hook state
     */
    reset,
  };
}
