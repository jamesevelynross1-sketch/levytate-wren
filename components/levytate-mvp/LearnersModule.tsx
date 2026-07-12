"use client";

import { ArrowLeft, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EmptyState, MvpPanel, StatusBadge, TableAction, TableBody, TableHead, TableShell } from "@/components/levytate-mvp/MvpUi";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import { includesSearch, statusTone } from "@/components/levytate-mvp/module-utils";
import {
  formatProgressVariance,
  operationalActionLabel,
  type LearnerListSummary,
  type LearnerOperationalSummary,
  type LearnerProgressPosition,
  type LearnerRecordDetail,
} from "@/lib/levytate/mvp/learner-record-view";

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
  message?: string;
};

type SortMode = "Operational priority" | "Learner name" | "Lifecycle status";

const allOption = "All";
const progressOptions: Array<LearnerProgressPosition | typeof allOption> = [
  allOption,
  "Ahead of target",
  "On target",
  "Behind target",
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
      />
    );
  }

  return (
    <div className="grid gap-5">
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

function LearnerRecordView({ detail, loading, error, onBack }: { detail: LearnerRecordDetail | null; loading: boolean; error: string; onBack: () => void }) {
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

  return (
    <div className="grid gap-5">
      <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-[#102c3d]/68 ring-1 ring-[#102c3d]/[0.08] transition hover:bg-[#f8fbfa] hover:text-[#102c3d]">
        <ArrowLeft size={15} /> Back to learners
      </button>

      <section className="rounded-xl border border-[#102c3d]/[0.075] bg-white p-5 shadow-[0_14px_36px_rgba(16,44,61,0.045)]">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.55fr)]">
          <div>
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
          </div>
          <div className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b6f63]">Next action</p>
            <p className="mt-2 text-lg font-semibold leading-7 text-[#102c3d]">{detail.attention.label}</p>
            <p className="mt-3 text-sm leading-6 text-[#102c3d]/58">{nextActionNarrative(detail)}</p>
          </div>
        </div>
      </section>

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

      <RecordSection title="Progress" eyebrow="Pace">
        {detail.latestProgress ? (
          <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-xl border border-[#102c3d]/[0.07] bg-[#f8fbfa] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">Latest snapshot</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <InfoBlock label="Target" value={`${detail.latestProgress.targetProgressPercentage}%`} />
                <InfoBlock label="Actual" value={`${detail.latestProgress.actualProgressPercentage}%`} />
              </div>
              <p className="mt-3 text-sm font-semibold text-[#102c3d]">{formatProgressVariance(detail.latestProgress.variancePercentage)}</p>
              <p className="mt-2 text-sm leading-6 text-[#102c3d]/58">{detail.latestProgress.summary}</p>
              {detail.latestProgress.supportAction ? <p className="mt-2 text-sm leading-6 text-[#0b6f63]">{detail.latestProgress.supportAction}</p> : null}
            </div>
            <HistoryTable rows={detail.progressHistory.map((progress) => [
              formatDate(progress.updateDate) || "Not recorded",
              `${progress.targetProgressPercentage}%`,
              `${progress.actualProgressPercentage}%`,
              formatProgressVariance(progress.variancePercentage),
              humanise(progress.progressSource),
            ])} empty="No progress update has been recorded yet." headings={["Date", "Target", "Actual", "Variance", "Source"]} />
          </div>
        ) : <InlineEmpty copy="No progress update has been recorded yet." />}
      </RecordSection>

      <RecordSection title="Reviews and check-ins" eyebrow="Support">
        <div className="grid gap-3 lg:grid-cols-3">
          <ReviewCard title="Provider review" review={detail.latestProviderReview} />
          <ReviewCard title="L&D check-in" review={detail.latestLAndDCheckIn} />
          <ReviewCard title="Manager check-in" review={detail.latestManagerCheckIn} />
        </div>
        {detail.reviewHistory.length ? (
          <div className="mt-4">
            <HistoryTable rows={detail.reviewHistory.map((review) => [
              formatDate(review.reviewDate) || "Not recorded",
              humanise(review.reviewType),
              review.reviewerName || "Reviewer not recorded",
              review.summary || "No summary recorded",
              review.actions.length ? review.actions.join(", ") : "No actions recorded",
            ])} headings={["Date", "Type", "Reviewer", "Summary", "Actions"]} empty="No provider or L&D reviews have been recorded yet." />
          </div>
        ) : <InlineEmpty copy="No provider or L&D reviews have been recorded yet." />}
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
        <div className={`h-2 rounded-full ${learner.latestProgress.variancePercentage < -2 ? "bg-[#c95568]" : "bg-[#159b8f]"}`} style={{ width: `${Math.min(100, Math.max(0, learner.latestProgress.actualProgressPercentage))}%` }} />
      </div>
      <p className="mt-1 text-xs text-[#102c3d]/42">Target {learner.latestProgress.targetProgressPercentage}%</p>
    </div>
  );
}

function RecordSection({ title, eyebrow, children }: { title: string; eyebrow: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#102c3d]/[0.075] bg-white shadow-[0_14px_36px_rgba(16,44,61,0.045)]">
      <div className="border-b border-[#102c3d]/[0.06] px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#c95568]">{eyebrow}</p>
        <h3 className="mt-0.5 text-lg font-semibold text-[#102c3d]">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
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

function ReviewCard({ title, review }: { title: string; review: LearnerRecordDetail["latestProviderReview"] }) {
  return (
    <div className="rounded-xl border border-[#102c3d]/[0.06] bg-[#fbfcfb] p-4">
      <h4 className="text-sm font-semibold text-[#102c3d]">{title}</h4>
      {review ? (
        <div className="mt-3 grid gap-1.5 text-xs leading-5 text-[#102c3d]/56">
          <p>Latest: {formatDate(review.reviewDate)}</p>
          <p>Next: {formatDate(review.nextReviewDate) || "Not scheduled"}</p>
          <p>Reviewer: {review.reviewerName || "Not recorded"}</p>
          <p>Status: {humanise(review.status)}</p>
          <p className="pt-1 text-sm leading-6 text-[#102c3d]/68">{review.summary}</p>
          {review.supportRequired ? <p className="font-semibold text-[#0b6f63]">{review.supportRequired}</p> : null}
        </div>
      ) : <p className="mt-3 text-xs leading-5 text-[#102c3d]/46">No review has been recorded yet.</p>}
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
