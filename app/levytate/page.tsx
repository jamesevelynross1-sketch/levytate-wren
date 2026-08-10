import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Building2,
  ClipboardCheck,
  GraduationCap,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { ApprenticeshipLifecycle } from "@/components/levytate-public/ApprenticeshipLifecycle";
import { OperationsCentrePreview } from "@/components/levytate-public/OperationsCentrePreview";
import { PublicFooter, PublicHeader } from "@/components/levytate-public/PublicHeader";
import { RoleExperienceShowcase } from "@/components/levytate-public/RoleExperienceShowcase";

export const metadata: Metadata = {
  title: "Apprenticeship Operating System for Employers",
  description: "LevyTate brings employee applications, manager approvals, learner management, providers and apprenticeship operations into one secure employer workspace.",
};

const operatingAreas = [
  {
    id: "applications-approvals",
    label: "Applications",
    title: "Keep every decision moving",
    copy: "Connect employee submission, Line Manager review and Apprenticeship Lead approval in one visible workflow.",
    detail: "Employee submission · Manager decision · Final approval",
    icon: ClipboardCheck,
  },
  {
    id: "learner-management",
    label: "Learners",
    title: "Run the operational learner journey",
    copy: "Maintain lifecycle records, reviews, progress, breaks and completion activity once an apprenticeship begins.",
    detail: "Enrolment · Progress · Reviews · Completion",
    icon: GraduationCap,
  },
  {
    id: "provider-management",
    label: "Providers",
    title: "Keep delivery partners connected",
    copy: "See the providers and programmes supporting your learners without separating them from day-to-day operations.",
    detail: "Relationships · Programmes · Learner associations",
    icon: Building2,
  },
  {
    id: "people-programmes",
    label: "People",
    title: "Connect roles, managers and activity",
    copy: "Keep organisational context alongside applications and apprenticeship activity so ownership stays clear.",
    detail: "People · Roles · Managers · Organisation",
    icon: UsersRound,
  },
  {
    id: "programmes",
    label: "Programmes",
    title: "Maintain the employer programme view",
    copy: "Give apprenticeship teams a clear view of the programmes available inside their employer environment.",
    detail: "Programme catalogue · Availability · Delivery context",
    icon: BookOpenCheck,
  },
] as const;

const fragmentation = [
  "Employee interest arrives in different places",
  "Manager approval gets stuck in email",
  "Learner information sits across spreadsheets and providers",
  "Operational actions are easy to miss",
  "Apprenticeship Leads lack one operating view",
] as const;

