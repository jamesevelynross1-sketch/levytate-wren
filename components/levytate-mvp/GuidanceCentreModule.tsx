"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, BriefcaseBusiness, CircleHelp, ExternalLink, GraduationCap, Lightbulb, ShieldCheck } from "lucide-react";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { MvpModal, MvpPanel, StatusBadge, TableAction, TableBody, TableHead, TableShell } from "@/components/levytate-mvp/MvpUi";
import {
  guidanceAuthorityLevels,
  guidanceCategories,
  guidanceReviewStatuses,
  guidanceSourceStatuses,
  type GuidanceAuthorityLevel,
  type GuidanceCategory,
  type GuidanceReviewStatus,
  type GuidanceSource,
  type GuidanceSourceStatus,
} from "@/lib/levytate/guidance/source-registry";

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
  const { meta } = useMvpWorkspace();
  const isPlatformAdmin = meta?.userRole === "Platform Admin";

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

      <GuidanceSourceRegistry isPlatformAdmin={isPlatformAdmin} />
    </div>
  );
}

type RegistryPayload = {
  ok?: boolean;
  registry?: {
    sources: GuidanceSource[];
    source: "supabase" | "seed_fallback";
    warnings: string[];
    authorityBreakdown: Array<{ authorityLevel: GuidanceAuthorityLevel; count: number }>;
    categoryBreakdown: Array<{ category: GuidanceCategory; count: number }>;
  };
  message?: string;
};

