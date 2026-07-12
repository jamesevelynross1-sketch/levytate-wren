"use client";

import { ArrowLeft, CheckCircle2, ChevronDown, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { EmptyState, FormField, FormGrid, FormSection, FormSelect, FormTagInput, FormTextArea, MvpModal, MvpPanel, StatusBadge, TableAction, TableBody, TableHead, TableShell } from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { includesSearch, statusTone } from "@/components/levytate-mvp/module-utils";
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
  learnerProgressSourceLabels,
  learnerReviewStatusLabels,
  learnerReviewTypeLabels,
  learnerSupportActionLabels,
  type LearnerProgressSource,
  type LearnerReviewStatus,
  type LearnerReviewType,
  type LearnerSupportActionType,
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

export function LearnersModule() {
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
        onDetailUpdated={(next) => {
          setDetail(next);
          setLearners((current) => current.map((learner) => learner.learnerRecordId === next.learnerRecordId ? next : learner));
        }}
      />
    );
  }

  return (
    <div className="grid min-w-0 gap-5">
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
                  <td className="px-4 py-3"><StatusBadge tone={statusTone(learner.lifecycleStatusLabel)}>{learner.lifecycleStatusLabel}</StatusBadge></td>
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

function LearnerRecordView({ detail, loading, error, onBack, mayMutatePreEnrolment, mayMutateLearnerActivity, onDetailUpdated }: { detail: LearnerRecordDetail | null; loading: boolean; error: string; onBack: () => void; mayMutatePreEnrolment: boolean; mayMutateLearnerActivity: boolean; onDetailUpdated: (detail: LearnerRecordDetail) => void }) {
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [activityMode, setActivityMode] = useState<"progress" | "review" | "">("");
  const [reviewFilter, setReviewFilter] = useState<LearnerReviewType | "all">("all");
  const [success, setSuccess] = useState("");

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

  return (
    <div className="grid min-w-0 gap-5">
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
          </div>
          <div className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Next action</p>
            <p className="mt-2 text-lg font-semibold leading-7 text-[#102c3d]">{detail.attention.label}</p>
            <p className="mt-3 text-sm leading-6 text-[#102c3d]/58">{nextActionNarrative(detail)}</p>
          </div>
        </div>
      </section>

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
                ["Reason", breakRecord.reasonCategory],
                ["Status", humanise(breakRecord.status)],
                ["Recorded by", breakRecord.recordedBy],
                ["Notes", breakRecord.reasonNotes || "No notes recorded"],
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
        ) : <InlineEmpty copy="No break in learning or withdrawal has been recorded." />}
      </RecordSection>

      <RecordSection title="Assessment and gateway" eyebrow="Completion path">
        {detail.assessmentReadiness ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <InfoGroup title="Assessment readiness" rows={[
              ["Assessment model", humanise(detail.assessmentReadiness.assessmentModel)],
              ["Assessment status", humanise(detail.assessmentReadiness.assessmentStatus)],
              ["Expected readiness", formatDate(detail.assessmentReadiness.expectedAssessmentReadinessDate) || "Not recorded"],
              ["Actual readiness", formatDate(detail.assessmentReadiness.actualAssessmentReadinessDate) || "Not recorded"],
              ["Gateway date", formatDate(detail.assessmentReadiness.gatewayDate) || "Not recorded"],
              ["Assessment organisation", detail.assessmentReadiness.assessmentOrganisation || "Not confirmed"],
              ["Notes", detail.assessmentReadiness.assessmentNotes || "No notes recorded"],
            ]} />
            {detail.achievement ? <InfoGroup title="Achievement" rows={[
              ["Expected achievement", formatDate(detail.achievement.expectedAchievementDate) || "Not recorded"],
              ["Actual achievement", formatDate(detail.achievement.actualAchievementDate) || "Not recorded"],
              ["Grade", detail.achievement.grade || "No grade recorded"],
              ["Grade type", detail.achievement.gradeType || "Not recorded"],
              ["Certificate received", detail.achievement.certificateReceived ? `Yes, ${formatDate(detail.achievement.certificateReceivedDate)}` : "No"],
              ["Notes", detail.achievement.resultNotes || "No notes recorded"],
            ]} /> : <InlineEmpty copy="Achievement has not yet been recorded." />}
          </div>
        ) : <InlineEmpty copy="Assessment readiness has not yet been recorded." />}
      </RecordSection>

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
  const [form, setForm] = useState<ReviewFormState>({
    reviewType: "provider_review",
    reviewDate: todayDate(),
    nextReviewDate: "",
    reviewerName: "Provider Skills Coach",
    providerId: detail.programme.providerId,
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
            <FormSelect label="Review type" value={form.reviewType} onChange={(value) => changeReviewType(value as LearnerReviewType)} options={Object.entries(learnerReviewTypeLabels).map(([value, label]) => ({ value, label }))} required />
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
  if (detail.latestProgress && detail.latestProgress.variancePercentage < -2) {
    return `Actual progress is ${formatProgressVariance(detail.latestProgress.variancePercentage).toLowerCase()} A learner support check-in is recommended.`;
  }
  if (detail.activeBreak) return "The learner is currently on a break in learning. Confirm return planning and support before activity resumes.";
  if (detail.attention.needsAttention) return detail.attention.reasons.join(". ") + ".";
  return "Eligibility, progress and operational checks do not show an immediate priority.";
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
