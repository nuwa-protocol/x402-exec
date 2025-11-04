import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
// icons

// Simple docs page teaching how to build client/server/contracts from showcase

// helper component removed (unused)

export default function DocsPage() {
  const GH_ROOT = "https://github.com/nuwa-protocol/x402-exec/tree/main/" as const;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">x402X Developer Guide</h1>
        <p className="text-muted-foreground mt-1">
          x402X is short for x402‑exec. Learn how to build the client, server, and smart contracts using the three showcase scenarios:
          Referral Split, Random NFT Mint, and Loyalty Points.
        </p>
      </div>

      <Alert className="mb-8">
        <AlertTitle>Where To Look In The Repo</AlertTitle>
        <AlertDescription className="space-y-1">
          <div>
            • Frontend (client):
            {" "}
            <a href={`${GH_ROOT}examples/showcase/client`} target="_blank" rel="noreferrer">
              <code>examples/showcase/client</code>
            </a>
          </div>
          <div>
            • Backend (server):
            {" "}
            <a href={`${GH_ROOT}examples/showcase/server`} target="_blank" rel="noreferrer">
              <code>examples/showcase/server</code>
            </a>
          </div>
          <div>
            • Contracts & Hooks:{" "}
            <a href={`${GH_ROOT}contracts/`} target="_blank" rel="noreferrer">
              <code>contracts/</code>
            </a>
            {" "}and{" "}
            <a href={`${GH_ROOT}contracts/examples/`} target="_blank" rel="noreferrer">
              <code>contracts/examples/</code>
            </a>
          </div>
        </AlertDescription>
      </Alert>

      {/* Overview */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Overview</h2>
        <p>
          x402‑exec enables atomic pay‑and‑execute workflows: users sign an EIP‑3009 authorization that is
          consumed by either a standard transfer or the <code>SettlementRouter</code> which then executes a Hook
          (your business logic). The showcase implements three end‑to‑end examples on Base Sepolia.
        </p>
        <ul className="list-disc pl-6 text-sm text-muted-foreground">
          <li>Referral Split — split a single payment across multiple recipients</li>
          <li>Random NFT Mint — mint an NFT to the payer then pay the merchant</li>
          <li>Loyalty Points — distribute reward tokens to the payer and pay the merchant</li>
        </ul>
        <p className="text-sm">
          Full walkthrough:{" "}
          <a href={`${GH_ROOT}examples/showcase/README.md`} target="_blank" rel="noreferrer">
            <code>examples/showcase/README.md</code>
          </a>
        </p>
      </section>

      <Separator className="my-6" />

      {/* Client Guide */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Client Guide</h2>
          <Badge>React + viem</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          The client performs a 402 flow: request → receive 402 with <code>accepts</code> → sign EIP‑3009 →
          resend with <code>X‑PAYMENT</code>. For settlement‑router flows, the EIP‑3009 nonce must equal the
          commitment hash over all parameters.
        </p>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`// 1) Initial request to get 402
const res = await fetch('/api/scenario-1/payment', { method: 'POST', body: JSON.stringify({ ... }) });
const { accepts, x402Version } = await res.json();
const req = accepts[0];

// 2) Build authorization params
const from = wallet.address;
const chainId = wallet.chain.id;
const value = req.maxAmountRequired;
const validAfter = Math.floor(Date.now()/1000) - 600;
const validBefore = Math.floor(Date.now()/1000) + req.maxTimeoutSeconds;

// 3) Compute nonce (commitment for router mode; random for direct payments)
const isRouter = !!req.extra?.settlementRouter;
const nonce = isRouter ? calculateCommitment({
  chainId,
  hub: req.extra.settlementRouter,
  token: req.asset,
  from,
  value,
  validAfter,
  validBefore,
  salt: req.extra.salt,
  payTo: req.extra.payTo,
  facilitatorFee: req.extra.facilitatorFee || '0',
  hook: req.extra.hook,
  hookData: req.extra.hookData,
}) : randomBytes32();

// 4) Sign EIP-712 (EIP-3009 TransferWithAuthorization)
const domain = { name: 'USDC', version: '2', chainId, verifyingContract: req.asset };
const message = {
  from,
  to: isRouter ? req.extra.settlementRouter : req.payTo,
  value: BigInt(value),
  validAfter: BigInt(validAfter),
  validBefore: BigInt(validBefore),
  nonce,
};
const signature = await signTypedData(walletClient, { domain, types: { TransferWithAuthorization: [...] }, message });

// 5) Send final request with X-PAYMENT header (include original requirements)
const paymentPayload = { x402Version, scheme: req.scheme, network: req.network, payload: { signature, authorization: { ...message } }, paymentRequirements: req };
const header = base64url(JSON.stringify(paymentPayload));
const finalRes = await fetch('/api/scenario-1/payment', { method: 'POST', headers: { 'X-PAYMENT': header } });
`}
        </pre>
        <p className="text-sm">
          Full implementation:{" "}
          <a
            href={`${GH_ROOT}examples/showcase/client/src/hooks/usePayment.ts`}
            target="_blank"
            rel="noreferrer"
          >
            <code>examples/showcase/client/src/hooks/usePayment.ts</code>
          </a>
        </p>
      </section>

      <Separator className="my-6" />

      {/* Server Guide */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Server Guide</h2>
          <Badge>Hono + x402</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          The server exposes scenario endpoints that return 402 with payment requirements, then verifies
          and settles when the client replays with <code>X‑PAYMENT</code>. Use <code>useFacilitator</code>
          to verify and settle against your configured facilitator.
        </p>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`// Hono server excerpt
import { Hono } from 'hono';
import { useFacilitator } from 'x402/verify';
import { findMatchingPaymentRequirements } from 'x402/shared';

const { verify, settle } = useFacilitator({ url: process.env.FACILITATOR_URL! as const });

app.post('/api/scenario-1/payment', async (c) => {
  // 1) If no X-PAYMENT: return 402 with payment requirements
  if (!c.req.header('X-PAYMENT')) {
    const accepts = [generateReferralPayment({ /* ... */ })];
    return c.json({ error: 'X-PAYMENT required', accepts, x402Version: 1 }, 402);
  }
  // 2) Decode, match requirements, verify, settle
  const decoded = exact.evm.decodePayment(c.req.header('X-PAYMENT')!);
  const selected = findMatchingPaymentRequirements([decoded.paymentRequirements], decoded);
  const ok = await verify(decoded, selected);
  if (!ok.isValid) return c.json({ error: ok.invalidReason, accepts: [selected] }, 402);
  const settlement = await settle(decoded, selected);
  return c.json({ success: settlement.success, transaction: settlement.transaction });
});
`}
        </pre>
        <p className="text-sm">
          See:{" "}
          <a href={`${GH_ROOT}examples/showcase/server/src/index.ts`} target="_blank" rel="noreferrer">
            <code>examples/showcase/server/src/index.ts</code>
          </a>
          {" "}and scenario generators in{" "}
          <a href={`${GH_ROOT}examples/showcase/server/src/scenarios`} target="_blank" rel="noreferrer">
            <code>examples/showcase/server/src/scenarios</code>
          </a>
        </p>
      </section>

      <Separator className="my-6" />

      {/* Contracts & Hooks */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Smart Contracts</h2>
          <Badge>Solidity + Foundry</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Settlement flows use <code>SettlementRouter</code> which verifies the commitment and invokes your
          Hook. Build Hooks by implementing <code>ISettlementHook.execute</code>. Explore complete examples:
        </p>
        <ul className="list-disc pl-6 text-sm">
          <li>
            Revenue Split:{" "}
            <a
              href={`${GH_ROOT}contracts/examples/revenue-split/RevenueSplitHook.sol`}
              target="_blank"
              rel="noreferrer"
            >
              <code>contracts/examples/revenue-split/RevenueSplitHook.sol</code>
            </a>
          </li>
          <li>
            NFT Mint:{" "}
            <a
              href={`${GH_ROOT}contracts/examples/nft-mint/NFTMintHook.sol`}
              target="_blank"
              rel="noreferrer"
            >
              <code>contracts/examples/nft-mint/NFTMintHook.sol</code>
            </a>
            , NFT:{" "}
            <a
              href={`${GH_ROOT}contracts/examples/nft-mint/RandomNFT.sol`}
              target="_blank"
              rel="noreferrer"
            >
              <code>contracts/examples/nft-mint/RandomNFT.sol</code>
            </a>
          </li>
          <li>
            Reward Points:{" "}
            <a
              href={`${GH_ROOT}contracts/examples/reward-points/RewardHook.sol`}
              target="_blank"
              rel="noreferrer"
            >
              <code>contracts/examples/reward-points/RewardHook.sol</code>
            </a>
            , Token:{" "}
            <a
              href={`${GH_ROOT}contracts/examples/reward-points/RewardToken.sol`}
              target="_blank"
              rel="noreferrer"
            >
              <code>contracts/examples/reward-points/RewardToken.sol</code>
            </a>
          </li>
        </ul>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`// ISettlementHook interface
function execute(bytes32 contextKey, address payer, address token, uint256 amount, bytes calldata data)
  external returns (bytes memory);
`}
        </pre>
        <p className="text-sm">
          Docs:{" "}
          <a href={`${GH_ROOT}contracts/docs/hook_guide.md`} target="_blank" rel="noreferrer">
            <code>contracts/docs/hook_guide.md</code>
          </a>
          , API:{" "}
          <a href={`${GH_ROOT}contracts/docs/api.md`} target="_blank" rel="noreferrer">
            <code>contracts/docs/api.md</code>
          </a>
          , Facilitator guide:{" "}
          <a href={`${GH_ROOT}contracts/docs/facilitator_guide.md`} target="_blank" rel="noreferrer">
            <code>contracts/docs/facilitator_guide.md</code>
          </a>
        </p>
      </section>

      <Separator className="my-6" />

      {/* Scenario Recipes */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Scenario Recipes</h2>

        <div className="rounded-md border p-4 space-y-2">
          <h3 className="font-semibold">1) Referral Revenue Split</h3>
          <p className="text-sm text-muted-foreground">Hook splits value among recipients based on bips.</p>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`// hookData encoding (server)
const splits = [
  { recipient: merchant, bips: 7000 },
  { recipient: referrer, bips: 2000 },
  { recipient: platform, bips: 1000 },
];
const hookData = AbiCoder.encode(['tuple(address,uint16)[]'], [splits]);

// PaymentRequirements.extra
extra: {
  settlementRouter,
  salt,
  payTo: merchant,
  facilitatorFee: '0',
  hook: revenueSplitHook,
  hookData,
}
`}
          </pre>
          <p className="text-xs">
            Client:{" "}
            <a
              href={`${GH_ROOT}examples/showcase/client/src/scenarios/ReferralSplit.tsx`}
              target="_blank"
              rel="noreferrer"
            >
              <code>examples/showcase/client/src/scenarios/ReferralSplit.tsx</code>
            </a>
          </p>
          <p className="text-xs">
            Server:{" "}
            <a
              href={`${GH_ROOT}examples/showcase/server/src/scenarios/referral.ts`}
              target="_blank"
              rel="noreferrer"
            >
              <code>examples/showcase/server/src/scenarios/referral.ts</code>
            </a>
          </p>
        </div>

        <div className="rounded-md border p-4 space-y-2">
          <h3 className="font-semibold">2) Random NFT Mint</h3>
          <p className="text-sm text-muted-foreground">Hook mints an ERC721 to the payer, then pays merchant.</p>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`// hookData encoding (server)
const cfg = { nftContract, tokenId: nextId, recipient: user, merchant };
const hookData = AbiCoder.encode(['tuple(address,uint256,address,address)'], [[cfg.nftContract, cfg.tokenId, cfg.recipient, cfg.merchant]]);

extra: { settlementRouter, salt, payTo: merchant, facilitatorFee: '0', hook: nftMintHook, hookData }
`}
          </pre>
          <p className="text-xs">
            Client:{" "}
            <a
              href={`${GH_ROOT}examples/showcase/client/src/scenarios/RandomNFT.tsx`}
              target="_blank"
              rel="noreferrer"
            >
              <code>examples/showcase/client/src/scenarios/RandomNFT.tsx</code>
            </a>
          </p>
          <p className="text-xs">
            Server:{" "}
            <a
              href={`${GH_ROOT}examples/showcase/server/src/scenarios/nft.ts`}
              target="_blank"
              rel="noreferrer"
            >
              <code>examples/showcase/server/src/scenarios/nft.ts</code>
            </a>
          </p>
        </div>

        <div className="rounded-md border p-4 space-y-2">
          <h3 className="font-semibold">3) Loyalty Points Reward</h3>
          <p className="text-sm text-muted-foreground">Hook transfers reward ERC20 to user and pays merchant.</p>
          <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`// reward calculation (example)
// 0.1 USDC (6dp) => 100,000; reward rate e.g. 1000 points per 0.1 USDC
uint256 rewardPoints = (amount * REWARD_RATE * 10**18) / 100_000;

extra: { settlementRouter, salt, payTo: merchant, facilitatorFee: '0', hook: rewardHook, hookData }
`}
          </pre>
          <p className="text-xs">
            Client:{" "}
            <a
              href={`${GH_ROOT}examples/showcase/client/src/scenarios/PointsReward.tsx`}
              target="_blank"
              rel="noreferrer"
            >
              <code>examples/showcase/client/src/scenarios/PointsReward.tsx</code>
            </a>
          </p>
          <p className="text-xs">
            Server:{" "}
            <a
              href={`${GH_ROOT}examples/showcase/server/src/scenarios/reward.ts`}
              target="_blank"
              rel="noreferrer"
            >
              <code>examples/showcase/server/src/scenarios/reward.ts</code>
            </a>
          </p>
        </div>
      </section>

      <Separator className="my-6" />

      {/* Facilitator endpoints (optional) */}
      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Facilitator</h2>
        <p className="text-sm text-muted-foreground">
          A reference Facilitator is provided in{" "}
          <a href={`${GH_ROOT}examples/facilitator`} target="_blank" rel="noreferrer">
            <code>examples/facilitator</code>
          </a>{" "}
          (Express). It exposes
          <code>/supported</code>, <code>/verify</code>, and <code>/settle</code> endpoints and automatically
          detects SettlementRouter mode.
        </p>
        <ul className="list-disc pl-6 text-sm">
          <li>
            Code:{" "}
            <a href={`${GH_ROOT}examples/facilitator/src/index.ts`} target="_blank" rel="noreferrer">
              <code>examples/facilitator/src/index.ts</code>
            </a>
          </li>
          <li>
            Guide:{" "}
            <a href={`${GH_ROOT}contracts/docs/facilitator_guide.md`} target="_blank" rel="noreferrer">
              <code>contracts/docs/facilitator_guide.md</code>
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
