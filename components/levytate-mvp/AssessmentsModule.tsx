"use client";

import { Check, ChevronRight, ClipboardList, LockKeyhole, Printer, RefreshCw, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMvpWorkspace } from "@/components/levytate-mvp/MvpWorkspaceStore";
import type { AssessmentActionInput, AssessmentView, AssessmentWorkspace } from "@/lib/levytate/assessments/api";
import {
  assessmentReviewDraft,
  campaignSubmissionDisclosure,
  runAssessmentSaveAndSubmit,
  type AssessmentReviewDraft,
} from "@/lib/levytate/assessments/behaviour";
import type { AssessmentAnswerMap } from "@/lib/levytate/assessments/domain";

const panel = "rounded-2xl border border-[#18384c]/10 bg-white p-5 shadow-[0_12px_35px_rgba(16,44,61,0.05)]";
const input = "w-full rounded-xl border border-[#18384c]/15 bg-white px-3 py-2.5 text-sm text-[#102c3d] outline-none transition focus:border-[#0b7b70] focus:ring-2 focus:ring-[#0b7b70]/15";
const button = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#0b7b70] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#08665e] disabled:cursor-not-allowed disabled:opacity-50";
const secondary = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#18384c]/15 bg-white px-4 py-2 text-sm font-semibold text-[#15364a] transition hover:bg-[#f4f8f7] disabled:opacity-50";

export function AssessmentsModule() {
  const { data } = useMvpWorkspace();
  const [workspace, setWorkspace] = useState<AssessmentWorkspace | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/levytate-assessments", { cache: "no-store" });
      const payload = await response.json() as { ok?: boolean; workspace?: AssessmentWorkspace; message?: string };
      if (!response.ok || !payload.workspace) throw new Error(payload.message || "Assessments could not be loaded.");
      const nextWorkspace = payload.workspace;
      setWorkspace(nextWorkspace);
      setSelectedId((current) => current && nextWorkspace.assessments.some((item) => item.id === current) ? current : nextWorkspace.assessments[0]?.id ?? null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Assessments could not be loaded."); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const executeAction = useCallback(async (action: AssessmentActionInput) => {
    setMessage("");
    try {
      const response = await fetch("/api/levytate-assessments", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...action, idempotencyKey: `${action.action}:${crypto.randomUUID()}` }),
      });
      const payload = await response.json() as { ok?: boolean; workspace?: AssessmentWorkspace; message?: string };
      if (!response.ok || !payload.workspace) throw new Error(payload.message || "The assessment action could not be completed.");
      setWorkspace(payload.workspace);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The assessment action could not be completed.");
      return false;
    }
  }, []);

  const act = useCallback(async (action: AssessmentActionInput) => {
    setBusy(true);
    try {
      const completed = await executeAction(action);
      if (completed) setMessage("Saved successfully.");
      return completed;
    } finally { setBusy(false); }
  }, [executeAction]);

  const saveAndSubmit = useCallback(async (assessmentId: string, answers: AssessmentAnswerMap) => {
    setBusy(true);
    try {
      const completed = await runAssessmentSaveAndSubmit(
        () => executeAction({ action: "save_answers", assessmentId, answers }),
        () => executeAction({ action: "submit", assessmentId }),
      );
      if (completed) setMessage("Assessment submitted successfully.");
      return completed;
    } finally { setBusy(false); }
  }, [executeAction]);

  if (!workspace) return <div className={panel} role="status">{busy ? "Loading Assessments…" : message || "Assessments are unavailable."}</div>;
  const selected = workspace.assessments.find((item) => item.id === selectedId) ?? null;
  const isEmployee = workspace.role === "Employee";
  const isManager = workspace.role === "Line Manager";
  const standards = [...new Map(data.roles.flatMap((role) => role.pathwayMappings).map((mapping) => [mapping.apprenticeshipStandardId, mapping.apprenticeshipStandardId])).values()];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-[#102c3d] px-5 py-5 text-white md:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9fd8d0]">Workforce development</p><h2 className="mt-2 text-2xl font-semibold">Assessments</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/70">Evidence-led conversations about role needs, AI, automation and data — with privacy, context and clear next steps.</p></div>
          <button className={secondary} onClick={() => void load()} disabled={busy}><RefreshCw size={16} /> Refresh</button>
        </div>
      </section>
      {message ? <p role="status" className="rounded-xl border border-[#0b7b70]/20 bg-[#edf8f6] px-4 py-3 text-sm text-[#075e57]">{message}</p> : null}
      {isEmployee ? (
        <EmployeeExperience workspace={workspace} selected={selected} standards={standards} busy={busy} onSelect={setSelectedId} onAction={act} onSaveAndSubmit={saveAndSubmit} />
      ) : isManager ? (
        <ReviewerExperience workspace={workspace} selected={selected} busy={busy} onSelect={setSelectedId} onAction={act} manager />
      ) : (
        <EmployerExperience workspace={workspace} selected={selected} busy={busy} onSelect={setSelectedId} onAction={act} />
      )}
    </div>
  );
}

