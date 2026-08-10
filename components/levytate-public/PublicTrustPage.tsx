import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/levytate-public/PublicHeader";
import type { PublicTrustPage as PublicTrustPageContent } from "@/lib/levytate/public-trust-content";

export function PublicTrustPage({ page }: { page: PublicTrustPageContent }) {
  return <div className="min-h-screen overflow-x-hidden bg-[#f6fbf8] text-[#102c3d]">
    <PublicHeader />
    <main id="main-content" className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <header className="rounded-[1.6rem] bg-[#102c3d] px-6 py-8 text-white sm:px-10 sm:py-11">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8fe0d2]">Trust and support</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">{page.title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/[0.76] sm:text-base">{page.summary}</p>
      </header>
      <div className="mt-6 grid gap-5">
        {page.sections.map((section) => <section key={section.heading} className="rounded-[1.25rem] border border-[#102c3d]/[0.08] bg-white p-5 shadow-[0_12px_30px_rgba(16,44,61,0.035)] sm:p-7">
          <h2 className="text-xl font-semibold tracking-[-0.02em]">{section.heading}</h2>
          <div className="mt-3 grid gap-3 text-sm leading-7 text-[#102c3d]/[0.68]">{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          {section.bullets ? <ul className="mt-4 grid gap-2 pl-5 text-sm leading-6 text-[#102c3d]/[0.68] marker:text-[#159b8f]">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
        </section>)}
      </div>
      <aside className="mt-6 rounded-[1.25rem] border border-[#159b8f]/[0.20] bg-[#eef9f5] p-5 sm:p-7">
        <h2 className="text-lg font-semibold">Contact {page.contactLabel}</h2>
        <p className="mt-2 text-sm leading-6 text-[#102c3d]/[0.70]">For help or questions, email <a className="font-semibold text-[#087c73] underline decoration-[#087c73]/[0.30] underline-offset-4" href={`mailto:${page.contactEmail}`}>{page.contactEmail}</a>. Never send passwords, magic links, tokens or credentials.</p>
      </aside>
      <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#102c3d]/[0.66]"><span>Version {page.version}</span><span>Effective {page.effectiveDate}</span><span>Last reviewed {page.lastReviewedDate}</span><span>Owner: {page.publicOwner}</span></div>
      <Link href="/levytate/login" className="mt-8 inline-flex min-h-11 items-center rounded-full bg-[#102c3d] px-5 text-sm font-semibold text-white focus:outline-none focus:ring-4 focus:ring-[#159b8f]/[0.25]">Return to sign in</Link>
    </main>
    <PublicFooter />
  </div>;
}
