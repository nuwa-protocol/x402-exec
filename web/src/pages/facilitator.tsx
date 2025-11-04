import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function FacilitatorPage() {
  const hostedUrl = "https://facilitator.x402x.dev/";
  const GH_ROOT = "https://github.com/nuwa-protocol/x402-exec/tree/main/" as const;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Facilitator</h1>
        <p className="text-muted-foreground mt-1">
          Reference facilitator service for x402X (short for x402‑exec). Use this hosted instance or run the
          example server locally from{" "}
          <a href={`${GH_ROOT}examples/facilitator`} target="_blank" rel="noreferrer">
            <code>examples/facilitator</code>
          </a>
          .
        </p>
      </div>

      <Alert className="mb-6">
        <AlertTitle>Hosted Facilitator</AlertTitle>
        <AlertDescription>
          <a
            href={hostedUrl}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {hostedUrl}
          </a>
        </AlertDescription>
      </Alert>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">API Endpoints</h2>
          <Badge>examples/facilitator</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Endpoints implemented by the example Express server (
          <a href={`${GH_ROOT}examples/facilitator/src/index.ts`} target="_blank" rel="noreferrer">
            <code>examples/facilitator/src/index.ts</code>
          </a>
          ).
        </p>

        <Separator className="my-2" />

        <ul className="space-y-6">
          <li>
            <Endpoint baseUrl={hostedUrl} method="GET" path="/supported" description="List supported payment kinds." />
            <RequestCurl>{`curl -s ${hostedUrl}supported`}</RequestCurl>
            <ResponseBox>{`{
  "kinds": [
    { "x402Version": 1, "scheme": "exact", "network": "base-sepolia" }
  ]
}`}</ResponseBox>
          </li>
          <li>
            <Endpoint baseUrl={hostedUrl} method="GET" path="/verify" description="Returns info about the verify endpoint." />
            <RequestCurl>{`curl -s ${hostedUrl}verify`}</RequestCurl>
            <ResponseBox>{`{
  "endpoint": "/verify",
  "description": "POST to verify x402 payments",
  "body": {
    "paymentPayload": "PaymentPayload",
    "paymentRequirements": "PaymentRequirements"
  }
}`}</ResponseBox>
          </li>
          <li>
            <Endpoint baseUrl={hostedUrl} method="POST" path="/verify" description="Verify an x402 payment payload." />
            <RequestCurl>{`curl -s -X POST ${hostedUrl}verify \\
  -H 'Content-Type: application/json' \\
  -d '{
    "paymentPayload": { ... },
    "paymentRequirements": { ... }
  }'`}</RequestCurl>
            <RequestBody>{`{
  "paymentPayload": PaymentPayload,
  "paymentRequirements": PaymentRequirements
}`}</RequestBody>
            <ResponseBox>{`{
  "isValid": true
}`}</ResponseBox>
          </li>
          <li>
            <Endpoint baseUrl={hostedUrl} method="GET" path="/settle" description="Returns info about the settle endpoint (supported modes and body)." />
            <RequestCurl>{`curl -s ${hostedUrl}settle`}</RequestCurl>
            <ResponseBox>{`{
  "endpoint": "/settle",
  "description": "POST to settle x402 payments",
  "supportedModes": ["standard", "settlementRouter"],
  "body": {
    "paymentPayload": "PaymentPayload",
    "paymentRequirements": "PaymentRequirements (with optional extra.settlementRouter)"
  }
}`}</ResponseBox>
          </li>
          <li>
            <Endpoint baseUrl={hostedUrl} method="POST" path="/settle" description="Settle an x402 payment. Auto‑detects between Standard and SettlementRouter modes based on paymentRequirements.extra.settlementRouter." />
            <RequestCurl>{`curl -s -X POST ${hostedUrl}settle \\
  -H 'Content-Type: application/json' \\
  -d '{
    "paymentPayload": { ... },
    "paymentRequirements": { ... }
  }'`}</RequestCurl>
            <RequestBody>{`{
  "paymentPayload": PaymentPayload,
  "paymentRequirements": PaymentRequirements
}`}</RequestBody>
            <ResponseBox>{`{
  "success": true,
  "transaction": "0xabc...",
  "network": "base-sepolia",
  "payer": "0x123..."
}`}</ResponseBox>
          </li>
        </ul>

        <p className="text-sm text-muted-foreground">
          For full details, see{" "}
          <a href={`${GH_ROOT}examples/facilitator/README.md`} target="_blank" rel="noreferrer">
            <code>examples/facilitator/README.md</code>
          </a>
          .
        </p>
      </section>
    </div>
  );
}

function Endpoint(props: { baseUrl?: string; method: string; path: string; description: string }) {
  const { baseUrl, method, path, description } = props;
  const full = baseUrl ? new URL(path.replace(/^\//, ''), baseUrl).toString() : undefined;
  return (
    <div className="rounded-md border p-3">
      <div className="mb-1 flex items-center gap-2">
        <code className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">
          {method}
        </code>
        <code className="text-sm">{path}</code>
        {full && method === "GET" ? (
          <a href={full} target="_blank" rel="noreferrer" className="ml-2 text-xs underline">
            {full}
          </a>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function RequestBody({ children }: { children: string }) {
  return (
    <div className="mt-2 text-xs">
      <div className="mb-1 text-muted-foreground">Request Body</div>
      <pre className="overflow-x-auto rounded bg-muted p-3">
        {children}
      </pre>
    </div>
  );
}

function RequestCurl({ children }: { children: string }) {
  return (
    <div className="mt-2 text-xs">
      <div className="mb-1 text-muted-foreground">Request</div>
      <pre className="overflow-x-auto rounded bg-muted p-3">{children}</pre>
    </div>
  );
}

function ResponseBox({ children }: { children: string }) {
  return (
    <div className="mt-2 text-xs">
      <div className="mb-1 text-muted-foreground">Sample Response</div>
      <pre className="overflow-x-auto rounded bg-muted p-3">{children}</pre>
    </div>
  );
}
