import { useState } from 'react';
import { useAccount } from 'wagmi';
import { getServerUrl } from '../config';
import { PaymentDialog } from '../components/PaymentDialog';

interface DownloadResult {
  success: boolean;
  downloadUrl: string;
  fileName: string;
  expiresAt: string;
  network: string;
}

export function PremiumDownload() {
  const { address, isConnected } = useAccount();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = () => {
    if (!isConnected || !address) {
      alert('Please connect your wallet first');
      return;
    }

    // Clear previous results
    setDownloadResult(null);
    setError(null);

    // Show payment dialog
    setShowPaymentDialog(true);
  };

  const handlePaymentSuccess = (result: any) => {
    console.log('[PremiumDownload] Payment successful:', result);
    if (result.success && result.downloadUrl) {
      setDownloadResult(result as DownloadResult);
      setShowPaymentDialog(false);
    }
  };

  const handlePaymentError = (errorMsg: string) => {
    console.error('[PremiumDownload] Payment error:', errorMsg);
    setError(errorMsg);
  };

  const handleDownload = () => {
    if (downloadResult?.downloadUrl) {
      const serverUrl = getServerUrl();
      const fullUrl = serverUrl 
        ? `${serverUrl}${downloadResult.downloadUrl}` 
        : downloadResult.downloadUrl;
      window.open(fullUrl, '_blank');
    }
  };

  const handleReset = () => {
    setDownloadResult(null);
    setShowPaymentDialog(false);
    setError(null);
  };

  return (
    <div className="scenario-card">
      <div className="scenario-header">
        <h2>📄 Premium Content Download</h2>
        <span className="badge badge-server">Server Mode</span>
      </div>

      <div className="scenario-description">
        <p>
          Purchase the exclusive <strong>"x402 Protocol Whitepaper"</strong> PDF for{' '}
          <strong>$0.10 USDC</strong>. This content requires server-side processing for secure delivery.
        </p>
        <p>
          Upon successful payment, the server will generate a unique, time-limited download link for you.
        </p>
        <div className="content-details" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px', fontSize: '14px' }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#333' }}>📚 Content Details:</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li style={{ marginBottom: '5px' }}><strong>Title:</strong> x402 Protocol Whitepaper</li>
            <li style={{ marginBottom: '5px' }}><strong>Format:</strong> PDF</li>
            <li style={{ marginBottom: '5px' }}><strong>Size:</strong> ~2.5 MB</li>
            <li style={{ marginBottom: '5px' }}><strong>Price:</strong> $0.10 USDC</li>
          </ul>
        </div>
      </div>

      <div className="scenario-form">
        <button
          onClick={handlePurchase}
          disabled={!!downloadResult}
          className="btn-pay"
          style={{
            opacity: downloadResult ? 0.6 : 1,
            cursor: downloadResult ? 'not-allowed' : 'pointer'
          }}
        >
          {downloadResult ? '✅ Purchased' : '💳 Purchase & Download ($0.1 USDC)'}
        </button>

        {downloadResult && (
          <>
            <button
              onClick={handleDownload}
              className="btn-secondary"
              style={{ marginTop: '10px' }}
            >
              ⬇️ Download "{downloadResult.fileName}"
            </button>
            <button
              onClick={handleReset}
              className="btn-secondary"
              style={{ marginTop: '10px' }}
            >
              Purchase Another
            </button>
          </>
        )}
      </div>

      {error && (
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#fee', 
          borderRadius: '8px',
          border: '1px solid #fcc'
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#c00' }}>❌ Purchase Failed</h4>
          <p style={{ margin: 0, fontSize: '14px', color: '#600' }}>{error}</p>
        </div>
      )}

      {downloadResult && (
        <div style={{ 
          marginTop: '20px', 
          padding: '20px', 
          backgroundColor: '#d4edda', 
          borderRadius: '8px',
          border: '1px solid #c3e6cb'
        }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#155724' }}>✅ Purchase Successful!</h4>
          
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '14px', color: '#155724', marginBottom: '5px', fontWeight: 'bold' }}>
              Download Link:
            </div>
            <code style={{ 
              display: 'block', 
              backgroundColor: '#fff', 
              padding: '10px', 
              borderRadius: '4px', 
              fontSize: '12px',
              wordBreak: 'break-all',
              fontFamily: 'monospace'
            }}>
              {downloadResult.downloadUrl}
            </code>
          </div>

          <div style={{ marginBottom: '15px', fontSize: '14px', lineHeight: '1.8' }}>
            <div><strong>📊 Purchase Details:</strong></div>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>Content: <strong>{downloadResult.fileName}</strong></li>
              <li>Network: <strong>{downloadResult.network}</strong></li>
              <li>Expires: <strong>{new Date(downloadResult.expiresAt).toLocaleString()}</strong></li>
              <li>Mode: <strong>Server</strong> 📄</li>
            </ul>
          </div>

          <button
            onClick={handleDownload}
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#218838'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
          >
            ⬇️ Download Now →
          </button>
        </div>
      )}

      {/* Payment Dialog */}
      {showPaymentDialog && (
        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          amount="$0.10"
          currency="USDC"
          endpoint="/api/purchase-download"
          getRequestBody={(userAddress) => ({
            walletAddress: userAddress,
            contentId: 'x402-protocol-guide',
            // network will be added by PaymentDialog
          })}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
        />
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .badge-server {
          background: linear-gradient(135deg, #f7971e 0%, #ffd200 100%);
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
