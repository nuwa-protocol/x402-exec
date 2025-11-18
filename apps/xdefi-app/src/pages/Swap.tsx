import { SwapComponent } from "@/components/crypto-swap";
import { PageHeader, PageHeaderHeading } from "@/components/page-header";
import Seo from "@/components/Seo";

export default function SwapPage() {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading className="sr-only">Swap</PageHeaderHeading>
      </PageHeader>
      {/* Let Seo infer canonical from current route; avoids forcing '/' on /swap */}
      <Seo
        title="Swap"
        description="Swap tokens across EVM networks with aggregated DEX routing, real-time quotes, slippage control, and transparent fees."
        keywords={["swap", "dex", "exchange", "crypto", "xdefi", "evm", "price routing"]}
      />
      <SwapComponent />
    </>
  );
}
