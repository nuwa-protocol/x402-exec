import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type NetworkMode = 'mainnet' | 'testnet';

type Ctx = {
  mode: NetworkMode;
  setMode: (m: NetworkMode) => void;
};

const NetworkModeContext = createContext<Ctx | undefined>(undefined);

const STORAGE_KEY = 'xdefi-network-mode';

export function NetworkModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<NetworkMode>(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === 'mainnet' || v === 'testnet') return v;
    } catch {}
    return 'testnet';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
  }, [mode]);

  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <NetworkModeContext.Provider value={value}>{children}</NetworkModeContext.Provider>;
}

export function useNetworkMode() {
  const ctx = useContext(NetworkModeContext);
  if (!ctx) throw new Error('useNetworkMode must be used within NetworkModeProvider');
  return ctx;
}

