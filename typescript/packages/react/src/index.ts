/**
 * @x402x/react
 * 
 * React hooks for x402x settlement framework
 * 
 * @example
 * ```typescript
 * import { useX402Payment } from '@x402x/react';
 * 
 * function PaymentButton() {
 *   const { pay, status, error } = useX402Payment();
 *   
 *   const handlePay = async () => {
 *     try {
 *       const result = await pay('/api/protected-resource');
 *       console.log('Success:', result);
 *     } catch (err) {
 *       console.error('Failed:', err);
 *     }
 *   };
 *   
 *   return (
 *     <button onClick={handlePay} disabled={status === 'paying'}>
 *       {status === 'paying' ? 'Processing...' : 'Pay'}
 *     </button>
 *   );
 * }
 * ```
 */

export {
  useX402Payment,
  type PaymentStatus,
  type UseX402PaymentOptions,
} from './useX402Payment.js';

