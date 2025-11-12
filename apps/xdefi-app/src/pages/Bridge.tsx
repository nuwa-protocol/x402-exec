import { PageHeader, PageHeaderHeading } from "@/components/page-header";
import { CryptoSwapComponent } from "@/components/ui/crypto-swap";

export default function BridgePage() {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading>Bridge</PageHeaderHeading>
      </PageHeader>
      <CryptoSwapComponent mode="bridge" />
    </>
  );
}