function EmployeeExperience({ workspace, selected, standards, busy, onSelect, onAction, onSaveAndSubmit }: {
  workspace: AssessmentWorkspace; selected: AssessmentView | null; standards: string[]; busy: boolean;
  onSelect: (id: string) => void; onAction: (action: AssessmentActionInput) => Promise<boolean>;
  onSaveAndSubmit: (assessmentId: string, answers: AssessmentAnswerMap) => Promise<boolean>;
}) {
  const [answers, setAnswers] = useState<AssessmentAnswerMap>(selected?.answers ?? {});
  const [standard, setStandard] = useState(standards[0] ?? "");
  useEffect(() => setAnswers(selected?.answers ?? {}), [selected?.id, selected?.currentRevision, selected?.answers]);
  const openCampaigns = workspace.campaigns.filter((campaign) => campaign.status === "open" && !workspace.assessments.some((assessment) => assessment.campaignId === campaign.id));
  const selectedCampaign = selected?.campaignId ? workspace.campaigns.find((campaign) => campaign.id === selected.campaignId) ?? null : null;
  return <>
    <div className="grid gap-5 xl:grid-cols-[minmax(250px,0.35fr)_minmax(0,1fr)]">
      <aside className={`${panel} h-fit`}><div className="flex items-center gap-2"><ClipboardList size={18} className="text-[#0b7b70]"/><h3 className="font-semibold text-[#102c3d]">Your assessments</h3></div>
        <p className="mt-2 text-xs leading-5 text-[#52677d]">{workspace.disclosure.private}</p>
        <div className="mt-4 space-y-2">{workspace.assessments.map((assessment) => <button key={assessment.id} onClick={() => onSelect(assessment.id)} className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${selected?.id === assessment.id ? "border-[#0b7b70] bg-[#edf8f6]" : "border-[#18384c]/10"}`}><span className="block font-semibold text-[#102c3d]">{assessment.campaignTitle || "Personal assessment"}</span><span className="mt-1 block text-xs text-[#667b8b]">{assessment.status.replaceAll("_", " ")} · revision {assessment.currentRevision}</span></button>)}</div>
        <div className="mt-4 space-y-2"><button className={secondary} disabled={busy} onClick={() => void onAction({ action: "start_assessment" })}>Start personal assessment</button>{openCampaigns.map((campaign) => <button key={campaign.id} className={secondary} disabled={busy} onClick={() => void onAction({ action: "start_assessment", campaignId: campaign.id })}>Start: {campaign.title}</button>)}</div>
      </aside>
      <main className="space-y-5">{selected ? <>
        <section className={panel}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-[#102c3d]">{selected.campaignTitle || "Personal assessment"}</h3><p className="mt-1 text-sm text-[#52677d]">Version {workspace.questionnaireVersion}</p></div><span className="rounded-full bg-[#eef4f3] px-3 py-1 text-xs font-semibold text-[#0b6e65]">{selected.status.replaceAll("_", " ")}</span></div>
          {selectedCampaign ? <div className="mt-4 rounded-xl border border-[#18384c]/10 bg-[#f4f8f7] p-4"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667b8b]">Why you have been invited</p><p className="mt-2 text-sm leading-6 text-[#18384c]">{selectedCampaign.purpose}</p><p className="mt-3 text-xs leading-5 text-[#52677d]">{campaignSubmissionDisclosure(selectedCampaign.sharingPolicy)}</p><p className="mt-2 text-xs font-semibold text-[#075e57]">Your draft answers remain private until you submit.</p></div> : <p className="mt-3 text-sm text-[#52677d]">{workspace.disclosure.private}</p>}
          <div className="mt-5 space-y-5">{workspace.questions.map((question, index) => <QuestionField key={question.id} question={question} value={answers[question.id]} index={index} onChange={(value) => setAnswers((current) => ({ ...current, [question.id]: value }))} />)}</div>
          <div className="mt-6 flex flex-wrap gap-2"><button className={secondary} disabled={busy} onClick={() => void onAction({ action: "save_answers", assessmentId: selected.id, answers })}>Save draft</button><button className={button} disabled={busy} onClick={() => void onSaveAndSubmit(selected.id, answers)}><Check size={16}/> Submit assessment</button></div>
        </section>
        {selected.result ? <ResultPanel assessment={selected} disclosure={workspace.disclosure.guidance} /> : null}
        {selected.activeSubmittedRevision ? <section className={panel}><h3 className="font-semibold text-[#102c3d]">Choose the next step</h3><p className="mt-2 text-sm text-[#52677d]">Sharing is explicit. Creating an application only prepares a draft; normal eligibility and approval rules still apply.</p><div className="mt-4 flex flex-wrap gap-2"><button className={secondary} disabled={busy || selected.sharedWithManager} onClick={() => void onAction({ action: "share_with_manager", assessmentId: selected.id })}>{selected.sharedWithManager ? "Shared with manager" : "Share with my manager"}</button><button className={secondary} disabled={busy} onClick={() => void onAction({ action: "start_reassessment", baselineAssessmentId: selected.id })}>Start reassessment</button></div><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]"><label className="text-sm font-medium text-[#18384c]">Apprenticeship standard<select className={`${input} mt-1`} value={standard} onChange={(event) => setStandard(event.target.value)}><option value="">Select a mapped standard</option>{standards.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><button className={`${button} self-end`} disabled={busy || !standard || Boolean(selected.applicationId)} onClick={() => void onAction({ action: "create_application_draft", assessmentId: selected.id, apprenticeshipStandardId: standard })}>{selected.applicationId ? "Application draft created" : "Prepare application draft"}</button></div></section> : null}
      </> : <Empty title="Start an assessment" copy="Choose an assigned campaign or begin a private personal assessment." />}</main>
    </div>
  </>;
}

function ReviewerExperience({ workspace, selected, busy, onSelect, onAction, manager = false }: {
  workspace: AssessmentWorkspace; selected: AssessmentView | null; busy: boolean; manager?: boolean;
  onSelect: (id: string) => void; onAction: (action: AssessmentActionInput) => Promise<boolean>;
}) {
  const [review, setReview] = useState<AssessmentReviewDraft>(() => assessmentReviewDraft(selected?.review));
  useEffect(() => setReview(assessmentReviewDraft(selected?.review)), [selected?.id, selected?.review]);
  return <div className="grid gap-5 xl:grid-cols-[minmax(270px,0.4fr)_minmax(0,1fr)]"><aside className={`${panel} h-fit`}><h3 className="font-semibold text-[#102c3d]">{manager ? "Shared direct-report assessments" : "Submitted assessments"}</h3><p className="mt-2 text-xs leading-5 text-[#52677d]">Only explicitly shared or policy-authorised submissions appear here. Private drafts are never shown.</p><div className="mt-4 space-y-2">{workspace.assessments.map((assessment) => <button key={assessment.id} onClick={() => onSelect(assessment.id)} className={`w-full rounded-xl border p-3 text-left ${selected?.id === assessment.id ? "border-[#0b7b70] bg-[#edf8f6]" : "border-[#18384c]/10"}`}><span className="font-semibold text-[#102c3d]">{assessment.employeeName}</span><span className="block text-xs text-[#667b8b]">{assessment.department} · {assessment.campaignTitle || "Personal"}</span></button>)}</div></aside><main className="space-y-5">{selected ? <><ResultPanel assessment={selected} disclosure={workspace.disclosure.guidance}/><section className={panel}><h3 className="font-semibold text-[#102c3d]">Contextual review</h3><p className="mt-2 text-sm text-[#52677d]">Record business context, available support and constraints separately from employee capability.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Business context" value={review.businessContext} onChange={(value) => setReview({ ...review, businessContext: value })}/><Field label="Support available" value={review.supportAvailable} onChange={(value) => setReview({ ...review, supportAvailable: value })}/><Field label="Workplace constraints" value={review.constraints} onChange={(value) => setReview({ ...review, constraints: value })}/><Field label="Proposed action and accountable owner" value={review.recommendedAction} onChange={(value) => setReview({ ...review, recommendedAction: value })}/></div><label className="mt-3 block text-sm font-medium text-[#18384c]">Review outcome<select className={`${input} mt-1`} value={review.status} onChange={(event) => setReview({ ...review, status: event.target.value as typeof review.status })}><option value="relevant">Relevant for development planning</option><option value="clarification_requested">Clarification requested</option><option value="not_currently_relevant">Not currently relevant</option></select></label><Field label="Review comment" value={review.managerComment} onChange={(value) => setReview({ ...review, managerComment: value })}/><button className={`${button} mt-4`} disabled={busy || !review.managerComment.trim()} onClick={() => void onAction({ action: "review", assessmentId: selected.id, ...review })}>Save review</button></section></> : <Empty title="No shared assessment selected" copy="Individual findings only appear where the employee or campaign policy permits access."/>}</main></div>;
}

function EmployerExperience({ workspace, selected, busy, onSelect, onAction }: {
  workspace: AssessmentWorkspace; selected: AssessmentView | null; busy: boolean; onSelect: (id: string) => void;
  onAction: (action: AssessmentActionInput) => Promise<boolean>;
}) {
  const [campaign, setCampaign] = useState({ title: "", purpose: "", objectives: "", departments: "", closingDate: "", sharingPolicy: "campaign_owner_summary" as const, employeeIds: [] as string[] });
  const [showCreate, setShowCreate] = useState(false);
  const [printCampaignId, setPrintCampaignId] = useState<string | null>(null);
  const printCampaign = workspace.campaigns.find((item) => item.id === printCampaignId) ?? null;
  const printReport = workspace.reporting.find((item) => item.campaignId === printCampaignId) ?? null;
  useEffect(() => {
    if (!printCampaignId) return;
    document.body.classList.add("assessment-report-printing");
    const print = window.setTimeout(() => window.print(), 0);
    const clear = () => { document.body.classList.remove("assessment-report-printing"); setPrintCampaignId(null); };
    window.addEventListener("afterprint", clear, { once: true });
    return () => { window.clearTimeout(print); window.removeEventListener("afterprint", clear); document.body.classList.remove("assessment-report-printing"); };
  }, [printCampaignId]);
  return <div className="space-y-5"><section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-[#102c3d]">Assessment campaigns</h3><p className="mt-1 text-sm text-[#52677d]">Define purpose, select an explicit audience and preview before opening.</p></div><button className={button} onClick={() => setShowCreate((value) => !value)}>Create campaign</button></div>
    {showCreate ? <div className="mt-5 grid gap-4 border-t border-[#18384c]/10 pt-5 md:grid-cols-2"><Field label="Campaign title" value={campaign.title} onChange={(value) => setCampaign({ ...campaign, title: value })}/><Field label="Purpose shown to employees" value={campaign.purpose} onChange={(value) => setCampaign({ ...campaign, purpose: value })}/><Field label="Business objectives (one per line)" value={campaign.objectives} onChange={(value) => setCampaign({ ...campaign, objectives: value })}/><Field label="Departments in scope (one per line)" value={campaign.departments} onChange={(value) => setCampaign({ ...campaign, departments: value })}/><label className="text-sm font-medium text-[#18384c]">Closing date<input type="date" className={`${input} mt-1`} value={campaign.closingDate} onChange={(event) => setCampaign({ ...campaign, closingDate: event.target.value })}/></label><label className="text-sm font-medium text-[#18384c]">Individual visibility<select className={`${input} mt-1`} value={campaign.sharingPolicy} onChange={(event) => setCampaign({ ...campaign, sharingPolicy: event.target.value as typeof campaign.sharingPolicy })}><option value="campaign_owner_summary">Campaign owner and authorised reporting roles</option><option value="manager_and_campaign_owner">Also share with the employee’s manager</option></select></label><fieldset className="md:col-span-2"><legend className="text-sm font-medium text-[#18384c]">Recorded audience</legend><div className="mt-2 grid max-h-52 gap-2 overflow-auto rounded-xl border border-[#18384c]/10 p-3 sm:grid-cols-2">{workspace.availableEmployees.map((employee) => <label key={employee.id} className="flex gap-2 rounded-lg p-2 text-sm hover:bg-[#f4f8f7]"><input type="checkbox" checked={campaign.employeeIds.includes(employee.id)} onChange={(event) => setCampaign({ ...campaign, employeeIds: event.target.checked ? [...campaign.employeeIds, employee.id] : campaign.employeeIds.filter((id) => id !== employee.id) })}/><span><b>{employee.name}</b><small className="block text-[#667b8b]">{employee.department} · {employee.jobTitle}</small></span></label>)}</div></fieldset><div className="md:col-span-2"><button className={button} disabled={busy || !campaign.title || !campaign.purpose || !campaign.employeeIds.length} onClick={() => void onAction({ action: "create_campaign", title: campaign.title, purpose: campaign.purpose, businessObjectives: campaign.objectives.split("\n").filter(Boolean), departments: campaign.departments.split("\n").filter(Boolean), employeeIds: campaign.employeeIds, closingDate: campaign.closingDate || undefined, sharingPolicy: campaign.sharingPolicy }).then((completed) => { if (completed) setShowCreate(false); })}>Save draft campaign</button></div></div> : null}
    <div className="mt-5 grid gap-3 lg:grid-cols-2">{workspace.campaigns.map((item) => <article key={item.id} className="rounded-xl border border-[#18384c]/10 p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-[#102c3d]">{item.title}</h4><p className="mt-1 text-sm text-[#52677d]">{item.purpose}</p></div><span className="rounded-full bg-[#eef4f3] px-2.5 py-1 text-xs font-semibold text-[#0b6e65]">{item.status}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><Metric label="Invited" value={item.invited}/><Metric label="Submitted" value={item.submitted}/><Metric label="Participation" value={`${item.participationPercent}%`}/></div><div className="mt-4 flex flex-wrap gap-2">{item.status === "draft" ? <button className={secondary} disabled={busy} onClick={() => void onAction({ action: "open_campaign", campaignId: item.id })}>Open campaign</button> : null}{item.status === "open" ? <button className={secondary} disabled={busy} onClick={() => void onAction({ action: "close_campaign", campaignId: item.id })}>Close campaign</button> : null}{item.status === "closed" ? <button className={secondary} disabled={busy} onClick={() => void onAction({ action: "reopen_campaign", campaignId: item.id })}>Reopen campaign</button> : null}<button className={secondary} onClick={() => setPrintCampaignId(item.id)}><Printer size={15}/> Print report</button></div></article>)}</div>
  </section><section className={panel}><div className="flex items-center gap-2"><Users size={18} className="text-[#0b7b70]"/><h3 className="font-semibold text-[#102c3d]">Reporting</h3></div><p className="mt-2 text-sm text-[#52677d]">Participation and aggregate evidence are separated. Department detail is suppressed below five submitted responses.</p><div className="mt-4 space-y-3">{workspace.reporting.map((report) => <article key={report.campaignId} className="rounded-xl border border-[#18384c]/10 p-4"><p className="text-sm font-medium text-[#18384c]">{report.definition}</p><div className="mt-3 grid gap-3 md:grid-cols-2">{report.groups.map((group) => <div key={group.department} className="rounded-lg bg-[#f4f8f7] p-3"><b className="text-sm text-[#102c3d]">{group.department}</b><p className="mt-1 text-xs text-[#52677d]">{group.invited} invited · {group.submitted} submitted · {group.participationPercent}% participation</p>{group.suppressed ? <p className="mt-1 text-xs text-[#667b8b]">Aggregate findings suppressed below {report.suppressionThreshold} submissions.</p> : <><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#667b8b]">Recurring needs</p><ul className="mt-1 text-sm text-[#40586a]">{group.recurringNeeds.map((item) => <li key={item.label}>{item.label} ({item.count})</li>)}</ul><p className="mt-2 text-xs font-semibold uppercase tracking-wide text-[#667b8b]">Workplace blockers</p><ul className="mt-1 text-sm text-[#40586a]">{group.blockers.map((item) => <li key={item.label}>{item.label} ({item.count})</li>)}</ul></>}</div>)}</div></article>)}</div></section>
  {workspace.assessments.length ? <ReviewerExperience workspace={workspace} selected={selected} busy={busy} onSelect={onSelect} onAction={onAction}/> : null}
  {printCampaign && printReport ? <CampaignPrintReport campaign={printCampaign} report={printReport} /> : null}</div>;
}

function CampaignPrintReport({ campaign, report }: {
  campaign: AssessmentWorkspace["campaigns"][number];
  report: AssessmentWorkspace["reporting"][number];
}) {
  if (typeof document === "undefined") return null;
  return createPortal(<article className="assessment-campaign-report hidden" aria-label={`${campaign.title} aggregate assessment report`}>
    <header>
      <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#0b7b70]">LevyTate workforce assessment</p>
      <h1 className="mt-2 text-2xl font-semibold text-[#102c3d]">{campaign.title}</h1>
      <p className="mt-2 text-sm text-[#40586a]">{campaign.purpose}</p>
    </header>
    <section className="mt-6 grid grid-cols-3 gap-3">
      <Metric label="Invited" value={report.invited}/>
      <Metric label="Submitted" value={report.submitted}/>
      <Metric label="Participation" value={`${report.participationPercent}%`}/>
    </section>
    <p className="mt-5 text-sm text-[#40586a]">{report.definition}</p>
    <section className="mt-6 space-y-4">
      {report.groups.map((group) => <div key={group.department} className="rounded-xl border border-[#18384c]/15 p-4">
        <h2 className="font-semibold text-[#102c3d]">{group.department}</h2>
        <p className="mt-1 text-sm text-[#40586a]">{group.invited} invited · {group.submitted} submitted · {group.participationPercent}% participation</p>
        {group.suppressed ? <p className="mt-3 text-sm text-[#52677d]">Aggregate findings are suppressed because fewer than {report.suppressionThreshold} employees submitted in this department. Non-response is not capability evidence.</p> : <div className="mt-4 grid grid-cols-2 gap-4"><List title="Recurring needs" items={group.recurringNeeds.map((item) => `${item.label} (${item.count})`)}/><List title="Workplace blockers" items={group.blockers.map((item) => `${item.label} (${item.count})`)}/></div>}
      </div>)}
    </section>
    <footer className="mt-6 border-t border-[#18384c]/15 pt-4 text-xs leading-5 text-[#52677d]">Aggregate campaign report only. Named employee reviews and private assessment content are excluded. Findings are indicative development guidance and do not determine competence, eligibility, funding or approval.</footer>
  </article>, document.body);
}

function QuestionField({ question, value, index, onChange }: { question: AssessmentWorkspace["questions"][number]; value: AssessmentAnswerMap[string]; index: number; onChange: (value: AssessmentAnswerMap[string]) => void }) {
  return <fieldset><legend className="text-sm font-semibold text-[#15364a]"><span className="mr-2 text-[#0b7b70]">{index + 1}.</span>{question.prompt}</legend><p className="mt-1 text-xs leading-5 text-[#667b8b]">{question.helpText}</p>{question.type === "long_text" ? <textarea aria-label={question.prompt} rows={3} className={`${input} mt-2 resize-y`} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}/> : <div className="mt-2 grid gap-2 sm:grid-cols-2">{question.options?.map((option) => { const checked = question.type === "multi_choice" ? Array.isArray(value) && value.includes(option.value) : value === option.value; return <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${checked ? "border-[#0b7b70] bg-[#edf8f6]" : "border-[#18384c]/10"}`}><input type={question.type === "multi_choice" ? "checkbox" : "radio"} name={question.id} checked={checked} onChange={() => onChange(question.type === "multi_choice" ? (checked ? (Array.isArray(value) ? value.filter((item) => item !== option.value) : []) : [...(Array.isArray(value) ? value : []), option.value]) : option.value)}/>{option.label}</label>; })}</div>}</fieldset>;
}

