/**
 * Network Switch Hook
 * Automatically checks and switches to the correct network (Base Sepolia)
 */

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

const BASE_SEPOLIA_CHAIN_ID_HEX = '0x14a34'; // 84532 in hex

// Type for EIP-1193 provider
interface EIP1193Provider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
}

export function useNetworkSwitch() {
  const { isConnected, connector } = useAccount();
  const [isCheckingNetwork, setIsCheckingNetwork] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  useEffect(() => {
    const checkAndSwitchNetwork = async () => {
      if (!isConnected || !connector) return;

      setIsCheckingNetwork(true);
      setNetworkError(null);

      try {
        // Get the provider from connector
        const provider = await connector.getProvider() as EIP1193Provider;
        
        if (!provider || typeof provider.request !== 'function') {
          console.log('[Network] Provider does not support network switching');
          setIsCheckingNetwork(false);
          return;
        }

        // Check current network
        const chainId = await provider.request({ method: 'eth_chainId' }) as string;
        console.log('[Network] Current chain ID:', chainId);

        if (chainId !== BASE_SEPOLIA_CHAIN_ID_HEX) {
          console.log('[Network] Wrong network detected, attempting to switch...');
          
          try {
            // Try to switch to Base Sepolia
            await provider.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
            });
            
            console.log('[Network] Successfully switched to Base Sepolia');
          } catch (switchError: any) {
            console.error('[Network] Switch error:', switchError);
            
            // This error code indicates that the chain has not been added to the wallet
            if (switchError.code === 4902) {
              console.log('[Network] Chain not found in wallet, attempting to add...');
              
              try {
                await provider.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
                    chainName: 'Base Sepolia',
                    nativeCurrency: {
                      name: 'Ethereum',
                      symbol: 'ETH',
                      decimals: 18,
                    },
                    rpcUrls: ['https://sepolia.base.org'],
                    blockExplorerUrls: ['https://sepolia.basescan.org'],
                  }],
                });
                
                console.log('[Network] Successfully added and switched to Base Sepolia');
              } catch (addError: any) {
                console.error('[Network] Failed to add chain:', addError);
                setNetworkError('Please manually add Base Sepolia network in your wallet');
              }
            } else if (switchError.code === 4001) {
              // User rejected the request
              console.log('[Network] User rejected network switch');
              setNetworkError('Please switch to Base Sepolia network to continue');
            } else {
              setNetworkError('Failed to switch network, please manually switch to Base Sepolia');
            }
          }
        } else {
          console.log('[Network] Already on Base Sepolia');
        }
      } catch (error: any) {
        console.error('[Network] Error checking network:', error);
        setNetworkError('Unable to check network status');
      } finally {
        setIsCheckingNetwork(false);
      }
    };

    // Check network when wallet connects
    if (isConnected) {
      // Add a small delay to ensure wallet is fully initialized
      setTimeout(() => {
        checkAndSwitchNetwork();
      }, 500);
    }
  }, [isConnected, connector]);

  // Listen for network changes
  useEffect(() => {
    const setupNetworkListener = async () => {
      if (!connector) return;

      try {
        const provider = await connector.getProvider() as EIP1193Provider;
        
        if (provider && typeof provider.on === 'function') {
          const handleChainChanged = (chainId: string) => {
            console.log('[Network] Chain changed to:', chainId);
            // Reload the page when network changes (recommended by most wallets)
            window.location.reload();
          };

          provider.on('chainChanged', handleChainChanged);

          return () => {
            if (typeof provider.removeListener === 'function') {
              provider.removeListener('chainChanged', handleChainChanged);
            }
          };
        }
      } catch (error) {
        console.error('[Network] Failed to setup network listener:', error);
      }
    };

    setupNetworkListener();
  }, [connector]);

  return {
    isCheckingNetwork,
    networkError,
    clearNetworkError: () => setNetworkError(null),
  };
}

