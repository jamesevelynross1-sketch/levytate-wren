"use client";

import { useEffect, useState } from "react";
import { ManagerCheckInForm } from "@/components/levytate-mvp/ManagerCheckInForm";
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Route,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { MvpPanel, StatusBadge } from "@/components/levytate-mvp/MvpUi";
import { statusTone } from "@/components/levytate-mvp/module-utils";
import type {
  ManagerDirectReportLearnerDetail,
  ManagerSafeReview,
} from "@/lib/levytate/mvp/manager-learner-detail";
import {
  managerActionOwnerLabels,
  managerCheckInPurposeLabels,
  managerConcernLabels,
  managerSupportAvailableLabels,
  managerSupportRequiredLabels,
  managerWorkplaceApplicationLabels,
} from "@/lib/levytate/mvp/manager-check-in";

export function ManagerDirectReportDetail({
  detail: initialDetail,
  onBack,
}: {
  detail: ManagerDirectReportLearnerDetail;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState(initialDetail);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [success, setSuccess] = useState("");

  useEffect(() => setDetail(initialDetail), [initialDetail]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("action") === "manager-check-in" && initialDetail.managerCheckIn.canRecord) setShowCheckIn(true);
  }, [initialDetail.managerCheckIn.canRecord]);

  function openCheckIn() {
    if (!detail.managerCheckIn.canRecord) return;
    setShowCheckIn(true);
    const url = new URL(window.location.href);
    url.searchParams.set("action", "manager-check-in");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function closeCheckIn() {
    setShowCheckIn(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const firstName = detail.employee.name.split(" ")[0] || "The employee";
  const progressSummary = detail.progress
    ? `${firstName} is ${detail.progress.varianceLabel.toLowerCase()} ${detail.managerSupport.nextAction}`
    : `${firstName}'s current journey is ${detail.journey.stage.toLowerCase()}. ${detail.managerSupport.nextAction}`;

  return (
    <div className="grid gap-5">
      {success ? <div role="status" className="flex items-center gap-2 rounded-xl bg-[#e8f6f2] px-4 py-3 text-sm font-semibold text-[#0b766b] ring-1 ring-[#159b8f]/14"><CheckCircle2 size={16} />{success}</div> : null}
      {showCheckIn ? <ManagerCheckInForm detail={detail} onClose={closeCheckIn} onSaved={(nextDetail) => { setDetail(nextDetail); setSuccess("Manager check-in recorded."); closeCheckIn(); }} /> : null}

      <button type="button" onClick={onBack} className="flex w-fit items-center gap-2 text-sm font-semibold text-[#102c3d]/58 transition hover:text-[#102c3d]">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to My Team
      </button>

      <section className="overflow-hidden rounded-2xl border border-[#102c3d]/[0.07] bg-white shadow-[0_18px_46px_rgba(16,44,61,0.055)]">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.62fr)] lg:items-start lg:px-7 lg:py-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={detail.journey.hasActivity ? statusTone(detail.application?.status ?? detail.journey.lifecycleStatusLabel) : "neutral"}>
                {detail.journey.stage}
              </StatusBadge>
              {detail.progress ? <StatusBadge tone={progressTone(detail.progress.position)}>{detail.progress.position}</StatusBadge> : null}
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.025em] text-[#102c3d] sm:text-3xl">{detail.employee.name}</h2>
            <p className="mt-1.5 text-sm leading-6 text-[#102c3d]/58">{detail.employee.jobTitle} · {detail.employee.department} · {detail.employee.site}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HeaderFact label="Manager" value={detail.employee.managerName} />
              <HeaderFact label="Programme" value={detail.programme?.programmeName ?? "No programme recorded"} />
              <HeaderFact label="Application" value={detail.application?.status ?? "No current application"} />
              <HeaderFact label="Expected end" value={displayDate(detail.journey.expectedEndDate)} />
            </div>
          </div>

          <div className="rounded-xl bg-[#edf7f3] p-4 ring-1 ring-[#159b8f]/12 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0b766b]">Manager support</p>
            <h3 className="mt-2 text-lg font-semibold text-[#102c3d]">{detail.managerSupport.title}</h3>
            <p className="mt-2 text-sm leading-6 text-[#102c3d]/62">{progressSummary}</p>
            {detail.managerSupport.relevantDate ? <p className="mt-3 flex items-center gap-2 text-xs font-medium text-[#102c3d]/50"><CalendarDays size={14} aria-hidden="true" /> Relevant date {displayDate(detail.managerSupport.relevantDate)}</p> : null}
            {detail.managerCheckIn.canRecord ? (
              <button type="button" onClick={openCheckIn} className="mt-4 inline-flex h-10 items-center rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#173f55]">
                Record manager check-in
              </button>
            ) : detail.managerSupport.destination ? (
              <a href={detail.managerSupport.destination} className="mt-4 inline-flex h-10 items-center rounded-full bg-[#102c3d] px-4 text-xs font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#173f55]">{detail.managerSupport.destinationLabel}</a>
            ) : detail.managerCheckIn.unavailableReason ? (
              <p className="mt-3 text-xs leading-5 text-[#102c3d]/45">{detail.managerCheckIn.unavailableReason}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <MvpPanel title="Current journey" eyebrow="Where things stand">
          <div className="grid gap-3 sm:grid-cols-2">
            <Fact label="Current stage" value={detail.journey.stage} icon={Route} />
            <Fact label="Current owner" value={detail.journey.currentOwner} icon={UserRound} />
            <Fact label="Entered this stage" value={displayDate(detail.journey.stageEnteredAt)} icon={CalendarDays} />
            <Fact label="Employment route" value={detail.journey.employmentRoute} icon={ClipboardCheck} />
          </div>
          <div className="mt-4 grid gap-3 rounded-xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.055]">
            <JourneyStep label="Next expected step" value={detail.journey.nextExpectedStep} />
            <JourneyStep label="Manager responsibility" value={detail.journey.managerResponsibility} />
          </div>
          {detail.application?.canReview ? (
            <a href="/levytate/app?module=Approvals" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#0b766b] transition hover:text-[#102c3d]">
              Review application <span aria-hidden="true">→</span>
            </a>
          ) : null}
        </MvpPanel>

        <MvpPanel title="Programme" eyebrow="Approved route">
          {detail.programme ? (
            <div>
              <h3 className="text-lg font-semibold text-[#102c3d]">{detail.programme.programmeName}</h3>
              <p className="mt-1 text-sm leading-6 text-[#102c3d]/56">Approved delivery partner: {detail.programme.providerName}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Fact label="Linked standard" value={detail.programme.standardTitle} icon={BookOpenCheck} />
                <Fact label="Reference" value={detail.programme.standardReference || "Not recorded"} icon={ShieldCheck} />
                <Fact label="Expected duration" value={detail.programme.expectedDuration} icon={Clock3} />
                <Fact label="Assessment model" value={detail.programme.assessmentModel} icon={GraduationCap} />
              </div>
              {detail.programme.deliveryInformation.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {detail.programme.deliveryInformation.map((item) => <span key={item} className="rounded-full bg-[#f5f7f3] px-3 py-1.5 text-xs font-semibold text-[#102c3d]/60 ring-1 ring-[#102c3d]/[0.06]">{item}</span>)}
                </div>
              ) : null}
              <details className="mt-4 rounded-xl border border-[#102c3d]/[0.07] bg-white">
                <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-[#102c3d]/62">Funding and standard details</summary>
                <p className="border-t border-[#102c3d]/[0.06] px-4 py-3 text-sm leading-6 text-[#102c3d]/56">{detail.programme.fundingSummary}</p>
              </details>
            </div>
          ) : (
            <EmptyBlock title="No programme recorded" copy="There is no active apprenticeship journey for this employee. Use the next development conversation to discuss suitable progression options." />
          )}
        </MvpPanel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
        <MvpPanel title="Progress" eyebrow="Latest position">
          {detail.progress ? (
            <div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Target" value={`${detail.progress.target}%`} />
                <Metric label="Actual" value={`${detail.progress.actual}%`} tone={detail.progress.variance < 0 ? "coral" : "teal"} />
                <Metric label="Variance" value={`${detail.progress.variance > 0 ? "+" : ""}${detail.progress.variance}pp`} tone={detail.progress.variance < 0 ? "coral" : "teal"} />
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#102c3d]/56"><span>Current progress</span><span>{detail.progress.actual}%</span></div>
                <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-[#e8efec]">
                  <div className="h-full rounded-full bg-[#159b8f]" style={{ width: `${clampPercentage(detail.progress.actual)}%` }} />
                  <span className="absolute inset-y-0 w-0.5 bg-[#102c3d]" style={{ left: `${clampPercentage(detail.progress.target)}%` }} aria-label={`Target ${detail.progress.target}%`} />
                </div>
              </div>
              <div className="mt-4 rounded-xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.055]">
                <p className="text-sm font-semibold text-[#102c3d]">{detail.progress.varianceLabel}</p>
                <p className="mt-1.5 text-sm leading-6 text-[#102c3d]/58">{detail.progress.summary || "No progress summary recorded."}</p>
                <p className="mt-2 text-xs leading-5 text-[#102c3d]/50">Support: {detail.progress.supportAction || "No support action recorded."}</p>
                <p className="mt-2 text-[11px] font-medium text-[#102c3d]/42">Updated {displayDate(detail.progress.updatedAt)} · {detail.progress.source}</p>
              </div>
              {detail.progress.history.length > 1 ? (
                <details className="mt-4 rounded-xl border border-[#102c3d]/[0.07] bg-white">
                  <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-[#102c3d]/62">View progress history</summary>
                  <div className="border-t border-[#102c3d]/[0.06] p-3">
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full text-left text-xs">
                        <thead className="text-[#102c3d]/42"><tr><th className="px-2 py-2 font-semibold">Date</th><th className="px-2 py-2 text-right font-semibold">Target</th><th className="px-2 py-2 text-right font-semibold">Actual</th><th className="px-2 py-2 text-right font-semibold">Variance</th><th className="px-2 py-2 font-semibold">Position</th></tr></thead>
                        <tbody>{detail.progress.history.map((item) => <tr key={`${item.date}-${item.actual}`} className="border-t border-[#102c3d]/[0.05]"><td className="px-2 py-2.5">{displayDate(item.date)}</td><td className="px-2 py-2.5 text-right">{item.target}%</td><td className="px-2 py-2.5 text-right">{item.actual}%</td><td className="px-2 py-2.5 text-right">{item.variance > 0 ? "+" : ""}{item.variance}pp</td><td className="px-2 py-2.5">{item.position}</td></tr>)}</tbody>
                      </table>
                    </div>
                    <div className="grid gap-2 md:hidden">{detail.progress.history.map((item) => <div key={`${item.date}-${item.actual}`} className="rounded-lg bg-[#f8fbfa] p-3 text-xs"><p className="font-semibold">{displayDate(item.date)} · {item.position}</p><p className="mt-1 text-[#102c3d]/56">Target {item.target}% · Actual {item.actual}% · {item.varianceLabel}</p></div>)}</div>
                  </div>
                </details>
              ) : null}
            </div>
          ) : (
            <EmptyBlock title="No progress update has been recorded yet" copy="Progress information will appear here once the approved delivery partner or Apprenticeship Lead records an update." />
          )}
        </MvpPanel>

        <MvpPanel title="Reviews and check-ins" eyebrow="Manager-relevant history">
          <div className="grid gap-3">
            <ReviewSummary label="Provider review" review={detail.reviews.latest.provider} />
            <ReviewSummary label="L&D check-in" review={detail.reviews.latest.lAndD} />
            <ReviewSummary label="Manager check-in" review={detail.reviews.latest.manager} />
          </div>
          {detail.reviews.history.length ? (
            <details className="mt-4 rounded-xl border border-[#102c3d]/[0.07] bg-white">
              <summary className="cursor-pointer list-none px-4 py-3 text-xs font-semibold text-[#102c3d]/62">View concise review history</summary>
              <div className="grid gap-3 border-t border-[#102c3d]/[0.06] p-3">
                {detail.reviews.history.map((review, index) => <ReviewHistory key={`${review.type}-${review.date}-${index}`} review={review} />)}
              </div>
            </details>
          ) : null}
        </MvpPanel>
      </div>

      {detail.breakInLearning || detail.assessment ? (
        <div className="grid gap-5 xl:grid-cols-2">
          {detail.breakInLearning ? <BreakSection detail={detail.breakInLearning} /> : null}
          {detail.assessment ? <AssessmentSection detail={detail.assessment} /> : null}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <MvpPanel title="Manager-relevant actions" eyebrow="Read-only priorities">
          {detail.actions.length ? (
            <div className="grid gap-3">
              {detail.actions.map((action, index) => (
                <article key={`${action.title}-${action.dueDate}-${index}`} className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="text-sm font-semibold text-[#102c3d]">{action.title}</h3><p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{action.reason}</p></div>
                    <StatusBadge tone={action.priority === "Critical" || action.priority === "High" ? "red" : action.priority === "Medium" ? "yellow" : "neutral"}>{action.priority}</StatusBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-[#102c3d]/44"><span>{action.status}</span><span>{action.owner}</span><span>{displayDate(action.dueDate)}</span></div>
                </article>
              ))}
            </div>
          ) : <EmptyBlock title="No manager-relevant actions" copy="No active action currently requires manager ownership or support." />}
        </MvpPanel>

        <MvpPanel title="Journey timeline" eyebrow="Recent activity">
          {detail.timeline.length ? (
            <ol className="grid gap-0">
              {detail.timeline.map((item, index) => (
                <li key={`${item.date}-${item.event}-${index}`} className="relative grid grid-cols-[18px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
                  <div className="relative flex justify-center"><span className="mt-1.5 h-2 w-2 rounded-full bg-[#159b8f]" />{index < detail.timeline.length - 1 ? <span className="absolute bottom-0 top-4 w-px bg-[#102c3d]/[0.09]" /> : null}</div>
                  <div><div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-sm font-semibold text-[#102c3d]">{item.event}</p><time className="text-[11px] font-medium text-[#102c3d]/42">{displayDate(item.date)}</time></div><p className="mt-1 text-xs leading-5 text-[#102c3d]/54">{item.summary}</p></div>
                </li>
              ))}
            </ol>
          ) : <EmptyBlock title="No journey activity recorded" copy="Application and learner events will appear here as the journey progresses." />}
        </MvpPanel>
      </div>
    </div>
  );
}

function BreakSection({ detail }: { detail: NonNullable<ManagerDirectReportLearnerDetail["breakInLearning"]> }) {
  return <MvpPanel title="Break in learning" eyebrow="Return planning"><div className="grid gap-3 sm:grid-cols-2"><Fact label="Status" value={detail.status} icon={TriangleAlert} /><Fact label="Started" value={displayDate(detail.startDate)} icon={CalendarDays} /><Fact label="Expected return" value={displayDate(detail.expectedReturnDate)} icon={CalendarDays} /><Fact label="Actual return" value={displayDate(detail.actualReturnDate)} icon={CheckCircle2} /><Fact label="Duration" value={`${detail.durationDays} day${detail.durationDays === 1 ? "" : "s"}`} icon={Clock3} /><Fact label="Manager notified" value={detail.managerNotified ? "Confirmed" : "Not recorded"} icon={ShieldCheck} /></div><div className="mt-4 rounded-xl bg-[#fff8e1] p-4 ring-1 ring-[#d9a92e]/12"><p className="text-xs font-semibold text-[#7a5a10]">Return plan</p><p className="mt-1.5 text-sm leading-6 text-[#102c3d]/60">{detail.returnPlanSummary}</p><p className="mt-2 text-xs font-medium text-[#102c3d]/48">Next: {detail.nextStep}</p></div></MvpPanel>;
}

function AssessmentSection({ detail }: { detail: NonNullable<ManagerDirectReportLearnerDetail["assessment"]> }) {
  return <MvpPanel title="Assessment" eyebrow="Readiness"><div className="grid gap-3 sm:grid-cols-2"><Fact label="Assessment model" value={detail.model} icon={GraduationCap} /><Fact label="Status" value={detail.status} icon={ClipboardCheck} /><Fact label="Expected readiness" value={displayDate(detail.expectedReadinessDate)} icon={CalendarDays} /><Fact label="Gateway date" value={displayDate(detail.gatewayDate)} icon={Route} /><Fact label="Assessment organisation" value={detail.organisation} icon={ShieldCheck} /><Fact label="Expected assessment start" value={displayDate(detail.expectedStartDate)} icon={CalendarDays} /></div><div className="mt-4 rounded-xl bg-[#edf7f3] p-4 ring-1 ring-[#159b8f]/12"><p className="text-xs font-semibold text-[#0b766b]">Manager confirmation: {detail.managerConfirmationStatus}</p><p className="mt-1.5 text-sm leading-6 text-[#102c3d]/60">{detail.outstandingManagerCheck}</p></div></MvpPanel>;
}

function ReviewSummary({ label, review }: { label: string; review: ManagerSafeReview | null }) {
  return <article className="rounded-xl border border-[#102c3d]/[0.07] bg-white p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#102c3d]/46">{label}</p><p className="mt-1 text-sm font-semibold text-[#102c3d]">{review ? displayDate(review.date) : "Not recorded"}</p></div>{review ? <StatusBadge tone={review.status === "action_required" ? "red" : review.status === "completed" ? "green" : "yellow"}>{review.statusLabel}</StatusBadge> : null}</div>{review ? <><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#102c3d]/54">{review.summary || "No summary recorded."}</p><p className="mt-2 text-[11px] font-medium text-[#102c3d]/42">Next {displayDate(review.nextDate)}</p></> : null}</article>;
}

function ReviewHistory({ review }: { review: ManagerSafeReview }) {
  const checkIn = review.managerCheckIn;
  return <article className="rounded-lg bg-[#f8fbfa] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-semibold text-[#102c3d]">{review.typeLabel}</p><p className="mt-0.5 text-[11px] text-[#102c3d]/42">{review.reviewerName || "Manager"}</p></div><time className="text-[11px] text-[#102c3d]/42">{displayDate(review.date)}</time></div><p className="mt-1.5 text-xs leading-5 text-[#102c3d]/56">{review.summary || "No summary recorded."}</p>{checkIn ? (
    <details className="mt-3 rounded-lg bg-white ring-1 ring-[#102c3d]/[0.06]">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-[11px] font-semibold text-[#0b766b]">Open check-in detail</summary>
      <div className="grid gap-3 border-t border-[#102c3d]/[0.06] px-3 py-3 text-xs leading-5 text-[#102c3d]/58 sm:grid-cols-2">
        <ReviewDetail label="Purpose" value={managerCheckInPurposeLabels[checkIn.discussionPurpose]} />
        <ReviewDetail label="Workplace application" value={managerWorkplaceApplicationLabels[checkIn.workplaceApplication]} />
        <ReviewDetail label="Support available" value={checkIn.supportAvailable.map((item) => managerSupportAvailableLabels[item]).join(", ")} />
        <ReviewDetail label="Concerns" value={checkIn.concerns.map((item) => `${managerConcernLabels[item.type]}${item.detail ? `: ${item.detail}` : ""}`).join("; ")} />
        <ReviewDetail label="Support required" value={checkIn.supportRequired.map((item) => managerSupportRequiredLabels[item]).join(", ")} />
        <ReviewDetail label="Next check-in" value={displayDate(review.nextDate)} />
        {checkIn.learningApplied ? <ReviewDetail label="Learning applied" value={checkIn.learningApplied} /> : null}
        {checkIn.workplaceOpportunityAvailable ? <ReviewDetail label="Opportunity available" value={checkIn.workplaceOpportunityAvailable} /> : null}
        {checkIn.workplaceOpportunityNeeded ? <ReviewDetail label="Opportunity needed" value={checkIn.workplaceOpportunityNeeded} /> : null}
        {checkIn.agreedActions.length ? <div className="sm:col-span-2"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/38">Agreed actions</p><ul className="mt-1.5 grid gap-1">{checkIn.agreedActions.map((action, index) => <li key={`${action.description}-${index}`}>{action.description} · {managerActionOwnerLabels[action.responsibleParty]}{action.targetDate ? ` · ${displayDate(action.targetDate)}` : ""}</li>)}</ul></div> : null}
        {checkIn.note ? <div className="sm:col-span-2"><ReviewDetail label="Note" value={checkIn.note} /></div> : null}
      </div>
    </details>
  ) : <>{review.agreedActions.length ? <p className="mt-1.5 text-[11px] leading-5 text-[#102c3d]/48">Agreed actions: {review.agreedActions.join("; ")}</p> : null}{review.supportRequired ? <p className="mt-1 text-[11px] leading-5 text-[#102c3d]/48">Support: {review.supportRequired}</p> : null}</>}</article>;
}

function ReviewDetail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#102c3d]/38">{label}</p><p className="mt-0.5 break-words">{value || "Not recorded"}</p></div>;
}

function HeaderFact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#102c3d]/38">{label}</p><p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[#102c3d]">{value}</p></div>;
}

function Fact({ label, value, icon: Icon }: { label: string; value: string; icon: typeof UserRound }) {
  return <div className="flex min-w-0 gap-3 rounded-xl bg-[#f8fbfa] p-3.5 ring-1 ring-[#102c3d]/[0.045]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#0b766b] ring-1 ring-[#102c3d]/[0.055]"><Icon size={15} aria-hidden="true" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#102c3d]/38">{label}</p><p className="mt-1 break-words text-sm font-semibold leading-5 text-[#102c3d]">{value}</p></div></div>;
}

function JourneyStep({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#102c3d]/38">{label}</p><p className="mt-1 text-sm leading-6 text-[#102c3d]/62">{value}</p></div>;
}

function Metric({ label, value, tone = "navy" }: { label: string; value: string; tone?: "navy" | "teal" | "coral" }) {
  const colour = tone === "teal" ? "text-[#0b766b]" : tone === "coral" ? "text-[#d84c5d]" : "text-[#102c3d]";
  return <div className="rounded-xl bg-[#f8fbfa] p-4 ring-1 ring-[#102c3d]/[0.05]"><p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#102c3d]/38">{label}</p><p className={`mt-1 text-2xl font-semibold tracking-[-0.02em] ${colour}`}>{value}</p></div>;
}

function EmptyBlock({ title, copy }: { title: string; copy: string }) {
  return <div className="rounded-xl border border-dashed border-[#102c3d]/[0.13] bg-[#f8fbfa] px-5 py-7 text-center"><h3 className="text-sm font-semibold text-[#102c3d]">{title}</h3><p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-[#102c3d]/54">{copy}</p></div>;
}

function progressTone(position: string): "green" | "yellow" | "red" | "neutral" {
  if (position === "Ahead of target" || position === "On target") return "green";
  if (position === "Slightly behind") return "yellow";
  if (position === "Significantly behind") return "red";
  return "neutral";
}

function displayDate(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value.length > 10 ? value : `${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}
