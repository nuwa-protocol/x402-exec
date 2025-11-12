import { PageHeader, PageHeaderHeading, PageHeaderDescription } from "@/components/page-header";
import BasicFAQ from "@/components/basic-faq";

export default function FAQPage() {
  return (
    <>
      <PageHeader>
        <PageHeaderHeading>FAQ</PageHeaderHeading>
        <PageHeaderDescription>Common questions about swapping and bridging.</PageHeaderDescription>
      </PageHeader>
      <BasicFAQ />
    </>
  );
}
