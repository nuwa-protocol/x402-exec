/**
 * Payment Method Selector Component
 * Allows users to select which network to use for payment
 */

import { Network, NETWORKS, getPreferredNetwork, setPreferredNetwork } from '../config';
import { NetworkBalance } from '../hooks/useNetworkBalances';
import './PaymentMethodSelector.css';

interface PaymentMethodSelectorProps {
  amount: string;
  currency: string;
  balances: Record<Network, NetworkBalance>;
  selectedNetwork: Network | null;
  onSelect: (network: Network) => void;
  disabled?: boolean;
  showBalances?: boolean; // New prop to control balance display
}

export function PaymentMethodSelector({
  amount,
  currency,
  balances,
  selectedNetwork,
  onSelect,
  disabled = false,
  showBalances = true,
}: PaymentMethodSelectorProps) {
  const handleSelect = (network: Network) => {
    onSelect(network);
    // Remember user's choice
    setPreferredNetwork(network);
  };

  // Auto-select preferred network on mount if none selected
  if (!selectedNetwork && !disabled) {
    const preferred = getPreferredNetwork();
    if (preferred) {
      setTimeout(() => onSelect(preferred), 0);
    }
  }

  return (
    <div className="payment-method-selector">
      <div className="selector-header">
        <h3>Choose Payment Network</h3>
        <p className="selector-description">
          Select which network to use for paying {amount} {currency}
        </p>
      </div>

      <div className="network-options">
        {(Object.keys(NETWORKS) as Network[]).map((network) => {
          const config = NETWORKS[network];
          const balance = balances[network];
          const isSelected = selectedNetwork === network;
          const hasBalance = showBalances ? parseFloat(balance?.balance || '0') >= parseFloat(amount) : true;
          const isAvailable = showBalances ? (!balance?.loading && !balance?.error && hasBalance) : true;

          return (
            <button
              key={network}
              className={`network-option ${isSelected ? 'selected' : ''} ${!isAvailable ? 'unavailable' : ''}`}
              onClick={() => !disabled && handleSelect(network)}
              disabled={disabled}
            >
              <div className="network-option-header">
                <div className="network-info">
                  <span className="network-icon">{config.icon}</span>
                  <div className="network-details">
                    <span className="network-name">{config.displayName}</span>
                    {isSelected && <span className="selected-badge">✓ Selected</span>}
                  </div>
                </div>
                <div className={`radio-indicator ${isSelected ? 'checked' : ''}`}>
                  {isSelected && <span>●</span>}
                </div>
              </div>

              <div className="network-option-body">
                {showBalances && balance?.loading && (
                  <div className="balance-info loading">
                    <span>Loading balance...</span>
                  </div>
                )}

                {showBalances && balance?.error && (
                  <div className="balance-info error">
                    <span>⚠️ Failed to load balance</span>
                  </div>
                )}

                {showBalances && balance && !balance.loading && !balance.error && (
                  <>
                    <div className="balance-info">
                      <span className="balance-label">Balance:</span>
                      <span className="balance-value">{balance.balance} {currency}</span>
                    </div>

                    {!hasBalance && (
                      <div className="warning-message">
                        <span>⚠️ Insufficient balance</span>
                        <a
                          href={config.faucetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="faucet-link"
                        >
                          Get Test {currency}
                        </a>
                      </div>
                    )}

                    {hasBalance && isAvailable && (
                      <div className="ready-message">
                        <span>✓ Ready to pay</span>
                      </div>
                    )}
                  </>
                )}

                {!showBalances && (
                  <div className="network-info-message">
                    <span>Balance will be checked when connecting wallet</span>
                    <a
                      href={config.faucetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="faucet-link"
                      style={{ marginTop: '8px', display: 'block' }}
                    >
                      Get Test {currency} →
                    </a>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selectedNetwork && (
        <div className="selected-network-summary">
          <p>
            You will pay <strong>{amount} {currency}</strong> on{' '}
            <strong>{NETWORKS[selectedNetwork].displayName}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

