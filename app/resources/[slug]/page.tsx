import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicInfoPage } from "@/components/levytate-public/PublicInfoPage";

const resources = {
  "product-roadmap": {
    title: "Product Roadmap",
    description: "A clear view of the LevyTate capabilities being developed for employers, employees and provider partners.",
    items: [
      { title: "Core apprenticeship operations", copy: "Employee records, role mapping, applications, approvals and provider matching form the current MVP foundation." },
      { title: "Ask LevyTate AI", copy: "Role-specific guidance is being developed with deterministic permissions, actions and safety rules." },
      { title: "Executive reporting", copy: "Workforce readiness, participation, provider performance and levy insight are planned as decision-ready reports." },
      { title: "Future workforce planning", copy: "Skills demand, predictive readiness and future talent capabilities remain part of the longer-term product direction." },
    ],
  },
  faqs: {
    title: "Frequently Asked Questions",
    description: "Straight answers about LevyTate, the beta, provider matching and how the platform fits alongside existing systems.",
    items: [
      { title: "Is LevyTate a training provider?", copy: "No. LevyTate is an independent apprenticeship and workforce development platform." },
      { title: "Is LevyTate an open marketplace?", copy: "No. Provider matching is controlled, employer-led and based on suitability rather than advertising position." },
      { title: "Does LevyTate replace an LMS?", copy: "LevyTate focuses on workforce demand, pathway decisions, applications, provider matching and management visibility before and around delivery." },
      { title: "Who is the beta for?", copy: "The beta is designed for employers and selected provider partners helping shape the operating model." },
    ],
  },
  "apprenticeship-insights": {
    title: "Apprenticeship Insights",
    description: "Practical guidance for organisations connecting apprenticeships with workforce planning and capability development.",
    items: [
      { title: "Role-led pathway decisions", copy: "Start with the employee role, future aspiration, technical discipline and business objective rather than a generic programme list." },
      { title: "Manager engagement", copy: "Give managers concise information about commitment, suitability and business value before requesting a decision." },
      { title: "Provider fit", copy: "Assess programme capability, delivery model, geography, learner need and employer context together." },
      { title: "Workforce visibility", copy: "Use participation, skills demand and application data to move apprenticeships into annual planning conversations." },
    ],
  },
  "provider-partner-guide": {
    title: "Provider Partner Guide",
    description: "How LevyTate is approaching a curated provider network built around quality, fit and employer outcomes.",
    items: [
      { title: "Curated participation", copy: "LevyTate is building a selected network and does not present every provider as an existing partner." },
      { title: "Independent matching", copy: "Commercial participation cannot be used to influence the order or outcome of provider recommendations." },
      { title: "Capability evidence", copy: "Programme expertise, delivery coverage, quality status and employer fit support matching decisions." },
      { title: "Qualified opportunities", copy: "Employer needs are structured before an introduction so providers can assess genuine delivery fit." },
    ],
  },
  "beta-access-guide": {
    title: "Beta Access Guide",
    description: "What to expect when discussing early access to the LevyTate employer workspace.",
    items: [
      { title: "Discovery", copy: "The LevyTate team starts with your apprenticeship operating model, workforce priorities and current pain points." },
      { title: "Workspace scope", copy: "Agree the roles, teams, pathways and workflows most useful for the initial beta environment." },
      { title: "Data preparation", copy: "Define the minimum employee, role, site and application data required for a controlled starting point." },
      { title: "Review and feedback", copy: "Use structured feedback to assess value, refine workflows and inform the wider product roadmap." },
    ],
  },
} as const;

type ResourceSlug = keyof typeof resources;

export function generateStaticParams() {
  return Object.keys(resources).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const resource = resources[slug as ResourceSlug];
  return resource ? { title: resource.title, description: resource.description } : {};
}

export default async function ResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resource = resources[slug as ResourceSlug];
  if (!resource) notFound();

  return <PublicInfoPage eyebrow="LevyTate resources" title={resource.title} description={resource.description} items={[...resource.items]} />;
}