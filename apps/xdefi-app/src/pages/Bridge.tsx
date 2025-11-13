import { BridgeComponent } from "@/components/crypto-swap";
import { PageHeader, PageHeaderHeading } from "@/components/page-header";
import Seo from "@/components/Seo";

export default function BridgePage() {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading className="sr-only">Bridge</PageHeaderHeading>
      </PageHeader>
      <Seo
        title="Bridge"
        description="Move assets seamlessly across networks."
        path="/bridge"
        keywords={["bridge", "cross-chain", "l2", "crypto", "xdefi"]}
      />
      <BridgeComponent />
    </>
  );
}
