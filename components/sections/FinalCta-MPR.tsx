import { ButtonLink } from "@/components/ui/ButtonLink";
import { ENQUIRY_MAILTO } from "@/lib/contact";

type FinalCtaProps = {
  title: string;
  copy: string;
};

export function FinalCta({ title, copy }: FinalCtaProps) {
  return (
    <section className="container-px pb-16 lg:pb-24">
      <div className="mx-auto max-w-7xl rounded-2xl border border-cream/10 bg-forest px-6 py-12 text-cream shadow-[0_22px_54px_rgba(15,37,39,0.12)] md:px-10 lg:px-14">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h2 className="display-heading max-w-2xl text-4xl leading-[1.06] text-balance md:text-5xl">
              {title}
            </h2>
            <p className="mt-5 max-w-2xl text-[16px] leading-8 text-cream/70">{copy}</p>
          </div>
          <ButtonLink href={ENQUIRY_MAILTO} variant="secondary" className="bg-cream">
            Book a conversation
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
