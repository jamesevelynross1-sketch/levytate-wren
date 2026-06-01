import type { Metadata } from "next";
import { UnsubscribeForm } from "@/components/forms/UnsubscribeForm";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Unsubscribe from MPR Weekly Intelligence Briefing.",
};

type UnsubscribePageProps = {
  searchParams: Promise<{
    email?: string;
    token?: string;
  }>;
};

export default async function UnsubscribePage({ searchParams }: UnsubscribePageProps) {
  const params = await searchParams;

  return (
    <section className="container-px mx-auto max-w-3xl pb-20 pt-16 lg:pb-28 lg:pt-24">
      <div className="premium-card rounded-xl p-7 md:p-10">
        <SectionEyebrow>MPR Weekly Intelligence Briefing</SectionEyebrow>
        <h1 className="display-heading mt-5 text-4xl leading-[1.08] text-ink text-balance md:text-5xl">
          Unsubscribe from briefing emails.
        </h1>
        <p className="mt-5 text-[16px] leading-8 text-ink/66">
          Confirm below and we will remove your address from future MPR
          Intelligence Briefing sends.
        </p>
        <UnsubscribeForm initialEmail={params.email ?? ""} token={params.token ?? ""} />
      </div>
    </section>
  );
}
