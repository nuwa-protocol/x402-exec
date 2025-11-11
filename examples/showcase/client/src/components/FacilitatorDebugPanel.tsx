/**
 * Facilitator Debug Panel Component
 * Shows current facilitator URL and server URL for debugging
 */

import { getFacilitatorUrl, getServerUrl } from '../config';

export function FacilitatorDebugPanel() {
  const facilitatorUrl = getFacilitatorUrl();
  const serverUrl = getServerUrl();
  const isLocalFacilitator = facilitatorUrl.includes('localhost') || facilitatorUrl.includes('127.0.0.1');
  const isLocalServer = serverUrl && (serverUrl.includes('localhost') || serverUrl.includes('127.0.0.1'));

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: (isLocalFacilitator || isLocalServer) ? '#fff3cd' : '#f8f9fa',
      border: `2px solid ${(isLocalFacilitator || isLocalServer) ? '#ffc107' : '#dee2e6'}`,
      borderRadius: '8px',
      padding: '12px 16px',
      fontSize: '12px',
      fontFamily: 'monospace',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      zIndex: 9999,
      maxWidth: '400px',
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
        🔧 Debug Info
      </div>
      
      <div style={{ marginBottom: '6px' }}>
        <strong>Facilitator:</strong>
        <div style={{ 
          marginTop: '4px',
          padding: '6px 8px',
          backgroundColor: isLocalFacilitator ? '#fff' : '#e9ecef',
          borderRadius: '4px',
          wordBreak: 'break-all',
        }}>
          {facilitatorUrl}
        </div>
      </div>

      <div style={{ marginBottom: '6px' }}>
        <strong>Server:</strong>
        <div style={{ 
          marginTop: '4px',
          padding: '6px 8px',
          backgroundColor: isLocalServer ? '#fff' : '#e9ecef',
          borderRadius: '4px',
          wordBreak: 'break-all',
        }}>
          {serverUrl || '(relative - Vite proxy)'}
        </div>
      </div>

      {(isLocalFacilitator || isLocalServer) && (
        <div style={{
          marginTop: '8px',
          padding: '8px',
          backgroundColor: '#fff',
          borderRadius: '4px',
          border: '1px solid #ffc107',
        }}>
          <div style={{ color: '#856404', fontWeight: 'bold', marginBottom: '4px' }}>
            ⚠️ Local Development Mode
          </div>
          <div style={{ color: '#856404', fontSize: '11px' }}>
            {isLocalFacilitator && <div>• Facilitator: localhost</div>}
            {isLocalServer && <div>• Server: localhost</div>}
            <div style={{ marginTop: '4px' }}>Make sure local services are running!</div>
          </div>
        </div>
      )}

      <div style={{ 
        marginTop: '8px', 
        paddingTop: '8px', 
        borderTop: '1px solid #dee2e6',
        fontSize: '11px',
        color: '#6c757d'
      }}>
        💡 To change: Edit <code>.env</code> and restart dev server
      </div>
    </div>
  );
}
