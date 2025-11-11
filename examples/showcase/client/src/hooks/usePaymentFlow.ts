/**
 * usePaymentFlow Hook
 * 
 * A custom hook for managing payment flow state across all scenario components.
 * Provides consistent state management and event handlers for payment operations.
 * 
 * @example
 * ```typescript
 * function MyPaymentScenario() {
 *   const { paymentResult, error, handleSuccess, handleError, reset } = usePaymentFlow();
 *   
 *   return (
 *     <>
 *       <PaymentButton onClick={() => setShowDialog(true)} isCompleted={!!paymentResult} />
 *       {paymentResult && <TransactionResult {...paymentResult} onNewTransaction={reset} />}
 *       {error && <StatusMessage type="error" title="Payment Failed">{error}</StatusMessage>}
 *     </>
 *   );
 * }
 * ```
 */

import { useState } from 'react';
import { type Network } from '../config';

export interface PaymentResult {
  txHash: string;
  network: Network;
}

export interface PaymentFlowState {
  /** Current payment result (null if no payment made yet) */
  paymentResult: PaymentResult | null;
  /** Current error message (null if no error) */
  error: string | null;
  /** Handler for successful payment */
  handleSuccess: (result: PaymentResult) => void;
  /** Handler for payment error */
  handleError: (err: string) => void;
  /** Reset payment flow state */
  reset: () => void;
  /** Whether payment has been completed */
  isCompleted: boolean;
}

/**
 * Custom hook for managing payment flow state
 * 
 * Centralizes payment state management logic that was previously duplicated
 * across all scenario components.
 */
export function usePaymentFlow(): PaymentFlowState {
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = (result: PaymentResult) => {
    console.log('[usePaymentFlow] Payment success:', result);
    setPaymentResult(result);
    setError(null);
  };

  const handleError = (err: string) => {
    console.error('[usePaymentFlow] Payment error:', err);
    setError(err);
  };

  const reset = () => {
    setPaymentResult(null);
    setError(null);
  };

  return {
    paymentResult,
    error,
    handleSuccess,
    handleError,
    reset,
    isCompleted: !!paymentResult,
  };
}

