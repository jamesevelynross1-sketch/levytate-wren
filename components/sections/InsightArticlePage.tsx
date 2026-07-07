import Link from "next/link";
import { FinalCta } from "@/components/sections/FinalCta";
import { SectionEyebrow } from "@/components/ui/SectionEyebrow";
import { ENQUIRY_MAILTO } from "@/lib/contact";
import { cleanDisplayText } from "@/lib/html-text";
import type { InsightArticle } from "@/lib/insights";
import { getRelatedInsights } from "@/lib/insights";

type InsightArticlePageProps = {
  article: InsightArticle;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function InsightArticlePage({ article }: InsightArticlePageProps) {
  const related = getRelatedInsights(article.slug);

  return (
    <>
      <article>
        <section className="container-px mx-auto max-w-7xl pb-12 pt-14 lg:pb-16 lg:pt-20">
          <div className="max-w-4xl">
            <SectionEyebrow>Insight</SectionEyebrow>
            <h1 className="display-heading mt-5 text-5xl leading-[1.04] text-ink text-balance md:text-6xl">
              {cleanDisplayText(article.title)}
            </h1>
            <p className="mt-6 max-w-3xl text-xl leading-8 text-ink/68">
              {cleanDisplayText(article.subtitle)}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3 border-y border-ink/10 py-4 text-[13px] font-semibold text-ink/54">
              <time dateTime={article.publishDate}>
                {dateFormatter.format(new Date(article.publishDate))}
              </time>
              <span aria-hidden="true">/</span>
              <span>{article.readingTime}</span>
              <span aria-hidden="true">/</span>
              <span>Employer advisory</span>
            </div>
          </div>
        </section>

        <section className="container-px mx-auto max-w-7xl pb-10 lg:pb-14">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,720px)_minmax(260px,1fr)] lg:gap-16">
            <div className="min-w-0">
              <PullQuote>{cleanDisplayText(article.pullQuote)}</PullQuote>

              {article.sections.map((section, index) => (
                <section key={section.title} className="border-t border-ink/10 py-9 first:border-t-0 first:pt-0">
                  <h2 className="display-heading text-3xl leading-tight text-ink md:text-4xl">
                    {cleanDisplayText(section.title)}
                  </h2>
                  <div className="mt-5 space-y-5 text-[17px] leading-8 text-ink/72">
                    {section.body.map((paragraph) => (
                      <p key={paragraph}>{cleanDisplayText(paragraph)}</p>
                    ))}
                  </div>

                  {index === 1 && (
                    <InsightPanel title="Advisory note">
                      The most useful apprenticeship decisions are made before
                      procurement or enrolment. Employers need clarity on the
                      workforce problem, the pathway fit and the internal
                      conditions for success.
                    </InsightPanel>
                  )}
                </section>
              ))}

              {article.questions && (
                <InsightList title="Leadership questions" items={article.questions} />
              )}

              {article.checklist && (
                <InsightList title="Practical employer checklist" items={article.checklist} />
              )}

              <section className="border-t border-ink/10 py-9">
                <h2 className="display-heading text-3xl leading-tight text-ink md:text-4xl">
                  Final perspective
                </h2>
                <div className="mt-5 space-y-5 text-[17px] leading-8 text-ink/72">
                  {article.finalPerspective.map((paragraph) => (
                    <p key={paragraph}>{cleanDisplayText(paragraph)}</p>
                  ))}
                </div>
              </section>
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-xl border border-ink/10 bg-white/36 p-5 shadow-[0_10px_28px_rgba(15,37,39,0.035)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
                  In brief
                </p>
                <div className="mt-5 grid gap-4">
                  {article.stats.map((stat) => (
                    <div key={stat.label} className="border-t border-ink/10 pt-4 first:border-t-0 first:pt-0">
                      <p className="display-heading text-3xl leading-none text-ink">
                        {cleanDisplayText(stat.value)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-ink/64">
                        {cleanDisplayText(stat.label)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <MethodCard slug={article.slug} />
            </aside>
          </div>
        </section>
      </article>

      <section className="container-px mx-auto max-w-7xl pb-16 lg:pb-20">
        <div className="border-y border-ink/10 py-10">
          <SectionEyebrow>Related insights</SectionEyebrow>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {related.map((relatedArticle) => (
              <Link
                key={relatedArticle.slug}
                href={`/insights/${relatedArticle.slug}`}
                className="group rounded-xl border border-ink/10 bg-white/34 p-6 shadow-[0_10px_24px_rgba(15,37,39,0.03)] transition hover:-translate-y-1 hover:border-teal/25 hover:bg-white/48"
              >
                <h3 className="text-xl font-semibold leading-snug text-ink">
                  {cleanDisplayText(relatedArticle.title)}
                </h3>
                <p className="mt-3 text-sm leading-7 text-ink/66">
                  {cleanDisplayText(relatedArticle.summary)}
                </p>
                <p className="mt-5 text-[13px] font-semibold text-ink transition group-hover:text-teal">
                  Read article →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="container-px mx-auto max-w-7xl pb-6">
        <div className="rounded-xl border border-teal/18 bg-teal/[0.08] p-6 md:p-8">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <SectionEyebrow>Continue exploring</SectionEyebrow>
              <h2 className="display-heading mt-4 text-3xl leading-tight text-ink md:text-4xl">
                Turn insight into a clearer apprenticeship plan.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-ink/66">
                MPR Consulting helps employers connect funded development,
                provider choice and workforce capability into practical next
                steps.
              </p>
            </div>
            <Link
              href={ENQUIRY_MAILTO}
              className="button-pill button-pill--primary min-h-10 px-4 text-[13px]"
            >
              Book a Conversation
            </Link>
          </div>
        </div>
      </section>

      <FinalCta
        title="Want to discuss how this applies to your organisation?"
        copy="Bring us the priorities, providers and funding questions you are working through. We will help turn them into a practical route forward."
      />
    </>
  );
}

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="mb-9 rounded-xl border-l-4 border-teal bg-white/40 px-6 py-5 shadow-[0_10px_24px_rgba(15,37,39,0.03)]">
      <p className="display-heading text-2xl leading-snug text-ink md:text-3xl">
        “{children}”
      </p>
    </blockquote>
  );
}

function InsightPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-7 rounded-xl border border-teal/18 bg-teal/[0.08] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
        {cleanDisplayText(title)}
      </p>
      <p className="mt-3 text-sm leading-7 text-ink/70">{children}</p>
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="border-t border-ink/10 py-9">
      <h2 className="display-heading text-3xl leading-tight text-ink md:text-4xl">
        {title}
      </h2>
      <div className="mt-6 grid gap-3">
        {items.map((item) => (
          <div key={item} className="rounded-xl border border-ink/10 bg-white/34 p-4 text-sm leading-7 text-ink/70">
            {cleanDisplayText(item)}
          </div>
        ))}
      </div>
    </section>
  );
}

function MethodCard({ slug }: { slug: string }) {
  const content = getMethodCardContent(slug);

  return (
    <div className="mt-5 rounded-xl border border-teal/18 bg-teal/[0.08] p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal">
        {cleanDisplayText(content.title)}
      </p>
      <div className="mt-4 grid gap-2 text-sm leading-6 text-ink/70">
        {content.items.map((item) => (
          <p key={item}>{cleanDisplayText(item)}</p>
        ))}
      </div>
    </div>
  );
}

function getMethodCardContent(slug: string) {
  if (slug === "independent-provider-matching") {
    return {
      title: "MPR matching lens",
      items: [
        "Ofsted",
        "Employer feedback",
        "Learner experience",
        "Delivery suitability",
        "Added value",
        "Commercial fit",
      ],
    };
  }

  if (slug === "funded-training-workforce-transformation") {
    return {
      title: "Capability focus",
      items: [
        "AI adoption",
        "Digital capability",
        "Leadership capability",
        "Operational performance",
        "Data confidence",
      ],
    };
  }

  return {
    title: "Strategy lens",
    items: [
      "Workforce need",
      "Role mapping",
      "Pathway fit",
      "Provider quality",
      "Business outcomes",
    ],
  };
}
