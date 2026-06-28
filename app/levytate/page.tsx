import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/levytate-public/PublicHeader";

export const metadata: Metadata = {
  title: "Apprenticeship Operating System for Employers",
  description: "LevyTate brings employee management, apprenticeship applications, role-led pathways, provider matching and reporting into one intelligent workspace.",
};

const audiences = [
  {
    title: "Employers",
    copy: "Manage employees, applications, providers and apprenticeship decisions from one workspace.",
    cta: "Explore employer solution",
    href: "/solutions/employers",
    icon: "employer",
  },
  {
    title: "Training Providers",
    copy: "Discuss partner packages and join a curated network for qualified employer opportunities.",
    cta: "Explore provider partnerships",
    href: "/solutions/training-providers",
    icon: "provider",
  },
  {
    title: "Employees",
    copy: "Use AI-supported guidance to understand suitable pathways and manage your application.",
    cta: "Explore employee experience",
    href: "/solutions/employees",
    icon: "employee",
  },
] as const;

const workflow = [
  "Add employees",
  "Map roles",
  "AI suggests pathways",
  "Employee applies",
  "Manager approves",
  "Provider matched",
  "Enrolment tracked",
];

export default function LevyTateLandingPage() {
  return (
    <div className="min-h-screen bg-[#f6fbf8] text-[#102c3d]">
      <PublicHeader />
      <main>
        <HeroSection />
        <ProblemSection />
        <AudienceSection />
        <WorkflowSection />
        <AiSection />
        <FinalCta />
      </main>
      <PublicFooter />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative border-b border-[#102c3d]/[0.07]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_10%,rgba(199,240,228,0.88),transparent_33rem),radial-gradient(circle_at_88%_8%,rgba(255,128,144,0.2),transparent_27rem),linear-gradient(180deg,#f6fbf8_0%,#eef8f4_100%)]" />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 lg:py-20 xl:grid-cols-[0.92fr_1.08fr] xl:items-center xl:gap-14">
        <div>
          <p className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12] shadow-[0_12px_30px_rgba(16,44,61,0.05)]">
            Apprenticeship operations, made clearer
          </p>
          <h1 className="mt-6 max-w-4xl break-words text-[2.7rem] font-semibold leading-[1.03] sm:text-6xl lg:text-[4rem] xl:text-7xl">
            The apprenticeship operating system for modern employers.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#102c3d]/66">
            Replace spreadsheets, email chains and disconnected provider conversations with one intelligent workspace for employees, applications and provider matching.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#beta" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#102c3d] px-6 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(16,44,61,0.18)] transition hover:-translate-y-0.5">
              Request Beta Access
            </a>
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.09] transition hover:-translate-y-0.5 hover:ring-[#159b8f]/25">
              Beta Login
            </Link>
          </div>
        </div>
        <ProductPreview />
      </div>
    </section>
  );
}

