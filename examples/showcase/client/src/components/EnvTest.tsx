/**
 * Environment Variables Test Component
 * Shows all VITE_ environment variables for debugging
 */

import { getFacilitatorUrl, getServerUrl } from '../config';

export function EnvTest() {
  // Test both direct import.meta.env and helper functions
  const envVars = {
    'import.meta.env.VITE_SERVER_URL': import.meta.env.VITE_SERVER_URL,
    'import.meta.env.VITE_FACILITATOR_URL': import.meta.env.VITE_FACILITATOR_URL,
    'getServerUrl()': getServerUrl(),
    'getFacilitatorUrl()': getFacilitatorUrl(),
    'import.meta.env.MODE': import.meta.env.MODE,
    'import.meta.env.DEV': String(import.meta.env.DEV),
    'import.meta.env.PROD': String(import.meta.env.PROD),
  };

  // Log to console for easy debugging
  console.log('🔍 Environment Variables:', envVars);

  return (
    <div style={{
      position: 'fixed',
      top: '100px',
      left: '20px',
      padding: '20px',
      backgroundColor: '#fff',
      border: '2px solid #333',
      borderRadius: '8px',
      maxWidth: '600px',
      maxHeight: '80vh',
      overflow: 'auto',
      zIndex: 10000,
      fontSize: '12px',
      fontFamily: 'monospace',
    }}>
      <h3 style={{ margin: '0 0 15px 0' }}>🔍 Environment Variables Debug</h3>
      
      {Object.entries(envVars).map(([key, value]) => (
        <div key={key} style={{ marginBottom: '10px' }}>
          <div style={{ fontWeight: 'bold', color: '#333', fontSize: '11px' }}>{key}:</div>
          <div style={{ 
            padding: '6px 8px', 
            backgroundColor: value ? '#d4edda' : '#f8d7da',
            borderRadius: '4px',
            wordBreak: 'break-all',
            marginTop: '4px'
          }}>
            {value || '(undefined)'}
          </div>
        </div>
      ))}

      <div style={{
        marginTop: '15px',
        padding: '10px',
        backgroundColor: '#fff3cd',
        borderRadius: '4px',
        border: '1px solid #ffc107'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>📝 Troubleshooting:</div>
        <ol style={{ margin: '5px 0', paddingLeft: '20px', fontSize: '11px' }}>
          <li>Check .env file exists in client directory</li>
          <li>Variables must start with VITE_</li>
          <li>Restart dev server with Ctrl+C then pnpm dev</li>
          <li>Check no .env.local override</li>
          <li>Hard refresh browser (Cmd+Shift+R)</li>
        </ol>
      </div>
    </div>
  );
}

