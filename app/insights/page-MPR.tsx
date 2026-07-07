import type { Metadata } from "next";
import Link from "next/link";
import { BriefingSubscribeForm } from "@/components/forms/BriefingSubscribeForm";
import { FinalCta } from "@/components/sections/FinalCta";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { getApprenticeshipNews } from "@/lib/apprenticeship-news";
import { insightCards } from "@/lib/content";
import { cleanDisplayText } from "@/lib/html-text";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Practical MPR Consulting insight on apprenticeship strategy, provider matching and funded workforce development.",
  openGraph: {
    title: "Insights | MPR Consulting",
    description:
      "Practical insight on apprenticeships, levy strategy, provider selection and workforce capability.",
  },
  alternates: {
    canonical: "/insights",
  },
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function InsightsPage() {
  const newsArticles = await getApprenticeshipNews(8);

  return (
    <>
      <section className="container-px mx-auto max-w-7xl pb-14 pt-14 lg:pb-20 lg:pt-20">
        <SectionEyebrow>Insights</SectionEyebrow>
        <div className="grid gap-10 lg:grid-cols-[1fr_0.72fr] lg:items-end">
          <div>
            <h1 className="display-heading text-5xl leading-[1.04] text-ink text-balance md:text-6xl">
              Clear thinking on apprenticeships and workforce capability.
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-8 text-ink/66">
              A developing space for practical perspectives on funded training,
              provider selection and the decisions employers face when building
              capability through apprenticeships.
            </p>
          </div>
          <div className="premium-card hidden rounded-xl p-6 md:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-teal">
              Latest focus
            </p>
            <div className="mt-5 grid gap-3 text-sm leading-6 text-ink/68">
              <p>AI workforce capability</p>
              <p>Provider market movement</p>
              <p>Funding policy changes</p>
              <p>Employer capability trends</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-16 lg:pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          {insightCards.map((insight) => (
            <Link
              key={insight.title}
              href={insight.href}
              className="premium-card group flex min-h-72 flex-col rounded-xl p-6 transition duration-300 hover:-translate-y-1 hover:border-teal/20 hover:bg-white/[0.44] hover:shadow-[0_18px_38px_rgba(15,37,39,0.055)]"
            >
              <h2 className="text-xl font-semibold leading-snug text-ink">
                {cleanDisplayText(insight.title)}
              </h2>
              <p className="mt-4 text-sm leading-7 text-ink/66">{cleanDisplayText(insight.summary)}</p>
              <p className="mt-auto pt-7 text-[13px] font-semibold text-ink transition group-hover:text-teal">
                Read article
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-16 lg:pb-20">
        <div className="premium-card rounded-xl p-6 md:p-8 lg:p-9">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:gap-12">
            <div>
              <SectionEyebrow>MPR Intelligence Briefing</SectionEyebrow>
              <h2 className="display-heading mt-4 text-4xl leading-[1.08] text-ink text-balance md:text-5xl">
                Stay close to apprenticeship market signals.
              </h2>
              <p className="mt-4 max-w-xl text-[16px] leading-8 text-ink/66">
                A concise briefing for employers tracking policy movement,
                provider intelligence and workforce capability trends.
              </p>
            </div>

            <div className="lg:pl-2">
              <p className="text-sm font-semibold leading-6 text-ink">
                Weekly apprenticeship market intelligence covering:
              </p>
              <div className="mt-4 grid gap-x-6 gap-y-2.5 text-sm leading-6 text-ink/66 sm:grid-cols-2">
                {[
                  "apprenticeship policy & levy updates",
                  "AI, data & workforce capability",
                  "provider & delivery market intelligence",
                  "employer strategy & skills trends",
                  "procurement & supply chain capability",
                  "new MPR perspectives & analysis",
                ].map((item) => (
                  <div key={item} className="flex gap-3">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal/85" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <BriefingSubscribeForm />
            </div>
          </div>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-16 lg:pb-24">
        <div className="border-y border-ink/10 py-12 lg:py-16">
          <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-14">
            <div>
              <SectionEyebrow>Market signals</SectionEyebrow>
              <h2 className="display-heading mt-5 text-4xl leading-[1.08] text-ink text-balance md:text-5xl">
                Latest apprenticeship intelligence
              </h2>
              <p className="mt-5 max-w-xl text-[16px] leading-8 text-ink/66">
                Weekly signals from policy, providers and the wider skills
                market.
              </p>
            </div>

            <div className="grid gap-4">
              {newsArticles.map((article) => (
                <article
                  key={`${article.source}-${article.url}`}
                  className="premium-card grid gap-5 rounded-xl p-5 transition duration-300 hover:border-teal/20 hover:bg-white/[0.44] md:grid-cols-[1fr_auto] md:p-6"
                >
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-3 text-[12px] font-semibold text-ink/52">
                      <span className="rounded-full border border-teal/20 bg-teal/[0.08] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-teal">
                        {cleanDisplayText(article.category)}
                      </span>
                      <span>{cleanDisplayText(article.source)}</span>
                      <span aria-hidden="true">/</span>
                      <time dateTime={article.publishedAt}>
                        {dateFormatter.format(new Date(article.publishedAt))}
                      </time>
                    </div>
                    <h3 className="text-lg font-semibold leading-snug text-ink md:text-xl">
                      {cleanDisplayText(article.title)}
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/66">
                      {cleanDisplayText(article.summary)}
                    </p>
                  </div>

                  <div className="flex items-end md:justify-end">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="button-pill min-h-10 px-4 text-[13px]"
                    >
                      Read article
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <FinalCta
        title="Want a sharper view of your apprenticeship options?"
        copy="Bring us the questions, constraints and opportunities you are working through. We will help turn them into practical next steps."
      />
    </>
  );
}
