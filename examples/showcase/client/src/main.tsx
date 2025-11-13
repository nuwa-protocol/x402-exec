import ReactDOM from "react-dom/client";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./wagmi.config";
import "./index.css";
import App from "./App";

// Create a client for react-query
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  // @ts-expect-error - WagmiProvider type compatibility issue with React 18
  <WagmiProvider config={config}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </WagmiProvider>,
);
