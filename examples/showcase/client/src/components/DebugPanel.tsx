/**
 * Debug Panel Component
 * Displays payment requirements and commitment calculation details
 */

import { DebugInfo } from '../hooks/usePayment';

interface DebugPanelProps {
  debugInfo: DebugInfo;
}

export function DebugPanel({ debugInfo }: DebugPanelProps) {
  const { paymentRequirements, commitmentParams, calculatedNonce, authorizationParams } = debugInfo;

  if (!paymentRequirements && !commitmentParams) {
    return null;
  }

  return (
    <div style={{
      marginTop: '20px',
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderRadius: '8px',
      border: '2px solid #dee2e6',
      fontFamily: 'monospace',
      fontSize: '12px',
    }}>
      <details open>
        <summary style={{
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          marginBottom: '15px',
          color: '#495057',
          fontFamily: 'system-ui',
        }}>
          🔍 Debug Information
        </summary>

        {/* Authorization Parameters */}
        {authorizationParams && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#495057', fontFamily: 'system-ui' }}>
              📋 Authorization Parameters
            </h4>
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '12px', 
              borderRadius: '6px',
              border: '1px solid #dee2e6',
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>ChainId:</strong> {authorizationParams.chainId}
              </div>
              <div style={{ marginBottom: '8px', wordBreak: 'break-all' }}>
                <strong>From:</strong> {authorizationParams.from}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Value:</strong> {authorizationParams.value}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>ValidAfter:</strong> {authorizationParams.validAfter}
              </div>
              <div>
                <strong>ValidBefore:</strong> {authorizationParams.validBefore}
              </div>
            </div>
          </div>
        )}

        {/* Commitment Parameters */}
        {commitmentParams && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#495057', fontFamily: 'system-ui' }}>
              🔐 Commitment Parameters
            </h4>
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '12px', 
              borderRadius: '6px',
              border: '1px solid #dee2e6',
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>ChainId:</strong> {commitmentParams.chainId}
              </div>
              <div style={{ marginBottom: '8px', wordBreak: 'break-all' }}>
                <strong>Hub (SettlementRouter):</strong><br />
                <code style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
                  {commitmentParams.hub}
                </code>
              </div>
              <div style={{ marginBottom: '8px', wordBreak: 'break-all' }}>
                <strong>Token (USDC):</strong><br />
                <code style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
                  {commitmentParams.token}
                </code>
              </div>
              <div style={{ marginBottom: '8px', wordBreak: 'break-all' }}>
                <strong>From (Payer):</strong><br />
                <code style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
                  {commitmentParams.from}
                </code>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>Value:</strong> {commitmentParams.value}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>ValidAfter:</strong> {commitmentParams.validAfter}
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>ValidBefore:</strong> {commitmentParams.validBefore}
              </div>
              <div style={{ marginBottom: '8px', wordBreak: 'break-all' }}>
                <strong>Salt:</strong><br />
                <code style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
                  {commitmentParams.salt}
                </code>
              </div>
              <div style={{ marginBottom: '8px', wordBreak: 'break-all' }}>
                <strong>PayTo (Final Recipient):</strong><br />
                <code style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
                  {commitmentParams.payTo}
                </code>
              </div>
              <div style={{ marginBottom: '8px' }}>
                <strong>FacilitatorFee:</strong> {commitmentParams.facilitatorFee}
              </div>
              <div style={{ marginBottom: '8px', wordBreak: 'break-all' }}>
                <strong>Hook:</strong><br />
                <code style={{ backgroundColor: '#e9ecef', padding: '2px 6px', borderRadius: '4px' }}>
                  {commitmentParams.hook}
                </code>
              </div>
              <div style={{ wordBreak: 'break-all' }}>
                <strong>HookData:</strong><br />
                <code style={{ 
                  backgroundColor: '#e9ecef', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  display: 'block',
                  fontSize: '10px',
                }}>
                  {commitmentParams.hookData?.slice(0, 100)}...
                </code>
              </div>
            </div>
          </div>
        )}

        {/* Calculated Nonce */}
        {calculatedNonce && (
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#495057', fontFamily: 'system-ui' }}>
              🎯 Calculated Commitment (Nonce)
            </h4>
            <div style={{ 
              backgroundColor: '#d4edda', 
              padding: '12px', 
              borderRadius: '6px',
              border: '1px solid #c3e6cb',
            }}>
              <code style={{ 
                display: 'block',
                wordBreak: 'break-all',
                fontSize: '11px',
                color: '#155724',
                fontWeight: 'bold',
              }}>
                {calculatedNonce}
              </code>
            </div>
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              backgroundColor: '#fff3cd', 
              borderRadius: '6px',
              border: '1px solid #ffeaa7',
              fontSize: '11px',
              fontFamily: 'system-ui',
            }}>
              <strong>💡 Note:</strong> This commitment hash is used as the EIP-3009 nonce.
              It binds all settlement parameters to your signature, preventing parameter tampering.
            </div>
          </div>
        )}

        {/* Payment Requirements Summary */}
        {paymentRequirements && (
          <div>
            <h4 style={{ margin: '0 0 10px 0', color: '#495057', fontFamily: 'system-ui' }}>
              📦 Payment Requirements (from Server)
            </h4>
            <details>
              <summary style={{ 
                cursor: 'pointer', 
                padding: '8px',
                backgroundColor: '#fff',
                borderRadius: '4px',
                border: '1px solid #dee2e6',
                marginBottom: '10px',
              }}>
                View Raw JSON
              </summary>
              <pre style={{ 
                backgroundColor: '#fff', 
                padding: '12px', 
                borderRadius: '6px',
                border: '1px solid #dee2e6',
                overflow: 'auto',
                maxHeight: '300px',
                fontSize: '10px',
              }}>
                {JSON.stringify(paymentRequirements, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </details>
    </div>
  );
}

