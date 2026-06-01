import { ButtonLink } from "@/components/ui/ButtonLink";
import { ENQUIRY_MAILTO } from "@/lib/contact";

type FinalCtaProps = {
  title?: string;
  copy?: string;
};

export function FinalCta({
  title = "Ready to make apprenticeships work harder for your organisation?",
  copy = "Start with a focused conversation about your workforce priorities, current training activity and the decisions that need more clarity.",
}: FinalCtaProps) {
  return (
    <section className="container-px mx-auto max-w-7xl pb-20">
      <div className="overflow-hidden rounded-3xl bg-ink p-8 text-cream shadow-soft md:p-10 lg:p-12">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-teal">
              Start the conversation
            </p>
            <h2 className="display-heading max-w-3xl text-4xl leading-[1.08] text-balance md:text-5xl">
              {title}
            </h2>
            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-cream/74">
              {copy}
            </p>
          </div>
          <ButtonLink
            href={ENQUIRY_MAILTO}
            variant="secondary"
            className="border-cream/20 bg-cream text-ink hover:bg-white"
          >
            Book a conversation
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
