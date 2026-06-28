import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicInfoPage } from "@/components/levytate-public/PublicInfoPage";

const pages = {
  about: {
    title: "About LevyTate",
    description: "LevyTate exists to make apprenticeship and workforce development decisions clearer for employers, employees and trusted delivery partners.",
    ctaLabel: "Request Beta Access",
    ctaHref: "/#beta",
    items: [
      { title: "One operating layer", copy: "Bring workforce records, role-led pathways, applications, provider matching and reporting into one consistent product." },
      { title: "Independent by design", copy: "LevyTate is not a training provider or an open marketplace. Recommendations are based on employer and learner fit." },
      { title: "Built around decisions", copy: "Every workflow is designed to help a specific stakeholder understand what matters and what they should do next." },
      { title: "Commercially practical", copy: "The platform supports employer subscriptions, provider partnerships, provider matching and strategic advisory opportunities." },
    ],
  },
  contact: {
    title: "Contact LevyTate",
    description: "Speak with the LevyTate team about employer beta access, provider partnerships or the future product roadmap.",
    ctaLabel: "Email LevyTate",
    ctaHref: "mailto:hello@levytate.co.uk?subject=LevyTate enquiry",
    items: [
      { title: "Employer beta", copy: "Discuss your current apprenticeship operating model, workforce priorities and requirements for a beta workspace." },
      { title: "Provider partnerships", copy: "Explore curated network expectations, capability verification and strategic partner packages." },
      { title: "Product feedback", copy: "Share a workflow, reporting or workforce-planning challenge that should inform the LevyTate roadmap." },
      { title: "Strategic advisory", copy: "Discuss provider matching, workforce planning and apprenticeship strategy support." },
    ],
  },
  partner: {
    title: "Partner with LevyTate",
    description: "LevyTate is building a curated national provider network focused on delivery quality, employer outcomes and long-term collaboration.",
    ctaLabel: "Discuss Partner Packages",
    ctaHref: "mailto:hello@levytate.co.uk?subject=LevyTate provider partner packages",
    items: [
      { title: "Qualified introductions", copy: "Engage with employer opportunities that have structured requirements and a defined workforce need." },
      { title: "Specialist capability", copy: "Present relevant occupational expertise, delivery coverage and programme capability." },
      { title: "Independent recommendations", copy: "Partnership packages do not allow providers to pay to influence matching recommendations." },
      { title: "Strategic collaboration", copy: "Explore long-term relationships around employers, product development and future platform capabilities." },
    ],
  },
} as const;

type CompanySlug = keyof typeof pages;

export function generateStaticParams() {
  return Object.keys(pages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = pages[slug as CompanySlug];
  return page ? { title: page.title, description: page.description } : {};
}

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug as CompanySlug];
  if (!page) notFound();

  return <PublicInfoPage eyebrow="Company" title={page.title} description={page.description} items={[...page.items]} ctaLabel={page.ctaLabel} ctaHref={page.ctaHref} />;
}