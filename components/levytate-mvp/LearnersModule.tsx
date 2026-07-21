"use client";

import { ArrowLeft, CalendarClock, CheckCircle2, ChevronDown, Plus, Search, XCircle } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { EmptyState, FormField, FormGrid, FormSection, FormSelect, FormTagInput, FormTextArea, MvpModal, MvpPanel, StatusBadge, TableAction, TableBody, TableHead, TableShell } from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { includesSearch, statusTone } from "@/components/levytate-mvp/module-utils";
import {
  assessmentConfirmationStatusLabels,
  assessmentConfirmationTypeLabels,
  assessmentConfirmationTypes,
  assessmentModelLabels,
  assessmentModelUsesGateway,
  emptyAssessmentReadinessConfirmations,
  type AssessmentConfirmationStatus,
  type AssessmentConfirmationType,
} from "@/lib/levytate/mvp/assessment-readiness";
import {
  formatProgressVariance,
  deriveProgressPositionFromVariance,
  operationalActionLabel,
  type LearnerListSummary,
  type LearnerOperationalSummary,
  type LearnerProgressPosition,
  type LearnerRecordDetail,
} from "@/lib/levytate/mvp/learner-record-view";
import {
  learnerProgressReviewPolicy,
  learnerBreakPolicy,
  learnerBreakReasonLabels,
  learnerBreakStatusLabels,
  learnerProgressSourceLabels,
  learnerReviewStatusLabels,
  learnerReviewTypeLabels,
  learnerSupportActionLabels,
  type LearnerProgressSource,
  type LearnerReviewStatus,
  type LearnerReviewType,
  type LearnerSupportActionType,
  type LearnerBreakReasonCategory,
  type LearnerAssessmentModel,
} from "@/lib/levytate/mvp/learner-lifecycle";

type LearnerListResponse = {
  ok?: boolean;
  source?: string;
  summary?: LearnerListSummary;
  learners?: LearnerOperationalSummary[];
  message?: string;
};

type LearnerDetailResponse = {
  ok?: boolean;
  source?: string;
  learner?: LearnerRecordDetail;
  readiness?: LearnerRecordDetail["enrolmentReadiness"];
  message?: string;
};

type LearnerMutationResponse = {
  ok?: boolean;
  source?: string;
  learner?: LearnerRecordDetail;
  message?: string;
};

type SortMode = "Operational priority" | "Learner name" | "Lifecycle status";

const allOption = "All";
const progressOptions: Array<LearnerProgressPosition | typeof allOption> = [
  allOption,
  "Ahead of target",
  "On target",
  "Slightly behind",
  "Significantly behind",
  "No progress data",
];

type LearnerDeepLinkAction = "open_learner" | "complete_pre_enrolment" | "complete_enrolment" | "record_review" | "add_progress" | "manage_break" | "return_learner" | "manage_assessment";

