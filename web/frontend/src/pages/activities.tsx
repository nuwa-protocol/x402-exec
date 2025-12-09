import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SUPPORTED_NETWORKS } from "@/constants/facilitator";
import { formatUsdcAtomicToDisplay } from "@/hooks/use-facilitator-stats";
import { type HookStatsRow, useScanHooks, useScanStats } from "@/hooks/use-scan-stats";
import { formatNetwork, useTransactions } from "@/hooks/use-transactions";
import type { HookInfo, NetworkId, Transaction } from "@/types/scan";

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

function shortHex(s: string, head = 6, tail = 4) {
  if (!s) return "";
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

// How we sort the Top Hook Contracts table
type HookSortKey = "totalVolume" | "totalTransactions" | "uniqueUsers" | "address";
type SortOrder = "asc" | "desc";

function getTxUrl(t: Transaction): string {
  const entry = SUPPORTED_NETWORKS.find((n) => n.network === t.network);
  const base = entry?.txExplorerBaseUrl;
  if (base) return `${base}${t.hash}`;
  // Fallback to a common pattern if base is unavailable
  switch (t.network) {
    case "base":
      return `https://basescan.org/tx/${t.hash}`;
    case "base-sepolia":
      return `https://sepolia.basescan.org/tx/${t.hash}`;
    case "x-layer":
      return `https://www.oklink.com/xlayer/tx/${t.hash}`;
    case "x-layer-testnet":
      return `https://www.oklink.com/xlayer-test/tx/${t.hash}`;
    default:
      return `https://etherscan.io/tx/${t.hash}`;
  }
}

function getAddressUrl(network: NetworkId, address: string): string {
  const entry = SUPPORTED_NETWORKS.find((n) => n.network === network);
  const explorer = entry?.explorerUrl;

  if (explorer && entry?.settlementRouter) {
    // explorer looks like "<addressExplorerBaseUrl><settlementRouter>"
    const lowerExplorer = explorer.toLowerCase();
    const lowerRouter = entry.settlementRouter.toLowerCase();
    const idx = lowerExplorer.lastIndexOf(lowerRouter);
    const base =
      idx >= 0 ? explorer.slice(0, idx) : explorer;
    return `${base}${address}`;
  }

  // Fallback to common address explorer patterns
  switch (network) {
    case "base":
      return `https://basescan.org/address/${address}`;
    case "base-sepolia":
      return `https://sepolia.basescan.org/address/${address}`;
    case "x-layer":
      return `https://www.oklink.com/xlayer/address/${address}`;
    case "x-layer-testnet":
      return `https://www.oklink.com/xlayer-test/address/${address}`;
    default:
      return `https://etherscan.io/address/${address}`;
  }
}

function HookBadge({ hook, network }: { hook?: HookInfo; network: NetworkId }) {
  if (!hook) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={getAddressUrl(network, hook.address)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs text-muted-foreground underline-offset-2 hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {shortHex(hook.address)}
    </a>
  );
}

function OverallTable({ items }: { items: Transaction[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tx Hash</TableHead>
          <TableHead>Network</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>From</TableHead>
          <TableHead>To</TableHead>
          <TableHead>Hook</TableHead>
          <TableHead className="text-right">Amount (USD)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((t) => (
          <TableRow key={t.hash}>
            <TableCell className="font-mono text-xs">
              <a
                href={getTxUrl(t)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="underline-offset-2 hover:underline"
              >
                {shortHex(t.hash, 10, 8)}
              </a>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{formatNetwork(t.network)}</Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatTime(t.timestamp)}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {shortHex(t.from)}
            </TableCell>
            <TableCell className="font-mono text-xs">
              {shortHex(t.to)}
            </TableCell>
            <TableCell>
              <HookBadge hook={t.hook} network={t.network} />
            </TableCell>
            <TableCell className="text-right">
              {formatUsdcAtomicToDisplay(Number(t.valueWei), 2)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TopHooksTable({
  rows,
  loading,
}: {
  rows: HookStatsRow[];
  loading?: boolean;
}) {
  const [sortKey, setSortKey] = React.useState<HookSortKey>("totalVolume");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("desc");

  const sortedRows = React.useMemo(() => {
    const copy = [...rows];

    copy.sort((a, b) => {
      let cmp = 0;

      switch (sortKey) {
        case "totalVolume": {
          const aVol = BigInt(a.totalVolume || "0");
          const bVol = BigInt(b.totalVolume || "0");
          if (aVol === bVol) cmp = 0;
          else cmp = aVol > bVol ? 1 : -1;
          break;
        }
        case "totalTransactions": {
          if (a.totalTransactions === b.totalTransactions) cmp = 0;
          else cmp = a.totalTransactions > b.totalTransactions ? 1 : -1;
          break;
        }
        case "uniqueUsers": {
          if (a.uniqueUsers === b.uniqueUsers) cmp = 0;
          else cmp = a.uniqueUsers > b.uniqueUsers ? 1 : -1;
          break;
        }
        default: {
          cmp = a.address.toLowerCase().localeCompare(b.address.toLowerCase());
          break;
        }
      }

      // Stable fallback on address when primary key ties
      if (cmp === 0) {
        cmp = a.address.toLowerCase().localeCompare(b.address.toLowerCase());
      }

      return sortOrder === "desc" ? -cmp : cmp;
    });

    return copy;
  }, [rows, sortKey, sortOrder]);

  const handleSortChange = (key: HookSortKey) => {
    if (key === sortKey) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      // Default ascending for address, descending for numeric metrics
      setSortOrder(key === "address" ? "asc" : "desc");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading hook activity…
      </div>
    );
  }

  if (!sortedRows.length) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No hook activity found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">
              <SortTrigger
                label="Hook Address"
                align="left"
                active={sortKey === "address"}
                direction={sortOrder}
                onClick={() => handleSortChange("address")}
              />
            </TableHead>
            <TableHead>
              Network
            </TableHead>
            <TableHead className="text-right">
              <SortTrigger
                label="Unique Payers"
                align="right"
                active={sortKey === "uniqueUsers"}
                direction={sortOrder}
                onClick={() => handleSortChange("uniqueUsers")}
              />
            </TableHead>
            <TableHead className="text-right">
              <SortTrigger
                label="Transactions"
                align="right"
                active={sortKey === "totalTransactions"}
                direction={sortOrder}
                onClick={() => handleSortChange("totalTransactions")}
              />
            </TableHead>
            <TableHead className="text-right">
              <SortTrigger
                label="Total (USDC)"
                align="right"
                active={sortKey === "totalVolume"}
                direction={sortOrder}
                onClick={() => handleSortChange("totalVolume")}
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => (
            <TableRow
              key={row.address + row.network}
              className="cursor-pointer"
              onClick={() =>
                window.open(
                  getAddressUrl(row.network, row.address),
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <TableCell className="font-mono text-xs break-all">
                {row.address}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{formatNetwork(row.network)}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {integerFormatter.format(row.uniqueUsers)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {integerFormatter.format(row.totalTransactions)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-semibold">
                ${formatUsdcAtomicToDisplay(row.totalVolume, 2)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SortTrigger({
  label,
  align,
  active,
  direction,
  onClick,
}: {
  label: string;
  align: "left" | "right";
  active: boolean;
  direction: SortOrder;
  onClick: () => void;
}) {
  const alignment =
    align === "right" ? "justify-end text-right" : "justify-start text-left";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:text-foreground ${alignment}`}
    >
      {label}
      <SortIndicator active={active} direction={direction} />
    </button>
  );
}

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: SortOrder;
}) {
  if (!active) {
    return <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />;
  }
  return direction === "desc" ? (
    <ArrowDown className="h-3.5 w-3.5" />
  ) : (
    <ArrowUp className="h-3.5 w-3.5" />
  );
}

export default function ActivitiesPage() {
  const pageSize = 20;
  const tx = useTransactions({ page: 1, pageSize });
  const {
    stats,
    loading: statsLoading,
  } = useScanStats({});
  const {
    hooks,
    loading: hooksLoading,
  } = useScanHooks({});

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Activities</h1>
          <p className="text-muted-foreground">Overview of facilitator activities across all networks.</p>
        </div>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">See All on Explorer</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SUPPORTED_NETWORKS.map((n) => (
                <DropdownMenuItem asChild key={n.network}>
                  <a href={n.explorerUrl} target="_blank" rel="noreferrer">
                    {n.name}
                  </a>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <section className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <Badge variant="outline" className="text-xs uppercase">
                USDC
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {compactCurrencyFormatter.format(stats.transactionVolumeUsd)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {statsLoading ? "Syncing latest volume…" : "All-time settled volume"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unique Payers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {integerFormatter.format(stats.accountsCount)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {statsLoading ? "Refreshing…" : "Distinct wallets that paid"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {integerFormatter.format(stats.transactionsCount)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {statsLoading ? "Refreshing…" : "Successful on-chain runs"}
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Latest Transactions</h2>
        <Card>
          <CardContent className="py-4">
            <OverallTable items={tx.items} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Top Hook Contracts</h2>
        <Card>
          <CardContent className="py-4">
            <TopHooksTable rows={hooks} loading={hooksLoading} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
