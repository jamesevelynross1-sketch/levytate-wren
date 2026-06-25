import type { Metadata } from "next";
import Link from "next/link";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";

export const metadata: Metadata = {
  title: "The Apprenticeship Operating System",
  description: "LevyTate gives employers one workspace to manage employees, roles, applications, providers and apprenticeship decisions.",
};

const credibility = [
  "Built for apprenticeship leads, HR and L&D teams",
  "Designed around real employer workflows",
  "Provider matching led by LevyTate",
  "Beta access now open",
];

const problems = [
  {
    title: "Employee data sits in spreadsheets",
    copy: "Teams rely on scattered lists, static trackers and duplicated records to understand development demand.",
  },
  {
    title: "Applications move through emails",
    copy: "Requests lose context as they pass between employees, managers and apprenticeship leads.",
  },
  {
    title: "Provider decisions are hard to compare",
    copy: "Programme fit, delivery model, location and quality evidence are often discussed too late.",
  },
];

const pillars = [
  {
    title: "Employee Management",
    copy: "Keep employee, role, department, site and manager data in one place.",
  },
  {
    title: "Role & Pathway Mapping",
    copy: "Map job roles to suitable apprenticeship pathways and progression routes.",
  },
  {
    title: "Application Workflow",
    copy: "Manage employee applications from submission to manager review and final approval.",
  },
  {
    title: "Provider Matching",
    copy: "Request LevyTate-led provider matching based on programme, delivery model, location and employer need.",
  },
];

const workflow = ["Add employees", "Map roles", "Open applications", "Approve requests", "Match providers", "Track enrolments"];
const prompts = ["Which apprenticeship suits this role?", "What pathway supports progression into data?", "Can you help me prepare an application?", "Which providers could deliver this programme?"];
const providerAreas = ["Data & AI", "Digital & IT", "Procurement", "Marketing", "Business Support", "Customer Service", "Project Management", "Technical & Specialist"];
const employerJourneyBullets = [
  "Manage employees and apprenticeship applications",
  "Map job roles to suitable apprenticeship pathways",
  "Improve workforce planning",
  "Reduce administration",
  "Request independent provider matching",
  "Access AI-supported apprenticeship guidance",
];
const providerJourneyBullets = [
  "Employer introductions",
  "Qualified provider matching opportunities",
  "Premium partner visibility",
  "Participation in AI-supported recommendations",
  "Future marketplace opportunities",
  "Strategic partnership packages",
];

export default function LevyTateLandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6fbf8] text-[#102c3d]">
      <SiteHeader />
      <HeroSection />
      <CredibilityStrip />
      <ProblemSection />
      <ProductPillars />
      <WorkflowSection />
      <AiSection />
      <ProviderCatalogueSection />
      <BetaAccessSection />
      <AudienceJourneySection />
      <FinalCta />
    </main>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[#102c3d]/[0.07] bg-[#f6fbf8]/88 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[76px] max-w-7xl items-center justify-between gap-5 px-5 sm:px-8">
        <Link href="/" aria-label="LevyTate home" className="shrink-0">
          <LevyTateLogo className="[--levytate-logo-size:2.6rem]" />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-[#102c3d]/62 lg:flex">
          <a href="#product" className="transition hover:text-[#102c3d]">Product</a>
          <a href="#how-it-works" className="transition hover:text-[#102c3d]">How it works</a>
          <a href="#providers" className="transition hover:text-[#102c3d]">Providers</a>
          <a href="#beta" className="transition hover:text-[#102c3d]">Beta</a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/login" className="hidden rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.09] transition hover:-translate-y-0.5 hover:ring-[#159b8f]/25 sm:inline-flex">Beta Login</Link>
          <a href="#beta" className="rounded-full bg-[#102c3d] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(16,44,61,0.14)] transition hover:-translate-y-0.5 sm:px-5">Request Beta Access</a>
        </div>
      </div>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative isolate">
      <div className="absolute inset-x-0 top-0 -z-10 h-[680px] bg-[radial-gradient(circle_at_28%_12%,rgba(199,240,228,0.72),transparent_34rem),radial-gradient(circle_at_80%_8%,rgba(255,142,149,0.22),transparent_30rem)]" />
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:items-center lg:pb-24 lg:pt-20">
        <div>
          <p className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12] shadow-[0_14px_34px_rgba(16,44,61,0.06)]">LevyTate is the apprenticeship operating system for employers</p>
          <h1 className="mt-6 max-w-5xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-[#102c3d] sm:text-6xl lg:text-7xl">
            The apprenticeship operating system for workforce development and provider matching.
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#102c3d]/64">
            LevyTate gives employers one clear workspace to manage employees, roles, applications, providers and apprenticeship decisions without relying on spreadsheets, inboxes and disconnected provider conversations.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#beta" className="rounded-full bg-[#102c3d] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(16,44,61,0.18)] transition hover:-translate-y-0.5">Request Beta Access</a>
            <Link href="/login" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.09] transition hover:-translate-y-0.5 hover:ring-[#159b8f]/25">Beta Login</Link>
          </div>
        </div>
        <ProductPreview />
      </div>
    </section>
  );
}

