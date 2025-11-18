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
import { type NodeKey, SNIPPETS } from "@/constants/hooks";
import { ArrowLeftRight, Coins, GitBranch, Rocket, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../ui/button";

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
      <div className="flex flex-row justify-between items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Application Scenarios
          </h2>
          <p className="mt-2 text-muted-foreground">
            Explore common checkout workflows you can power with x402x hooks.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="default"
            onClick={() => window.open("https://demo.x402x.dev/", "_blank")}
            className="cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              Try Demo
            </span>
          </Button>
        </div>
      </div>

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
              x402x GitHub repository.
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
