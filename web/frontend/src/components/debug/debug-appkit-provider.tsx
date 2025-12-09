import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { base, baseSepolia, defineChain, xLayer } from "@reown/appkit/networks";
import { createAppKit, useAppKit, useAppKitAccount } from "@reown/appkit/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

interface DebugAppKitContextType {
  isConnected: boolean;
  address: string | undefined;
  openModal: () => void;
}

const DebugAppKitContext = createContext<DebugAppKitContextType | undefined>(
  undefined,
);

interface DebugAppKitProviderProps {
  children: ReactNode;
}

export function DebugAppKitProvider({ children }: DebugAppKitProviderProps) {
  const [isAppKitCreated, setIsAppKitCreated] = useState(false);

  useEffect(() => {
    const projectId =
      import.meta.env.VITE_APPKIT_PROJECT_ID || "default-project-id";

    const xLayerTestnet = defineChain({
      id: 1952,
      caipNetworkId: "eip155:1952",
      chainNamespace: "eip155",
      name: "X Layer Testnet",
      nativeCurrency: {
        decimals: 18,
        name: "OKB",
        symbol: "OKB",
      },
      blockExplorers: {
        default: { name: "OKLink", url: "https://www.oklink.com/xlayer-test" },
      },
      rpcUrls: {
        default: { http: ["https://testrpc.xlayer.tech/terigon"] },
      },
    });

    const networks = [base, baseSepolia, xLayer, xLayerTestnet];

    createAppKit({
      adapters: [
        new WagmiAdapter({
          projectId,
          networks: networks,
        }),
      ],
      networks: networks as any,
      metadata: {
        name: "X402 Facilitator",
        description: "X402 Payment Facilitator",
        url: "https://x402x.dev",
        icons: ["https://x402x.dev/icon.png"],
      },
      projectId,
      features: {
        analytics: false,
        emailShowWallets: false,
      },
    });

    setIsAppKitCreated(true);
  }, []);

  if (!isAppKitCreated) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return <DebugAppKitProviderInner>{children}</DebugAppKitProviderInner>;
}

function DebugAppKitProviderInner({ children }: { children: ReactNode }) {
  const { open: openModal } = useAppKit();
  const { isConnected, address } = useAppKitAccount();

  const contextValue: DebugAppKitContextType = {
    isConnected,
    address,
    openModal,
  };

  return (
    <DebugAppKitContext.Provider value={contextValue}>
      {children}
    </DebugAppKitContext.Provider>
  );
}

export function useDebugAppKit() {
  const context = useContext(DebugAppKitContext);
  if (context === undefined) {
    throw new Error("useDebugAppKit must be used within a DebugAppKitProvider");
  }
  return context;
}
