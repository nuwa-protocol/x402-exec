import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CodeBlock,
  CodeBlockBody,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockFilename,
  CodeBlockFiles,
  CodeBlockHeader,
  CodeBlockItem,
} from "@/components/ui/shadcn-io/code-block";
import { ArrowLeftRight, Coins, GitBranch, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

// Centralized snippets for demo/code examples used across the site
export type NodeKey =
  | "hook-shared"
  | "hook-split"
  | "hook-mint"
  | "hook-rewards";

type Snippet = {
  title: string;
  lang: "solidity";
  explain: string;
  code: string;
};

// Centralized snippets so App and other components can reuse them
export const SNIPPETS: Record<NodeKey, Snippet> = {
  "hook-shared": {
    title: "settlement-router.sol",
    lang: "solidity",
    explain:
      "Router approves funds then calls your Hook.execute. See @contracts/examples for full code.",
    code: `function settleAndExecute(
  address token, address from, uint256 value, bytes32 nonce, bytes calldata sig,
  bytes32 salt, address payTo, uint256 fee, address hook, bytes calldata data
) external {
  IERC3009(token).transferWithAuthorization(
    from, address(this), value, 0, type(uint256).max, nonce, sig
  );

  uint256 amt = value - fee;

  if (hook != address(0)) {
    IERC20(token).forceApprove(hook, amt);

    ISettlementHook(hook).execute(
      keccak256(abi.encodePacked(from, token, nonce)),
      from, token, amt, salt, payTo, msg.sender, data
    );
  }
}`,
  },
  "hook-split": {
    title: "payment-split-hook.sol",
    lang: "solidity",
    explain: "Only the execute part. See @contracts/examples for full code.",
    code: `function execute(
  bytes32, address, address token, uint256 amount, bytes32, address, address, bytes calldata data
) external returns (bytes memory) {
  Split[] memory s = abi.decode(data, (Split[]));

  uint256 total;
  for (uint i; i < s.length; i++) {
    require(s[i].recipient != address(0), "RECIPIENT");
    total += s[i].bips;
  }
  require(total == 10000, "BPS");

  uint256 remain = amount;
  for (uint i; i < s.length; i++) {
    uint256 part = i == s.length - 1 ? remain : (amount * s[i].bips) / 10000;
    if (i != s.length - 1) remain -= part;
    IERC20(token).transferFrom(settlementRouter, s[i].recipient, part);
  }
  return abi.encode(s.length);
}`,
  },
  "hook-mint": {
    title: "pay-to-mint-hook.sol",
    lang: "solidity",
    explain: "Only the execute part. See @contracts/examples for full code.",
    code: `function execute(
  bytes32, address, address token, uint256 amount, bytes32, address, address, bytes calldata data
) external returns (bytes memory) {
  MintConfig memory c = abi.decode(data, (MintConfig));

  require(
    c.nftContract != address(0) && c.recipient != address(0) && c.merchant != address(0),
    "ADDR"
  );

  (bool ok,) = c.nftContract.call(
    abi.encodeWithSignature("mint(address,uint256)", c.recipient, c.tokenId)
  );
  require(ok, "MINT");

  IERC20(token).transferFrom(settlementRouter, c.merchant, amount);
  return abi.encode(c.tokenId);
}`,
  },
  "hook-rewards": {
    title: "pay-to-reward-hook.sol",
    lang: "solidity",
    explain: "Only the execute part. See @contracts/examples for full code.",
    code: `function execute(
  bytes32, address payer, address token, uint256 amount, bytes32, address, address, bytes calldata data
) external returns (bytes memory) {
  RewardConfig memory c = abi.decode(data, (RewardConfig));

  require(c.rewardToken != address(0) && c.merchant != address(0), "ADDR");

  IERC20(token).transferFrom(settlementRouter, c.merchant, amount);

  uint256 points = (amount * REWARD_RATE * 1e18) / 100000;
  IRewardToken(c.rewardToken).distribute(payer, points);

  return abi.encode(points);
}`,
  },
};

export const ApplicationHooksSnippets = () => {
  // Track the selected application hook for the dynamic code below
  const [activeHook, setActiveHook] = useState<NodeKey>("hook-shared");

  const codeData = useMemo(
    () => [
      {
        language: "solidity",
        filename: SNIPPETS[activeHook].title,
        code: SNIPPETS[activeHook].code,
      },
    ],
    [activeHook],
  );

  return (
    <div className="mx-auto mt-12 max-w-6xl text-left">
      <h2 className="text-2xl font-semibold tracking-tight">
        Application Hooks
      </h2>
      <p className="mt-2 text-muted-foreground">
        Compose on-chain actions that run atomically with a payment.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5 lg:items-stretch lg:min-h-[360px]">
        {/* Left: cards list */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Hook Flow (shared impl) */}
          <Card
            tabIndex={0}
            onClick={() => setActiveHook("hook-shared")}
            className={`${activeHook === "hook-shared" ? "ring-2 ring-primary/40" : ""} cursor-pointer`}
          >
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" /> Hook Contract
              </CardTitle>
              <CardDescription>
                How Settlement Router contract calls your Hook.execute.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Split */}
          <Card
            tabIndex={0}
            onClick={() => setActiveHook("hook-split")}
            className={`${activeHook === "hook-split" ? "ring-2 ring-primary/40" : ""} cursor-pointer`}
          >
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <GitBranch className="h-4 w-4" /> Split Payment
              </CardTitle>
              <CardDescription>
                Fan out payment funds to multiple recipients.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Mint */}
          <Card
            tabIndex={0}
            onClick={() => setActiveHook("hook-mint")}
            className={`${activeHook === "hook-mint" ? "ring-2 ring-primary/40" : ""} cursor-pointer`}
          >
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <Coins className="h-4 w-4" /> Pay & Mint
              </CardTitle>
              <CardDescription>
                Mint an NFT or token as part of checkout.
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Rewards */}
          <Card
            tabIndex={0}
            onClick={() => setActiveHook("hook-rewards")}
            className={`${activeHook === "hook-rewards" ? "ring-2 ring-primary/40" : ""} cursor-pointer`}
          >
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <Trophy className="h-4 w-4" /> Rewards
              </CardTitle>
              <CardDescription>
                Distribute points, badges, or rebates.
              </CardDescription>
            </CardHeader>
          </Card>

          <p className="text-muted-foreground text-sm">
            The code snippet showing here are for demonstration purpose. Find
            the complete implementations on{" "}
            <a
              href="https://github.com/nuwa-protocol/x402-exec/tree/main/contracts/examples"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              x402X GitHub repository.
            </a>
          </p>
        </div>

        {/* Right: code snippet with syntax highlighting */}
        <div className="lg:col-span-3 h-full">
          <CodeBlock
            data={codeData}
            value="solidity"
            className="bg-muted/40 flex h-full flex-col"
          >
            <CodeBlockHeader>
              <CodeBlockFiles>
                {(item) => (
                  <CodeBlockFilename key={item.language} value={item.language}>
                    {item.filename}
                  </CodeBlockFilename>
                )}
              </CodeBlockFiles>
              <div className="ml-auto">
                <CodeBlockCopyButton />
              </div>
            </CodeBlockHeader>
            <CodeBlockBody className="min-h-0 flex-1 overflow-auto">
              {(item) => (
                <CodeBlockItem
                  key={item.language}
                  value={item.language}
                  className="h-full"
                >
                  <CodeBlockContent
                    language="solidity"
                    className="h-full [&_.shiki]:!bg-black [&_.shiki]:!h-full [&_.shiki]:!m-0 [&_.shiki]:!p-4"
                  >
                    {item.code}
                  </CodeBlockContent>
                </CodeBlockItem>
              )}
            </CodeBlockBody>
          </CodeBlock>
        </div>
      </div>
    </div>
  );
};
