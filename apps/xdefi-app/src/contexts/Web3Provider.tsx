import { PropsWithChildren, useMemo } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { base, baseSepolia, xLayer, xLayerTestnet } from '@reown/appkit/networks';

// Initialize AppKit + Wagmi adapter
const appKitProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;
if (!appKitProjectId) {
  // eslint-disable-next-line no-console
  console.warn('Missing VITE_WALLETCONNECT_PROJECT_ID. Wallet connect will not work until it is set.');
}

const appNetworks = [base, baseSepolia, xLayer, xLayerTestnet] as unknown as [any, ...any[]];
const wagmiAdapter = new WagmiAdapter({
  networks: appNetworks,
  projectId: appKitProjectId ?? 'demo',
});

createAppKit({
  projectId: appKitProjectId ?? 'demo',
  adapters: [wagmiAdapter],
  networks: appNetworks,
  defaultNetwork: base,
  metadata: {
    name: 'xdefi.app',
    description: 'xdefi.app — Swap & Bridge',
    url: 'https://xdefi.app',
    icons: ['https://avatars.githubusercontent.com/u/13698671?s=200&v=4'],
  },
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: PropsWithChildren) {
  const qc = useMemo(() => queryClient, []);
  return (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
