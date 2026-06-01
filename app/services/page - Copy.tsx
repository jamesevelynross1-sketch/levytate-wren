import type { Metadata } from "next";
import { ServiceCard } from "@/components/cards/ServiceCard";
import { FinalCta } from "@/components/sections/FinalCta";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { services } from "@/lib/content";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Independent apprenticeship strategy, provider matching, levy guidance and workforce capability advisory.",
};

export default function ServicesPage() {
  return (
    <>
      <section className="container-px mx-auto max-w-7xl pb-14 pt-14 lg:pb-20 lg:pt-20">
        <SectionEyebrow>Services</SectionEyebrow>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <h1 className="display-heading text-5xl leading-[1.04] text-ink text-balance md:text-6xl">
            Advisory support across the apprenticeship decision cycle.
          </h1>
          <p className="text-[17px] leading-8 text-ink/66">
            MPR Consulting helps employers move from broad interest to a clear,
            credible plan for funded workforce development. Each service is
            designed to improve decision quality and reduce delivery risk.
          </p>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-16 lg:pb-20">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service, index) => (
            <ServiceCard key={service.title} {...service} index={index} />
          ))}
        </div>
      </section>

      <FinalCta
        title="Need clarity on where to start?"
        copy="We can help you assess your current position, identify the right priorities and shape a practical route forward."
      />
    </>
  );
}
