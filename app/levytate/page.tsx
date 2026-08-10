import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ApprenticeshipLifecycle } from "@/components/levytate-public/ApprenticeshipLifecycle";
import { OperationsCentrePreview } from "@/components/levytate-public/OperationsCentrePreview";
import { PublicFooter, PublicHeader } from "@/components/levytate-public/PublicHeader";
import { RoleExperienceShowcase } from "@/components/levytate-public/RoleExperienceShowcase";

export const metadata: Metadata = {
  title: "Apprenticeship Operating System for Employers",
  description: "LevyTate brings employee applications, manager approvals, learner management, providers and apprenticeship operations into one secure employer workspace.",
};

const operatingAreas = [
  { label: "Applications", title: "Keep every decision moving", copy: "Connect employee submission, Line Manager review and Apprenticeship Lead approval in one visible workflow.", detail: "Employee submission · Manager decision · Final approval" },
  { label: "Learners", title: "Run the operational learner journey", copy: "Maintain lifecycle records, reviews, progress, breaks and completion activity once an apprenticeship begins.", detail: "Enrolment · Progress · Reviews · Completion" },
  { label: "Providers", title: "Keep delivery partners connected", copy: "See the providers and programmes supporting learners without separating them from day-to-day operations.", detail: "Relationships · Programmes · Learner associations" },
  { label: "People", title: "Connect roles, managers and activity", copy: "Keep organisational context alongside applications and apprenticeship activity so ownership stays clear.", detail: "People · Roles · Managers · Organisation" },
  { label: "Programmes", title: "Maintain the employer programme view", copy: "Give apprenticeship teams a clear view of programmes available inside their employer environment.", detail: "Programme catalogue · Availability · Delivery context" },
] as const;

const fragmentation = [
  ["01", "Employee interest arrives in different places"],
  ["02", "Manager approval gets stuck in email"],
  ["03", "Learner information sits across spreadsheets and providers"],
  ["04", "Operational actions are easy to miss"],
  ["05", "Apprenticeship Leads lack one operating view"],
] as const;

const controls = [
  ["01", "Secure sign-in", "Individual access with a clear identity boundary."],
  ["02", "Role-based access", "Experiences and actions follow responsibility."],
  ["03", "Organisation separation", "Employer workspaces remain distinct."],
  ["04", "Controlled permissions", "Access can be governed, expired and revoked."],
] as const;

