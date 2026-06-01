import type { Metadata } from "next";
import { FinalCta } from "@/components/sections/FinalCta";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { getApprenticeshipNews } from "@/lib/apprenticeship-news";
import { insightCards } from "@/lib/content";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Perspectives from MPR Consulting on apprenticeship strategy, provider matching and funded workforce development.",
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
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <h1 className="display-heading text-5xl leading-[1.04] text-ink text-balance md:text-6xl">
            Clear thinking on apprenticeships and workforce capability.
          </h1>
          <p className="text-[17px] leading-8 text-ink/66">
            A developing space for practical perspectives on funded training,
            provider selection and the decisions employers face when building
            capability through apprenticeships.
          </p>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-16 lg:pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          {insightCards.map((insight) => (
            <article key={insight.title} className="flex min-h-72 flex-col rounded-xl border border-ink/10 bg-white/34 p-6 shadow-[0_10px_28px_rgba(15,37,39,0.035)]">
              <p className="mb-7 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
                Perspective
              </p>
              <h2 className="text-xl font-semibold leading-snug text-ink">
                {insight.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-ink/66">{insight.summary}</p>
              <p className="mt-auto pt-7 text-[13px] font-semibold text-ink">
                Read more soon
              </p>
            </article>
          ))}
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
                Daily signals from policy, providers and the wider skills
                market.
              </p>
            </div>

            <div className="grid gap-4">
              {newsArticles.map((article) => (
                <article
                  key={`${article.source}-${article.url}`}
                  className="grid gap-5 rounded-xl border border-ink/10 bg-white/36 p-5 shadow-[0_10px_24px_rgba(15,37,39,0.03)] transition hover:border-teal/25 hover:bg-white/48 md:grid-cols-[1fr_auto] md:p-6"
                >
                  <div>
                    <div className="mb-4 flex flex-wrap items-center gap-3 text-[12px] font-semibold text-ink/52">
                      <span className="rounded-full border border-teal/20 bg-teal/[0.08] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-teal">
                        {article.category}
                      </span>
                      <span>{article.source}</span>
                      <span aria-hidden="true">/</span>
                      <time dateTime={article.publishedAt}>
                        {dateFormatter.format(new Date(article.publishedAt))}
                      </time>
                    </div>
                    <h3 className="text-lg font-semibold leading-snug text-ink md:text-xl">
                      {article.title}
                    </h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-ink/66">
                      {article.summary}
                    </p>
                  </div>

                  <div className="flex items-end md:justify-end">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center justify-center rounded-full border border-ink/14 px-4 text-[13px] font-semibold text-ink transition hover:border-teal/45 hover:text-teal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal"
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
