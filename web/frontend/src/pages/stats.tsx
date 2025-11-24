import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SUPPORTED_NETWORKS } from "@/constants/facilitator";
import { formatUsdcAtomicToDisplay } from "@/hooks/use-facilitator-stats";
import { formatNetwork, useTransactions } from "@/hooks/use-transactions";
import type { HookInfo, Transaction } from "@/types/scan";
import { useScanHooks, useScanStats } from "@/hooks/use-scan-stats";

function formatTime(ts: number): string {
  console.log(ts);
  const d = new Date(ts * 1000);
  return d.toLocaleString();
}

function shortHex(s: string, head = 6, tail = 4) {
  if (!s) return "";
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}...${s.slice(-tail)}`;
}

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

function HookBadge({ hook }: { hook?: HookInfo }) {
  if (!hook) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <Badge variant="outline">{hook.name ?? "Hook"}</Badge>
      <span className="text-muted-foreground text-xs">
        {shortHex(hook.address)}
      </span>
    </span>
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
          <TableRow
            key={t.hash}
            className="cursor-pointer"
            onClick={() =>
              window.open(getTxUrl(t), "_blank", "noopener,noreferrer")
            }
          >
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
              <HookBadge hook={t.hook} />
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

function TopHooksTableApi({ rows }: { rows: any[] }) {
  if (!rows || rows.length === 0) {
    return <div className="text-muted-foreground">No hook activity found.</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Hook Address</TableHead>
          <TableHead className="text-right">Unique Payers</TableHead>
          <TableHead className="text-right">Transactions</TableHead>
          <TableHead className="text-right">Total (USDC)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.address}>
            <TableCell className="font-mono text-xs">{shortHex(r.address)}</TableCell>
            <TableCell className="text-right">{r.uniqueUsers}</TableCell>
            <TableCell className="text-right">{r.totalTransactions}</TableCell>
            <TableCell className="text-right">{formatUsdcAtomicToDisplay(r.totalVolume, 2)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function ScanPage() {
  const pageSize = 20;
  const tx = useTransactions({ page: 1, pageSize });
  const stats = useScanStats({});
  const hooks = useScanHooks({});

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Stats</h1>
          <p className="text-muted-foreground">Overview of facilitator activity across all networks.</p>
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
            <CardHeader>
              <CardTitle>Total Value (USDC)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {stats.transactionVolumeUsd}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Unique Payers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {stats.accountsCount}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {stats.transactionsCount}
              </div>
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
              <TopHooksTableApi rows={hooks as any} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
