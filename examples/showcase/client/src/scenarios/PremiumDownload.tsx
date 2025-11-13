import { useState } from "react";
import { useChainId } from "wagmi";
import { getServerUrl, getNetworkByChainId } from "../config";
import { PaymentDialog } from "../components/PaymentDialog";
import { ScenarioCard } from "../components/ScenarioCard";
import { StatusMessage } from "../components/StatusMessage";
import { CodeBlock } from "../components/CodeBlock";
import premiumDownloadClientCode from "../code-examples/premium-download-client.ts?raw";
import premiumDownloadServerCode from "../code-examples/premium-download-server.ts?raw";

interface DownloadResult {
  success: boolean;
  downloadUrl: string;
  fileName: string;
  expiresAt: string;
  network: string;
}

export function PremiumDownload() {
  const chainId = useChainId();
  const currentNetwork = chainId ? getNetworkByChainId(chainId) : undefined;
  const isMainnet = currentNetwork === "base" || currentNetwork === "x-layer";

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [downloadResult, setDownloadResult] = useState<DownloadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = () => {
    // Clear previous results
    setDownloadResult(null);
    setError(null);

    // Show payment dialog (wallet connection will be handled inside PaymentDialog)
    setShowPaymentDialog(true);
  };

  const handlePaymentSuccess = (result: any) => {
    console.log("[PremiumDownload] Payment successful:", result);
    if (result.success && result.downloadUrl) {
      setDownloadResult(result as DownloadResult);
      setShowPaymentDialog(false);
    }
  };

  const handlePaymentError = (errorMsg: string) => {
    console.error("[PremiumDownload] Payment error:", errorMsg);
    setError(errorMsg);
  };

  const handleDownload = () => {
    if (downloadResult?.downloadUrl) {
      const serverUrl = getServerUrl();
      const fullUrl = serverUrl
        ? `${serverUrl}${downloadResult.downloadUrl}`
        : downloadResult.downloadUrl;
      window.open(fullUrl, "_blank");
    }
  };

  const handleReset = () => {
    setDownloadResult(null);
    setShowPaymentDialog(false);
    setError(null);
  };

  return (
    <ScenarioCard
      title="📥 Premium Download"
      badge="Server Mode"
      description={
        <>
          <p>
            Purchase the exclusive <strong>"x402 Protocol Whitepaper"</strong> PDF for{" "}
            <strong>$0.10 USDC</strong>. This content requires server-side processing for secure
            delivery.
          </p>

          {/* Mainnet Warning */}
          {isMainnet && (
            <div
              style={{
                margin: "20px 0",
                padding: "15px",
                backgroundColor: "#fff3cd",
                borderRadius: "8px",
                borderLeft: "4px solid #ffc107",
              }}
            >
              <h4 style={{ margin: "0 0 10px 0", color: "#856404" }}>⚠️ Mainnet Not Supported</h4>
              <p
                style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#856404", lineHeight: 1.6 }}
              >
                Premium Download scenario is currently only available on testnets because it requires
                server-side verification. Please switch to <strong>Base Sepolia</strong> or{" "}
                <strong>X Layer Testnet</strong> to try this feature.
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#856404" }}>
                💡{" "}
                <em>
                  Other scenarios (Split Payment, NFT Mint, Reward Points) support both mainnet and
                  testnet.
                </em>
              </p>
            </div>
          )}

          {/* Features */}
          <div
            style={{
              margin: "20px 0",
              padding: "15px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              borderLeft: "4px solid #667eea",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", color: "#333" }}>✨ Features:</h4>
            <ul style={{ margin: 0, paddingLeft: "20px" }}>
              <li style={{ margin: "8px 0", lineHeight: 1.6 }}>
                🔐 <strong>Server Verification</strong>: Payment verified before content access
              </li>
              <li style={{ margin: "8px 0", lineHeight: 1.6 }}>
                ⏱️ <strong>Temporary Links</strong>: Download URLs expire after 24 hours
              </li>
              <li style={{ margin: "8px 0", lineHeight: 1.6 }}>
                📊 <strong>Access Control</strong>: Server tracks and validates all downloads
              </li>
              <li style={{ margin: "8px 0", lineHeight: 1.6 }}>
                🖥️ <strong>Server Mode</strong>: Backend controls payment requirements
              </li>
              <li style={{ margin: "8px 0", lineHeight: 1.6 }}>
                💰 <strong>Real Payment</strong>: Actual USDC payment (not returned in this demo)
              </li>
            </ul>
          </div>

          {/* How It Works */}
          <div
            style={{
              margin: "20px 0",
              padding: "15px",
              backgroundColor: "#f0f9ff",
              borderRadius: "8px",
              border: "1px solid #bfdbfe",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#1e40af" }}>
              💡 How it works:
            </h4>
            <ol
              style={{
                margin: 0,
                paddingLeft: "20px",
                fontSize: "13px",
                lineHeight: "1.8",
                color: "#1e40af",
              }}
            >
              <li>Click "Purchase & Download" button</li>
              <li>Server generates payment requirements with resource details</li>
              <li>Connect wallet and sign the payment authorization</li>
              <li>Server verifies payment and generates temporary download link</li>
              <li>Download the whitepaper using the secure link</li>
            </ol>
          </div>

          {/* Technical Flow - Client Side */}
          <CodeBlock
            code={premiumDownloadClientCode}
            title="🔧 Technical Flow - Client:"
            borderColor="#3b82f6"
          />

          {/* Technical Flow - Server Side */}
          <CodeBlock
            code={premiumDownloadServerCode}
            title="🔧 Technical Flow - Server:"
            borderColor="#28a745"
          />

          <p>
            Upon successful payment, the server will generate a unique, time-limited download link for
            you.
          </p>
          <div
            style={{
              marginTop: "20px",
              padding: "15px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              fontSize: "14px",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0", color: "#333" }}>📚 Content Details:</h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              <li style={{ marginBottom: "5px" }}>
                <strong>Title:</strong> x402 Protocol Whitepaper
              </li>
              <li style={{ marginBottom: "5px" }}>
                <strong>Format:</strong> PDF
              </li>
              <li style={{ marginBottom: "5px" }}>
                <strong>Size:</strong> ~2.5 MB
              </li>
              <li style={{ marginBottom: "5px" }}>
                <strong>Price:</strong> $0.10 USDC
              </li>
            </ul>
          </div>
        </>
      }
    >
      {/* Purchase Button */}
      <button
        onClick={handlePurchase}
        disabled={!!downloadResult || isMainnet}
        className="btn-pay"
        style={{
          opacity: downloadResult || isMainnet ? 0.6 : 1,
          cursor: downloadResult || isMainnet ? "not-allowed" : "pointer",
        }}
      >
        {isMainnet
          ? "⚠️ Not Available on Mainnet"
          : downloadResult
            ? "✅ Purchased"
            : "💳 Purchase & Download ($0.1 USDC)"}
      </button>

      {downloadResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
          <button
            onClick={handleDownload}
            className="btn-secondary"
          >
            ⬇️ Download "{downloadResult.fileName}"
          </button>
          <button onClick={handleReset} className="btn-secondary">
            Purchase Another
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <StatusMessage type="error" title="Purchase Failed">
          {error}
        </StatusMessage>
      )}

      {/* Success Result */}
      {downloadResult && (
        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            backgroundColor: "#d4edda",
            borderRadius: "8px",
            border: "1px solid #c3e6cb",
          }}
        >
          <h4 style={{ margin: "0 0 15px 0", color: "#155724" }}>✅ Purchase Successful!</h4>

          <div style={{ marginBottom: "15px" }}>
            <div
              style={{
                fontSize: "14px",
                color: "#155724",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              📄 Download Link:
            </div>
            <code
              style={{
                display: "block",
                padding: "10px",
                backgroundColor: "#fff",
                borderRadius: "4px",
                fontSize: "12px",
                wordBreak: "break-all",
                color: "#155724",
                border: "1px solid #c3e6cb",
              }}
            >
              {downloadResult.downloadUrl}
            </code>
          </div>

          <div style={{ marginBottom: "10px", fontSize: "14px", color: "#155724" }}>
            <strong>📦 File:</strong> {downloadResult.fileName}
          </div>
          <div style={{ marginBottom: "10px", fontSize: "14px", color: "#155724" }}>
            <strong>⏰ Expires:</strong> {new Date(downloadResult.expiresAt).toLocaleString()}
          </div>
          <div style={{ fontSize: "14px", color: "#155724" }}>
            <strong>🌐 Network:</strong> {downloadResult.network}
          </div>
        </div>
      )}

      {/* Payment Dialog */}
      <PaymentDialog
        isOpen={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        amount="$0.10"
        currency="USDC"
        endpoint="/api/purchase-download"
        getRequestBody={(userAddress) => ({
          walletAddress: userAddress,
          contentId: "x402-protocol-whitepaper",
        })}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
      />
    </ScenarioCard>
  );
}
