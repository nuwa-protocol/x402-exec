import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit, useAppKit, useAppKitAccount } from "@reown/appkit/react";
import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import type { Config } from "wagmi";

import { X402X_MINT_CONFIG } from "@/lib/token-mint-config";

interface TokenAppKitContextType {
  isConnected: boolean;
  address: string | undefined;
  openModal: () => void;
}

const TokenAppKitContext = createContext<TokenAppKitContextType | undefined>(
  undefined,
);

interface TokenAppKitProviderProps {
  children: ReactNode;
}

export function TokenAppKitProvider({ children }: TokenAppKitProviderProps) {
  const [wagmiConfig, setWagmiConfig] = useState<Config | null>(null);
  const [isAppKitCreated, setIsAppKitCreated] = useState(false);

  useEffect(() => {
    const projectId =
      import.meta.env.VITE_APPKIT_PROJECT_ID || "default-project-id";

    const networks = [X402X_MINT_CONFIG.chain];

    const wagmiConfig = createConfig({
      chains: networks as any,
      transports: Object.fromEntries(
        networks.map((chain) => [
          chain.id,
          http(chain.rpcUrls.default?.http?.[0]),
        ]),
      ),
    }) as Config;

    const wagmiAdapter = new WagmiAdapter({
      projectId,
      networks,
    });

    createAppKit({
      adapters: [wagmiAdapter],
      networks: networks as any,
      metadata: {
        name: "X402 Token Mint",
        description: "Mint $X402X via x402x facilitator",
        url: "https://x402x.dev",
        icons: ["https://x402x.dev/icon.png"],
      },
      projectId,
      features: {
        analytics: false,
        emailShowWallets: false,
      },
    });

    setWagmiConfig(wagmiConfig);
    setIsAppKitCreated(true);
  }, []);

  if (!isAppKitCreated || !wagmiConfig) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <WagmiProvider config={wagmiConfig}>
      <TokenAppKitProviderInner>{children}</TokenAppKitProviderInner>
    </WagmiProvider>
  );
}

function TokenAppKitProviderInner({ children }: { children: ReactNode }) {
  const { open: openModal } = useAppKit();
  const { isConnected, address } = useAppKitAccount();

  const contextValue: TokenAppKitContextType = {
    isConnected,
    address,
    openModal,
  };

  return (
    <TokenAppKitContext.Provider value={contextValue}>
      {children}
    </TokenAppKitContext.Provider>
  );
}

export function useTokenAppKit() {
  const context = useContext(TokenAppKitContext);
  if (context === undefined) {
    throw new Error("useTokenAppKit must be used within a TokenAppKitProvider");
  }
  return context;
}