function ProductPreview() {
  const rows = [
    ["Employees", "0 records", "Clean start"],
    ["Roles", "0 mapped", "Ready to build"],
    ["Applications", "0 active", "Workflow prepared"],
    ["Providers", "11 seeded", "Catalogue live"],
    ["Provider Matching", "Controlled", "LevyTate-led"],
  ];

  return (
    <aside className="rounded-[2rem] border border-[#102c3d]/[0.08] bg-white/86 p-4 shadow-[0_34px_90px_rgba(16,44,61,0.13)] backdrop-blur-xl">
      <div className="rounded-[1.5rem] bg-[#102c3d] p-4 text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c7f0e4]">Workspace</p>
            <p className="mt-1 text-lg font-semibold">Apprenticeship operations</p>
          </div>
          <span className="rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white/74">Beta</span>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {["Employee", "Manager", "Lead"].map((item, index) => (
            <div key={item} className={`rounded-2xl px-3 py-3 ${index === 0 ? "bg-white text-[#102c3d]" : "bg-white/8 text-white/66"}`}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">{item}</p>
              <p className="mt-2 text-xl font-semibold">{index === 0 ? "1" : "0"}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa]">
        {rows.map((row) => (
          <div key={row[0]} className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#102c3d]/[0.055] px-4 py-3 last:border-b-0">
            <div>
              <p className="text-sm font-semibold text-[#102c3d]">{row[0]}</p>
              <p className="mt-1 text-xs text-[#102c3d]/52">{row[2]}</p>
            </div>
            <span className="self-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12]">{row[1]}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function CredibilityStrip() {
  return (
    <section className="border-y border-[#102c3d]/[0.07] bg-white/62">
      <div className="mx-auto grid max-w-7xl gap-3 px-5 py-5 sm:px-8 md:grid-cols-2 lg:grid-cols-4">
        {credibility.map((item) => (
          <div key={item} className="flex items-center gap-3 text-sm font-semibold text-[#102c3d]/68">
            <span className="h-2.5 w-2.5 rounded-full bg-[#159b8f]" />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section id="product" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c95568]">The problem</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-[#102c3d] sm:text-5xl">Apprenticeship management is still too fragmented.</h2>
      </div>
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {problems.map((problem) => (
          <article key={problem.title} className="rounded-[1.5rem] border border-[#102c3d]/[0.07] bg-white p-6 shadow-[0_18px_48px_rgba(16,44,61,0.055)]">
            <h3 className="text-xl font-semibold tracking-[-0.02em]">{problem.title}</h3>
            <p className="mt-3 text-sm leading-6 text-[#102c3d]/60">{problem.copy}</p>
          </article>
        ))}
      </div>
      <div className="mt-6 rounded-[1.5rem] bg-[#102c3d] px-6 py-5 text-lg font-semibold text-white shadow-[0_20px_52px_rgba(16,44,61,0.16)]">
        LevyTate brings the process into one structured workspace.
      </div>
    </section>
  );
}

function ProductPillars() {
  return (
    <section className="bg-white/64 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c95568]">Product pillars</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Everything needed to run apprenticeship decisions.</h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-[#102c3d]/62 lg:justify-self-end">A focused MVP for the operational work employers need to control first: people data, role mapping, application workflow and provider matching.</p>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-2">
          {pillars.map((pillar, index) => (
            <article key={pillar.title} className="group rounded-[1.5rem] border border-[#102c3d]/[0.07] bg-white p-6 shadow-[0_18px_48px_rgba(16,44,61,0.055)] transition hover:-translate-y-1 hover:shadow-[0_26px_70px_rgba(16,44,61,0.09)]">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#edf7f3] text-sm font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12]">{index + 1}</span>
              <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{pillar.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#102c3d]/60">{pillar.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c95568]">How it works</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">A clearer route from workforce demand to enrolment.</h2>
      </div>
      <div className="mt-10 overflow-hidden rounded-[2rem] border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_24px_70px_rgba(16,44,61,0.075)]">
        <div className="grid gap-3 lg:grid-cols-6">
          {workflow.map((step, index) => (
            <div key={step} className="relative rounded-[1.25rem] bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.055]">
              <span className="text-xs font-semibold text-[#0b6f63]">0{index + 1}</span>
              <p className="mt-8 min-h-12 text-lg font-semibold leading-6 tracking-[-0.02em]">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AiSection() {
  return (
    <section className="bg-[#102c3d] py-16 text-white lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c7f0e4]">Ask LevyTate AI</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">AI-supported apprenticeship guidance, built around your workflow.</h2>
          <p className="mt-5 text-base leading-8 text-white/68">Ask LevyTate AI helps employees understand suitable pathways and helps apprenticeship leads explore role-to-standard options, specialist routes and provider matching opportunities.</p>
        </div>
        <div className="grid gap-3">
          {prompts.map((prompt) => (
            <div key={prompt} className="rounded-[1.25rem] border border-white/10 bg-white/[0.07] px-5 py-4 shadow-[0_18px_48px_rgba(0,0,0,0.12)]">
              <p className="text-sm font-semibold text-white">{prompt}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProviderCatalogueSection() {
  return (
    <section id="providers" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c95568]">Provider catalogue</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Provider intelligence built in.</h2>
          <p className="mt-5 text-base leading-8 text-[#102c3d]/62">LevyTate includes a structured provider catalogue to support better matching decisions across digital, data, procurement, marketing, business, customer service and specialist apprenticeship routes.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {providerAreas.map((area) => (
            <div key={area} className="rounded-[1.25rem] bg-white px-5 py-4 text-sm font-semibold text-[#102c3d] shadow-[0_16px_42px_rgba(16,44,61,0.055)] ring-1 ring-[#102c3d]/[0.07]">
              {area}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BetaAccessSection() {
  return (
    <section id="beta" className="bg-white/70 py-16 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c95568]">Beta access</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Join the LevyTate beta.</h2>
          <p className="mt-5 text-base leading-8 text-[#102c3d]/62">We are opening beta access to employers who want a clearer way to manage apprenticeship activity, provider relationships and workforce development decisions.</p>
        </div>
        <form action="/login" className="rounded-[2rem] border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_26px_80px_rgba(16,44,61,0.085)]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" name="name" placeholder="Your name" />
            <Input label="Work email" name="email" placeholder="you@organisation.co.uk" />
            <Input label="Organisation" name="organisation" placeholder="Organisation name" />
            <Input label="Message" name="message" placeholder="What would you like to manage?" />
          </div>
          <button className="mt-5 w-full rounded-full bg-[#102c3d] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(16,44,61,0.16)] transition hover:-translate-y-0.5">Request Beta Access</button>
          <p className="mt-3 text-center text-xs leading-5 text-[#102c3d]/48">The beta is invite-only. Login details are issued separately.</p>
        </form>
      </div>
    </section>
  );
}

function AudienceJourneySection() {
  return (
    <section className="px-5 py-16 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c95568]">Choose your LevyTate journey</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Who are you?</h2>
          <p className="mt-5 text-base leading-8 text-[#102c3d]/62">
            LevyTate supports both employers looking to improve apprenticeship management and training providers looking to become trusted delivery partners.
          </p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <JourneyCard
            variant="employer"
            label="For employers"
            title="Looking to transform how your organisation manages apprenticeships?"
            intro="Discover how LevyTate can help you:"
            bullets={employerJourneyBullets}
            primaryCta="Request Employer Beta Access"
            secondaryCta="Book a discovery conversation"
            primaryHref="#beta"
            secondaryHref="#beta"
          />
          <JourneyCard
            variant="provider"
            label="For training providers"
            title="Interested in becoming a LevyTate Partner?"
            intro="LevyTate is building a carefully selected network of trusted apprenticeship providers."
            supportingIntro="Partner organisations can benefit from:"
            bullets={providerJourneyBullets}
            primaryCta="Discuss Partner Packages"
            secondaryCta="Become a LevyTate Partner"
            primaryHref="#providers"
            secondaryHref="#providers"
          />
        </div>
      </div>
    </section>
  );
}

type JourneyCardProps = {
  variant: "employer" | "provider";
  label: string;
  title: string;
  intro: string;
  supportingIntro?: string;
  bullets: string[];
  primaryCta: string;
  secondaryCta: string;
  primaryHref: string;
  secondaryHref: string;
};

function JourneyCard({ variant, label, title, intro, supportingIntro, bullets, primaryCta, secondaryCta, primaryHref, secondaryHref }: JourneyCardProps) {
  const isProvider = variant === "provider";

  return (
    <article className={`relative overflow-hidden rounded-[2rem] p-6 shadow-[0_28px_90px_rgba(16,44,61,0.1)] ring-1 sm:p-8 ${isProvider ? "bg-[#102c3d] text-white ring-white/10" : "bg-white text-[#102c3d] ring-[#102c3d]/[0.07]"}`}>
      <div className="relative z-10 grid min-h-full gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
        <JourneyIllustration variant={variant} />
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isProvider ? "text-[#ffde59]" : "text-[#c95568]"}`}>{label}</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{title}</h3>
          <p className={`mt-4 text-sm leading-7 ${isProvider ? "text-white/72" : "text-[#102c3d]/62"}`}>{intro}</p>
          {supportingIntro ? <p className={`mt-2 text-sm leading-7 ${isProvider ? "text-white/72" : "text-[#102c3d]/62"}`}>{supportingIntro}</p> : null}
          <ul className="mt-5 grid gap-2 text-sm leading-6">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3">
                <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${isProvider ? "bg-[#ffde59]" : "bg-[#18a89a]"}`} />
                <span className={isProvider ? "text-white/82" : "text-[#102c3d]/72"}>{bullet}</span>
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href={primaryHref} className={`rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${isProvider ? "bg-white text-[#102c3d] shadow-[0_16px_34px_rgba(0,0,0,0.22)]" : "bg-[#102c3d] text-white shadow-[0_16px_34px_rgba(16,44,61,0.16)]"}`}>{primaryCta}</a>
            <a href={secondaryHref} className={`rounded-full px-5 py-3 text-sm font-semibold ring-1 transition hover:-translate-y-0.5 ${isProvider ? "text-white ring-white/18 hover:bg-white/8" : "text-[#102c3d] ring-[#102c3d]/10 hover:bg-[#102c3d]/[0.03]"}`}>{secondaryCta}</a>
          </div>
        </div>
      </div>
    </article>
  );
}

function JourneyIllustration({ variant }: { variant: "employer" | "provider" }) {
  if (variant === "provider") {
    return (
      <div className="relative min-h-[220px] rounded-[1.5rem] bg-white/[0.06] p-6 ring-1 ring-white/10">
        <div className="absolute left-8 top-8 h-14 w-14 rounded-2xl bg-[#ffde59] shadow-[0_18px_44px_rgba(255,222,89,0.22)]" />
        <div className="absolute right-10 top-12 h-10 w-10 rounded-full bg-white/16 ring-1 ring-white/20" />
        <div className="absolute bottom-10 left-10 h-10 w-10 rounded-full bg-[#18a89a]" />
        <div className="absolute bottom-9 right-8 h-16 w-16 rounded-3xl bg-white/12 ring-1 ring-white/16" />
        <div className="absolute left-[4.8rem] top-[4.8rem] h-px w-32 rotate-[18deg] bg-white/24" />
        <div className="absolute bottom-[4.2rem] left-[4.8rem] h-px w-40 -rotate-[9deg] bg-white/24" />
        <div className="absolute bottom-[5.5rem] right-[4.8rem] h-px w-28 rotate-[34deg] bg-white/24" />
        <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-[#ffde59]/12 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#ffde59]">
          Partner network
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[220px] rounded-[1.5rem] bg-[#eef8f4] p-6 ring-1 ring-[#102c3d]/[0.06]">
      <div className="absolute bottom-6 left-6 right-6 grid grid-cols-4 items-end gap-3">
        {[70, 104, 86, 124].map((height, index) => (
          <div key={height} className="rounded-t-2xl bg-white shadow-[0_14px_38px_rgba(16,44,61,0.08)] ring-1 ring-[#102c3d]/[0.06]" style={{ height }}>
            <div className={`mx-auto mt-3 h-2 w-8 rounded-full ${index % 2 === 0 ? "bg-[#18a89a]" : "bg-[#ff8090]"}`} />
          </div>
        ))}
      </div>
      <div className="absolute left-8 top-8 rounded-2xl bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#102c3d] shadow-[0_14px_38px_rgba(16,44,61,0.08)] ring-1 ring-[#102c3d]/[0.06]">
        Workforce plan
      </div>
      <div className="absolute right-8 top-10 flex -space-x-2">
        {["bg-[#18a89a]", "bg-[#ff8090]", "bg-[#102c3d]"].map((colour) => (
          <span key={colour} className={`h-10 w-10 rounded-full border-4 border-[#eef8f4] ${colour}`} />
        ))}
      </div>
    </div>
  );
}

function FinalCta() {
  return (
    <section className="px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto max-w-7xl rounded-[2rem] bg-[#102c3d] px-6 py-10 text-center text-white shadow-[0_30px_90px_rgba(16,44,61,0.18)] sm:px-10 lg:py-14">
        <h2 className="mx-auto max-w-4xl text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Replace scattered apprenticeship admin with one clear operating system.</h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="#beta" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#102c3d] transition hover:-translate-y-0.5">Request Beta Access</a>
          <Link href="/login" className="rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:bg-white/14">Beta Login</Link>
        </div>
      </div>
    </section>
  );
}

function Input({ label, name, placeholder }: { label: string; name: string; placeholder: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">
      {label}
      <input name={name} placeholder={placeholder} className="h-12 rounded-2xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] px-4 text-sm font-medium normal-case tracking-normal text-[#102c3d] outline-none transition placeholder:text-[#102c3d]/32 focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" />
    </label>
  );
}

