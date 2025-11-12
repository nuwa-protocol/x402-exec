import { PageHeader, PageHeaderHeading } from "@/components/page-header";
import { CryptoSwapComponent } from "@/components/ui/crypto-swap";

export default function SwapPage() {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading>Swap</PageHeaderHeading>
      </PageHeader>
      <CryptoSwapComponent mode="swap" />
    </>
  );
}

