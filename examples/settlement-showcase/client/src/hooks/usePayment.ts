/**
 * Payment processing hook
 * Handles x402 payment flow with commitment-based security
 * 
 * This implementation manually constructs the payment flow to use
 * commitment hash as the EIP-3009 nonce, ensuring all settlement
 * parameters are cryptographically bound to the user's signature.
 */

import { useState } from 'react';
import { useWalletClient } from 'wagmi';
import { calculateCommitment, validateCommitmentParams } from '../utils/commitment';
import { type Hex } from 'viem';

export type PaymentStatus = 'idle' | 'preparing' | 'paying' | 'signing' | 'submitting' | 'success' | 'error';

interface PaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: {
    name?: string;
    version?: string;
    settlementRouter?: string;
    salt?: string;
    payTo?: string;
    facilitatorFee?: string;
    hook?: string;
    hookData?: string;
    [key: string]: any;
  };
}

interface PaymentResponse {
  accepts?: PaymentRequirements[];
  error?: string;
  x402Version?: number;
}

export interface DebugInfo {
  paymentRequirements?: any;
  commitmentParams?: any;
  calculatedNonce?: string;
  authorizationParams?: any;
}

export function usePayment() {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({});
  const { data: walletClient } = useWalletClient();

  const pay = async (endpoint: string, body?: any) => {
    if (!walletClient) {
      setError('Please connect your wallet first');
      setStatus('error');
      throw new Error('Wallet not connected');
    }

    setStatus('preparing');
    setError('');
    setResult(null);

    try {
      console.log('[Payment] Step 1: Initial request to', endpoint);
      
      // Step 1: Make initial request to get 402 response
      const initialResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      // If not 402, return the response directly
      if (initialResponse.status !== 402) {
        if (!initialResponse.ok) {
          const errorData = await initialResponse.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Request failed with status ${initialResponse.status}`);
        }
        const data = await initialResponse.json();
        setResult(data);
        setStatus('success');
        return data;
      }

      // Step 2: Parse 402 response to get payment requirements
      const paymentResponse: PaymentResponse = await initialResponse.json();
      console.log('[Payment] Step 2: Received 402 response', paymentResponse);
      
      if (!paymentResponse.accepts || paymentResponse.accepts.length === 0) {
        throw new Error('No payment requirements provided');
      }

      const paymentReq = paymentResponse.accepts[0];
      const x402Version = paymentResponse.x402Version || 1;

      // Store payment requirements for debugging
      setDebugInfo(prev => ({ ...prev, paymentRequirements: paymentReq }));

      // Step 3: Extract settlement parameters from extra field
      const {
        settlementRouter,
        salt,
        payTo: finalPayTo,
        facilitatorFee,
        hook,
        hookData,
        name,
        version,
      } = paymentReq.extra || {};

      // Check if this is a complex settlement (with router/hook) or simple direct payment
      const isComplexSettlement = !!settlementRouter;

      if (isComplexSettlement && (!salt || !finalPayTo || !hook || !hookData)) {
        throw new Error('Missing required settlement parameters in payment requirements');
      }

      console.log('[Payment] Step 3: Settlement parameters', {
        isComplexSettlement,
        settlementRouter,
        salt,
        finalPayTo,
        facilitatorFee,
        hook,
      });

      setStatus('preparing');

      // Step 4: Prepare EIP-3009 authorization parameters
      const chainId = await walletClient.getChainId();
      const from = walletClient.account?.address;
      
      if (!from) {
        throw new Error('No account address available');
      }

      const value = paymentReq.maxAmountRequired;
      const validAfter = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes before
      const validBefore = (Math.floor(Date.now() / 1000) + paymentReq.maxTimeoutSeconds).toString();

      const authParams = {
        chainId,
        from,
        value,
        validAfter,
        validBefore,
      };
      console.log('[Payment] Step 4: Authorization parameters', authParams);
      
      // Store authorization parameters for debugging
      setDebugInfo(prev => ({ ...prev, authorizationParams: authParams }));

      // Step 5: Calculate nonce
      // Two modes: commitment-based (for complex settlement) or random (for simple payment)
      let nonce: Hex;
      
      if (isComplexSettlement) {
        // Complex settlement: Calculate commitment hash (this becomes the nonce)
        const commitmentParams = {
          chainId,
          hub: settlementRouter!,
          token: paymentReq.asset,
          from,
          value,
          validAfter,
          validBefore,
          salt: salt!,
          payTo: finalPayTo!,
          facilitatorFee: facilitatorFee || '0',
          hook: hook!,
          hookData: hookData!,
        };

        // Validate parameters before calculating commitment
        validateCommitmentParams(commitmentParams);

        nonce = calculateCommitment(commitmentParams) as Hex;
        
        console.log('[Payment] Step 5: Calculated commitment-based nonce', nonce);
        
        // Store commitment params and calculated nonce for debugging
        setDebugInfo(prev => ({ 
          ...prev, 
          commitmentParams,
          calculatedNonce: nonce 
        }));
      } else {
        // Simple direct payment: Generate random nonce
        const randomBytes = crypto.getRandomValues(new Uint8Array(32));
        nonce = `0x${Array.from(randomBytes)
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')}` as Hex;
        
        console.log('[Payment] Step 5: Generated random nonce', nonce);
        
        // Store nonce for debugging
        setDebugInfo(prev => ({ 
          ...prev, 
          calculatedNonce: nonce,
          nonceType: 'random'
        }));
      }

      setStatus('signing');

      // Step 6: Sign EIP-712 authorization (EIP-3009)
      const domain = {
        name: name || 'USDC',
        version: version || '2',
        chainId,
        verifyingContract: paymentReq.asset as Hex,
      };

      const types = {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      };

      const message = {
        from,
        to: (isComplexSettlement ? settlementRouter : paymentReq.payTo) as Hex,
        value: BigInt(value),
        validAfter: BigInt(validAfter),
        validBefore: BigInt(validBefore),
        nonce,
      };

      console.log('[Payment] Step 6: Signing EIP-712 message', { domain, message });

      const signature = await walletClient.signTypedData({
        domain,
        types,
        primaryType: 'TransferWithAuthorization',
        message,
      });

      console.log('[Payment] Signature obtained', signature);

      setStatus('submitting');

      // Step 7: Construct payment payload
      // IMPORTANT: Include the original paymentRequirements in the payload
      // This ensures the server uses the SAME salt and parameters
      const paymentPayload = {
        x402Version,
        scheme: paymentReq.scheme,
        network: paymentReq.network,
        payload: {
          signature,
          authorization: {
            from,
            to: (isComplexSettlement ? settlementRouter : paymentReq.payTo),
            value,
            validAfter,
            validBefore,
            nonce,
          },
        },
        paymentRequirements: paymentReq, // Include original requirements
      };

      // Step 8: Encode payment header (base64url)
      const paymentJson = JSON.stringify(paymentPayload);
      const paymentBase64 = btoa(paymentJson)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      console.log('[Payment] Step 8: Encoded payment header (first 100 chars)', paymentBase64.substring(0, 100));

      // Step 9: Resend request with X-PAYMENT header
      const finalResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PAYMENT': paymentBase64,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      console.log('[Payment] Step 9: Final response status', finalResponse.status);

      if (!finalResponse.ok) {
        const errorData = await finalResponse.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Payment failed with status ${finalResponse.status}`);
      }

      const data = await finalResponse.json();
      console.log('[Payment] Payment successful', data);
      
      setResult(data);
      setStatus('success');
      
      return data;
    } catch (err: any) {
      console.error('[Payment] Payment error:', err);
      setError(err.message || 'Payment failed');
      setStatus('error');
      throw err;
    }
  };

  const reset = () => {
    setStatus('idle');
    setError('');
    setResult(null);
    setDebugInfo({});
  };

  return {
    status,
    error,
    result,
    debugInfo,
    pay,
    reset,
  };
}

