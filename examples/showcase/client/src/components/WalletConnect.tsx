/**
 * Wallet connection component
 * Displays wallet connection status and connect/disconnect button
 */


interface WalletConnectProps {
  address: string;
  isConnected: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletConnect({
  address,
  isConnected,
  isConnecting,
  onConnect,
  onDisconnect,
}: WalletConnectProps) {
  return (
    <div className="wallet-connect">
      {!isConnected ? (
        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="btn-primary"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div className="wallet-info">
          <span className="wallet-address">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
          <button onClick={onDisconnect} className="btn-secondary">
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