function GuidanceSourceRegistry({ isPlatformAdmin }: { isPlatformAdmin: boolean }) {
  const [sources, setSources] = useState<GuidanceSource[]>([]);
  const [storageSource, setStorageSource] = useState<"supabase" | "seed_fallback">("seed_fallback");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [category, setCategory] = useState("All categories");
  const [authority, setAuthority] = useState("All authority levels");
  const [reviewStatus, setReviewStatus] = useState("All review statuses");
  const [fundingYear, setFundingYear] = useState("All funding years");
  const [editing, setEditing] = useState<GuidanceSource | null>(null);
  const [savingId, setSavingId] = useState("");

  async function loadSources() {
    try {
      const response = await fetch("/api/levytate-guidance-sources", { cache: "no-store" });
      const payload = (await response.json()) as RegistryPayload;
      if (!response.ok || !payload.registry) {
        setWarnings([payload.message ?? "Trusted source registry is unavailable."]);
        return;
      }
      setSources(payload.registry.sources);
      setStorageSource(payload.registry.source);
      setWarnings(payload.registry.warnings);
    } catch {
      setWarnings(["Trusted source registry is unavailable."]);
    }
  }

  useEffect(() => {
    void loadSources();
  }, []);

  async function patchSource(id: string, patch: { reviewStatus?: GuidanceReviewStatus; sourceStatus?: GuidanceSourceStatus; copilotApproved?: boolean; notes?: string; lastChangeSummary?: string; monitoringNotes?: string }) {
    if (!isPlatformAdmin) return;
    setSavingId(id);
    try {
      const response = await fetch("/api/levytate-guidance-sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, patch }),
      });
      const payload = (await response.json()) as RegistryPayload;
      if (!response.ok || !payload.registry) {
        setWarnings([payload.message ?? "Trusted source could not be updated."]);
        return;
      }
      setSources(payload.registry.sources);
      setStorageSource(payload.registry.source);
      setWarnings(payload.registry.warnings);
      setEditing(null);
    } catch {
      setWarnings(["Trusted source could not be updated."]);
    } finally {
      setSavingId("");
    }
  }

  const fundingYears = useMemo(() => {
    return ["All funding years", ...Array.from(new Set(sources.map((source) => source.fundingYear).filter((item): item is string => Boolean(item)))).sort()];
  }, [sources]);

  const filteredSources = sources.filter((source) => {
    if (category !== "All categories" && !source.guidanceCategories.includes(category as GuidanceCategory)) return false;
    if (authority !== "All authority levels" && source.authorityLevel !== authority) return false;
    if (reviewStatus !== "All review statuses" && source.reviewStatus !== reviewStatus) return false;
    if (fundingYear !== "All funding years" && source.fundingYear !== fundingYear) return false;
    return true;
  });

  const approvedForCopilot = sources.filter((source) => source.sourceStatus === "Active" && source.reviewStatus === "Approved" && source.copilotApproved).length;
  const reviewRequired = sources.filter((source) => source.reviewStatus === "Review required" || source.sourceStatus === "Changed").length;

  return (
    <MvpPanel
      title="Trusted Source Registry"
      eyebrow="Guidance governance"
      actions={<StatusBadge tone={storageSource === "supabase" ? "green" : "yellow"}>{storageSource === "supabase" ? "Supabase source" : "Seed fallback"}</StatusBadge>}
    >
      <div className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Summary label="Sources" value={sources.length} copy="Official records registered" />
          <Summary label="Copilot safe" value={approvedForCopilot} copy="Active, approved and current" />
          <Summary label="Review queue" value={reviewRequired} copy="Require LevyTate review" />
          <Summary label="Write access" value={isPlatformAdmin ? "Admin" : "Read only"} copy="Platform Admin controls" />
        </div>

        <div className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <FilterSelect label="Category" value={category} options={["All categories", ...guidanceCategories]} onChange={setCategory} />
            <FilterSelect label="Authority" value={authority} options={["All authority levels", ...guidanceAuthorityLevels]} onChange={setAuthority} />
            <FilterSelect label="Review" value={reviewStatus} options={["All review statuses", ...guidanceReviewStatuses]} onChange={setReviewStatus} />
            <FilterSelect label="Funding year" value={fundingYear} options={fundingYears} onChange={setFundingYear} />
          </div>
          {warnings.length ? (
            <div className="mt-3 rounded-lg bg-[#fff7cf] px-3 py-2 text-xs font-semibold text-[#756000]">
              {warnings.join(" ")}
            </div>
          ) : null}
        </div>

        <TableShell>
          <TableHead>
            <tr>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Authority</th>
              <th className="px-4 py-3">Categories</th>
              <th className="px-4 py-3">Review</th>
              <th className="px-4 py-3">Copilot</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </TableHead>
          <TableBody>
            {filteredSources.map((source) => (
              <tr key={source.id} className="align-top">
                <td className="px-4 py-4">
                  <p className="font-semibold text-[#102c3d]">{source.title}</p>
                  <p className="mt-1 text-xs leading-5 text-[#102c3d]/52">{source.publisher} · {source.sourceType}</p>
                  {source.fundingYear ? <p className="mt-1 text-xs font-semibold text-[#0b8e82]">{source.fundingYear}</p> : null}
                </td>
                <td className="px-4 py-4 text-xs font-semibold text-[#102c3d]/64">{source.authorityLevel}</td>
                <td className="px-4 py-4">
                  <div className="flex max-w-xs flex-wrap gap-1.5">
                    {source.guidanceCategories.map((item) => <span key={item} className="rounded-full bg-[#f5f7f3] px-2 py-1 text-[10px] font-semibold text-[#102c3d]/58">{item}</span>)}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge tone={source.reviewStatus === "Approved" ? "green" : source.reviewStatus === "Review required" ? "yellow" : source.reviewStatus === "Archived" || source.reviewStatus === "Superseded" ? "red" : "neutral"}>{source.reviewStatus}</StatusBadge>
                  <p className="mt-2 text-xs text-[#102c3d]/48">{source.sourceStatus}</p>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge tone={source.copilotApproved ? "green" : "neutral"}>{source.copilotApproved ? "Approved" : "Blocked"}</StatusBadge>
                </td>
                <td className="px-4 py-4 text-xs leading-5 text-[#102c3d]/54">
                  <p>Checked: {formatDate(source.lastCheckedAt)}</p>
                  <p>Reviewed: {formatDate(source.lastReviewedAt)}</p>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-2">
                    <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-[#f5f7f3] px-3 py-1.5 text-xs font-semibold text-[#102c3d]/68 ring-1 ring-[#102c3d]/[0.07] transition hover:text-[#102c3d]">
                      <ExternalLink size={12} /> Open
                    </a>
                    {isPlatformAdmin ? (
                      <>
                        <TableAction onClick={() => setEditing(source)}>Edit</TableAction>
                        <TableAction onClick={() => patchSource(source.id, { reviewStatus: "Approved", copilotApproved: true })}>{savingId === source.id ? "Saving..." : "Mark reviewed"}</TableAction>
                        <TableAction onClick={() => patchSource(source.id, { reviewStatus: "Superseded", sourceStatus: "Superseded", copilotApproved: false })}>Supersede</TableAction>
                        <TableAction danger onClick={() => patchSource(source.id, { reviewStatus: "Archived", sourceStatus: "Archived", copilotApproved: false })}>Archive</TableAction>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </TableBody>
        </TableShell>

        <div className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[#edf7f3] text-[#0b8e82]"><ShieldCheck size={18} /></div>
            <div>
              <p className="text-sm font-semibold text-[#102c3d]">Copilot safety rule</p>
              <p className="mt-1 text-sm leading-6 text-[#102c3d]/58">
                LevyTate Copilot may only draw from sources that are Active, Approved, Copilot approved, in date for the relevant funding year or start date, and not superseded. If that test fails, the assistant must route the topic for apprenticeship lead or LevyTate adviser review.
              </p>
            </div>
          </div>
        </div>
      </div>

      {editing ? (
        <GuidanceSourceEditModal
          source={editing}
          saving={savingId === editing.id}
          onClose={() => setEditing(null)}
          onSave={(patch) => patchSource(editing.id, patch)}
        />
      ) : null}
    </MvpPanel>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/58">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-medium text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function GuidanceSourceEditModal({ source, saving, onClose, onSave }: { source: GuidanceSource; saving: boolean; onClose: () => void; onSave: (patch: { reviewStatus: GuidanceReviewStatus; sourceStatus: GuidanceSourceStatus; copilotApproved: boolean; notes: string; lastChangeSummary: string; monitoringNotes: string }) => void }) {
  const [reviewStatus, setReviewStatus] = useState<GuidanceReviewStatus>(source.reviewStatus);
  const [sourceStatus, setSourceStatus] = useState<GuidanceSourceStatus>(source.sourceStatus);
  const [copilotApproved, setCopilotApproved] = useState(source.copilotApproved);
  const [notes, setNotes] = useState(source.notes ?? "");
  const [lastChangeSummary, setLastChangeSummary] = useState(source.lastChangeSummary ?? "");
  const [monitoringNotes, setMonitoringNotes] = useState(source.monitoringNotes ?? "");

  return (
    <MvpModal title={source.title} eyebrow="Edit trusted source metadata" onClose={onClose} wide>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ reviewStatus, sourceStatus, copilotApproved, notes, lastChangeSummary, monitoringNotes });
        }}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <FilterSelect label="Review status" value={reviewStatus} options={guidanceReviewStatuses} onChange={(value) => setReviewStatus(value as GuidanceReviewStatus)} />
          <FilterSelect label="Source status" value={sourceStatus} options={guidanceSourceStatuses} onChange={(value) => setSourceStatus(value as GuidanceSourceStatus)} />
          <label className="flex items-center gap-3 self-end rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 py-2.5 text-xs font-semibold text-[#102c3d]/62">
            <input type="checkbox" checked={copilotApproved} onChange={(event) => setCopilotApproved(event.target.checked)} className="h-4 w-4 accent-[#159b8f]" />
            Copilot approved
          </label>
        </div>
        <TextArea label="Review notes" value={notes} onChange={setNotes} />
        <TextArea label="Last change summary" value={lastChangeSummary} onChange={setLastChangeSummary} />
        <TextArea label="Monitoring notes" value={monitoringNotes} onChange={setMonitoringNotes} />
        <div className="flex justify-end gap-2 border-t border-[#102c3d]/[0.07] pt-4">
          <button type="button" onClick={onClose} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.1]">Cancel</button>
          <button type="submit" className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white">{saving ? "Saving..." : "Save metadata"}</button>
        </div>
      </form>
    </MvpModal>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/58">
      {label}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="min-w-0 resize-y rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 py-2.5 text-sm font-medium leading-6 text-[#102c3d] outline-none transition focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10" />
    </label>
  );
}

function formatDate(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
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
