import { ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ECOSYSTEM_PROJECTS } from "@/constants/ecosystem";
import {
  SUPPORTED_NETWORKS,
  SUPPORTED_PAYMENT_TOKENS,
  type PaymentToken,
} from "@/constants/facilitator";

const NETWORK_MAP = Object.fromEntries(
  SUPPORTED_NETWORKS.map((network) => [network.network, network]),
);

export default function EcosystemPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 space-y-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Ecosystem
        </p>
        <h1 className="text-4xl font-bold tracking-tight">
          Projects built on the facilitator
        </h1>
        <p className="text-muted-foreground max-w-3xl">
          Discover teams that use x402 payments to ship commerce, settlement,
          and automation experiences. Each integration lists the networks and
          payment tokens that are currently supported.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {ECOSYSTEM_PROJECTS.map((project) => (
          <ProjectCard key={project.slug} project={project} />
        ))}
      </div>
    </div>
  );
}

type ProjectCardProps = {
  project: (typeof ECOSYSTEM_PROJECTS)[number];
};

function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="relative h-40 w-full overflow-hidden bg-muted">
        <img
          src={project.illustrationSrc}
          alt={`${project.name} illustration`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      <CardHeader className="flex flex-row items-center gap-4 border-b">
        <img
          src={project.logoSrc}
          alt={`${project.name} logo`}
          className="h-12 w-12 rounded-md border bg-background object-cover"
          loading="lazy"
        />
        <div className="flex-1">
          <CardTitle className="text-xl font-semibold">
            {project.name}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{project.url}</p>
        </div>
        <Button variant="secondary" size="sm" asChild>
          <a href={project.url} target="_blank" rel="noreferrer">
            Visit
            <ArrowUpRight className="ml-1 h-4 w-4" />
            <span className="sr-only">Visit {project.name}</span>
          </a>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 py-6">
        <p className="text-sm text-muted-foreground">{project.description}</p>

        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Networks
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {project.networks.map((networkKey) => {
              const network = NETWORK_MAP[networkKey];
              return (
                <Badge
                  key={`${project.slug}-${networkKey}`}
                  variant={network?.status === "Mainnet" ? "default" : "secondary"}
                >
                  {network?.name ?? networkKey}
                </Badge>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {project.networks.map((networkKey) => (
            <NetworkTokenRow
              key={`${project.slug}-${networkKey}-tokens`}
              networkKey={networkKey}
              tokenSymbols={project.paymentTokensByNetwork[networkKey] ?? []}
            />
          ))}
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button asChild className="w-full">
          <a href={project.url} target="_blank" rel="noreferrer">
            Explore integration
            <ArrowUpRight className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}

type NetworkTokenRowProps = {
  networkKey: string;
  tokenSymbols: string[];
};

function NetworkTokenRow({ networkKey, tokenSymbols }: NetworkTokenRowProps) {
  const network = NETWORK_MAP[networkKey];
  const availableTokens = SUPPORTED_PAYMENT_TOKENS[networkKey] ?? [];
  const resolvedTokens = tokenSymbols
    .map((symbol) =>
      availableTokens.find((token) => token.symbol === symbol),
    )
    .filter(Boolean) as PaymentToken[];
  const unresolvedSymbols = tokenSymbols.filter(
    (symbol) => !resolvedTokens.some((token) => token.symbol === symbol),
  );

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Network</p>
          <p className="font-medium">{network?.name ?? networkKey}</p>
        </div>
        {network ? (
          <Badge variant={network.status === "Mainnet" ? "default" : "secondary"}>
            {network.status}
          </Badge>
        ) : null}
      </div>
      <div className="mt-3">
        <p className="text-xs uppercase text-muted-foreground">Payment tokens</p>
        {resolvedTokens.length === 0 && unresolvedSymbols.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">No tokens listed</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {resolvedTokens.map((token) => (
              <Badge key={`${networkKey}-${token.symbol}`} variant="outline">
                {token.label} ({token.symbol})
              </Badge>
            ))}
            {unresolvedSymbols.map((symbol) => (
              <Badge key={`${networkKey}-${symbol}`} variant="outline">
                {symbol}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