function ResultPanel({ assessment, disclosure }: { assessment: AssessmentView; disclosure: string }) { const result = assessment.result!; return <section className={panel}><div className="flex items-center gap-2"><LockKeyhole size={18} className="text-[#0b7b70]"/><h3 className="font-semibold text-[#102c3d]">Indicative findings</h3></div><p className="mt-2 text-xs leading-5 text-[#667b8b]">{disclosure}</p><div className="mt-4 grid gap-4 md:grid-cols-2"><List title="Strengths" items={result.strengths}/><List title="Development needs" items={result.developmentNeeds}/><List title="Workplace opportunity" items={[result.practicalOpportunity]}/><List title="Workplace conditions" items={result.workplaceConstraints.length ? result.workplaceConstraints : ["No immediate workplace constraint identified."]}/></div><div className="mt-4"><h4 className="text-sm font-semibold text-[#15364a]">Possible routes to discuss</h4><div className="mt-2 grid gap-2 md:grid-cols-2">{result.possibleRoutes.map((route) => <article key={route.route} className="rounded-xl bg-[#f4f8f7] p-3"><b className="text-sm text-[#102c3d]">{route.label}</b><p className="mt-1 text-xs leading-5 text-[#52677d]">{route.rationale}</p></article>)}</div></div>{assessment.review ? <div className="mt-4 rounded-xl border border-[#0b7b70]/20 bg-[#edf8f6] p-4"><b className="text-sm text-[#075e57]">Latest contextual review: {assessment.review.status.replaceAll("_", " ")}</b><p className="mt-1 text-sm text-[#40586a]">{assessment.review.managerComment}</p></div> : null}</section>; }
function List({ title, items }: { title: string; items: string[] }) { return <div><h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#667b8b]">{title}</h4><ul className="mt-2 space-y-2">{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-5 text-[#40586a]"><ChevronRight size={15} className="mt-0.5 shrink-0 text-[#0b7b70]"/>{item}</li>)}</ul></div>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="mt-3 block text-sm font-medium text-[#18384c]">{label}<textarea rows={3} className={`${input} mt-1 resize-y`} value={value} onChange={(event) => onChange(event.target.value)}/></label>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg bg-[#f4f8f7] p-2"><b className="block text-lg text-[#102c3d]">{value}</b><span className="text-[11px] text-[#667b8b]">{label}</span></div>; }
function Empty({ title, copy }: { title: string; copy: string }) { return <div className={panel}><h3 className="font-semibold text-[#102c3d]">{title}</h3><p className="mt-2 text-sm text-[#52677d]">{copy}</p></div>; }
