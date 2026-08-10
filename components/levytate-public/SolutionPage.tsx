import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PublicFooter, PublicHeader } from "@/components/levytate-public/PublicHeader";

export type SolutionSection = {
  id?: string;
  label: string;
  title: string;
  copy: string;
  points: string[];
};

export type SolutionVisualItem = {
  label: string;
  value: string;
  detail: string;
  status?: string;
};

export type SolutionPageProps = {
  variant: "employer" | "employee" | "provider";
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: string;
  primaryHref: string;
  secondaryCta?: string;
  secondaryHref?: string;
  painsTitle: string;
  pains: string[];
  sections: SolutionSection[];
  visualEyebrow: string;
  visualTitle: string;
  visualItems: SolutionVisualItem[];
  closingTitle: string;
  closingCopy: string;
};

const frame = "mx-auto max-w-[90rem] px-6 sm:px-8 lg:px-10 xl:px-12";

export function SolutionPage({
  variant,
  eyebrow,
  title,
  description,
  primaryCta,
  primaryHref,
  secondaryCta,
  secondaryHref,
  painsTitle,
  pains,
  sections,
  visualEyebrow,
  visualTitle,
  visualItems,
  closingTitle,
  closingCopy,
}: SolutionPageProps) {
  return (
    <div className="min-h-screen bg-[#f6fbf8] text-[#102c3d]">
      <PublicHeader />
      <main>
        <section className="relative overflow-hidden border-b border-[#102c3d]/[0.07] bg-[linear-gradient(180deg,#fbfdfc_0%,#f1f8f5_100%)]">
          <div className={`${frame} grid gap-12 py-14 sm:py-16 lg:py-20 xl:grid-cols-[45fr_55fr] xl:items-center xl:gap-16`}>
            <div className="max-w-[42rem]">
              <div className="flex items-center gap-3">
                <span className="h-px w-8 bg-[#c95568]" aria-hidden="true" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a9475a]">{eyebrow}</p>
              </div>
              <h1 className="mt-6 text-balance text-[clamp(3rem,4.5vw,4.1rem)] font-semibold leading-[1] tracking-[-0.05em]">{title}</h1>
              <p className="mt-7 max-w-[39rem] text-[17px] leading-[1.65] text-[#102c3d]/[0.72] sm:text-[18px]">{description}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ActionLink href={primaryHref} primary>{primaryCta}<ArrowRight size={15} aria-hidden="true" /></ActionLink>
                {secondaryCta && secondaryHref ? <ActionLink href={secondaryHref}>{secondaryCta}</ActionLink> : null}
              </div>
            </div>
            <div className="mx-auto w-full max-w-[760px] xl:mx-0 xl:justify-self-end">
              <SolutionHeroVisual variant={variant} eyebrow={visualEyebrow} title={visualTitle} items={visualItems} />
            </div>
          </div>
        </section>

        <section className="bg-[#102c3d] text-white">
          <div className={`${frame} grid gap-12 py-20 lg:grid-cols-[.78fr_1.22fr] lg:py-24`}>
            <div className="max-w-[34rem]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c7f0e4]/[0.64]">The challenge</p>
              <h2 className="mt-4 text-balance text-[clamp(2.35rem,3.5vw,3.2rem)] font-semibold leading-[1.06] tracking-[-0.038em]">{painsTitle}</h2>
            </div>
            <ul className="grid border-y border-white/[0.10] sm:grid-cols-2">
              {pains.map((pain, index) => (
                <li key={pain} className={`grid min-h-[76px] grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 border-b border-white/[0.10] py-4 text-[13px] font-medium leading-5 text-white/[0.72] sm:px-5 ${index % 2 === 0 ? "sm:border-r" : ""} ${index >= pains.length - 2 ? "sm:border-b-0" : ""}`}>
                  <span className="text-[10px] font-semibold text-[#ff9eaa]">0{index + 1}</span>
                  <span>{pain}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-white">
          <div className={`${frame} py-24 lg:py-28`}>
            <div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a9475a]">How LevyTate helps</p>
                <h2 className="mt-4 text-balance text-[clamp(2.5rem,4vw,3.55rem)] font-semibold leading-[1.04] tracking-[-0.04em]">A focused experience built around the work people need to complete.</h2>
              </div>
              <p className="max-w-[40rem] text-[16px] leading-7 text-[#102c3d]/[0.68] lg:justify-self-end">Every section keeps the current task, owner and next step clear—without forcing every role into the same interface.</p>
            </div>

            <div className="mt-14 border-y border-[#102c3d]/[0.1]">
              {sections.map((section, index) => (
                <article id={section.id} key={section.title} className="scroll-mt-28 grid gap-7 border-b border-[#102c3d]/[0.07] py-9 last:border-b-0 lg:grid-cols-[3rem_.78fr_1.22fr] lg:gap-10 lg:py-11">
                  <span className="text-[11px] font-semibold text-[#c95568]">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">{section.label}</p>
                    <h3 className="mt-3 text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[30px]">{section.title}</h3>
                    <p className="mt-4 max-w-[34rem] text-[14px] leading-7 text-[#102c3d]/[0.68]">{section.copy}</p>
                  </div>
                  <FeatureIndex points={section.points} featured={variant === "employer" && index === 0} />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[#102c3d]/[0.07] bg-[#eef7f3] px-6 py-20 sm:px-8 lg:px-10 lg:py-24 xl:px-12">
          <div className="mx-auto grid max-w-[90rem] gap-8 rounded-[20px] bg-[#102c3d] p-7 text-white sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
            <div>
              <h2 className="max-w-[54rem] text-balance text-[clamp(2.35rem,3.6vw,3.35rem)] font-semibold leading-[1.05] tracking-[-0.04em]">{closingTitle}</h2>
              <p className="mt-5 max-w-[44rem] text-[16px] leading-7 text-white/[0.74]">{closingCopy}</p>
            </div>
            <ActionLink href={primaryHref} light>{primaryCta}<ArrowRight size={15} aria-hidden="true" /></ActionLink>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

function SolutionHeroVisual({ variant, eyebrow, title, items }: { variant: SolutionPageProps["variant"]; eyebrow: string; title: string; items: SolutionVisualItem[] }) {
  const accent = variant === "employee" ? "bg-[#d65b70]" : variant === "provider" ? "bg-[#567f9d]" : "bg-[#159b8f]";
  return (
    <div className="overflow-hidden rounded-[22px] bg-[#0a2333] text-white shadow-[0_30px_85px_rgba(9,31,45,0.22)] ring-1 ring-white/[0.10]">
      <div className="flex items-center justify-between gap-5 border-b border-white/[0.08] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <span className={`h-2 w-2 ${accent}`} aria-hidden="true" />
          <div>
            <p className="text-[13px] font-semibold">{title}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/[0.58]">{eyebrow}</p>
          </div>
        </div>
        <p className="text-[10px] text-white/[0.58]">Example workspace</p>
      </div>
      <div className={`bg-[#f4f7f6] p-4 text-[#102c3d] sm:p-5 ${variant === "employee" ? "sm:px-8 sm:py-7" : ""}`}>
        {variant === "employee" ? <EmployeeVisual items={items} /> : variant === "provider" ? <ProviderVisual items={items} /> : <EmployerVisual items={items} />}
      </div>
    </div>
  );
}

function EmployerVisual({ items }: { items: SolutionVisualItem[] }) {
  return (
    <div className="overflow-hidden rounded-[14px] bg-white ring-1 ring-[#102c3d]/[0.07]">
      <div className="border-b border-[#102c3d]/[0.07] px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/[0.66]">Programme overview</p><p className="mt-2 text-[17px] font-semibold tracking-[-0.02em]">Today&apos;s operating view</p></div>
      {items.map((item) => (
        <div key={item.label} className="grid gap-3 border-b border-[#102c3d]/[0.06] px-5 py-4 last:border-b-0 sm:grid-cols-[.55fr_1fr_auto] sm:items-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/[0.66]">{item.label}</p>
          <div><p className="text-[12px] font-semibold">{item.value}</p><p className="mt-1 text-[10px] text-[#102c3d]/[0.66]">{item.detail}</p></div>
          {item.status ? <span className="w-fit rounded-md bg-[#eaf7f2] px-2 py-1 text-[10px] font-semibold text-[#0b6f63]">{item.status}</span> : null}
        </div>
      ))}
    </div>
  );
}

function EmployeeVisual({ items }: { items: SolutionVisualItem[] }) {
  return (
    <div className="overflow-hidden rounded-[14px] bg-white ring-1 ring-[#102c3d]/[0.07]">
      <div className="border-b border-[#102c3d]/[0.07] px-5 py-5"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#a9475a]">{items[0]?.label}</p><div className="mt-3 flex items-center justify-between gap-4"><p className="text-[17px] font-semibold">{items[0]?.value}</p><span className="rounded-md bg-[#fff1f3] px-2 py-1 text-[10px] font-semibold text-[#a53b4f]">{items[0]?.status}</span></div><p className="mt-2 text-[11px] text-[#102c3d]/[0.66]">{items[0]?.detail}</p></div>
      <div className="divide-y divide-[#102c3d]/[0.06] px-5">
        {items.slice(1).map((item, index) => <div key={item.label} className="grid grid-cols-[24px_minmax(0,1fr)] gap-3 py-4"><span className="grid h-6 w-6 place-items-center rounded-full bg-[#eef7f3] text-[9px] font-semibold text-[#0b6f63]">0{index + 1}</span><div><p className="text-[11px] font-semibold">{item.value}</p><p className="mt-1 text-[10px] leading-4 text-[#102c3d]/[0.66]">{item.detail}</p></div></div>)}
      </div>
    </div>
  );
}

function ProviderVisual({ items }: { items: SolutionVisualItem[] }) {
  return (
    <div className="grid overflow-hidden rounded-[14px] bg-white ring-1 ring-[#102c3d]/[0.07] sm:grid-cols-[.82fr_1.18fr]">
      <div className="border-b border-[#102c3d]/[0.07] bg-[#102c3d] p-5 text-white sm:border-b-0 sm:border-r sm:border-white/[0.10]"><p className="text-[10px] uppercase tracking-[0.12em] text-[#c7f0e4]/[0.72]">{items[0]?.label}</p><p className="mt-4 text-[18px] font-semibold">{items[0]?.value}</p><p className="mt-2 text-[11px] leading-5 text-white/[0.66]">{items[0]?.detail}</p></div>
      <div className="divide-y divide-[#102c3d]/[0.06] px-5">
        {items.slice(1).map((item) => <div key={item.label} className="grid grid-cols-[.65fr_1fr] gap-3 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/[0.66]">{item.label}</p><div><p className="text-[11px] font-semibold">{item.value}</p><p className="mt-1 text-[10px] leading-4 text-[#102c3d]/[0.66]">{item.detail}</p></div></div>)}
      </div>
    </div>
  );
}

function FeatureIndex({ points, featured }: { points: string[]; featured: boolean }) {
  return (
    <ul className={`grid overflow-hidden rounded-[14px] sm:grid-cols-2 ${featured ? "bg-[#102c3d] text-white" : "bg-[#f3f7f5] text-[#102c3d]"}`}>
      {points.map((point, index) => (
        <li key={point} className={`flex min-h-[70px] items-center gap-3 border-b p-4 text-[12px] font-medium leading-5 sm:px-5 ${featured ? "border-white/[0.08] text-white/[0.74]" : "border-[#102c3d]/[0.06] text-[#102c3d]/[0.68]"} ${index % 2 === 0 ? "sm:border-r" : ""} ${index >= points.length - 2 ? "sm:border-b-0" : ""}`}>
          <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${featured ? "bg-[#c7f0e4] text-[#102c3d]" : "bg-white text-[#0b6f63]"}`}><Check size={12} aria-hidden="true" /></span>
          <span>{point}</span>
        </li>
      ))}
    </ul>
  );
}

function ActionLink({ href, children, primary = false, light = false }: { href: string; children: React.ReactNode; primary?: boolean; light?: boolean }) {
  const classes = `inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-4 ${light ? "bg-white text-[#102c3d] hover:bg-[#eef8f4] focus-visible:ring-[#c7f0e4]/[0.35]" : primary ? "bg-[#102c3d] text-white hover:bg-[#183b50] focus-visible:ring-[#159b8f]/[0.25]" : "bg-white text-[#102c3d] ring-1 ring-[#102c3d]/[0.1] hover:bg-[#f4f8f6] focus-visible:ring-[#159b8f]/[0.20]"}`;
  return href.startsWith("/") ? <Link href={href} className={classes}>{children}</Link> : <a href={href} className={classes}>{children}</a>;
}
