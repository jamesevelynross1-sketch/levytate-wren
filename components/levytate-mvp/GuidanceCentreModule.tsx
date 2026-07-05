"use client";

import { BookOpen, BriefcaseBusiness, CircleHelp, GraduationCap, Lightbulb, ShieldCheck } from "lucide-react";
import { MvpPanel, StatusBadge } from "@/components/levytate-mvp/MvpUi";

const topics = [
  {
    title: "Funding and levy",
    icon: ShieldCheck,
    summary: "Understand levy, co-investment, transfers and funding conversations before a provider shortlist is prepared.",
    bullets: ["Potentially levy-funded routes", "Transfers and co-investment", "Funding position signals for matching"],
    status: "Most viewed",
  },
  {
    title: "Provider selection",
    icon: BriefcaseBusiness,
    summary: "Use LevyTate's controlled criteria to compare sector fit, delivery capability, learner needs and programme proposition quality.",
    bullets: ["Delivery model fit", "Industry and technology alignment", "Controlled shortlist guidance"],
    status: "Commercial",
  },
  {
    title: "Employer responsibilities",
    icon: BookOpen,
    summary: "Clarify employer commitments, off-the-job learning, readiness and manager responsibilities before launch.",
    bullets: ["Line manager support", "Operational release and commitment", "Readiness checks before enrolment"],
    status: "Operational",
  },
  {
    title: "Learner responsibilities",
    icon: GraduationCap,
    summary: "Prepare employees and managers for the practical commitment required once a programme is approved for delivery.",
    bullets: ["Time commitment", "Assessment expectations", "Support and progression conversations"],
    status: "Employee",
  },
  {
    title: "AI and future skills",
    icon: Lightbulb,
    summary: "Frame AI adoption, automation, data and future capability discussions in a way that supports workforce planning rather than hype.",
    bullets: ["Future skills demand", "Capability growth themes", "AI-supported pathway guidance"],
    status: "Strategy",
  },
  {
    title: "Apprenticeship myths",
    icon: CircleHelp,
    summary: "Address common misconceptions that slow down internal approvals or weaken manager confidence in apprenticeship routes.",
    bullets: ["Not just entry-level", "Role-led specialist pathways", "Why provider matching is controlled"],
    status: "Advisory",
  },
] as const;

export function GuidanceCentreModule() {
  return (
    <div className="grid gap-5">
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Summary label="Topics" value={topics.length} copy="Focused advisory areas" />
        <Summary label="Funding" value="Levy" copy="Funding and transfer guidance" />
        <Summary label="Selection" value="Controlled" copy="Provider matching model" />
        <Summary label="Readiness" value="Live" copy="Employer and learner duties" />
        <Summary label="AI" value="Future skills" copy="AI and capability guidance" />
        <Summary label="Advisory" value="Trusted" copy="Commercially neutral guidance" />
      </section>

      <MvpPanel title="Guidance Centre" eyebrow="Trusted advisory layer">
        <div className="grid gap-4 xl:grid-cols-2">
          {topics.map((topic) => {
            const Icon = topic.icon;
            return (
              <article key={topic.title} className="rounded-2xl border border-[#102c3d]/[0.08] bg-white p-5 shadow-[0_14px_34px_rgba(16,44,61,0.045)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#edf7f3] text-[#0b8e82]"><Icon size={18} /></div>
                    <div>
                      <h3 className="text-base font-semibold text-[#102c3d]">{topic.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[#102c3d]/58">{topic.summary}</p>
                    </div>
                  </div>
                  <StatusBadge tone="blue">{topic.status}</StatusBadge>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-[#102c3d]/60">
                  {topic.bullets.map((bullet) => <li key={bullet}>- {bullet}</li>)}
                </ul>
              </article>
            );
          })}
        </div>
      </MvpPanel>
    </div>
  );
}

function Summary({ label, value, copy }: { label: string; value: string | number; copy: string }) {
  return (
    <article className="rounded-xl border border-[#102c3d]/[0.07] bg-white px-4 py-4 shadow-[0_14px_32px_rgba(16,44,61,0.045)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c95568]">{label}</p>
      <p className="mt-3 text-xl font-semibold text-[#102c3d]">{value}</p>
      <p className="mt-1 text-sm leading-6 text-[#102c3d]/58">{copy}</p>
    </article>
  );
}