export function LearnersModule({ initialLearnerRecordId = "", initialAction = "open_learner", onDeepLinkConsumed }: { initialLearnerRecordId?: string; initialAction?: LearnerDeepLinkAction; onDeepLinkConsumed?: () => void }) {
  const { can, meta } = useMvpWorkspace();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [learners, setLearners] = useState<LearnerOperationalSummary[]>([]);
  const [summary, setSummary] = useState<LearnerListSummary | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<LearnerRecordDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(allOption);
  const [routeFilter, setRouteFilter] = useState(allOption);
  const [programmeFilter, setProgrammeFilter] = useState(allOption);
  const [providerFilter, setProviderFilter] = useState(allOption);
  const [siteFilter, setSiteFilter] = useState(allOption);
  const [departmentFilter, setDepartmentFilter] = useState(allOption);
  const [progressFilter, setProgressFilter] = useState<LearnerProgressPosition | typeof allOption>(allOption);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("Operational priority");

  const mayReadOrganisationLearners = can("learnerLifecycle:read") && (meta?.userRole === "Apprenticeship Lead" || meta?.userRole === "Employer Admin" || meta?.userRole === "Platform Admin");
  const mayMutatePreEnrolment = can("learnerLifecycle:write") && can("learnerLifecycle:status") && (meta?.userRole === "Apprenticeship Lead" || meta?.userRole === "Employer Admin" || meta?.userRole === "Platform Admin");
  const mayMutateLearnerActivity = can("learnerLifecycle:write") && (meta?.userRole === "Apprenticeship Lead" || meta?.userRole === "Employer Admin" || meta?.userRole === "Platform Admin");

  useEffect(() => {
    if (initialLearnerRecordId) setSelectedId(initialLearnerRecordId);
  }, [initialLearnerRecordId]);

  useEffect(() => {
    if (!mayReadOrganisationLearners) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/levytate-learners", { cache: "no-store" });
        const payload = (await response.json()) as LearnerListResponse;
        if (!response.ok || !payload.learners || !payload.summary) {
          throw new Error(payload.message ?? "Learner lifecycle records are unavailable.");
        }
        if (!cancelled) {
          setLearners(payload.learners);
          setSummary(payload.summary);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Learner lifecycle records are unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [mayReadOrganisationLearners]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;
    async function loadDetail() {
      setDetailLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/levytate-learners?learnerRecordId=${encodeURIComponent(selectedId)}`, { cache: "no-store" });
        const payload = (await response.json()) as LearnerDetailResponse;
        if (!response.ok || !payload.learner) {
          throw new Error(payload.message ?? "Learner record was not found.");
        }
        if (!cancelled) setDetail(payload.learner);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Learner record was not found.");
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filters = useMemo(() => {
    const unique = (values: string[]) => [allOption, ...Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))];
    return {
      statuses: unique(learners.map((learner) => learner.lifecycleStatusLabel)),
      routes: unique(learners.map((learner) => learner.employmentRouteLabel)),
      programmes: unique(learners.map((learner) => learner.programme.programmeName)),
      providers: unique(learners.map((learner) => learner.programme.providerName)),
      sites: unique(learners.map((learner) => learner.learner.site)),
      departments: unique(learners.map((learner) => learner.learner.department)),
    };
  }, [learners]);

  const visible = useMemo(() => learners
    .filter((learner) => {
      return includesSearch([
        learner.learner.name,
        learner.learner.jobTitle,
        learner.learner.department,
        learner.learner.site,
        learner.programme.programmeName,
        learner.programme.providerName,
        learner.programme.apprenticeshipStandardTitle,
      ], search)
        && (statusFilter === allOption || learner.lifecycleStatusLabel === statusFilter)
        && (routeFilter === allOption || learner.employmentRouteLabel === routeFilter)
        && (programmeFilter === allOption || learner.programme.programmeName === programmeFilter)
        && (providerFilter === allOption || learner.programme.providerName === providerFilter)
        && (siteFilter === allOption || learner.learner.site === siteFilter)
        && (departmentFilter === allOption || learner.learner.department === departmentFilter)
        && (progressFilter === allOption || learner.progressPosition === progressFilter)
        && (!attentionOnly || learner.attention.needsAttention);
    })
    .sort((left, right) => {
      if (sortMode === "Learner name") return left.learner.name.localeCompare(right.learner.name);
      if (sortMode === "Lifecycle status") return left.lifecycleStatusLabel.localeCompare(right.lifecycleStatusLabel) || left.learner.name.localeCompare(right.learner.name);
      return 0;
    }), [attentionOnly, departmentFilter, learners, progressFilter, programmeFilter, providerFilter, routeFilter, search, siteFilter, sortMode, statusFilter]);

  if (!mayReadOrganisationLearners) {
    return <EmptyState title="Learners is not available for this role" copy="Organisation-wide learner lifecycle records are available to Apprenticeship Leads and platform administrators only." actionLabel="Return home" onAction={() => window.scrollTo({ top: 0, behavior: "smooth" })} />;
  }

  if (selectedId) {
    return (
      <LearnerRecordView
        detail={detail}
        loading={detailLoading}
        error={error}
        onBack={() => {
          setSelectedId("");
          setError("");
        }}
        mayMutatePreEnrolment={mayMutatePreEnrolment}
        mayMutateLearnerActivity={mayMutateLearnerActivity}
        initialAction={initialAction}
        onDeepLinkConsumed={onDeepLinkConsumed}
        onDetailUpdated={(next) => {
          setDetail(next);
          setLearners((current) => current.map((learner) => learner.learnerRecordId === next.learnerRecordId ? next : learner));
        }}
      />
    );
  }

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-7">
        <SummaryTile label="Total records" value={summary?.total ?? 0} />
        <SummaryTile label="Pre-enrolment" value={summary?.preEnrolment ?? 0} />
        <SummaryTile label="Active learners" value={summary?.activeLearners ?? 0} />
        <SummaryTile label="Break in learning" value={summary?.breakInLearning ?? 0} tone="yellow" />
        <SummaryTile label="Assessment stage" value={summary?.assessmentStage ?? 0} tone="blue" />
        <SummaryTile label="Achieved" value={summary?.achieved ?? 0} tone="green" />
        <SummaryTile label="Need attention" value={summary?.needingAttention ?? 0} tone="red" />
      </section>

      <MvpPanel title="Learners" eyebrow="Lifecycle operations">
        <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,2fr)]">
          <label className="flex h-11 min-w-0 items-center gap-2 rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 focus-within:border-[#159b8f] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#159b8f]/10">
            <Search size={16} strokeWidth={1.8} className="shrink-0 text-[#102c3d]/38" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-[#102c3d] outline-none placeholder:text-[#102c3d]/34" placeholder="Search learner, role, programme, provider, site" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <CompactSelect label="Status" value={statusFilter} options={filters.statuses} onChange={setStatusFilter} />
            <CompactSelect label="Route" value={routeFilter} options={filters.routes} onChange={setRouteFilter} />
            <CompactSelect label="Progress" value={progressFilter} options={progressOptions} onChange={(value) => setProgressFilter(value as LearnerProgressPosition | typeof allOption)} />
            <CompactSelect label="Sort" value={sortMode} options={["Operational priority", "Learner name", "Lifecycle status"]} onChange={(value) => setSortMode(value as SortMode)} />
            <CompactSelect label="Programme" value={programmeFilter} options={filters.programmes} onChange={setProgrammeFilter} />
            <CompactSelect label="Provider" value={providerFilter} options={filters.providers} onChange={setProviderFilter} />
            <CompactSelect label="Site" value={siteFilter} options={filters.sites} onChange={setSiteFilter} />
            <CompactSelect label="Department" value={departmentFilter} options={filters.departments} onChange={setDepartmentFilter} />
          </div>
        </div>

        <label className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#f8fbfa] px-3 py-2 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.07]">
          <input type="checkbox" checked={attentionOnly} onChange={(event) => setAttentionOnly(event.target.checked)} className="h-4 w-4 accent-[#159b8f]" />
          Attention required only
        </label>

        {error ? <p className="mb-4 rounded-xl bg-[#fff0f2] px-4 py-3 text-sm font-semibold text-[#b13b51]">{error}</p> : null}

        {loading ? (
          <div className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-5 py-10 text-center text-sm font-semibold text-[#102c3d]/54">Loading learner lifecycle records.</div>
        ) : visible.length ? (
          <TableShell>
            <TableHead>
              <tr>
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Latest reviews</th>
                <th className="px-4 py-3">Next action</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </TableHead>
            <TableBody>
              {visible.map((learner) => (
                <tr key={learner.learnerRecordId}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#102c3d]">{learner.learner.name}</p>
                    <p className="mt-1 text-xs leading-5 text-[#102c3d]/52">{learner.learner.jobTitle}</p>
                    <p className="text-xs leading-5 text-[#102c3d]/42">{learner.learner.department} - {learner.learner.site}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-[18rem] font-semibold text-[#102c3d]/78">{learner.programme.programmeName}</p>
                    <p className="mt-1 text-xs text-[#102c3d]/48">{learner.programme.providerName}</p>
                    <p className="mt-1 text-xs text-[#102c3d]/42">{learner.employmentRouteLabel}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={statusTone(learner.lifecycleStatusLabel)}>{learner.lifecycleStatusLabel}</StatusBadge>
                    {learner.activeBreak ? <div className="mt-2 text-xs leading-5 text-[#102c3d]/52"><p>Expected return: {learner.activeBreak.expectedReturnUnknown ? "Not confirmed" : formatDate(learner.activeBreak.expectedReturnDate)}</p><p>{learner.breakAttention.daysOnBreak} days on break</p><p>{learnerBreakReasonLabels[learner.activeBreak.reasonCategory]}</p></div> : null}
                  </td>
                  <td className="px-4 py-3">
                    <ProgressMini learner={learner} />
                  </td>
                  <td className="px-4 py-3 text-xs leading-5 text-[#102c3d]/56">
                    <p>Provider: {formatDate(learner.latestProviderReview?.reviewDate) || "No review"}</p>
                    <p>L&D: {formatDate(learner.latestLAndDCheckIn?.reviewDate) || "No check-in"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-[16rem] text-sm font-semibold text-[#102c3d]/72">{learner.attention.label}</p>
                    {learner.attention.needsAttention ? <p className="mt-1 text-xs text-[#b13b51]">{learner.attention.reasons.length} item{learner.attention.reasons.length === 1 ? "" : "s"} flagged</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right"><TableAction onClick={() => setSelectedId(learner.learnerRecordId)}>Open learner record</TableAction></td>
                </tr>
              ))}
            </TableBody>
          </TableShell>
        ) : (
          <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-[#102c3d]/[0.14] bg-[#f8fbfa] px-5 py-10 text-center">
            <div className="max-w-md">
              <h3 className="text-base font-semibold text-[#102c3d]">{learners.length ? "No learners match the selected filters." : "No learner lifecycle records have been created yet."}</h3>
              <p className="mt-2 text-sm leading-6 text-[#102c3d]/56">Adjust the filters or search to review existing learner records.</p>
            </div>
          </div>
        )}
      </MvpPanel>
    </div>
  );
}

function LearnerRecordView({ detail, loading, error, onBack, mayMutatePreEnrolment, mayMutateLearnerActivity, initialAction, onDeepLinkConsumed, onDetailUpdated }: { detail: LearnerRecordDetail | null; loading: boolean; error: string; onBack: () => void; mayMutatePreEnrolment: boolean; mayMutateLearnerActivity: boolean; initialAction: LearnerDeepLinkAction; onDeepLinkConsumed?: () => void; onDetailUpdated: (detail: LearnerRecordDetail) => void }) {
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [activityMode, setActivityMode] = useState<"progress" | "review" | "">("");
  const [reviewFilter, setReviewFilter] = useState<LearnerReviewType | "all">("all");
  const [success, setSuccess] = useState("");
  const [breakMode, setBreakMode] = useState<"start" | "manage" | "update" | "return" | "cancel" | "">("");
  const [assessmentOpen, setAssessmentOpen] = useState(false);

  useEffect(() => {
    if (!detail || initialAction === "open_learner") return;
    if (initialAction === "complete_pre_enrolment" || initialAction === "complete_enrolment") setWorkflowOpen(true);
    if (initialAction === "record_review") setActivityMode("review");
    if (initialAction === "add_progress") setActivityMode("progress");
    if (initialAction === "manage_break") setBreakMode("manage");
    if (initialAction === "return_learner") setBreakMode("return");
    if (initialAction === "manage_assessment") setAssessmentOpen(true);
    onDeepLinkConsumed?.();
  }, [detail, initialAction, onDeepLinkConsumed]);

  if (loading) {
    return <div className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-8 text-sm font-semibold text-[#102c3d]/56">Loading learner record.</div>;
  }

  if (error || !detail) {
    return (
      <div className="grid gap-4">
        <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#102c3d]/68 ring-1 ring-[#102c3d]/[0.08]">
          <ArrowLeft size={15} /> Back to learners
        </button>
        <div className="rounded-xl border border-[#b13b51]/10 bg-[#fff0f2] p-5 text-sm font-semibold text-[#b13b51]">{error || "Learner record was not found."}</div>
      </div>
    );
  }

  const progressEntryAllowed = mayMutateLearnerActivity && learnerProgressReviewPolicy.progressEligibleStatuses.includes(detail.lifecycleStatus);
  const reviewEntryAllowed = mayMutateLearnerActivity && learnerProgressReviewPolicy.reviewEligibleStatuses.includes(detail.lifecycleStatus);
  const breakStartAllowed = mayMutatePreEnrolment && learnerBreakPolicy.eligibleStartStatuses.includes(detail.lifecycleStatus);

  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
      <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#102c3d]/68 ring-1 ring-[#102c3d]/[0.08] transition hover:bg-[#f8fbfa] hover:text-[#102c3d]">
        <ArrowLeft size={15} /> Back to learners
      </button>

      <section className="min-w-0 rounded-xl border border-[#102c3d]/[0.075] bg-white p-5 shadow-[0_14px_36px_rgba(16,44,61,0.045)]">
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Learner record</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-[-0.025em] text-[#102c3d]">{detail.learner.name}</h2>
              <StatusBadge tone={statusTone(detail.lifecycleStatusLabel)}>{detail.lifecycleStatusLabel}</StatusBadge>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/62">{detail.learner.jobTitle} - {detail.learner.department} - {detail.learner.site}</p>
            <p className="mt-1 text-sm leading-6 text-[#102c3d]/52">Line manager: {detail.learner.managerName}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <InfoBlock label="Programme" value={detail.programme.programmeName} helper={detail.programme.apprenticeshipStandardTitle} />
              <InfoBlock label="Provider" value={detail.programme.providerName} helper={detail.employmentRouteLabel} />
              <InfoBlock label="Dates" value={`${formatDate(detail.actualStartDate || detail.expectedStartDate) || "Start to confirm"}`} helper={`Expected end ${formatDate(detail.expectedEndDate) || "to confirm"}`} />
            </div>
            {success ? <p className="mt-4 rounded-xl bg-[#e9f7f2] px-4 py-3 text-sm font-semibold text-[#0b6f63]">{success}</p> : null}
            {mayMutatePreEnrolment && detail.lifecycleStatus === "pre_enrolment" ? (
              <button type="button" onClick={() => { setWorkflowOpen(true); setSuccess(""); }} className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(16,44,61,0.12)] transition hover:-translate-y-0.5 hover:bg-[#17394d]">
                Complete pre-enrolment
              </button>
            ) : null}
            {breakStartAllowed ? <button type="button" onClick={() => { setBreakMode("start"); setSuccess(""); }} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(16,44,61,0.12)] transition hover:-translate-y-0.5 hover:bg-[#17394d]"><CalendarClock size={15} />Start break in learning</button> : null}
            {detail.activeBreak && mayMutatePreEnrolment ? <button type="button" onClick={() => { setBreakMode("manage"); setSuccess(""); }} className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(16,44,61,0.12)] transition hover:-translate-y-0.5 hover:bg-[#17394d]"><CalendarClock size={15} />Manage break in learning</button> : null}
          </div>
          <div className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Next action</p>
            <p className="mt-2 text-lg font-semibold leading-7 text-[#102c3d]">{detail.attention.label}</p>
            <p className="mt-3 text-sm leading-6 text-[#102c3d]/58">{nextActionNarrative(detail)}</p>
          </div>
        </div>
      </section>

      {detail.activeBreak ? <ActiveBreakBanner detail={detail} /> : null}

      {breakMode ? <BreakManagementWorkflow detail={detail} mode={breakMode} onModeChange={setBreakMode} onClose={() => setBreakMode("")} onSaved={(next, message) => { onDetailUpdated(next); setSuccess(message); setBreakMode(next.activeBreak ? "manage" : ""); }} /> : null}

      {workflowOpen ? (
        <PreEnrolmentWorkflow
          detail={detail}
          onCancel={() => setWorkflowOpen(false)}
          onSaved={(next, message) => {
            onDetailUpdated(next);
            setSuccess(message);
          }}
          onEnrolled={(next) => {
            onDetailUpdated(next);
            setWorkflowOpen(false);
            setSuccess("Learner marked as enrolled. The lifecycle record is now active.");
          }}
        />
      ) : null}

      {activityMode === "progress" ? (
        <ProgressUpdateForm
          detail={detail}
          onClose={() => setActivityMode("")}
          onSaved={(next, message) => {
            onDetailUpdated(next);
            setActivityMode("");
            setSuccess(message);
          }}
        />
      ) : null}

      {activityMode === "review" ? (
        <ReviewEntryForm
          detail={detail}
          onClose={() => setActivityMode("")}
          onSaved={(next, message) => {
            onDetailUpdated(next);
            setActivityMode("");
            setSuccess(message);
          }}
        />
      ) : null}

      <RecordSection title="Eligibility and pre-enrolment" eyebrow="Checks">
        <div className="grid gap-3 lg:grid-cols-4">
          <CheckCard title="England working-hours declaration" status={detail.eligibilityDeclaration?.confirmed && detail.eligibilityDeclaration.verificationStatus === "employer_verified" ? "Complete" : "Outstanding"} lines={[
            "Expected to spend at least 50% of working hours in England.",
            `Confirmed by: ${detail.eligibilityDeclaration?.confirmedByEmployee || "Not confirmed"}`,
            `Confirmed date: ${formatDate(detail.eligibilityDeclaration?.confirmedAt) || "Not confirmed"}`,
            `Expected percentage: ${detail.eligibilityDeclaration?.expectedEnglandWorkingHoursPercentage ?? "Not recorded"}`,
            `Employer verification: ${humanise(detail.eligibilityDeclaration?.verificationStatus || "not_confirmed")}`,
            `Verified by: ${detail.eligibilityDeclaration?.verifiedBy || "Not verified"}`,
            `Version: ${detail.eligibilityDeclaration?.declarationVersion || "Not recorded"}`,
          ]} />
          <CheckCard title="Probation" status={probationStatus(detail)} lines={[
            `Status: ${humanise(detail.preEnrolmentChecks?.probationStatus || "awaiting_confirmation")}`,
            `Passed date: ${formatDate(detail.preEnrolmentChecks?.probationPassedDate) || "Not recorded"}`,
            `Confirmed by: ${detail.preEnrolmentChecks?.probationConfirmedBy || "Not recorded"}`,
            detail.preEnrolmentChecks?.probationNotes || "No notes recorded.",
          ]} />
          <CheckCard title="HR approval" status={hrStatus(detail)} lines={[
            `Status: ${humanise(detail.preEnrolmentChecks?.hrApprovalStatus || "not_requested")}`,
            `Approval date: ${formatDate(detail.preEnrolmentChecks?.hrApprovedDate) || "Not recorded"}`,
            `Approved by: ${detail.preEnrolmentChecks?.hrApprovedBy || "Not recorded"}`,
            detail.preEnrolmentChecks?.hrApprovalNotes || "No notes recorded.",
          ]} />
          <CheckCard title="Guides" status={detail.preEnrolmentChecks?.guidesSent ? "Complete" : "Outstanding"} lines={[
            detail.preEnrolmentChecks?.guidesSent ? "Sent" : "Not sent",
            `Sent date: ${formatDate(detail.preEnrolmentChecks?.guidesSentDate) || "Not recorded"}`,
            `Sent by: ${detail.preEnrolmentChecks?.guidesSentBy || "Not recorded"}`,
            `Version: ${detail.preEnrolmentChecks?.guidesVersion || "Not recorded"}`,
          ]} />
        </div>
      </RecordSection>

      <RecordSection title="Programme and enrolment" eyebrow="Route">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoBlock label="Programme" value={detail.programme.programmeName} helper={detail.programme.providerName} />
          <InfoBlock label="Linked apprenticeship standard" value={detail.programme.apprenticeshipStandardTitle} helper={detail.programme.apprenticeshipStandardReference} />
          <InfoBlock label="Application reference" value={detail.programme.applicationReference || "Not recorded"} helper="Internal application link" />
          <InfoBlock label="Lifecycle status" value={detail.lifecycleStatusLabel} helper={detail.employmentRouteLabel} />
          <InfoBlock label="Expected start date" value={formatDate(detail.expectedStartDate) || "Not recorded"} />
          <InfoBlock label="Actual start date" value={formatDate(detail.actualStartDate) || "Not recorded"} />
          <InfoBlock label="Expected end date" value={formatDate(detail.expectedEndDate) || "Not recorded"} />
          <InfoBlock label="Actual end date" value={formatDate(detail.actualEndDate) || "Not recorded"} />
        </div>
        <details className="mt-4 rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] px-4 py-3 text-sm text-[#102c3d]/62">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/48"><ChevronDown size={14} /> Standard and funding detail</summary>
          <p className="mt-3 leading-6">Standard metadata is used for funding and compliance checks. Provider commercial notes and pricing are not shown in this learner record.</p>
        </details>
      </RecordSection>

      {(progressEntryAllowed || reviewEntryAllowed) ? (
        <RecordSection title="Progress and reviews" eyebrow="Learner support">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-[#102c3d]">Where the learner should be, where they are now and what support comes next.</p>
              <p className="mt-1 text-sm leading-6 text-[#102c3d]/54">Updates are retained as history and refresh the learner&apos;s attention state from persisted data.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {progressEntryAllowed ? <PrimaryRecordAction onClick={() => { setActivityMode("progress"); setSuccess(""); }}>Add progress update</PrimaryRecordAction> : null}
              {reviewEntryAllowed ? <SecondaryRecordAction onClick={() => { setActivityMode("review"); setSuccess(""); }}>Record review or check-in</SecondaryRecordAction> : null}
            </div>
          </div>
        </RecordSection>
      ) : null}

      <RecordSection title="Progress" eyebrow="Pace">
        {detail.lifecycleStatus === "break_in_learning" ? <p className="mb-4 rounded-xl border border-[#b89220]/15 bg-[#fff9e7] px-4 py-3 text-sm font-semibold text-[#756000]">Progress is paused while the learner is on a break in learning.</p> : null}
        {detail.latestProgress ? (
          <div className="grid min-w-0 gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Latest snapshot</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <InfoBlock label="Target" value={`${detail.latestProgress.targetProgressPercentage}%`} />
                <InfoBlock label="Actual" value={`${detail.latestProgress.actualProgressPercentage}%`} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2"><StatusBadge tone={detail.progressPosition === "Significantly behind" ? "red" : detail.progressPosition === "Slightly behind" ? "yellow" : "green"}>{detail.progressPosition}</StatusBadge><p className="text-sm font-semibold text-[#102c3d]">Variance: {detail.latestProgress.variancePercentage > 0 ? "+" : ""}{detail.latestProgress.variancePercentage} percentage points</p></div>
              <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{detail.latestProgress.summary}</p>
              {detail.latestProgress.supportAction ? <p className="mt-2 text-sm leading-6 text-[#0b6f63]">{detail.latestProgress.supportAction}</p> : null}
            </div>
            <HistoryTable rows={detail.progressHistory.map((progress) => [
              formatDate(progress.updateDate) || "Not recorded",
              `${progress.targetProgressPercentage}%`,
              `${progress.actualProgressPercentage}%`,
              `${progress.variancePercentage > 0 ? "+" : ""}${progress.variancePercentage} percentage points`,
              deriveProgressPositionFromVariance(progress.variancePercentage),
              humanise(progress.progressSource),
            ])} empty="No progress update has been recorded yet." headings={["Date", "Target", "Actual", "Variance", "Position", "Source"]} />
          </div>
        ) : progressEntryAllowed ? <ActionEmpty copy="No progress update has been recorded yet." action="Add progress update" onAction={() => setActivityMode("progress")} /> : <InlineEmpty copy="No progress update has been recorded yet." />}
      </RecordSection>

      <RecordSection title="Reviews and check-ins" eyebrow="Support">
        <div className="grid gap-3 lg:grid-cols-3">
          <ReviewCard title="Provider review" review={detail.reviewSummaries.provider.latest} overdue={detail.reviewSummaries.provider.overdue} empty="No provider review has been recorded yet." />
          <ReviewCard title="L&D check-in" review={detail.reviewSummaries.lAndD.latest} overdue={detail.reviewSummaries.lAndD.overdue} empty="No L&D check-in has been recorded yet." />
          <ReviewCard title="Manager check-in" review={detail.reviewSummaries.manager.latest} overdue={detail.reviewSummaries.manager.overdue} empty="No manager check-in has been recorded yet." />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <FormSelect label="Filter review history" value={reviewFilter} onChange={(value) => setReviewFilter(value as LearnerReviewType | "all")} options={[
            { value: "all", label: "All review types" },
            ...Object.entries(learnerReviewTypeLabels).map(([value, label]) => ({ value, label })),
          ]} />
          {reviewEntryAllowed ? <SecondaryRecordAction onClick={() => setActivityMode("review")}>Record review or check-in</SecondaryRecordAction> : null}
        </div>
        {detail.reviewHistory.some((review) => reviewFilter === "all" || review.reviewType === reviewFilter) ? (
          <div className="mt-4">
            <HistoryTable rows={detail.reviewHistory.filter((review) => reviewFilter === "all" || review.reviewType === reviewFilter).map((review) => [
              formatDate(review.reviewDate) || "Not recorded",
              learnerReviewTypeLabels[review.reviewType],
              review.reviewerName || "Reviewer not recorded",
              learnerReviewStatusLabels[review.status],
              review.summary || "No summary recorded",
              review.nextReviewDate ? formatDate(review.nextReviewDate) : "Not scheduled",
              review.supportRequired || (review.actions.length ? review.actions.join(", ") : "No support required"),
            ])} headings={["Date", "Type", "Reviewer", "Status", "Summary", "Next", "Support / actions"]} empty="No reviews or check-ins match this filter." />
          </div>
        ) : reviewEntryAllowed ? <ActionEmpty copy="No review or check-in has been recorded yet." action="Record review or check-in" onAction={() => setActivityMode("review")} /> : <InlineEmpty copy="No review or check-in has been recorded yet." />}
      </RecordSection>

      <RecordSection title="Breaks and withdrawals" eyebrow="Exceptions">
        {detail.breaksInLearning.length || detail.withdrawal ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {detail.breaksInLearning.map((breakRecord) => (
              <InfoGroup key={breakRecord.id} title="Break in learning" rows={[
                ["Start date", formatDate(breakRecord.startDate) || "Not recorded"],
                ["Expected return", formatDate(breakRecord.expectedReturnDate) || "Not recorded"],
                ["Actual return", formatDate(breakRecord.actualReturnDate) || "Not recorded"],
                ["Reason", learnerBreakReasonLabels[breakRecord.reasonCategory]],
                ["Status", learnerBreakStatusLabels[breakRecord.status]],
                ["Recorded by", breakRecord.recordedBy],
                ["Duration", breakDurationLabel(breakRecord)],
                ["Outcome", breakOutcome(breakRecord)],
                ["Notes", breakRecord.reasonNotes || "No concise reason notes recorded"],
              ]} />
            ))}
            {detail.withdrawal ? <InfoGroup title="Withdrawal" rows={[
              ["Withdrawal date", formatDate(detail.withdrawal.withdrawalDate) || "Not recorded"],
              ["Effective date", formatDate(detail.withdrawal.effectiveDate) || "Not recorded"],
              ["Reason", detail.withdrawal.reasonCategory],
              ["Provider notified", detail.withdrawal.providerNotified ? `Yes, ${formatDate(detail.withdrawal.providerNotifiedDate)}` : "No"],
              ["Employee notified", detail.withdrawal.employeeNotified ? `Yes, ${formatDate(detail.withdrawal.employeeNotifiedDate)}` : "No"],
              ["Recorded by", detail.withdrawal.recordedBy],
            ]} /> : null}
          </div>
        ) : <InlineEmpty copy="No breaks in learning have been recorded." />}
      </RecordSection>

      <AssessmentReadinessSection
        detail={detail}
        mayMutate={mayMutatePreEnrolment}
        onManage={() => { setAssessmentOpen(true); setSuccess(""); }}
        onSaved={(next, message) => { onDetailUpdated(next); setSuccess(message); }}
      />

      {assessmentOpen ? <AssessmentReadinessWorkflow detail={detail} onClose={() => setAssessmentOpen(false)} onSaved={(next, message) => { onDetailUpdated(next); setSuccess(message); setAssessmentOpen(false); }} /> : null}

      <RecordSection title="Operational actions" eyebrow="Communications">
        {detail.operationalActions.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {detail.operationalActions.map((action) => (
              <CheckCard key={action.id} title={operationalActionLabel(action.actionType)} status={action.completed ? "Complete" : humanise(action.status)} lines={[
                action.completed ? "Completed" : "Not completed",
                `Completed date: ${formatDate(action.completedAt) || "Not recorded"}`,
                `Completed by: ${action.completedBy || "Not recorded"}`,
                `Recipient: ${action.recipientSummary || "Not recorded"}`,
                action.notes || "No notes recorded.",
              ]} />
            ))}
          </div>
        ) : <InlineEmpty copy="No operational actions have been recorded yet." />}
      </RecordSection>

      <RecordSection title="Lifecycle history" eyebrow="Timeline">
        {detail.lifecycleTimeline.length ? (
          <ol className="relative grid gap-3 border-l border-[#102c3d]/[0.08] pl-5">
            {detail.lifecycleTimeline.map((event) => (
              <li key={event.id} className="relative rounded-xl border border-[#102c3d]/[0.06] bg-[#f8fbfa] p-4">
                <span className="absolute -left-[1.65rem] top-5 h-2.5 w-2.5 rounded-full bg-[#159b8f] ring-4 ring-white" />
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">{formatDateTime(event.eventDate)} · {event.actorName || "LevyTate"}</p>
                <p className="mt-1 text-sm font-semibold text-[#102c3d]">{humanise(event.eventType)}</p>
                <p className="mt-1 text-sm leading-6 text-[#102c3d]/58">{event.summary}</p>
              </li>
            ))}
          </ol>
        ) : <InlineEmpty copy="No lifecycle history has been recorded yet." />}
      </RecordSection>
    </div>
  );
}

function AssessmentReadinessSection({ detail, mayMutate, onManage, onSaved }: { detail: LearnerRecordDetail; mayMutate: boolean; onManage: () => void; onSaved: (detail: LearnerRecordDetail, message: string) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const readiness = detail.assessmentReadiness;
  const result = detail.assessmentReadinessResult;
  const eligible = detail.lifecycleStatus === "enrolled" || detail.lifecycleStatus === "assessment_preparation";
  const nextAction = detail.lifecycleStatus === "enrolled"
    ? { label: "Move to assessment preparation", route: "assessment-preparation" }
    : detail.lifecycleStatus === "assessment_preparation" && readiness?.assessmentStatus === "readiness_confirmed"
      ? { label: "Mark as in assessment", route: "start-assessment" }
      : detail.lifecycleStatus === "assessment_preparation" && result.readyForAssessment
        ? { label: "Confirm assessment readiness", route: "confirm-assessment-readiness" }
        : null;

  async function runAction(route: string) {
    setSaving(true);
    setError("");
    try {
      const body: Record<string, string> = { expectedActivityVersion: detail.activityVersion, idempotencyKey: activityKey() };
      if (route === "confirm-assessment-readiness") {
        body.gatewayDate = readiness?.gatewayDate ?? "";
      }
      if (route === "start-assessment") body.assessmentStartDate = readiness?.expectedAssessmentStartDate || todayDate();
      const response = await fetch(`/api/levytate-learners/${encodeURIComponent(detail.learnerRecordId)}/${route}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as LearnerMutationResponse;
      if (!response.ok || !payload.learner) throw new Error(payload.message || "Assessment readiness could not be updated.");
      onSaved(payload.learner, payload.message || "Assessment readiness updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assessment readiness could not be updated.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <RecordSection title="Assessment and gateway" eyebrow="Completion path">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
        <div className="grid content-start gap-3">
          <div className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Current assessment status</p>
                <h4 className="mt-1.5 text-lg font-semibold text-[#102c3d]">{humanise(readiness?.assessmentStatus || "not_started")}</h4>
              </div>
              <StatusBadge tone={result.readyForAssessment ? "green" : result.blockingChecks.length ? "red" : "yellow"}>{result.readyForAssessment ? "Ready" : `${result.blockingChecks.length + result.outstandingChecks.length} outstanding`}</StatusBadge>
            </div>
            <dl className="mt-4 grid gap-2 text-sm">
              <AssessmentSummaryRow label="Model" value={readiness ? assessmentModelLabels[readiness.assessmentModel] : "Not yet confirmed"} />
              <AssessmentSummaryRow label="Organisation" value={readiness?.assessmentOrganisation || "Not recorded"} />
              <AssessmentSummaryRow label="Expected readiness" value={formatDate(readiness?.expectedAssessmentReadinessDate) || "Not recorded"} />
              <AssessmentSummaryRow label="Gateway" value={formatDate(readiness?.gatewayDate) || (readiness && !assessmentModelUsesGateway(readiness.assessmentModel) ? "Not required" : "Not recorded")} />
              <AssessmentSummaryRow label="Assessment start" value={formatDate(readiness?.assessmentStartDate || readiness?.expectedAssessmentStartDate) || "Not recorded"} />
            </dl>
          </div>
          {mayMutate && eligible ? (
            <div className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">Next action</p>
              <p className="mt-2 text-sm leading-6 text-[#102c3d]/60">{nextAction ? nextAction.label : "Complete the outstanding readiness checks."}</p>
              {nextAction ? <button type="button" disabled={saving} onClick={() => void runAction(nextAction.route)} className="mt-3 h-10 w-full rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white transition hover:bg-[#17394d] disabled:opacity-50">{saving ? "Updating" : nextAction.label}</button> : <button type="button" onClick={onManage} className="mt-3 h-10 w-full rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white transition hover:bg-[#17394d]">Complete readiness checks</button>}
              {nextAction ? <button type="button" onClick={onManage} className="mt-2 h-9 w-full rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/66 ring-1 ring-[#102c3d]/[0.1]">Review readiness details</button> : null}
              {error ? <p className="mt-3 rounded-lg bg-[#fff0f2] px-3 py-2 text-xs font-semibold text-[#b13b51]">{error}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {result.checks.map((check) => (
              <div key={check.id} className="rounded-xl border border-[#102c3d]/[0.06] bg-[#fbfcfb] p-3.5">
                <div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold text-[#102c3d]">{check.label}</p><StatusBadge tone={readinessCheckTone(check.status)}>{check.status}</StatusBadge></div>
                <p className="mt-1.5 text-xs leading-5 text-[#102c3d]/52">{check.message}</p>
              </div>
            ))}
          </div>
          {readiness ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {assessmentConfirmationTypes.map((type) => {
                const confirmation = readiness.confirmations[type];
                return <div key={type} className="rounded-xl border border-[#102c3d]/[0.06] bg-white p-3"><p className="text-xs font-semibold text-[#102c3d]">{assessmentConfirmationTypeLabels[type]}</p><div className="mt-2"><StatusBadge tone={confirmation.status === "confirmed" ? "green" : confirmation.status === "not_confirmed" || confirmation.status === "more_information_required" ? "red" : "yellow"}>{assessmentConfirmationStatusLabels[confirmation.status]}</StatusBadge></div><p className="mt-2 text-xs leading-5 text-[#102c3d]/48">{confirmation.confirmedBy || confirmation.recordedOnBehalfOf || "No confirmer recorded"}</p></div>;
              })}
            </div>
          ) : null}
        </div>
      </div>
    </RecordSection>
  );
}

type ConfirmationForm = { status: AssessmentConfirmationStatus; confirmedDate: string; confirmedBy: string; recordedOnBehalfOf: string; note: string; evidenceReference: string };
type AssessmentReadinessFormState = {
  assessmentModel: LearnerAssessmentModel;
  assessmentModelExplanation: string;
  assessmentOrganisation: string;
  assessmentContact: string;
  assessmentReference: string;
  assessmentNotes: string;
  expectedAssessmentReadinessDate: string;
  gatewayDate: string;
  expectedAssessmentStartDate: string;
  confirmations: Record<AssessmentConfirmationType, ConfirmationForm>;
};

function AssessmentReadinessWorkflow({ detail, onClose, onSaved }: { detail: LearnerRecordDetail; onClose: () => void; onSaved: (detail: LearnerRecordDetail, message: string) => void }) {
  const readiness = detail.assessmentReadiness;
  const empty = emptyAssessmentReadinessConfirmations();
  const [form, setForm] = useState<AssessmentReadinessFormState>({
    assessmentModel: readiness?.assessmentModel ?? "not_confirmed",
    assessmentModelExplanation: readiness?.assessmentModelExplanation ?? "",
    assessmentOrganisation: readiness?.assessmentOrganisation ?? "",
    assessmentContact: readiness?.assessmentContact ?? "",
    assessmentReference: readiness?.assessmentReference ?? "",
    assessmentNotes: readiness?.assessmentNotes ?? "",
    expectedAssessmentReadinessDate: readiness?.expectedAssessmentReadinessDate ?? "",
    gatewayDate: readiness?.gatewayDate ?? "",
    expectedAssessmentStartDate: readiness?.expectedAssessmentStartDate ?? "",
    confirmations: Object.fromEntries(assessmentConfirmationTypes.map((type) => {
      const source = readiness?.confirmations[type] ?? empty[type];
      return [type, { status: source.status, confirmedDate: source.confirmedDate, confirmedBy: source.confirmedBy, recordedOnBehalfOf: source.recordedOnBehalfOf, note: source.note, evidenceReference: source.evidenceReference }];
    })) as Record<AssessmentConfirmationType, ConfirmationForm>,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof Omit<AssessmentReadinessFormState, "confirmations">>(key: K, value: AssessmentReadinessFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function updateConfirmation<K extends keyof ConfirmationForm>(type: AssessmentConfirmationType, key: K, value: ConfirmationForm[K]) {
    setForm((current) => ({ ...current, confirmations: { ...current.confirmations, [type]: { ...current.confirmations[type], [key]: value } } }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/levytate-learners/${encodeURIComponent(detail.learnerRecordId)}/assessment-readiness`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, expectedActivityVersion: detail.activityVersion }) });
      const payload = await response.json() as LearnerMutationResponse;
      if (!response.ok || !payload.learner) throw new Error(payload.message || "Assessment readiness could not be saved.");
      onSaved(payload.learner, payload.message || "Assessment readiness record saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Assessment readiness could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MvpModal title="Manage assessment readiness" eyebrow="Assessment and gateway" onClose={onClose} wide>
      <form onSubmit={submit} className="grid gap-4">
        <FormSection title="Assessment route" copy="Confirm the assessment model, organisation and readiness plan. Gateway is required only for end-point assessment.">
          <FormGrid>
            <FormSelect label="Assessment model" value={form.assessmentModel} onChange={(value) => update("assessmentModel", value as LearnerAssessmentModel)} options={Object.entries(assessmentModelLabels).map(([value, label]) => ({ value, label }))} required />
            {form.assessmentModel === "other" ? <FormField label="Other assessment model" value={form.assessmentModelExplanation} onChange={(value) => update("assessmentModelExplanation", value)} required /> : <FormField label="Assessment organisation" value={form.assessmentOrganisation} onChange={(value) => update("assessmentOrganisation", value)} />}
            {form.assessmentModel === "other" ? <FormField label="Assessment organisation" value={form.assessmentOrganisation} onChange={(value) => update("assessmentOrganisation", value)} /> : null}
            <FormField label="Assessment contact" value={form.assessmentContact} onChange={(value) => update("assessmentContact", value)} />
            <FormField label="Registration or reference" value={form.assessmentReference} onChange={(value) => update("assessmentReference", value)} />
            <FormField label="Expected assessment-readiness date" type="date" value={form.expectedAssessmentReadinessDate} onChange={(value) => update("expectedAssessmentReadinessDate", value)} />
            {assessmentModelUsesGateway(form.assessmentModel) ? <FormField label="Gateway date" type="date" value={form.gatewayDate} onChange={(value) => update("gatewayDate", value)} /> : null}
            <FormField label="Expected assessment start date" type="date" value={form.expectedAssessmentStartDate} onChange={(value) => update("expectedAssessmentStartDate", value)} />
            <FormTextArea label="Assessment notes" value={form.assessmentNotes} onChange={(value) => update("assessmentNotes", value)} wide rows={3} />
          </FormGrid>
        </FormSection>
        <FormSection title="Readiness confirmations" copy="Recording a confirmation on someone else's behalf does not give that person platform access.">
          <div className="grid gap-3 lg:grid-cols-2">
            {assessmentConfirmationTypes.map((type) => {
              const confirmation = form.confirmations[type];
              return <div key={type} className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4"><p className="mb-3 text-sm font-semibold text-[#102c3d]">{assessmentConfirmationTypeLabels[type]}</p><div className="grid gap-3 sm:grid-cols-2"><FormSelect label="Status" value={confirmation.status} onChange={(value) => updateConfirmation(type, "status", value as AssessmentConfirmationStatus)} options={Object.entries(assessmentConfirmationStatusLabels).map(([value, label]) => ({ value, label }))} /><FormField label="Confirmation date" type="date" value={confirmation.confirmedDate} onChange={(value) => updateConfirmation(type, "confirmedDate", value)} /><FormField label="Confirmed by" value={confirmation.confirmedBy} onChange={(value) => updateConfirmation(type, "confirmedBy", value)} /><FormField label="Recorded on behalf of" value={confirmation.recordedOnBehalfOf} onChange={(value) => updateConfirmation(type, "recordedOnBehalfOf", value)} /><FormField label="Evidence reference" value={confirmation.evidenceReference} onChange={(value) => updateConfirmation(type, "evidenceReference", value)} /><FormTextArea label="Note or reason" value={confirmation.note} onChange={(value) => updateConfirmation(type, "note", value)} rows={2} /></div></div>;
            })}
          </div>
        </FormSection>
        <FormActions error={error} saving={saving} submit="Save readiness record" onCancel={onClose} />
      </form>
    </MvpModal>
  );
}

function AssessmentSummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 border-t border-[#102c3d]/[0.05] pt-2 first:border-0 first:pt-0"><dt className="text-xs font-semibold text-[#102c3d]/42">{label}</dt><dd className="text-sm font-semibold text-[#102c3d]/72">{value}</dd></div>;
}

function readinessCheckTone(status: string) {
  if (status === "Complete") return "green" as const;
  if (status === "Blocking") return "red" as const;
  if (status === "Warning") return "yellow" as const;
  return "blue" as const;
}

type ProgressFormState = {
  updateDate: string;
  target: string;
  actual: string;
  source: LearnerProgressSource;
  sourceReference: string;
  summary: string;
  supportType: LearnerSupportActionType;
  supportSummary: string;
};

function ProgressUpdateForm({ detail, onClose, onSaved }: { detail: LearnerRecordDetail; onClose: () => void; onSaved: (detail: LearnerRecordDetail, message: string) => void }) {
  const [idempotencyKey] = useState(activityKey);
  const [form, setForm] = useState<ProgressFormState>({
    updateDate: todayDate(),
    target: String(detail.latestProgress?.targetProgressPercentage ?? ""),
    actual: String(detail.latestProgress?.actualProgressPercentage ?? ""),
    source: "provider_report",
    sourceReference: "",
    summary: "",
    supportType: "no_support_required",
    supportSummary: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const target = Number(form.target);
  const actual = Number(form.actual);
  const hasNumbers = Number.isFinite(target) && Number.isFinite(actual) && form.target !== "" && form.actual !== "";
  const variance = hasNumbers ? Math.round((actual - target) * 10) / 10 : 0;
  const position = hasNumbers ? deriveProgressPositionFromVariance(variance) : "No progress data";

  function update<K extends keyof ProgressFormState>(key: K, value: ProgressFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const supportAction = form.supportType === "no_support_required"
        ? learnerSupportActionLabels.no_support_required
        : `${learnerSupportActionLabels[form.supportType]}${form.supportSummary.trim() ? `: ${form.supportSummary.trim()}` : ""}`;
      const response = await fetch(`/api/levytate-learners/${encodeURIComponent(detail.learnerRecordId)}/progress`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedActivityVersion: detail.activityVersion,
          idempotencyKey,
          updateDate: form.updateDate,
          targetProgressPercentage: target,
          actualProgressPercentage: actual,
          progressSource: form.source,
          sourceReference: form.sourceReference,
          summary: form.summary,
          supportAction,
        }),
      });
      const payload = await response.json() as LearnerMutationResponse;
      if (!response.ok || !payload.learner) throw new Error(payload.message ?? "Progress update could not be recorded.");
      onSaved(payload.learner, payload.message ?? "Progress update recorded.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Progress update could not be recorded.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MvpModal title="Add progress update" eyebrow="Progress and reviews" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <FormSection title="Progress position" copy="Variance and position are recalculated by the server when this update is saved.">
          <FormGrid>
            <FormField label="Update date" type="date" value={form.updateDate} onChange={(value) => update("updateDate", value)} required />
            <FormSelect label="Progress source" value={form.source} onChange={(value) => update("source", value as LearnerProgressSource)} options={Object.entries(learnerProgressSourceLabels).map(([value, label]) => ({ value, label }))} required />
            <FormField label="Target progress percentage" type="number" value={form.target} onChange={(value) => update("target", value)} required />
            <FormField label="Actual progress percentage" type="number" value={form.actual} onChange={(value) => update("actual", value)} required />
          </FormGrid>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <InfoBlock label="Variance" value={hasNumbers ? `${variance > 0 ? "+" : ""}${variance} percentage points` : "Enter progress values"} />
            <InfoBlock label="Position" value={position} />
            <InfoBlock label="Latest saved update" value={formatDate(detail.latestProgress?.updateDate) || "No previous update"} />
          </div>
        </FormSection>
        <FormSection title="Evidence and support">
          <FormGrid>
            <FormField label="Source reference" value={form.sourceReference} onChange={(value) => update("sourceReference", value)} placeholder="Provider report or review reference" />
            <FormSelect label="Support action" value={form.supportType} onChange={(value) => update("supportType", value as LearnerSupportActionType)} options={Object.entries(learnerSupportActionLabels).map(([value, label]) => ({ value, label }))} />
            <FormTextArea label="Progress summary" value={form.summary} onChange={(value) => update("summary", value)} wide rows={3} placeholder="Concise learner progress summary" />
            {form.supportType !== "no_support_required" ? <FormTextArea label="Support summary" value={form.supportSummary} onChange={(value) => update("supportSummary", value)} wide rows={3} placeholder="What needs to happen next?" /> : null}
          </FormGrid>
        </FormSection>
        {error ? <p className="rounded-xl bg-[#fff0f2] px-4 py-3 text-sm font-semibold text-[#b13b51]">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-[#102c3d]/[0.07] pt-4">
          <button type="button" onClick={onClose} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.1]">Cancel</button>
          <button disabled={saving} className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white disabled:opacity-55">{saving ? "Recording update" : "Record progress update"}</button>
        </div>
      </form>
    </MvpModal>
  );
}

type ReviewFormState = {
  reviewType: LearnerReviewType;
  reviewDate: string;
  nextReviewDate: string;
  reviewerName: string;
  providerId: string;
  summary: string;
  actions: string[];
  supportRequired: string;
  status: LearnerReviewStatus;
};

function ReviewEntryForm({ detail, onClose, onSaved }: { detail: LearnerRecordDetail; onClose: () => void; onSaved: (detail: LearnerRecordDetail, message: string) => void }) {
  const [idempotencyKey] = useState(activityKey);
  const onBreak = detail.lifecycleStatus === "break_in_learning";
  const [form, setForm] = useState<ReviewFormState>({
    reviewType: onBreak ? "l_and_d_check_in" : "provider_review",
    reviewDate: todayDate(),
    nextReviewDate: "",
    reviewerName: onBreak ? "Priya Shah" : "Provider Skills Coach",
    providerId: onBreak ? "" : detail.programme.providerId,
    summary: "",
    actions: [],
    supportRequired: "",
    status: "completed",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update<K extends keyof ReviewFormState>(key: K, value: ReviewFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function changeReviewType(value: LearnerReviewType) {
    const reviewerName = value === "provider_review" ? "Provider Skills Coach" : value === "manager_check_in" ? detail.learner.managerName : value === "l_and_d_check_in" ? "Priya Shah" : "";
    setForm((current) => ({ ...current, reviewType: value, reviewerName, providerId: value === "provider_review" ? detail.programme.providerId : "" }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/levytate-learners/${encodeURIComponent(detail.learnerRecordId)}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, expectedActivityVersion: detail.activityVersion, idempotencyKey }),
      });
      const payload = await response.json() as LearnerMutationResponse;
      if (!response.ok || !payload.learner) throw new Error(payload.message ?? "Review or check-in could not be recorded.");
      onSaved(payload.learner, payload.message ?? `${learnerReviewTypeLabels[form.reviewType]} recorded.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Review or check-in could not be recorded.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <MvpModal title="Record review or check-in" eyebrow="Progress and reviews" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <FormSection title="Review details">
          <FormGrid>
            <FormSelect label="Review type" value={form.reviewType} onChange={(value) => changeReviewType(value as LearnerReviewType)} options={Object.entries(learnerReviewTypeLabels).filter(([value]) => !onBreak || value === "l_and_d_check_in" || value === "manager_check_in").map(([value, label]) => ({ value, label }))} required />
            <FormSelect label="Status" value={form.status} onChange={(value) => update("status", value as LearnerReviewStatus)} options={Object.entries(learnerReviewStatusLabels).map(([value, label]) => ({ value, label }))} required />
            <FormField label={form.reviewType === "manager_check_in" ? "Check-in date" : "Review date"} type="date" value={form.reviewDate} onChange={(value) => update("reviewDate", value)} required />
            <FormField label={form.reviewType === "manager_check_in" || form.reviewType === "l_and_d_check_in" ? "Next check-in date" : "Next review date"} type="date" value={form.nextReviewDate} onChange={(value) => update("nextReviewDate", value)} />
            <FormField label={form.reviewType === "manager_check_in" ? "Manager" : "Reviewer name"} value={form.reviewerName} onChange={(value) => update("reviewerName", value)} required />
            {form.reviewType === "provider_review" ? <FormField label="Provider ID" value={form.providerId} onChange={(value) => update("providerId", value)} required /> : null}
          </FormGrid>
          {form.reviewType === "provider_review" ? <p className="mt-3 text-xs leading-5 text-[#102c3d]/48">Defaults to {detail.programme.providerName}. Provider ownership is validated by the server.</p> : null}
        </FormSection>
        <FormSection title={form.reviewType === "manager_check_in" ? "Workplace application and support" : "Summary and agreed action"}>
          <FormGrid>
            <FormTextArea label={form.reviewType === "manager_check_in" ? "Workplace application" : form.reviewType === "l_and_d_check_in" ? "Learner progress summary" : "Summary"} value={form.summary} onChange={(value) => update("summary", value)} wide rows={3} />
            <FormTagInput label="Agreed actions" values={form.actions} onChange={(value) => update("actions", value)} wide placeholder="Type an action and press Enter" />
            <FormTextArea label={form.reviewType === "manager_check_in" ? "Support available, concerns or blockers" : "Support required"} value={form.supportRequired} onChange={(value) => update("supportRequired", value)} wide rows={3} />
          </FormGrid>
        </FormSection>
        {error ? <p className="rounded-xl bg-[#fff0f2] px-4 py-3 text-sm font-semibold text-[#b13b51]">{error}</p> : null}
        <div className="flex justify-end gap-2 border-t border-[#102c3d]/[0.07] pt-4">
          <button type="button" onClick={onClose} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.1]">Cancel</button>
          <button disabled={saving} className="h-10 rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white disabled:opacity-55">{saving ? "Recording review" : "Record review or check-in"}</button>
        </div>
      </form>
    </MvpModal>
  );
}

type BreakMode = "start" | "manage" | "update" | "return" | "cancel";

function BreakManagementWorkflow({ detail, mode, onModeChange, onClose, onSaved }: { detail: LearnerRecordDetail; mode: BreakMode; onModeChange: (mode: BreakMode) => void; onClose: () => void; onSaved: (detail: LearnerRecordDetail, message: string) => void }) {
  const active = detail.activeBreak;
  if (mode === "manage" && active) {
    return (
      <RecordSection title="Manage break in learning" eyebrow="Controlled lifecycle action">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <InfoBlock label="Started" value={formatDate(active.startDate)} helper={`${detail.breakAttention.daysOnBreak} days on break`} />
            <InfoBlock label="Expected return" value={active.expectedReturnUnknown ? "Not confirmed" : formatDate(active.expectedReturnDate)} helper={detail.breakAttention.label} />
            <InfoBlock label="Reason" value={learnerBreakReasonLabels[active.reasonCategory]} helper={active.reasonNotes || "Concise operational detail only"} />
            <InfoBlock label="Next review" value={formatDate(active.reviewDate) || "Not scheduled"} helper={active.returnPlanNotes || "No return plan has been recorded."} />
          </div>
          <div className="flex flex-wrap gap-2 xl:max-w-[18rem] xl:justify-end">
            <SecondaryRecordAction onClick={() => onModeChange("update")}>Update break details</SecondaryRecordAction>
            <PrimaryRecordAction onClick={() => onModeChange("return")}>Return learner to active learning</PrimaryRecordAction>
            <button type="button" onClick={() => onModeChange("cancel")} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-[#b13b51] ring-1 ring-[#b13b51]/20 transition hover:bg-[#fff0f2]"><XCircle size={14} />Cancel break record</button>
          </div>
        </div>
        <button type="button" onClick={onClose} className="mt-4 text-xs font-semibold text-[#102c3d]/48 hover:text-[#102c3d]">Close break management</button>
      </RecordSection>
    );
  }
  if (mode === "return" && active) return <ReturnFromBreakForm detail={detail} onBack={() => onModeChange("manage")} onSaved={onSaved} />;
  if (mode === "cancel" && active) return <CancelBreakForm detail={detail} onBack={() => onModeChange("manage")} onSaved={onSaved} />;
  return <BreakDetailsForm detail={detail} update={mode === "update"} onBack={() => active ? onModeChange("manage") : onClose()} onSaved={onSaved} />;
}

type BreakDetailsState = {
  startDate: string; expectedReturnDate: string; expectedReturnUnknown: boolean; reviewDate: string;
  reasonCategory: LearnerBreakReasonCategory; reasonNotes: string;
  providerNotified: boolean; providerNotifiedDate: string; employeeNotified: boolean; employeeNotifiedDate: string; managerNotified: boolean; managerNotifiedDate: string;
  returnPlanNotes: string; effectiveLifecycleDate: string; correctedStartDate: string; startDateCorrectionReason: string;
};

function BreakDetailsForm({ detail, update: updating, onBack, onSaved }: { detail: LearnerRecordDetail; update: boolean; onBack: () => void; onSaved: (detail: LearnerRecordDetail, message: string) => void }) {
  const active = detail.activeBreak;
  const [idempotencyKey] = useState(activityKey);
  const [form, setForm] = useState<BreakDetailsState>({
    startDate: active?.startDate || todayDate(), expectedReturnDate: active?.expectedReturnDate || "", expectedReturnUnknown: active?.expectedReturnUnknown || false, reviewDate: active?.reviewDate || "",
    reasonCategory: active?.reasonCategory || "personal_circumstances", reasonNotes: active?.reasonNotes || "",
    providerNotified: active?.providerNotified || false, providerNotifiedDate: active?.providerNotifiedDate || "", employeeNotified: active?.employeeNotified || false, employeeNotifiedDate: active?.employeeNotifiedDate || "", managerNotified: active?.managerNotified || false, managerNotifiedDate: active?.managerNotifiedDate || "",
    returnPlanNotes: active?.returnPlanNotes || "", effectiveLifecycleDate: active?.effectiveLifecycleDate || todayDate(), correctedStartDate: active?.startDate || "", startDateCorrectionReason: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  function set<K extends keyof BreakDetailsState>(key: K, value: BreakDetailsState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const url = updating && active ? `/api/levytate-learners/${encodeURIComponent(detail.learnerRecordId)}/breaks/${encodeURIComponent(active.id)}` : `/api/levytate-learners/${encodeURIComponent(detail.learnerRecordId)}/breaks`;
      const body = updating ? { ...form, startDate: undefined, reasonCategory: undefined, effectiveLifecycleDate: undefined, expectedActivityVersion: detail.activityVersion } : { ...form, correctedStartDate: undefined, startDateCorrectionReason: undefined, expectedActivityVersion: detail.activityVersion, idempotencyKey };
      const response = await fetch(url, { method: updating ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as LearnerMutationResponse;
      if (!response.ok || !payload.learner) throw new Error(payload.message || "Break in learning could not be saved.");
      onSaved(payload.learner, payload.message || (updating ? "Break in learning details updated." : "Break in learning started."));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Break in learning could not be saved."); } finally { setSaving(false); }
  }
  return (
    <MvpModal title={updating ? "Update break details" : "Start break in learning"} eyebrow="Learner lifecycle" onClose={onBack}>
      <form onSubmit={submit} className="grid gap-4">
        <FormSection title="Dates and reason" copy="Record concise operational context. Do not include unnecessary medical detail.">
          <FormGrid>
            {updating ? <FormField label="Corrected break start date" type="date" value={form.correctedStartDate} onChange={(value) => set("correctedStartDate", value)} /> : <FormField label="Break start date" type="date" value={form.startDate} onChange={(value) => set("startDate", value)} required />}
            {!updating ? <FormField label="Effective lifecycle date" type="date" value={form.effectiveLifecycleDate} onChange={(value) => set("effectiveLifecycleDate", value)} required /> : null}
            <FormSelect label="Reason category" value={form.reasonCategory} onChange={(value) => set("reasonCategory", value as LearnerBreakReasonCategory)} options={Object.entries(learnerBreakReasonLabels).map(([value, label]) => ({ value, label }))} required />
            <FormTextArea label="Reason details" value={form.reasonNotes} onChange={(value) => set("reasonNotes", value)} wide rows={3} placeholder="Concise operational context only" />
            {updating && form.correctedStartDate !== active?.startDate ? <FormTextArea label="Start date correction reason" value={form.startDateCorrectionReason} onChange={(value) => set("startDateCorrectionReason", value)} wide rows={2} required /> : null}
          </FormGrid>
        </FormSection>
        <FormSection title="Expected return">
          <FormGrid>
            <BreakCheckbox label="Expected return date unknown" checked={form.expectedReturnUnknown} onChange={(checked) => { set("expectedReturnUnknown", checked); if (checked) set("expectedReturnDate", ""); }} />
            {!form.expectedReturnUnknown ? <FormField label="Expected return date" type="date" value={form.expectedReturnDate} onChange={(value) => set("expectedReturnDate", value)} required /> : <FormField label="Review date" type="date" value={form.reviewDate} onChange={(value) => set("reviewDate", value)} required />}
            {!form.expectedReturnUnknown ? <FormField label="Return-plan review date" type="date" value={form.reviewDate} onChange={(value) => set("reviewDate", value)} /> : null}
            <FormTextArea label="Support or return-plan notes" value={form.returnPlanNotes} onChange={(value) => set("returnPlanNotes", value)} wide rows={3} />
          </FormGrid>
        </FormSection>
        <FormSection title="People informed">
          <div className="grid gap-3 lg:grid-cols-3">
            <NotificationFields label="Provider notified" checked={form.providerNotified} date={form.providerNotifiedDate} onChecked={(value) => set("providerNotified", value)} onDate={(value) => set("providerNotifiedDate", value)} />
            <NotificationFields label="Learner notified" checked={form.employeeNotified} date={form.employeeNotifiedDate} onChecked={(value) => set("employeeNotified", value)} onDate={(value) => set("employeeNotifiedDate", value)} />
            <NotificationFields label="Manager notified" checked={form.managerNotified} date={form.managerNotifiedDate} onChecked={(value) => set("managerNotified", value)} onDate={(value) => set("managerNotifiedDate", value)} />
          </div>
        </FormSection>
        <FormActions error={error} saving={saving} submit={updating ? "Save break details" : "Start break in learning"} onCancel={onBack} />
      </form>
    </MvpModal>
  );
}

function ReturnFromBreakForm({ detail, onBack, onSaved }: { detail: LearnerRecordDetail; onBack: () => void; onSaved: (detail: LearnerRecordDetail, message: string) => void }) {
  const active = detail.activeBreak!;
  const [idempotencyKey] = useState(activityKey);
  const [form, setForm] = useState({ actualReturnDate: todayDate(), returnConfirmationNote: "", programmeStillValidConfirmed: false, providerReturnConfirmed: false, managerReturnConfirmed: false, learnerReturnConfirmed: false, revisedExpectedEndDate: "", revisedReviewDate: "", immediateSupportAction: "", progressResetNote: "", firstCheckInDate: "" });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  function set(key: keyof typeof form, value: string | boolean) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); try { const response = await fetch(`/api/levytate-learners/${encodeURIComponent(detail.learnerRecordId)}/breaks/${encodeURIComponent(active.id)}/return`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, expectedActivityVersion: detail.activityVersion, idempotencyKey }) }); const payload = await response.json() as LearnerMutationResponse; if (!response.ok || !payload.learner) throw new Error(payload.message || "Learner could not be returned to active learning."); onSaved(payload.learner, payload.message || "Learner returned to active learning."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Learner could not be returned to active learning."); } finally { setSaving(false); } }
  return <MvpModal title="Return learner to active learning" eyebrow="Break in learning" onClose={onBack}><form onSubmit={submit} className="grid gap-4"><FormSection title="Return confirmation"><FormGrid><FormField label="Actual return date" type="date" value={form.actualReturnDate} onChange={(value) => set("actualReturnDate", value)} required /><FormTextArea label="Return confirmation note" value={form.returnConfirmationNote} onChange={(value) => set("returnConfirmationNote", value)} wide rows={3} required /><BreakCheckbox label="Current programme remains valid" checked={form.programmeStillValidConfirmed} onChange={(value) => set("programmeStillValidConfirmed", value)} /><BreakCheckbox label="Provider return confirmed" checked={form.providerReturnConfirmed} onChange={(value) => set("providerReturnConfirmed", value)} /><BreakCheckbox label="Manager informed" checked={form.managerReturnConfirmed} onChange={(value) => set("managerReturnConfirmed", value)} /><BreakCheckbox label="Learner informed" checked={form.learnerReturnConfirmed} onChange={(value) => set("learnerReturnConfirmed", value)} /></FormGrid></FormSection><FormSection title="Revised plan"><FormGrid><FormField label="Revised expected end date" type="date" value={form.revisedExpectedEndDate} onChange={(value) => set("revisedExpectedEndDate", value)} /><FormField label="Revised review date" type="date" value={form.revisedReviewDate} onChange={(value) => set("revisedReviewDate", value)} /><FormField label="First check-in after return" type="date" value={form.firstCheckInDate} onChange={(value) => set("firstCheckInDate", value)} /><FormTextArea label="Immediate support action" value={form.immediateSupportAction} onChange={(value) => set("immediateSupportAction", value)} wide rows={2} /><FormTextArea label="Progress reset note" value={form.progressResetNote} onChange={(value) => set("progressResetNote", value)} wide rows={2} /></FormGrid></FormSection><FormActions error={error} saving={saving} submit="Return learner to active learning" onCancel={onBack} /></form></MvpModal>;
}

function CancelBreakForm({ detail, onBack, onSaved }: { detail: LearnerRecordDetail; onBack: () => void; onSaved: (detail: LearnerRecordDetail, message: string) => void }) {
  const active = detail.activeBreak!; const [reason, setReason] = useState(""); const [idempotencyKey] = useState(activityKey); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); try { const response = await fetch(`/api/levytate-learners/${encodeURIComponent(detail.learnerRecordId)}/breaks/${encodeURIComponent(active.id)}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cancellationReason: reason, expectedActivityVersion: detail.activityVersion, idempotencyKey }) }); const payload = await response.json() as LearnerMutationResponse; if (!response.ok || !payload.learner) throw new Error(payload.message || "Break record could not be cancelled."); onSaved(payload.learner, payload.message || "Break in learning record cancelled."); } catch (caught) { setError(caught instanceof Error ? caught.message : "Break record could not be cancelled."); } finally { setSaving(false); } }
  return <MvpModal title="Cancel break record" eyebrow="Incorrect record only" onClose={onBack}><form onSubmit={submit} className="grid gap-4"><p className="rounded-xl border border-[#b13b51]/15 bg-[#fff0f2] p-4 text-sm leading-6 text-[#8f3043]">Use this only when the learner did not genuinely pause learning. The cancelled record remains in the lifecycle history.</p><FormTextArea label="Cancellation reason" value={reason} onChange={setReason} rows={4} required /><FormActions error={error} saving={saving} submit="Cancel break record" onCancel={onBack} danger /></form></MvpModal>;
}

function ActiveBreakBanner({ detail }: { detail: LearnerRecordDetail }) {
  const active = detail.activeBreak!;
  const returnCopy = active.expectedReturnUnknown ? "An expected return date has not yet been confirmed." : detail.breakAttention.state === "overdue" ? `Expected return was ${formatDate(active.expectedReturnDate)} and is now overdue.` : `Expected return ${formatDate(active.expectedReturnDate)}.`;
  return <section className="rounded-xl border border-[#b89220]/20 bg-[#fff9e7] px-5 py-4"><div className="flex items-start gap-3"><CalendarClock className="mt-0.5 shrink-0 text-[#8a6b00]" size={20} /><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a6b00]">Break in learning</p><p className="mt-1 text-base font-semibold leading-6 text-[#102c3d]">On a break in learning since {formatDate(active.startDate)}. {returnCopy}</p><p className="mt-1 text-sm leading-6 text-[#102c3d]/58">Next action: {detail.breakAttention.label}.</p></div></div></section>;
}

function NotificationFields({ label, checked, date, onChecked, onDate }: { label: string; checked: boolean; date: string; onChecked: (value: boolean) => void; onDate: (value: string) => void }) { return <div className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-3"><BreakCheckbox label={label} checked={checked} onChange={onChecked} />{checked ? <div className="mt-3"><FormField label="Notification date" type="date" value={date} onChange={onDate} required /></div> : null}</div>; }
function BreakCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[#102c3d]/[0.08] bg-white px-3 text-sm font-semibold text-[#102c3d]/70"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[#159b8f]" />{label}</label>; }
function FormActions({ error, saving, submit, onCancel, danger = false }: { error: string; saving: boolean; submit: string; onCancel: () => void; danger?: boolean }) { return <div>{error ? <p className="mb-4 rounded-xl bg-[#fff0f2] px-4 py-3 text-sm font-semibold text-[#b13b51]">{error}</p> : null}<div className="flex flex-wrap justify-end gap-2 border-t border-[#102c3d]/[0.07] pt-4"><button type="button" onClick={onCancel} className="h-10 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.1]">Back</button><button disabled={saving} className={`h-10 rounded-full px-5 text-xs font-semibold text-white disabled:opacity-55 ${danger ? "bg-[#b13b51]" : "bg-[#102c3d]"}`}>{saving ? "Saving" : submit}</button></div></div>; }

type PreEnrolmentForm = {
  employmentRoute: string;
  eligibilityVerificationStatus: string;
  eligibilityNotes: string;
  probationStatus: string;
  probationPassedDate: string;
  probationNotes: string;
  hrApprovalStatus: string;
  hrApprovedDate: string;
  hrApprovalNotes: string;
  programmeId: string;
  providerId: string;
  applicationId: string;
  expectedStartDate: string;
  actualStartDate: string;
  expectedEndDate: string;
  programmeChangeReason: string;
  guidesSent: boolean;
  guidesSentDate: string;
  guidesVersion: string;
  guidesRecipientSummary: string;
  guidesNotes: string;
};

function PreEnrolmentWorkflow({ detail, onCancel, onSaved, onEnrolled }: { detail: LearnerRecordDetail; onCancel: () => void; onSaved: (detail: LearnerRecordDetail, message: string) => void; onEnrolled: (detail: LearnerRecordDetail) => void }) {
  const [form, setForm] = useState<PreEnrolmentForm>(() => ({
    employmentRoute: detail.employmentRoute === "not_confirmed" ? "existing_employee_upskill" : detail.employmentRoute,
    eligibilityVerificationStatus: detail.eligibilityDeclaration?.verificationStatus === "employer_verified" ? "employer_verified" : detail.eligibilityDeclaration?.verificationStatus === "not_eligible" ? "not_eligible" : detail.eligibilityDeclaration?.verificationStatus === "needs_review" ? "needs_review" : "employer_verified",
    eligibilityNotes: detail.eligibilityDeclaration?.notes ?? "",
    probationStatus: detail.preEnrolmentChecks?.probationStatus ?? "awaiting_confirmation",
    probationPassedDate: detail.preEnrolmentChecks?.probationPassedDate ?? "",
    probationNotes: detail.preEnrolmentChecks?.probationNotes ?? "",
    hrApprovalStatus: detail.preEnrolmentChecks?.hrApprovalStatus ?? "awaiting_approval",
    hrApprovedDate: detail.preEnrolmentChecks?.hrApprovedDate ?? "",
    hrApprovalNotes: detail.preEnrolmentChecks?.hrApprovalNotes ?? "",
    programmeId: detail.programme.programmeId,
    providerId: detail.programme.providerId,
    applicationId: detail.programme.applicationReference,
    expectedStartDate: detail.expectedStartDate,
    actualStartDate: detail.actualStartDate,
    expectedEndDate: detail.expectedEndDate,
    programmeChangeReason: "",
    guidesSent: Boolean(detail.preEnrolmentChecks?.guidesSent),
    guidesSentDate: detail.preEnrolmentChecks?.guidesSentDate ?? "",
    guidesVersion: detail.preEnrolmentChecks?.guidesVersion || "2026 learner and manager guide pack",
    guidesRecipientSummary: "",
    guidesNotes: detail.preEnrolmentChecks?.guidesNotes ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState("");
  const readiness = detail.enrolmentReadiness;

  function update<K extends keyof PreEnrolmentForm>(key: K, value: PreEnrolmentForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProgress() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/levytate-learners/${encodeURIComponent(detail.learnerRecordId)}/pre-enrolment`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedUpdatedAt: detail.updatedAt,
          employmentRoute: form.employmentRoute,
          eligibilityVerification: {
            verificationStatus: form.eligibilityVerificationStatus,
            notes: form.eligibilityNotes,
          },
          probation: {
            probationStatus: form.probationStatus,
            probationPassedDate: form.probationPassedDate,
            probationNotes: form.probationNotes,
          },
          hrApproval: {
            hrApprovalStatus: form.hrApprovalStatus,
            hrApprovedDate: form.hrApprovedDate,
            hrApprovalNotes: form.hrApprovalNotes,
          },
          programme: {
            programmeId: form.programmeId,
            providerId: form.providerId,
            applicationId: form.applicationId,
            expectedStartDate: form.expectedStartDate,
            actualStartDate: form.actualStartDate,
            expectedEndDate: form.expectedEndDate,
            changeReason: form.programmeChangeReason,
          },
          guides: {
            guidesSent: form.guidesSent,
            guidesSentDate: form.guidesSentDate,
            guidesVersion: form.guidesVersion,
            recipientSummary: form.guidesRecipientSummary,
            guidesNotes: form.guidesNotes,
          },
        }),
      });
      const payload = (await response.json()) as LearnerMutationResponse;
      if (!response.ok || !payload.learner) throw new Error(payload.message ?? "Pre-enrolment progress could not be saved.");
      onSaved(payload.learner, "Pre-enrolment progress saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Pre-enrolment progress could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function markEnrolled() {
    setEnrolling(true);
    setError("");
    try {
      const response = await fetch(`/api/levytate-learners/${encodeURIComponent(detail.learnerRecordId)}/enrol`, { method: "POST" });
      const payload = (await response.json()) as LearnerMutationResponse;
      if (!response.ok || !payload.learner) throw new Error(payload.message ?? "Learner could not be marked as enrolled.");
      onEnrolled(payload.learner);
    } catch (enrolError) {
      setError(enrolError instanceof Error ? enrolError.message : "Learner could not be marked as enrolled.");
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <section className="rounded-xl border border-[#102c3d]/[0.075] bg-white shadow-[0_18px_46px_rgba(16,44,61,0.07)]">
      <div className="flex flex-col gap-3 border-b border-[#102c3d]/[0.06] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Pre-enrolment workflow</p>
          <h3 className="mt-0.5 text-xl font-semibold text-[#102c3d]">Complete pre-enrolment</h3>
          <p className="mt-1 text-sm leading-6 text-[#102c3d]/56">Record the employer-controlled checks needed before {detail.learner.name} can become an active learner.</p>
        </div>
        <button type="button" onClick={onCancel} className="inline-flex h-10 w-fit items-center justify-center rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/62 ring-1 ring-[#102c3d]/[0.1] transition hover:bg-[#f8fbfa]">
          Return to read-only record
        </button>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="grid gap-4">
          <FormSection title="Employment route">
            <FormGrid>
              <FormSelect label="Employment route" value={form.employmentRoute} onChange={(value) => update("employmentRoute", value)} options={[
                { value: "existing_employee_upskill", label: "Existing employee - upskill" },
                { value: "recruited_as_apprentice", label: "Recruited as an apprentice" },
              ]} />
              <InfoBlock label="Current route" value={detail.employmentRouteLabel} helper="Saved on the learner record" />
            </FormGrid>
          </FormSection>

          <FormSection title="England working-hours declaration" copy="The employee declaration is historical evidence and cannot be rewritten by the employer.">
            <div className="mb-4 rounded-xl border border-[#102c3d]/[0.06] bg-white p-4 text-sm leading-6 text-[#102c3d]/66">
              <p className="font-semibold text-[#102c3d]">Employee declaration wording</p>
              <p className="mt-1">&ldquo;{detail.eligibilityDeclaration?.declarationWording || "I confirm that I expect to spend at least 50% of my working hours in England over the duration of the apprenticeship."}&rdquo;</p>
              <div className="mt-3 grid gap-2 text-xs font-semibold text-[#102c3d]/52 sm:grid-cols-2">
                <p>Status: {detail.eligibilityDeclaration?.confirmed ? "Employee confirmed" : "Not confirmed"}</p>
                <p>Date: {formatDate(detail.eligibilityDeclaration?.confirmedAt) || "Not recorded"}</p>
                <p>Expected England hours: {detail.eligibilityDeclaration?.expectedEnglandWorkingHoursPercentage ?? "Not recorded"}%</p>
                <p>Version: {detail.eligibilityDeclaration?.declarationVersion || "Not recorded"}</p>
              </div>
            </div>
            <FormGrid>
              <FormSelect label="Employer verification status" value={form.eligibilityVerificationStatus} onChange={(value) => update("eligibilityVerificationStatus", value)} options={[
                { value: "employer_verified", label: "Employer verified" },
                { value: "needs_review", label: "Needs review" },
                { value: "not_eligible", label: "Not eligible" },
              ]} />
              <FormTextArea label="Verification note" value={form.eligibilityNotes} onChange={(value) => update("eligibilityNotes", value)} rows={3} placeholder="Required for needs review or not eligible" />
            </FormGrid>
          </FormSection>

          <FormSection title="Probation">
            <FormGrid>
              <FormSelect label="Probation status" value={form.probationStatus} onChange={(value) => update("probationStatus", value)} options={[
                { value: "awaiting_confirmation", label: "Awaiting confirmation" },
                { value: "passed", label: "Passed" },
                { value: "not_passed", label: "Not passed" },
                { value: "under_review", label: "Under review" },
                { value: "not_required", label: "Not required" },
              ]} />
              <FormField label="Probation passed date" type="date" value={form.probationPassedDate} onChange={(value) => update("probationPassedDate", value)} />
              <FormTextArea label="Probation note" value={form.probationNotes} onChange={(value) => update("probationNotes", value)} wide rows={3} />
            </FormGrid>
          </FormSection>

          <FormSection title="HR approval">
            <FormGrid>
              <FormSelect label="HR approval status" value={form.hrApprovalStatus} onChange={(value) => update("hrApprovalStatus", value)} options={[
                { value: "not_requested", label: "Not requested" },
                { value: "awaiting_approval", label: "Awaiting approval" },
                { value: "approved", label: "Approved" },
                { value: "declined", label: "Declined" },
                { value: "more_information_required", label: "More information required" },
              ]} />
              <FormField label="HR approval date" type="date" value={form.hrApprovedDate} onChange={(value) => update("hrApprovedDate", value)} />
              <FormTextArea label="HR approval note" value={form.hrApprovalNotes} onChange={(value) => update("hrApprovalNotes", value)} wide rows={3} />
            </FormGrid>
          </FormSection>

          <FormSection title="Programme, provider and dates" copy="Programme and provider are shown from the connected application or learner record. If these change, record why.">
            <FormGrid>
              <FormField label="Programme ID" value={form.programmeId} onChange={(value) => update("programmeId", value)} />
              <FormField label="Provider ID" value={form.providerId} onChange={(value) => update("providerId", value)} />
              <FormField label="Linked application" value={form.applicationId} onChange={(value) => update("applicationId", value)} />
              <FormField label="Expected start date" type="date" value={form.expectedStartDate} onChange={(value) => update("expectedStartDate", value)} />
              <FormField label="Actual start date" type="date" value={form.actualStartDate} onChange={(value) => update("actualStartDate", value)} />
              <FormField label="Expected end date" type="date" value={form.expectedEndDate} onChange={(value) => update("expectedEndDate", value)} />
              <FormTextArea label="Programme/provider change reason" value={form.programmeChangeReason} onChange={(value) => update("programmeChangeReason", value)} wide rows={3} />
            </FormGrid>
          </FormSection>

          <FormSection title="Guides">
            <FormGrid>
              <label className="flex h-11 items-center gap-2 rounded-lg border border-[#102c3d]/[0.09] bg-[#f8fbfa] px-3 text-sm font-semibold text-[#102c3d]/70">
                <input type="checkbox" checked={form.guidesSent} onChange={(event) => update("guidesSent", event.target.checked)} className="h-4 w-4 accent-[#159b8f]" />
                Guides sent
              </label>
              <FormField label="Guides sent date" type="date" value={form.guidesSentDate} onChange={(value) => update("guidesSentDate", value)} />
              <FormField label="Guide version" value={form.guidesVersion} onChange={(value) => update("guidesVersion", value)} />
              <FormField label="Recipient summary" value={form.guidesRecipientSummary} onChange={(value) => update("guidesRecipientSummary", value)} placeholder="Learner and line manager" />
              <FormTextArea label="Guides note" value={form.guidesNotes} onChange={(value) => update("guidesNotes", value)} wide rows={3} />
            </FormGrid>
          </FormSection>
        </div>

        <aside className="grid content-start gap-4">
          <section className="rounded-xl border border-[#102c3d]/[0.075] bg-[#f8fbfa] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Enrolment readiness</p>
            <h4 className="mt-2 text-lg font-semibold text-[#102c3d]">{readiness.readyForEnrolment ? "Ready for enrolment" : "Checks outstanding"}</h4>
            <p className="mt-1 text-sm leading-6 text-[#102c3d]/56">{readiness.readyForEnrolment ? "All mandatory checks are complete." : `${readiness.blockingChecks.length} blocking check${readiness.blockingChecks.length === 1 ? "" : "s"} remain.`}</p>
            <div className="mt-4 grid gap-2">
              {readiness.checks.map((check) => (
                <div key={check.id} className="rounded-lg border border-[#102c3d]/[0.06] bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-[#102c3d]">{check.label}</p>
                    <StatusBadge tone={statusTone(check.status)}>{check.status}</StatusBadge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#102c3d]/50">{check.message}</p>
                </div>
              ))}
            </div>
          </section>

          {error ? <p className="rounded-xl bg-[#fff0f2] px-4 py-3 text-sm font-semibold text-[#b13b51]">{error}</p> : null}

          <div className="rounded-xl border border-[#102c3d]/[0.075] bg-white p-4">
            <button type="button" onClick={saveProgress} disabled={saving || enrolling} className="flex h-11 w-full items-center justify-center rounded-full bg-[#102c3d] px-5 text-xs font-semibold text-white transition hover:bg-[#17394d] disabled:cursor-not-allowed disabled:opacity-55">
              {saving ? "Saving progress" : "Save progress"}
            </button>
            <button type="button" onClick={markEnrolled} disabled={enrolling || saving || !readiness.readyForEnrolment} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#159b8f] px-5 text-xs font-semibold text-white transition hover:bg-[#0f867b] disabled:cursor-not-allowed disabled:bg-[#102c3d]/18 disabled:text-[#102c3d]/42">
              <CheckCircle2 size={15} /> {enrolling ? "Marking enrolled" : "Mark as enrolled"}
            </button>
            {!readiness.readyForEnrolment ? <p className="mt-3 text-xs leading-5 text-[#102c3d]/48">The server will also block enrolment until every mandatory readiness check is complete.</p> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

function SummaryTile({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "green" | "yellow" | "red" | "blue" }) {
  return (
    <div className="rounded-xl border border-[#102c3d]/[0.07] bg-white px-4 py-3 shadow-[0_12px_28px_rgba(16,44,61,0.04)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tracking-[-0.03em] ${toneClass(tone)}`}>{value}</p>
    </div>
  );
}

function CompactSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 min-w-0 rounded-lg border border-[#102c3d]/[0.09] bg-white px-3 text-sm font-semibold normal-case tracking-normal text-[#102c3d]/72 outline-none">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function ProgressMini({ learner }: { learner: LearnerOperationalSummary }) {
  if (learner.activeBreak) return <div className="min-w-[9rem] text-xs leading-5 text-[#756000]"><p className="font-semibold">Progress paused</p><p>{learner.breakAttention.label}</p></div>;
  if (!learner.latestProgress) return <p className="text-xs text-[#102c3d]/46">No progress data</p>;
  return (
    <div className="min-w-[9rem]">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[#102c3d]/62">
        <span>{learner.latestProgress.actualProgressPercentage}% actual</span>
        <span>{learner.progressPosition}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-[#edf3ef]">
        <div className={`h-2 rounded-full ${learner.latestProgress.variancePercentage <= -3 ? "bg-[#c95568]" : "bg-[#159b8f]"}`} style={{ width: `${Math.min(100, Math.max(0, learner.latestProgress.actualProgressPercentage))}%` }} />
      </div>
      <p className="mt-1 text-xs text-[#102c3d]/42">Target {learner.latestProgress.targetProgressPercentage}% · {learner.latestProgress.variancePercentage > 0 ? "+" : ""}{learner.latestProgress.variancePercentage} pts</p>
    </div>
  );
}

function RecordSection({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-[#102c3d]/[0.075] bg-white shadow-[0_14px_36px_rgba(16,44,61,0.045)]">
      <div className="border-b border-[#102c3d]/[0.06] px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{eyebrow}</p>
        <h3 className="mt-0.5 text-lg font-semibold text-[#102c3d]">{title}</h3>
      </div>
      <div className="min-w-0 p-5">{children}</div>
    </section>
  );
}

function InfoBlock({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-xl border border-[#102c3d]/[0.06] bg-white px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">{label}</p>
      <p className="mt-1.5 text-sm font-semibold leading-5 text-[#102c3d]">{value || "Not recorded"}</p>
      {helper ? <p className="mt-1 text-xs leading-5 text-[#102c3d]/46">{helper}</p> : null}
    </div>
  );
}

function CheckCard({ title, status, lines }: { title: string; status: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-[#102c3d]/[0.06] bg-[#fbfcfb] p-4">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-[#102c3d]">{title}</h4>
        <StatusBadge tone={statusTone(status)}>{status}</StatusBadge>
      </div>
      <div className="mt-3 grid gap-1.5 text-xs leading-5 text-[#102c3d]/56">
        {lines.filter(Boolean).map((line) => <p key={line}>{line}</p>)}
      </div>
    </div>
  );
}

function ReviewCard({ title, review, overdue, empty }: { title: string; review: LearnerRecordDetail["latestProviderReview"]; overdue?: boolean; empty: string }) {
  return (
    <div className="rounded-xl border border-[#102c3d]/[0.06] bg-[#fbfcfb] p-4">
      <div className="flex items-start justify-between gap-3"><h4 className="text-sm font-semibold text-[#102c3d]">{title}</h4>{overdue ? <StatusBadge tone="red">Overdue</StatusBadge> : null}</div>
      {review ? (
        <div className="mt-3 grid gap-1.5 text-xs leading-5 text-[#102c3d]/56">
          <p>Latest: {formatDate(review.reviewDate)}</p>
          <p>Next: {formatDate(review.nextReviewDate) || "Not scheduled"}</p>
          <p>Reviewer: {review.reviewerName || "Not recorded"}</p>
          <p>Status: {humanise(review.status)}</p>
          <p className="pt-1 text-sm leading-6 text-[#102c3d]/68">{review.summary}</p>
          {review.supportRequired ? <p className="font-semibold text-[#0b6f63]">{review.supportRequired}</p> : null}
        </div>
      ) : <p className="mt-3 text-xs leading-5 text-[#102c3d]/46">{empty}</p>}
    </div>
  );
}

function InfoGroup({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return (
    <div className="rounded-xl border border-[#102c3d]/[0.06] bg-[#fbfcfb] p-4">
      <h4 className="text-sm font-semibold text-[#102c3d]">{title}</h4>
      <dl className="mt-3 grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 border-t border-[#102c3d]/[0.05] pt-2 first:border-t-0 first:pt-0 sm:grid-cols-[11rem_minmax(0,1fr)]">
            <dt className="text-xs font-semibold uppercase tracking-[0.1em] text-[#102c3d]/38">{label}</dt>
            <dd className="text-[#102c3d]/68">{value || "Not recorded"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function HistoryTable({ headings, rows, empty }: { headings: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <InlineEmpty copy={empty} />;
  return (
    <div className="overflow-x-auto rounded-xl border border-[#102c3d]/[0.07]">
      <table className="min-w-[680px] w-full border-collapse text-left text-sm">
        <thead className="bg-[#f8fbfa] text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/42">
          <tr>{headings.map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-[#102c3d]/[0.055] bg-white">
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="px-4 py-3 text-[#102c3d]/64">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineEmpty({ copy }: { copy: string }) {
  return <div className="rounded-xl border border-dashed border-[#102c3d]/[0.14] bg-[#f8fbfa] px-4 py-6 text-sm font-medium text-[#102c3d]/52">{copy}</div>;
}

function ActionEmpty({ copy, action, onAction }: { copy: string; action: string; onAction: () => void }) {
  return <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-dashed border-[#102c3d]/[0.14] bg-[#f8fbfa] px-4 py-5 sm:flex-row sm:items-center"><p className="text-sm font-medium text-[#102c3d]/52">{copy}</p><SecondaryRecordAction onClick={onAction}>{action}</SecondaryRecordAction></div>;
}

function PrimaryRecordAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(16,44,61,0.12)] transition hover:-translate-y-0.5 hover:bg-[#17394d]"><Plus size={14} />{children}</button>;
}

function SecondaryRecordAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-[#102c3d]/68 ring-1 ring-[#102c3d]/[0.1] transition hover:bg-[#f8fbfa] hover:text-[#102c3d]"><Plus size={14} />{children}</button>;
}

function nextActionNarrative(detail: LearnerRecordDetail) {
  if (detail.activeBreak) return `The learner is on a break in learning. ${detail.breakAttention.reasons.join(". ")}.`;
  if (detail.latestProgress && detail.latestProgress.variancePercentage < -2) {
    return `Actual progress is ${formatProgressVariance(detail.latestProgress.variancePercentage).toLowerCase()} A learner support check-in is recommended.`;
  }
  if (detail.attention.needsAttention) return detail.attention.reasons.join(". ") + ".";
  return "Eligibility, progress and operational checks do not show an immediate priority.";
}

function breakDurationLabel(record: LearnerRecordDetail["breaksInLearning"][number]) {
  const end = record.actualReturnDate || record.cancelledAt?.slice(0, 10) || todayDate();
  const days = Math.max(0, Math.floor((new Date(`${end}T00:00:00Z`).getTime() - new Date(`${record.startDate}T00:00:00Z`).getTime()) / 86_400_000));
  return `${days} day${days === 1 ? "" : "s"}`;
}

function breakOutcome(record: LearnerRecordDetail["breaksInLearning"][number]) {
  if (record.status === "returned") return record.returnConfirmationNote || "Learner returned to active learning.";
  if (record.status === "cancelled") return record.cancellationReason || "Break record cancelled.";
  if (record.status === "converted_to_withdrawal") return "Converted to withdrawal.";
  return record.returnPlanNotes || "No return plan has been recorded.";
}

function probationStatus(detail: LearnerRecordDetail) {
  const status = detail.preEnrolmentChecks?.probationStatus;
  if (status === "passed" || status === "not_required") return "Complete";
  if (status === "under_review") return "Needs review";
  return "Outstanding";
}

function hrStatus(detail: LearnerRecordDetail) {
  const status = detail.preEnrolmentChecks?.hrApprovalStatus;
  if (status === "approved") return "Complete";
  if (status === "more_information_required") return "Needs review";
  if (status === "declined") return "Needs review";
  return "Outstanding";
}

function toneClass(tone: "neutral" | "green" | "yellow" | "red" | "blue") {
  if (tone === "green") return "text-[#0b6f63]";
  if (tone === "yellow") return "text-[#756000]";
  if (tone === "red") return "text-[#b13b51]";
  if (tone === "blue") return "text-[#315e78]";
  return "text-[#102c3d]";
}

function formatDate(value: string | undefined | null) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function activityKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : `${Date.now()}${Math.random().toString(36).slice(2)}`;
}

function formatDateTime(value: string | undefined | null) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value) || value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function humanise(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
