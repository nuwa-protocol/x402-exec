import { useEffect, useMemo, useState } from 'react';
import { SUPPORTED_NETWORKS, SUPPORTED_PAYMENT_TOKENS } from '@/constants/networks';

// Local shapes aligned to crypto-swap component
export type TargetToken = {
  symbol: string;
  name: string;
  address: string;
  price: number;
  balance: string;
  change24h: number;
};

export type TargetNetwork = {
  id: string; // network key
  name: string; // display name (e.g., Base, Base Sepolia)
  tokens: TargetToken[];
};

export type UseTargetAssetsParams = {
  mode: 'swap' | 'bridge';
  fromNetworkId?: string;
  networkMode: 'mainnet' | 'testnet';
};

export function useTargetAssets({ mode, fromNetworkId, networkMode }: UseTargetAssetsParams) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [networks, setNetworks] = useState<TargetNetwork[]>(() => []);

  // Build a mock list deterministically from SDK data.
  // - Filter by networkMode
  // - For 'swap': only the from network is valid as the target network
  // - For 'bridge': any network in the same mode except the from network
  const computeMock = useMemo(() => {
    const candidates = SUPPORTED_NETWORKS.filter((n) =>
      networkMode === 'mainnet' ? n.status === 'Mainnet' : n.status === 'Testnet',
    );

    const pickList = (() => {
      if (!fromNetworkId) return candidates;
      if (mode === 'swap') return candidates.filter((n) => n.network === fromNetworkId);
      return candidates.filter((n) => n.network !== fromNetworkId);
    })();

    const list: TargetNetwork[] = pickList.map((n) => {
      const tokenEntries = SUPPORTED_PAYMENT_TOKENS[n.network] ?? [];
      const tokens: TargetToken[] = tokenEntries.map((t) => ({
        symbol: t.symbol,
        name: t.label ?? t.symbol,
        address: t.address,
        price: t.symbol.toUpperCase() === 'USDC' ? 1 : 1,
        balance: '0',
        change24h: 0,
      }));

      // Remove the word "Mainnet" from display name for consistency
      const name = n.status === 'Mainnet' ? n.name.replace(/\s*Mainnet\b/i, '') : n.name;

      return { id: n.network, name, tokens };
    });
    return list;
  }, [mode, fromNetworkId, networkMode]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Update synchronously so UI can switch both sides in one render.
    setNetworks(computeMock);
    // Keep a small delay to emulate network latency for the loading flag only.
    const t = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 100);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [computeMock]);

  const refresh = () => {
    // No-op for mock; re-run effect by mutating dependencies if needed
    setLoading(true);
    setTimeout(() => setLoading(false), 50);
  };

  return { networks, loading, error, refresh };
}
