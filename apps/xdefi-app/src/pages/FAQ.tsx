import BasicFAQ from "@/components/basic-faq";
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
} from "@/components/page-header";
import Seo from "@/components/Seo";

export default function FAQPage() {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading className="sr-only">FAQ</PageHeaderHeading>
        <PageHeaderDescription className="sr-only">
          Common questions about swapping and bridging.
        </PageHeaderDescription>
      </PageHeader>
      <Seo
        title="FAQ"
        description="Answers to common questions about swapping and bridging crypto on xdefi.app."
        path="/faq"
      />
      <BasicFAQ />
    </>
  );
}
