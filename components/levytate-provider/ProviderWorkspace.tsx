"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileCheck2,
  Inbox,
  LayoutList,
  LogOut,
  MessageSquareText,
  Send,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { LevyTateLogo } from "@/components/levytate-demo/PlatformShell";
import type {
  ProviderOpportunityView,
  ProviderRequestAction,
  ProviderRequestsWorkspaceBootstrap,
} from "@/lib/levytate/requests/api";
import type { ProviderResponseContent } from "@/lib/levytate/requests/domain";

export type ProviderOpportunityBucket = "open" | "responded" | "closed";
export type ProviderResponseStatus = "not_started" | "draft" | "submitted" | "declined";

export type ProviderProgrammeOption = {
  id: string;
  title: string;
  reference?: string | null;
};

export type ProviderClarification = {
  id: string;
  askedBy: "provider" | "employer";
  visibility: "provider_specific" | "shared_with_invited_providers";
  question?: string | null;
  answer?: string | null;
  askedAt: string;
  answeredAt?: string | null;
};

export type ProviderResponse = {
  status: ProviderResponseStatus;
  requestVersion: number;
  responseVersion?: number | null;
  proposedProgrammeId?: string | null;
  proposedProgrammeLabel?: string | null;
  alternativeProgramme?: string | null;
  whyFit?: string | null;
  earliestStart?: string | null;
  deliveryModels?: string[];
  deliveryNotes?: string | null;
  capacityKind?: ProviderResponseContent["cohortCapacity"]["kind"];
  capacityValue?: number | null;
  capacityNotes?: string | null;
  workplaceRequirements?: string | null;
  learningCommitment?: string | null;
  employerReportingSupport?: string | null;
  proposedPrice?: string | null;
  priceAssumptions?: string | null;
  additionalCosts?: string | null;
  relevantEvidence?: string | null;
  exceptions?: string | null;
  declinedReason?: string | null;
  declinedNote?: string | null;
  updatedAt?: string | null;
  submittedAt?: string | null;
  canRevise?: boolean;
};

export type ProviderOpportunity = {
  id: string;
  title: string;
  employerName: string;
  bucket: ProviderOpportunityBucket;
  invitationStatus: string;
  requestMode: "programme_led" | "need_led";
  requestVersion: number;
  publishedAt: string;
  responseDeadline: string;
  readiness: string;
  learnerVolume: string;
  preferredStart: string;
  deliveryPreference: string;
  locations: string[];
  teams?: string[];
  targetRoles?: string[];
  learnerAudience?: string | null;
  requirement: string;
  businessOutcome?: string | null;
  workplaceRequirements?: string | null;
  accessibilityConsiderations?: string | null;
  procurementRequirements?: string | null;
  additionalNotes?: string | null;
  programmeContext?: string | null;
  providersShouldAddress: string[];
  programmeOptions: ProviderProgrammeOption[];
  clarifications: ProviderClarification[];
  response?: ProviderResponse | null;
};

export type ProviderWorkspaceData = {
  requestsEnabled: boolean;
  provider: {
    name: string;
    memberRole: "Provider Admin" | "Provider User";
  };
  opportunities: ProviderOpportunity[];
  activity: {
    opportunitiesReceived: number;
    responsesSubmitted: number;
    shortlisted: number;
    progressedToAgreement: number;
    declined: number;
  };
};

type WorkspaceSection = ProviderOpportunityBucket | "activity";

const responseFields = [
  ["whyFit", "Why this fits"],
  ["earliestStart", "Earliest available start"],
  ["workplaceRequirements", "Workplace requirements"],
  ["learningCommitment", "Learning commitment"],
  ["employerReportingSupport", "Employer reporting and support"],
  ["proposedPrice", "Proposed training / assessment price (£)"],
  ["priceAssumptions", "Price basis and assumptions"],
  ["additionalCosts", "Additional commercial costs"],
  ["relevantEvidence", "Relevant evidence"],
  ["exceptions", "Exceptions or points to clarify"],
] as const;

const declineReasons = [
  { value: "not_a_programme_we_deliver", label: "Not a programme we deliver" },
  { value: "no_capacity_in_required_timeframe", label: "No capacity in required timeframe" },
  { value: "location_or_delivery_requirements", label: "Location/delivery requirements" },
  { value: "cohort_size", label: "Cohort size" },
  { value: "commercial_fit", label: "Commercial fit" },
  { value: "other", label: "Other" },
] as const;

