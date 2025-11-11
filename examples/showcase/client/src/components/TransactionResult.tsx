/**
 * TransactionResult Component
 * 
 * Displays transaction details including hash, network info, and explorer link.
 * Used after successful payment transactions.
 */

import { type Network, NETWORKS } from '../config';

interface DetailItem {
  label: string;
  value: string | JSX.Element;
}

interface TransactionResultProps {
  txHash: string;
  network: Network;
  details?: DetailItem[];
  onNewTransaction?: () => void;
  newTransactionLabel?: string;
}

export function TransactionResult({
  txHash,
  network,
  details = [],
  onNewTransaction,
  newTransactionLabel = 'Make Another Payment',
}: TransactionResultProps) {
  const networkConfig = NETWORKS[network];

  return (
    <div
      style={{
        marginTop: '20px',
        padding: '20px',
        backgroundColor: '#d4edda',
        borderRadius: '8px',
        border: '1px solid #c3e6cb',
      }}
    >
      <h4 style={{ margin: '0 0 15px 0', color: '#155724' }}>
        ✅ Transaction Successful!
      </h4>

      {/* Transaction Hash */}
      <div style={{ marginBottom: '15px' }}>
        <div
          style={{
            fontSize: '14px',
            color: '#155724',
            marginBottom: '5px',
            fontWeight: 'bold',
          }}
        >
          Transaction Hash:
        </div>
        <code
          style={{
            display: 'block',
            backgroundColor: '#fff',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '12px',
            wordBreak: 'break-all',
            fontFamily: 'monospace',
          }}
        >
          {txHash}
        </code>
      </div>

      {/* Details */}
      {details.length > 0 && (
        <div style={{ marginBottom: '15px', fontSize: '14px', lineHeight: '1.8' }}>
          <div>
            <strong>📊 Transaction Details:</strong>
          </div>
          <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
            {details.map((item, index) => (
              <li key={index}>
                {item.label}: {item.value}
              </li>
            ))}
            <li>
              Network: <strong>{networkConfig.name}</strong>
            </li>
          </ul>
        </div>
      )}

      {/* Explorer Link */}
      <a
        href={`${networkConfig.explorerUrl}/tx/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-block',
          padding: '10px 20px',
          backgroundColor: '#28a745',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: 'bold',
          transition: 'background-color 0.2s',
          marginRight: onNewTransaction ? '10px' : '0',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#218838')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#28a745')}
      >
        🔍 View on Explorer →
      </a>

      {/* New Transaction Button */}
      {onNewTransaction && (
        <button
          onClick={onNewTransaction}
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#0056b3')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#007bff')}
        >
          {newTransactionLabel}
        </button>
      )}
    </div>
  );
}