const frame = "mx-auto max-w-[90rem] px-6 sm:px-8 lg:px-10 xl:px-12";
const eyebrow = "text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a9475a]";
const sectionHeading = "text-balance text-[clamp(2.5rem,4vw,3.55rem)] font-semibold leading-[1.04] tracking-[-0.04em]";

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
    <section className="relative overflow-hidden border-b border-[#102c3d]/[0.07] bg-[linear-gradient(180deg,#fbfdfc_0%,#f1f8f5_100%)]">
      <div className="pointer-events-none absolute right-[-8rem] top-[-16rem] h-[34rem] w-[34rem] rounded-full bg-[#c7f0e4]/40 blur-3xl" aria-hidden="true" />
      <div className={`${frame} relative grid gap-12 py-14 sm:py-16 lg:py-20 xl:grid-cols-[46fr_54fr] xl:items-center xl:gap-12`}>
        <div className="max-w-[39rem]">
          <div className="flex items-center gap-3">
            <span className="h-px w-8 bg-[#c95568]" aria-hidden="true" />
            <p className={eyebrow}>Built for employer apprenticeship teams</p>
          </div>
          <h1 className="mt-6 text-[clamp(3.15rem,4.2vw,3.75rem)] font-semibold leading-[0.99] tracking-[-0.055em] 2xl:text-[4rem]">
            <span className="xl:block xl:whitespace-nowrap">The operating system</span>{" "}
            <span className="xl:block xl:whitespace-nowrap">for employer</span>{" "}
            <span className="xl:block xl:whitespace-nowrap">apprenticeship</span>{" "}
            <span className="xl:block xl:whitespace-nowrap">programmes.</span>
          </h1>
          <p className="mt-7 max-w-[37rem] text-[17px] leading-[1.65] text-[#102c3d]/64 sm:text-[18px]">
            Bring employee applications, manager approvals, learner management, providers and apprenticeship operations into one secure workspace.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/early-access" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#102c3d] px-5 text-[13px] font-semibold text-white transition-colors hover:bg-[#183b50] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/25">
              Request Early Access <ArrowRight size={15} aria-hidden="true" />
            </Link>
            <a href="#product" className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-5 text-[13px] font-semibold text-[#102c3d] ring-1 ring-[#102c3d]/[0.1] transition-colors hover:bg-[#f4f8f6] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20">
              See how LevyTate works
            </a>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[780px] xl:mx-0 xl:justify-self-end">
          <OperationsCentrePreview />
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section id="product" className="scroll-mt-24 bg-white">
      <div className={`${frame} grid gap-14 py-24 lg:grid-cols-[.92fr_1.08fr] lg:items-start lg:py-28`}>
        <div className="max-w-[42rem]">
          <p className={eyebrow}>One connected apprenticeship workspace</p>
          <h2 className={`mt-5 ${sectionHeading}`}>Running apprenticeships should not mean running spreadsheets, inboxes and disconnected provider conversations.</h2>
          <p className="mt-6 max-w-[38rem] text-[17px] leading-7 text-[#102c3d]/60">LevyTate gives the people responsible for apprenticeship delivery one place to see the journey, the owner and the next action.</p>
        </div>
        <div className="border-y border-[#102c3d]/[0.1]">
          {fragmentation.map(([number, item]) => (
            <div key={item} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-4 border-b border-[#102c3d]/[0.07] py-4 last:border-b-0 sm:py-5">
              <span className="text-[11px] font-semibold text-[#c95568]">{number}</span>
              <p className="text-[14px] font-medium leading-6 text-[#102c3d]/68 sm:text-[15px]">{item}</p>
            </div>
          ))}
          <div className="flex items-center gap-4 border-t border-[#102c3d]/[0.1] py-5">
            <span className="h-2 w-2 bg-[#159b8f]" aria-hidden="true" />
            <p className="text-[15px] font-semibold">Replace fragmentation with one operating view.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoleSection() {
  return (
    <section id="role-experiences" className="scroll-mt-24 border-y border-[#102c3d]/[0.07]">
      <div className={`${frame} py-24 lg:py-28`}>
        <div className="grid gap-6 lg:grid-cols-[.72fr_1.28fr] lg:items-end">
          <div>
            <p className={eyebrow}>Role-based experiences</p>
            <h2 className={`mt-4 ${sectionHeading}`}>One platform. Different experiences.</h2>
          </div>
          <p className="max-w-[42rem] text-[17px] leading-7 text-[#102c3d]/60 lg:justify-self-end">Each user sees the work, people and decisions relevant to their role. The programme stays connected without exposing everything to everyone.</p>
        </div>
        <div className="mt-12"><RoleExperienceShowcase /></div>
      </div>
    </section>
  );
}

function LifecycleSection() {
  return (
    <section id="lifecycle" className="scroll-mt-24 bg-[#102c3d] text-white">
      <div className={`${frame} py-24 lg:py-28`}>
        <div className="grid gap-7 lg:grid-cols-[.76fr_1.24fr] lg:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c7f0e4]/66">The connected apprenticeship lifecycle</p>
            <h2 className="mt-4 text-balance text-[clamp(2.5rem,4vw,3.55rem)] font-semibold leading-[1.04] tracking-[-0.04em]">Keep information and ownership connected from interest to completion.</h2>
          </div>
          <p className="max-w-[42rem] text-[16px] leading-7 text-white/56 lg:justify-self-end">Operational handoffs remain visible between employees, managers, apprenticeship teams and providers. People stay in control at every stage.</p>
        </div>
        <div className="mt-14 border-t border-white/10 pt-10"><ApprenticeshipLifecycle /></div>
      </div>
    </section>
  );
}

function OperationsSection() {
  return (
    <section id="operations-centre" className="scroll-mt-24 bg-white">
      <div className={`${frame} py-24 lg:py-28`}>
        <div className="grid gap-7 lg:grid-cols-[.82fr_1.18fr] lg:items-end">
          <div>
            <p className={eyebrow}>The Operations Centre</p>
            <h2 className={`mt-4 ${sectionHeading}`}>See what needs attention before it becomes a problem.</h2>
          </div>
          <p className="max-w-[40rem] text-[17px] leading-7 text-[#102c3d]/60 lg:justify-self-end">Applications, learner status, reviews, provider activity and upcoming operational events in one prioritised daily view.</p>
        </div>
        <div className="mt-12"><OperationsCentrePreview detailed /></div>
      </div>
    </section>
  );
}

function OperatingAreasSection() {
  return (
    <section className="border-y border-[#102c3d]/[0.07] bg-[#f0f7f4]">
      <div className={`${frame} grid gap-14 py-24 lg:grid-cols-[.68fr_1.32fr] lg:py-28`}>
        <div className="max-w-md lg:sticky lg:top-28 lg:self-start">
          <p className={eyebrow}>Core operating areas</p>
          <h2 className={`mt-4 ${sectionHeading}`}>The programme, organised around the work.</h2>
          <p className="mt-6 text-[16px] leading-7 text-[#102c3d]/58">Five connected areas give apprenticeship teams a common operating model without flattening every task into the same view.</p>
        </div>
        <div className="border-y border-[#102c3d]/[0.1] bg-white">
          {operatingAreas.map((area, index) => (
            <article id={index === 0 ? "applications-approvals" : index === 1 ? "learner-management" : index === 2 ? "provider-management" : index === 3 ? "people-programmes" : "programmes"} key={area.label} className="scroll-mt-28 grid gap-4 border-b border-[#102c3d]/[0.07] px-5 py-7 last:border-b-0 sm:grid-cols-[3rem_.8fr_1.2fr] sm:gap-6 sm:px-7">
              <span className="text-[11px] font-semibold text-[#c95568]">0{index + 1}</span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0b6f63]">{area.label}</p>
                <h3 className="mt-2 text-[21px] font-semibold leading-tight tracking-[-0.025em]">{area.title}</h3>
              </div>
              <div>
                <p className="text-[14px] leading-6 text-[#102c3d]/58">{area.copy}</p>
                <p className="mt-3 text-[11px] font-semibold text-[#102c3d]/46">{area.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CopilotSection() {
  return (
    <section id="copilot" className="scroll-mt-24 bg-white">
      <div className={`${frame} grid gap-14 py-24 lg:grid-cols-[.72fr_1.28fr] lg:items-center lg:py-28`}>
        <div>
          <p className={eyebrow}>LevyTate Copilot</p>
          <h2 className={`mt-4 ${sectionHeading}`}>An intelligent support layer across the apprenticeship experience.</h2>
          <p className="mt-6 max-w-[38rem] text-[17px] leading-7 text-[#102c3d]/60">Copilot explains next steps, supports applications and helps people continue the right LevyTate workflow. It supports decisions without replacing them.</p>
        </div>
        <div className="overflow-hidden rounded-[20px] bg-[#0a2333] text-white shadow-[0_24px_70px_rgba(9,31,45,0.16)]">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
            <div><p className="text-[13px] font-semibold">Copilot</p><p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/36">Application context</p></div>
            <span className="text-[10px] font-medium text-[#c7f0e4]/60">Grounded in your current work</span>
          </div>
          <div className="grid gap-0 bg-[#f4f7f6] text-[#102c3d] sm:grid-cols-[.78fr_1.22fr]">
            <div className="border-b border-[#102c3d]/[0.07] p-5 sm:border-b-0 sm:border-r sm:p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">Current step</p>
              <p className="mt-3 text-[14px] font-semibold">Awaiting manager review</p>
              <p className="mt-2 text-[12px] leading-5 text-[#102c3d]/48">Application submitted · Line Manager owns the next action</p>
            </div>
            <div className="bg-white p-5 sm:p-6">
              <p className="text-[11px] font-semibold text-[#0b6f63]">What happens next?</p>
              <p className="mt-3 text-[13px] leading-6 text-[#102c3d]/66">Your manager reviews the application first. If approved, it moves to the Apprenticeship Lead for a final decision before enrolment.</p>
              <div className="mt-5 flex items-center justify-between border-t border-[#102c3d]/[0.07] pt-4">
                <span className="text-[10px] text-[#102c3d]/38">Source · Current application workflow</span>
                <span className="text-[11px] font-semibold text-[#0b6f63]">Open application</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  return (
    <section id="security" className="scroll-mt-24 bg-[#0a2333] text-white">
      <div className={`${frame} py-24 lg:py-28`}>
        <div className="max-w-[48rem]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c7f0e4]/66">Control and security</p>
          <h2 className="mt-4 text-balance text-[clamp(2.5rem,4vw,3.55rem)] font-semibold leading-[1.04] tracking-[-0.04em]">Everyone sees what they need. Nothing more.</h2>
          <p className="mt-6 max-w-[40rem] text-[16px] leading-7 text-white/54">Secure employer workspaces preserve clear role and organisation boundaries while keeping operational context available to the right people.</p>
        </div>
        <div className="mt-12 grid border-y border-white/10 sm:grid-cols-2 lg:grid-cols-4">
          {controls.map(([number, title, copy], index) => (
            <div key={title} className={`px-0 py-6 sm:px-6 lg:py-8 ${index % 2 === 0 ? "sm:border-r" : ""} ${index < 2 ? "border-b lg:border-b-0" : ""} lg:border-r lg:last:border-r-0 border-white/10`}>
              <p className="text-[10px] font-semibold text-[#ff9eaa]">{number}</p>
              <h3 className="mt-5 text-[16px] font-semibold">{title}</h3>
              <p className="mt-3 text-[12px] leading-5 text-white/42">{copy}</p>
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
      <div className={`${frame} grid gap-8 py-20 lg:grid-cols-[1fr_auto] lg:items-center lg:py-24`}>
        <div className="max-w-[56rem]">
          <p className={eyebrow}>Provider relationships</p>
          <h2 className="mt-4 text-balance text-[clamp(2rem,3vw,2.8rem)] font-semibold leading-[1.08] tracking-[-0.035em]">Keep delivery partners connected to your apprenticeship operations.</h2>
          <p className="mt-5 max-w-[45rem] text-[16px] leading-7 text-[#102c3d]/58">Maintain provider, programme and learner relationships alongside the operational programme. LevyTate remains employer-led.</p>
        </div>
        <Link href="/solutions/training-providers" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#102c3d]/[0.1] px-5 text-[13px] font-semibold text-[#102c3d] transition-colors hover:bg-[#f0f7f4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/20">Provider context <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="px-6 pb-20 sm:px-8 lg:px-10 lg:pb-24 xl:px-12">
      <div className="mx-auto grid max-w-[90rem] gap-8 overflow-hidden rounded-[20px] bg-[#102c3d] p-7 text-white sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c7f0e4]/66">Core Early Access</p>
          <h2 className="mt-4 text-balance text-[clamp(2.5rem,4vw,3.55rem)] font-semibold leading-[1.04] tracking-[-0.04em]">Run apprenticeships from one place.</h2>
          <p className="mt-5 max-w-[46rem] text-[16px] leading-7 text-white/56">LevyTate is opening Early Access to employers that want a clearer way to manage applications, learners, providers and apprenticeship operations.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <Link href="/early-access" className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-5 text-[13px] font-semibold text-[#102c3d] transition-colors hover:bg-[#eef8f4] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c7f0e4]/35">Request Early Access</Link>
          <a href="mailto:hello@levytate.co.uk?subject=Book%20a%20LevyTate%20demonstration" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 px-5 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c7f0e4]/30">Book a demonstration</a>
        </div>
      </div>
    </section>
  );
}
