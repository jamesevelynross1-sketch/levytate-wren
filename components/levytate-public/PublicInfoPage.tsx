import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/levytate-public/PublicHeader";

export function PublicInfoPage({
  eyebrow,
  title,
  description,
  items,
  ctaLabel = "Request Early Access",
  ctaHref = "/early-access",
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: Array<{ title: string; copy: string }>;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const isMailLink = ctaHref.startsWith("mailto:");

  return (
    <div className="min-h-screen bg-[#f6fbf8] text-[#102c3d]">
      <PublicHeader />
      <main>
        <section className="border-b border-[#102c3d]/[0.07] bg-[linear-gradient(180deg,#f6fbf8_0%,#eef8f4_100%)]">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8 lg:py-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">{eyebrow}</p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">{title}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-[#102c3d]/[0.72]">{description}</p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="grid gap-4 md:grid-cols-2">
            {items.map((item, index) => (
              <article key={item.title} className="rounded-[1.5rem] border border-[#102c3d]/[0.07] bg-white p-6 shadow-[0_18px_50px_rgba(16,44,61,0.055)]">
                <span className="text-xs font-semibold text-[#0b6f63]">0{index + 1}</span>
                <h2 className="mt-4 text-xl font-semibold">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-[#102c3d]/[0.68]">{item.copy}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 rounded-[1.7rem] bg-[#102c3d] p-7 text-white sm:flex sm:items-center sm:justify-between sm:gap-8">
            <div>
              <p className="text-sm font-semibold">LevyTate Early Access</p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/[0.74]">Speak with the LevyTate team about early access, employer requirements or provider partnership opportunities.</p>
            </div>
            {isMailLink ? (
              <a href={ctaHref} className="mt-5 inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-[#102c3d] sm:mt-0">{ctaLabel}</a>
            ) : (
              <Link href={ctaHref} className="mt-5 inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-[#102c3d] sm:mt-0">{ctaLabel}</Link>
            )}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
