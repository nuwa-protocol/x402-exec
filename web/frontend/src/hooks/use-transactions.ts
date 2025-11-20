import * as React from "react";
import type {
  HookInfo,
  NetworkId,
  Transaction,
  TransactionsQuery,
  TransactionsResult,
} from "@/types/scan";

// API response type
type ApiTransactionResponse = {
  success: boolean;
  data: {
    items: Array<{
      id: number;
      tx_hash: string;
      network: string;
      time: number; // milliseconds
      from_addr: string;
      to_addr: string;
      hook: string;
      hook_name: string;
      amount: number | string; // wei amount
      created_at: string;
    }>;
    page: number;
    limit: number;
    totalPages: number;
  };
};

// Transform API transaction to Transaction type
function transformApiTransaction(apiTx: ApiTransactionResponse["data"]["items"][0]): Transaction {
  const hook: HookInfo | undefined = apiTx.hook
    ? {
        address: apiTx.hook,
        name: apiTx.hook_name || undefined,
      }
    : undefined;

  // Convert time from milliseconds to seconds (API returns milliseconds)
  const timestamp = Math.floor(apiTx.time / 1000);

  // Ensure network matches NetworkId type
  const network = (apiTx.network || "base") as NetworkId;

  return {
    hash: apiTx.tx_hash || "",
    from: apiTx.from_addr || "",
    to: apiTx.to_addr || "",
    valueWei: String(apiTx.amount || "0"), // Convert to string for wei value
    timestamp,
    network,
    hook,
  };
}

export function useTransactions(query: TransactionsQuery = {}): TransactionsResult {
  const [state, setState] = React.useState<TransactionsResult>({
    items: [],
    page: query.page || 1,
    pageSize: query.pageSize || 10,
    total: 0,
  });

  React.useEffect(() => {
    let cancelled = false;

    async function fetchTransactions() {
      try {
        const params = new URLSearchParams();
        
        // Add pagination params
        const page = query.page || 1;
        const pageSize = query.pageSize || 10;
        params.set("page", String(page));
        params.set("limit", String(pageSize));

        // Add network filter if provided
        if (query.networks && query.networks.length > 0) {
          params.set("networks", query.networks.join(","));
        }

        // Add hook address filter if provided
        if (query.hookAddress) {
          params.set("hook", query.hookAddress);
        }

        // Add time range filters if provided
        if (query.fromTime) {
          params.set("fromTime", String(query.fromTime));
        }
        if (query.toTime) {
          params.set("toTime", String(query.toTime));
        }

        // Use relative path - adjust if backend is on different port
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3003";
        const url = `${apiUrl}/api/transactions${params.toString() ? `?${params.toString()}` : ""}`;
        
        const resp = await fetch(url, {
          headers: { Accept: "application/json" },
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const json = (await resp.json()) as ApiTransactionResponse;

        if (!json.success || !json.data) {
          throw new Error("Invalid API response");
        }

        if (!cancelled) {
          const transformedItems = json.data.items.map(transformApiTransaction);
          // Calculate total: if we're on the last page, use items count + (page-1) * limit
          // Otherwise, use totalPages * limit as upper bound
          const isLastPage = json.data.page >= json.data.totalPages;
          const total = isLastPage
            ? (json.data.page - 1) * json.data.limit + transformedItems.length
            : json.data.totalPages * json.data.limit;
          
          setState({
            items: transformedItems,
            page: json.data.page,
            pageSize: json.data.limit,
            total,
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch transactions:", err);
          // On error, keep existing state or set empty
          setState({
            items: [],
            page: query.page || 1,
            pageSize: query.pageSize || 10,
            total: 0,
          });
        }
      }
    }

    fetchTransactions();

    return () => {
      cancelled = true;
    };
  }, [
    (query.networks || []).join(","),
    query.hookAddress || "",
    query.page,
    query.pageSize,
    query.fromTime,
    query.toTime,
  ]);

  return state;
}

export function formatNetwork(n: NetworkId): string {
  switch (n) {
    case "base":
      return "Base";
    case "base-sepolia":
      return "Base Sepolia";
    case "x-layer":
      return "X Layer";
    case "x-layer-testnet":
      return "X Layer Testnet";
    default:
      return String(n);
  }
}

