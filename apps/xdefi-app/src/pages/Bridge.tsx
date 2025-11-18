import { SwapComponent } from "@/components/crypto-swap";
import { PageHeader, PageHeaderHeading } from "@/components/page-header";
import Seo from "@/components/Seo";

export default function BridgePage() {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading className="sr-only">Bridge</PageHeaderHeading>
      </PageHeader>
      {/* Let Seo auto-detect the current pathname for canonical URL */}
      <Seo
        title="Bridge"
        description="Bridge assets across supported EVM networks with transparent fees and slippage-aware routing. Coming soon."
        keywords={["bridge", "cross-chain", "evm", "l2", "crypto", "xdefi"]}
      />
      {/* Wrap the current UI with an overlay to mark the page as coming soon. */}
      <div className="relative">
        {/* Underlying content remains for layout preview but is blocked by the overlay */}
        <SwapComponent />

        {/* Blurred overlay with message */}
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="rounded-xl border bg-card/80 backdrop-blur-md px-6 py-4 shadow-lg text-center">
            <div className="text-2xl font-semibold">Coming Soon</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Bridge feature is under development
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
