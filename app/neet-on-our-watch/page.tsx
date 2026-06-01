import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "NEET On Our Watch",
  description:
    "NEET On Our Watch is an MPR Consulting social impact initiative focused on practical barriers to employment, apprenticeships, skills and opportunity.",
  openGraph: {
    title: "NEET On Our Watch | MPR Consulting",
    description:
      "An MPR Consulting social impact initiative focused on practical barriers to employment, apprenticeships, skills and opportunity.",
  },
  alternates: {
    canonical: "/neet-on-our-watch",
  },
};

const principles = [
  {
    title: "Equip",
    copy: "Supporting access to practical essentials that help people move toward opportunity.",
  },
  {
    title: "Support",
    copy: "Helping reduce barriers that can stand between people and progression.",
  },
  {
    title: "Empower",
    copy: "Encouraging confidence, readiness and access to future pathways.",
  },
  {
    title: "Employ",
    copy: "Championing routes into employment, apprenticeships, training and sustainable opportunity.",
  },
];

const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-full px-5 text-center text-[12px] font-semibold uppercase tracking-[0.1em] leading-none transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";

export default function NeetOnOurWatchPage() {
  return (
    <>
      <section className="container-px relative isolate overflow-hidden bg-[#0a0a08] text-[#fbf7df]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full border border-[#efff39]/30" />
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#efff39]/55 to-transparent" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 py-16 md:py-20 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:py-24">
          <div className="reveal-up">
            <div className="max-w-sm rounded-2xl border border-[#efff39]/28 bg-[#fbf7df] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
              <Image
                src="/brand/neet-on-our-watch.png"
                alt="NEET On Our Watch"
                width={1254}
                height={1254}
                priority
                className="h-auto w-full"
              />
            </div>
          </div>

          <div className="reveal-up reveal-delay-2 max-w-4xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[#efff39]">
              MPR Consulting social impact initiative
            </p>
            <h1 className="display-heading mt-6 text-[3.15rem] leading-[0.96] text-[#fbf7df] sm:text-[4.5rem] md:text-[5.8rem] lg:text-[6.5rem]">
              NEET ON OUR WATCH
            </h1>
            <p className="mt-6 max-w-2xl text-[20px] leading-8 text-[#fbf7df]/84 md:text-2xl md:leading-9">
              Because practical barriers should not decide a young person&apos;s future.
            </p>
            <div className="mt-7 max-w-2xl space-y-4 text-[16px] leading-8 text-[#fbf7df]/70">
              <p>
                At MPR Consulting, we believe talent should not be held back by
                cost, access, circumstance or opportunity.
              </p>
              <p>
                NEET On Our Watch is our social impact initiative focused on
                supporting pathways into employment, apprenticeships, skills and
                opportunity.
              </p>
              <p className="font-semibold text-[#fbf7df]">
                Practical. Human. Purpose-driven.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#idea"
                className={`${buttonClass} bg-[#efff39] text-[#0a0a08] hover:bg-[#f6ff72] focus-visible:outline-[#efff39]`}
              >
                Learn More
              </a>
              <Link
                href="/contact"
                className={`${buttonClass} border border-[#fbf7df]/22 text-[#fbf7df] hover:bg-[#fbf7df]/10 focus-visible:outline-[#efff39]`}
              >
                Start a Conversation
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="idea" className="container-px bg-[#fbf7df]">
        <div className="mx-auto grid max-w-7xl gap-8 py-16 md:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6c6b24]">
              The idea
            </p>
            <h2 className="display-heading mt-5 text-5xl leading-[1.02] text-[#0a0a08] md:text-6xl">
              Small barriers. Big consequences.
            </h2>
          </div>
          <div className="max-w-3xl space-y-5 text-[18px] leading-9 text-[#0a0a08]/72">
            <p>
              Too often, opportunity is missed because of practical barriers
              such as travel costs, workwear, equipment, access challenges or
              readiness for work and training.
            </p>
            <p>
              NEET On Our Watch exists to shine a light on those barriers and
              support a more practical route into opportunity.
            </p>
            <p className="display-heading text-4xl leading-none text-[#0a0a08]">
              Not on our watch.
            </p>
          </div>
        </div>
      </section>

      <section className="container-px bg-[#fbf7df] pb-16 md:pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {principles.map((principle) => (
              <article
                key={principle.title}
                className="rounded-2xl border border-[#0a0a08]/10 bg-[#0a0a08] p-6 text-[#fbf7df] shadow-[0_18px_50px_rgba(10,10,8,0.08)]"
              >
                <div className="mb-8 h-1 w-12 bg-[#efff39]" />
                <h3 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#efff39]">
                  {principle.title}
                </h3>
                <p className="mt-5 text-[16px] leading-8 text-[#fbf7df]/76">
                  {principle.copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px bg-[#0a0a08] text-[#fbf7df]">
        <div className="mx-auto grid max-w-7xl gap-8 py-16 md:py-20 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#efff39]">
              Why it exists
            </p>
            <h2 className="display-heading mt-5 text-5xl leading-[1.02] md:text-6xl">
              Built around a simple belief.
            </h2>
          </div>
          <div className="max-w-3xl space-y-5 text-[18px] leading-9 text-[#fbf7df]/72">
            <p>Potential exists everywhere. Opportunity does not always.</p>
            <p>
              NEET On Our Watch reflects our belief that practical support,
              purposeful partnerships and focused action can help widen access
              to work, skills and future opportunity.
            </p>
          </div>
        </div>
      </section>

      <section className="container-px bg-[#fbf7df]">
        <div className="mx-auto grid max-w-7xl gap-8 py-16 md:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#6c6b24]">
              Looking ahead
            </p>
            <h2 className="display-heading mt-5 text-5xl leading-[1.02] text-[#0a0a08] md:text-6xl">
              Looking ahead.
            </h2>
          </div>
          <div className="max-w-3xl">
            <p className="text-[18px] leading-9 text-[#0a0a08]/72">
              As the initiative develops, we hope to collaborate with employers,
              providers, organisations and partners who share the ambition of
              reducing barriers to employment, skills and opportunity.
            </p>
            <Link
              href="/contact"
              className={`${buttonClass} mt-8 bg-[#0a0a08] text-[#fbf7df] hover:bg-[#202018] focus-visible:outline-[#0a0a08]`}
            >
              Start a Conversation
            </Link>
          </div>
        </div>
      </section>

      <section className="container-px border-t border-[#0a0a08]/10 bg-[#fbf7df] py-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm leading-7 text-[#0a0a08]/58">
            NEET On Our Watch is currently an MPR Consulting social impact
            initiative.
          </p>
        </div>
      </section>
    </>
  );
}