export default function LevyTateLandingPage() {
  return (
    <div className="min-h-screen bg-[#f6fbf8] text-[#102c3d]">
      <PublicHeader />
      <main>
        <HeroSection />
        <ProblemSection />
        <RoleSection />
        <LifecycleSection />
        <OperationsSection />
        <OperatingAreasSection />
        <CopilotSection />
        <SecuritySection />
        <ProviderSection />
        <FinalCta />
      </main>
      <PublicFooter />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-[#102c3d]/[0.07]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_14%,rgba(199,240,228,0.92),transparent_31rem),radial-gradient(circle_at_93%_2%,rgba(255,128,144,0.19),transparent_29rem),linear-gradient(180deg,#f8fcfa_0%,#eef7f3_100%)]" />
      <div className="mx-auto grid max-w-[90rem] gap-10 px-5 py-12 sm:px-8 lg:py-16 xl:grid-cols-[0.82fr_1.18fr] xl:items-center xl:gap-14">
        <div className="max-w-3xl">
          <p className="inline-flex min-h-9 items-center rounded-full bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#0b6f63] ring-1 ring-[#159b8f]/15 shadow-[0_10px_30px_rgba(16,44,61,0.05)]">
            Built for employer apprenticeship teams
          </p>
          <h1 className="mt-6 text-balance text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-[4.35rem]">
            The operating system for employer apprenticeship programmes.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#102c3d]/66">
            Bring employee applications, manager approvals, learner management, providers and apprenticeship operations into one secure workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/early-access" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-6 text-sm font-semibold text-white shadow-[0_18px_38px_rgba(16,44,61,0.18)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/25">
              Request Early Access
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <a href="#product" className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.1] transition hover:-translate-y-0.5 hover:ring-[#159b8f]/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20">
              See how LevyTate works
            </a>
          </div>
        </div>
        <OperationsCentrePreview />
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section id="product" className="scroll-mt-24 border-b border-[#102c3d]/[0.07] bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:py-20">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">One connected apprenticeship workspace</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">
            Running apprenticeships should not mean running spreadsheets, inboxes and disconnected provider conversations.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#102c3d]/60">
            LevyTate gives the people responsible for apprenticeship delivery one place to see the journey, the owner and the next action.
          </p>
        </div>
        <div className="overflow-hidden rounded-[1.6rem] border border-[#102c3d]/[0.08] bg-[#f6f9f8] shadow-[0_22px_65px_rgba(16,44,61,0.07)]">
          {fragmentation.map((item, index) => (
            <div key={item} className="grid grid-cols-[2.6rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-[#102c3d]/[0.06] px-4 py-4 last:border-b-0 sm:px-5">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-white text-xs font-semibold text-[#c95568] ring-1 ring-[#102c3d]/[0.07]">0{index + 1}</span>
              <p className="text-sm font-semibold leading-5 text-[#102c3d]/70">{item}</p>
              <ArrowRight size={15} className="text-[#102c3d]/30" aria-hidden="true" />
            </div>
          ))}
          <div className="bg-[#102c3d] px-5 py-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-6">
            <p className="text-lg font-semibold">Replace fragmentation with one operating view.</p>
            <span className="mt-2 inline-flex rounded-full bg-[#c7f0e4] px-3 py-1.5 text-xs font-semibold text-[#102c3d] sm:mt-0">Clear ownership</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoleSection() {
  return (
    <section id="role-experiences" className="scroll-mt-24">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Role-based experiences</p>
          <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">One platform. Different experiences.</h2>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#102c3d]/60">Each user sees the work, people and decisions relevant to their role. The programme stays connected without exposing everything to everyone.</p>
        </div>
        <div className="mt-10">
          <RoleExperienceShowcase />
        </div>
      </div>
    </section>
  );
}

function LifecycleSection() {
  return (
    <section id="lifecycle" className="scroll-mt-24 bg-[#102c3d] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.62fr_1.38fr] lg:items-start lg:py-20">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ffde59]">The connected apprenticeship lifecycle</p>
          <h2 className="mt-4 text-balance text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">Keep information and ownership connected from interest to completion.</h2>
          <p className="mt-5 text-base leading-7 text-white/62">LevyTate supports the operational handoffs between employees, managers, apprenticeship teams and providers. People remain in control at every stage.</p>
        </div>
        <ApprenticeshipLifecycle />
      </div>
    </section>
  );
}

function OperationsSection() {
  return (
    <section id="operations-centre" className="scroll-mt-24 border-b border-[#102c3d]/[0.07] bg-white">
      <div className="mx-auto max-w-[90rem] px-5 py-16 sm:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">The Operations Centre</p>
            <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">See what needs attention before it becomes a problem.</h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-[#102c3d]/60 lg:justify-self-end">The daily operating view brings applications, learner status, reviews, provider activity and upcoming operational events into one prioritised workspace.</p>
        </div>
        <div className="mt-10">
          <OperationsCentrePreview detailed />
        </div>
      </div>
    </section>
  );
}

function OperatingAreasSection() {
  return (
    <section className="border-b border-[#102c3d]/[0.07]">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
        <div className="max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Core operating areas</p>
          <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">The programme, organised around the work.</h2>
        </div>
        <div className="mt-10 divide-y divide-[#102c3d]/[0.08] border-y border-[#102c3d]/[0.08]">
          {operatingAreas.map((area, index) => {
            const Icon = area.icon;
            return (
              <article id={area.id} key={area.label} className="scroll-mt-28 grid gap-4 py-6 sm:grid-cols-[3rem_0.55fr_1fr] sm:items-start sm:gap-6 lg:py-8">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#0b6f63] shadow-[0_8px_25px_rgba(16,44,61,0.06)] ring-1 ring-[#102c3d]/[0.07]"><Icon size={20} aria-hidden="true" /></span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">0{index + 1} · {area.label}</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] sm:text-2xl">{area.title}</h3>
                </div>
                <div>
                  <p className="text-sm leading-6 text-[#102c3d]/62">{area.copy}</p>
                  <p className="mt-3 text-xs font-semibold text-[#0b6f63]">{area.detail}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CopilotSection() {
  const prompts = ["What happens next?", "Help me prepare my application", "Open my current work"];
  return (
    <section id="copilot" className="scroll-mt-24 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:py-20">
        <div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#102c3d] text-[#ffde59]"><Sparkles size={20} aria-hidden="true" /></div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">LevyTate Copilot</p>
          <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">An intelligent support layer across the apprenticeship experience.</h2>
          <p className="mt-5 text-base leading-7 text-[#102c3d]/60">Copilot helps users understand next steps, interpret apprenticeship information, support applications and navigate LevyTate. It supports people without replacing their decisions.</p>
        </div>
        <div className="rounded-[1.7rem] bg-[#102c3d] p-3 text-white shadow-[0_28px_80px_rgba(16,44,61,0.2)] sm:p-5">
          <div className="rounded-[1.25rem] bg-white p-5 text-[#102c3d]">
            <div className="flex items-center justify-between gap-3 border-b border-[#102c3d]/[0.06] pb-4">
              <div>
                <p className="text-sm font-semibold">LevyTate Copilot</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#0b6f63]">Role-aware platform guidance</p>
              </div>
              <Sparkles size={18} className="text-[#c95568]" aria-hidden="true" />
            </div>
            <div className="mt-4 rounded-xl bg-[#eef8f4] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#0b6f63]">Copilot</p>
              <p className="mt-2 text-sm leading-6 text-[#102c3d]/68">I can explain your current step, help prepare a draft or take you to the right LevyTate workflow.</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {prompts.map((prompt) => <div key={prompt} className="flex min-h-12 items-center rounded-xl bg-[#f6f9f8] px-3 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.06]">{prompt}</div>)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const controls = [
    "Individual secure sign-in",
    "Role-based access",
    "Organisation-level workspace separation",
    "Controlled user permissions",
    "Access expiry and revocation",
    "Separate employee, manager and lead experiences",
  ];
  return (
    <section id="security" className="scroll-mt-24 border-y border-[#102c3d]/[0.07] bg-[#edf7f3]">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:py-20">
        <div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[#0b6f63] shadow-[0_10px_30px_rgba(16,44,61,0.06)]"><ShieldCheck size={23} aria-hidden="true" /></div>
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Control and security</p>
          <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">Everyone sees what they need. Nothing more.</h2>
          <p className="mt-5 text-base leading-7 text-[#102c3d]/60">Secure employer workspaces keep operational context available to the right people while preserving clear role and organisation boundaries.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {controls.map((control, index) => (
            <div key={control} className="flex min-h-[4.5rem] items-center gap-3 rounded-[1rem] bg-white px-4 py-3 ring-1 ring-[#102c3d]/[0.06]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#102c3d] text-[10px] font-semibold text-white">0{index + 1}</span>
              <p className="text-sm font-semibold leading-5 text-[#102c3d]/70">{control}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProviderSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:py-16">
        <div className="max-w-4xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Provider relationships</p>
          <h2 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-[-0.03em] sm:text-4xl">Keep delivery partners connected to your apprenticeship operations.</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#102c3d]/60">Maintain provider visibility, associated programmes and learner relationships alongside the operational programme. LevyTate remains employer-led.</p>
        </div>
        <Link href="/solutions/training-providers" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#eef8f4] px-6 text-sm font-semibold text-[#0b6f63] ring-1 ring-[#159b8f]/15 transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20">Provider context <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-5 pb-16 pt-4 sm:px-8 lg:pb-20">
      <div className="mx-auto grid max-w-7xl gap-8 overflow-hidden rounded-[2rem] bg-[#102c3d] p-7 text-white shadow-[0_28px_80px_rgba(16,44,61,0.2)] sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ffde59]">Core Early Access</p>
          <h2 className="mt-3 text-balance text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl">Run apprenticeships from one place.</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/65">LevyTate is opening Early Access to employers that want a clearer way to manage applications, learners, providers and apprenticeship operations.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Link href="/early-access" className="inline-flex min-h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#102c3d] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c7f0e4]/35">Request Early Access</Link>
          <a href="mailto:hello@levytate.co.uk?subject=Book%20a%20LevyTate%20demonstration" className="inline-flex min-h-12 items-center justify-center rounded-full bg-white/10 px-6 text-sm font-semibold text-white ring-1 ring-white/15 transition hover:-translate-y-0.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c7f0e4]/30">Book a demonstration</a>
        </div>
      </div>
    </section>
  );
}
