import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { ApplicationHooksSnippets } from "./application-hooks-snippets";

// Simplified hero: remove illustration and complex code block.
// Add a small installation snippet with common package managers.
export function Hero() {
  const navigate = useNavigate();
  return (
    <section className="relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_50%_at_50%_0%,hsl(var(--muted))_0%,transparent_70%)]" />
      <div className="relative mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold tracking-tight md:text-6xl">
          Pay and Execute Any Smart Contract
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground">
          x402x (short for x402-exec) extends the original x402 payments
          protocol, and{" "}
          <span className="font-semibold">
            enables Gas-Free and Approval-Free smart contract interactions and
            DApps.
          </span>
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="default"
            onClick={() => {
              navigate("/docs");
            }}
            className="cursor-pointer"
          >
            <span className="inline-flex items-center gap-2">
              Start Building
            </span>
          </Button>
          <Button variant="ghost" asChild className="cursor-pointer">
            <Link to="/ecosystem">Explore Ecosystems</Link>
          </Button>
        </div>

        {/* Application hooks */}
        <ApplicationHooksSnippets />
      </div>
    </section>
  );
}

export default Hero;
