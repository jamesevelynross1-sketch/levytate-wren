import type { Metadata } from "next";
import Link from "next/link";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";

export const metadata: Metadata = {
  title: "LevyTate | Apprenticeship Operating System for Employers",
  description: "LevyTate is the apprenticeship operating system for modern employers, bringing employee management, applications, provider matching and AI-supported guidance into one workspace.",
};

const credibility = ["HR", "L&D", "Apprenticeship Leads", "Operations", "Senior Leadership Teams"];


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

const workflow = ["Import Employees", "Assign Roles", "AI identifies suitable pathways", "Employee applies", "Manager approves", "LevyTate matches provider", "Enrolment complete"];
const providerAreas = [
  ["Digital & AI Apprenticeships", "Data, AI, Cyber Security & Software"],
  ["People & Operational Development", "Supervision, Coaching & Operational Improvement"],
  ["Engineering & Manufacturing", "Engineering, Production & Maintenance"],
  ["Construction & Built Environment", "Construction, Surveying & Property"],
  ["Data & Analytics", "Business Intelligence & Data Science"],
  ["Procurement & Supply Chain", "Commercial, Logistics & Procurement"],
  ["Marketing & Creative", "Digital Marketing, Content & Creative"],
  ["Business & Professional Services", "HR, Finance, Customer Service & Administration"],
  ["Health & Social Care", "Adult Care, Healthcare & Wellbeing"],
  ["Education & Learning", "Teaching, Coaching & Learning & Development"],
  ["Growing Provider Network", "Additional specialist partners joining soon."],
];
const galleryItems = [
  ["Dashboard", "Workforce readiness, approvals and provider coverage in one executive view.", "82%", "Readiness"],
  ["Employees", "Search, filter and maintain clean employee records ready for pathway mapping.", "824", "Employees"],
  ["Applications", "A controlled route from employee interest to final approval and enrolment readiness.", "14", "Active"],
  ["AI Assistant", "Role-aware guidance that explains suitable pathways and next actions in plain English.", "AI", "Guided"],
  ["Provider Matching", "Structured requests with programme, delivery model, geography and rationale captured upfront.", "6", "Matches"],
  ["Reporting", "Board-ready participation, levy, skills and provider insight for workforce planning.", "+18%", "Growth"],
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
      <ProductGallery />
      <AiSection />
      <ProviderCatalogueSection />
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
      <div className="absolute inset-x-0 top-0 -z-10 h-[760px] bg-[radial-gradient(circle_at_18%_12%,rgba(199,240,228,0.9),transparent_34rem),radial-gradient(circle_at_84%_5%,rgba(255,128,144,0.24),transparent_30rem),linear-gradient(180deg,#f6fbf8_0%,#eef7f3_100%)]" />
      <div className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(480px,1.05fr)] lg:items-center lg:pb-28 lg:pt-20">
        <div>
          <p className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12] shadow-[0_14px_34px_rgba(16,44,61,0.06)]">Built for employer apprenticeship teams</p>
          <h1 className="mt-6 max-w-5xl text-5xl font-semibold leading-[0.96] tracking-[-0.06em] text-[#102c3d] sm:text-6xl lg:text-7xl">
            The apprenticeship operating system for modern employers.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#102c3d]/66">
            Replace spreadsheets, disconnected provider conversations and manual apprenticeship administration with one intelligent workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#beta" className="rounded-full bg-[#102c3d] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(16,44,61,0.18)] transition hover:-translate-y-0.5">Request Beta Access</a>
            <Link href="/login" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.09] transition hover:-translate-y-0.5 hover:ring-[#159b8f]/25">Beta Login</Link>
          </div>
          <div className="mt-8 grid max-w-xl gap-3 sm:grid-cols-3">
            {[["1", "controlled workspace"], ["5", "stakeholder views"], ["0", "marketplace noise"]].map(([value, label]) => (
              <div key={label} className="rounded-2xl bg-white/76 px-4 py-3 ring-1 ring-[#102c3d]/[0.06] shadow-[0_12px_34px_rgba(16,44,61,0.05)]">
                <p className="text-2xl font-semibold tracking-[-0.04em]">{value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/44">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <ProductPreview />
      </div>
    </section>
  );
}
function ProductPreview() {
  return (
    <aside className="relative rounded-[2.25rem] border border-[#102c3d]/[0.08] bg-white/90 p-4 shadow-[0_38px_110px_rgba(16,44,61,0.16)] backdrop-blur-xl">
      <div className="overflow-hidden rounded-[1.75rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa]">
        <div className="flex items-center justify-between border-b border-[#102c3d]/[0.06] bg-white px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Live workspace</p>
            <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Apprenticeship command centre</p>
          </div>
          <span className="rounded-full bg-[#eaf7f2] px-3 py-1.5 text-xs font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.14]">Beta</span>
        </div>
        <div className="grid gap-3 p-4 lg:grid-cols-[1fr_0.86fr]">
          <div className="rounded-[1.4rem] bg-[#102c3d] p-4 text-white shadow-[0_20px_60px_rgba(16,44,61,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c7f0e4]">Employee dashboard</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">Workforce readiness</h2>
              </div>
              <span className="text-4xl font-semibold tracking-[-0.06em]">82%</span>
            </div>
            <div className="mt-5 h-2 rounded-full bg-white/12"><div className="h-2 w-[82%] rounded-full bg-[#c7f0e4]" /></div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {[["48", "active learners"], ["14", "applications"], ["6", "providers"]].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-white/[0.08] px-3 py-3 ring-1 ring-white/10">
                  <p className="text-xl font-semibold">{value}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/48">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3">
            <PreviewCard eyebrow="Approval queue" title="Applications awaiting approval" value="4" tone="coral" />
            <PreviewCard eyebrow="Provider match" title="Data Analyst pathway ready for review" value="New" tone="mint" />
          </div>
        </div>
        <div className="grid gap-3 border-t border-[#102c3d]/[0.06] p-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.4rem] bg-white p-4 shadow-[0_16px_44px_rgba(16,44,61,0.06)] ring-1 ring-[#102c3d]/[0.06]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">AI recommendation</p>
            <div className="mt-3 space-y-2 text-sm leading-6 text-[#102c3d]/70"><p className="font-semibold text-[#102c3d]">Maintenance Manager</p><p><span className="font-semibold text-[#102c3d]">Primary recommendation:</span> Level 4 Improvement Practitioner</p><p><span className="font-semibold text-[#102c3d]">Alternative pathways:</span> Engineering Manufacturing Technician, Engineering Maintenance Technician and Lean Manufacturing Operative.</p><p>Improvement Practitioner develops continuous improvement, operational performance, process optimisation and cross-functional supervision.</p></div>
          </div>
          <div className="rounded-[1.4rem] bg-white p-4 shadow-[0_16px_44px_rgba(16,44,61,0.06)] ring-1 ring-[#102c3d]/[0.06]">
            <div className="flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0b6f63]">Reporting widget</p><span className="text-xs font-semibold text-[#102c3d]/44">Q2</span></div>
            <div className="mt-5 flex h-24 items-end gap-2">
              {[36, 48, 42, 64, 72, 82].map((height, index) => (
                <div key={height} className="flex-1 rounded-t-xl bg-[#dfeee8]"><div className={`rounded-t-xl ${index > 3 ? "bg-[#18a89a]" : "bg-[#8bd7c5]"}`} style={{ height }} /></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function PreviewCard({ eyebrow, title, value, tone }: { eyebrow: string; title: string; value: string; tone: "coral" | "mint" }) {
  return (
    <div className="rounded-[1.4rem] bg-white p-4 shadow-[0_16px_44px_rgba(16,44,61,0.06)] ring-1 ring-[#102c3d]/[0.06]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${tone === "coral" ? "text-[#c95568]" : "text-[#0b6f63]"}`}>{eyebrow}</p>
          <p className="mt-2 text-sm font-semibold leading-5">{title}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${tone === "coral" ? "bg-[#fff0f2] text-[#c95568]" : "bg-[#eaf7f2] text-[#0b6f63]"}`}>{value}</span>
      </div>
    </div>
  );
}
function CredibilityStrip() {
  return (
    <section className="border-y border-[#102c3d]/[0.07] bg-white/72">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#102c3d]/42">Built for</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {credibility.map((item, index) => (
            <div key={item} className="flex items-center gap-3 rounded-full bg-[#f8fbfa] px-4 py-2.5 text-sm font-semibold text-[#102c3d]/70 ring-1 ring-[#102c3d]/[0.06]">
              <span className={`grid h-7 w-7 place-items-center rounded-full text-xs ${index % 2 === 0 ? "bg-[#eaf7f2] text-[#0b6f63]" : "bg-[#fff0f2] text-[#c95568]"}`}>{item.charAt(0)}</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
function ProblemSection() {
  const current = ["Spreadsheets", "Email approvals", "Provider emails", "Inconsistent reporting"];
  const better = ["One workspace", "Structured workflow", "Provider matching", "Executive reporting"];

  return (
    <section id="product" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c95568]">The problem</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Managing apprenticeships should not require five different systems.</h2>
        </div>
        <p className="text-base leading-8 text-[#102c3d]/62">LevyTate replaces scattered admin with one operating layer for the decisions employers need to make before training delivery starts.</p>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-[1fr_1fr_0.9fr]">
        <ComparisonCard title="Current approach" items={current} mood="negative" />
        <ComparisonCard title="LevyTate" items={better} mood="positive" />
        <div className="rounded-[2rem] bg-[#102c3d] p-6 text-white shadow-[0_26px_80px_rgba(16,44,61,0.18)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c7f0e4]">Outcome</p>
          <p className="mt-5 text-3xl font-semibold tracking-[-0.04em]">One clear route from workforce demand to approved delivery.</p>
          <div className="mt-8 grid gap-3">
            {[["Admin", "reduced"], ["Approvals", "visible"], ["Provider fit", "structured"]].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-2xl bg-white/[0.08] px-4 py-3 ring-1 ring-white/10">
                <span className="text-sm text-white/64">{label}</span>
                <span className="text-sm font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ComparisonCard({ title, items, mood }: { title: string; items: string[]; mood: "negative" | "positive" }) {
  return (
    <article className="rounded-[2rem] border border-[#102c3d]/[0.07] bg-white p-6 shadow-[0_22px_64px_rgba(16,44,61,0.07)]">
      <h3 className="text-2xl font-semibold tracking-[-0.035em]">{title}</h3>
      <div className="mt-6 grid gap-3">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-2xl bg-[#f8fbfa] px-4 py-3 ring-1 ring-[#102c3d]/[0.055]">
            <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${mood === "positive" ? "bg-[#eaf7f2] text-[#0b6f63]" : "bg-[#fff0f2] text-[#c95568]"}`}>{mood === "positive" ? "+" : "x"}</span>
            <span className="text-sm font-semibold text-[#102c3d]/72">{item}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
function ProductPillars() {
  return (
    <section className="bg-white/66 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c95568]">Product pillars</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">The operating layer employers need before delivery begins.</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((pillar, index) => (
            <article key={pillar.title} className="group flex min-h-[300px] flex-col rounded-[2rem] border border-[#102c3d]/[0.07] bg-white p-6 shadow-[0_22px_64px_rgba(16,44,61,0.065)] transition hover:-translate-y-1 hover:shadow-[0_30px_86px_rgba(16,44,61,0.1)]">
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#eaf7f2] text-sm font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12]">0{index + 1}</span>
                <span className="rounded-full bg-[#fff5d7] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b6500]">Decision ready</span>
              </div>
              <h3 className="mt-8 text-2xl font-semibold tracking-[-0.035em]">{pillar.title}</h3>
              <p className="mt-4 text-sm leading-7 text-[#102c3d]/62">{pillar.copy}</p>
              <div className="mt-auto pt-7"><div className="h-2 rounded-full bg-[#edf4f1]"><div className="h-2 rounded-full bg-[#18a89a]" style={{ width: `${62 + index * 9}%` }} /></div></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function WorkflowSection() {
  return (
    <section id="workflow" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-24">
      <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c95568]">How it works</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">A visual route from role data to enrolment.</h2>
          <p className="mt-5 text-base leading-8 text-[#102c3d]/62">The workflow stays structured, but each stakeholder only sees the step they can influence.</p>
        </div>
        <div className="rounded-[2rem] border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_26px_80px_rgba(16,44,61,0.08)]">
          <div className="grid gap-3 md:grid-cols-7">
            {workflow.map((step, index) => (
              <div key={step} className="relative rounded-[1.35rem] bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.055]">
                <span className={`grid h-9 w-9 place-items-center rounded-2xl text-xs font-semibold ${index === 2 ? "bg-[#102c3d] text-white" : "bg-white text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12]"}`}>{index + 1}</span>
                <p className="mt-5 text-sm font-semibold leading-5 tracking-[-0.01em]">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductGallery() {
  return (
    <section className="bg-[#102c3d] py-16 text-white lg:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c7f0e4]">Product gallery</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">A real operating system, not another static tracker.</h2>
          </div>
          <p className="max-w-2xl text-base leading-8 text-white/64 lg:justify-self-end">LevyTate brings daily apprenticeship operations and executive readiness insight into the same product language.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {galleryItems.map(([title, copy, metric, label], index) => (
            <article key={title} className="rounded-[2rem] bg-white/[0.07] p-4 shadow-[0_24px_76px_rgba(0,0,0,0.18)] ring-1 ring-white/10">
              <div className="rounded-[1.45rem] bg-white p-4 text-[#102c3d]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">{title}</p>
                    <p className="mt-3 text-sm leading-6 text-[#102c3d]/62">{copy}</p>
                  </div>
                  <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-[#f3faf6] text-center ring-1 ring-[#159b8f]/[0.12]">
                    <span className="block text-xl font-semibold tracking-[-0.04em] text-[#0b6f63]">{metric}</span>
                    <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">{label}</span>
                  </div>
                </div>
                <div className="mt-5 flex h-20 items-end gap-2">
                  {[34, 52, 46, 68, 58, 82].map((height, barIndex) => (
                    <div key={`${title}-${height}-${barIndex}`} className="flex-1 rounded-t-xl bg-[#e8f3ee]"><div className={`rounded-t-xl ${barIndex + index > 4 ? "bg-[#ff8090]" : "bg-[#18a89a]"}`} style={{ height: Math.max(22, height - index * 3) }} /></div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AiSection() {
  return (
    <section id="ai" className="relative px-5 py-16 sm:px-8 lg:py-24">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c95568]">Ask LevyTate AI</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Guidance that understands roles, rules and provider matching.</h2>
          <p className="mt-5 text-base leading-8 text-[#102c3d]/62">Ask LevyTate AI helps teams move from uncertainty to a structured next step. Recommendations stay grounded in approved pathways, permissions and the one-active-application rule.</p>
          <a href="#providers" className="mt-8 inline-flex rounded-full bg-[#102c3d] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(16,44,61,0.16)] transition hover:-translate-y-0.5">Request Provider Matching</a>
        </div>
        <div className="rounded-[2rem] border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_30px_90px_rgba(16,44,61,0.1)]">
          <div className="rounded-[1.5rem] bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.055]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#102c3d] text-sm font-semibold text-white">AI</span>
              <div><p className="text-sm font-semibold">Ask LevyTate AI</p><p className="text-xs text-[#102c3d]/48">Role-aware apprenticeship guidance</p></div>
            </div>
            <ChatBubble speaker="User" message="We have created a Maintenance Manager role. Which apprenticeship would you recommend?" />
            <ChatBubble speaker="LevyTate" highlighted message="I would recommend Level 4 Improvement Practitioner as the primary route. It fits continuous improvement, operational performance, process optimisation and cross-functional supervision for a Maintenance Manager. Alternative pathways include Engineering Manufacturing Technician, Engineering Maintenance Technician and Lean Manufacturing Operative. Funding may be potentially levy-funded depending on eligibility. Would you like LevyTate to match suitable providers?" />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {["Recommended", "Alternatives", "Provider match"].map((item) => (
                <div key={item} className="rounded-2xl bg-white px-4 py-3 text-xs font-semibold text-[#102c3d]/70 ring-1 ring-[#102c3d]/[0.06]">{item}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({ speaker, message, highlighted = false }: { speaker: string; message: string; highlighted?: boolean }) {
  return (
    <div className={`mt-4 rounded-[1.25rem] p-4 ${highlighted ? "bg-[#102c3d] text-white" : "bg-white text-[#102c3d] ring-1 ring-[#102c3d]/[0.06]"}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${highlighted ? "text-[#c7f0e4]" : "text-[#c95568]"}`}>{speaker}</p>
      <p className={`mt-2 text-sm leading-7 ${highlighted ? "text-white/76" : "text-[#102c3d]/68"}`}>{message}</p>
    </div>
  );
}
function ProviderCatalogueSection() {
  const partnerBenefits = [
    "Qualified employer introductions",
    "AI-supported provider matching",
    "Featured sector expertise",
    "Strategic employer partnerships",
    "Early access to new platform capabilities",
  ];

  return (
    <section id="providers" className="bg-white/66 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c95568]">Provider network</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Built around specialist apprenticeship expertise.</h2>
          </div>
          <div className="space-y-4 text-base leading-8 text-[#102c3d]/62 lg:justify-self-end">
            <p>LevyTate maintains an independently curated network of apprenticeship providers covering specialist sectors, standards and delivery models across England.</p>
            <p>Provider recommendations are based on employer requirements, occupational fit, sector expertise, learner needs and delivery capability. LevyTate is not an open marketplace and providers cannot pay to influence recommendations.</p>
          </div>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {providerAreas.map(([title, descriptor], index) => (
            <div key={title} className={`rounded-[1.4rem] bg-white px-5 py-5 shadow-[0_18px_54px_rgba(16,44,61,0.06)] ring-1 ring-[#102c3d]/[0.07] ${title === "Growing Provider Network" ? "lg:col-span-2" : ""}`}>
              <span className={`mb-4 block h-2 w-12 rounded-full ${index % 3 === 0 ? "bg-[#18a89a]" : index % 3 === 1 ? "bg-[#ff8090]" : "bg-[#ffde59]"}`} />
              <h3 className="text-sm font-semibold tracking-[-0.01em] text-[#102c3d]">{title}</h3>
              <p className="mt-2 text-xs leading-5 text-[#102c3d]/56">{descriptor}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 grid gap-6 rounded-[2rem] bg-[#102c3d] p-6 text-white shadow-[0_28px_90px_rgba(16,44,61,0.16)] sm:p-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffde59]">Partner opportunity</p>
            <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Become a LevyTate Partner</h3>
            <p className="mt-5 text-sm leading-7 text-white/72">We are building a carefully selected national network of high-quality apprenticeship providers with recognised expertise across specialist sectors.</p>
            <p className="mt-3 text-sm leading-7 text-white/72">Partnerships focus on employer outcomes, delivery quality and long-term collaboration rather than marketplace advertising.</p>
          </div>
          <div className="rounded-[1.5rem] bg-white/[0.07] p-5 ring-1 ring-white/10">
            <p className="text-sm font-semibold text-white">Partner organisations may benefit from:</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {partnerBenefits.map((benefit) => (
                <li key={benefit} className="flex gap-3 text-sm leading-6 text-white/78">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffde59]" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <a href="mailto:hello@levytate.co.uk?subject=LevyTate partner packages" className="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#102c3d] shadow-[0_16px_34px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5">Discuss Partner Packages</a>
          </div>
        </div>
      </div>
    </section>
  );
}
function AudienceJourneySection() {
  return (
    <section className="px-5 py-16 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c95568]">Who is LevyTate for?</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Two commercial routes. One controlled platform.</h2>
          <p className="mt-5 text-base leading-8 text-[#102c3d]/62">LevyTate supports employers looking to modernise apprenticeship management and training providers looking to become trusted delivery partners.</p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <JourneyCard
            variant="employer"
            label="Employers"
            title="Looking to modernise apprenticeship management?"
            intro="Give teams one place to manage people, pathways, approvals and provider matching without losing strategic visibility."
            bullets={["Employee management", "Applications", "Workforce planning", "AI guidance", "Provider matching"]}
            primaryCta="Request Employer Beta Access"
            primaryHref="#beta"
          />
          <JourneyCard
            variant="provider"
            label="Training providers"
            title="Interested in becoming a LevyTate Partner?"
            intro="Join a carefully selected network that supports qualified employer demand and strategic provider matching opportunities."
            bullets={["Employer introductions", "Qualified opportunities", "Premium visibility", "AI-supported recommendations", "Strategic partnership packages"]}
            primaryCta="Discuss Partner Packages"
            primaryHref="#providers"
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
  bullets: string[];
  primaryCta: string;
  primaryHref: string;
};

function JourneyCard({ variant, label, title, intro, bullets, primaryCta, primaryHref }: JourneyCardProps) {
  const isProvider = variant === "provider";

  return (
    <article className={`relative overflow-hidden rounded-[2rem] p-6 shadow-[0_28px_90px_rgba(16,44,61,0.1)] ring-1 sm:p-8 ${isProvider ? "bg-[#102c3d] text-white ring-white/10" : "bg-white text-[#102c3d] ring-[#102c3d]/[0.07]"}`}>
      <div className="relative z-10 grid min-h-full gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
        <JourneyIllustration variant={variant} />
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isProvider ? "text-[#ffde59]" : "text-[#c95568]"}`}>{label}</p>
          <h3 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">{title}</h3>
          <p className={`mt-4 text-sm leading-7 ${isProvider ? "text-white/72" : "text-[#102c3d]/62"}`}>{intro}</p>
          <ul className="mt-5 grid gap-2 text-sm leading-6">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex gap-3">
                <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${isProvider ? "bg-[#ffde59]" : "bg-[#18a89a]"}`} />
                <span className={isProvider ? "text-white/82" : "text-[#102c3d]/72"}>{bullet}</span>
              </li>
            ))}
          </ul>
          <a href={primaryHref} className={`mt-7 inline-flex rounded-full px-5 py-3 text-sm font-semibold transition hover:-translate-y-0.5 ${isProvider ? "bg-white text-[#102c3d] shadow-[0_16px_34px_rgba(0,0,0,0.22)]" : "bg-[#102c3d] text-white shadow-[0_16px_34px_rgba(16,44,61,0.16)]"}`}>{primaryCta}</a>
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
    <section id="beta" className="px-5 pb-16 pt-4 sm:px-8 lg:pb-24">
      <div className="mx-auto grid max-w-7xl gap-8 rounded-[2.4rem] bg-[#102c3d] p-6 text-white shadow-[0_34px_100px_rgba(16,44,61,0.2)] sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#c7f0e4]">Start using LevyTate</p>
          <h2 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">Stop managing apprenticeships across spreadsheets, emails and disconnected systems.</h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-white/66">Start using LevyTate as the operating system for apprenticeship decisions, workforce readiness and provider matching.</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <a href="mailto:hello@levytate.co.uk?subject=Employer beta access" className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#102c3d] transition hover:-translate-y-0.5">Request Beta Access</a>
          <Link href="/login" className="rounded-full bg-white/10 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:bg-white/14">Beta Login</Link>
        </div>
      </div>
    </section>
  );
}