export function ProviderWorkspace({ initialWorkspace }: { initialWorkspace: ProviderRequestsWorkspaceBootstrap }) {
  const [workspace, setWorkspace] = useState(() => normaliseProviderWorkspace(initialWorkspace));
  const [section, setSection] = useState<WorkspaceSection>("open");
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);

  useEffect(() => {
    const revalidateRestoredPage = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", revalidateRestoredPage);
    return () => window.removeEventListener("pageshow", revalidateRestoredPage);
  }, []);

  const selectedOpportunity = workspace.opportunities.find(
    (opportunity) => opportunity.id === selectedOpportunityId,
  );
  const sectionOpportunities = useMemo(
    () => workspace.opportunities.filter((opportunity) => opportunity.bucket === section),
    [section, workspace.opportunities],
  );

  function changeSection(next: WorkspaceSection) {
    setSection(next);
    setSelectedOpportunityId(null);
  }

  function updateOpportunity(next: ProviderOpportunity) {
    setWorkspace((current) => ({
      ...current,
      opportunities: current.opportunities.map((opportunity) =>
        opportunity.id === next.id ? next : opportunity,
      ),
    }));
  }

  function openOpportunity(id: string) {
    setSelectedOpportunityId(id);
    const opportunity = workspace.opportunities.find((item) => item.id === id);
    if (!opportunity || !["sent", "pending delivery"].includes(opportunity.invitationStatus.toLowerCase())) return;
    void providerMutation({
      action: "mark_viewed",
      invitationId: id,
      idempotencyKey: crypto.randomUUID(),
    }).then((result) => updateOpportunity(result.opportunity)).catch(() => undefined);
  }

  return (
    <main data-testid="provider-workspace" className="min-h-screen overflow-x-hidden bg-[#f4f7f5] text-[#102c3d]">
      <div className="grid min-h-screen lg:grid-cols-[244px_minmax(0,1fr)]">
        <ProviderSidebar
          providerName={workspace.provider.name}
          memberRole={workspace.provider.memberRole}
          section={section}
          onSectionChange={changeSection}
          opportunities={workspace.opportunities}
        />

        <div className="min-w-0">
          <ProviderTopBar
            providerName={workspace.provider.name}
            memberRole={workspace.provider.memberRole}
          />
          <MobileNavigation
            section={section}
            opportunities={workspace.opportunities}
            onSectionChange={changeSection}
          />

          <div className="mx-auto w-full max-w-[1320px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
            {section === "activity" ? (
              <ActivityPanel activity={workspace.activity} />
            ) : selectedOpportunity ? (
              <OpportunityDetail
                key={selectedOpportunity.id}
                opportunity={selectedOpportunity}
                onBack={() => setSelectedOpportunityId(null)}
                onUpdate={updateOpportunity}
              />
            ) : (
              <OpportunityList
                section={section}
                opportunities={sectionOpportunities}
                onSelect={openOpportunity}
              />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function ProviderSidebar({
  providerName,
  memberRole,
  section,
  opportunities,
  onSectionChange,
}: {
  providerName: string;
  memberRole: string;
  section: WorkspaceSection;
  opportunities: ProviderOpportunity[];
  onSectionChange: (section: WorkspaceSection) => void;
}) {
  return (
    <aside className="hidden border-r border-[#102c3d]/[0.08] bg-white px-4 py-5 lg:flex lg:h-screen lg:flex-col">
      <LevyTateLogo className="px-2 [--levytate-logo-size:2.55rem]" />
      <div className="mt-5 rounded-xl border border-[#102c3d]/[0.07] bg-[#f7faf8] px-4 py-3">
        <p className="truncate text-sm font-semibold">{providerName}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#087c73]">
          {memberRole}
        </p>
      </div>

      <nav aria-label="Provider workspace" className="mt-6 flex-1">
        <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#102c3d]/35">
          Opportunities
        </p>
        <div className="mt-2 grid gap-1">
          {(["open", "responded", "closed"] as const).map((item) => (
            <NavButton
              key={item}
              active={section === item}
              label={titleCase(item)}
              count={opportunities.filter((opportunity) => opportunity.bucket === item).length}
              onClick={() => onSectionChange(item)}
            />
          ))}
        </div>
        <p className="mt-6 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#102c3d]/35">
          Insight
        </p>
        <div className="mt-2">
          <NavButton
            active={section === "activity"}
            label="Activity"
            onClick={() => onSectionChange("activity")}
          />
        </div>
      </nav>

      <div className="border-t border-[#102c3d]/[0.07] pt-4">
        <form action="/api/levytate-provider/logout" method="post">
          <button className="min-h-11 w-full rounded-full bg-[#f4f7f5] px-4 text-xs font-semibold text-[#102c3d]/65 transition hover:bg-[#edf4f0] hover:text-[#102c3d] focus:outline-none focus:ring-4 focus:ring-[#159b8f]/15">
            Sign out
          </button>
        </form>
        <Link href="/levytate/support" className="mt-2 flex min-h-11 items-center justify-center text-xs font-semibold text-[#102c3d]/48 hover:text-[#087c73]">
          Provider support
        </Link>
      </div>
    </aside>
  );
}

function NavButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-semibold transition focus:outline-none focus:ring-4 focus:ring-[#159b8f]/15 ${
        active
          ? "bg-[#eaf5f1] text-[#102c3d] shadow-[inset_3px_0_0_#159b8f]"
          : "text-[#102c3d]/56 hover:bg-[#f7faf8] hover:text-[#102c3d]"
      }`}
    >
      <span>{label}</span>
      {typeof count === "number" ? (
        <span className="grid min-w-6 place-items-center rounded-full bg-white px-1.5 py-1 text-[10px] text-[#102c3d]/55 ring-1 ring-[#102c3d]/[0.07]">
          {count}
        </span>
      ) : null}
    </button>
  );
}

function ProviderTopBar({ providerName, memberRole }: { providerName: string; memberRole: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#102c3d]/[0.07] bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-11 max-w-[1320px] items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 lg:hidden">
          <LevyTateLogo className="[--levytate-logo-size:2.1rem]" />
          <span className="h-7 w-px bg-[#102c3d]/10" />
          <p className="truncate text-xs font-semibold">{providerName}</p>
        </div>
        <div className="hidden lg:block">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#087c73]">
            Provider workspace
          </p>
          <p className="mt-0.5 text-sm font-semibold">Employer opportunities</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-[#f4f7f5] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/52">
            {memberRole}
          </span>
          <form action="/api/levytate-provider/logout" method="post" className="lg:hidden">
            <button type="submit" aria-label="Sign out of provider workspace" title="Sign out" className="grid h-11 w-11 place-items-center rounded-full bg-[#f4f7f5] text-[#102c3d]/65 transition hover:bg-[#edf4f0] hover:text-[#102c3d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#159b8f]/15">
              <LogOut size={17} aria-hidden="true" />
              <span className="sr-only">Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

function MobileNavigation({
  section,
  opportunities,
  onSectionChange,
}: {
  section: WorkspaceSection;
  opportunities: ProviderOpportunity[];
  onSectionChange: (section: WorkspaceSection) => void;
}) {
  return (
    <nav aria-label="Provider workspace" className="border-b border-[#102c3d]/[0.07] bg-white px-4 py-2 lg:hidden">
      <div className="flex max-w-full gap-1 overflow-x-auto">
        {(["open", "responded", "closed", "activity"] as const).map((item) => {
          const count = item === "activity" ? null : opportunities.filter((opportunity) => opportunity.bucket === item).length;
          return (
            <button
              key={item}
              type="button"
              aria-current={section === item ? "page" : undefined}
              onClick={() => onSectionChange(item)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-[#159b8f]/15 ${section === item ? "bg-[#102c3d] text-white" : "text-[#102c3d]/55"}`}
            >
              {titleCase(item)}{count === null ? "" : ` · ${count}`}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function OpportunityList({
  section,
  opportunities,
  onSelect,
}: {
  section: Exclude<WorkspaceSection, "activity">;
  opportunities: ProviderOpportunity[];
  onSelect: (id: string) => void;
}) {
  return (
    <section data-testid="provider-opportunity-list" aria-labelledby="opportunity-list-heading">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">
            Opportunities
          </p>
          <h1 id="opportunity-list-heading" className="mt-1 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
            {titleCase(section)}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#102c3d]/58">
            {section === "open"
              ? "Review employer-approved briefs and respond before their deadline."
              : section === "responded"
                ? "Submitted responses and opportunities now in employer review."
                : "Completed, declined, cancelled or expired opportunities."}
          </p>
        </div>
        <p className="text-xs font-semibold text-[#102c3d]/45">
          {opportunities.length} {opportunities.length === 1 ? "opportunity" : "opportunities"}
        </p>
      </header>

      {opportunities.length === 0 ? (
        <div className="mt-5 grid min-h-64 place-items-center rounded-2xl border border-dashed border-[#102c3d]/[0.13] bg-white px-6 text-center">
          <div className="max-w-sm">
            <Inbox className="mx-auto text-[#159b8f]" size={28} strokeWidth={1.7} aria-hidden="true" />
            <h2 className="mt-4 text-base font-semibold">No {section} opportunities</h2>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/55">
              Employer invitations that are available to this provider will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.id} opportunity={opportunity} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  );
}

function OpportunityCard({ opportunity, onSelect }: { opportunity: ProviderOpportunity; onSelect: (id: string) => void }) {
  return (
    <article className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-4 shadow-[0_10px_28px_rgba(16,44,61,0.04)] transition hover:border-[#159b8f]/25 sm:p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={opportunity.invitationStatus} />
            <span className="text-[11px] font-semibold text-[#102c3d]/42">Brief v{opportunity.requestVersion}</span>
          </div>
          <h2 className="mt-3 text-lg font-semibold tracking-[-0.01em]">{opportunity.title}</h2>
          <p className="mt-1 text-sm font-medium text-[#102c3d]/56">{opportunity.employerName}</p>
          <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
            <CardFact label="Learners" value={opportunity.learnerVolume} />
            <CardFact label="Preferred start" value={opportunity.preferredStart} />
            <CardFact label="Readiness" value={opportunity.readiness} />
            <CardFact label="Response deadline" value={formatDate(opportunity.responseDeadline)} />
          </dl>
        </div>
        <button
          type="button"
          onClick={() => onSelect(opportunity.id)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white transition hover:bg-[#17394d] focus:outline-none focus:ring-4 focus:ring-[#159b8f]/20"
        >
          View opportunity <ChevronRight size={15} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

function CardFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold uppercase tracking-[0.1em] text-[#102c3d]/34">{label}</dt>
      <dd className="mt-1 leading-5 text-[#102c3d]/66">{value}</dd>
    </div>
  );
}

function OpportunityDetail({
  opportunity,
  onBack,
  onUpdate,
}: {
  opportunity: ProviderOpportunity;
  onBack: () => void;
  onUpdate: (opportunity: ProviderOpportunity) => void;
}) {
  return (
    <div data-testid="provider-opportunity-detail" className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0 space-y-5">
        <section className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_10px_28px_rgba(16,44,61,0.04)] sm:p-6">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#087c73] focus:outline-none focus:ring-4 focus:ring-[#159b8f]/15"
          >
            <ArrowLeft size={15} aria-hidden="true" /> Back to opportunities
          </button>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusPill status={opportunity.invitationStatus} />
            <span className="rounded-lg bg-[#f4f7f5] px-2.5 py-1 text-[11px] font-semibold text-[#102c3d]/55">
              Brief version {opportunity.requestVersion}
            </span>
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">{opportunity.title}</h1>
          <p className="mt-2 text-sm font-semibold text-[#102c3d]/55">{opportunity.employerName}</p>
          <div className="mt-5 grid gap-3 rounded-xl bg-[#f7faf8] p-4 sm:grid-cols-3">
            <IconFact icon={<FileCheck2 size={16} />} label="Published" value={formatDate(opportunity.publishedAt)} />
            <IconFact icon={<CalendarDays size={16} />} label="Response deadline" value={formatDate(opportunity.responseDeadline)} />
            <IconFact icon={<Clock3 size={16} />} label="Readiness" value={opportunity.readiness} />
          </div>
          <p className="mt-4 rounded-xl border border-[#d9a72d]/20 bg-[#fff9e7] px-4 py-3 text-xs leading-5 text-[#6c551f]">
            This is an invitation to respond and is not a contract award or funding commitment.
          </p>
        </section>

        <BriefPanel opportunity={opportunity} />
        <ClarificationsPanel opportunity={opportunity} onUpdate={onUpdate} />
      </div>

      <ResponsePanel opportunity={opportunity} onUpdate={onUpdate} />
    </div>
  );
}

function BriefPanel({ opportunity }: { opportunity: ProviderOpportunity }) {
  const optionalFacts = [
    ["Teams", opportunity.teams?.join(", ")],
    ["Target roles", opportunity.targetRoles?.join(", ")],
    ["Learner group", opportunity.learnerAudience],
    ["Business outcome", opportunity.businessOutcome],
    ["Programme context", opportunity.programmeContext],
    ["Workplace requirements", opportunity.workplaceRequirements],
    ["Accessibility / delivery considerations", opportunity.accessibilityConsiderations],
    ["Procurement requirements", opportunity.procurementRequirements],
    ["Additional information", opportunity.additionalNotes],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <section aria-labelledby="approved-brief-heading" className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_10px_28px_rgba(16,44,61,0.04)] sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Employer-approved brief</p>
      <h2 id="approved-brief-heading" className="mt-1 text-xl font-semibold">What the employer needs</h2>
      <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
        <BriefFact label="Requirement" value={opportunity.requirement} wide />
        <BriefFact label="Request type" value={opportunity.requestMode === "programme_led" ? "Programme-led" : "Need-led"} />
        <BriefFact label="Approximate learners" value={opportunity.learnerVolume} />
        <BriefFact label="Preferred start" value={opportunity.preferredStart} />
        <BriefFact label="Delivery preference" value={opportunity.deliveryPreference} />
        <BriefFact label="Locations" value={opportunity.locations.join(", ")} />
        {optionalFacts.map(([label, value]) => (
          <BriefFact key={label} label={label} value={value} wide={label.length > 25} />
        ))}
      </dl>
      {opportunity.providersShouldAddress.length ? (
        <div className="mt-6 border-t border-[#102c3d]/[0.07] pt-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">Providers should address</h3>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-[#102c3d]/68 sm:grid-cols-2">
            {opportunity.providersShouldAddress.map((item) => (
              <li key={item} className="flex gap-2"><Check size={15} className="mt-1 shrink-0 text-[#159b8f]" aria-hidden="true" /><span>{item}</span></li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function BriefFact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">{label}</dt>
      <dd className="mt-1.5 text-sm leading-6 text-[#102c3d]/70">{value}</dd>
    </div>
  );
}

function ClarificationsPanel({ opportunity, onUpdate }: { opportunity: ProviderOpportunity; onUpdate: (opportunity: ProviderOpportunity) => void }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canAsk = opportunity.bucket === "open" && opportunity.response?.status !== "declined";

  async function askQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await providerMutation({
        action: "ask_clarification",
        invitationId: opportunity.id,
        question: question.trim(),
        idempotencyKey: crypto.randomUUID(),
      });
      onUpdate(result.opportunity);
      setQuestion("");
      setMessage("Question sent to the employer.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="clarifications-heading" className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_10px_28px_rgba(16,44,61,0.04)] sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#eef9f5] text-[#087c73]">
          <MessageSquareText size={17} aria-hidden="true" />
        </span>
        <div>
          <h2 id="clarifications-heading" className="text-lg font-semibold">Clarifications</h2>
          <p className="mt-1 text-xs leading-5 text-[#102c3d]/52">
            Shared employer clarifications do not identify which provider asked the original question.
          </p>
        </div>
      </div>

      {opportunity.clarifications.length ? (
        <div className="mt-5 grid gap-3">
          {opportunity.clarifications.map((item) => <ProviderClarificationCard key={item.id} item={item} opportunity={opportunity} onUpdate={onUpdate} />)}
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-[#f8fbfa] px-4 py-3 text-sm text-[#102c3d]/52">No clarifications yet.</p>
      )}

      {canAsk ? (
        <form onSubmit={askQuestion} className="mt-5 border-t border-[#102c3d]/[0.07] pt-5">
          <label className="grid gap-2 text-xs font-semibold text-[#102c3d]/60">
            Ask a concise question
            <textarea
              required
              rows={3}
              maxLength={600}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="min-w-0 resize-y rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 py-2.5 text-sm font-medium leading-6 text-[#102c3d] outline-none focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10"
              placeholder="What would help you prepare an accurate response?"
            />
          </label>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <ResponseMessage error={error} message={message} />
            <button disabled={busy} className="min-h-11 rounded-full bg-[#f0f6f3] px-4 text-xs font-semibold text-[#087c73] ring-1 ring-[#087c73]/10 focus:outline-none focus:ring-4 focus:ring-[#159b8f]/15 disabled:opacity-60">
              {busy ? "Sending question" : "Ask clarification"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function ProviderClarificationCard({ item, opportunity, onUpdate }: { item: ProviderClarification; opportunity: ProviderOpportunity; onUpdate: (opportunity: ProviderOpportunity) => void }) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const employerQuestion = item.askedBy === "employer";
  async function submitAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim()) return;
    setBusy(true);
    setError("");
    try {
      const result = await providerMutation({ action: "answer_clarification", invitationId: opportunity.id, clarificationId: item.id, answer: answer.trim(), idempotencyKey: crypto.randomUUID() });
      onUpdate(result.opportunity);
      setAnswer("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
  return <article className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
    <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#087c73]">{employerQuestion ? "Employer question" : item.visibility === "shared_with_invited_providers" ? "Employer clarification" : "Your question"}</p>
    {item.question ? <p className="mt-2 text-sm font-semibold leading-6">{item.question}</p> : null}
    {item.answer ? <p className="mt-2 text-sm leading-6 text-[#102c3d]/68">{item.answer}</p> : employerQuestion ? <form onSubmit={submitAnswer} className="mt-3 grid gap-2"><label className="text-xs font-semibold text-[#102c3d]/60">Your answer<textarea required rows={3} maxLength={1000} value={answer} onChange={(event) => setAnswer(event.target.value)} className="mt-2 w-full resize-y rounded-xl border border-[#102c3d]/[0.09] bg-white px-3 py-2.5 text-sm font-medium leading-6 outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" /></label>{error ? <p role="alert" className="text-xs font-semibold text-[#ad344e]">{error}</p> : null}<button disabled={busy} className="min-h-11 w-fit rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white disabled:opacity-60">{busy ? "Sending answer" : "Send answer"}</button></form> : <p className="mt-2 text-xs font-medium text-[#8a6418]">Awaiting employer response</p>}
  </article>;
}

type ResponseDraft = {
  proposedProgrammeId: string;
  alternativeProgramme: string;
  whyFit: string;
  earliestStart: string;
  deliveryModels: string[];
  deliveryNotes: string;
  capacityKind: ProviderResponseContent["cohortCapacity"]["kind"];
  capacityValue: string;
  capacityNotes: string;
  workplaceRequirements: string;
  learningCommitment: string;
  employerReportingSupport: string;
  proposedPrice: string;
  priceAssumptions: string;
  additionalCosts: string;
  relevantEvidence: string;
  exceptions: string;
};

function ResponsePanel({ opportunity, onUpdate }: { opportunity: ProviderOpportunity; onUpdate: (opportunity: ProviderOpportunity) => void }) {
  const response = opportunity.response;
  const [draft, setDraft] = useState<ResponseDraft>(() => responseDraft(response));
  const [confirmed, setConfirmed] = useState(false);
  const [busyAction, setBusyAction] = useState<"draft" | "submit" | "decline" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState<(typeof declineReasons)[number]["value"]>(declineReasons[0].value);
  const [declineNote, setDeclineNote] = useState("");
  const [todayUtc, setTodayUtc] = useState(utcDateOnly);

  useEffect(() => {
    const refreshToday = () => setTodayUtc(utcDateOnly());
    const timer = window.setInterval(refreshToday, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const deadlinePassed = opportunity.responseDeadline < todayUtc;
  const submitted = response?.status === "submitted";
  const declined = response?.status === "declined";
  const editable = !deadlinePassed && !declined && (
    (!submitted && opportunity.bucket === "open") || response?.canRevise === true
  );
  const selectionIsAlternative = draft.proposedProgrammeId === "alternative";

  function setField<K extends keyof ResponseDraft>(field: K, value: ResponseDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  async function mutate(action: ProviderRequestAction) {
    setBusyAction(action.action === "save_draft" ? "draft" : action.action === "decline" ? "decline" : "submit");
    setError("");
    setMessage("");
    try {
      const result = await providerMutation(action);
      onUpdate(result.opportunity);
      setMessage(action.action === "save_draft" ? "Draft saved." : action.action === "decline" ? "Opportunity declined." : "Response submitted.");
      if (action.action === "decline") setShowDecline(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusyAction(null);
    }
  }

  async function saveDraft() {
    await mutate({
      action: "save_draft",
      invitationId: opportunity.id,
      content: responsePayload(draft),
      idempotencyKey: crypto.randomUUID(),
    });
  }

  async function submitResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateResponseDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!confirmed) {
      setError("Confirm the response is accurate before submitting.");
      return;
    }
    await mutate({
      action: "submit_response",
      invitationId: opportunity.id,
      content: responsePayload(draft),
      idempotencyKey: crypto.randomUUID(),
    });
  }

  async function declineOpportunity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await mutate({
      action: "decline",
      invitationId: opportunity.id,
      reasonCategory: declineReason,
      note: declineNote.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
    });
  }

  if (declined) {
    return (
      <aside className="h-fit rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_10px_28px_rgba(16,44,61,0.04)] xl:sticky xl:top-24">
        <StatusPill status="Declined" />
        <h2 className="mt-4 text-lg font-semibold">Opportunity declined</h2>
        <p className="mt-2 text-sm leading-6 text-[#102c3d]/60">{response?.declinedReason ?? "Your response has been recorded."}</p>
        {response?.declinedNote ? <p className="mt-3 rounded-xl bg-[#f8fbfa] p-3 text-xs leading-5 text-[#102c3d]/58">{response.declinedNote}</p> : null}
      </aside>
    );
  }

  return (
    <aside className="h-fit min-w-0 rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_10px_28px_rgba(16,44,61,0.04)] xl:sticky xl:top-24" data-testid="provider-response-form">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#c95568]">Your response</p>
          <h2 className="mt-1 text-lg font-semibold">Structured proposal</h2>
        </div>
        <StatusPill status={responseStatusLabel(response)} />
      </div>

      {submitted ? (
        <p className="mt-4 rounded-xl bg-[#eef9f5] px-4 py-3 text-xs leading-5 text-[#0b6f63]">
          Submitted response version {response?.responseVersion ?? 1}, against brief version {response?.requestVersion ?? opportunity.requestVersion}.
          {response?.canRevise ? " A revised response is permitted." : " This version is read-only."}
        </p>
      ) : null}
      {response && response.requestVersion < opportunity.requestVersion ? (
        <p className="mt-3 rounded-xl bg-[#fff8e8] px-4 py-3 text-xs leading-5 text-[#7a5818]">
          Request updated to version {opportunity.requestVersion}. Review the current brief before responding.
        </p>
      ) : null}
      {deadlinePassed ? (
        <p className="mt-3 rounded-xl bg-[#fff4f5] px-4 py-3 text-xs font-semibold text-[#ad344e]">Response deadline passed.</p>
      ) : null}

      <form onSubmit={submitResponse} className="mt-5 grid gap-4">
        <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/60">
          Proposed programme
          <select
            required
            disabled={!editable}
            value={draft.proposedProgrammeId}
            onChange={(event) => setField("proposedProgrammeId", event.target.value)}
            className="h-11 min-w-0 rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-medium text-[#102c3d] outline-none focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <option value="">Select a programme</option>
            {opportunity.programmeOptions.map((programme) => (
              <option key={programme.id} value={programme.id}>{programme.title}{programme.reference ? ` · ${programme.reference}` : ""}</option>
            ))}
            <option value="alternative">Alternative / pathway to discuss</option>
          </select>
        </label>

        {selectionIsAlternative ? (
          <ResponseField
            label="Alternative / pathway"
            value={draft.alternativeProgramme}
            onChange={(value) => setField("alternativeProgramme", value)}
            disabled={!editable}
            required
          />
        ) : null}

        {responseFields.map(([field, label]) => (
          <ResponseField
            key={field}
            label={label}
            value={draft[field]}
            onChange={(value) => setField(field, value)}
            disabled={!editable}
            required={["whyFit", "earliestStart", "workplaceRequirements", "employerReportingSupport", "proposedPrice", "priceAssumptions"].includes(field)}
          />
        ))}

        <fieldset disabled={!editable} className="rounded-xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] p-3">
          <legend className="px-1 text-xs font-semibold text-[#102c3d]/60">Delivery approach</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {["Online", "Blended", "Face-to-face", "Flexible"].map((model) => (
              <label key={model} className="flex min-h-11 items-center gap-2 rounded-lg bg-white px-3 text-xs font-semibold text-[#102c3d]/65 ring-1 ring-[#102c3d]/[0.06]">
                <input
                  type="checkbox"
                  checked={draft.deliveryModels.includes(model)}
                  onChange={(event) => setField(
                    "deliveryModels",
                    event.target.checked
                      ? [...draft.deliveryModels, model]
                      : draft.deliveryModels.filter((value) => value !== model),
                  )}
                  className="h-4 w-4 accent-[#087c73]"
                />
                {model}
              </label>
            ))}
          </div>
          <label className="mt-3 grid gap-1.5 text-xs font-semibold text-[#102c3d]/60">
            Concise delivery notes
            <textarea rows={2} maxLength={900} value={draft.deliveryNotes} onChange={(event) => setField("deliveryNotes", event.target.value)} className="resize-y rounded-xl border border-[#102c3d]/[0.09] bg-white px-3 py-2.5 text-sm font-medium leading-6 outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" />
          </label>
        </fieldset>

        <fieldset disabled={!editable} className="rounded-xl border border-[#102c3d]/[0.08] bg-[#f8fbfa] p-3">
          <legend className="px-1 text-xs font-semibold text-[#102c3d]/60">Learner / cohort capacity</legend>
          <label className="mt-1 grid gap-1.5 text-xs font-semibold text-[#102c3d]/60">
            Capacity position
            <select value={draft.capacityKind} onChange={(event) => setField("capacityKind", event.target.value as ResponseDraft["capacityKind"])} className="h-11 rounded-xl border border-[#102c3d]/[0.09] bg-white px-3 text-sm">
              <option value="can_accommodate">Can accommodate requested cohort</option>
              <option value="minimum_required">Minimum cohort required</option>
              <option value="maximum_places">Maximum available places</option>
              <option value="requires_discussion">Requires discussion</option>
            </select>
          </label>
          {draft.capacityKind === "minimum_required" || draft.capacityKind === "maximum_places" ? (
            <label className="mt-3 grid gap-1.5 text-xs font-semibold text-[#102c3d]/60">
              Number of learners
              <input type="number" min="1" step="1" required value={draft.capacityValue} onChange={(event) => setField("capacityValue", event.target.value)} className="h-11 rounded-xl border border-[#102c3d]/[0.09] bg-white px-3 text-sm" />
            </label>
          ) : null}
          <label className="mt-3 grid gap-1.5 text-xs font-semibold text-[#102c3d]/60">
            Capacity notes
            <textarea rows={2} maxLength={900} value={draft.capacityNotes} onChange={(event) => setField("capacityNotes", event.target.value)} className="resize-y rounded-xl border border-[#102c3d]/[0.09] bg-white px-3 py-2.5 text-sm font-medium leading-6 outline-none focus:border-[#159b8f] focus:ring-4 focus:ring-[#159b8f]/10" />
          </label>
        </fieldset>

        {editable ? (
          <label className="flex gap-3 rounded-xl bg-[#f8fbfa] p-3 text-xs leading-5 text-[#102c3d]/62">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#087c73]"
            />
            <span>I confirm this response is accurate, authorised and does not contain invented capacity, price, availability or evidence.</span>
          </label>
        ) : null}

        <ResponseMessage error={error} message={message} />

        {editable ? (
          <div className="grid gap-2 border-t border-[#102c3d]/[0.07] pt-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={saveDraft}
              className="min-h-11 rounded-full bg-[#f0f6f3] px-4 text-xs font-semibold text-[#087c73] ring-1 ring-[#087c73]/10 focus:outline-none focus:ring-4 focus:ring-[#159b8f]/15 disabled:opacity-60"
            >
              {busyAction === "draft" ? "Saving draft" : "Save draft"}
            </button>
            <button
              disabled={busyAction !== null || !confirmed}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white focus:outline-none focus:ring-4 focus:ring-[#159b8f]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={14} aria-hidden="true" />
              {busyAction === "submit" ? "Submitting" : submitted ? "Submit revision" : "Submit response"}
            </button>
          </div>
        ) : null}
      </form>

      {editable ? (
        <div className="mt-4 border-t border-[#102c3d]/[0.07] pt-4">
          <button
            type="button"
            aria-expanded={showDecline}
            onClick={() => setShowDecline((current) => !current)}
            className="min-h-11 text-xs font-semibold text-[#ad344e] focus:outline-none focus:ring-4 focus:ring-[#ad344e]/10"
          >
            {showDecline ? "Keep opportunity open" : "Decline opportunity"}
          </button>
          {showDecline ? (
            <form onSubmit={declineOpportunity} className="mt-3 grid gap-3 rounded-xl bg-[#fff7f8] p-4">
              <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/60">
                Reason
                <select value={declineReason} onChange={(event) => setDeclineReason(event.target.value as (typeof declineReasons)[number]["value"])} className="h-11 rounded-xl border border-[#102c3d]/[0.09] bg-white px-3 text-sm">
                  {declineReasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/60">
                Optional note
                <textarea rows={2} maxLength={600} value={declineNote} onChange={(event) => setDeclineNote(event.target.value)} className="resize-y rounded-xl border border-[#102c3d]/[0.09] bg-white px-3 py-2.5 text-sm" />
              </label>
              <button disabled={busyAction !== null} className="min-h-11 rounded-full bg-[#ad344e] px-4 text-xs font-semibold text-white disabled:opacity-60">
                {busyAction === "decline" ? "Recording decline" : "Confirm decline"}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function ResponseField({ label, value, onChange, disabled, required = false }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#102c3d]/60">
      {label}{required ? <span className="sr-only"> (required)</span> : null}
      <textarea
        required={required}
        disabled={disabled}
        rows={label === "Why this fits" || label === "Relevant evidence" ? 4 : 3}
        maxLength={1800}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 resize-y rounded-xl border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 py-2.5 text-sm font-medium leading-6 text-[#102c3d] outline-none focus:border-[#159b8f] focus:bg-white focus:ring-4 focus:ring-[#159b8f]/10 disabled:cursor-not-allowed disabled:opacity-70"
      />
    </label>
  );
}

function ActivityPanel({ activity }: { activity: ProviderWorkspaceData["activity"] }) {
  const metrics = [
    ["Opportunities received", activity.opportunitiesReceived, Inbox],
    ["Responses submitted", activity.responsesSubmitted, FileCheck2],
    ["Shortlisted", activity.shortlisted, LayoutList],
    ["Progressed to agreement", activity.progressedToAgreement, Check],
    ["Declined", activity.declined, X],
  ] as const;

  return (
    <section data-testid="provider-activity" aria-labelledby="provider-activity-heading">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c95568]">Provider activity</p>
      <h1 id="provider-activity-heading" className="mt-1 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">Factual activity</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#102c3d]/58">
        A simple record of this provider’s LevyTate opportunity activity. These figures are not rankings, quality scores or revenue claims.
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(([label, value, Icon]) => (
          <article key={label} className="rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 shadow-[0_10px_28px_rgba(16,44,61,0.04)]">
            <Icon size={18} strokeWidth={1.8} className="text-[#159b8f]" aria-hidden="true" />
            <p className="mt-5 text-3xl font-semibold tracking-[-0.04em]">{value}</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#102c3d]/52">{label}</p>
          </article>
        ))}
      </div>
      <div className="mt-5 flex gap-3 rounded-2xl border border-[#102c3d]/[0.07] bg-white p-5 text-sm leading-6 text-[#102c3d]/58">
        <CircleHelp size={18} className="mt-0.5 shrink-0 text-[#087c73]" aria-hidden="true" />
        <p>Progressed opportunities represent continued commercial or operational discussion. They are not confirmed contracts or attributed revenue.</p>
      </div>
    </section>
  );
}

function IconFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 text-[#159b8f]" aria-hidden="true">{icon}</span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/36">{label}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-[#102c3d]/68">{value}</p>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalised = status.toLowerCase();
  const tone = normalised.includes("declin") || normalised.includes("cancel") || normalised.includes("expired")
    ? "bg-[#fff0f2] text-[#ad344e]"
    : normalised.includes("submit") || normalised.includes("progress") || normalised.includes("shortlist")
      ? "bg-[#e9f7f2] text-[#0b6f63]"
      : "bg-[#eef4f8] text-[#315e78]";

  return <span className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{titleCase(status)}</span>;
}

function ResponseMessage({ error, message }: { error: string; message: string }) {
  if (error) return <p role="alert" className="text-xs font-semibold leading-5 text-[#ad344e]">{error}</p>;
  if (message) return <p role="status" className="text-xs font-semibold leading-5 text-[#087c73]">{message}</p>;
  return <span />;
}

function responseDraft(response?: ProviderResponse | null): ResponseDraft {
  return {
    proposedProgrammeId: response?.proposedProgrammeId ?? (response?.alternativeProgramme ? "alternative" : ""),
    alternativeProgramme: response?.alternativeProgramme ?? "",
    whyFit: response?.whyFit ?? "",
    earliestStart: response?.earliestStart ?? "",
    deliveryModels: response?.deliveryModels ?? [],
    deliveryNotes: response?.deliveryNotes ?? "",
    capacityKind: response?.capacityKind ?? "requires_discussion",
    capacityValue: typeof response?.capacityValue === "number" ? String(response.capacityValue) : "",
    capacityNotes: response?.capacityNotes ?? "",
    workplaceRequirements: response?.workplaceRequirements ?? "",
    learningCommitment: response?.learningCommitment ?? "",
    employerReportingSupport: response?.employerReportingSupport ?? "",
    proposedPrice: response?.proposedPrice ?? "",
    priceAssumptions: response?.priceAssumptions ?? "",
    additionalCosts: response?.additionalCosts ?? "",
    relevantEvidence: response?.relevantEvidence ?? "",
    exceptions: response?.exceptions ?? "",
  };
}

function responsePayload(draft: ResponseDraft): ProviderResponseContent {
  return {
    proposedProgramme: draft.proposedProgrammeId === "alternative"
      ? { kind: "alternative_to_discuss", description: draft.alternativeProgramme.trim() }
      : { kind: "canonical_programme", programmeId: draft.proposedProgrammeId },
    whyThisFits: draft.whyFit.trim(),
    earliestAvailableStart: draft.earliestStart.trim(),
    deliveryApproach: {
      models: draft.deliveryModels,
      notes: draft.deliveryNotes.trim() || undefined,
    },
    cohortCapacity: {
      kind: draft.capacityKind,
      value: draft.capacityValue ? Number(draft.capacityValue) : undefined,
      notes: draft.capacityNotes.trim() || undefined,
    },
    workplaceRequirements: draft.workplaceRequirements.trim(),
    learningCommitment: draft.learningCommitment.trim() || undefined,
    employerReportingSupport: draft.employerReportingSupport.trim(),
    proposedTrainingAssessmentPricePence: poundsToPence(draft.proposedPrice),
    priceBasisAndAssumptions: draft.priceAssumptions.trim() || undefined,
    additionalCommercialCosts: draft.additionalCosts.trim() || undefined,
    relevantEvidence: draft.relevantEvidence.trim() || undefined,
    exceptionsOrClarifications: draft.exceptions.trim() || undefined,
  };
}

async function providerMutation(action: ProviderRequestAction) {
  const response = await fetch("/api/levytate-provider/opportunities", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(action),
  });
  const body = (await response.json().catch(() => null)) as
    | { opportunity?: ProviderOpportunityView; message?: string }
    | null;
  if (!response.ok || !body?.opportunity) {
    throw new Error(body?.message ?? "We couldn’t save this change. Please try again.");
  }
  return { opportunity: normaliseProviderOpportunity(body.opportunity) };
}

function responseStatusLabel(response?: ProviderResponse | null) {
  if (!response || response.status === "not_started") return "Not started";
  if (response.status === "draft") return "Draft";
  if (response.status === "submitted") return "Submitted";
  return "Declined";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "We couldn’t save this change. Please try again.";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function utcDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

function titleCase(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function normaliseProviderWorkspace(workspace: ProviderRequestsWorkspaceBootstrap): ProviderWorkspaceData {
  return {
    requestsEnabled: workspace.requestsEnabled,
    provider: {
      name: workspace.provider.name,
      memberRole: workspace.provider.membershipRole,
    },
    opportunities: workspace.opportunities.map(normaliseProviderOpportunity),
    activity: workspace.metrics,
  };
}

function normaliseProviderOpportunity(view: ProviderOpportunityView): ProviderOpportunity {
  const snapshot = view.requestVersion.publishedSnapshot;
  const responseContent = view.response?.draftContent;
  const declined = view.outcome === "declined";
  const response: ProviderResponse | null = declined
    ? {
        status: "declined",
        requestVersion: view.invitation.requestVersion,
        declinedReason: view.invitation.declineReasonCategory
          ? titleCase(view.invitation.declineReasonCategory)
          : "Opportunity declined",
        declinedNote: view.invitation.declineNote,
      }
    : view.response
      ? normaliseProviderResponse(view.response, responseContent, view.requestVersion.version)
      : null;

  return {
    id: view.invitation.id,
    title: view.requestTitle,
    employerName: view.employerName,
    bucket: opportunityBucket(view.outcome),
    invitationStatus: opportunityStatusLabel(view),
    requestMode: snapshot.requestMode,
    requestVersion: view.requestVersion.version,
    publishedAt: view.requestVersion.publishedAt,
    responseDeadline: view.invitation.deadline,
    readiness: readinessLabel(snapshot.readiness),
    learnerVolume: learnerVolumeLabel(snapshot.learnerVolume),
    preferredStart: preferredStartLabel(snapshot.preferredStart),
    deliveryPreference: snapshot.deliveryPreferences.length
      ? snapshot.deliveryPreferences.join(", ")
      : "Not confirmed",
    locations: workplaceLocationLabels(snapshot.workplaceLocation),
    teams: snapshot.optionalInformation.departments
      ? [...snapshot.optionalInformation.departments]
      : undefined,
    targetRoles: snapshot.optionalInformation.targetRoles
      ? [...snapshot.optionalInformation.targetRoles]
      : undefined,
    learnerAudience: snapshot.optionalInformation.workforceMix
      ? titleCase(snapshot.optionalInformation.workforceMix)
      : undefined,
    requirement: snapshot.requirement,
    businessOutcome: snapshot.optionalInformation.businessOutcome,
    workplaceRequirements: snapshot.optionalInformation.workplaceProjectRequirements,
    accessibilityConsiderations: snapshot.optionalInformation.accessibilityConsiderations,
    procurementRequirements: snapshot.optionalInformation.procurementRequirements,
    additionalNotes: snapshot.optionalInformation.additionalNotes,
    programmeContext: snapshot.programme?.title,
    providersShouldAddress: [...snapshot.providersShouldAddress],
    programmeOptions: view.proposedProgrammeOptions.map((programme) => ({
      id: programme.programmeId,
      title: programme.programmeName,
      reference: programme.level ? `Level ${programme.level}` : null,
    })),
    clarifications: view.clarifications.map((clarification) => ({
      id: clarification.id,
      askedBy: clarification.askedBy,
      visibility: clarification.visibility,
      question: clarification.question,
      answer: clarification.answer,
      askedAt: clarification.askedAt,
      answeredAt: clarification.answeredAt,
    })),
    response,
  };
}

function normaliseProviderResponse(
  response: NonNullable<ProviderOpportunityView["response"]>,
  content: ProviderResponseContent | undefined,
  currentRequestVersion: number,
): ProviderResponse {
  return {
    status: response.status,
    requestVersion: response.requestVersion,
    responseVersion: response.currentVersion,
    proposedProgrammeId: content?.proposedProgramme.kind === "canonical_programme"
      ? content.proposedProgramme.programmeId
      : null,
    alternativeProgramme: content?.proposedProgramme.kind === "alternative_to_discuss"
      ? content.proposedProgramme.description
      : null,
    whyFit: content?.whyThisFits,
    earliestStart: content?.earliestAvailableStart,
    deliveryModels: content ? [...content.deliveryApproach.models] : [],
    deliveryNotes: content?.deliveryApproach.notes,
    capacityKind: content?.cohortCapacity.kind,
    capacityValue: content?.cohortCapacity.value,
    capacityNotes: content?.cohortCapacity.notes,
    workplaceRequirements: content?.workplaceRequirements,
    learningCommitment: content?.learningCommitment,
    employerReportingSupport: content?.employerReportingSupport,
    proposedPrice: typeof content?.proposedTrainingAssessmentPricePence === "number"
      ? (content.proposedTrainingAssessmentPricePence / 100).toFixed(2)
      : null,
    priceAssumptions: content?.priceBasisAndAssumptions,
    additionalCosts: content?.additionalCommercialCosts,
    relevantEvidence: content?.relevantEvidence,
    exceptions: content?.exceptionsOrClarifications,
    updatedAt: response.updatedAt,
    submittedAt: response.submittedAt,
    canRevise: response.status === "submitted" && currentRequestVersion > response.requestVersion,
  };
}

function opportunityBucket(outcome: ProviderOpportunityView["outcome"]): ProviderOpportunityBucket {
  if (outcome === "open") return "open";
  if (["responded", "shortlisted", "progressed_to_agreement"].includes(outcome)) return "responded";
  return "closed";
}

function opportunityStatusLabel(view: ProviderOpportunityView) {
  if (view.outcome === "open" && view.response?.status === "draft") return "Draft response";
  if (view.outcome === "open") return titleCase(view.invitation.status);
  return titleCase(view.outcome);
}

function readinessLabel(value: ProviderOpportunityView["requestVersion"]["publishedSnapshot"]["readiness"]) {
  if (value === "exploring") return "Exploring options";
  if (value === "planning") return "Planning a cohort";
  return "Approved to proceed";
}

function learnerVolumeLabel(value: ProviderOpportunityView["requestVersion"]["publishedSnapshot"]["learnerVolume"]) {
  if (value.kind === "not_confirmed") return "Not confirmed";
  if (value.kind === "range") return `${value.minimum}–${value.maximum}`;
  return value.kind === "approximate" ? `Approx. ${value.count}` : String(value.count);
}

function preferredStartLabel(value: ProviderOpportunityView["requestVersion"]["publishedSnapshot"]["preferredStart"]) {
  if (value.kind === "month" || value.kind === "quarter") return value.value;
  return value.kind === "flexible" ? "Flexible" : "Not confirmed";
}

function workplaceLocationLabels(value: ProviderOpportunityView["requestVersion"]["publishedSnapshot"]["workplaceLocation"]) {
  if (value.kind === "sites") return [...value.labels];
  if (value.kind === "remote_or_distributed") return [value.label ?? "Remote / distributed workforce"];
  return ["Not confirmed"];
}

function poundsToPence(value: string) {
  const amount = Number(value.replace(/[£,\s]/g, ""));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : undefined;
}

function validateResponseDraft(draft: ResponseDraft) {
  if (!draft.proposedProgrammeId) return "Select a proposed programme or an alternative pathway.";
  if (draft.proposedProgrammeId === "alternative" && !draft.alternativeProgramme.trim()) return "Describe the alternative pathway.";
  if (!draft.whyFit.trim()) return "Explain why the proposal fits the requirement.";
  if (!draft.earliestStart.trim()) return "Add the earliest available start.";
  if (!draft.deliveryModels.length && !draft.deliveryNotes.trim()) return "Add a delivery model or concise delivery notes.";
  if ((draft.capacityKind === "minimum_required" || draft.capacityKind === "maximum_places") && (!Number.isInteger(Number(draft.capacityValue)) || Number(draft.capacityValue) < 1)) return "Add a valid learner capacity.";
  if (!draft.workplaceRequirements.trim()) return "Describe the workplace requirements.";
  if (!draft.employerReportingSupport.trim()) return "Describe employer reporting and support.";
  if (poundsToPence(draft.proposedPrice) === undefined) return "Add a valid proposed training and assessment price.";
  if (!draft.priceAssumptions.trim()) return "Add the price basis and assumptions.";
  return null;
}
