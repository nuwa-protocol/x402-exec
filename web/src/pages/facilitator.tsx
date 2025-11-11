import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  API_ENDPOINTS,
  FACILITATOR_HOSTED_URL,
  GH_ROOT,
  ISSUE_SUBMIT_URL,
  SUPPORTED_NETWORKS,
} from "@/constants/facilitator";

export default function FacilitatorPage() {
  const [copied, setCopied] = useState(false);
  const resetCopyRef = useRef<number | null>(null);

  const handleCopy = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(FACILITATOR_HOSTED_URL);
      setCopied(true);
      if (resetCopyRef.current) {
        window.clearTimeout(resetCopyRef.current);
      }
      resetCopyRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (resetCopyRef.current) {
        window.clearTimeout(resetCopyRef.current);
      }
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-5xl font-bold tracking-tight">Facilitator</h1>
        <p className="text-muted-foreground mt-1">
          Use this hosted instance or run the example server locally from{" "}
          <a
            href={`${GH_ROOT}examples/facilitator`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Github
          </a>
          .
        </p>
      </div>

      <section className="mb-10 space-y-4">
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardContent className="flex flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-primary">
                Hosted Facilitator URL
              </p>
              <a
                href={FACILITATOR_HOSTED_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block font-mono text-lg font-semibold text-foreground"
              >
                {FACILITATOR_HOSTED_URL}
              </a>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                className="cursor-pointer"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="mr-2 size-4" />
                ) : (
                  <Copy className="mr-2 size-4" />
                )}
                {copied ? "Copied" : "Copy URL"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator className="my-2" />

      <section className="mb-12 space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              Supported networks & payment tokens
            </h2>
            <p className="text-sm text-muted-foreground">
              Here are the supported networks and payment tokens.
            </p>
          </div>
          <Button variant="ghost" asChild>
            <a href={ISSUE_SUBMIT_URL} target="_blank" rel="noreferrer">
              Need more networks or assets? Submit an issue
            </a>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {SUPPORTED_NETWORKS.map((network) => (
            <Card key={network.network} className="h-full">
              <CardHeader className="space-y-2 flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{network.name}</CardTitle>
                  <Badge
                    variant={
                      network.status === "Mainnet" ? "default" : "secondary"
                    }
                  >
                    {network.status}
                  </Badge>
                </div>
                <CardDescription className="font-mono text-xs sr-only">
                  {network.network}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2 items-center">
                  <div>
                    <p className="text-xs uppercase font-semibold">
                      Network
                    </p>
                    <p>{network.network}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase font-semibold">
                      Chain ID
                    </p>
                    <p>{network.chainId}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase font-semibold">
                    Settlement router Contract
                  </p>
                  <a
                    href={network.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-primary underline"
                  >
                    {network.settlementRouter}
                  </a>
                </div>
                <div>
                  <p className="text-xs uppercase font-semibold">
                    Supported Payment Tokens
                  </p>
                  <ul className="mt-2 space-y-2">
                    {network.paymentTokens.map((token) => (
                      <li
                        key={`${network.network}-${token.symbol}`}
                        className="flex flex-wrap justify-between items-center gap-2"
                      >
                        <div className="flex justify-start items-center gap-2 text-muted-foreground font-semibold">
                          {token.label} ({token.symbol})
                        </div>
                        <a
                          href={token.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-primary underline"
                        >
                          {shortenAddress(token.address)}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-2" />

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-xl font-semibold">
          API Endpoints
        </div>
        <p className="text-sm text-muted-foreground">
          Facilitator API endpoints.
        </p>

        <Accordion type="multiple" className="flex gap-4 flex-col w-full">
          {API_ENDPOINTS.map((endpoint) => (
            <AccordionItem
              key={endpoint.id}
              value={endpoint.id}
              className="rounded-lg border px-4 last:border-b"
            >
              <AccordionTrigger className="py-4 hover:no-underline cursor-pointer">
                <div className="flex flex-col gap-1 text-left">
                  <div className="flex flex-wrap items-center gap-3">
                    <code className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">
                      {endpoint.method}
                    </code>
                    <span className="font-mono text-sm">{endpoint.path}</span>
                  </div>
                  <p className="text-sm font-medium">{endpoint.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {endpoint.summary}
                  </p>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4">
                {endpoint.request ? (
                  <RequestCurl>{endpoint.request}</RequestCurl>
                ) : null}
                {endpoint.response ? (
                  <ResponseBox>{endpoint.response}</ResponseBox>
                ) : null}
                {endpoint.method === "GET" && endpoint.baseUrl ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const url = new URL(
                        endpoint.path.replace(/^\//, ""),
                        endpoint.baseUrl,
                      ).toString();
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                  >
                    Try endpoint
                  </Button>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}

function RequestCurl({ children }: { children: string }) {
  return (
    <div className="text-xs">
      <div className="mb-1 text-muted-foreground">Request</div>
      <pre className="overflow-x-auto rounded bg-muted p-3">{children}</pre>
    </div>
  );
}

function ResponseBox({ children }: { children: string }) {
  return (
    <div className="text-xs">
      <div className="mb-1 text-muted-foreground">Sample Response</div>
      <pre className="overflow-x-auto rounded bg-muted p-3">{children}</pre>
    </div>
  );
}

function shortenAddress(address: string) {
  return `${address.slice(0, 10)}…${address.slice(-10)}`;
}
