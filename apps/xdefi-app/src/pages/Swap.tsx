import { PageHeader, PageHeaderHeading } from "@/components/page-header";
import Seo from "@/components/Seo";
import { SwapComponent } from "@/components/ui/crypto-swap";

export default function SwapPage() {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading className="sr-only">Swap</PageHeaderHeading>
      </PageHeader>
      <Seo
        title="Swap"
        description="Trade tokens instantly with best-in-class UX."
        path="/"
        keywords={["swap", "dex", "exchange", "crypto", "xdefi"]}
      />
      <SwapComponent />
    </>
  );
}