function ProductPreview() {
  const modules = [
    ["Application status", "Awaiting manager review", "In progress"],
    ["AI recommendation", "Level 3 Data Technician", "Strong fit"],
    ["Provider match", "98% Provider Match", "Best-fit provider identified"],
    ["Reporting snapshot", "91%", "Workforce development coverage"],
  ];

  return (
    <aside className="min-w-0 rounded-[2rem] border border-[#102c3d]/[0.08] bg-white/92 p-3 shadow-[0_34px_100px_rgba(16,44,61,0.15)] backdrop-blur-xl sm:p-4">
      <div className="overflow-hidden rounded-[1.5rem] border border-[#102c3d]/[0.06] bg-[#f8fbfa]">
        <div className="flex items-center justify-between gap-4 border-b border-[#102c3d]/[0.06] bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Live workspace</p>
            <p className="mt-1 truncate text-lg font-semibold">Employer operating view</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#eaf7f2] px-3 py-1.5 text-xs font-semibold text-[#0b6f63]">Beta</span>
        </div>

        <div className="p-3 sm:p-4">
          <div className="rounded-[1.35rem] bg-[#102c3d] p-5 text-white shadow-[0_18px_46px_rgba(16,44,61,0.18)]">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c7f0e4]">Employee record</p>
                <p className="mt-2 text-xl font-semibold">Business Support Coordinator</p>
                <p className="mt-2 text-sm text-white/58">Operations &bull; Manchester &bull; Manager assigned</p>
              </div>
              <span className="inline-flex w-fit rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/12">Role mapped</span>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {modules.map(([label, value, status], index) => (
              <div key={label} className="min-h-[116px] rounded-[1.25rem] bg-white p-4 shadow-[0_14px_38px_rgba(16,44,61,0.045)] ring-1 ring-[#102c3d]/[0.06]">
                <div className="flex min-h-[18px] items-start justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase leading-[18px] tracking-[0.12em] text-[#102c3d]/44">{label}</p>
                  <span className={"mt-1 h-2 w-2 shrink-0 rounded-full " + (index === 0 ? "bg-[#c95568]" : index === 2 ? "bg-[#ffde59]" : "bg-[#18a89a]")} />
                </div>
                <div className="mt-3">
                  <p className="text-base font-semibold leading-5">{value}</p>
                  <p className="mt-1.5 text-xs leading-5 text-[#0b6f63]">{status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function ProblemSection() {
  const before = ["Spreadsheets", "Email approvals", "Provider chasing", "Fragmented reporting"];
  const after = ["One workspace", "Clear approvals", "Role-led pathways", "LevyTate-led provider matching"];

  return (
    <section id="problem" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
      <div className="max-w-4xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Replace fragmented administration</p>
        <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Apprenticeship management should not rely on spreadsheets and inboxes.</h2>
      </div>
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <ComparisonPanel label="Before LevyTate" items={before} tone="before" />
        <ComparisonPanel label="With LevyTate" items={after} tone="after" />
      </div>
    </section>
  );
}

function ComparisonPanel({ label, items, tone }: { label: string; items: string[]; tone: "before" | "after" }) {
  const positive = tone === "after";

  return (
    <article className={"rounded-[1.7rem] border p-6 shadow-[0_18px_50px_rgba(16,44,61,0.055)] sm:p-7 " + (positive ? "border-[#159b8f]/15 bg-[#eef8f4]" : "border-[#102c3d]/[0.07] bg-white")}>
      <p className={"text-[11px] font-semibold uppercase tracking-[0.14em] " + (positive ? "text-[#0b6f63]" : "text-[#c95568]")}>{label}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item} className="flex min-h-[62px] items-center gap-3 rounded-[1rem] bg-white px-4 py-3 ring-1 ring-[#102c3d]/[0.06]">
            <span className={"h-2 w-2 shrink-0 rounded-full " + (positive ? "bg-[#18a89a]" : "bg-[#c95568]")} />
            <span className="text-sm font-semibold leading-5 text-[#102c3d]/72">{item}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function AudienceSection() {
  return (
    <section id="audiences" className="border-y border-[#102c3d]/[0.07] bg-white/72">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Audience-led solutions</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Choose your LevyTate journey.</h2>
          <p className="mt-5 text-base leading-8 text-[#102c3d]/62">Start with the outcome that matters to you, then explore the detail designed for your role in the apprenticeship system.</p>
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {audiences.map((audience) => (
            <Link key={audience.title} href={audience.href} className="group flex min-h-[270px] flex-col rounded-[1.7rem] border border-[#102c3d]/[0.07] bg-white p-6 shadow-[0_18px_50px_rgba(16,44,61,0.055)] transition duration-300 hover:-translate-y-1 hover:border-[#159b8f]/20 hover:shadow-[0_26px_66px_rgba(16,44,61,0.1)] sm:p-7">
              <AudienceIcon type={audience.icon} />
              <h3 className="mt-8 text-2xl font-semibold">{audience.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#102c3d]/60">{audience.copy}</p>
              <span className="mt-auto flex items-center gap-2 pt-7 text-sm font-semibold text-[#0b6f63]">
                {audience.cta}
                <ArrowRightIcon />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 transition group-hover:translate-x-1">
      <path d="M4 10h11" />
      <path d="m11 6 4 4-4 4" />
    </svg>
  );
}

function AudienceIcon({ type }: { type: (typeof audiences)[number]["icon"] }) {
  const paths = {
    employer: <><path d="M3 21h18M5 21V8l7-4 7 4v13" /><path d="M9 12h.01M15 12h.01M9 16h.01M15 16h.01" /></>,
    provider: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /><path d="M10 6.5h4a3.5 3.5 0 0 1 3.5 3.5v4M14 17.5h-4A3.5 3.5 0 0 1 6.5 14v-4" /></>,
    employee: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /><path d="m16.5 4.5 1-2 1 2 2 .5-1.5 1.5.5 2-2-1-2 1 .5-2L14.5 5l2-.5Z" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-9 w-9 text-[#0b6f63] transition-colors group-hover:text-[#c95568]">
      {paths[type]}
    </svg>
  );
}

function WorkflowSection() {
  return (
    <section id="workflow" className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
      <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">One connected workflow</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">From employee record to tracked enrolment.</h2>
          <p className="mt-5 text-base leading-8 text-[#102c3d]/62">A visible route through the decisions that usually sit across spreadsheets, inboxes and provider conversations.</p>
        </div>
        <div className="rounded-[1.8rem] border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_24px_70px_rgba(16,44,61,0.07)]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {workflow.map((step, index) => (
              <div key={step} className={"flex min-h-[126px] flex-col rounded-[1.2rem] p-4 ring-1 " + (index === 2 ? "bg-[#102c3d] text-white ring-[#102c3d]" : "bg-[#f8fbfa] ring-[#102c3d]/[0.055]")}>
                <span className={"grid h-8 w-8 place-items-center rounded-xl text-xs font-semibold " + (index === 2 ? "bg-white/10 text-[#c7f0e4]" : "bg-white text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12]")}>0{index + 1}</span>
                <p className="mt-auto pt-5 text-sm font-semibold leading-5">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AiSection() {
  return (
    <section id="ai" className="border-y border-[#102c3d]/[0.07] bg-[#102c3d] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:py-20">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ffde59]">Ask LevyTate AI</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight sm:text-5xl">Supportive guidance, grounded in real roles.</h2>
          <p className="mt-5 text-base leading-8 text-white/64">Help employees and apprenticeship teams understand suitable approved pathways without starting from a confusing list of standards.</p>
        </div>
        <div className="rounded-[1.8rem] bg-white p-4 text-[#102c3d] shadow-[0_28px_80px_rgba(0,0,0,0.18)] sm:p-5">
          <ChatBubble speaker="User" message="We have an admin-heavy role that is starting to involve more reporting and automation. What pathway could help?" />
          <ChatBubble speaker="LevyTate AI" message="A Level 3 Data Technician route could be a strong fit if the role involves spreadsheets, reporting, CRM updates or process admin. An AI support pathway could also be explored if the goal is automation and digital confidence." highlighted />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Link href="/solutions/employees" className="rounded-xl bg-[#eef8f4] px-4 py-3 text-center text-xs font-semibold text-[#0b6f63]">Compare pathways</Link>
            <Link href="/solutions/training-providers" className="rounded-xl bg-[#fff0f2] px-4 py-3 text-center text-xs font-semibold text-[#c95568]">Request provider matching</Link>
            <Link href="/login" className="rounded-xl bg-[#f6f8f7] px-4 py-3 text-center text-xs font-semibold text-[#102c3d]/68">Save for beta workspace</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ChatBubble({ speaker, message, highlighted = false }: { speaker: string; message: string; highlighted?: boolean }) {
  return (
    <div className={"rounded-[1.2rem] p-4 " + (highlighted ? "mt-3 bg-[#eef8f4]" : "bg-[#f8fbfa] ring-1 ring-[#102c3d]/[0.06]")}>
      <p className={"text-[11px] font-semibold uppercase tracking-[0.14em] " + (highlighted ? "text-[#0b6f63]" : "text-[#c95568]")}>{speaker}</p>
      <p className="mt-2 text-sm leading-7 text-[#102c3d]/68">{message}</p>
    </div>
  );
}

function FinalCta() {
  return (
    <section id="beta" className="px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] bg-white p-7 shadow-[0_26px_80px_rgba(16,44,61,0.09)] ring-1 ring-[#102c3d]/[0.07] sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">LevyTate public beta</p>
          <h2 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight sm:text-5xl">Start building a clearer apprenticeship operating system.</h2>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <a href="mailto:hello@levytate.co.uk?subject=Employer beta access" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#102c3d] px-6 text-sm font-semibold text-white">Request Beta Access</a>
          <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#eef8f4] px-6 text-sm font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/[0.12]">Beta Login</Link>
        </div>
      </div>
    </section>
  );
}